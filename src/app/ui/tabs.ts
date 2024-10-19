import { RebuildableHTMLElement } from "./rebuildableHTMLElement";

export function showContentTab(contentTab: HTMLElement | RebuildableHTMLElement) {
    const content = document.querySelector("#content");

    for(const otherContentTab of content.querySelectorAll(".content-tab") as NodeListOf<HTMLDivElement>) {
        otherContentTab.hidden = true;
    }

    if(contentTab instanceof HTMLElement) {
        contentTab.hidden = false;
        content.appendChild(contentTab);
    }
    if(contentTab instanceof RebuildableHTMLElement) {
        contentTab.element.hidden = false;
        content.appendChild(contentTab.element);
    }
}

export interface SidebarTabEvents {
    "click": () => void;
}

export interface SidebarTabSettings {
    contents: RebuildableHTMLElement | (() => HTMLElement) | HTMLElement | string,
    hoverText?: string | null;
}

export class SidebarTab extends RebuildableHTMLElement<SidebarTabEvents> {
    private contentGetter: () => Promise<HTMLElement>;
    private hoverText: string | null;

    constructor(settings: SidebarTabSettings) {
        super();

        this.createContentGetter(settings);
        this.hoverText = settings.hoverText ?? null;
    }

    private createContentGetter(settings: SidebarTabSettings) {
        if(settings.contents instanceof RebuildableHTMLElement) {
            const contents = settings.contents as RebuildableHTMLElement;

            this.contentGetter = async () => {
                await contents.update();
                return contents.element;
            };
        }
        if(settings.contents instanceof Function) {
            const contents = settings.contents as Function;

            this.contentGetter = async () => contents();
        }
        if(settings.contents instanceof HTMLElement) {
            const contents = settings.contents as HTMLElement;

            this.contentGetter = async () => contents;
        }
        if(typeof settings.contents == "string") {
            const contents = settings.contents as string;

            this.contentGetter = async () => {
                const element = document.createElement("span");
                element.textContent = contents;

                return element;
            }
        }
    }

    protected async createElement() {
        const element = document.createElement("div");
        element.classList.add("sidebar-option");
    
        document.querySelector("#sidebar").appendChild(element);
        element.addEventListener("click", () => {
            this.emit("click");
        });

        if(this.hoverText != null) {
            element.dataset.title = this.hoverText;
        }

        element.append(await this.contentGetter());
    
        return element;
    }

    public remove() {
        this.element.remove();
    }
}