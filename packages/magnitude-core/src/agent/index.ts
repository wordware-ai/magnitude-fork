// import { setLogLevel } from '@/ai/baml_client/config';
// setLogLevel('OFF');
// Screenshot, WebAction etc. might be used by AgentState or specific actions, keep for now.
import { Screenshot, WebAction, ClickWebAction, TypeWebAction, ScrollWebAction, SwitchTabWebAction } from "@/web/types";
import { ActionIntent, ClickIntent, TypeIntent, ScrollIntent, SwitchTabIntent, Action } from "@/actions/types";
import { MicroAgent } from "@/ai/micro";
import { MacroAgent } from "@/ai/macro";
// Browser, BrowserContext, BrowserContextOptions are now facet concerns primarily. Page is needed for getter.
import { Page } from "playwright"; 
// WebHarness might be part of AgentState type, or accessed via facet.
import { WebHarness } from "@/web/harness"; 
import { StepOptions } from "@/types";
import { AgentEvents } from "../common/events";
import { WebInteractionFacet, WebInteractionFacetOptions } from '../facets/webFacet'; // Import WebInteractionFacet
import logger from '../logger';

import { PlannerClient, ExecutorClient } from "@/ai/types";
import EventEmitter from "eventemitter3";
import { AgentError } from "./errors";
import { ActionDescriptor, convertOptionsToTestData, FailureDescriptor, retryOnError } from "../common";
import { TabState } from "@/web/tabs";
import { AgentMemory } from "./memory";
// BrowserProvider no longer directly used by Agent
import { ActionDefinition } from "@/actions";
// webActions will come from WebInteractionFacet
import { ZodObject } from "zod";
import { AgentState } from "./state"; // AgentState might refer to WebHarness or Screenshot
import { taskActions } from "@/actions/taskActions"; // Keep taskActions for default
import { AgentFacet } from "@/facets";

export interface AgentOptions {
    actions?: ActionDefinition<any>[]; // Base actions
    planner?: PlannerClient;
    executor?: ExecutorClient;
    // signal?: AbortSignal; // If needed
}

// Options for the startAgent helper function
export interface StartAgentWithWebOptions {
    agentBaseOptions?: Partial<AgentOptions>;
    webOptions?: WebInteractionFacetOptions; // Options for the WebInteractionFacet
}

const DEFAULT_CONFIG: Required<Omit<AgentOptions, 'actions'> & { actions: ActionDefinition<any>[] }> = {
    actions: [...taskActions], // Default to only taskActions; webActions come from facet
    planner: {
        provider: 'google-ai',
        options: {
            model: 'gemini-2.5-pro-preview-05-06',
            apiKey: process.env.GOOGLE_API_KEY || "YOUR_GOOGLE_API_KEY"
        }
    } as PlannerClient,
    executor: {
        provider: 'moondream',
        options: {
            apiKey: process.env.MOONDREAM_API_KEY || "YOUR_MOONDREAM_API_KEY"
        }
    } as ExecutorClient,
};

// Helper function to start an agent, typically with WebInteractionFacet
export async function startAgent(
    options: StartAgentWithWebOptions = {}
): Promise<Agent> {
    const agentConfig = options.agentBaseOptions || {};
    const facets: AgentFacet<any, any, any>[] = [];

    // Add WebInteractionFacet, using provided options or defaults
    facets.push(new WebInteractionFacet(options.webOptions || {}));

    const agent = new Agent(agentConfig, facets);
    await agent.start();
    return agent;
}

// FacetOptions<T> is no longer needed here

export class Agent { // No longer generic <T>
    private config: Required<AgentOptions>;
    private facets: AgentFacet<any, any, any>[];
    // abortSignal?: AbortSignal; // If needed

    public readonly macro: MacroAgent;
    public readonly micro: MicroAgent;
    public readonly events: EventEmitter<AgentEvents>;
    public readonly memory: AgentMemory;
    private doneActing: boolean;

    constructor(baseConfig: Partial<AgentOptions> = {}, facets: AgentFacet<any, any, any>[] = []) {
        // Initialize config with defaults, then override with baseConfig
        this.config = {
            ...DEFAULT_CONFIG,
            ...baseConfig,
            actions: [...(baseConfig.actions || DEFAULT_CONFIG.actions)], // Ensure actions is an array
        } as Required<AgentOptions>; // Cast because baseConfig is partial

        this.facets = facets;

        // Aggregate actions from facets
        const aggregatedActions = [...this.config.actions];
        for (const facet of this.facets) {
            aggregatedActions.push(...facet.getActionSpace());
        }
        // Deduplicate actions by name
        this.config.actions = Array.from(new Map(aggregatedActions.map(action => [action.name, action])).values());
        
        // Initialize other components
        this.macro = new MacroAgent({ client: this.config.planner });
        this.micro = new MicroAgent({ client: this.config.executor });
        this.events = new EventEmitter<AgentEvents>();
        this.memory = new AgentMemory(); // For now, memory is not facet-driven
        this.doneActing = false;
        // if (baseConfig.signal) this.abortSignal = baseConfig.signal;
    }

