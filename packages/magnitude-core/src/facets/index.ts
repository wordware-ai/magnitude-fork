import { ActionDefinition } from "@/actions"

// export interface StateComponent {

// }

// export interface MemoryComponent {

// }

//export type AgentFacetState = Record<string, StateComponent>
// export interface AgentFacetState {
//     [key: string]: StateComponent
// }

//A extends ActionDefinition<any>[]
export interface AgentFacet<S, M> {// A, S, M
    options?: unknown

    getState(): S//StateComponent[]
    getMemory(): M//MemoryComponent[]

    getActionSpace(): ActionDefinition<any>[]//TODO: make generic

    // or pass facets event emitter?
    onStart(): Promise<void>;
    onStop(): Promise<void>;
}