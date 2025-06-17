// Removed React import
import logger from '@/logger';
import { BrowserOptions, GroundingClient, LLMClient } from 'magnitude-core';
import { RegisteredTest } from '@/discovery/types';
// Removed App import from '@/app'
// import { AllTestStates } from '@/term-app/types'; // Not directly used
//import { getUniqueTestId } from '@/term-app/util'; // Import util from term-app
import { Browser, BrowserContextOptions, chromium, LaunchOptions } from 'playwright';
import { describeModel } from '../util';
import { WorkerPool, WorkerPoolResult } from './workerPool';
import { startTestCaseAgent, TestCaseAgent } from '@/agent';
import { TestRunner } from './testRunner';
import { TestResult, TestFailure } from './state';
import { TestRenderer } from '@/renderer';

// Removed RerenderFunction type

// Define types for the term-app functions (can be refined if needed)
// type UpdateUIFunction = (tests: CategorizedTestCases, testStates: AllTestStates) => void;
// type CleanupUIFunction = () => void;


export interface TestSuiteRunnerConfig {
    workerCount: number;
    //prettyDisplay: boolean;
    renderer: TestRenderer;
    llm?: LLMClient;
    grounding?: GroundingClient;
    browserOptions?: BrowserOptions;
    // browserContextOptions: BrowserContextOptions;
    // browserLaunchOptions: LaunchOptions;
    telemetry: boolean;
}

// export const DEFAULT_CONFIG = {
//     workerCount: 1,
//     prettyDisplay: true,
//     browserContextOptions: {},
//     browserLaunchOptions: {},
//     telemetry: true,
//     downscalingRatio: 0.75,
// };

export class TestSuiteRunner {
    private config: TestSuiteRunnerConfig;
    private tests: RegisteredTest[];//CategorizedTestCases;
    // private testStates: AllTestStates;
    // private updateUI: UpdateUIFunction;
    // private cleanupUI: CleanupUIFunction;

    constructor(
        config: TestSuiteRunnerConfig,
        tests: RegisteredTest[],
        // testStates: AllTestStates,
        // updateUI: UpdateUIFunction,
        // cleanupUI: CleanupUIFunction,
    ) {
        this.config = config;
        //this.config = { ...DEFAULT_CONFIG, ...config };
        this.tests = tests;
        // this.testStates = testStates;
        // this.updateUI = updateUI;
        // this.cleanupUI = cleanupUI;
    }

    async runTests(): Promise<void> {
        // const browser = await chromium.launch({ 
        //     headless: false, // Consider making this configurable via this.config
        //     args: ['--disable-gpu'], 
        //     ...this.config.browserLaunchOptions 
        // });

        const workerPool = new WorkerPool(this.config.workerCount);
        const testsToRun: RegisteredTest[] = this.tests;

        const taskFunctions = testsToRun.map((test) => {
            return async (signal: AbortSignal): Promise<TestResult> => {
                const runner = new TestRunner(test, {
                    browserOptions: this.config.browserOptions,
                    //browser: browser,
                    llm: this.config.llm,
                    grounding: this.config.grounding,
                    //browserContextOptions: this.config.browserContextOptions,
                    telemetry: this.config.telemetry
                });

                runner.events.on('stateChanged', (state) => {
                    try {
                        this.config.renderer.onTestStateUpdated(test, state);
                    } catch (err: unknown) {
                        // shouldn't happen
                        if (err instanceof Error) {
                            logger.error(`Error updating test state:\n${err.message}`);
                        } else {
                            logger.error(`Error updating test state:\n${err}`);
                        }
                        throw err;
                    }
                });
                
                //return await runner.run();
                try {
                    return await runner.run();
                } catch (err: unknown) {
                    // user-facing, can happen e.g. when URL is not running
                    if (err instanceof Error) {
                        console.error(`Unexpected error during test '${test.title}':\n${err.message}`);
                    } else {
                        console.error(`Unexpected error during test '${test.title}':\n${err}`);
                    }
                    
                    throw err;
                }
            };
        });

        let overallSuccess = true;
        try {
            const poolResult: WorkerPoolResult<TestResult> = await workerPool.runTasks<TestResult>(
                taskFunctions,
                (taskOutcome: TestResult) => !taskOutcome.passed 
            );

            for (const result of poolResult.results) {
                if (result === undefined || !result.passed) {
                    overallSuccess = false;
                    break;
                }
            }
            if (!poolResult.completed) { // If pool aborted for any reason (incl. a task failure)
                overallSuccess = false;
            }

        } catch (error) {
            overallSuccess = false;
        } finally {
            //await browser.close();
            process.exit(overallSuccess ? 0 : 1);
        }
    }
}
