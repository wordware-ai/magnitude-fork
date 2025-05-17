import { deepEquals } from "@/common";
import { TabState } from "@/web/tabs";
import { Screenshot } from "@/web/types";

export interface AgentState {
    screenshot: Screenshot;
    tabs: TabState;
}

// For now, just a map of which state facets have changed
export interface AgentStateDelta {
    //[K in keyof AgentState]: boolean;
    screenshot: boolean;
    tabs: boolean;
}

export function deltaState(prevState: AgentState, nextState: AgentState) {
    /**
     * Delta each state facet
     */
    return {
        screenshot: !deepEquals(prevState.screenshot, nextState.screenshot),
        // ^ consider slightly looser comparison instead of exact b64 string equality
        tabs: !deepEquals(prevState.screenshot, nextState.screenshot)
    }
}