import { BrowserContext, Page } from "playwright";
import { Agent, AgentOptions } from ".";
import { BrowserConnector, BrowserConnectorOptions } from "@/connectors/browserConnector";
import { buildDefaultBrowserAgentOptions, isClaude, isGroundedLlm, tryDeriveUIGroundedClients } from "@/ai/util";
import { LLMClient } from "@/ai/types";
import { Schema } from "zod";
import z from "zod";

// export interface StartAgentWithWebOptions {
//     agentBaseOptions?: Partial<AgentOptions>;
//     webConnectorOptions?: BrowserConnectorOptions;
// }

const DEFAULT_BROWSER_AGENT_TEMP = 0.2;

// Helper function to start a web agent
export async function startBrowserAgent(
    options: AgentOptions & BrowserConnectorOptions //StartAgentWithWebOptions = {}
): Promise<BrowserAgent> {
    const { agentOptions, browserOptions } = buildDefaultBrowserAgentOptions({ agentOptions: options, browserOptions: options });

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

    async extract<T extends Schema>(instructions: string, schema: T): Promise<z.infer<T>> {
        // TODO: Implement
        const htmlContent = await this.page.content();
        const screenshot = await this.require(BrowserConnector).getHarness().screenshot();
        return await this.macro.extract(instructions, schema, screenshot, htmlContent);
    }

    // async check(description: string): Promise<boolean> {
    //     //const screenshot = await this.require(BrowserConnector).getHarness().screenshot();
    //     return await this.macro.check(description, screenshot);
    // }
}