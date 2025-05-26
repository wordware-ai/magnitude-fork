import { Agent } from "@/agent"; // May not be needed here anymore
import { AgentFacet } from ".";
import { Browser, BrowserContext, BrowserContextOptions, Page } from "playwright";
import { WebHarness } from "@/web/harness";
import { BrowserProvider } from "@/web/browserProvider";
import logger from "@/logger"; // For logging
import { ActionDefinition } from "@/actions";
import { webActions } from "@/actions/webActions";


export interface WebInteractionFacetOptions { // Already exported
    browser?: Browser
    url?: string
    browserContextOptions?: BrowserContextOptions
    groundingProvider?: {}
}

//export type AgentFacetState = Record<string, StateComponent>

export interface WebState {
    harness: WebHarness;
    // Potentially expose page or context if needed directly, though harness is preferred
}

export class WebInteractionFacet implements AgentFacet<WebState, {}, WebInteractionFacetOptions> { // Add export
    private options: WebInteractionFacetOptions;
    private context!: BrowserContext;
    private harness!: WebHarness;

    constructor(options: WebInteractionFacetOptions = {}) {
        this.options = options;
    }

    async onStart(): Promise<void> {
        logger.info("WebInteractionFacet: Starting...");
        let browser = this.options.browser;
        if (!browser) {
            browser = await BrowserProvider.getBrowser();
            logger.info("WebInteractionFacet: Using singleton browser provider.");
        }

        const dpr = process.env.DEVICE_PIXEL_RATIO ?
            parseInt(process.env.DEVICE_PIXEL_RATIO) :
            process.platform === 'darwin' ? 2 : 1;
        
        logger.info("WebInteractionFacet: Creating new browser context.");
        this.context = await browser.newContext({
            viewport: { width: 1280, height: 720 }, // Consider making viewport configurable via options
            deviceScaleFactor: dpr,
            ...this.options.browserContextOptions
        });

        this.harness = new WebHarness(this.context);
        await this.harness.start();
        logger.info("WebInteractionFacet: WebHarness started.");

        if (this.options.url) {
            logger.info(`WebInteractionFacet: Navigating to initial URL: ${this.options.url}`);
            await this.nav(this.options.url);
        }
        logger.info("WebInteractionFacet: Started successfully.");
    }

    async onStop(): Promise<void> {
        logger.info("WebInteractionFacet: Stopping...");
        if (this.harness) {
            // Harness might have its own stop logic, e.g. closing pages
            // await this.harness.stop(); // If harness has a stop method
        }
        if (this.context) {
            await this.context.close();
            logger.info("WebInteractionFacet: Browser context closed.");
        }
        logger.info("WebInteractionFacet: Stopped successfully.");
    }

    public async nav(url: string): Promise<void> {
        if (!this.harness) {
            throw new Error("WebInteractionFacet not started or harness not available.");
        }
        logger.info(`WebInteractionFacet: Navigating to ${url}`);
        await this.harness.goto(url);
        await this.harness.waitForStability(); // Assuming harness has this
    }

    // Expose page for direct access if absolutely necessary, prefer harness methods
    public get page(): Page {
        if (!this.harness) {
            throw new Error("WebInteractionFacet not started or harness not available.");
        }
        return this.harness.page;
    }

    getState() {
        // this doesnt seem like a good thing to ret, should be k/vs and generic typed
        return {
            harness: this.harness
        };//[this.harness];
    }

    getMemory() {
        return {};
    }

    getActionSpace() {
        return [...webActions];
    }
}


// const example = new Agent<[WebInteractionFacet]>({ // TODO: This will need options now
    
// });
