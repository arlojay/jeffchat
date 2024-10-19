import { Client } from "./client";
import { IndexedDatabase } from "./indexeddb";
import { initUI, buildContactList, postInitUI } from "./ui/ui";
import { registerServiceWorker } from "./service-worker";

let client: Client;
let db: IndexedDatabase;

main().catch(e => {
    log(e.stack ?? e);
    throw e;
});

async function main() {
    const serviceWorkerPromise = registerServiceWorker("sw.js");
    initUI();
    await serviceWorkerPromise;

    log("Opening database");
    db = new IndexedDatabase("jeffchat");

    const clientStoreOptions = db.createObjectStore("client");
    clientStoreOptions.keyPath = "type";
    
    const contactsStoreOptions = db.createObjectStore("contacts");
    contactsStoreOptions.keyPath = "id";

    await db.open();


    log("Creating client");
    client = new Client(db);
    log("Loading client");
    await client.load();

    await login();
    
    log("Loading contacts");
    await client.contactList.loadAllContacts();
    
    await buildContactList();
    await postInitUI();


    await connectToContacts();
}

export async function connectToContacts() {
    const promises = new Set;

    for(const id of client.contactList.contacts.keys()) {
        promises.add(
            client.contactList.getContactById(id)
            .then(contact => contact.isConnected() ? null : contact.connect())
        );
    }

    await Promise.allSettled(promises);
}

export async function login() {
    if(client.hasIdentity()) {
        log("Logging in with username " + client.identity.username);
        try {
            await client.login();
            log("Logged in!");
            console.log(client);
            (document.querySelector("#import-identity-modal") as HTMLFieldSetElement).hidden = false;
            (document.querySelector("#export-identity-modal") as HTMLFieldSetElement).hidden = false;
            (document.querySelector("#contacts-modal") as HTMLFieldSetElement).hidden = false;
            (document.querySelector("#set-profile-picture-modal") as HTMLFieldSetElement).hidden = false;
            
            await client.save();
        } catch(e) {
            log(e);
            throw e;
        }
    } else {
        log("## Create an identity to log in ##");
        (document.querySelector("#address-modal") as HTMLFieldSetElement).hidden = false;
    }
}

export function log(text: any) {
    if(typeof text == "object") text = JSON.stringify(text);
    const logsElement = document.querySelector("#logs") as HTMLTextAreaElement;
    logsElement.value += text + "\n";
}


export function getClient() {
    return client;
}
export function getDatabase() {
    return db;
}