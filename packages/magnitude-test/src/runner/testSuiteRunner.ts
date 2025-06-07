// Removed React import
import logger from '@/logger';
import { AgentError, GroundingClient, LLMClient } from 'magnitude-core';
import { RegisteredTest, TestFunctionContext } from '@/discovery/types';
// Removed App import from '@/app'
import { AllTestStates } from '@/term-app/types'; // Import types from term-app
//import { getUniqueTestId } from '@/term-app/util'; // Import util from term-app
import { Browser, BrowserContext, BrowserContextOptions, chromium, LaunchOptions, Page } from 'playwright';
import { describeModel, sendTelemetry } from '../util';
import { WorkerPool } from './workerPool';
import { startTestCaseAgent, TestCaseAgent } from '@/agent';
import { TestRunner } from './testRunner';
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
        const browser = await chromium.launch({ headless: false, args: ['--disable-gpu'], ...this.config.browserLaunchOptions });

        const tests = this.tests;

        // const runners: { id: string, runner: TestRunner } = this.tests.map(test => ({
        //     id: test.id,
        //     runner: new TestRunner(browser, test)
        // }));

        const runners: { id: string, runner: TestRunner }[] = [];

        //let anyTestFailed = false;

        for (const test of tests) {
            const runner = new TestRunner(test, {
                browser: browser,
                llm: this.config.planner,
                grounding: this.config.executor,
                browserContextOptions: this.config.browserContextOptions
            });


            runner.events.on('stateChanged', (state) => this.config.renderer.onTestStateUpdated(test, state));

            const result = await runner.run();
            if (!result.passed) {
                console.error(result.failure.message);
                process.exit(1);
            }
        }

        await browser.close();
        //return !anyTestFailed;
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
