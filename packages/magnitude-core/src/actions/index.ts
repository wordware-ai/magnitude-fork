import { Agent } from "@/agent"
import { z, Schema, ZodTypeAny } from "zod"

export interface Action<T> {
    name: string;
    description?: string;
    schema: Schema<T>;
    resolver: ({ input, agent }: { input: T, agent: Agent }) => Promise<void>;
}

export function createAction<S extends ZodTypeAny>(
    action: {
        name: string;
        description: string;
        schema: S;
        resolver: ({ input, agent }: { input: z.infer<S>; agent: Agent }) => Promise<void>;
    }
): Action<z.infer<S>> {
    // Just a helper for automatic schema typing
    return {
        name: action.name,
        description: action.description,
        schema: action.schema,
        resolver: action.resolver
    };
}
