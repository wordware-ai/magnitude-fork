import { Image as BamlImage } from '@boundaryml/baml';
import { StoredMedia } from './serde';

export type ImageMediaType = `image/${string}`;//'png' | 'jpeg';

export class Image {
    private type: 'url' | 'base64';
    private content: string;
    private mediaType: ImageMediaType;

    constructor(type: 'url' | 'base64', content: string, mediaType: ImageMediaType) {
        this.type = type;
        this.content = content;
        this.mediaType = mediaType;
    }
    /**
     * Create a BamlImage from a URL
     */
    static fromUrl(url: string, mediaType: ImageMediaType) {
        return new Image('url', url, mediaType);
    }
    /**
     * Create a BamlImage from base64 encoded data
     */
    // static fromBase64(base64: string, mediaType?: string) {
    //     const base64Data = base64.replace(/^data:.*?;base64,/, '');
    //     return new Image('base64', base64Data, mediaType);
    // }
    static fromBase64(base64: string, mediaType?: ImageMediaType) {
        if (!mediaType) {
            const match = base64.match(/^data:(.*?);base64,/);
            mediaType = match ? `image/${match[1]}` : undefined;
        }
        if (!mediaType) {
            throw new Error("Image media type must be specified either in base64 encoded string or in mediaType parameter");
        }
        const base64Data = base64.replace(/^data:.*?;base64,/, '');
        return new Image('base64', base64Data, mediaType);
    }

    /**
     * Convert the image to a JSON representation
     */
    toJSON(): StoredMedia {
        if (this.type === 'url') {
            return {
                type: 'media',
                mediaType: this.mediaType,//`image/${this.mediaType}`,
                storageType: 'url',
                url: this.content
            };
        } else {
            return {
                type: 'media',
                mediaType: this.mediaType,//`image/${this.mediaType}`,
                storageType: 'base64',
                base64: this.content
            };
        }
    }

    toBaml(): BamlImage {
        if (this.type === 'url') {
            return BamlImage.fromUrl(this.content, this.mediaType);
        }
        else {//if (this.type === 'base64') {
            return BamlImage.fromBase64(this.mediaType, this.content);
        }

    }
}