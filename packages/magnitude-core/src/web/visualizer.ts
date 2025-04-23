import { Page } from "playwright";

export class ActionVisualizer {
    /**
     * Manages the visual indicator for actions on a page
     */
    private page: Page;
    private visualElementId: string = 'action-visual-indicator';

    constructor(page: Page) {
        this.page = page;
    }

    async visualizeAction(x: number, y: number): Promise<void> {
        // Create or update the mouse pointer visual at the specified position
        await this.page.evaluate(
            ({ x, y, id }) => {
                // Check if the visual indicator already exists
                let pointerElement = document.getElementById(id);
                
                // If it doesn't exist, create it with all necessary styling
                if (!pointerElement) {
                    pointerElement = document.createElement('div');
                    pointerElement.id = id;
                    pointerElement.style.position = 'absolute';
                    pointerElement.style.zIndex = '9999';
                    pointerElement.style.pointerEvents = 'none'; // Don't interfere with actual clicks
                    pointerElement.style.transition = 'left 0.3s cubic-bezier(0.25, 0.1, 0.25, 1), top 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)';

                    // Set the innerHTML to the new SVG
                    pointerElement.innerHTML = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   width="32"
   height="32"
   viewBox="0 0 113.50408 99.837555"
   version="1.1"
   id="svg1"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <defs
     id="defs1" />
  <g
     id="layer1"
     transform="translate(-413.10686,-501.19661)">
    <path
       style="fill:#026aa1;fill-opacity:1;stroke:#000000;stroke-width:0;stroke-dasharray:none;stroke-opacity:1"
       d="m 416.1069,504.1966 52.47697,93.83813 8.33253,-57.61019 z"
       id="path14-1" />
    <path
       style="fill:#0384c7;fill-opacity:1;stroke:#000000;stroke-width:0;stroke-dasharray:none;stroke-opacity:1"
       d="m 416.1069,504.1966 60.8095,36.22794 46.69517,-34.75524 z"
       id="path15-8" />
    <path
       style="fill:#0384c7;fill-opacity:0;stroke:#000000;stroke-width:6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1"
       d="m 416.1069,504.19658 52.47698,93.83813 8.33252,-57.61019 46.69517,-34.75521 -107.50467,-1.47273"
       id="path16" />
  </g>
</svg>`;

                    document.body.appendChild(pointerElement);
                }
                
                
                // Update position - adjust coordinates so the tip of the pointer is at (x,y)
                // Set the top-left corner to (x, y) and then translate by (-1px, -4px)
                // to align the pointer tip (approx. at 1.27, 4.17 within the SVG) with (x, y).
                pointerElement.style.left = `${x}px`;
                pointerElement.style.top = `${y}px`;
                pointerElement.style.transform = 'translate(-1px, -3px)';
            },
            { x, y, id: this.visualElementId }
        );
    }

    async removeActionVisuals(): Promise<void> {
        // Remove the visual indicator
        await this.page.evaluate((id) => {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
            }
        }, this.visualElementId);
    }
}
