import logUpdate from 'log-update';
import { RegisteredTest } from '@/discovery/types';
import { Action } from 'magnitude-core';
import { TestFailure, TestState as RunnerTestState, StepDescriptor as RunnerStepDescriptor, CheckDescriptor as RunnerCheckDescriptor } from '@/runner/state';
import { AllTestStates } from './types'; // AllTestStates now uses RunnerTestState from ./types which aliases RunnerTestState
import { VERSION } from '@/version';
import { formatDuration, wrapText } from './util'; // Removed getUniqueTestId
import {
    ANSI_RESET, ANSI_GREEN, ANSI_BRIGHT_BLUE,
    ANSI_GRAY, ANSI_RED, ANSI_BOLD, ANSI_DIM, PADDING, BOX_CHARS_ROUNDED
} from './constants';
import {
    str, createBoxAnsi, insertLineIntoBoxAnsi, styleAnsi,
    getTestStatusIndicatorChar,
    getStepStatusIndicatorChar, getCheckStatusIndicatorChar
} from './drawingUtils'; // Removed describeAction, getActionSymbol
import {
    currentWidth, redrawScheduled, currentTestStates, allRegisteredTests,
    currentModel, elapsedTimes, isFinished, spinnerFrame,
    lastOutputLineCount, isFirstDraw, isResizing, renderSettings,
    setRedrawScheduled, setLastOutputLineCount, setIsFirstDraw, spinnerChars
} from './uiState';
import { knownCostMap } from '@/util';

/**
 * Generate the title bar portion of the UI
 * @returns Array of strings with ANSI codes representing the title bar
 */
export function generateTitleBarString(): string[] {
    const boxLines = createBoxAnsi(currentWidth, 3, ANSI_BRIGHT_BLUE);
    const titleText = `${ANSI_BRIGHT_BLUE}${ANSI_BOLD}Magnitude v${VERSION}${ANSI_RESET}`;
    const modelText = `${ANSI_GRAY}${currentModel}${ANSI_RESET}`;
    const contentWidth = currentWidth - 2; 

    const titleWidth = str(titleText);
    const modelWidth = str(modelText);
    const singleSpacePadding = 1;
    const spaceBetween = contentWidth - titleWidth - modelWidth - (singleSpacePadding * 2);
    const middleLineContent = ' '.repeat(singleSpacePadding) + titleText + ' '.repeat(Math.max(0, spaceBetween)) + modelText + ' '.repeat(singleSpacePadding);

    boxLines[1] = `${ANSI_BRIGHT_BLUE}${BOX_CHARS_ROUNDED.vertical}${middleLineContent.padEnd(contentWidth)}${BOX_CHARS_ROUNDED.vertical}${ANSI_RESET}`;
    return boxLines;
}

/**
 * Generate a string representation of a failure
 */
export function generateFailureString(failure: TestFailure, indent: number, availableWidth: number): string[] {
    const output: string[] = [];
    const prefix = '↳ ';
    const prefixAnsi = `${ANSI_RED}${prefix}${ANSI_RESET}`;
    const contentWidth = Math.max(1, availableWidth - str(prefix));

    const addLine = (text: string, styleCode = ANSI_RED, bold = false) => {
        const fullStyleCode = `${styleCode}${bold ? ANSI_BOLD : ''}`;
        wrapText(text, contentWidth).forEach((line, index) => {
            const linePrefix = index === 0 ? prefixAnsi : ' '.repeat(str(prefix));
            output.push(' '.repeat(indent) + linePrefix + `${fullStyleCode}${line}${ANSI_RESET}`);
        });
    };
    
    // Simplified failure display: just the message
    if (failure && failure.message) {
        addLine(failure.message);
    } else {
        addLine("Unknown error details"); // Fallback
    }
    return output;
}

/**
 * Generate a string representation of a test
 */
