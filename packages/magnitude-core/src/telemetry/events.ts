/**
 * telemetryVersion: string, // telemetry payload version will prob be nice in the future
    packageVersion: string,
    codebase?: string,
 */

import { Agent } from "@/agent";
import { BrowserAgent } from "@/agent/browserAgent";
import { LLMClientIdentifier, ModelUsage } from "@/ai/types";
import { createId, getCodebaseId, getMachineId, posthog, sendTelemetry } from "@/telemetry";


// export interface ModelUsage {
//     llm: LLMClientIdentifier,
//     inputTokens: number,
//     outputTokens: number
// }[];

export type UsageReport = {
    llm: LLMClientIdentifier,
    inputTokens: number,
    outputTokens: number,
    numCalls: number
}[]

export interface CommonEventProperties {
    telemetryVersion: string;
    packageVersion: string;
    codebase?: string;
    agentId: string; // each Agent creates a unique CUID2 sent on all events
}

export interface AgentStartEventProperties extends CommonEventProperties {
    //agentId: string; // each Agent creates a unique CUID2 sent on all events
}

export interface AgentStopEventProperties extends CommonEventProperties {

};

export interface AgentActEventProperies extends CommonEventProperties {
    startedAt: number,
	doneAt: number,
    actionCount: number;
    modelUsage: UsageReport
};

export interface AgentExtractEventProperies extends CommonEventProperties {
    startedAt: number,
	doneAt: number,
    modelUsage: UsageReport
};

export interface AgentNavEventProperies extends CommonEventProperties {
};

// kinda jank
function addUsageToReport(report: UsageReport, usage: ModelUsage) {
    const modelHash = JSON.stringify(usage.llm);
    let exists = false;
    for (const entry of report) {
        const compare = JSON.stringify(usage.llm);
        if (modelHash === compare) {
            // merge with existing usage
            exists = true;
            entry.inputTokens += usage.inputTokens;
            entry.outputTokens += usage.outputTokens;
            entry.numCalls += 1;
        }
    }
    if (!exists) {
        report.push({ ...usage, numCalls: 1 })
    }
}

export function telemetrifyAgent(agent: Agent) {
    // Generate ID here that will be used to represent this agent in all telemetry events
    const agentId = createId();

    agent.events.on('start', async () => {
        await sendTelemetry('agent-start', { agentId }); 
    });

    agent.events.on('stop', async () => {
        await sendTelemetry('agent-stop', { agentId }); 
    });

    agent.events.on('actStarted', async () => {
        const startedAt = Date.now();
        const report: UsageReport = [];
        let actionCount = 0;
        const tokenListener = (usage: ModelUsage) => {
            addUsageToReport(report, usage);
        }
        agent.events.on('tokensUsed', tokenListener);
        const actionListener = () => {
            actionCount++;
        }
        agent.events.on('actionDone', actionListener);

        agent.events.once('actDone', async () => {
            agent.events.removeListener('tokensUsed', tokenListener);
            agent.events.removeListener('actionDone', actionListener);
            const doneAt = Date.now();

            await sendTelemetry('agent-act', {
                agentId,
                startedAt,
                doneAt,
                actionCount,
                modelUsage: report,
            });
        });
    });

    if (agent instanceof BrowserAgent) {
        // Report nav and extract telemetry if browser agent
        agent.browserAgentEvents.on('nav', async () => {
            await sendTelemetry('agent-nav', { agentId }); 
        });

        agent.browserAgentEvents.on('extractStarted', async () => {
            const startedAt = Date.now();
            const report: UsageReport = [];
            const tokenListener = (usage: ModelUsage) => {
                addUsageToReport(report, usage);
            }
            agent.events.on('tokensUsed', tokenListener);

            agent.browserAgentEvents.once('extractDone', async () => {
                agent.events.removeListener('tokensUsed', tokenListener);
                const doneAt = Date.now();

                await sendTelemetry('agent-extract', {
                    agentId,
                    startedAt,
                    doneAt,
                    modelUsage: report,
                });
            });
        });
    }
}