import { BrowserContext, Page } from "playwright";
import { Agent, AgentOptions } from ".";
import { BrowserConnector, BrowserConnectorOptions } from "@/connectors/browserConnector";
import { isClaude, isGroundedLlm, tryDeriveUIGroundedClients } from "@/ai/util";
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
    //if (options.llm)
    // TODO: if claude, use virtualScreenDimensions: { width: 1024, height: 768 }
    
    const { llm: envLlm, grounding: envGrounding } = tryDeriveUIGroundedClients();

    let llm: LLMClient | null = options.llm ?? envLlm;
    const grounding = (llm && isGroundedLlm(llm)) ? null : (options.grounding ?? envGrounding);//llm?.options?.model?.includes('claude') ? null : (options.grounding ?? envGrounding);
    
    if (!llm) {
        throw new Error("No LLM configured or available from environment. Set environment variable ANTHROPIC_API_KEY and try again");
    } else if (!isGroundedLlm(llm) && !grounding) {
        throw new Error("Ungrounded LLM is configured without Moondream. Either use Anthropic (set ANTHROPIC_API_KEY) or provide a MOONDREAM_API_KEY");
    }

    // Set reasonable temp if not provided
    let llmOptions: LLMClient['options'] = { temperature: DEFAULT_BROWSER_AGENT_TEMP, ...(llm?.options ?? {}) };
    llm = {...llm, options: llmOptions as any }

    let virtualScreenDimensions = null;
    if (isClaude(llm)) {
        // Claude grounding only really works on 1024x768 screenshots
        virtualScreenDimensions = { width: 1024, height: 768 };
    }

    const agent = new BrowserAgent({
        agent: {...options, llm: llm },
        web: {...options, grounding: grounding ?? undefined, virtualScreenDimensions: virtualScreenDimensions ?? undefined }
    });
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

    async extract<T extends Schema>(instructions: string, schema: T): Promise<z.infer<T>> {
        // TODO: Implement
        const htmlContent = await this.page.content();
        const screenshot = await this.require(BrowserConnector).getHarness().screenshot();
        return await this.macro.extract(instructions, schema, screenshot, htmlContent);
    }
}