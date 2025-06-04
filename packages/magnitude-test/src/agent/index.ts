import { BrowserAgent, AgentOptions, BrowserConnectorOptions, buildDefaultBrowserAgentOptions } from "magnitude-core";

export async function startTestCaseAgent(
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

export class TestCaseAgent extends BrowserAgent {

}