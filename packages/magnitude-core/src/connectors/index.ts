import { Observation, BamlRenderable } from '@/agent/observationTypes';

import { ActionDefinition } from '@/actions';

export interface AgentConnector {
    // Unique connector ID (required)
    id: string;
    // Event handlers (optional)
    onStart?(): Promise<void>;
    onStop?(): Promise<void>;
    // Action space (optional)
    getActionSpace?(): ActionDefinition<any>[];
    // State retrieval (WIP)
    renderCurrentStateToBaml?(): Promise<BamlRenderable[]>;
    // Observation retrieval (WIP)
    getObservations?(): Promise<Observation[]>;
}
