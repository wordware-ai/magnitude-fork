import { Action } from '@/actions/types';
import { ActOptions, Agent } from '@/agent';
import { bold, cyanBright, gray } from 'ansis';

export function narrateAgent(agent: Agent) {
    agent.events.on('thought', (thought: string) => {
        //➤◆ 
        console.log(gray`${thought}`);
        //console.log(gray`⚙︎ ${thought}`);
    });

    agent.events.on('actStarted', (task: string, options: ActOptions) => {
        //➤◆ 
        console.log(bold(cyanBright(`▶ ${task}`)));
    });

    agent.events.on('actionStarted', (action: Action) => {
        const actionDefinition = agent.identifyAction(action);
        console.log(bold`  ${actionDefinition.render(action)}`);
    });
}