export function generateTestString(test: RegisteredTest, state: RunnerTestState, indent: number, availableWidth: number): string[] {
    const output: string[] = [];
    const testId = test.id; // Use RegisteredTest.id
    const contentWidth = Math.max(1, availableWidth - indent);
    const stepIndent = indent + 2;
    const actionIndent = stepIndent + 2;
    const stepContentWidth = Math.max(1, availableWidth - stepIndent - 2);
    const actionContentWidth = Math.max(1, availableWidth - actionIndent - 2);
    
    // Determine status from TestState (which should now include it or be inferred)
    // For now, assuming state has a status-like property or can be inferred for styling
    let currentStatus: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' = 'pending';
    if (state.failure) {
        currentStatus = 'failed';
    } else if (state.doneAt) {
        currentStatus = 'passed';
    } else if (state.startedAt) {
        currentStatus = 'running';
    }
    // TODO: Handle 'cancelled' status if it's set directly on TestState

    const statusCharPlain = currentStatus === 'running' ? spinnerChars[spinnerFrame] : getTestStatusIndicatorChar(currentStatus);
    const statusStyled = styleAnsi(currentStatus, statusCharPlain, 'test');

    const timerText = currentStatus !== 'pending' ? `${ANSI_GRAY} [${formatDuration(elapsedTimes[testId] ?? 0)}]${ANSI_RESET}` : '';
    const titleAvailableWidth = contentWidth - 2 - str(timerText);
    const wrappedTitle = wrapText(test.title, titleAvailableWidth > 10 ? titleAvailableWidth : contentWidth - 2);

    wrappedTitle.forEach((line, index) => {
        const linePrefix = index === 0 ? `${statusStyled} ` : '  ';
        const lineSuffix = index === 0 ? timerText : '';
        output.push(' '.repeat(indent) + linePrefix + line + lineSuffix);
    });

    if (state.stepsAndChecks && state.stepsAndChecks.length > 0) {
        state.stepsAndChecks.forEach((item: RunnerStepDescriptor | RunnerCheckDescriptor) => {
            const itemIndent = stepIndent;
            const itemContentWidth = stepContentWidth;
            let itemCharPlain = '';
            let itemDesc = '';
            let itemStyleType: 'step' | 'check' = 'step';

            // Assuming item has 'status' and 'description'
            // And RunnerStepDescriptor has 'actions'
            if (item.variant === 'step') {
                itemCharPlain = getStepStatusIndicatorChar(item.status);
                itemDesc = item.description;
                itemStyleType = 'step';
            } else { // Check
                itemCharPlain = getCheckStatusIndicatorChar(item.status);
                itemDesc = item.description;
                itemStyleType = 'check';
            }

            const styledChar = styleAnsi(item.status, itemCharPlain, itemStyleType);
            const wrappedDesc = wrapText(itemDesc, itemContentWidth);

            wrappedDesc.forEach((line, index) => {
                const linePrefix = index === 0 ? `${styledChar} ` : '  ';
                output.push(' '.repeat(itemIndent) + linePrefix + line);
            });

            if (renderSettings.showActions && item.variant === 'step' && (item as RunnerStepDescriptor).actions.length > 0) {
                (item as RunnerStepDescriptor).actions.forEach((action: Action) => {
                    const actionSymbol = `${ANSI_GRAY}▶${ANSI_RESET}`; // Generic symbol
                    const actionDesc = JSON.stringify(action); // Stringify action
                    const wrappedActionDesc = wrapText(actionDesc, actionContentWidth);
                    wrappedActionDesc.forEach((line, index) => {
                        const linePrefix = index === 0 ? `${actionSymbol} ` : '  ';
                        output.push(' '.repeat(actionIndent) + linePrefix + `${ANSI_GRAY}${line}${ANSI_RESET}`);
                    });
                });
            }
        });
    }

    if (state.failure) { // No 'cancelled' variant check for failure message display
        const failureLines = generateFailureString(state.failure, stepIndent, availableWidth - stepIndent);
        output.push(...failureLines);
    }
    return output;
}

// Helper function to group tests for display
function groupRegisteredTestsForDisplay(tests: RegisteredTest[]):
    Record<string, { ungrouped: RegisteredTest[], groups: Record<string, RegisteredTest[]> }> {
    const files: Record<string, { ungrouped: RegisteredTest[], groups: Record<string, RegisteredTest[]> }> = {};
    for (const test of tests) {
        if (!files[test.filepath]) {
            files[test.filepath] = { ungrouped: [], groups: {} };
        }
        if (test.group) {
            if (!files[test.filepath].groups[test.group]) {
                files[test.filepath].groups[test.group] = [];
            }
            files[test.filepath].groups[test.group].push(test);
        } else {
            files[test.filepath].ungrouped.push(test);
        }
    }
    return files;
}


/**
 * Generate the test list portion of the UI
 */
