import { Agent } from "@/agent";
import { AgentFacet } from ".";
import { Browser, BrowserContextOptions } from "playwright";
import { WebHarness } from "@/web/harness";
import { BrowserProvider } from "@/web/browserProvider";
import { ActionDefinition } from "@/actions";
import { webActions } from "@/actions/webActions";


export interface WebInteractionFacetOptions {
    browser?: Browser
    url?: string
    browserContextOptions?: BrowserContextOptions
    groundingProvider?: {}
}

//export type AgentFacetState = Record<string, StateComponent>

export interface WebState {
    harness: WebHarness
}

class WebInteractionFacet implements AgentFacet<WebState, {}> {
    private options: WebInteractionFacetOptions;
    private harness!: WebHarness;

    constructor(options: WebInteractionFacetOptions = {}) {
        this.options = options;
    }

    async onStart(): Promise<void> {
        let browser = this.options.browser;
        if (!browser) {
            // If no browser is provided, use the singleton browser provider
            browser = await BrowserProvider.getBrowser();
        }

        //logger.info("Creating browser context");
        const dpr = process.env.DEVICE_PIXEL_RATIO ?
            parseInt(process.env.DEVICE_PIXEL_RATIO) :
            process.platform === 'darwin' ? 2 : 1;
        
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: dpr,
            ...this.options.browserContextOptions
        });

        //const page = await this.context.newPage();
        this.harness = new WebHarness(context);
        await this.harness.start();

        // this.events.emit('start');
        // logger.info("Agent started");

        // if (url) {
        //     // If starting URL is provided, immediately navigate to it
        //     await this.nav(url);
        // }

        // this.memory.inscribeInitialState(
        //     await this.captureState()
        // );
    }

    async onStop(): Promise<void> {
        
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


const example = new Agent<[WebInteractionFacet]>({
    
});

