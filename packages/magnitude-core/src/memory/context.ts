/**
 * Convert observations to form that can be passed as BAML context
 */
import { Image as BamlImage } from '@boundaryml/baml';
import { ObservableData, ObservableDataObject, ObservableDataArray, ObservableDataPrimitive } from './observation';
import { Image } from './image'; // Our custom Image class

export type BamlRenderable = BamlImage | string;

function buildRenderableListRecursive(data: ObservableData, targetList: BamlRenderable[]): void {
    if (data instanceof Image) {
        const bamlImg = data.toBaml();
        if (bamlImg) {
            targetList.push(bamlImg);
        }
        // If toBaml() returns undefined/null, it's intentionally omitted.
        return;
    }
    if (data instanceof BamlImage) {
        targetList.push(data);
        return;
    }
    if (typeof data === 'string') {
        targetList.push(data);
        return;
    }
    if (typeof data === 'number' || typeof data === 'boolean') {
        targetList.push(String(data));
        return;
    }
    if (data === null) {
        targetList.push('null'); // JSON representation of null
        return;
    }
    if (data === undefined) {
        // In JSON, undefined in arrays becomes null. For object properties, the key is omitted.
        // We'll push 'null' if undefined is encountered directly in a structure we're stringifying parts of.
        targetList.push('null'); 
        return;
    }

    if (Array.isArray(data)) {
        targetList.push('[');
        data.forEach((element, index) => {
            buildRenderableListRecursive(element, targetList);
            if (index < data.length - 1) {
                targetList.push(',');
            }
        });
        targetList.push(']');
        return;
    }

    if (typeof data === 'object' && data !== null) { // Plain objects
        targetList.push('{');
        // Filter out entries with undefined values, as JSON.stringify does.
        const entries = Object.entries(data as ObservableDataObject).filter(([, val]) => val !== undefined);
        entries.forEach(([key, value], index) => {
            // Keys in JSON must be strings and are typically quoted.
            // JSON.stringify is safe and standard for keys.
            targetList.push(JSON.stringify(key)); 
            targetList.push(':');
            buildRenderableListRecursive(value, targetList);
            if (index < entries.length - 1) {
                targetList.push(',');
            }
        });
        targetList.push('}');
        return;
    }

    // Fallback for any unhandled types: explicitly mark as unsupported.
    // console.warn(`[BAML CONTEXT] buildRenderableListRecursive: Encountered unhandled data type: ${typeof data}`, data);
    //targetList.push(`[UNSUPPORTED DATA TYPE: ${typeof data}]`);
    throw new Error(`UNSUPPORTED DATA TYPE: ${typeof data}`);
}

export function observableDataToContext(data: ObservableData): BamlRenderable[] {
    const rawList: BamlRenderable[] = [];
    buildRenderableListRecursive(data, rawList);

    // Merge adjacent strings
    if (rawList.length === 0) {
        return [];
    }

    const mergedList: BamlRenderable[] = [];
    let currentString = "";

    for (const item of rawList) {
        if (typeof item === 'string') {
            currentString += item;
        } else { // It's a BamlImage
            if (currentString.length > 0) {
                mergedList.push(currentString);
                currentString = "";
            }
            mergedList.push(item); // Push the BamlImage
        }
    }
    // Add any trailing string
    if (currentString.length > 0) {
        mergedList.push(currentString);
    }
    
    // Final check: if the entire merged list is just one string that looks like a simple primitive
    // that was stringified (e.g. "123", "true", "null") but should have been handled by BAML as such,
    // this might indicate an issue. However, BAML expects (string | image)[], so strings are fine.
    // The main goal is that Image objects become BamlImage objects, and other structures are stringified
    // in a way that BAML can parse if it's expecting complex string content.

    return mergedList;
}
