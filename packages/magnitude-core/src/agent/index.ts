// import { setLogLevel } from '@/ai/baml_client/config';
// setLogLevel('OFF');
import { Screenshot, WebAction, ClickWebAction, TypeWebAction, ScrollWebAction, SwitchTabWebAction } from "@/web/types";
import { ActionIntent, ClickIntent, TypeIntent, ScrollIntent, SwitchTabIntent, Action } from "@/actions/types";
import { MicroAgent } from "@/ai/micro";
import { MacroAgent } from "@/ai/macro";
import { Browser, BrowserContext, BrowserContextOptions, Page } from "playwright";
import { WebHarness } from "@/web/harness";
import { StepOptions } from "@/types";
import { AgentEvents } from "../common/events";
import logger from '../logger';

import { PlannerClient, ExecutorClient } from "@/ai/types";
import EventEmitter from "eventemitter3";
import { AgentError } from "./errors";
import { ActionDescriptor, convertOptionsToTestData, FailureDescriptor, retryOnError } from "../common";
import { TabState } from "@/web/tabs";
import { AgentMemory } from "./memory";
import { BrowserProvider } from "@/web/browserProvider";
import { ActionDefinition } from "@/actions";
import { webActions } from "@/actions/webActions";
import { ZodObject } from "zod";
import { AgentState } from "./state";
import { taskActions } from "@/actions/taskActions";
import { AgentFacet } from "@/facets";

export interface AgentOptions {
    // action set usable by the agent
    actions?: ActionDefinition<any>[],
    planner?: PlannerClient,
    executor?: ExecutorClient
    //browserContextOptions?: BrowserContextOptions,
    //signal?: AbortSignal
}

export interface StartAgentOptions {
    browser?: Browser
    url?: string
}

const DEFAULT_CONFIG = {
    actions: [...webActions, ...taskActions], // spread to create mutable copy
    planner: {
        provider: 'google-ai',
        options: {
            model: 'gemini-2.5-pro-preview-05-06',
            apiKey: process.env.GOOGLE_API_KEY
        }
    } as PlannerClient,
    executor: {
        provider: 'moondream',
        options: {
            apiKey: process.env.MOONDREAM_API_KEY
        }
    } as ExecutorClient,
    browserContextOptions: {}
}

export async function startAgent(
    options: AgentOptions & StartAgentOptions = {}
): Promise<Agent<[]>> {
    const agent = new Agent(options);
    await agent.start({ browser: options.browser, url: options.url });
    // await agent.start({
        
    // })
    return agent;
}


// type ExtractFacetOptions<T extends readonly any[]> = T extends readonly [infer First, ...infer Rest]
//   ? (First extends { options: infer O } ? O : {}) & ExtractFacetOptions<Rest>
//   : {}
// type FacetOptions<T extends readonly any[]> = T extends readonly [infer First, ...infer Rest]
//   ? (First extends { ['options']: infer O } ? O : {}) & FacetOptions<Rest>  
//   : {}
type FacetOptions<T extends readonly any[]> = T extends readonly [infer First, ...infer Rest]
  ? (First extends { ['options']: infer O } ? O : { FACET_OPTIONS_NOT_FOUND: true }) & FacetOptions<Rest>
  : {}
// // Extract and intersect all facet options (so you can pass any/all of them)
// type ExtractFacetOptions<T extends readonly any[]> = T extends readonly [infer First, ...infer Rest]
//   ? (First extends AgentFacet<any, infer O> ? O : {}) & ExtractFacetOptions<Rest>
//   : {}

// // For union (pick one set of options)
// type UnionFacetOptions<T extends readonly any[]> = T extends readonly [infer First, ...infer Rest]
//   ? (First extends AgentFacet<any, infer O> ? O : never) | UnionFacetOptions<Rest>
//   : never

export class Agent<T extends readonly AgentFacet<any, any>[]> {
    private config: Required<AgentOptions>;
    //private abortSignal?: AbortSignal;
    public readonly macro: MacroAgent;
    public readonly micro: MicroAgent;
    public harness!: WebHarness;
    private context!: BrowserContext;
    public readonly events: EventEmitter<AgentEvents>;
    public readonly memory: AgentMemory;
    private doneActing: boolean;

    constructor (config: Partial<AgentOptions> & Required<FacetOptions<T>>)  {
        this.config = { ...DEFAULT_CONFIG, ...config };
        //this.abortSignal = config.signal;
        this.macro = new MacroAgent({ client: this.config.planner });
        this.micro = new MicroAgent({ client: this.config.executor });
        //this.info = { actionCount: 0 };
        this.events = new EventEmitter<AgentEvents>();
        // mem should replace these ^ but even more robust + customizable
        this.memory = new AgentMemory();//this.events
        this.doneActing = false;
    }

    get page(): Page {
        return this.harness.page;
    }

    // get context(): BrowserContext {
    //     return this.context;
    // }
    async start({ browser, url }: StartAgentOptions = {}): Promise<void> {
        if (!browser) {
            // If no browser is provided, use the singleton browser provider
            browser = await BrowserProvider.getBrowser();
        }

        logger.info("Creating browser context");
        const dpr = process.env.DEVICE_PIXEL_RATIO ?
            parseInt(process.env.DEVICE_PIXEL_RATIO) :
            process.platform === 'darwin' ? 2 : 1;
        this.context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: dpr,
            ...this.config.browserContextOptions
        });

        //const page = await this.context.newPage();
        this.harness = new WebHarness(this.context);
        await this.harness.start();

        this.events.emit('start');
        logger.info("Agent started");

        if (url) {
            // If starting URL is provided, immediately navigate to it
            await this.nav(url);
        }

        this.memory.inscribeInitialState(
            await this.captureState()
        );
    }

    async captureState(): Promise<AgentState> {
        const screenshot = await this.harness.screenshot();
        const tabState = await this.harness.retrieveTabState();
        return {
            screenshot: screenshot,
            tabs: tabState
        };
    }

    // private fail(failure: FailureDescriptor): never {
    //     this.events.emit('fail', failure);
    //     throw new AgentError(failure);
    // }

    async nav(url: string): Promise<void> {
        logger.info(`Navigating to ${url}`);
        //this.events.emit('action', { 'variant': 'load', 'url': url });
        await this.harness.goto(url);
        await this.harness.waitForStability();
    }

    async exec(action: Action): Promise<void> {
        // based on variant, delegate to appropriate action resolver from available action definitions, or raise error if in current action vocab
        let actionDefinition: ActionDefinition<any> | null = null;
        for (const def of this.config.actions) {
            if (action.variant === def.name) {
                actionDefinition = def;
            }
        }
        if (!actionDefinition) {
            // Either LLM hallucinating or actions are cached that don't have the appropriate definitions registered on the executing agent
            // FatalError
            throw new AgentError(`Undefined action type '${action.variant}', either LLM is hallucinating or check that agent is configured with the appropriate action definitions`);
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
                    this.memory.buildContext(),//tabState),
                    description,//{ description: description, checks: [], testData: testData },
                    //this.lastStepActions,
                    //tabState,
                    this.config.actions
                ));
            } catch (error: unknown) {
                logger.error(`Error creating partial recipe: ${error}`);
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
        //this.abortSignal?.throwIfAborted()
        if (this.context) {
            try {
                await this.context.close();
            } catch (error) {
                 logger.warn(`Error closing browser context (might be expected if cancelled): ${error}`);
            }
        }
    }
}
