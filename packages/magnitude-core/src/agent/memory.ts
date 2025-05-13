import { AgentEvents } from "@/common";
import EventEmitter from "eventemitter3";

export class AgentMemory {
    /**
     * Memory configuration should determine default context retrieval policies for acts and queries.
     */
    constructor(agentEvents: EventEmitter<AgentEvents>) {
        //this.events = events;
    }
}