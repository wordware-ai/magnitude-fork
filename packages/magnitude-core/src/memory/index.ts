import { Action } from '@/actions/types';
import { AgentConnector } from '@/connectors';
import { 
    ModularMemoryContext, 
    // BamlThought, 
    // BamlTurn, 
    ConnectorInstructions 
} from '@/ai/baml_client';
import { Observation, renderObservations } from './observation';
import { BamlRenderable, observableDataToContext } from './context';
import z from 'zod';


// export const memoryOptionsSchema = z.object({
//     trimming: z.object({
//         images: z.object({
//             dedupeAdjacent: z.boolean().default(true),
//             limit: z.number().int().default(3)
//         })
//     })
// });
// export type MemoryOptions = z.infer<typeof memoryOptionsSchema>;

export interface MemoryOptions {
    // TODO: more general filtering config
    dedupeAdjacentImages?: boolean
    imageLimit?: number
    // trimming?: {
    //     images?: {
    //         dedupeAdjacent?: boolean,
    //         limit?: number
    //     }
    // }
}

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
    private options: Required<MemoryOptions>;
    //private history: StoredHistoryEntry[] = [];

    private observations: Observation[] = [];

    constructor(options: MemoryOptions = {}) {
        // TODO: impl
        this.options = {
            dedupeAdjacentImages: options.dedupeAdjacentImages ?? true,
            imageLimit: options.imageLimit ?? 3
        };
    }

    public recordThought(content: string, timestamp?: number): void {
        this.observations.push(
            Observation.fromThought(content)
        )
        // this.history.push({
        //     variant: 'thought',
        //     timestamp: timestamp || Date.now(),
        //     content
        // });
    }

    public recordTurn(actionId: string, action: Action, observations: Observation[]): void {
        // TODO: this and its usage could be cleaner now with obs refac
        this.observations.push(
            Observation.fromActionTaken(actionId, JSON.stringify(action)) // show actions taken as JSON string
        );
        for (const obs of observations) {
            this.observations.push(obs);
        }
        // this.history.push({
        //     variant: 'turn',
        //     timestamp: timestamp || Date.now(),
        //     action,
        //     observations
        // });
    }

    public recordObservation(obs: Observation): void {
        this.observations.push(obs);
    }

    // public async getLastScreenshot(): Promise<{ image: string, dimensions: { width: number, height: number } }> {
    //     return { image: "", dimensions: { width: 0, height: 0 } };
    // }

    public getLastThoughtMessage(): string | null {
        for (let i = this.observations.length - 1; i >= 0; i--) {
            const obs = this.observations[i];
            if (obs.source.startsWith('thought')) return obs.toString();
            // if (entry.variant === 'thought') {
            //     return entry.content;
            // }
        }
        return null;
    }

    public async buildContext(activeConnectors: AgentConnector[]): Promise<ModularMemoryContext> {
        // const historyObservations = this.history.filter(e => e.variant === 'turn').flatMap(e => e.observations);
        // //const stateObservations = activeConnectors.flatMap(c => c.collectObservations())
        // let stateObservations: Observation[] = [];
        // for (const connector of activeConnectors) {
        //     const observations = connector.collectObservations ? await connector.collectObservations() : [];
        //     stateObservations = [...stateObservations, ...observations];
        // }


        // const processedHistory: (BamlThought | BamlTurn)[] = [];

        // for (const entry of this.history) {
        //     const formattedTime = new Date(entry.timestamp).toTimeString().split(' ')[0];

        //     if (entry.variant === 'thought') {
        //         processedHistory.push({
        //             variant: 'thought',
        //             timestamp: formattedTime,
        //             message: entry.content
        //         } as BamlThought);
        //     } else if (entry.variant === 'turn') {
        //         const renderables: BamlRenderable[] = [];
        //         for (const observation of entry.observations) {
        //             if (observation.source.startsWith('action')) {
        //                 renderables.push('Result: ');
        //             }
        //             renderables.push(...(await observation.toContext()))
        //             //renderables.push(...(await observableDataToContext(observation.data)));
        //             renderables.push('\n'); // newline after each observation
        //         }
        //         processedHistory.push({
        //             variant: 'turn',
        //             timestamp: formattedTime,
        //             action: JSON.stringify(entry.action),
        //             content: renderables
        //         } as BamlTurn);
        //     }
        // }

        const content = await renderObservations(this.observations);

        // TODO: doesn't really make sense for memory to be responsible for current state and instruction render logic
        const connectorInstructions: ConnectorInstructions[] = [];

        for (const connector of activeConnectors) {
            let stateContent: BamlRenderable[] = [];
            //let instructions: string | null = null;
            // if (connector.viewState) {
            //     const renderables = await (await connector.viewState()).toContext();
            //     if (renderables && renderables.length > 0) {
            //         stateContent = renderables;
            //     }
            // }
            if (connector.getInstructions) {
                const instructions = await connector.getInstructions();

                if (instructions) {
                    connectorInstructions.push({
                        connectorId: connector.id,
                        instructions: instructions
                    });
                }
            }

            // if (instr)
            // connector_states_for_context.push({
            //     connector_id: connector.id,
            //     // content: stateContent,
            //     // instructions: instructions
            //     //content: stateContent,
            //     //...(stateContent ? { content: stateContent } : {}),
            //     ...(instructions ? { instructions: instructions } : {})
            // });
        }

        return {
            observationContent: content,//processedHistory,
            //currentTimestamp: new Date().toTimeString().split(' ')[0],
            connectorInstructions: connectorInstructions
        } as ModularMemoryContext;
    }
}
