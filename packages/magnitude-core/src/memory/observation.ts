/**
 * Observations and declarations for what kind of data is "observable" - i.e. can be processed into BAML context or JSON.
 */
import { BamlRenderable, observableDataToContext } from './context';
import { Image } from './image';

// undefined in JSON is either removed if k/v or removed from array, not actually JSON-compatible technically
export type ObservableDataPrimitive = Image | string | number | boolean | null | undefined;

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

type ObservationSource = `connector:${string}` | `action:${string}`;

export class Observation {
    public readonly source: ObservationSource;
    public readonly timestamp: number;
    public readonly data: ObservableData;

    constructor(source: ObservationSource, data: ObservableData) {
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

    async toContext(): Promise<BamlRenderable[]> {
        return await observableDataToContext(this.data);
    }

    getImages(): Image[] {
        const images: Image[] = [];

        const findImagesRecursively = (currentData: ObservableData): void => {
            if (currentData instanceof Image) {
                images.push(currentData);
                return;
            }

            if (Array.isArray(currentData)) {
                for (const item of currentData) {
                    findImagesRecursively(item);
                }
            }
            else if (typeof currentData === 'object' && currentData !== null) {
                for (const value of Object.values(currentData)) {
                    findImagesRecursively(value);
                }
            }
        };

        findImagesRecursively(this.data);
        return images;
    }
}

