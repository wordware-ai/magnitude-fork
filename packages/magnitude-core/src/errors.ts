// Agent will only throw these types of errors

import { WebAction } from "./web/types";

// Base class for wrapping errors
class WrapperError extends Error {
    public readonly originalError: Error;

    constructor(message: string, originalError: Error) {
        super(`${message} - ${originalError.message}`);
        this.name = this.constructor.name;
        this.originalError = originalError;

        // Preserve the stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export class NavigationError extends WrapperError {
    public readonly url: string;

    constructor(url: string, originalError: Error) {
        super(`Failed to navigate to URL: ${url}`, originalError);
        this.url = url;
    }
}

export class ActionExecutionError extends WrapperError {
    public readonly action: WebAction;
    public readonly statusCode?: number;

    constructor(action: WebAction, originalError: Error) {
        super(`Browser encountered error while executing action: ${action}`, originalError);
        this.action = action;
    }
}