import { Action, createAction } from ".";
import { z } from "zod";


const clickAction = createAction({
    name: 'browser:click',
    description: "Click something",
    schema: z.object({
        target: z.string().describe("Where exactly to click"),
    }),
    resolver: async ({ input: { target }, agent }) => {
        const screenshot = agent.memory.getLastScreenshot();
        const { x, y } = await agent.micro.locateTarget(screenshot, target);
        await agent.harness.click({ x, y });
    }
});

const typeAction = createAction({
    name: 'browser:type',
    description: "Click something and type into it",
    schema: z.object({
        target: z.string().describe("Where exactly to click before typing"),
        content: z.string().describe("Content to type, insert sequences <enter> or <tab> for those keypresses respectively."),
    }),
    resolver: async ({ input: { target, content }, agent }) => {
        const screenshot = agent.memory.getLastScreenshot();
        const { x, y } = await agent.micro.locateTarget(screenshot, target);
        await agent.harness.type({ x, y, content });
    }
});

const scrollAction = createAction({
    name: 'browser:scroll',
    description: "Hover mouse over target and scroll",
    schema: z.object({
        target: z.string().describe("Somewhere specific inside the container to scroll in"),
        deltaX: z.number().int().describe("Pixels to scroll horizontally"),
        deltaY: z.number().int().describe("Pixels to scroll vertically"),
    }),
    resolver: async ({ input: { target, deltaX, deltaY }, agent }) => {
        const screenshot = agent.memory.getLastScreenshot();
        const { x, y } = await agent.micro.locateTarget(screenshot, target);
        await agent.harness.scroll({ x, y, deltaX, deltaY });
    }
});

const switchTabAction = createAction({
    name: 'browser:tab',
    description: "Switch tabs",
    schema: z.object({
        index: z.number().int().describe("Index of tab to switch to"),
    }),
    resolver: async ({ input: { index }, agent }) => {
        await agent.harness.switchTab({ index });
    }
});