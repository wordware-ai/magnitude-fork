// Removed React import
import logger from '@/logger';
import { GroundingClient, LLMClient } from 'magnitude-core';
import { RegisteredTest, TestFunctionContext } from '@/discovery/types';
// Removed App import from '@/app'
// import { AllTestStates } from '@/term-app/types'; // Not directly used
//import { getUniqueTestId } from '@/term-app/util'; // Import util from term-app
import { Browser, BrowserContextOptions, chromium, LaunchOptions } from 'playwright';
import { describeModel, sendTelemetry } from '../util';
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
    planner?: LLMClient;
    executor?: GroundingClient;
    browserContextOptions: BrowserContextOptions;
    browserLaunchOptions: LaunchOptions;
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
        const browser = await chromium.launch({ 
            headless: false, // Consider making this configurable via this.config
            args: ['--disable-gpu'], 
            ...this.config.browserLaunchOptions 
        });

        const workerPool = new WorkerPool(this.config.workerCount);
        const testsToRun: RegisteredTest[] = this.tests;

        const taskFunctions = testsToRun.map((test) => {
            return async (signal: AbortSignal): Promise<TestResult> => {
                const runner = new TestRunner(test, {
                    browser: browser,
                    llm: this.config.planner,
                    grounding: this.config.executor,
                    browserContextOptions: this.config.browserContextOptions,
                });

                runner.events.on('stateChanged', (state) => {
                    this.config.renderer.onTestStateUpdated(test, state);
                });
                
                return await runner.run();
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
            await browser.close();
            process.exit(overallSuccess ? 0 : 1);
        }
    }

    // async runTestsOld(): Promise<void> {
    //     const browser = await chromium.launch({ headless: false, args: ['--disable-gpu'], ...this.config.browserLaunchOptions });
    //     const workerPool = new WorkerPool(this.config.workerCount);

    //     const allTestItems: { test: TestRunnable; testId: string; index: number }[] = [];
    //     let currentIndex = 0;
    //     for (const filepath of Object.keys(this.tests)) {
    //         const { ungrouped, groups } = this.tests[filepath];
    //         ungrouped.forEach(test => {
    //             allTestItems.push({ test, testId: getUniqueTestId(filepath, null, test.title), index: currentIndex++ });
    //         });
    //         Object.keys(groups).forEach(groupName => {
    //             groups[groupName].forEach(test => {
    //                 allTestItems.push({ test, testId: getUniqueTestId(filepath, groupName, test.title), index: currentIndex++ });
    //             });
    //         });
    //     }

    //     const taskFunctions = allTestItems.map(({ test, testId }) => {
    //         return async (signal: AbortSignal): Promise<boolean> => {
    //             try {
    //                 // const success = await this.runTest(browser, test, testId, signal);
    //                 // return success;
    //                 const runner = new TestRunner(browser, test);

    //             } catch (err: unknown) {
    //                 logger.error(`Unhandled error during task execution wrapper for ${testId}:`, err);
    //                 //this.updateStateAndRender(testId, { status: 'failed', failure: { variant: 'unknown', message: `${err instanceof Error ? err.message : String(err)}` } });
    //                 return false;
    //             }
    //         };
    //     });

    //     let poolResult: { completed: boolean; results: (boolean | undefined)[] } = {
    //          completed: false,
    //          results: [],
    //     };
    //     try {
    //         poolResult = await workerPool.runTasks<boolean>(taskFunctions, (result) => result === false);

    //         if (!poolResult.completed) {
    //             logger.info(poolResult.results, `Test run aborted early due to failure.`);
    //             poolResult.results.forEach((result, index) => {
    //                 if (result === undefined) {
    //                     const { testId } = allTestItems[index];
    //                     // if (this.testStates[testId]?.status !== 'failed') {
    //                     //      this.updateStateAndRender(testId, { status: 'cancelled' });
    //                     //      logger.debug(`Test ${testId} marked as cancelled post-run due to abort.`);
    //                     // }
    //                 }
    //             });
    //         }

    //     } catch (poolError: unknown) {
    //         logger.error(poolError, 'Unhandled error during worker pool execution:');
    //         poolResult = { completed: false, results: [] };
    //     } finally {
    //         await browser.close();
    //         // No need to restore cursor visibility here, term-app handles it
    //         // process.stdout.write('\x1B[?25h');
    //         //this.cleanupUI(); // Call the cleanup function
    //         process.exit(poolResult.completed ? 0 : 1);
    //     }
    // }
}
