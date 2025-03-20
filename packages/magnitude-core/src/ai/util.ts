import { Screenshot } from "@/web/types";
import sharp from "sharp";

export function extractCoordinates(response: string): { x: number, y: number } | null {
    // Use regex to match the point tag and extract coordinates
    const match = response.match(/<point\s+x="([^"]+)"\s+y="([^"]+)"/i);

    if (match && match.length >= 3) {
        return {
            x: parseFloat(match[1]),
            y: parseFloat(match[2])
        };
    }

    return null;
}

export function relToPixelCoords(
    relX: number,
    relY: number,
    width: number,
    height: number
): { x: number, y: number } {
    const x = Math.round((relX / 100) * width);
    const y = Math.round((relY / 100) * height);

    return { x, y };
}

export async function downscaleScreenshot(screenshot: Screenshot, factor: number): Promise<Screenshot> {
    const buffer = Buffer.from(screenshot.image, 'base64');

    // Get the image metadata to determine original dimensions
    const metadata = await sharp(buffer).metadata();
    const newWidth = Math.floor((metadata.width || 1280) * factor);
    const newHeight = Math.floor((metadata.height || 720) * factor);

    //console.log(`Downscaling image from ${metadata.width}x${metadata.height} to ${newWidth}x${newHeight}`);

    // Resize the image
    const resizedBuffer = await sharp(buffer)
        .resize(newWidth, newHeight)
        .png()
        .toBuffer();

    return {
        image: resizedBuffer.toString('base64'),
        dimensions: {
            width: newWidth,
            height: newHeight
        }
    };
}