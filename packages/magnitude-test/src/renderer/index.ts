import { RegisteredTest } from "@/discovery/types";
import { TestState } from "@/runner/state";

// Base class
// export class TestRenderer {
//     start() {}
//     stop() {}

//     onTestStateUpdated(state: TestState) {
//         console.log(state);
//     }
// }

export interface TestRenderer {
    start?(): void
    stop?(): void

    onTestStateUpdated(test: RegisteredTest, state: TestState): void
}