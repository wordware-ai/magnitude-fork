import { BrowserContext, Page } from "playwright";
import { Agent, AgentOptions } from ".";
import { BrowserConnector, BrowserConnectorOptions } from "@/connectors/browserConnector";
import { buildDefaultBrowserAgentOptions } from "@/ai/util";
import { LLMClient } from "@/ai/types";
import { Schema } from "zod";
import z from "zod";
import { renderMinimalAccessibilityTree } from "@/web/util";

// export interface StartAgentWithWebOptions {
//     agentBaseOptions?: Partial<AgentOptions>;
//     webConnectorOptions?: BrowserConnectorOptions;
// }

const DEFAULT_BROWSER_AGENT_TEMP = 0.2;

// Helper function to start a web agent
export async function startBrowserAgent(
    options?: AgentOptions & BrowserConnectorOptions //StartAgentWithWebOptions = {}
): Promise<BrowserAgent> {
    const { agentOptions, browserOptions } = buildDefaultBrowserAgentOptions({ agentOptions: options ?? {}, browserOptions: options ?? {} });

    const agent = new BrowserAgent({
        agentOptions: agentOptions,
        browserOptions: browserOptions,
    });
    await agent.start();
    return agent;
}

export class BrowserAgent extends Agent {
    constructor({ agentOptions, browserOptions }: { agentOptions?: Partial<AgentOptions>, browserOptions?: BrowserConnectorOptions }) {
        //console.log("agent options:", agent);
        super({
            ...agentOptions,
            connectors: [new BrowserConnector(browserOptions || {}), ...(agentOptions?.connectors ?? [])]
        });
    }

    get page(): Page {
        return this.require(BrowserConnector).getHarness().page;
    }

    get context(): BrowserContext {
        return this.require(BrowserConnector).getHarness().context;
    }

    async nav(url: string): Promise<void> {
        await this.require(BrowserConnector).getHarness().navigate(url);
    }

    async extract<T extends Schema>(instructions: string, schema: T): Promise<z.infer<T>> {
        //const htmlContent = await this.page.content();
        const accessibilityTree = await this.page.accessibility.snapshot({ interestingOnly: true });
        const pageRepr = renderMinimalAccessibilityTree(accessibilityTree);
        const screenshot = await this.require(BrowserConnector).getHarness().screenshot();
        return await this.model.extract(instructions, schema, screenshot, pageRepr);
    }

    // async check(description: string): Promise<boolean> {
    //     //const screenshot = await this.require(BrowserConnector).getHarness().screenshot();
    //     return await this.macro.check(description, screenshot);
    // }
}
