import { AgentConnector } from ".";
//import { Observation, BamlRenderable } from "@/memory";
import { WebHarness } from "@/web/harness";
import { ActionDefinition } from '@/actions';
import { agnosticWebActions, coordWebActions, targetWebActions } from '@/actions/webActions';
import { Image as BamlImage } from "@boundaryml/baml";
import { Page, Browser, BrowserContext, BrowserContextOptions } from "playwright";
import { BrowserProvider } from "@/web/browserProvider";
import logger from "@/logger";
import { Logger, P } from 'pino';
import { Screenshot } from "@/web/types";
import { TabState } from '@/web/tabs';
import { ObservableData, Observation } from "@/memory/observation";
import { BamlRenderable } from "@/memory/context";
import { Image } from "@/memory/image";
import { GroundingClient } from "@/ai/types";
import { GroundingService, moondreamTargetingInstructions } from "@/ai/grounding";

export interface BrowserConnectorOptions {
    browser?: Browser
    url?: string
    browserContextOptions?: BrowserContextOptions
    grounding?: GroundingClient
}

export interface BrowserConnectorStateData {
    screenshot: Screenshot;
    tabs: TabState;
}

export class BrowserConnector implements AgentConnector {
    public readonly id: string = "web";
    private harness!: WebHarness;
    private previousState: BrowserConnectorStateData | undefined = undefined;
    private options: BrowserConnectorOptions;
    private browser?: Browser;
    private context!: BrowserContext;
    private logger: Logger;
    private grounding?: GroundingService;

    constructor(options: BrowserConnectorOptions = {}) {
        this.options = options;
        this.logger = logger.child({
            name: `connectors.${this.id}`
        });
        if (this.options.grounding) {
            this.grounding = new GroundingService({ client: this.options.grounding });
        }
    }

    requireGrounding(): GroundingService {
        if (!this.grounding) throw new Error("Grounding not configured on web connector");
        return this.grounding;
    }

    async onStart(): Promise<void> {
        this.logger.info("Starting...");
        let browserInstance = this.options.browser;
        if (!browserInstance) {
            browserInstance = await BrowserProvider.getBrowser();
            this.browser = browserInstance;
            this.logger.info("Using singleton browser provider.");
        }

        const dpr = process.env.DEVICE_PIXEL_RATIO ?
            parseInt(process.env.DEVICE_PIXEL_RATIO) :
            process.platform === 'darwin' ? 2 : 1;
        
        this.logger.info("Creating new browser context.");
        this.context = await browserInstance.newContext({
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: dpr,
            ...this.options.browserContextOptions
        });

        this.harness = new WebHarness(this.context);
        await this.harness.start();
        this.logger.info("WebHarness started.");

        if (this.options.url) {
            this.logger.info(`Navigating to initial URL: ${this.options.url}`);
            await this.harness.goto(this.options.url);
            await this.harness.waitForStability();
        }
        this.logger.info("Started successfully.");
    }

    async onStop(): Promise<void> {
        this.logger.info("Stopping...");
        if (this.context) {
            await this.context.close();
            this.logger.info("Browser context closed.");
        }
        // Note: We don't close this.browser here if obtained from BrowserProvider,
        // as BrowserProvider manages the singleton browser lifecycle.
        // If this.options.browser was provided, its lifecycle is managed externally.
        this.logger.info("Stopped successfully.");
    }

    getActionSpace(): ActionDefinition<any>[] {
        if (this.grounding) {
            // Separate grounding
            return [...targetWebActions, ...agnosticWebActions];
        } else {
            // Planner is grounded
            return [...coordWebActions, ...agnosticWebActions];
        }
    }
    
    // public get page(): Page {
    //     if (!this.harness || !this.harness.page) {
    //         throw new Error("WebInteractionConnector: Harness or Page is not available. Ensure onStart has completed.");
    //     }
    //     return this.harness.page;
    // }

    public getHarness(): WebHarness {
        if (!this.harness) {
            throw new Error("WebInteractionConnector: Harness is not available. Ensure onStart has completed.");
        }
        return this.harness;
    }

    private async captureCurrentState(): Promise<BrowserConnectorStateData> {
        if (!this.harness || !this.harness.page) {
            throw new Error("WebInteractionConnector: Harness or Page is not available for capturing state.");
        }
        const [screenshot, tabs] = await Promise.all([
            this.harness.screenshot(),
            this.harness.retrieveTabState()
        ]);
        return { screenshot, tabs };
    }

    public async getLastScreenshot(): Promise<Screenshot> {
        //return { image: "", dimensions: { width: 0, height: 0 } };
        // TODO: better to use last
        return (await this.captureCurrentState()).screenshot;
    }

    async collectObservations(): Promise<Observation[]> {
        const currentState = await this.captureCurrentState();
        const observations: Observation[] = [];

        if (this.previousState) {
            // TODO: screenshot should use Image class instead
            if (currentState.screenshot?.image !== this.previousState.screenshot?.image) {
                observations.push({
                    source: `connector:${this.id}`,
                    timestamp: Date.now(),
                    data: Image.fromBase64(currentState.screenshot!.image)//, 'image/png')
                });
            }
        } else {
            observations.push({
                source: `connector:${this.id}`,
                timestamp: Date.now(),
                data: Image.fromBase64(currentState.screenshot!.image)//, 'image/png')
            });
        }

        this.previousState = currentState;
        return observations;
    }

    // async renderCurrentStateToBaml(): Promise<BamlRenderable[]> {
    //     const state = await this.captureCurrentState();
    //     const bamlRenderables: BamlRenderable[] = [];

    //     if (state.screenshot?.image) {
    //         bamlRenderables.push(BamlImage.fromBase64('image/png', state.screenshot.image));
    //     }
    //     if (state.tabs) {
    //         const currentTabs = state.tabs;
    //         let tabsString = "Open Tabs:\n";
    //         currentTabs.tabs.forEach((tab, index) => {
    //             tabsString += `${index === currentTabs.activeTab ? '[ACTIVE] ' : ''}${tab.title} (${tab.url})\n`;
    //         });
    //         bamlRenderables.push(tabsString.trim());
    //     }
    //     return bamlRenderables;
    // }

    async viewState(): Promise<ObservableData> {
        const state = await this.captureCurrentState();
        const currentTabs = state.tabs;
        let tabsString = "Open Tabs:\n";
        currentTabs.tabs.forEach((tab, index) => {
            tabsString += `${index === currentTabs.activeTab ? '[ACTIVE] ' : ''}${tab.title} (${tab.url})\n`;
        });
        // return {
        //     screenshot: Image.fromBase64(state.screenshot.image, 'image/png'),
        //     //tabs: tabsString
        //     tabs: currentTabs.tabs.map(
        //         (tab, index) => `Tab ${index}${index === currentTabs.activeTab ? ' [ACTIVE]' : ''}: ${tab.title} (${tab.url})\n`
        //     )
        // };

        const items = [
            Image.fromBase64(state.screenshot.image),//, 'image/png'),
            tabsString
        ]
        return items;
        // return Image.fromBase64(state.screenshot.image, 'image/png');
    }

    async getInstructions(): Promise<void | string> {
        if (this.grounding) {
            return moondreamTargetingInstructions;
        }
    }
}
