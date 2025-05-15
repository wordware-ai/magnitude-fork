import { Screenshot } from "@/web/types";
import { convertToBamlClientOptions } from "./util";
import { b } from "@/ai/baml_client";
import { Image, Collector, ClientRegistry } from "@boundaryml/baml";
import { ActionIntent, Intent } from "@/actions/types";
import { TestStepDefinition } from "@/types";
import { BamlAsyncClient } from "./baml_client/async_client";
import logger from "@/logger";
import { Logger } from 'pino';
import { BugDetectedFailure, MisalignmentFailure } from "@/common";
import { PlannerClient } from "@/ai/types";
import { TabState } from "@/web/tabs";
import { ActionDefinition } from "@/actions";
import TypeBuilder from "./baml_client/type_builder";
import { z } from 'zod';

interface MacroAgentConfig {
    client: PlannerClient;
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

    constructor(config: { client: PlannerClient } & Partial<MacroAgentConfig>) {
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
        screenshot: Screenshot,
        task: string,
        //testStep: TestStepDefinition,
        existingRecipe: ActionIntent[],
        tabState: TabState,
        actionVocabulary: ActionDefinition<T>[]
    ): Promise<{ actions: z.infer<ActionDefinition<T>['schema']>[], finished: boolean }> {
        const stringifiedExistingRecipe = [];
        for (const action of existingRecipe) {
            stringifiedExistingRecipe.push(JSON.stringify(action, null, 4))
        }

        const tb = new TypeBuilder();

        //tb.addClass()
        //const actionType = tb.union([])
        const clickAction = tb.addClass('ClickAction')
        clickAction.addProperty('variant', tb.string()).description('Click something');
        clickAction.addProperty('target', tb.string()).description('Where exactly to click');

        // TODO: Implement the actual zod -> baml tb converter and convert action vocab

        // in reality put a tb.union of derived types in here
        const actionsType = tb.list(clickAction.type());
        tb.PartialRecipe.addProperty('actions', actionsType);

        //console.log("existing:", stringifiedExistingRecipe);
        const start = Date.now();
        const response = await this.baml.CreatePartialRecipe(
            {
                screenshot: Image.fromBase64('image/png', screenshot.image),
                actionHistory: stringifiedExistingRecipe,
                tabState: tabState
            },
            // todo: replace param completely
            //testStep.description,
            task,
            { tb }
        );
        this.logger.trace(`createPartialRecipe took ${Date.now()-start}ms`);
        // BAML does not carry over action type to @@dynamic of PartialRecipe, so forced cast necssary
        return response as unknown as { actions: z.infer<ActionDefinition<T>['schema']>[], finished: boolean };
    }

    async evaluateCheck(screenshot: Screenshot, check: string, existingRecipe: ActionIntent[], tabState: TabState): Promise<boolean> {
        const stringifiedExistingRecipe = [];
        for (const action of existingRecipe) {
            stringifiedExistingRecipe.push(JSON.stringify(action, null, 4))
        }

        const start = Date.now();
        const response = await this.baml.EvaluateCheck(
            {
                screenshot: Image.fromBase64('image/png', screenshot.image),
                actionHistory: stringifiedExistingRecipe,
                tabState: tabState
            },
            check
        );
        this.logger.trace(`evaluateCheck took ${Date.now()-start}ms`);
        return response.passes;
    }

    async classifyCheckFailure(screenshot: Screenshot, check: string, existingRecipe: ActionIntent[], tabState: TabState): Promise<BugDetectedFailure | MisalignmentFailure> {
        const stringifiedExistingRecipe = [];
        for (const action of existingRecipe) {
            stringifiedExistingRecipe.push(JSON.stringify(action, null, 4))
        }

        const start = Date.now();
        const response = await this.baml.ClassifyCheckFailure(
            {
                screenshot: Image.fromBase64('image/png', screenshot.image),
                actionHistory: stringifiedExistingRecipe,
                tabState: tabState
            },
            check
        );
        this.logger.trace(`classifyCheckFailure took ${Date.now()-start}ms`);
        //return response.check;

        if (response.classification === 'bug') {
            return {
                variant: 'bug',
                title: response.title,
                expectedResult: response.expectedResult,
                actualResult: response.actualResult,
                severity: response.severity
            }
        }
        else {
            return {
                variant: 'misalignment',
                message: response.message
            }
        }
    }

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