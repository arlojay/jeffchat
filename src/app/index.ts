import { Client } from "./client";
import { IndexedDatabase } from "./indexeddb";

const DB_VERSION = 4;

let client: Client;
let db: IndexedDatabase;

main().catch(e => {
    log(e.stack ?? e);
    throw e;
});

async function main() {
    log("Creating modals");
    initModals();

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

    const contactList = document.querySelector("#contacts");
    for await(const id of client.contactList.contacts.keys()) {
        const contact = await client.contactList.getContactById(id);

        const listItem = document.createElement("li");

        const label = document.createElement("span");
        label.textContent = contact.username;

        const connectButton = document.createElement("button");
        connectButton.textContent = "Connect";
        connectButton.addEventListener("click", async () => {
            connectButton.disabled = true;

            console.log(contact);
            try {
                const connection = await contact.connect();
                connection.addListener("close", () => {
                    connectButton.disabled = false;
                })
            } catch(e) {
                connectButton.disabled = false;
            }
        });
        
        listItem.append(label, connectButton);
        contactList.appendChild(listItem);
    }
}
async function login() {
    if(client.hasIdentity()) {
        log("Logging in with username " + client.identity.username);
        try {
            await client.login();
            log("Logged in!");
            console.log(client);
            (document.querySelector("#import-identity-modal") as HTMLFieldSetElement).hidden = false;
            (document.querySelector("#export-identity-modal") as HTMLFieldSetElement).hidden = false;
            (document.querySelector("#contacts-modal") as HTMLFieldSetElement).hidden = false;

            const usernameHeading = document.querySelector("#username") as HTMLHeadingElement;
            usernameHeading.textContent = client.identity.username;
            usernameHeading.hidden = false;
        } catch(e) {
            log(e);
            throw e;
        }
    } else {
        log("## Create an identity to log in ##");
        (document.querySelector("#address-modal") as HTMLFieldSetElement).hidden = false;
    }
}

function initModals() {
    const addressModal = document.querySelector("#address-modal") as HTMLFieldSetElement;
    const addressModalForm = addressModal.querySelector("form") as HTMLFormElement;
    addressModalForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        try {
            const data = new FormData(addressModalForm);
            const username = data.get("username") as string;

            log("Creating identity with username " + username);

            await client.identity.createNew(username);
            log("Saving client config");
            await client.save();

            (document.querySelector("#address-modal") as HTMLFieldSetElement).hidden = true;
            await login();
        } catch(e) {
            log(e.stack ?? e);
            throw e;
        }
    });

    const connectModal = document.querySelector("#connect-modal") as HTMLFieldSetElement;
    const connectModalForm = connectModal.querySelector("form") as HTMLFormElement;
    connectModalForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        try {
            const data = new FormData(connectModalForm);
            const id = data.get("id") as string;

            log("Connecting to peer with id " + id);

            const contact = await client.contactList.getContactById(id);
            if(contact == null) {
                // await client.contactList.createContact(id, )
            }
            await contact.connect();

            log("connected");
        } catch(e) {
            log(e.stack ?? e);
            throw e;
        }
    });

    const importIdentityModal = document.querySelector("#import-identity-modal") as HTMLFieldSetElement;
    importIdentityModal.addEventListener("submit", async (e) => {
        e.preventDefault();

        const filePicker = document.createElement("input") as HTMLInputElement;
        filePicker.type = "file";
        filePicker.addEventListener("change", async () => {
            log("chose file picker");

            const file = filePicker.files[0];
            const fileReader = new FileReader();

            log("reading file");
            fileReader.readAsText(file);
            fileReader.addEventListener("load", async () => {
                log("creating contact");
                try {
                    const contact = await client.contactList.createContactFromDescriptor(fileReader.result as string);
                    log("Created contact for " + contact.username);
                } catch(e) {
                    log(e.message ?? e);
                    throw e;
                }
            });
        });
        filePicker.click();
    });

    document.querySelector("#export-identity").addEventListener("click", async () => {
        const data = await client.identity.exportIdentityFile();

        const a = document.createElement("a");
        a.href = "data:application/octet-stream," + data;
        a.download = "identity-" + client.identity.username + ".pub";

        a.click();
    });

    document.querySelector("#debug").addEventListener("click", () => {
        
    });
}

export function log(text: any) {
    if(typeof text == "object") text = JSON.stringify(text);
    const logsElement = document.querySelector("#logs") as HTMLTextAreaElement;
    logsElement.value += text + "\n";
}


export function getClient() {
    return client;
}