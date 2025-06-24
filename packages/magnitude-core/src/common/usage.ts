// import { LLMClientIdentifier } from "@/ai/types";



// type SingleModelUsage = { llm: LLMClientIdentifier, inputTokens: number, outputTokens: number, numCalls: number };
// //type MultiModelUsage = SingleModelUsage[];

// export class ModelUsage {
//     private totalUsage: Record<string, SingleModelUsage>;
//     //private usage: MultiModelUsage;
//     constructor(totalUsage: Record<string, SingleModelUsage>) {
//         this.totalUsage = totalUsage;
//     }

//     static fromSingleCall(call: { llm: LLMClientIdentifier, inputTokens: number, outputTokens: number }) {
//         return new ModelUsage([{ ...call, numCalls: 1 }]);
//         // this.merge(
//         //     new ModelUsage([{ ...call, numCalls: 1 }]);
//         // );
//     }

//     merge(other: ModelUsage) {
//         for (const item of this.usage) {
//             // for (const foo of other.toJSON()) {
                
//             // }
//             const modelHash = JSON.stringify(modelUsage.llm);
//             let exists = false;
//             for (const usage of this.state.modelUsage) {
//                 const compare = JSON.stringify(usage.llm);
//                 if (modelHash === compare) {
//                     // merge with existing usage
//                     exists = true;
//                     usage.inputTokens += modelUsage.inputTokens;
//                     usage.outputTokens += modelUsage.outputTokens;
//                     usage.numCalls += 1;
//                 }
//             }
//             if (!exists) {
//                 this.state.modelUsage.push({ ...modelUsage, numCalls: 1 })
//             }

            
//         }
//     }

//     toList(): SingleModelUsage[] {

//     }
// }