export function generateTestListString(boxHeight: number): string[] {
    const boxLines = createBoxAnsi(currentWidth, boxHeight, ANSI_GRAY);
    const contentWidth = currentWidth - (PADDING * 2);
    const fileIndent = 0;
    const groupIndent = fileIndent + 2;
    const testBaseIndent = groupIndent;

    let currentContentLine = 0;
    const maxContentLines = boxHeight - 2;

    const groupedDisplayTests = groupRegisteredTestsForDisplay(allRegisteredTests);

    for (const [filepath, { ungrouped, groups }] of Object.entries(groupedDisplayTests)) {
        if (currentContentLine >= maxContentLines) break;

        const fileHeader = `${ANSI_BRIGHT_BLUE}${ANSI_BOLD}☰ ${filepath}${ANSI_RESET}`;
        insertLineIntoBoxAnsi(boxLines, fileHeader, currentContentLine + 1, (PADDING - 1) + fileIndent, currentWidth);
        currentContentLine++;

        if (ungrouped.length > 0) {
            for (const test of ungrouped) {
                if (currentContentLine >= maxContentLines) break;
                const state = currentTestStates[test.id];
                if (state) {
                    const testLines = generateTestString(test, state, testBaseIndent, contentWidth - testBaseIndent);
                    testLines.forEach(line => {
                        if (currentContentLine < maxContentLines) {
                            insertLineIntoBoxAnsi(boxLines, line, currentContentLine + 1, PADDING - 1, currentWidth);
                            currentContentLine++;
                        }
                    });
                }
            }
        }
        if (currentContentLine >= maxContentLines) break;

        if (Object.entries(groups).length > 0) {
            for (const [groupName, groupTests] of Object.entries(groups)) {
                if (currentContentLine >= maxContentLines) break;
                const groupHeader = `${ANSI_BRIGHT_BLUE}${ANSI_BOLD}↳ ${groupName}${ANSI_RESET}`;
                insertLineIntoBoxAnsi(boxLines, groupHeader, currentContentLine + 1, (PADDING - 1) + groupIndent, currentWidth);
                currentContentLine++;

                for (const test of groupTests) {
                    if (currentContentLine >= maxContentLines) break;
                    const state = currentTestStates[test.id];
                    if (state) {
                        const testLines = generateTestString(test, state, testBaseIndent + 2, contentWidth - (testBaseIndent + 2));
                        testLines.forEach(line => {
                            if (currentContentLine < maxContentLines) {
                                insertLineIntoBoxAnsi(boxLines, line, currentContentLine + 1, PADDING - 1, currentWidth);
                                currentContentLine++;
                            }
                        });
                    }
                }
                if (currentContentLine >= maxContentLines) break;
            }
        }

        if (currentContentLine < maxContentLines) {
            insertLineIntoBoxAnsi(boxLines, '', currentContentLine + 1, PADDING - 1, currentWidth);
            currentContentLine++;
        }
    }
    return boxLines;
}

/**
 * Generate the summary portion of the UI
 */
