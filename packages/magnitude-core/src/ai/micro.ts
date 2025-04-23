import { ClickWebAction, PixelCoordinate, Screenshot, ScrollWebAction, TypeWebAction, WebAction } from '@/web/types';
import { b } from "@/ai/baml_client/async_client";
import { Collector, Image } from "@boundaryml/baml";
import sharp from 'sharp';
import { downscaleScreenshot } from './util';
import { ActionIngredient, CheckIngredient, ClickIngredient, Ingredient, ScrollIngredient, TypeIngredient } from '@/recipe/types';
import { CheckResult } from './types';
import { BamlAsyncClient } from "./baml_client/async_client";
import logger from "@/logger";
import { Logger } from 'pino';
import { vl as MoondreamClient } from 'moondream';


interface MicroAgentConfig {
    // How much to downscale screenshots sent to LLM
    // A little bit of downscaling can improve accuracy in some cases.
    // More downscaling = less tokens and faster inference.
    downscaling: number
    //parsingRetries: 
    // confidence thresholds, etc. should go here as well
}

const DEFAULT_CONFIG = {
    downscaling: 0.75
}

export class MicroAgent {
    /**
     * Small, fast, vision agent to translate high level web actions to precise, executable actions.
     * Currently only compatible model is Molmo variants because of their ability to point to precise coordinates.
     */
    private config: MicroAgentConfig;
    //private collector: Collector;
    //private baml: BamlAsyncClient;
    private logger: Logger;
    private moondream: MoondreamClient;

    constructor(config: Partial<MicroAgentConfig> = {}) {
        this.config = {...DEFAULT_CONFIG, ...config};
        //this.collector = new Collector("micro");
        //this.baml = b.withOptions({ collector: this.collector });
        this.logger = logger.child({ name: 'magnus.executor' });
        this.moondream = new MoondreamClient({ apiKey: process.env.MOONDREAM_API_KEY });
    }

    private async transformScreenshot (screenshot: Screenshot) {
        if (this.config.downscaling < 1.0) {
            return await downscaleScreenshot(screenshot, this.config.downscaling);
        }
        return screenshot;
    }

    async locateTarget(screenshot: Screenshot, target: string): Promise<PixelCoordinate> {
        const downscaledScreenshot = await this.transformScreenshot(screenshot);
        const start = Date.now();
        // const response = await this.baml.LocateTarget(
        //     Image.fromBase64('image/png', downscaledScreenshot.image),
        //     target
        // );
        //const relCoords = await this.md.point({ object: })
        const result = await this.moondream.point({
            image: { imageUrl: downscaledScreenshot.image },
            object: target
        });
        // Point API can return multiple, which we don't really want. We want one clear target.
        if (result.points.length > 1) {
            logger.warn({ points: result.points }, "Moondream returned multiple points for locateTarget");
            throw new Error(`Moondream returned multiple points ${result.points.length}, target unclear`);
        }
        const relCoords = result.points[0];
        this.logger.trace(`locateTarget took ${Date.now()-start}ms`);

        // Use ORIGINAL screenshot coordinate space (not downscaled)
        return {
            x: relCoords.x * screenshot.dimensions.width,
            y: relCoords.y * screenshot.dimensions.height
        }
    }

    async evaluateCheck(screenshot: Screenshot, check: CheckIngredient): Promise<boolean> {
        // TODO: Make more robust, add logp analysis for confidence
        const downscaledScreenshot = await this.transformScreenshot(screenshot);

        const start = Date.now();
        // const response = await this.baml.EvaluateCheck(
        //     Image.fromBase64('image/png', downscaledScreenshot.image),
        //     check.description
        // );
        const response = await this.moondream.query({
            image: { imageUrl: downscaledScreenshot.image },
            question: `Evaluate whether this holds true, responding with simply Yes or No: ${check.description}`
        });
        this.logger.trace(`evaluateCheck took ${Date.now()-start}ms`);

        //console.log("Check response:", response);

        const answer = (response.answer as string).trim().toLowerCase();

        if (answer === 'yes') {
            return true;
        } else if (answer === 'no') {
            return false;
        } else {
            console.warn(`Recieved invalid response for check: ${response}`);
            return false;
        }
    }

    async convertAction(screenshot: Screenshot, ingredient: ActionIngredient): Promise<WebAction> {
        if ((ingredient as Ingredient).variant === 'check') {
            throw Error('Checks cannot be converted to web actions! Use validateCheck()');
        }
        else if (ingredient.variant === 'click') {
            return await this.convertClick(screenshot, ingredient as ClickIngredient);
        }
        else if (ingredient.variant === 'type') {
            return await this.convertType(screenshot, ingredient as TypeIngredient);
        }
        else if (ingredient.variant === 'scroll') {
            return await this.convertScroll(screenshot, ingredient as ScrollIngredient);
        }

        throw Error(`Unhandled ingredient variant: ${(ingredient as any).variant}`);
    }

    async convertClick(screenshot: Screenshot, click: ClickIngredient): Promise<ClickWebAction> {
        // todo: nondet-detection

        // Convert semantic target to coordinates
        const coords = await this.locateTarget(screenshot, click.target);
        
        return {
            variant: 'click',
            x: coords.x,
            y: coords.y
        }
    }

    async convertType(screenshot: Screenshot, ing: TypeIngredient): Promise<TypeWebAction> {
        // todo: nondet-detection

        // Convert semantic target to coordinates
        const coords = await this.locateTarget(screenshot, ing.target);
        
        return {
            variant: 'type',
            x: coords.x,
            y: coords.y,
            content: ing.content
        };
    }

    async convertScroll(screenshot: Screenshot, ing: ScrollIngredient): Promise<ScrollWebAction> {
        const coords = await this.locateTarget(screenshot, ing.target);
        
        return {
            variant: 'scroll',
            x: coords.x,
            y: coords.y,
            deltaX: ing.deltaX,
            deltaY: ing.deltaY
        };
    }
}