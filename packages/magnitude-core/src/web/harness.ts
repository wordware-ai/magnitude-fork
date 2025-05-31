import { Page, Browser, BrowserContext, PageScreenshotOptions } from "playwright";
import { ClickWebAction, ScrollWebAction, SwitchTabWebAction, TypeWebAction, WebAction } from '@/web/types';
import { PageStabilityAnalyzer } from "./stability";
import { parseTypeContent } from "./util";
import { ActionVisualizer } from "./visualizer";
import logger from "@/logger";
import { TabManager, TabState } from "./tabs";
import { DOMTransformer } from "./transformer";
import { Image } from '@/memory/image';
//import { StateComponent } from "@/facets";


export interface WebHarnessOptions {
    // Some LLM operate best on certain screen dims
    virtualScreenDimensions?: { width: number, height: number }
}

export class WebHarness { // implements StateComponent
    /**
     * Executes web actions on a page
     * Not responsible for browser lifecycle
     */
    public readonly context: BrowserContext;
    private options: WebHarnessOptions;
    private stability: PageStabilityAnalyzer;
    public readonly visualizer: ActionVisualizer;
    private transformer: DOMTransformer;
    private tabs: TabManager;

    constructor(context: BrowserContext, options: WebHarnessOptions = {}) {
        //this.page = page;
        this.context = context;
        this.options = options;
        this.stability = new PageStabilityAnalyzer();
        this.visualizer = new ActionVisualizer();
        this.transformer = new DOMTransformer();
        this.tabs = new TabManager(context);

        // this.context.on('page', (page: Page) => {
        //     this.setActivePage(page);
        //     //logger.info('ayo we got a new page');
        // });
        this.tabs.events.on('tabChanged', async (page: Page) => {
            this.stability.setActivePage(page);
            this.visualizer.setActivePage(page);
            this.transformer.setActivePage(page);
            // need to wait for page to load before evaluating a script
            //page.on('load', () => { this.transformer.setActivePage(page); });
            
            //console.log('tabs:', await this.tabs.getState())

        });
    }

    async retrieveTabState(): Promise<TabState> {
        return this.tabs.retrieveState();
    }

    // setActivePage(page: Page) {
    //     this.page = page;
    //     this.stability.setActivePage(this.page);
    //     this.visualizer.setActivePage(this.page);
    // }

    async start() {
        await this.context.newPage();
    }

    get page() {
        return this.tabs.getActivePage();
    }

    async screenshot(options: PageScreenshotOptions = {}): Promise<Image> {
        /**
         * Get b64 encoded string of screenshot (PNG) with screen dimensions
         */
        //const viewportSize = this.page.viewportSize();
        const buffer = await this.page.screenshot({ type: 'png', ...options }, );

        // if (!viewportSize) {
        //     throw Error("Invalid viewport for screenshot");
        // }

        const base64data = buffer.toString('base64');

        //console.log("Screenshot DATA:", base64data.substring(0, 100));
        return Image.fromBase64(base64data);

        // return {
        //     image: `data:image/png;base64,${base64data}`,//buffer.toString('base64'),
        //     dimensions: {
        //         width: viewportSize.width,
        //         height: viewportSize.height
        //     }
        // };
    }
 
    async goto(url: string) {
        // No need to redraw here anymore, the 'load' event listener handles it
        await this.page.goto(url);
    }

    async _type(content: string) {
        /** Util for typing + keypresses */
        const chunks = parseTypeContent(content);

        // Total typing period to make typing more natural, in ms
        const totalTextDelay = 500;

        let totalTextLength = 0
        for (const chunk of chunks) {
            if (chunk != '<enter>' && chunk != '<tab>') {
                totalTextLength += chunk.length;
            }
        }

        for (const chunk of chunks) {
            if (chunk == '<enter>') {
                await this.page.keyboard.press('Enter');
            } else if (chunk == '<tab>') {
                await this.page.keyboard.press('Tab')
            } else {
                const chunkProportion = chunk.length / totalTextLength;
                const chunkDelay = totalTextDelay * chunkProportion;
                const chunkCharDelay = chunkDelay / chunk.length;
                await this.page.keyboard.type(chunk, {delay: chunkCharDelay});
            }
        }
    }

    // safer might be Coordinate interface/obj tied to certain screen space dims
    transformCoordinates({ x, y }: { x: number, y: number }): { x: number, y: number } {
        const virtual = this.options.virtualScreenDimensions;
        if (!virtual) {
            return { x, y };
        }
        const vp = this.page.viewportSize();
        if (!vp) throw new Error("Could not get viewport dimensions to transform coordinates");
        return {
            x: x * (vp.width / virtual.width),
            y: y * (vp.height / virtual.height),
        };
    }

    async click({ x, y }: { x: number, y: number }) {
        ({ x, y } = this.transformCoordinates({ x, y }));
        // console.log("x:", x);
        // console.log("y:", y);
        await this.visualizer.visualizeAction(x, y);
        this.page.mouse.click(x, y);
        await this.waitForStability();
        //await this.visualizer.removeActionVisuals();
    }

    async type({ content }: { content: string }) {
        await this._type(content);
        await this.waitForStability();
    }

    async clickAndType({ x, y, content }: { x: number, y: number, content: string }) {
        await this.visualizer.visualizeAction(x, y);
        await this.page.mouse.click(x, y);
        await this._type(content);
        await this.waitForStability();
    }
    
    async scroll({ x, y, deltaX, deltaY }: { x: number, y: number, deltaX: number, deltaY: number }) {
        ({ x, y } = this.transformCoordinates({ x, y }));
        await this.visualizer.visualizeAction(x, y);
        await this.page.mouse.move(x, y);
        await this.page.mouse.wheel(deltaX, deltaY);
        await this.waitForStability();
    }

    async switchTab({ index }: { index: number }) {
        await this.tabs.switchTab(index);
        await this.waitForStability();
    }

    async executeAction(action: WebAction) {
        if (action.variant === 'click') {
            await this.click(action);
        } else if (action.variant === 'type') {
            await this.clickAndType(action);
        } else if (action.variant === 'scroll') {
            await this.scroll(action);
        } else if (action.variant === 'tab') {
            await this.switchTab(action);
        } else {
            throw Error(`Unhandled web action variant: ${(action as any).variant}`);
        }
        //await this.stability.waitForStability();
        //await this.visualizer.redrawLastPosition();
    }

    async waitForStability(timeout?: number): Promise<void> {
        await this.stability.waitForStability(timeout);
    }

    // async applyTransformations() {
    //     const start = Date.now();
    //     await this.transformer.applyTransformations();
    //     logger.trace(`DOM transformations took ${Date.now() - start}ms`);
    // }

    // async waitForStability(timeout?: number): Promise<void> {
    //     await this.stability.waitForStability(timeout);
    // }
}
