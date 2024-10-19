import { DefaultListener, ListenerSignature, TypedEmitter } from "tiny-typed-emitter";

export abstract class RebuildableHTMLElement<T extends ListenerSignature<T> = DefaultListener> extends TypedEmitter<T> {
    private _element: HTMLElement = document.createElement("div");
    private modifiers: Set<(element: HTMLElement) => void> = new Set;

    protected constructor() {
        super();

        queueMicrotask(() => {
            this.update();
        });
    }

    public set element(element: HTMLElement) {
        this._element.replaceWith(element);
        this._element = element;
    }
    public get element() {
        return this._element;
    }

    public async update() {
        this.element = await this.createElement();
    }
    public async addModifier(modifier: (element: HTMLElement) => void) {
        this.modifiers.add(modifier);
    }
    public async removeModifier(modifier: (element: HTMLElement) => void) {
        this.modifiers.delete(modifier);
    }

    protected abstract createElement(): Promise<HTMLElement>;
}