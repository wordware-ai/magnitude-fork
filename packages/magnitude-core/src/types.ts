import { Ingredient } from "./recipe/types";

export interface TestDataEntry {
    key: string;
    value: string;
    sensitive: boolean;
}

export interface TestData {
    data?: TestDataEntry[];
    other?: string;
}

export interface TestStep {
    description: string;
    checks: string[];
    testData: TestData;
}

// Definition of a test case
export interface TestCase {
    url: string,
    steps: TestStep[],
    // Existing recipe to use if cached
    recipe?: Ingredient[]
}