export function generateSummaryString(boxHeight: number): string[] {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const statusCounts = { pending: 0, running: 0, passed: 0, failed: 0, cancelled: 0, total: 0 };
    const failuresWithContext: { filepath: string; groupName?: string; testTitle: string; failure: TestFailure }[] = [];
    
    // Build context map from allRegisteredTests
    const testContextMap = new Map<string, { filepath: string; groupName?: string; testTitle: string }>();
    allRegisteredTests.forEach(test => {
        testContextMap.set(test.id, { filepath: test.filepath, groupName: test.group, testTitle: test.title });
    });

    Object.entries(currentTestStates).forEach(([testId, state]) => {
        statusCounts.total++;
        // Infer status for counting
        let currentStatus: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' = 'pending';
        if (state.failure) {
            currentStatus = 'failed';
        } else if (state.doneAt) {
            currentStatus = 'passed';
        } else if (state.startedAt) {
            currentStatus = 'running';
        }
        // TODO: How is 'cancelled' status determined from RunnerTestState? Assume for now it might be part of failure or a specific flag.
        // For now, only count based on failure, doneAt, startedAt.
        statusCounts[currentStatus]++;

        if (state.macroUsage) { // Check if macroUsage exists
            totalInputTokens += state.macroUsage.inputTokens;
            totalOutputTokens += state.macroUsage.outputTokens;
        }
        if (state.failure) {
            const context = testContextMap.get(testId);
            failuresWithContext.push({
                filepath: context?.filepath ?? 'Unknown File', groupName: context?.groupName,
                testTitle: context?.testTitle ?? 'Unknown Test', failure: state.failure
            });
        }
    });

    const hasFailures = failuresWithContext.length > 0;
    const boxColor = hasFailures ? ANSI_RED : ANSI_GRAY;
    const boxLines = createBoxAnsi(currentWidth, boxHeight, boxColor);
    const baseContentWidth = currentWidth - (PADDING * 2);
    const summaryInternalLeftPadding = 1;
    const effectiveSummaryContentWidth = baseContentWidth - summaryInternalLeftPadding;

    let currentContentLine = 0;
    const maxContentLines = boxHeight - 2;

    if (currentContentLine < maxContentLines) {
        let statusLine = '';
        if (statusCounts.passed > 0) statusLine += `${ANSI_GREEN}✓ ${statusCounts.passed} passed${ANSI_RESET}  `;
        if (statusCounts.failed > 0) statusLine += `${ANSI_RED}✗ ${statusCounts.failed} failed${ANSI_RESET}  `;
        if (statusCounts.running > 0) statusLine += `${ANSI_BRIGHT_BLUE}▷ ${statusCounts.running} running${ANSI_RESET}  `;
        if (statusCounts.pending > 0) statusLine += `${ANSI_GRAY}◌ ${statusCounts.pending} pending${ANSI_RESET}  `;
        if (statusCounts.cancelled > 0) statusLine += `${ANSI_GRAY}⊘ ${statusCounts.cancelled} cancelled${ANSI_RESET}  `;

        let costDescription = '';
        // Assuming knownCostMap and currentModel are available from uiState
        for (const [model, costs] of Object.entries(knownCostMap)) {
            if (currentModel.includes(model)) {
                const inputCost = costs[0];
                const outputCost = costs[1];
                costDescription = ` (\$${((totalInputTokens * inputCost + totalOutputTokens * outputCost) / 1000000).toFixed(2)})`;
            }
        }
        
        let tokenText = `${ANSI_GRAY}tokens: ${totalInputTokens} in, ${totalOutputTokens} out${costDescription}${ANSI_RESET}`;
        
        const spaceNeeded = str(statusLine) + str(tokenText);
        const spacer = ' '.repeat(Math.max(0, effectiveSummaryContentWidth - spaceNeeded));
        const combinedLine = statusLine + spacer + tokenText;

        insertLineIntoBoxAnsi(boxLines, combinedLine, currentContentLine + 1, summaryInternalLeftPadding, currentWidth);
        currentContentLine++;
    }

    if (hasFailures && currentContentLine < maxContentLines) {
        const failureHeader = `${ANSI_DIM}Failures:${ANSI_RESET}`;
        insertLineIntoBoxAnsi(boxLines, failureHeader, currentContentLine + 1, summaryInternalLeftPadding, currentWidth);
        currentContentLine++;

        for (const { filepath, groupName, testTitle, failure } of failuresWithContext) {
            if (currentContentLine >= maxContentLines) break;
            const contextString = `${ANSI_DIM}${filepath}${groupName ? ` > ${groupName}` : ''} > ${testTitle}${ANSI_RESET}`;
            insertLineIntoBoxAnsi(boxLines, contextString, currentContentLine + 1, 1 + summaryInternalLeftPadding, currentWidth);
            currentContentLine++;

            if (currentContentLine < maxContentLines) {
                const failureLines = generateFailureString(failure, 2, effectiveSummaryContentWidth - 2);
                failureLines.forEach(line => {
                    if (currentContentLine < maxContentLines) {
                        insertLineIntoBoxAnsi(boxLines, line, currentContentLine + 1, summaryInternalLeftPadding, currentWidth);
                        currentContentLine++;
                    }
                });
            }

            if (currentContentLine < maxContentLines) {
                insertLineIntoBoxAnsi(boxLines, '', currentContentLine + 1, summaryInternalLeftPadding, currentWidth);
                currentContentLine++;
            }
        }
    }
    return boxLines;
}

/**
 * Calculate the height needed for the test list
 */
