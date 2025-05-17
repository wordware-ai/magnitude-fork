import { AnyWebActionPayload } from "@/actions/webActions";
import { BrowserExecutionContext } from "@/ai/baml_client";
import { ActionDescriptor, AgentEvents } from "@/common";
import { TabState } from "@/web/tabs";
import { Screenshot } from "@/web/types";
import EventEmitter from "eventemitter3";
import { Image } from "@boundaryml/baml";


// interface BrowserExecutionHistoryItem {
//     // the action taken in the browser
//     action: ActionDescriptor,
//     // screenshot of page after action was taken
//     screenshot: Screenshot
// }

interface BrowserExecutionHistoryItem {
    // the action taken in the browser
    // action: {
    //     name: 'browser:click',
    //     target: string
    // };
    action: AnyWebActionPayload
    // screenshot of page after action was taken
    screenshot: Screenshot;
}


export class AgentMemory {
    /**
     * Memory configuration should determine default context retrieval policies for acts and queries.
     * 
     * For now specific to browser agent but should eventually have entirely customizable facets
     */

    private initialScreenshot!: Screenshot;
    private browserExecutionHistory: BrowserExecutionHistoryItem[];//BrowserExecutionHistoryItem[];

    // agentEvents: EventEmitter<AgentEvents>
    constructor() {
        //this.events = events;
        this.browserExecutionHistory = [];
    }

    getLastScreenshot(): Screenshot {
        const item = this.browserExecutionHistory.at(-1);
        if (item) return item.screenshot;
        if (this.initialScreenshot) return this.initialScreenshot;
        throw new Error("No screenshots available!");
        // if (!item) throw new Error("No last screenshot available");
        // return item.screenshot;
    }

    setInitialScreenshot(screenshot: Screenshot) {
        this.initialScreenshot = screenshot;
    }

    addWebAction(item: BrowserExecutionHistoryItem) {
        this.browserExecutionHistory.push(item);
    }

    // getHistory() {
    //     return this.browserExecutionHistory;
    // }

    buildContext(tabState: TabState): BrowserExecutionContext {
        /**
         * build full execution context from memory + state
         */
        const stringifiedJsonActions = [];
        for (const { action } of this.browserExecutionHistory) {
            stringifiedJsonActions.push(JSON.stringify(action, null, 4));
        }
        const screenshot = this.browserExecutionHistory.length > 0 ? this.browserExecutionHistory[0].screenshot : this.initialScreenshot;
        return {
            screenshot: Image.fromBase64('image/png', screenshot.image),
            actionHistory: stringifiedJsonActions,
            tabState: tabState
        }
    }
}