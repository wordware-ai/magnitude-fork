import { Image as BamlImage } from "@boundaryml/baml";

export type BamlRenderable = BamlImage | string;

export interface Observation {
    sourceConnectorId: string;
    renderToBaml: () => BamlRenderable[];
}
