import { Contact } from "../contact";
import { ProfilePicture } from "../profilePicture";
import { RebuildableHTMLElement } from "./rebuildableHTMLElement";

export interface ProfilePictureElementEvents {

}

export interface ProfilePictureElementSettings {
    showIndicator?: boolean | null
}

export class ProfilePictureElement extends RebuildableHTMLElement<ProfilePictureElementEvents> {
    contact: Contact;
    showIndicator: boolean;
    hoverText: string | null;

    public constructor(contact: Contact, settings?: ProfilePictureElementSettings | null) {
        super();

        settings ??= {};

        this.contact = contact;
        this.showIndicator = settings.showIndicator ?? false;
    }

    protected async createElement() {
        const container = document.createElement("div");
        container.classList.add("profile-picture");


        const image = document.createElement("img");
        console.log(this.contact);
        image.src = await this.contact.profilePicture.getIconSource(64);

        container.append(image);
        
        if(this.showIndicator) {
            const indicator = document.createElement("div");
            indicator.classList.add("indicator");
            indicator.dataset.indicator = this.contact.isAuthenticated() ? "online" : "offline";

            container.append(indicator);
        }

        return container;
    }
}