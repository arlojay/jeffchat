import "./style.scss";
import { getClient, getDatabase, log, login } from "..";
import { showContentTab, SidebarTab } from "./tabs";
import { ContactListElement } from "./contactList";
import { ProfileCard } from "./profileCard";
import { RebuildableFontAwesomeIcon } from "./rebuildableFontAwesomeIcon";
import { HoverText } from "./hoverText";

const settingsTab: SidebarTab = new SidebarTab({
    contents: new RebuildableFontAwesomeIcon(() => ["solid", "gear"])
});
const contactsTab: SidebarTab = new SidebarTab({
    contents: new RebuildableFontAwesomeIcon(() => ["solid", "address-book"])
});
let contactListElement: ContactListElement = new ContactListElement;

export async function initUI() {
    log("Creating modals");
    initModals();

    const contentTabs = document.querySelector("#sidebar");

    contentTabs.append(
        settingsTab.element,
        contactsTab.element
    );
    
    settingsTab.addListener("click", () => {
        showContentTab(document.querySelector("#settings-tab") as HTMLElement);
    });
    contactsTab.addListener("click", () => {
        showContentTab(document.querySelector("#contacts-tab") as HTMLElement);
    });

    contactListElement.addListener("remove", contact => {
        contactListElement.update();
    });
    contactListElement.addListener("connect", contact => {
        console.log("connecting to " + contact.username);
    });
}

export async function postInitUI() {
    const mainProfileCard = new ProfileCard(getClient().identity.self);
    document.querySelector("#main-profile-card").append(mainProfileCard.element);
}

export async function buildContactList() {
    contactListElement.setContactList(getClient().contactList);
    await contactListElement.update();

    const contactList = document.querySelector("#contacts-modal");
    contactList.replaceChildren(contactListElement.element);
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
                    await contact.connect();
                    log("Created contact for " + contact.username);
                } catch(e) {
                    log(e.message ?? e);
                    throw e;
                }
            });
        });
        filePicker.click();
    });

    const profilePictureModal = document.querySelector("#set-profile-picture-modal") as HTMLFieldSetElement;
    const profilePictureModalForm = profilePictureModal.querySelector("form") as HTMLFormElement;
    profilePictureModalForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        try {
            const data = new FormData(profilePictureModalForm);
            const email = data.get("email") as string;

            const profilePicture = getClient().identity.self.profilePicture;
            await profilePicture.setGravatar(email);
            log("Saving client config");
            await getClient().save();
        } catch(e) {
            log(e.stack ?? e);
            throw e;
        }
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
        });
    });

    const hoverText = new HoverText(document.body);
}