import "./style.scss";
import { getClient, getDatabase, log, login } from "..";
import { createTab, initTabs } from "./tabs";

export async function initUI() {
    log("Creating modals");
    initModals();
    initTabs();
}

export async function populateUI() {
    const contactList = document.querySelector("#contacts");
    for await(const id of getClient().contactList.contacts.keys()) {
        const contact = await getClient().contactList.getContactById(id);

        const listItem = document.createElement("li");

        const label = document.createElement("span");
        label.textContent = contact.username;

        const connectButton = document.createElement("button");
        connectButton.textContent = "Open Chat";
        connectButton.addEventListener("click", async () => {
            connectButton.disabled = true;

            console.log(contact);
            try {
                const connection = await contact.connect();
                connection.addListener("close", () => {
                    connectButton.disabled = false;
                });

                const tab = createTab("chat");
                tab.textContent = contact.username;

                tab.addEventListener("click", () => {
                    document.querySelector("#contact-username").textContent = contact.username;
                })
            } catch(e) {
                connectButton.disabled = false;
            }
        });
        
        listItem.append(label, connectButton);
        contactList.appendChild(listItem);
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

            await getClient().identity.createNew(username);
            log("Saving client config");
            await getClient().save();

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

            const contact = await getClient().contactList.getContactById(id);
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
                    const contact = await getClient().contactList.createContactFromDescriptor(fileReader.result as string);
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
        const data = await getClient().identity.exportIdentityFile();

        const a = document.createElement("a");
        a.href = "data:application/octet-stream," + data;
        a.download = "identity-" + getClient().identity.username + ".pub";

        a.click();
    });

    document.querySelector("#debug").addEventListener("click", () => {
        
    });

    document.querySelector("#delete-database").addEventListener("click", () => {
        getDatabase()?.close?.();
        const request = indexedDB.deleteDatabase("jeffchat");

        log("Deleting database");

        request.addEventListener("success", () => {
            log("Deleted database");
            document.location = document.location;
        });
        request.addEventListener("error", (e) => {
            log("Database deletion error: " + e);
        });
        request.addEventListener("blocked", () => {
            log("Database deletion blocked");
        })
    })
}