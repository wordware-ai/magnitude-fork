/**
 * Observations and declarations for what kind of data is "observable" - i.e. can be processed into BAML context or JSON.
 */
import { Base64Image } from '@/web/types';
import { Image } from './image';
//import { Image } from '@boundaryml/baml';

// export type BamlRenderable = BamlImage | string;

// export interface Observation {
//     sourceConnectorId: string;
//     renderToBaml: () => BamlRenderable[];
// }


// undefined in JSON is either removed if k/v or removed from array, not actually JSON-compatible technically
export type ObservableDataPrimitive = Image | string | number | boolean | null | undefined;
// for now, use BAML Image - but consider a custom implementation with a toBaml() for more control

export type ObservableDataArray = Array<ObservableData>;

export type ObservableDataObject = {
    [key: string]: ObservableData;
};


export type ObservableData = ObservableDataPrimitive | ObservableDataArray | ObservableDataObject;

export interface Observation {
    source: `connector:${string}` | `action:${string}`,
    timestamp: number,
    data: ObservableData
}

