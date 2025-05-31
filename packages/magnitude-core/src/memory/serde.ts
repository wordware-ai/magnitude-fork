/**
 * Utilities for converting multi-media observation data to/from JSON
 */
import { Base64Image } from "@/web/types";
import { ObservableData, ObservableDataObject } from "./observation";
import { Image } from './image';



// JSON primitives for the custom multi-media dialect
// export type StoredMedia = {
//     type: 'media',
//     mediaType: string, // e.g. image/png mime type
//     storageType: 'url',
//     url: string
// } | {
//     type: 'media',
//     mediaType: string,
//     storageType: 'base64',
//     base64: string//Base64Image
// }; // TODO: add file storage type
export type StoredMedia = {
    type: 'media',
    format: string,
    storage: 'base64',
    base64: string
}

export interface StoredPrimitive {
    type: 'primitive',
    //data: string
    content: string | boolean | number
}

type MultiMediaPrimitive = StoredMedia | StoredPrimitive | undefined | null;
type MultiMediaArray = Array<MultiMediaJson>;
export type MultiMediaObject = {
    [key: string]: MultiMediaJson;
};

export type MultiMediaJson = MultiMediaPrimitive | MultiMediaArray | MultiMediaObject;

export async function observableDataToJSON(data: ObservableData): Promise<MultiMediaJson> {
    if (data instanceof Image) {
        return await data.toJSON();//return imageToJson(data);
    }

    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
        return { type: "primitive", content: data };
    }

    if (data === undefined) {
        return undefined; // JSON.stringify will omit keys with this value or handle standalone undefined
    }

    if (data === null) {
        return null;
    }

    if (Array.isArray(data)) {
        // Filter out undefined items first, then map and process the rest.
        return Promise.all(data
            .filter(item => item !== undefined)
            .map(item => observableDataToJSON(item))
        );
    }

    if (typeof data === 'object') { // Known not to be null or array here
        const processedObject: { [key: string]: any } = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const value = (data as ObservableDataObject)[key];
                const processedValue = observableDataToJSON(value);

                // Only add the key to the new object if its processed value is not undefined
                if (processedValue !== undefined) {
                    processedObject[key] = processedValue;
                }
            }
        }
        return processedObject;
    }

    // Fallback for any unexpected data types not covered by ObservableData.
    // Returning undefined is consistent with how unrepresentable values are handled.
    return undefined;
}

// TODO: Implement deserialization, and actually leverage serde for logging stuff
