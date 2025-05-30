import { ClickWebAction, PixelCoordinate, Screenshot, ScrollWebAction, TypeWebAction, WebAction } from '@/web/types';
import { ActionIntent, CheckIntent, ClickIntent, Intent, ScrollIntent, TypeIntent } from '@/actions/types';
import logger from "@/logger";
import { Logger } from 'pino';
import { vl as MoondreamClient } from 'moondream';
import { GroundingClient } from './types';
import { retryOnError } from '@/common/util';


interface GroundingServiceConfig {
    // only supported executor client rn is moondream
    client?: GroundingClient;
}

// TODO: if provider moondream, have default options e.g.
// executor: {
//     provider: 'moondream',
//     options: {
//         apiKey: process.env.MOONDREAM_API_KEY || "YOUR_MOONDREAM_API_KEY"
//     }
// } as GroundingClient,

const DEFAULT_CLIENT: GroundingClient = {
    provider: 'moondream',
    options: {
        baseUrl: "https://api.moondream.ai/v1",
        apiKey: process.env.MOONDREAM_API_KEY
    }
}

export interface GroundingServiceInfo {
    provider: string,
    numCalls: number
}

export class GroundingService {
    /**
     * Small, fast, vision agent to translate high level web actions to precise, executable actions.
     * Uses Moondream for pixel precision pointing.
     */
    private config: Required<GroundingServiceConfig>;
    private info: GroundingServiceInfo;
    private logger: Logger;
    private moondream: MoondreamClient;

    constructor(config: GroundingServiceConfig) {
        //const clientOptions = { ...DEFAULT_CLIENT_OPTIONS, ...config.client };
        const clientOptions = { ...DEFAULT_CLIENT.options, ...(config.client?.options ?? {}) };
        const client = { ...DEFAULT_CLIENT, ...(config.client ?? {}), options: clientOptions };
        this.config = {...config, client: client };
        this.info = { provider: 'moondream', numCalls: 0 };
        this.logger = logger.child({ name: 'agent.grounding' });
        this.moondream = new MoondreamClient({ apiKey: this.config.client.options.apiKey, endpoint: this.config.client.options.baseUrl });
    }

    getInfo(): GroundingServiceInfo {
        return this.info;
    }

    async locateTarget(screenshot: Screenshot, target: string): Promise<PixelCoordinate> {
        return await retryOnError(
            async () => this._locateTarget(screenshot, target),
            ['429', '503', '524'], 20, 1000
        );
    }

    async _locateTarget(screenshot: Screenshot, target: string): Promise<PixelCoordinate> {
        const start = Date.now();

        const response = await this.moondream.point({
            image: { imageUrl: screenshot.image },
            object: target
        });
        this.info.numCalls++;
        // Point API can return multiple, which we don't really want. We want one clear target.
        // todo: actually handle these errors appropriately in caller
        if (response.points.length > 1) {
            logger.warn({ points: response.points }, "Moondream returned multiple points for locateTarget");
            throw new Error(`Moondream returned multiple points (${response.points.length}), target '${target}' unclear`);
        }
        if (response.points.length === 0) {
            logger.warn("Moondream returned no points");
            throw new Error(`Moondream returned no points, target unclear`);
        }
        const relCoords = response.points[0];
        this.logger.trace(`locateTarget took ${Date.now()-start}ms`);

        // Use ORIGINAL screenshot coordinate space (not downscaled)
        return {
            x: relCoords.x * screenshot.dimensions.width,
            y: relCoords.y * screenshot.dimensions.height
        }
    }
}