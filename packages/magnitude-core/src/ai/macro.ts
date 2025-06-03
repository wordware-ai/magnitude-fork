import { convertToBamlClientOptions } from "./util";
// Import ModularMemoryContext instead of old MemoryContext
import { b, ModularMemoryContext } from "@/ai/baml_client"; 
import { Image as BamlImage, Collector, ClientRegistry } from "@boundaryml/baml";
import { Action, ActionIntent, Intent } from "@/actions/types";
import { TestStepDefinition } from "@/types";
import { BamlAsyncClient } from "./baml_client/async_client";
import logger from "@/logger";
import { Logger } from 'pino';
import { BugDetectedFailure, MisalignmentFailure } from "@/common";
import { LLMClient } from "@/ai/types";
import { TabState } from "@/web/tabs";
import { ActionDefinition } from "@/actions";
import TypeBuilder from "./baml_client/type_builder";
import { Schema, z } from 'zod';
import { convertActionDefinitionsToBaml, convertZodToBaml } from "@/actions/util";
import { Image } from '@/memory/image';

interface MacroAgentConfig {
    client: LLMClient;
}

const DEFAULT_CONFIG = {}

export interface MacroAgentInfo {
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    numCalls: number
}

export class MacroAgent {
    /**
     * Strong reasoning agent for high level strategy and planning.
     */
    private config: MacroAgentConfig;
    private collector: Collector;
    private cr: ClientRegistry;
    private baml: BamlAsyncClient;
    private logger: Logger;

    constructor(config: { client: LLMClient } & Partial<MacroAgentConfig>) {
        this.config = {...DEFAULT_CONFIG, ...config};
        this.collector = new Collector("macro");
        this.cr = new ClientRegistry();
        const client = this.config.client;
        let options = convertToBamlClientOptions(this.config.client);
        this.cr.addLlmClient('Macro', client.provider, options, 'DefaultRetryPolicy');
        this.cr.setPrimary('Macro');

        this.baml = b.withOptions({ collector: this.collector, clientRegistry: this.cr });
        this.logger = logger.child({ name: 'magnus.planner' });
    }

    getInfo(): MacroAgentInfo {
        return {
            provider: this.config.client.provider,
            model: 'model' in this.config.client.options ?
                this.config.client.options.model : 'unknown',
            inputTokens: this.collector.usage.inputTokens ?? 0,
            outputTokens: this.collector.usage.outputTokens ?? 0,
            numCalls: this.collector.logs.length
        }
    }

    async createPartialRecipe<T>(
        context: ModularMemoryContext, // Changed to ModularMemoryContext
        task: string,
        actionVocabulary: ActionDefinition<T>[]
    ): Promise<{ reasoning: string, actions: Action[] }> {
        const tb = new TypeBuilder();

        tb.PartialRecipe.addProperty('actions', tb.list(convertActionDefinitionsToBaml(tb, actionVocabulary)));

        const start = Date.now();
        // Assuming this.baml.CreatePartialRecipe is now typed to accept ModularMemoryContext
        // after BAML generation picked up changes in planner.baml
        const response = await this.baml.CreatePartialRecipe( 
            context,
            task,
            { tb }
        );
        this.logger.trace(`createPartialRecipe took ${Date.now()-start}ms`);
        // BAML does not carry over action type to @@dynamic of PartialRecipe, so forced cast necssary
        //return response as unknown as { actions: z.infer<ActionDefinition<T>['schema']>[] };//, finished: boolean };
        return {
            reasoning: response.reasoning,//(response.observations ? response.observations + " " : "") + response.meta_reasoning + " " + response.reasoning,
            actions: response.actions// as z.infer<ActionDefinition<T>['schema']>[]
        }
    }

