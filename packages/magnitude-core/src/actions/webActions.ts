import { ActionDefinition, ActionPayload, createAction } from ".";
import { z } from "zod";
import { WebInteractionConnector } from "@/connectors/webConnector"; // Changed from WebInteractionFacet
import { AgentError } from "@/agent/errors"; // For error handling
import { Agent } from "@/agent"; // Import Agent type for agent parameter


export const clickAction = createAction({
    name: 'browser:click',
    description: "Click something",
    schema: z.object({
        target: z.string().describe("Where exactly to click"),
    }),
    resolver: async ({ input: { target }, agent }: { input: { target: string }, agent: Agent }) => {
        const webConnector = agent.getConnector(WebInteractionConnector);
        if (!webConnector) {
            throw new AgentError("WebInteractionConnector not available for click action.");
        }
        const harness = webConnector.getHarness();
        const screenshot = await webConnector.getLastScreenshot();//agent.memory.getLastScreenshot(); 
        const { x, y } = await agent.micro.locateTarget(screenshot, target);
        await harness.click({ x, y });
        // a lot of code dupe below but lets not overengineer yet
        // possible solns: before/after hooks for namespaces, action context injection
        // it is kind of nice tho seeing explicitly that this is mutating agent mem so maybe better to leave it
        // const updatedScreenshot = await agent.harness.screenshot();
        // agent.memory.addWebAction({
        //     action: {
        //         name: 'browser:click',
        //         target: target,
        //     },
        //     screenshot: updatedScreenshot
        // });
    }
});

export const typeAction = createAction({
    name: 'browser:type',
    description: "Click something and type into it",
    schema: z.object({
        target: z.string().describe("Where exactly to click before typing"),
        content: z.string().describe("Content to type, insert sequences <enter> or <tab> for those keypresses respectively."),
    }),
    resolver: async ({ input: { target, content }, agent }: { input: { target: string, content: string }, agent: Agent }) => {
        const webConnector = agent.getConnector(WebInteractionConnector);
        if (!webConnector) {
            throw new AgentError("WebInteractionConnector not available for type action.");
        }
        const harness = webConnector.getHarness();
        const screenshot = await webConnector.getLastScreenshot();
        const { x, y } = await agent.micro.locateTarget(screenshot, target);
        await harness.clickAndType({ x, y, content });
    }
});

export const scrollAction = createAction({
    name: 'browser:scroll',
    description: "Hover mouse over target and scroll",
    schema: z.object({
        target: z.string().describe("Somewhere specific inside the container to scroll in"),
        deltaX: z.number().int().describe("Pixels to scroll horizontally"),
        deltaY: z.number().int().describe("Pixels to scroll vertically"),
    }),
    resolver: async ({ input: { target, deltaX, deltaY }, agent }: { input: { target: string, deltaX: number, deltaY: number }, agent: Agent }) => {
        const webConnector = agent.getConnector(WebInteractionConnector);
        if (!webConnector) {
            throw new AgentError("WebInteractionConnector not available for scroll action.");
        }
        const harness = webConnector.getHarness();
        const screenshot = await webConnector.getLastScreenshot();
        const { x, y } = await agent.micro.locateTarget(screenshot, target);
        await harness.scroll({ x, y, deltaX, deltaY });
    }
});

export const switchTabAction = createAction({
    name: 'browser:tab',
    description: "Switch tabs",
    schema: z.object({
        index: z.number().int().describe("Index of tab to switch to"),
    }),
    resolver: async ({ input: { index }, agent }: { input: { index: number }, agent: Agent }) => {
        const webConnector = agent.getConnector(WebInteractionConnector);
        if (!webConnector) {
            throw new AgentError("WebInteractionConnector not available for switch tab action.");
        }
        const harness = webConnector.getHarness();
        await harness.switchTab({ index });
    }
});


// 1. Group your actions
export const webActions = [
    clickAction,
    typeAction,
    scrollAction,
    switchTabAction,
] as const; // `as const` is crucial here!

//const webActionsConst = webActions as const;

// 3. Generate the union type for all web action payloads
// (typeof webActions)[number] creates a union of the types of the elements in webActions.
// e.g., typeof clickAction | typeof typeAction | ...
// Then, ActionPayload is applied to each member of this union.
export type AnyWebActionPayload = ActionPayload<(typeof webActions)[number]>;
