export interface Screenshot {
    // b64-encoded PNG image
    image: string,
    dimensions: {
        width: number,
        height: number
    }
}

// export interface WebAction {
//     variant: ActionVariant
// }

export type WebAction = ClickAction | TypeAction;

export interface ClickAction {
    variant: 'click'
    x: number
    y: number
}

export interface TypeAction {
    variant: 'type'
    x: number
    y: number
    content: string
}

// export type ActionVariant = 'click' | 'type';


export interface PixelCoordinate {
    x: number,
    y: number
}
