import { AgentError } from "@/agent/errors";
import { ActionDefinition, ActionPayload, createAction } from ".";
import { z } from "zod";

export const doneAction = createAction({
    name: 'task:done',
    description: 'Use once sure that task is finished',//'Designate current task as finished',
    schema: z.object({}),
    resolver: async ({ agent }) => {
        agent.queueDone();
    },
});

export const failAction = createAction({
    name: 'task:fail',
    description: 'Use if task was attempted but does not seem possible. Use common sense',//'Designate current task as infeasible',
    schema: z.object({}),
    resolver: async ({ agent }) => {
        throw new AgentError(`Task failed: ${agent.memory.getLastThoughtMessage() ?? "No thought recorded"}`);
    },
});

export const taskActions = [
    doneAction,
    failAction
] as const;
