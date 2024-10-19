import { RebuildableHTMLElement } from "./rebuildableHTMLElement";
import { Contact } from "../contact";
import { ProfilePictureElement } from "./profilePicture";

export class ProfileCard extends RebuildableHTMLElement {
    private contact: Contact;
    private profilePicture: ProfilePictureElement;

    constructor(contact: Contact) {
        super();
        this.contact = contact;
        this.profilePicture = new ProfilePictureElement(this.contact, {
            showIndicator: false
        });
    }
    protected async createElement() {
        const element = document.createElement("div");
        element.classList.add("profile-card");

        await this.profilePicture.update();

        const username = document.createElement("span");
        username.classList.add("username");
        username.textContent = this.contact.username;

        const id = document.createElement("span");
        id.classList.add("id");
        id.textContent = this.contact.id;


        element.append(this.profilePicture.element, username, id);

        return element;
    }
}