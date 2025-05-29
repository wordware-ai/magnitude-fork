import { ActionDefinition, ActionPayload, createAction } from ".";
import { z } from "zod";
import { WebInteractionConnector } from "@/connectors/webConnector"; // Changed from WebInteractionFacet
import { AgentError } from "@/agent/errors"; // For error handling
import { Agent } from "@/agent"; // Import Agent type for agent parameter

// For separate grounding
export const clickTargetAction = createAction({
    name: 'browser:click',
    description: "Click something",
    schema: z.object({
        target: z.string().describe("Where exactly to click"),
    }),
    resolver: async ({ input: { target }, agent }) => {
        const web = agent.require(WebInteractionConnector);
        const harness = web.getHarness();
        const screenshot = await web.getLastScreenshot();
        const { x, y } = await web.requireGrounding().locateTarget(screenshot, target);
        await harness.click({ x, y });
    }
});

// For separate grounding
export const clickTargetAndType = createAction({
    name: 'browser:type',
    description: "Click something and type into it",
    schema: z.object({
        target: z.string().describe("Where exactly to click before typing"),
        content: z.string().describe("Content to type, insert sequences <enter> or <tab> for those keypresses respectively."),
    }),
    resolver: async ({ input: { target, content }, agent }) => {
        const web = agent.require(WebInteractionConnector);
        const harness = web.getHarness();
        const screenshot = await web.getLastScreenshot();
        const { x, y } = await web.requireGrounding().locateTarget(screenshot, target);
        await harness.clickAndType({ x, y, content });
    }
});

// For separate grounding
export const scrollTargetAction = createAction({
    name: 'browser:scroll',
    description: "Hover mouse over target and scroll",
    schema: z.object({
        target: z.string().describe("Somewhere specific inside the container to scroll in"),
        deltaX: z.number().int().describe("Pixels to scroll horizontally"),
        deltaY: z.number().int().describe("Pixels to scroll vertically"),
    }),
    resolver: async ({ input: { target, deltaX, deltaY }, agent }) => {
        const web = agent.require(WebInteractionConnector);
        const harness = web.getHarness();
        const screenshot = await web.getLastScreenshot();
        const { x, y } = await web.requireGrounding().locateTarget(screenshot, target);
        await harness.scroll({ x, y, deltaX, deltaY });
    }
});

// For grounded planner
export const clickCoordAction = createAction({
    name: 'browser:click',
    description: "Click something",
    schema: z.object({
        x: z.number().int(),
        y: z.number().int(),
    }),
    resolver: async ({ input: { x, y }, agent }) => {
        const web = agent.require(WebInteractionConnector);
        const harness = web.getHarness();
        await harness.click({ x, y });
    }
});

// For grounded planner
export const typeAction = createAction({
    name: 'browser:type',
    description: "Click something and type into it",
    schema: z.object({
        content: z.string().describe("Content to type, insert sequences <enter> or <tab> for those keypresses respectively."),
    }),
    resolver: async ({ input: { content }, agent }) => {
        const webConnector = agent.require(WebInteractionConnector);
        const harness = webConnector.getHarness();
        await harness.type({ content });
    }
});

// For grounded planner
export const scrollCoordAction = createAction({
    name: 'browser:scroll',
    description: "Hover mouse over target and scroll",
    schema: z.object({
        x: z.number().int(),
        y: z.number().int(),
        deltaX: z.number().int().describe("Pixels to scroll horizontally"),
        deltaY: z.number().int().describe("Pixels to scroll vertically"),
    }),
    resolver: async ({ input: { x, y, deltaX, deltaY }, agent }) => {
        const webConnector = agent.require(WebInteractionConnector);
        const harness = webConnector.getHarness();
        await harness.scroll({ x, y, deltaX, deltaY });
    }
});

// Grounding agnostic
export const switchTabAction = createAction({
    name: 'browser:tab',
    description: "Switch tabs",
    schema: z.object({
        index: z.number().int().describe("Index of tab to switch to"),
    }),
    resolver: async ({ input: { index }, agent }: { input: { index: number }, agent: Agent }) => {
        const webConnector = agent.require(WebInteractionConnector);
        const harness = webConnector.getHarness();
        await harness.switchTab({ index });
    }
});

// export const webActions = [
//     clickTargetAction,
//     clickTargetAndType,
//     scrollTargetAction,
//     switchTabAction,
// ] as const;


export const agnosticWebActions = [
    switchTabAction
] as const;

export const coordWebActions = [
    clickCoordAction,
    scrollCoordAction,
    typeAction
] as const;

export const targetWebActions = [
    clickTargetAction,
    clickTargetAndType,
    scrollTargetAction
] as const;