import { Action } from '@/actions/types';
import { ActOptions, Agent } from '@/agent';
import { blueBright, bold, cyanBright, gray } from 'ansis';
import { BrowserAgent } from './browserAgent';
import { z } from 'zod';

export function narrateAgent(agent: Agent) {
    agent.events.on('start', () => {
        console.log(bold(blueBright(`▶ [start] agent started`)));
    });

    agent.events.on('stop', () => {
        console.log(bold(blueBright(`■ [stop] agent stopped`)));
    });

    agent.events.on('thought', (thought: string) => {
        console.log(gray`${thought}`);
        //console.log(gray`⚙︎ ${thought}`);
    });

    agent.events.on('actStarted', (task: string, options: ActOptions) => {
        console.log(bold(cyanBright(`◆ [act] ${task}`)));
    });

    agent.events.on('actionStarted', (action: Action) => {
        const actionDefinition = agent.identifyAction(action);
        console.log(bold`  ${actionDefinition.render(action)}`);
    });
}

export function narrateBrowserAgent(agent: BrowserAgent) {
    narrateAgent(agent);

    agent.browserAgentEvents.on('nav', (url: string) => {
        console.log(bold(cyanBright`⮊ [nav] ${url}`));
    });

    agent.browserAgentEvents.on('extractStarted', (instructions: string, schema: z.ZodSchema) => {
        console.log(bold(cyanBright`⛏ [extract] ${instructions}`));
    });
    agent.browserAgentEvents.on('extractDone', (instructions, data) => {
        // console.log has a decent default formatter for arbitrary data e.g. objects
        console.log(data);
        //console.log(blueBright`${JSON.stringify(data, null, 2)}`);
    });
}