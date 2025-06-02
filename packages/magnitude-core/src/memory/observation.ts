/**
 * Observations and declarations for what kind of data is "observable" - i.e. can be processed into BAML context or JSON.
 */
import { fnv1a32Hex } from '@/util';
import { BamlRenderable, observableDataToContext } from './context';
import { Image } from './image';
import { MultiMediaJson, observableDataToJson } from './serde';

// undefined in JSON is either removed if k/v or removed from array, not actually JSON-compatible technically
export type ObservableDataPrimitive = Observation | Image | string | number | boolean | null | undefined;

export type ObservableDataArray = Array<ObservableData>;

export type ObservableDataObject = {
    [key: string]: ObservableData;
};


export type ObservableData = ObservableDataPrimitive | ObservableDataArray | ObservableDataObject;

// export interface Observation {
//     source: `connector:${string}` | `action:${string}`,
//     timestamp: number,
//     data: ObservableData
// }

export interface ObservationOptions {
    type: string;
    limit?: number;
    dedupe?: boolean; // dedupe adjacent identical observations of the same type
}

type ObservationSource = `connector:${string}` | `action:${string}`;

export class Observation {
    public readonly source: ObservationSource;
    public readonly timestamp: number;
    public readonly data: ObservableData;

    constructor(source: ObservationSource, data: ObservableData, options?: ObservationOptions) {
        this.source = source;
        this.data = data;
        this.timestamp = Date.now();
    }

    static fromConnector(connectorId: string, data: ObservableData): Observation {
        return new Observation(`connector:${connectorId}`, data);
    }

    static fromAction(actionId: string, data: ObservableData): Observation {
        return new Observation(`action:${actionId}`, data);
    }

    async toJson(): Promise<MultiMediaJson> {
        return await observableDataToJson(this.data);
    }

    async toContext(): Promise<BamlRenderable[]> {
        return await observableDataToContext(this.data);
    }

    async hash(): Promise<string> {
        // build str of all text+img content
        const stringifiedContent = JSON.stringify(await this.toJson());
        return fnv1a32Hex(stringifiedContent);
    }

    async equals(obs: Observation): Promise<boolean> {
        // TODO: deep eq for both text and img content
        return (await this.hash()) == (await obs.hash());
    }

    // getImages(): Image[] {
    //     const images: Image[] = [];

    //     const findImagesRecursively = (currentData: ObservableData): void => {
    //         if (currentData instanceof Image) {
    //             images.push(currentData);
    //             return;
    //         }

    //         if (Array.isArray(currentData)) {
    //             for (const item of currentData) {
    //                 findImagesRecursively(item);
    //             }
    //         }
    //         else if (typeof currentData === 'object' && currentData !== null) {
    //             for (const value of Object.values(currentData)) {
    //                 findImagesRecursively(value);
    //             }
    //         }
    //     };

    //     findImagesRecursively(this.data);
    //     return images;
    // }
}

