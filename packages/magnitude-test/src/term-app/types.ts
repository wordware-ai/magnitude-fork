//import { AgentState } from "magnitude-core";

export interface AgentState {
    // startedAt?: number,
    // cached?: boolean,
    // stepsAndChecks: (StepDescriptor | CheckDescriptor)[],
	// macroUsage: {
	// 	provider: string,
	// 	model: string,
	// 	inputTokens: number,
	// 	outputTokens: number,
	// 	numCalls: number
	// }
	// microUsage: {
	// 	provider: string,
	// 	numCalls: number
	// },
    //failure?: FailureDescriptor
}

export type TestState = {
    status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
    //startTime?: number;
    //error?: Error;
} & AgentState;

export type AllTestStates = Record<string, TestState>;
