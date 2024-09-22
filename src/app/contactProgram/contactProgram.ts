import { Contact } from "../contact";
import { PacketData } from "../secureConnection";

export abstract class ContactProgram {
    protected contact: Contact;
    public constructor(contact: Contact) {
        this.contact = contact;
    }
    async init() {}
    async stop() {}
    async onData(data: PacketData) {}
    async onConnected() { }
    async onDisconnected() { }
}