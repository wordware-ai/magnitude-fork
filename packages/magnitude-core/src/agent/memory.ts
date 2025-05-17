import { BrowserExecutionContext } from "@/ai/baml_client";
import { Screenshot } from "@/web/types";
import { Image } from "@boundaryml/baml";
import { Action } from "@/actions/types";
import { AgentState } from "./state";


export interface AgentMemoryOptions {

}

interface HistoryEvent {
    timestamp: number;
    event: {
        variant: 'thought',
        thought: string
    } | {
        // some action and state afterwards (possibly but not necessarily resulting in state delta)
        variant: 'action',
        action: Action,
        state: AgentState
    };
}

export class AgentMemory {
    /**
     * Memory configuration should determine default context retrieval policies for acts and queries.
     * 
     * For now specific to browser agent but should eventually have entirely customizable facets
     */

    private initialState!: AgentState;
    private history: HistoryEvent[];

    constructor() {
        this.history = [];
    }

    getLastKnownState(): AgentState {
        for (let i = this.history.length - 1; i >= 0; i--) {
            const item = this.history.at(i)!;
            if (item.event.variant === 'action') return item.event.state;
        }

        if (this.initialState) return this.initialState;
        throw new Error("No state available!");
    }

    getLastScreenshot(): Screenshot {
        return this.getLastKnownState().screenshot;
    }

    buildContext(): BrowserExecutionContext {
        /**
         * build full execution context from memory + state
         * TODO: replace this impl: include timestamps, thoughts, options for longer hist length more screenshots etc
         */
        const stringifiedJsonActions = [];
        for (const { event } of this.history) {
            if (event.variant === 'action') {
                stringifiedJsonActions.push(JSON.stringify(event.action, null, 4));
            }
            // todo: include thoughts as well
        }
        const screenshot = this.getLastScreenshot();
        return {
            screenshot: Image.fromBase64('image/png', screenshot.image),
            actionHistory: stringifiedJsonActions,
            tabState: this.getLastKnownState().tabs
        }
    }

    inscribeInitialState(state: AgentState) {
        this.initialState = state;
    }

    inscribeObservation(action: Action, state: AgentState) {
        this.history.push({
            timestamp: Date.now(),
            event: {
                variant: 'action',
                action: action,
                state: state
            }
        });
    }

    inscribeThought(thought: string) {
        this.history.push({
            timestamp: Date.now(),
            event: {
                variant: 'thought',
                thought: thought
            }
        });
    }
}