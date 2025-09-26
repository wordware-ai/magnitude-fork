import { Action } from '@/actions/types';
import { ActOptions, Agent } from '@/agent';
import { BrowserAgent } from './browserAgent';
import { z } from 'zod/v3';

export type LogEntry = 
    | { type: 'start'; message: string; timestamp: Date }
    | { type: 'stop'; message: string; timestamp: Date; data: {
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCachedWriteInputTokens: number;
        totalCachedReadInputTokens: number;
        totalInputTokenCost: number;
        totalOutputTokenCost: number;
        numUniqueModels: number;
        modelDescription: string;
    }}
    | { type: 'thought'; message: string; timestamp: Date }
    | { type: 'act'; message: string; timestamp: Date; data: { task: string; options: ActOptions }}
    | { type: 'action'; message: string; timestamp: Date; data: { action: Action; actionDefinition: string }}
    | { type: 'nav'; message: string; timestamp: Date; data: { url: string }}
    | { type: 'extractStarted'; message: string; timestamp: Date; data: { instructions: string; schema: z.ZodSchema }}
    | { type: 'extractDone'; message: string; timestamp: Date; data: { instructions: string; result: any }};

export type LogCallback = (logEntry: LogEntry) => void;


export function narrateAgent(agent: Agent, onLog: LogCallback) {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCachedWriteInputTokens = 0;
    let totalCachedReadInputTokens = 0;
    let totalInputTokenCost = 0.0;
    let totalOutputTokenCost = 0.0;

    agent.events.on('tokensUsed', (usage) => {
        totalInputTokens += usage.inputTokens;
        totalOutputTokens += usage.outputTokens;
        totalCachedWriteInputTokens += usage.cacheWriteInputTokens ?? 0;
        totalCachedReadInputTokens += usage.cacheReadInputTokens ?? 0;
        totalInputTokenCost += usage.inputCost ?? 0.0;
        totalOutputTokenCost += usage.outputCost ?? 0.0;
    });

    agent.events.on('start', () => {
        const message = `agent started with ${agent.models.describe()}`;
        onLog({ type: 'start', message, timestamp: new Date() });
    });

    agent.events.on('stop', () => {
        const message = 'agent stopped';
        const tokenData = {
            totalInputTokens: totalInputTokens + totalCachedWriteInputTokens + totalCachedReadInputTokens,
            totalOutputTokens,
            totalCachedWriteInputTokens,
            totalCachedReadInputTokens,
            totalInputTokenCost,
            totalOutputTokenCost,
            numUniqueModels: agent.models.numUniqueModels,
            modelDescription: agent.models.describe()
        };
        onLog({ type: 'stop', message, data: tokenData, timestamp: new Date() });
    });

    agent.events.on('thought', (thought: string) => {
        onLog({ type: 'thought', message: thought, timestamp: new Date() });
    });

    agent.events.on('actStarted', (task: string, options: ActOptions) => {
        onLog({ type: 'act', message: `act started: ${task}`, data: { task, options }, timestamp: new Date() });
    });

    agent.events.on('actionStarted', (action: Action) => {
        const actionDefinition = agent.identifyAction(action);
        const message = actionDefinition.render(action);
        onLog({ type: 'action', message: `action started: ${message}`, data: { action, actionDefinition: actionDefinition.name }, timestamp: new Date() });
    });
}

export function narrateBrowserAgent(agent: BrowserAgent, onLog: LogCallback) {
    narrateAgent(agent, onLog);

    agent.browserAgentEvents.on('nav', (url: string) => {
        onLog({ type: 'nav', message: `navigating to ${url}`, data: { url }, timestamp: new Date() });
    });

    agent.browserAgentEvents.on('extractStarted', (instructions: string, schema: z.ZodSchema) => {
        onLog({ type: 'extractStarted', message: `extract started: ${instructions}`, data: { instructions, schema }, timestamp: new Date() });
    });

    agent.browserAgentEvents.on('extractDone', (instructions, data) => {
        onLog({ type: 'extractDone', message: `extract completed: ${instructions}`, data: { instructions, result: data }, timestamp: new Date() });
    });
}