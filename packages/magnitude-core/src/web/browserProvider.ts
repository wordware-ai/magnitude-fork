import { Browser, BrowserContext, BrowserContextOptions, chromium, LaunchOptions, Page } from "playwright";

const DEFAULT_BROWSER_OPTIONS: LaunchOptions = {
    headless: false,
    args: ["--disable-gpu", "--disable-blink-features=AutomationControlled"],
};

export class BrowserProvider {
    private browser: Browser | null = null;
    private activeContextsCount: number = 0;
    private launchPromise: Promise<Browser> | null = null;

    private constructor() {}

    public static getInstance(): BrowserProvider {
        if (!(globalThis as any).__magnitude__) {
            (globalThis as any).__magnitude__ = {};
        }

        if (!(globalThis as any).__magnitude__.browserProvider) {
            (globalThis as any).__magnitude__.browserProvider = new BrowserProvider();
        }

        return (globalThis as any).__magnitude__.browserProvider;
    }

    private async _ensureBrowserLaunched(): Promise<Browser> {
        if (this.browser && this.browser.isConnected()) {
            return this.browser;
        }

        if (this.launchPromise) {
            return this.launchPromise;
        }

        this.launchPromise = chromium.launch(DEFAULT_BROWSER_OPTIONS);
        try {
            this.browser = await this.launchPromise;
            this.browser.on('disconnected', () => {
                this.browser = null;
                this.activeContextsCount = 0;
                this.launchPromise = null;
            });
            return this.browser;
        } catch (error) {
            this.launchPromise = null;
            throw error;
        }
    }

    public async newContext(options?: BrowserContextOptions): Promise<BrowserContext> {
        const browser = await this._ensureBrowserLaunched();
        const context = await browser.newContext(options);

        this.activeContextsCount++;

        context.on('close', async () => {
            this.activeContextsCount--;
            if (this.activeContextsCount <= 0 && this.browser && this.browser.isConnected()) {
                await this.browser.close();
                this.browser = null;
                this.launchPromise = null;
            }
        });
        return context;
    }
}