import { RebuildableHTMLElement } from "./rebuildableHTMLElement";

export class RebuildableFontAwesomeIcon extends RebuildableHTMLElement {
    typeGetter: () => string | string[];
    constructor(typeGetter: () => string | string[]) {
        super();
        this.typeGetter = typeGetter;
    }
    protected async createElement() {
        const element = document.createElement("i");
        let classes: string | string[] = this.typeGetter();
        if(!(classes instanceof Array)) classes = [classes];
        element.classList.add(...classes.map(v => "fa-" + v));
        return element;
    }
}