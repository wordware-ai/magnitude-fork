import { ActionDescriptor, AgentEvents } from "@/common";
import { Screenshot } from "@/web/types";
import EventEmitter from "eventemitter3";


interface BrowserExecutionHistoryItem {
    // the action taken in the browser
    action: ActionDescriptor,
    // screenshot of page after action was taken
    screenshot: Screenshot
}


export class AgentMemory {
    /**
     * Memory configuration should determine default context retrieval policies for acts and queries.
     * 
     * For now specific to browser agent but should eventually have entirely customizable facets
     */
    private browserExecutionHistory: BrowserExecutionHistoryItem[];

    // agentEvents: EventEmitter<AgentEvents>
    constructor() {
        //this.events = events;
        this.browserExecutionHistory = [];
    }

    getLastScreenshot(): Screenshot {
        const item = this.browserExecutionHistory.at(-1);
        if (!item) throw new Error("No last screenshot available");
        return item.screenshot;
    }
}