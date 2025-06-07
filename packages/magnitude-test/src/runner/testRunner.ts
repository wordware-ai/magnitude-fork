import { RegisteredTest, TestFunctionContext } from "@/discovery/types";
import { Browser, BrowserContext, BrowserContextOptions, Page } from "playwright";
import EventEmitter from "eventemitter3";
import { startTestCaseAgent, TestCaseAgent } from "@/agent";
import { Action, buildDefaultBrowserAgentOptions, GroundingClient, LLMClient } from "magnitude-core";
import { TestState, TestResult, TestStateTracker, TestFailure } from "./state";



// export interface TestState {
    
//     failure?: TestFailure
// }

// prob just track some state in test runner and emit it
// for proc iso / ICP we can find a way to send these over stdio pipes
export interface TestRunnerEvents {
    'stateChanged': (state: TestState) => {}
    // 'pass': () => {}
    // 'fail': () => {}
}



export interface TestRunnerOptions {
    browser: Browser,
    llm?: LLMClient,
    grounding?: GroundingClient
    browserContextOptions?: BrowserContextOptions
}

export class TestRunner {
    /**
     * Responsible for running one test case using a browser agent.
     * Rendering-agnostic
     */

    public readonly events: EventEmitter<TestRunnerEvents>;
    //private browser: Browser;
    private test: RegisteredTest;
    private options: TestRunnerOptions;

    // constructor(browser: Browser, test: RegisteredTest) {
    //     this.browser = browser;
    //     this.test = test;
    //     this.events = new EventEmitter();
    // }
    constructor(test: RegisteredTest, options: TestRunnerOptions) {
        //this.browser = browser;
        this.test = test;
        this.options = options;
        this.events = new EventEmitter();
    }
    

    // Should not throw, return some val repr pass or fail
    async run(): Promise<TestResult> {
        // const agent = await startTestCaseAgent({
        //     url: this.test.url,
        //     browser: this.options.browser,
        //     llm: this.options.llm,
        //     grounding: this.options.grounding,
        //     browserContextOptions: this.options.browserContextOptions
        // });
        const { agentOptions, browserOptions } = buildDefaultBrowserAgentOptions({
            agentOptions: {
                llm: this.options.llm
            },
            browserOptions: {
                url: this.test.url,
                browser: this.options.browser,
                grounding: this.options.grounding,
                browserContextOptions: this.options.browserContextOptions
            }
        });

        const agent = new TestCaseAgent({
            agentOptions: agentOptions,
            browserOptions: browserOptions,
        });
        const tracker = new TestStateTracker(agent);
        // forward test state changed event
        tracker.events.on('stateChanged', (state) => this.events.emit('stateChanged', state), this);
        await agent.start();

        const context: TestFunctionContext = {
            ai: agent,//new Magnus(agent),
            get page(): Page {
                return agent.page;
            },
            get context(): BrowserContext {
                return agent.context;
            }
        }

        try {
            await this.test.fn(context);
        } catch (err: unknown) {
            let failure: TestFailure;
            if (err instanceof Error) {
                failure = { message: err.message };
            } else {
                failure = { message: String(err) }; // Ensure string conversion
            }
            // Get the current state, add failure, and set status to 'failed'
            const finalStateFailed = { 
                ...tracker.getState(), 
                failure: failure, 
                status: 'failed' as const, // Explicitly set status
                doneAt: Date.now() // Mark done time on failure too
            };
            this.events.emit('stateChanged', finalStateFailed);
            
            // Clean up agent even on failure
            try {
                await agent.stop();
            } catch (stopErr) {
                // Log agent stop error, but primary failure is more important
                console.error("Error stopping agent after test failure:", stopErr);
            }

            return {
                passed: false,
                failure: failure
            };
        }

        // If no error, test passed
        await agent.stop();
        
        // Get the current state and set status to 'passed'
        const finalStatePassed = { 
            ...tracker.getState(), 
            status: 'passed' as const, // Explicitly set status
            doneAt: Date.now() // Mark done time
        };
        this.events.emit('stateChanged', finalStatePassed);

        return { passed: true };
    }
}
