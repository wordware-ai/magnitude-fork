import { TestRenderer } from "@/renderer";
import { RegisteredTest, MagnitudeConfig } from "@/discovery/types";
import { TestState } from "@/runner/state";
import { AllTestStates } from "./types"; // Import AllTestStates directly
import * as uiState from './uiState';
import { scheduleRedraw, redraw } from './uiRenderer';
// Import other necessary types and functions from term-app/index, term-app/util etc. as needed
// For now, let's assume logUpdate might be used directly or indirectly
import logUpdate from 'log-update';
import { MAX_APP_WIDTH } from "./constants";

// Functions that might be moved or adapted from term-app/index.ts
// For now, keep them here or ensure they are imported if they remain in index.ts
// and are exported.
// We'll need to handle SIGINT and resize eventually.

export class TermAppRenderer implements TestRenderer {
    private magnitudeConfig: MagnitudeConfig;
    private initialTests: RegisteredTest[];
    private modelName: string;

    // To manage resize and SIGINT listeners
    private resizeListener: (() => void) | null = null;
    private sigintListener: (() => void) | null = null;

    constructor(config: MagnitudeConfig, initialTests: RegisteredTest[], modelName: string) {
        this.magnitudeConfig = config;
        this.initialTests = [...initialTests]; // Store a copy
        this.modelName = modelName;

        // Initial setup based on config, if needed immediately
        if (this.magnitudeConfig.display?.showActions !== undefined) {
            uiState.setRenderSettings({ showActions: this.magnitudeConfig.display.showActions });
        }
        uiState.setCurrentModel(this.modelName);
        // uiState.setAllRegisteredTests will be called in start() after resetState()
    }

    public start(): void {
        uiState.resetState(); // Reset all UI state

        // Re-apply initial settings after reset
        if (this.magnitudeConfig.display?.showActions !== undefined) {
            uiState.setRenderSettings({ showActions: this.magnitudeConfig.display.showActions });
        }
        uiState.setCurrentModel(this.modelName);
        uiState.setAllRegisteredTests(this.initialTests); // Set the tests

        // Initialize currentTestStates for all tests to 'pending'
        const initialTestStates: AllTestStates = {}; // Use direct import
        for (const test of this.initialTests) {
            initialTestStates[test.id] = {
                status: 'pending', // Add initial status
                stepsAndChecks: [],
                macroUsage: { provider: '', model: '', inputTokens: 0, outputTokens: 0, numCalls: 0 },
                microUsage: { provider: '', numCalls: 0 },
            };
        }
        uiState.setCurrentTestStates(initialTestStates);
        uiState.setElapsedTimes({}); // Clear elapsed times

        // Ensure the cursor is on a new line and clear screen (from original initializeUI)
        process.stdout.write('\n');
        logUpdate.clear();
        process.stdout.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to home

        // Setup event listeners
        this.resizeListener = this.onResize.bind(this);
        this.sigintListener = this.handleExitKeyPress.bind(this);

        process.stdout.on('resize', this.resizeListener);
        process.on('SIGINT', this.sigintListener);
        
        // Start the timer interval (adapted from original initializeUI)
        if (!uiState.timerInterval) {
            const interval = setInterval(() => {
                if (uiState.isFinished) {
                    clearInterval(uiState.timerInterval!);
                    uiState.setTimerInterval(null);
                    return;
                }
                let runningTestsExist = false;
                uiState.setSpinnerFrame((uiState.spinnerFrame + 1) % uiState.spinnerChars.length);
                
                Object.entries(uiState.currentTestStates).forEach(([testId, state]) => {
                    // Assuming TestState from runner will have a 'status' field
                    // For now, we need to check if the state itself implies running
                    // This part will be more robust once TestState includes status directly
                    // Now we can use the explicit status
                    const liveState = state as TestState; // Cast to full TestState from runner/state
                    if (liveState.status === 'running') {
                        runningTestsExist = true;
                        // Ensure startedAt is set if running, though TestStateTracker should handle this
                        if (liveState.startedAt) {
                             uiState.updateElapsedTime(testId, Date.now() - liveState.startedAt);
                        } else {
                            // This case should ideally not happen if TestState is correctly managed
                            // uiState.updateElapsedTime(testId, 0); 
                        }
                    }
                });
                if (runningTestsExist) {
                    scheduleRedraw(); // Direct call
                }
            }, 100);
            uiState.setTimerInterval(interval);
        }

        scheduleRedraw(); // Initial draw - Direct call
    }

    public stop(): void {
        if (uiState.isFinished) return; // Prevent double cleanup
        uiState.setIsFinished(true);

        if (uiState.timerInterval) {
            clearInterval(uiState.timerInterval);
            uiState.setTimerInterval(null);
        }

        // Remove event listeners
        if (this.resizeListener) {
            process.stdout.removeListener('resize', this.resizeListener);
            this.resizeListener = null;
        }
        if (this.sigintListener) {
            process.removeListener('SIGINT', this.sigintListener);
            this.sigintListener = null;
        }

        redraw(); // Perform one final draw - Direct call
        logUpdate.done();    // Persist final frame
        process.stderr.write('\n'); // Ensure prompt is clear
        // DO NOT call process.exit() here
    }

    public onTestStateUpdated(test: RegisteredTest, newState: TestState): void {
        const currentStates = { ...uiState.currentTestStates };
        const testId = test.id;

        // Merge new state into existing state for the test
        // Ensure startedAt is preserved if already set and newState doesn't have it
        const existingState = currentStates[testId] || {};
        const updatedTestState = { 
            ...existingState, 
            ...newState,
            startedAt: newState.startedAt || existingState.startedAt,
         };
        currentStates[testId] = updatedTestState;
        
        uiState.setCurrentTestStates(currentStates);

        // Handle startedAt and elapsedTimes
        if (updatedTestState.startedAt && !updatedTestState.doneAt) { // Test is running or just started
            if (!uiState.elapsedTimes[testId] || uiState.elapsedTimes[testId] === 0) {
                 // If it just started, set elapsed time to 0 or based on current time
                uiState.updateElapsedTime(testId, Date.now() - updatedTestState.startedAt);
            }
        } else if (updatedTestState.startedAt && updatedTestState.doneAt) { // Test finished
            uiState.updateElapsedTime(testId, updatedTestState.doneAt - updatedTestState.startedAt);
        }
        
        scheduleRedraw(); // Direct call
    }

    // Adapted from term-app/index.ts
    private onResize(): void {
        uiState.setIsResizing(true);
        if (uiState.resizeTimeout) {
            clearTimeout(uiState.resizeTimeout);
        }
        uiState.setResizeTimeout(setTimeout(() => {
            const newWidth = Math.min(process.stdout.columns || MAX_APP_WIDTH, MAX_APP_WIDTH);
            if (newWidth !== uiState.currentWidth) {
                uiState.setCurrentWidth(newWidth);
                scheduleRedraw(); // Direct call
            }
            uiState.setIsResizing(false);
            uiState.setResizeTimeout(null);
        }, 100));
    }

    // Adapted from term-app/index.ts
    private handleExitKeyPress(): void {
        // No longer distinguish between isFinished, just trigger stop
        this.stop(); 
        // The TestSuiteRunner or CLI will handle actual process exit if needed after stop() completes.
        // Forcing an exit here might preempt cleanup or final reporting.
        // A second SIGINT will terminate if stop() doesn't lead to exit.
    }
}
