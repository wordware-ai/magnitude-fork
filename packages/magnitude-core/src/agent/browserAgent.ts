import { BrowserContext, Page } from "playwright";
import { Agent, AgentOptions } from ".";
import { BrowserConnector, BrowserConnectorOptions } from "@/connectors/browserConnector";

// export interface StartAgentWithWebOptions {
//     agentBaseOptions?: Partial<AgentOptions>;
//     webConnectorOptions?: BrowserConnectorOptions;
// }

// Helper function to start a web agent
export async function startBrowserAgent(
    options: AgentOptions & BrowserConnectorOptions //StartAgentWithWebOptions = {}
): Promise<BrowserAgent> {
    const agent = new BrowserAgent({ agent: options, web: options });
    await agent.start();
    return agent;
}

export class BrowserAgent extends Agent {
    constructor(options: { agent?: Partial<AgentOptions>, web?: BrowserConnectorOptions }) {
        //console.log("agent options:", agent);
        super({
            ...options.agent,
            connectors: [new BrowserConnector(options.web || {}), ...(options.agent?.connectors ?? [])]
        });
    }

    get page(): Page {
        return this.require(BrowserConnector).getHarness().page;
    }

    get context(): BrowserContext {
        return this.require(BrowserConnector).getHarness().context;
    }

    async extract() {
        // TODO: Implement
    }
}