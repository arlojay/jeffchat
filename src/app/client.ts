import { log } from "./index";
import { ClientSocket } from "./clientSocket";
import { ContactList } from "./contactList";
import { addObject, getObject, putObject } from "./database";
import { Identity } from "./identity";
import { IndexedDatabase } from "./indexeddb";

export class Client {
    public identity: Identity;
    public contactList: ContactList;
    public socket: ClientSocket;
    public db: IndexedDatabase;

    constructor(db: IndexedDatabase) {
        this.db = db;
        
        this.contactList = new ContactList(db);
        this.socket = new ClientSocket;
        this.identity = new Identity;
    }

    async login() {
        await this.socket.login(this.identity.address.id);
    }

    async save() {
        await this.db.objectStore("client").put({
            type: "identity",
            object: await this.identity.serialize()
        });
    }
    async load() {
        const identityData = await this.db.objectStore("client").get("identity");
        if(identityData != null) this.identity.deserialize(identityData.object);

        await this.contactList.loadAllContacts();
    }
    hasIdentity(): boolean {
        return this.identity.address.addressKey != null;
    }
}