export function calculateTestListHeight(tests: RegisteredTest[], testStates: AllTestStates): number {
    let height = 0;
    const groupedDisplayTests = groupRegisteredTestsForDisplay(tests); // Use the helper

    for (const [filepath, { ungrouped, groups }] of Object.entries(groupedDisplayTests)) {
        height++; // File header line
        
        if (ungrouped.length > 0) {
            for (const test of ungrouped) {
                const state = testStates[test.id];
                if (state) {
                    const contentWidth = Math.max(1, currentWidth - (PADDING * 2) - 4); // Approx content width for test
                    height += wrapText(test.title, contentWidth - 2).length;
                    
                    if (state.stepsAndChecks) {
                        state.stepsAndChecks.forEach((item: RunnerStepDescriptor | RunnerCheckDescriptor) => {
                            height += wrapText(item.description, contentWidth - 4).length;
                            if (renderSettings.showActions && item.variant === 'step' && (item as RunnerStepDescriptor).actions.length > 0) {
                                (item as RunnerStepDescriptor).actions.forEach((action: Action) => {
                                    height += wrapText(JSON.stringify(action), contentWidth - 6).length;
                                });
                            }
                        });
                    }
                    if (state.failure) {
                        height += wrapText(state.failure.message, contentWidth - 4).length; // Simplified height for failure
                        height += 1; // For prefix
                    }
                }
            }
        }
        
        if (Object.entries(groups).length > 0) {
            for (const [groupName, groupTests] of Object.entries(groups)) {
                height++; // Group header line
                for (const test of groupTests) {
                    const state = testStates[test.id];
                    if (state) {
                        const contentWidth = Math.max(1, currentWidth - (PADDING * 2) - 6); // Deeper indent
                        height += wrapText(test.title, contentWidth - 2).length;
                        if (state.stepsAndChecks) {
                            state.stepsAndChecks.forEach((item: RunnerStepDescriptor | RunnerCheckDescriptor) => {
                                height += wrapText(item.description, contentWidth - 4).length;
                                if (renderSettings.showActions && item.variant === 'step' && (item as RunnerStepDescriptor).actions.length > 0) {
                                    (item as RunnerStepDescriptor).actions.forEach((action: Action) => {
                                        height += wrapText(JSON.stringify(action), contentWidth - 6).length;
                                    });
                                }
                            });
                        }
                        if (state.failure) {
                            height += wrapText(state.failure.message, contentWidth - 4).length;
                            height += 1; // For prefix
                        }
                    }
                }
            }
        }
        height++; // Blank line between files
    }
    return Math.max(3, height);
}

/**
 * Calculate the height needed for the summary
 */
export function calculateSummaryHeight(testStates: AllTestStates): number {
    let height = 0;
    height++; // Status counts line

    const failuresExist = Object.values(testStates).some(state => !!state.failure);

    if (failuresExist) {
        height++; // "Failures:" title
        Object.values(testStates).forEach((state) => {
            if (state.failure) {
                const testId = Object.keys(testStates).find(id => testStates[id] === state);
                const test = allRegisteredTests.find(t => t.id === testId); // Need to find the test for context

                if (test) height++; // Context line (filepath > group > test title)
                
                const contentWidth = Math.max(1, currentWidth - (PADDING * 2) - 4);
                height += wrapText(state.failure.message, contentWidth).length;
                height += 1; // For prefix and space after failure
            }
        });
    }
    return Math.max(1, height); // Ensure at least 1 for status line even if no failures
}

/**
 * Main function to redraw the UI
 */
export function redraw() {
    setRedrawScheduled(false);

    const testListMinHeight = 3;
    const summaryMinHeight = 1; // Can be 1 if only status line

    let testListHeight = calculateTestListHeight(allRegisteredTests, currentTestStates);
    if (testListHeight > 0) {
        testListHeight += 2; // Box borders
        testListHeight = Math.max(testListMinHeight, testListHeight);
    } else {
        testListHeight = 0;
    }

    let summaryHeight = calculateSummaryHeight(currentTestStates);
    if (summaryHeight > 0) {
        summaryHeight += 2; // Box borders (only if content exists beyond just status line)
        summaryHeight = Math.max(summaryMinHeight + (summaryHeight > 1 ? 2 : 0) , summaryHeight);
         if (Object.values(currentTestStates).length === 0) summaryHeight = 0; // No summary if no tests
    } else {
       summaryHeight = 0;
    }
    
    const spacingHeight = (testListHeight > 0 && summaryHeight > 0) ? 0 : 0; // No spacing for now

    const outputLines: string[] = [];
    outputLines.push('');
    outputLines.push(...generateTitleBarString());

    if (testListHeight > 0) {
        outputLines.push(...generateTestListString(testListHeight));
    }

    if (spacingHeight > 0) {
        outputLines.push('');
    }

    if (summaryHeight > 0) {
        outputLines.push(...generateSummaryString(summaryHeight));
    }

    const frameContent = outputLines.join('\n');

    const shouldClear = !isFirstDraw && !isResizing && outputLines.length !== lastOutputLineCount;
                        
    if (shouldClear) {
        logUpdate.clear();
    }

    logUpdate(frameContent);
    setLastOutputLineCount(outputLines.length);

    if (isFirstDraw) {
        setIsFirstDraw(false);
    }
}

/**
 * Schedule a UI redraw if one is not already scheduled
 */
export function scheduleRedraw() {
    if (!redrawScheduled) {
        setRedrawScheduled(true);
        setImmediate(redraw);
    }
}
