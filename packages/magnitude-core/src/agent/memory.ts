import { BrowserExecutionContext, MemoryContext, MemoryContextLog } from "@/ai/baml_client";
import { Screenshot } from "@/web/types";
import { Image } from "@boundaryml/baml";
import { Action } from "@/actions/types";
import { AgentState, deltaState } from "./state";


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

    buildContext(): MemoryContext {
        /**
         * build full execution context from memory + state
         * TODO: replace this impl: include timestamps, thoughts, options for longer hist length more screenshots etc
         */
        // const stringifiedJsonActions = [];
        // for (const { event } of this.history) {
        //     if (event.variant === 'action') {
        //         stringifiedJsonActions.push(JSON.stringify(event.action, null, 4));
        //     }
        //     // todo: include thoughts as well
        // }
        // const screenshot = this.getLastScreenshot();
        // return {
        //     screenshot: Image.fromBase64('image/png', screenshot.image),
        //     actionHistory: stringifiedJsonActions,
        //     tabState: this.getLastKnownState().tabs
        // }
        let logs: MemoryContextLog[] = [];
        let prevState = this.initialState;
        for (const { timestamp, event } of this.history) {
            const formattedTime = new Date(timestamp).toTimeString().split(' ')[0];

            if (event.variant === 'thought') {
                logs.push({
                    timestamp: formattedTime,
                    message: event.thought
                });
            } else {
                //console.log("DELTA:", deltaState(prevState, event.state));
                const screenshot = deltaState(prevState, event.state).screenshot ? Image.fromBase64('image/png', event.state.screenshot.image) : null;
                //console.log("Screenshot:", screenshot);
                logs.push({
                    timestamp: formattedTime,
                    message: JSON.stringify(event.action), // TODO: replace with specific description implementations (ideally on action def)
                    // only include screenshot if changed
                    screenshot: screenshot
                });
                prevState = event.state;
            }
            
        }
        return {
            logs: logs,
            timestamp: new Date(Date.now()).toTimeString().split(' ')[0],
            screenshot: Image.fromBase64('image/png', this.getLastScreenshot().image),
            tabs: this.getLastKnownState().tabs
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