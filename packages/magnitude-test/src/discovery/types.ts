import { BrowserContextOptions } from "playwright";
import { TestCaseBuilder } from "./testCaseBuilder";
import type { PlannerClient, ExecutorClient } from 'magnitude-core';

export interface TestOptions {
    url?: string;
    name?: string;
}

export type MagnitudeConfig = {
    //apiKey?: string;
    url: string; // base URL used as default, required
    planner?: PlannerClient,
    executor?: ExecutorClient,
    browser?: {
        contextOptions?: BrowserContextOptions
    }
    // executor?: {
    //     moondreamUrl?: string; // defaults to https://api.moondream.ai/v1
    //     moondreamApiKey?: string; // defaults to process.env.MOONDREAM_API_KEY
    // }
}//TestOptions & { apiKey?: string };

export interface TestGroup {
    name: string;
    options?: TestOptions;
}

export interface TestGroupDeclaration {
    (id: string, options: TestOptions, testFn: () => void): void;
    (id: string, testFn: () => void): void;
}

export interface TestDeclaration {
    (id: string, options?: TestOptions): TestCaseBuilder;
    // (id: string, options: TestOptions, testFn: () => Promise<void>): void;
    // (id: string, testFn: () => Promise<void>): void;

    // group(groupName: string, groupOptions: TestOptions, groupFn: () => void): void;

    group: TestGroupDeclaration;

    // Configure global test options
    //config: (options: TestGlobalConfig) => void;
}

export type CategorizedTestCases = Record<string, { ungrouped: TestCaseBuilder[], groups: Record<string, TestCaseBuilder[]>}>;
