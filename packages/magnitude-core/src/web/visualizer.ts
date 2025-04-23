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
                    
                    // Create SVG pointer
                    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    svg.setAttribute("width", "20");
                    svg.setAttribute("height", "24");
                    svg.setAttribute("viewBox", "0 0 20 24");
                    
                    // Create the pointer path
                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute("d", "M 0,0 L 16,12 L 9,13 L 11,19 L 7,20 L 5,14 L 0,18 Z");
                    path.setAttribute("fill", "white");
                    path.setAttribute("stroke", "black");
                    path.setAttribute("stroke-width", "1");
                    
                    svg.appendChild(path);
                    pointerElement.appendChild(svg);
                    
                    document.body.appendChild(pointerElement);
                }
                
                // Update position - adjust coordinates so the tip of the pointer is at (x,y)
                pointerElement.style.left = `${x}px`;
                pointerElement.style.top = `${y}px`;
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
