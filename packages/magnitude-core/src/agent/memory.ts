import { AnyWebActionPayload } from "@/actions/webActions";
import { BrowserExecutionContext } from "@/ai/baml_client";
import { ActionDescriptor, AgentEvents } from "@/common";
import { TabState } from "@/web/tabs";
import { Screenshot } from "@/web/types";
import EventEmitter from "eventemitter3";
import { Image } from "@boundaryml/baml";
import { Action } from "@/actions/types";
import { AgentState } from ".";


export interface AgentMemoryOptions {

}

interface BrowserExecutionHistoryItem {
    // the action taken in the browser
    action: AnyWebActionPayload
    // screenshot of page after action was taken
    screenshot: Screenshot;
}

type Thought = string;

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
    //private stateHistory: AgentState[];
    private history: HistoryEvent[];

    // private initialScreenshot!: Screenshot;
    // private browserExecutionHistory: BrowserExecutionHistoryItem[];//BrowserExecutionHistoryItem[];

    // agentEvents: EventEmitter<AgentEvents>
    constructor() {
        //this.events = events;
        //this.browserExecutionHistory = [];

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
        // for (let i = this.history.length - 1; i >= 0; i--) {
        //     const item = this.history.at(i)!;
        //     if (item.event.variant === 'action') return item.event.state.screenshot;
        // }

        // if (this.initialState) return this.initialState.screenshot;
        // throw new Error("No screenshots available!");
        // // if (!item) throw new Error("No last screenshot available");
        // // return item.screenshot;
    }

    // setInitialScreenshot(screenshot: Screenshot) {
    //     this.initialScreenshot = screenshot;
    // }

    // addWebAction(item: BrowserExecutionHistoryItem) {
    //     //console.log("adding web action to hist:", item.action.name);
    //     this.browserExecutionHistory.push(item);
    // }

    // getHistory() {
    //     return this.browserExecutionHistory;
    // }

    buildContext(): BrowserExecutionContext {
        /**
         * build full execution context from memory + state
         * TODO: replace this impl: include timestamps, thoughts, options for longer hist length more screenshots etc
         */
        // const stringifiedJsonActions = [];
        // for (const { action } of this.browserExecutionHistory) {
        //     stringifiedJsonActions.push(JSON.stringify(action, null, 4));
        // }
        // const screenshot = this.browserExecutionHistory.length > 0 ? this.browserExecutionHistory.at(-1)!.screenshot : this.initialScreenshot;
        // return {
        //     screenshot: Image.fromBase64('image/png', screenshot.image),
        //     actionHistory: stringifiedJsonActions,
        //     tabState: tabState
        // }
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