import { Contact } from "../contact";
import { ContactList } from "../contactList";
import { ContactElement } from "./contact";
import { RebuildableHTMLElement } from "./rebuildableHTMLElement";

export interface ContactListElementEvents {
    "connect": (contact: Contact) => void;
    "remove": (contact: Contact) => void;
}

export class ContactListElement extends RebuildableHTMLElement<ContactListElementEvents> {
    private contactList: ContactList;
    private contactElements: Map<Contact, ContactElement> = new Map;

    public constructor(contactList: ContactList = null) {
        super();
        this.contactList = contactList;
    }

    public setContactList(contactList: ContactList) {
        this.contactList = contactList;
    }

    protected async createElement() {
        const contactList = document.createElement("ul");
        contactList.classList.add("contacts");
    
        if(this.contactList == null) return contactList;


        for await(const id of this.contactList.contacts.keys()) {
            const contactElement = await this.getContactElement(id);
            contactList.appendChild(contactElement.element);
        }

        return contactList;
    }

    private async getContactElement(id: string) {
        const contact = await this.contactList.getContactById(id);
        let contactElement = this.contactElements.get(contact) as ContactElement;

        if(contactElement == null) {
            contactElement = new ContactElement(contact);
            this.contactElements.set(contact, contactElement);

            this.initContactElement(contact, contactElement);
        }

        return contactElement;
    }

    private initContactElement(contact: Contact, contactElement: ContactElement) {
        contactElement.addListener("connect", async () => {
            this.emit("connect", contact);

            try {
                const connection = await contact.connect();
                connection.addListener("close", () => {
                    contactElement.update();
                });
            } catch(e) {
                console.error(e);
                throw e;
            }
            contactElement.update();
        });
        contactElement.addListener("remove", async () => {
            this.emit("remove", contact);
            await this.contactList.removeContactById(contact.id);

            contactElement.element.remove();
        });
    }
}