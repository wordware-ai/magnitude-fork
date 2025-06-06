import { RegisteredTest, TestFunctionContext } from "@/discovery/types";
import { Browser, BrowserContext, BrowserContextOptions, Page } from "playwright";
import EventEmitter from "eventemitter3";
import { startTestCaseAgent } from "@/agent";
import { GroundingClient, LLMClient } from "magnitude-core";


// prob just track some state in test runner and emit it
// for proc iso / ICP we can find a way to send these over stdio pipes
export interface TestRunnerEvents {
    'stateChanged': () => {}
    'pass': () => {}
    'fail': () => {}
}

export type TestResult = {
    passed: true
} | {
    passed: false
    failure: TestFailure
}

export interface TestFailure {
    message: string
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
        const agent = await startTestCaseAgent({
            url: this.test.url,
            browser: this.options.browser,
            llm: this.options.llm,
            grounding: this.options.grounding,
            browserContextOptions: this.options.browserContextOptions
        });

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
            if (err instanceof Error) {
                return {
                    passed: false,
                    failure: { message: err.message }
                }
            } else {
                return {
                    passed: false,
                    failure: { message: `Error: ${err}` }
                }
            }
        }

        await agent.stop();

        return { passed: true };
    }
}