import { Action } from '@/actions/types';
import { AgentConnector } from '@/connectors';
import { 
    ModularMemoryContext, 
    BamlThought, 
    BamlTurn, 
    ConnectorState 
} from '@/ai/baml_client';
import { Observation } from './observation';
import { BamlRenderable, observableDataToContext } from './context';



// does this actually need to be distinct or can it be a type of observation?
interface ThoughtEntry {
    variant: 'thought';
    timestamp: number;
    content: string;
}

interface TurnEntry {
    variant: 'turn';
    timestamp: number;
    action: Action;
    observations: Observation[];
}

type StoredHistoryEntry = ThoughtEntry | TurnEntry;

export class AgentMemory {
    private history: StoredHistoryEntry[] = [];

    constructor() { }

    public recordThought(content: string, timestamp?: number): void {
        this.history.push({
            variant: 'thought',
            timestamp: timestamp || Date.now(),
            content
        });
    }

    public recordTurn(action: Action, observations: Observation[], timestamp?: number): void {
        this.history.push({
            variant: 'turn',
            timestamp: timestamp || Date.now(),
            action,
            observations
        });
    }

    // public async getLastScreenshot(): Promise<{ image: string, dimensions: { width: number, height: number } }> {
    //     return { image: "", dimensions: { width: 0, height: 0 } };
    // }

    public getLastThoughtMessage(): string | null {
        for (let i = this.history.length - 1; i >= 0; i--) {
            const entry = this.history[i];
            if (entry.variant === 'thought') {
                return entry.content;
            }
        }
        return null;
    }

    public async buildContext(activeConnectors: AgentConnector[]): Promise<ModularMemoryContext> {
        const processed_history: (BamlThought | BamlTurn)[] = [];

        for (const entry of this.history) {
            const formattedTime = new Date(entry.timestamp).toTimeString().split(' ')[0];

            if (entry.variant === 'thought') {
                processed_history.push({
                    variant: 'thought',
                    timestamp: formattedTime,
                    message: entry.content
                } as BamlThought);
            } else if (entry.variant === 'turn') {
                const renderables: BamlRenderable[] = [];
                for (const observation of entry.observations) {
                    if (observation.source.startsWith('action')) {
                        renderables.push('Result: ');
                    }
                    renderables.push(...observableDataToContext(observation.data));
                    renderables.push('\n'); // newline after each observation
                }
                processed_history.push({
                    variant: 'turn',
                    timestamp: formattedTime,
                    action: JSON.stringify(entry.action),
                    content: renderables
                } as BamlTurn);
            }
        }

        // TODO: doesn't really make sense for memory to be responsible for current state and instruction render logic
        const connector_states_for_context: ConnectorState[] = [];
        const current_timestamp_str = new Date().toTimeString().split(' ')[0];

        for (const connector of activeConnectors) {
            let stateContent: BamlRenderable[] = [];
            let instructions: string | null = null;
            if (connector.viewState) {
                const renderables = observableDataToContext(await connector.viewState());//await connector.renderCurrentStateToBaml();
                if (renderables && renderables.length > 0) {
                    stateContent = renderables;
                    // connector_states_for_context.push({
                    //     connector_id: connector.id,
                    //     content: renderables
                    // });
                }
            }
            if (connector.getInstructions) {
                instructions = await connector.getInstructions() ?? null;
                // if (instructions) {

                // }
            }
            connector_states_for_context.push({
                connector_id: connector.id,
                // content: stateContent,
                // instructions: instructions
                content: stateContent,
                //...(stateContent ? { content: stateContent } : {}),
                ...(instructions ? { instructions: instructions } : {})
            });
        }

        return {
            history: processed_history,
            current_timestamp: current_timestamp_str,
            current_connector_states: connector_states_for_context
        } as ModularMemoryContext;
    }
}
