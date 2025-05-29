/**
 * Observations and declarations for what kind of data is "observable" - i.e. can be processed into BAML context or JSON.
 */
import { Image } from './image';

// undefined in JSON is either removed if k/v or removed from array, not actually JSON-compatible technically
export type ObservableDataPrimitive = Image | string | number | boolean | null | undefined;

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

