import { Screenshot, WebAction, ClickWebAction, TypeWebAction, ScrollWebAction, SwitchTabWebAction } from "@/web/types";
import { ActionIntent, ClickIntent, TypeIntent, ScrollIntent, SwitchTabIntent, Action } from "@/actions/types";
import { GroundingService } from "@/ai/grounding";
import { MacroAgent } from "@/ai/macro";
import { Page } from "playwright"; 
import { WebHarness } from "@/web/harness"; 
import { StepOptions } from "@/types";
import { AgentEvents } from "../common/events";
import logger from '../logger';
import { AgentConnector } from '@/connectors';
import { WebInteractionConnector, WebInteractionConnectorOptions } from '@/connectors/webConnector';
import { Observation } from '@/memory/observation';

import { LLMClient, GroundingClient } from "@/ai/types";
import EventEmitter from "eventemitter3";
import { AgentError } from "./errors";
import { ActionDescriptor, convertOptionsToTestData, FailureDescriptor, retryOnError } from "../common";
import { AgentMemory } from "../memory";
import { ActionDefinition } from "@/actions";
import { ZodObject } from "zod";
import { taskActions } from "@/actions/taskActions";

export interface AgentOptions {
    actions?: ActionDefinition<any>[]; // Base actions; connector-provided actions are added separately.
    planner?: LLMClient;
    executor?: GroundingClient;
}

// Options for the startAgent helper function
export interface StartAgentWithWebOptions {
    agentBaseOptions?: Partial<AgentOptions>;
    webConnectorOptions?: WebInteractionConnectorOptions; // Options for WebInteractionConnector
}

const DEFAULT_CONFIG: Required<Omit<AgentOptions, 'actions'> & { actions: ActionDefinition<any>[] }> = {
    actions: [...taskActions], // Default to taskActions; other actions come from connectors
    planner: {
        provider: 'google-ai',
        options: {
            model: 'gemini-2.5-pro-preview-05-06',
            apiKey: process.env.GOOGLE_API_KEY || "YOUR_GOOGLE_API_KEY"
        }
    } as LLMClient,
    executor: {
        provider: 'moondream',
        options: {
            apiKey: process.env.MOONDREAM_API_KEY || "YOUR_MOONDREAM_API_KEY"
        }
    } as GroundingClient,
};

// Helper function to start an agent, typically with WebInteractionFacet
export async function startAgent(
    options: StartAgentWithWebOptions = {}
): Promise<Agent> {
    const agentConfig = options.agentBaseOptions || {};
    const connectors: AgentConnector[] = [];

    // Add WebInteractionConnector if options are provided or by default
    connectors.push(new WebInteractionConnector(options.webConnectorOptions || {}));
    
    // TODO: Add other default connectors here if any (e.g., FileSystemConnector)

    const agent = new Agent(agentConfig, connectors);
    await agent.start();
    return agent;
}

export class Agent {
    private config: Required<AgentOptions>;
    private connectors: AgentConnector[];

    public readonly macro: MacroAgent;
    public readonly micro: GroundingService;
    public readonly events: EventEmitter<AgentEvents>;
    public readonly memory: AgentMemory;
    private doneActing: boolean;