    async extract<T extends Schema>(instructions: string, schema: T, screenshot: Image, domContent: string): Promise<z.infer<T>> {
        const tb = new TypeBuilder();

        if (schema instanceof z.ZodObject) {
            // populate ExtractedData with schema KVs instead of wrapping in data key unnecessarily
            for (const [key, fieldSchema] of Object.entries(schema.shape)) {
                tb.ExtractedData.addProperty(key, convertZodToBaml(tb, fieldSchema as any));
            }
        } else {
            // for array or primitive have to wrap data key
            tb.ExtractedData.addProperty('data', convertZodToBaml(tb, schema));
        }
        // } else if (schema instanceof z.ZodArray) {

        // }

        const resp = await this.baml.ExtractData(instructions, await screenshot.toBaml(), domContent, { tb });

        if (schema instanceof z.ZodObject) {
            return resp;
        } else {
            return resp.data;
        }
    }

    // async evaluateCheck(screenshot: Image, check: string, existingRecipe: Action[], tabState: TabState): Promise<boolean> {
    //     const stringifiedExistingRecipe = [];
    //     for (const action of existingRecipe) {
    //         stringifiedExistingRecipe.push(JSON.stringify(action, null, 4))
    //     }

    //     const start = Date.now();
    //     const response = await this.baml.EvaluateCheck(
    //         {
    //             screenshot: await screenshot.toBaml(),//Image.fromBase64('image/png', screenshot.image),
    //             actionHistory: stringifiedExistingRecipe,
    //             tabState: tabState
    //         },
    //         check
    //     );
    //     this.logger.trace(`evaluateCheck took ${Date.now()-start}ms`);
    //     return response.passes;
    // }

    // async classifyCheckFailure(screenshot: Image, check: string, existingRecipe: Action[], tabState: TabState): Promise<BugDetectedFailure | MisalignmentFailure> {
    //     const stringifiedExistingRecipe = [];
    //     for (const action of existingRecipe) {
    //         stringifiedExistingRecipe.push(JSON.stringify(action, null, 4))
    //     }

    //     const start = Date.now();
    //     const response = await this.baml.ClassifyCheckFailure(
    //         {
    //             screenshot: await screenshot.toBaml(),//Image.fromBase64('image/png', screenshot.image),
    //             actionHistory: stringifiedExistingRecipe,
    //             tabState: tabState
    //         },
    //         check
    //     );
    //     this.logger.trace(`classifyCheckFailure took ${Date.now()-start}ms`);
    //     //return response.check;

    //     if (response.classification === 'bug') {
    //         return {
    //             variant: 'bug',
    //             title: response.title,
    //             expectedResult: response.expectedResult,
    //             actualResult: response.actualResult,
    //             severity: response.severity
    //         }
    //     }
    //     else {
    //         return {
    //             variant: 'misalignment',
    //             message: response.message
    //         }
    //     }
    // }

    

    // async diagnoseTargetNotFound(
    //     screenshot: Screenshot,
    //     step: TestStepDefinition,
    //     target: string,
    //     existingRecipe: ActionIngredient[]
    // ): Promise<BugDetectedFailure | MisalignmentFailure> {
    //     const downscaledScreenshot = await this.transformScreenshot(screenshot);

    //     const stringifiedExistingRecipe = [];
    //     for (const action of existingRecipe) {
    //         stringifiedExistingRecipe.push(JSON.stringify(action, null, 4))
    //     }

    //     const start = Date.now();
    //     const response = await this.baml.DiagnoseTargetNotFound(
    //         Image.fromBase64('image/png', downscaledScreenshot.image),
    //         step,
    //         target,
    //         //action.target,
    //         //JSON.stringify(action, null, 4),//action,
    //         stringifiedExistingRecipe
    //     );
    //     this.logger.trace(`classifyStepActionFailure took ${Date.now()-start}ms`);

    //     if (response.classification === 'bug') {
    //         return {
    //             variant: 'bug',
    //             title: response.title,
    //             expectedResult: response.expectedResult,
    //             actualResult: response.actualResult,
    //             severity: response.severity
    //         }
    //     }
    //     else {
    //         return {
    //             variant: 'misalignment',
    //             message: response.message
    //         }
    //     }
    // }
}
