import { WebAction } from "@/web/types";
import { MicroAgent } from "./ai/micro";
import { MacroAgent } from "./ai/macro";
import { chromium } from "playwright";
import { WebHarness } from "./web/harness";
import { TestCase } from "@/types";
import { Ingredient } from "./recipe/types";
import { NavigationError, ActionExecutionError } from "@/errors";
import { CheckIngredient } from "./ai/baml_client";

export interface TestCaseResult {
    passed: boolean
    recipe: Ingredient[]
}

export interface TestCaseAgentConfig {
    // Event listeners
    onActionTaken: (action: WebAction) => void;

    // Browser options

    // Behavior/LLM options
}

const DEFAULT_CONFIG = {
    onActionTaken: () => {}
}

export class TestCaseAgent {
    //private testCase: TestCase;
    private config: TestCaseAgentConfig;
    private macro: MacroAgent;
    private micro: MicroAgent;
    
    constructor (config: Partial<TestCaseAgentConfig> = {}) {
        //this.testCase = testCase;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.macro = new MacroAgent();
        this.micro = new MicroAgent();
    }

    async run(testCase: TestCase): Promise<TestCaseResult> {
        // Setup browser
        // TODO: Set browser options and stuff
        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 }});
        const page = await context.newPage();
        const harness = new WebHarness(page);

        try {
            return await this._run(testCase, harness);
        } finally {
            await browser.close();
        }
    }

    private async _run(testCase: TestCase, harness: WebHarness): Promise<TestCaseResult> {
        try {
            await harness.goto(testCase.url);
        } catch (error) {
            throw new NavigationError(testCase.url, error as Error);
        }

        const recipe = [];

        for (const step of testCase.steps) {
            console.log(`Step: ${step.description}`);

            const stepRecipe = [];

            while (true) {
                const screenshot = await harness.screenshot();
                const { actions, finished } = await this.macro.createPartialRecipe(screenshot, step, stepRecipe);
                console.log('Partial recipe:', actions);
                console.log('Finish expected?', finished);

                // Execute partial recipe
                for (const ingredient of actions) {
                    const screenshot = await harness.screenshot();
                    // TODO: Handle conversion parsing/confidence failures
                    const action = await this.micro.convertAction(screenshot, ingredient);

                    console.log('Action:', action);

                    try {
                        await harness.executeAction(action);
                    } catch (error) {
                        // TODO: retries
                        throw new ActionExecutionError(action, error as Error);
                    }
                    stepRecipe.push(ingredient);
                    // Fixed wait for now
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // If macro expects these actions should complete the step, break
                if (finished) break;
            }

            const stepChecks = [];

            const checkScreenshot = await harness.screenshot();
            for (const check of step.checks) {
                console.log(`Checking: ${check}`)
                
                // Remove implicit context
                // This could be done in a batch for all checks in this step
                const checkNoContext = await this.macro.removeImplicitCheckContext(checkScreenshot, check, stepRecipe);

                console.log('Check without context:', checkNoContext);

                stepChecks.push(checkNoContext);

                // TODO: Utilize check confidence
                const result = await this.micro.evaluateCheck(
                    checkScreenshot,
                    { variant: "check", description: checkNoContext }
                );
                if (!result) {
                    return { passed: false, recipe: recipe };
                }
            }

            // If checks pass, update cached recipe
            for (const ing of stepRecipe) recipe.push(ing);
            for (const check of stepChecks) recipe.push({ "variant": "check", description: check } as CheckIngredient);
        }

        return { passed: true, recipe: recipe };
    }

    
}