    constructor(baseConfig: Partial<AgentOptions> = {}, connectors: AgentConnector[] = []) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...baseConfig,
            actions: [...(baseConfig.actions || DEFAULT_CONFIG.actions)], 
        } as Required<AgentOptions>;

        this.connectors = connectors;

        // Aggregate actions from connectors
        const aggregatedActions = [...this.config.actions];
        for (const connector of this.connectors) {
            aggregatedActions.push(...(connector.getActionSpace ? connector.getActionSpace() : []));
        }
        // Deduplicate actions by name
        // TODO: maybe error instead, or automatically differentiate them?
        this.config.actions = Array.from(new Map(aggregatedActions.map(actDef => [actDef.name, actDef])).values());
        
        this.macro = new MacroAgent({ client: this.config.planner });
        this.micro = new GroundingService({ client: this.config.executor });
        this.events = new EventEmitter<AgentEvents>();
        this.memory = new AgentMemory();
        this.doneActing = false;
    }

    public getConnector<C extends AgentConnector>(
        connectorClass: new (...args: any[]) => C
    ): C | undefined {
        return this.connectors.find(c => c instanceof connectorClass) as C | undefined;
    }

    public require<C extends AgentConnector>(
        connectorClass: new (...args: any[]) => C
    ): C {
        const connector = this.getConnector(connectorClass);
        if (!connector) throw new Error(`Missing required connector ${connectorClass}`);
        return connector;
    }

    // Access to page now goes through WebInteractionConnector
    // TODO: Move to a WebAgent subclass
    get page(): Page {
        return this.require(WebInteractionConnector).page;
    }

    async start(): Promise<void> { 
        logger.info("Agent: Starting connectors...");
        for (const connector of this.connectors) {
            if (connector.onStart) await connector.onStart(); 
        }
        this.events.emit('start');
        logger.info("Agent: All connectors started.");
        // Initial observations are handled by the first getObservations call in exec
    }

    // captureState is removed as state is now captured by connectors and surfaced via observations/renderCurrentStateToBaml

    async exec(action: Action): Promise<void> {
        let actionDefinition = this.config.actions.find(def => def.name === action.variant);

        if (!actionDefinition) {
            // It's possible the action name was from a connector that is no longer active,
            // or the action space was not correctly aggregated.
            throw new AgentError(`Undefined action type '${action.variant}'. Ensure agent is configured with appropriate action definitions from connectors.`);
        }
        
        let input: any;
        if (actionDefinition.schema instanceof ZodObject) {
            let variant: string;
            ({ variant, ...input } = action);
        } else {
            input = (action as any).input; 
        }

        let parsed = actionDefinition.schema.safeParse(input);

        if (!parsed.success) {
            throw new AgentError(`Generated action '${action.variant}' violates input schema: ${parsed.error.message}`, { adaptable: true });
        }
        
        const data = await actionDefinition.resolver(
            { input: parsed.data, agent: this }
        );

        let observations: Observation[] = [];

        // See if any observations from action return value need to be added to turn observations
        if (data) {
            observations.push({
                source: `action:${actionDefinition.name}`,
                timestamp: Date.now(),
                data: data
            });
        }

        for (const connector of this.connectors) {
            try {
                const connObservations = connector.collectObservations ? await connector.collectObservations() : [];
                observations.push(...connObservations);
            } catch (error) {
                logger.warn(`Agent: Error getting observations from connector ${connector.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        this.memory.recordTurn(action, observations);
    }

    async act(description: string, options: StepOptions = {}): Promise<void> {
        this.doneActing = false;
        logger.info(`Begin Step: ${description}`);

        const testData = convertOptionsToTestData(options);

        this.events.emit('stepStart', description);

        while (true) {
            // Removed direct screenshot/tabState access here; it's part of memoryContext via connectors
            logger.info(`Creating partial recipe`);

            let reasoning: string;
            let actions: Action[];
            try {
                const memoryContext = await this.memory.buildContext(this.connectors);
                ({ reasoning, actions } = await this.macro.createPartialRecipe(
                    memoryContext, 
                    description,
                    this.config.actions 
                ));
            } catch (error: unknown) {
                logger.error(`Agent: Error creating partial recipe: ${error instanceof Error ? error.message : String(error)}`);
                /**
                 * (1) Failure to conform to JSON
                 * (2) Misconfigured BAML client / bad API key
                 * (3) Network error (past max retries)
                 */
                // this.fail({
                //     variant: 'misalignment',
                //     message: `Could not create partial recipe -> ${(error as Error).message}`
                // });
                throw new AgentError(
                    `Could not create partial recipe -> ${(error as Error).message}`, { variant: 'misalignment' }
                )
            }

            logger.info({ reasoning, actions }, `Partial recipe created`);

            this.memory.recordThought(reasoning);

            // Execute partial recipe
            for (const action of actions) {
                await this.exec(action);

                // const postActionScreenshot = await this.screenshot();
                // const actionDescriptor: ActionDescriptor = { ...action, screenshot: postActionScreenshot.image } as ActionDescriptor;
                // this.events.emit('action', actionDescriptor);
                logger.info({ action }, `Action taken`);
            }

            // If macro expects these actions should complete the step, break
            // if (finished) {
            //     break;
            // }
            if (this.doneActing) {
                break;
            }
        }

        logger.info(`Done with step`);
        this.events.emit('stepSuccess');
    }

    async queueDone() {
        this.doneActing = true;
    }

    async stop() {
        /**
         * Stop the agent and close the browser context.
         * May be called asynchronously and interrupt an agent in the middle of a action sequence.
         */
        // set signal to cancelled?
        logger.info("Agent: Stopping connectors...");
        for (const connector of this.connectors) {
            try {
                if (connector.onStop) await connector.onStop();
            } catch (error) {
                logger.warn(`Agent: Error stopping connector ${connector.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        logger.info("Agent: All connectors stopped.");
        logger.info("Agent: Stopped successfully.");
    }
}
