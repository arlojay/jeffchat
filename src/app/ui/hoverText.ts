export class HoverText {
    private container: HTMLElement;
    private element: HTMLElement;

    public constructor(container: HTMLElement) {
        this.container = container;
        this.element = this.createElement();

        this.initHandlers();
    }

    private createElement(): HTMLElement {
        const element = document.createElement("div");
        element.classList.add("hover-text");
        element.hidden = true;

        this.container.append(element);

        return element;
    }

    private initHandlers() {
        this.container.addEventListener("mouseover", e => {
            const target = e.target as HTMLElement;
            
            let parent = target.parentElement;
            while(parent != null && parent != this.container) {
                if("title" in parent.dataset) break;
                parent = parent.parentElement;
            }
        
            if(parent == null || !("title" in parent.dataset)) {
                this.element.hidden = true;
            } else {
                this.element.hidden = false;
                this.element.textContent = parent.dataset.title;

                this.positionHoverText(parent);
            }
        });
    }

    private positionHoverText(hoverElement: HTMLElement) {
        const hoverElementRect = hoverElement.getBoundingClientRect();
        const hoverTextRect = this.element.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();

        const results: ElementOffsetResult[] = new Array;

        for(let x = -1; x <= 1; x++) {
            for(let y = -1; y <= 1; y++) {
                if(x == 0 && y == 0) continue;

                const result = this.testElementOffset(
                    hoverElementRect, hoverTextRect, containerRect,
                    x, y, 12
                );

                results.push(result);
            }
        }

        const insideResults = results.filter(result => result.isInside);
        const outsideResults = results.filter(result => !result.isInside);

        console.log(insideResults, outsideResults);

        let bestResult: ElementOffsetResult;

        if(insideResults.length == 0) {
            bestResult = outsideResults.reduce((p, c) => c.clippingScore < p.clippingScore ? c : p, outsideResults[0]);
        } else {
            bestResult = insideResults.reduce((p, c) => c.distanceFromCenter < p.distanceFromCenter ? c : p, insideResults[0]);
        }

        this.element.style.left = (bestResult.xOffset + hoverElementRect.left) + "px";
        this.element.style.top = (bestResult.yOffset + hoverElementRect.top) + "px";
    }

    private getCenterOffset(elementSize: number, textSize: number, offset: number): number {
        const underflow = elementSize - textSize;
        const center = underflow / 2;
        const offsetUnit = (elementSize + textSize) / 2;

        return center + offsetUnit * offset;
    }

    private testElementOffset(
        hoverElementRect: DOMRect, hoverTextRect: DOMRect, containerRect: DOMRect,
        xOffset: number, yOffset: number, margin: number
    ): ElementOffsetResult {
        xOffset = this.getCenterOffset(hoverElementRect.width, hoverTextRect.width, xOffset) + margin * xOffset;
        yOffset = this.getCenterOffset(hoverElementRect.height, hoverTextRect.height, yOffset) + margin * yOffset;

        const rightClipAmount = (hoverElementRect.right + xOffset) - containerRect.right;
        const leftClipAmount = containerRect.left - (hoverElementRect.left + xOffset);
        const bottomClipAmount = (hoverElementRect.bottom + yOffset) - containerRect.bottom;
        const topClipAmount = containerRect.top - (hoverElementRect.top + yOffset);

        const distanceFromCenter = Math.sqrt(
            Math.pow(xOffset - hoverElementRect.width / 2, 2) +
            Math.pow(yOffset - hoverElementRect.height / 2, 2)
        );

        return {
            isInside: 
                rightClipAmount <= 0
             && leftClipAmount <= 0
             && bottomClipAmount <= 0
             && topClipAmount <= 0,

            clippingScore: Math.sqrt(
                leftClipAmount * leftClipAmount
              + rightClipAmount * rightClipAmount
              + topClipAmount * topClipAmount
              + bottomClipAmount * bottomClipAmount
            ),

            distanceFromCenter,

            leftClipAmount,
            rightClipAmount,
            topClipAmount,
            bottomClipAmount,

            xOffset, yOffset
        };
    }
}

interface ElementOffsetResult {
    isInside: boolean;
    clippingScore: number;

    distanceFromCenter: number;

    leftClipAmount: number;
    rightClipAmount: number;
    topClipAmount: number;
    bottomClipAmount: number;

    xOffset: number;
    yOffset: number;
}