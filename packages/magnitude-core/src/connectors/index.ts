import { ActionDefinition } from '@/actions';
import { BamlRenderable } from '@/memory/context';
import { ObservableData, Observation } from '@/memory/observation';

export interface AgentConnector {
    // Unique connector ID (required)
    id: string;
    // Event handlers (optional)
    onStart?(): Promise<void>;
    onStop?(): Promise<void>;
    // Action space (optional)
    getActionSpace?(): ActionDefinition<any>[];
    // State retrieval (WIP)
    //renderCurrentStateToBaml?(): Promise<BamlRenderable[]>;
    viewState?(): Promise<ObservableData>;
    // Observation retrieval (WIP)
    collectObservations?(): Promise<Observation[]>;
}

export { BrowserConnector as WebInteractionConnector } from './browserConnector';