    public getFacet<F extends AgentFacet<any, any, any>>(
        facetClass: new (...args: any[]) => F
    ): F | undefined {
        return this.facets.find(f => f instanceof facetClass) as F | undefined;
    }

    get page(): Page {
        const webFacet = this.getFacet(WebInteractionFacet);
        // Explicitly check if webFacet is an instance of WebInteractionFacet before accessing .page
        if (webFacet instanceof WebInteractionFacet) {
            return webFacet.page; // webFacet is now definitely WebInteractionFacet
        }
        throw new AgentError("WebInteractionFacet not available or page not initialized.");
    }

    async start(): Promise<void> { // No longer takes browser/url options
        logger.info("Agent: Starting...");
        for (const facet of this.facets) {
            await facet.onStart(); // Each facet initializes itself
        }
        this.events.emit('start');
        logger.info("Agent: All facets started.");

        // Initial state capture after facets are started
        // This assumes that if a state needs to be captured (e.g., web page),
        // the relevant facet (WebInteractionFacet) is ready.
        try {
            const initialState = await this.captureState();
            this.memory.inscribeInitialState(initialState);
        } catch (error) {
            logger.warn(`Agent: Could not capture initial state. ${error instanceof Error ? error.message : String(error)}`);
            // Depending on requirements, this might be a critical error or ignorable.
        }
        logger.info("Agent: Started successfully.");
    }

    async captureState(): Promise<AgentState> {
        const webFacet = this.getFacet(WebInteractionFacet);
        if (!webFacet) {
            logger.warn("Agent: WebInteractionFacet not found for captureState. Returning empty state.");
            // Return a minimal state if no web facet, or throw if web state is essential
            return { 
                screenshot: { image: '', dimensions: { width: 0, height: 0 } }, 
                tabs: { activeTab: -1, tabs: [] } 
            };
        }
        const harness = webFacet.getState().harness;
        if (!harness) {
            throw new AgentError("WebInteractionFacet's harness not available for capturing state.");
        }
        const screenshot = await harness.screenshot();
        const tabState = await harness.retrieveTabState();
        return {
            screenshot: screenshot,
            tabs: tabState
        };
    }

    // nav(url: string) method removed, use webFacet.nav(url) via getFacet

    async exec(action: Action): Promise<void> {
        let actionDefinition = this.config.actions.find(def => def.name === action.variant);

        if (!actionDefinition) {
            throw new AgentError(`Undefined action type '${action.variant}'. Ensure agent is configured with appropriate action definitions from facets.`);
        }
        
        let input: any;
        // If primitive, extract the input field of the action as the input payload
        // If object, strip the variant param and send rest
        if (actionDefinition.schema instanceof ZodObject) {
            let variant: string;
            ({ variant, ...input } = action);
        } else {
            input = action.input;
        }

        let parsed = actionDefinition.schema.safeParse(input);

        if (!parsed.success) {
            // TODO: provide options for LLM to correct these
            throw new AgentError(`Generated action violates action definition input schema: ${parsed.error.message}`, { adaptable: true });
        }
        // TODO: should prob try/except this and wrap any errors as AgentError if not already AgentError, setting reasonable default reactive configuration
        // e.g. flags for whether to try and adapt to the type of error
        await actionDefinition.resolver(
            { input: parsed.data, agent: this }
        );

        const newState = await this.captureState();
        this.memory.inscribeObservation(action, newState);
    }

    async act(description: string, options: StepOptions = {}): Promise<void> {
        this.doneActing = false;
        logger.info(`Begin Step: ${description}`);

        const testData = convertOptionsToTestData(options);

        this.events.emit('stepStart', description);

        while (true) {
            //const screenshot = await this.screenshot();
            // RangeError: Maximum call stack size exceeded.
            //const tabState: TabState = await this.harness.retrieveTabState();
            //const tabState: TabState = { activeTab: 0, tabs: [{url: 'foo', title: 'foo', page: null as unknown as Page}] };

            logger.info(`Creating partial recipe`);

            // hard to fully type - would need clever Agent generic types that derive from action definitions
            let reasoning: string;
            let actions: Action[];
            //let finished: boolean;
            try {
                ({ reasoning, actions } = await this.macro.createPartialRecipe(
                    //this.memory.getLastScreenshot(),
                    //screenshot,
                    this.memory.buildContext(), // Memory context
                    description,
                    this.config.actions // Pass the agent's current full action space
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

            this.memory.inscribeThought(reasoning);

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
        //this.abortSignal?.throwIfAborted(); // If using abort signals
        logger.info("Agent: Stopping...");
        for (const facet of this.facets) {
            try {
                await facet.onStop();
            } catch (error) {
                logger.warn(`Agent: Error stopping facet ${facet.constructor.name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        logger.info("Agent: All facets stopped.");
        // Perform any other agent-level cleanup here
        logger.info("Agent: Stopped successfully.");
    }
}
