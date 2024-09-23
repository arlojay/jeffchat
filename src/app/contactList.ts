import { log } from "./index";
import { Address } from "./address";
import { Contact } from "./contact";
import { deobfuscate } from "./obscurify";
import { IndexedDatabase } from "./indexeddb";

export class ContactList {
    contacts: Map<string, Contact>;
    db: IndexedDatabase;

    constructor(db: IndexedDatabase) {
        this.db = db;
        this.contacts = new Map;
    }

    async updateContact(contact: Contact) {
        await this.db.objectStore("contacts").put(await contact.serialize());
    }

    async addContact(contact: Contact) {
        log("checking if contact exists");
        if(this.contacts.has(contact.address.id) || await this.db.objectStore("contacts").has(contact.address.id)) {
            log("updating existing contact");
            return await this.updateContact(contact);
        }

        log("writing new contact");
        this.contacts.set(contact.address.id, contact);
        log("adding object to db");
        const data = await contact.serialize();
        console.log(data);
        await this.db.objectStore("contacts").add(data);
    }
    
    async hasContact(address: Address): Promise<boolean> {
        return await this.hasContactById(address.id);
    }
    async hasContactById(id: string): Promise<boolean> {
        if(this.contacts.has(id)) return true;
        if(await this.db.objectStore("contacts").has(id)) return true;

        return false;
    }
    async getContact(address: Address): Promise<Contact> {
        return await this.getContactById(address.id);
    }
    async getContactById(id: string): Promise<Contact> {
        let contact = this.contacts.get(id);
        if(contact == null) {
            const data = await this.db.objectStore("contacts").get(id);
            if(data == null) return null;

            contact = new Contact;
            await contact.deserialize(data);
    
            this.contacts.set(id, contact);
            await contact.initPrograms();
        }
        
        return contact;
    }


    async createContact(addressKey: JsonWebKey, username: string = "UnknownContact"): Promise<Contact> {
        const contact = new Contact(new Address(addressKey), username);
        log("add contact " + username);
        try {
            await this.addContact(contact);
            log("added contact " + username);
        } catch(e) {
            log("Failed to add contact\n" + (e.stack ?? e.message ?? e));
        }
        await contact.initPrograms();
        return contact;
    }
    async createContactFromDescriptor(descriptor: string): Promise<Contact> {
        let raw: [ object, string ];
        try {
            raw = JSON.parse(await deobfuscate(descriptor));
            if(raw.length != 2) throw new Error("Unbalanced descriptor array");

            if(typeof raw[0] != "object") throw new TypeError("Descriptor array at index 1 is not object");
            if(typeof raw[1] != "string") throw new TypeError("Descriptor array at index 2 is not string");
        } catch(e) {
            console.error(e);
            throw new Error("Malformed descriptor");
        }

        const [ addressKey, username ] = raw;

        return await this.createContact(addressKey, username);
    }
    async removeContact(id: string) {
        this.contacts.delete(id);
        await this.db.objectStore("contacts").delete(id);
    }

    async loadAllContacts() {
        const contactIds = await this.db.objectStore("contacts").getAllKeys() as string[];

        for await(const id of contactIds) {
            await this.getContactById(id);
        }
    }
}