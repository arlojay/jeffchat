import { RebuildableHTMLElement } from "./rebuildableHTMLElement";
import { Contact } from "../contact";
import { getClient } from "..";
import { ProfilePictureElement } from "./profilePicture";

export interface ContactElementEvents {
    "connect": () => void;
    "remove": () => void;
}

export class ContactElement extends RebuildableHTMLElement<ContactElementEvents> {
    private contact: Contact;
    private profilePictureElement: ProfilePictureElement;

    public constructor(contact: Contact) {
        super();
        this.contact = contact;
        this.profilePictureElement = new ProfilePictureElement(contact, {
            showIndicator: true
        });
        
        contact.addListener("disconnected", () => {
            this.update();
        });
        contact.addListener("connected", () => {
            this.update();
        });

    }
    protected async createElement() {
        const element = document.createElement("li");

        
        await this.profilePictureElement.update();


        const label = document.createElement("span");
        label.textContent = this.contact.username;
        label.classList.add("username");


        const removeContactButton = document.createElement("button");
        removeContactButton.appendChild(document.createElement("i")).classList.add("fa-solid", "fa-x");
        removeContactButton.addEventListener("click", async () => {
            await getClient().contactList.removeContact(this.contact.address);
            this.emit("remove");
        });
        removeContactButton.classList.add("danger");
        

        element.append(
            removeContactButton,
            this.profilePictureElement.element,
            label
        );
        
        return element;
    }
}