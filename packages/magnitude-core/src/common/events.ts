
// Common interfaces that can be used anywhere
// Goal is not to expose internals but provide all necessary info in events

import { Action } from "@/actions/types";
import { ActOptions } from "@/agent";
import { LLMClientIdentifier, ModelUsage } from "@/ai/types";
import { LLMClient } from "@/ai/types";

// export interface ModelUsage {
//     llm: LLMClientIdentifier,
//     inputTokens: number,
//     outputTokens: number
// }[];

export interface AgentEvents {
    'start': () => void;
    'stop': () => void;

    'thought': (thought: string) => void;

    'actStarted': (task: string, options: ActOptions) => void;
    'actDone': (task: string,  options: ActOptions) => void;
    
    'actionStarted': (action: Action) => void;
    'actionDone': (action: Action) => void;

    'tokensUsed': (usage: ModelUsage) => void;
    //'tokensUsed': (tokenUsage: { llm: LLMClient, inputTokens: number, outputTokens: number }) => void;

    //[key: string]: (...args: any[]) => void;
    


    // 'start': () => void;
    // // Emitted after any action is taken during act()
    // 'action': (action: Action) => void;
    // 'stop': () => void;

    // 'start': () => void;

    // // Emitted after any action is taken in the browser
    // 'action': (action: ActionDescriptor) => void;
    // // Which step/check can be derived from TC definition + tracked state
    // // TODO: include step options (test data)
    // // Emitted when the actions for a step (not its checks) are completed
    // 'stepStart': (description: string) => void;
    // // Emitted when a check associated with some step is completed
    // 'checkStart': (description: string) => void;

    // 'stepSuccess': () => void;
    // 'checkSuccess': () => void;

    // // Emitted when the run fails - emitted after startStep or startCheck instead of completeStep/completeCheck
    // 'fail': (failure: FailureDescriptor) => void;
}