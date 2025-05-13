import { Browser, chromium, LaunchOptions } from "playwright";

const DEFAULT_BROWSER_OPTIONS: LaunchOptions = {
    headless: false,
    args: ["--disable-gpu"],
};

export class BrowserProvider {
    /**
     * Singleton provider of browser for when agents are created without a browser specified.
     * This way if multiple agents are created, they can still share the same browser instance.
     * If a browser is specified to the agent, it will be used instead of the singleton.
     */
    private browser: Browser | null = null;

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

    public static async getBrowser(): Promise<Browser> {
        const provider = BrowserProvider.getInstance();

        if (!provider.browser) {
            provider.browser = await chromium.launch(DEFAULT_BROWSER_OPTIONS);
        }
        return provider.browser;
    }
}