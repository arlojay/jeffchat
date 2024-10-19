import { textToBuffer, bufferToHex } from "./bufferUtil";

export type GravatarDefaultIconType = "404" | "mp" | "identicon" | "monsterid" | "wavatar" | "retro" | "robohash" | "blank";
export type GravatarIconRating = "G" | "PG" | "R" | "X";
export interface GravatarIconSettings {
    size?: number | null;
    defaultType?: GravatarDefaultIconType | null;
    rating?: GravatarIconRating | null;
    forceDefault?: boolean | null;
}

export class GravatarIcon {
    hash: string;
    constructor(hash?: string | null) {
        this.hash = hash ?? "";
    }

    public static fromURL(url: string) {
        const parts = new URL(url);

        const hash = parts.pathname.split("/").pop();
        
        return new GravatarIcon(hash);
    }

    public async setFromEmail(email: string) {
        const buffer = await crypto.subtle.digest(
            "SHA-256",
            new Uint8Array(new Uint16Array(textToBuffer(email)))
        );
        this.hash = bufferToHex(buffer);
        return this.hash;
    }

    public createURL(settings: GravatarIconSettings | null) {
        settings ??= {};
        settings.size ??= null;
        settings.defaultType ??= "404";
        settings.forceDefault ??= false;
        settings.rating ??= "G";

        const search = new URLSearchParams;
        if(settings.size != null) search.set("s", settings.size + "");
        search.set("d", settings.defaultType);
        if(settings.forceDefault) search.set("f", "y");
        search.set("r", settings.rating);

        return "https://gravatar.com/avatar/" + this.hash + "?" + search;
    }
}

export function createRobohashIcon(hash: string, set: number = 1) {
    return "https://robohash.org/" + hash + "?set=set" + set;
}