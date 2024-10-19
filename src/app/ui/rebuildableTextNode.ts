import { RebuildableHTMLElement } from "./rebuildableHTMLElement";

export class RebuildableTextNode extends RebuildableHTMLElement {
    textGetter: () => string;
    constructor(textGetter: () => string) {
        super();
        this.textGetter = textGetter;
    }
    protected async createElement() {
        const element = document.createElement("span");
        element.textContent = this.textGetter();
        return element;
    }
}