import { Image as BamlImage } from '@boundaryml/baml';
import { StoredMedia } from './serde';
import { Sharp } from 'sharp';
import sharp from 'sharp';

export type ImageMediaType = `image/${string}`;//'png' | 'jpeg';

export class Image {
    /**
     * Wrapper for a Sharp image with conveniences to go to/from base64, convert to BAML, or serialize as JSON
     */
    private img: Sharp;
    // Cached metadata property for sync access + required width/height properties
    //private metadata: Sharp['metadata'] & { width: number, height: number };
    //private content: string;
    //private mediaType: ImageMediaType;

    //constructor(type: 'url' | 'base64', content: string, mediaType: ImageMediaType) {
    constructor(img: Sharp) {
        this.img = img;
    }

    static fromBase64(base64: string) {
        // if (!mediaType) {
        //     const match = base64.match(/^data:(.*?);base64,/);
        //     mediaType = match ? `image/${match[1]}` : undefined;
        // }
        // if (!mediaType) {
        //     throw new Error("Image media type must be specified either in base64 encoded string or in mediaType parameter");
        // }
        const base64Data = base64.replace(/^data:.*?;base64,/, '');
        //return new Image('base64', base64Data, mediaType);
        return new Image(sharp(Buffer.from(base64Data, 'base64')));
    }

    async getFormat(): Promise<keyof sharp.FormatEnum> {
        const format = (await this.img.metadata()).format;
        if (!format) throw new Error("Unable to get image format");
        return format;
    }

    /**
     * Convert the image to a JSON representation
     */
    async toJSON(): Promise<StoredMedia> {
        // if (this.type === 'url') {
        //     return {
        //         type: 'media',
        //         mediaType: this.mediaType,//`image/${this.mediaType}`,
        //         storageType: 'url',
        //         url: this.content
        //     };
        // } else {
        return {
            type: 'media',
            //mediaType: this.mediaType,//`image/${this.mediaType}`,
            format: await this.getFormat(),
            storage: 'base64',
            base64: await this.toBase64()//this.content
        };
        //}
    }

    async toBase64(): Promise<string> {
       const base64data = (await this.img.toBuffer()).toString('base64');
       //console.log("DATA (Image):", base64data.substring(0, 100));
       return base64data;
       //return `data:image/png;base64,${base64data}`;
    }

    async toBaml(): Promise<BamlImage> {
        // if (this.type === 'url') {
        //     return BamlImage.fromUrl(this.content, this.mediaType);
        // }
        // else {//if (this.type === 'base64') {
        //     return BamlImage.fromBase64(this.mediaType, this.content);
        // }
        const format = await this.getFormat();
        const data = await this.toBase64();
        //console.log("FORMAT:", format);
        //console.log("DATA:", data.substring(0, 100));
        return BamlImage.fromBase64(`image/${format}`, data);

    }

    async getDimensions(): Promise<{ width: number, height: number }> {
        const { width, height } = await this.img.metadata();
        if (!width || !height) throw new Error("Unable to get dimensions from image");
        return { width, height };
    }

    async resize(width: number, height: number): Promise<Image> {
        // if (this.type != 'base64') throw new Error("Only base64 images can be resized");
        // const img = sharp(Buffer.from(this.content));
        // const metadata = await img.metadata();
        
        // if (!metadata.width || !metadata.height)

        return new Image(await this.img.resize({
            width: width,
            height: height,
            fit: 'fill', // exact size, no cropping
            kernel: sharp.kernel.lanczos3
        }));

    }
}