/**
 * Convert observations to form that can be passed as BAML context
 */
import { Image as BamlImage } from '@boundaryml/baml';
import { ObservableData, ObservableDataObject, ObservableDataPrimitive } from './observation';
import { Image as CustomImage } from './image'; // Our custom Image class

export type BamlRenderable = BamlImage | string;

// TODO: needs more testing esp. images as boject values sandwiching str + image + str properly
export function observableDataToContext(data: ObservableData): BamlRenderable[] {
    const results: BamlRenderable[] = [];

    function process(currentData: ObservableData) {
        if (currentData instanceof CustomImage) {
            results.push(currentData.toBaml());
        } else if (currentData instanceof BamlImage) { // Handle direct BamlImage from @boundaryml/baml
            results.push(currentData);
        } else if (typeof currentData === 'string') {
            results.push(currentData);
        } else if (typeof currentData === 'number' || typeof currentData === 'boolean') {
            results.push(String(currentData));
        } else if (currentData === null || currentData === undefined) {
            // Ignored: null and undefined do not produce any context parts
        } else if (Array.isArray(currentData)) {
            for (const item of currentData) {
                process(item); // Recursively process each item in the array
            }
        } else if (typeof currentData === 'object' && currentData !== null) {
            // This ensures we are dealing with an ObservableDataObject or a similar structure
            // that is not an array, null, or one of the Image types.
            const objectParts = processObjectInternal(currentData as ObservableDataObject);
            results.push(...objectParts);
        }
        // No explicit fallback needed as ObservableData types should cover all valid inputs.
        // If an unknown type somehow gets here, it will be ignored.
    }

    process(data);
    return results;
}

function processObjectInternal(obj: ObservableDataObject): BamlRenderable[] {
    const objectRenderables: BamlRenderable[] = [];
    const imagePlaceholders = new Map<string, BamlImage>();
    let placeholderIdCounter = 0;

    const replacer = (key: string, value: any): any => {
        if (value instanceof CustomImage) {
            const placeholder = `__IMAGE_PLACEHOLDER_${placeholderIdCounter++}__`;
            imagePlaceholders.set(placeholder, value.toBaml());
            return placeholder; 
        } else if (value instanceof BamlImage) {
            const placeholder = `__IMAGE_PLACEHOLDER_${placeholderIdCounter++}__`;
            imagePlaceholders.set(placeholder, value);
            return placeholder;
        }
        return value;
    };

    const jsonStringWithPlaceholders = JSON.stringify(obj, replacer);

    if (imagePlaceholders.size === 0) {
        // If there are no images, the whole object is just a string
        return [jsonStringWithPlaceholders];
    }
    
    // Sort placeholders by ID to process them in the order they appear in the string
    // This is crucial for correctly reconstructing the string with images in their original positions.
    const sortedPlaceholders = Array.from(imagePlaceholders.entries()).sort((a, b) => {
        const idA = parseInt(a[0].substring("__IMAGE_PLACEHOLDER_".length, a[0].lastIndexOf("__")));
        const idB = parseInt(b[0].substring("__IMAGE_PLACEHOLDER_".length, b[0].lastIndexOf("__")));
        return idA - idB;
    });
    
    let currentIndex = 0;
    for (const [placeholderKey, bamlImageInstance] of sortedPlaceholders) {
        // JSON.stringify will wrap string values (our placeholders) in double quotes.
        const quotedPlaceholder = `"${placeholderKey}"`; 
        const placeholderPos = jsonStringWithPlaceholders.indexOf(quotedPlaceholder, currentIndex);

        if (placeholderPos === -1) {
            // This case should ideally not be reached if placeholders are generated and searched correctly.
            // If it occurs, it might indicate an issue with placeholder generation or the JSON string structure.
            // For robustness, one might log a warning or error here.
            // console.warn(`Placeholder ${quotedPlaceholder} not found in JSON string.`);
            continue; 
        }

        // Add the text part that comes before the current placeholder
        if (placeholderPos > currentIndex) {
            objectRenderables.push(jsonStringWithPlaceholders.substring(currentIndex, placeholderPos));
        }
        
        // Add the BamlImage instance itself
        objectRenderables.push(bamlImageInstance);
        
        // Move the current index past the placeholder (and its quotes) for the next search
        currentIndex = placeholderPos + quotedPlaceholder.length;
    }

    // Add any remaining text part of the JSON string that comes after the last placeholder
    if (currentIndex < jsonStringWithPlaceholders.length) {
        objectRenderables.push(jsonStringWithPlaceholders.substring(currentIndex));
    }
    
    return objectRenderables;
}
