import { ActionIntent } from "@/actions/types";
import { WebAction } from "@/web/types";
import { ActionDescriptor } from "./actions";
import { StepOptions, TestData } from "@/types";

// export function describeAction(planAction: ActionIngredient, webAction: WebAction) {
//     switch (planAction.variant) {
//         case 'click':
//             return `Clicked ${planAction.target} at (${webAction.x}, ${webAction.y})`
//     }
// }

export function describeAction(action: ActionDescriptor) {
    switch (action.variant) {
        case 'load':
            return `Navigated to URL: ${action.url}`;
        case 'click':
            return `Clicked ${action.target} at (${action.x}, ${action.y})`;
        case 'type':
            return `Typed "${action.content}" into ${action.target} at (${action.x}, ${action.y})`;
        case 'scroll':
            return `Scrolled (${action.deltaX}, ${action.deltaY}) at (${action.x}, ${action.y})`;
        default:
            throw Error(`Unhandled action variant in describeAction: ${(action as any).variant}`);
    }
}

export function convertOptionsToTestData(options: StepOptions): TestData {
    if (!options.data) return {};
    if (typeof options.data === 'string') {
        return { other: options.data }
    } else {
        return { data: Object.entries(options.data).map(([k, v]) => ({
            key: k,
            value: v,
            sensitive: false
        }))}
    }
}

export async function retryOnError<T>(
    fnToRetry: () => Promise<T>,
    errorSubstrings: string[],
    retryLimit: number,
    delayMs: number = 200
): Promise<T> {
    let lastError: any;

    if (retryLimit < 0) {
        retryLimit = 0;
    }

    for (let attempt = 0; attempt <= retryLimit; attempt++) {
        try {
            return await fnToRetry();
        } catch (error: any) {
            lastError = error;

            const errorMessage = String(error?.message ?? error);

            const includesSubstring = errorSubstrings.some((substring) => errorMessage.includes(substring));

            if (includesSubstring) {
                if (attempt === retryLimit) {
                    throw lastError;
                }
            } else {
                // Error message does NOT contain the target substring. This error is not retryable.
                throw lastError; // Throw this current error immediately.
            }
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw lastError;
}