/**
 * Convert observations to form that can be passed as BAML context
 */
import { Image as BamlImage } from '@boundaryml/baml';
import { ObservableData, ObservableDataObject, ObservableDataArray, ObservableDataPrimitive } from './observation';
import { Image as CustomImage } from './image'; // Our custom Image class

export type BamlRenderable = BamlImage | string;

// TODO: needs more testing esp. images as boject values sandwiching str + image + str properly
export function observableDataToContext(data: ObservableData): BamlRenderable[] {
    const results: BamlRenderable[] = [];

    // This replacer and placeholder logic is used by both object and array processing.
    // It needs access to a local placeholder map and counter for the current processing scope.
    const createReplacer = (imagePlaceholders: Map<string, BamlImage>, placeholderIdCounterObj: { id: number }) => {
        return (key: string, value: any): any => {
            if (value instanceof CustomImage) {
                const bamlImg = value.toBaml();
                if (bamlImg) {
                    const placeholder = `__IMAGE_PLACEHOLDER_${placeholderIdCounterObj.id++}__`;
                    imagePlaceholders.set(placeholder, bamlImg);
                    return placeholder;
                }
                return undefined; // Omit if CustomImage can't be converted
            } else if (value instanceof BamlImage) {
                const placeholder = `__IMAGE_PLACEHOLDER_${placeholderIdCounterObj.id++}__`;
                imagePlaceholders.set(placeholder, value);
                return placeholder;
            }
            return value;
        };
    };

    function process(currentData: ObservableData) {
        if (currentData instanceof CustomImage) {
            const bamlImg = currentData.toBaml();
            if (bamlImg) {
                results.push(bamlImg);
            }
        } else if (currentData instanceof BamlImage) {
            results.push(currentData);
        } else if (typeof currentData === 'string') {
            results.push(currentData);
        } else if (typeof currentData === 'number' || typeof currentData === 'boolean') {
            results.push(String(currentData));
        } else if (currentData === null || currentData === undefined) {
            // Ignored
        } else if (Array.isArray(currentData)) {
            const arrayParts = processArrayInternal(currentData, createReplacer);
            results.push(...arrayParts);
        } else if (typeof currentData === 'object' && currentData !== null) {
            const objectParts = processObjectInternal(currentData as ObservableDataObject, createReplacer);
            results.push(...objectParts);
        }
    }

    process(data);
    return results;
}

function processArrayInternal(
    arr: ObservableDataArray,
    createReplacerFn: (imagePlaceholders: Map<string, BamlImage>, placeholderIdCounterObj: { id: number }) => (key: string, value: any) => any
): BamlRenderable[] {
    const imagePlaceholders = new Map<string, BamlImage>();
    const placeholderIdCounterObj = { id: 0 };
    const replacer = createReplacerFn(imagePlaceholders, placeholderIdCounterObj);

    const jsonStringWithPlaceholders = JSON.stringify(arr, replacer);

    if (imagePlaceholders.size === 0) {
        return [jsonStringWithPlaceholders];
    }
    
    return splitStringByPlaceholders(jsonStringWithPlaceholders, imagePlaceholders);
}


function processObjectInternal(
    obj: ObservableDataObject,
    createReplacerFn: (imagePlaceholders: Map<string, BamlImage>, placeholderIdCounterObj: { id: number }) => (key: string, value: any) => any
): BamlRenderable[] {
    const imagePlaceholders = new Map<string, BamlImage>();
    const placeholderIdCounterObj = { id: 0 };
    const replacer = createReplacerFn(imagePlaceholders, placeholderIdCounterObj);

    const jsonStringWithPlaceholders = JSON.stringify(obj, replacer);

    if (imagePlaceholders.size === 0) {
        return [jsonStringWithPlaceholders];
    }
    
    return splitStringByPlaceholders(jsonStringWithPlaceholders, imagePlaceholders);
}

function splitStringByPlaceholders(jsonStringWithPlaceholders: string, imagePlaceholders: Map<string, BamlImage>): BamlRenderable[] {
    const renderables: BamlRenderable[] = [];
    const sortedPlaceholders = Array.from(imagePlaceholders.entries()).sort((a, b) => {
        const idA = parseInt(a[0].substring("__IMAGE_PLACEHOLDER_".length, a[0].lastIndexOf("__")));
        const idB = parseInt(b[0].substring("__IMAGE_PLACEHOLDER_".length, b[0].lastIndexOf("__")));
        return idA - idB;
    });
    
    let currentIndex = 0;
    for (const [placeholderKey, bamlImageInstance] of sortedPlaceholders) {
        // Placeholders in JSON strings are quoted if they represent string values.
        // If an image is a direct element of an array, its placeholder (a string) will be quoted.
        // If an image is a value of an object key, its placeholder (a string) will also be quoted.
        const quotedPlaceholder = `"${placeholderKey}"`; 
        const placeholderPos = jsonStringWithPlaceholders.indexOf(quotedPlaceholder, currentIndex);

        if (placeholderPos === -1) {
            // This might happen if a placeholder was for a non-string value that JSON.stringify doesn't quote
            // (e.g. if a placeholder somehow ended up as a boolean or number, though our replacer returns strings).
            // Or if the placeholder itself contained quotes, which would break simple indexOf.
            // For now, assume placeholders are simple strings and will be quoted by JSON.stringify.
            // console.warn(`Placeholder ${quotedPlaceholder} not found in JSON string: "${jsonStringWithPlaceholders}" starting from index ${currentIndex}`);
            continue; 
        }

        if (placeholderPos > currentIndex) {
            renderables.push(jsonStringWithPlaceholders.substring(currentIndex, placeholderPos));
        }
        
        renderables.push(bamlImageInstance);
        currentIndex = placeholderPos + quotedPlaceholder.length;
    }

    if (currentIndex < jsonStringWithPlaceholders.length) {
        renderables.push(jsonStringWithPlaceholders.substring(currentIndex));
    }
    
    return renderables;
}
