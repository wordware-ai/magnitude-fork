import { BrowserAgent, AgentOptions, BrowserConnectorOptions, buildDefaultBrowserAgentOptions, AgentError } from "magnitude-core";
import z from "zod";

export async function startTestCaseAgent(
    options: AgentOptions & BrowserConnectorOptions //StartAgentWithWebOptions = {}
): Promise<TestCaseAgent> {
    const { agentOptions, browserOptions } = buildDefaultBrowserAgentOptions({ agentOptions: options, browserOptions: options });

    const agent = new TestCaseAgent({
        agentOptions: agentOptions,
        browserOptions: browserOptions,
    });
    await agent.start();
    return agent;
}

const CHECK_INSTRUCTIONS=`
Given the actions of an LLM agent executing a test case, and a screenshot taken afterwards, evaluate whether the provided check "passes" i.e. holds true or not.

Check to evaluate:
`.trim();

interface TestCaseAgentOptions {

}

export class TestCaseAgent extends BrowserAgent {
    async check(description: string): Promise<void> {
        const instructions = CHECK_INSTRUCTIONS + `\n<check>${description}</check>`;
        const response = await this.query(instructions, z.object({
            reasoning: z.string(),
            passed: z.boolean()
        }));
        this.memory.recordThought(response.reasoning);
        if (!response.passed) throw new AgentError(`Check failed: ${description}`, { variant: 'check_failed' });
    }
}