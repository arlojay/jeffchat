import { getAudioManager, getClient } from "..";
import { ChatEndpoint, ChatMessage } from "../chatEndpoint";
import { PacketData, SecureConnection } from "../secureConnection";
import { ChatScreen } from "../ui/chat";
import { ProfilePictureElement } from "../ui/profilePicture";
import { isContentTabShown, showContentTab, SidebarTab } from "../ui/tabs";
import { ContactProgram } from "./contactProgram";
import { MasterContactProgram } from "./masterContactProgram";
import { ChatEndpointOverlay } from "../ui/chatEndpointOverlay";

MasterContactProgram.registerProgram(
    contact => new ChatProgram(contact),
    {
        startAt: "runtime",
        stopAt: "close"
    }
);

export class ChatProgram extends ContactProgram {
    public screen: ChatScreen = new ChatScreen(this.contact);
    public chatEndpoint: ChatEndpoint = new ChatEndpoint;
    private sendMessagePromise: Promise<SecureConnection>;

    private chatTab: SidebarTab;

    async init() {
        console.log("init chat");

        const profilePicture = new ProfilePictureElement(this.contact, {
            showIndicator: true
        });
        const chatEndpointOverlay = new ChatEndpointOverlay(this.chatEndpoint);

        this.chatTab = new SidebarTab({
            contents: async () => {
                const element = document.createElement("div");
                element.classList.add("contact-icon");

                await profilePicture.update();
                await chatEndpointOverlay.update();

                element.append(profilePicture.element, chatEndpointOverlay.element);

                return element;
            },
            hoverText: this.contact.username
        });

        this.screen.addListener("message", async rawMessage => {
            if(this.isWhitespace(rawMessage)) return;
            await this.sendMessage(rawMessage);
        });

        this.screen.setEndpoint(this.chatEndpoint);

        this.chatTab.addListener("click", () => {
            showContentTab(this.screen);
            this.chatEndpoint.clearUnreadMessages();
            this.chatTab.update();
        });
        document.querySelector("#sidebar").append(this.chatTab.element);

        this.chatEndpoint.addListener("messageAdded", message => {
            if(isContentTabShown(this.screen)) {
                this.chatEndpoint.clearUnreadMessages();
            } else {
                getAudioManager().getAudioClip("new-message").play();
            }
            chatEndpointOverlay.update();
        });
    }
    async stop() {
        this.chatTab.remove();
    }

    async onConnected() {
        await this.chatTab.update();
    }

    async onDisconnected() {
        await this.chatTab.update();
    }

    async onData(data: PacketData) {
        if(data.type == "message") {
            if(this.isWhitespace(data.content)) return;

            const message = new ChatMessage(data.content, this.contact.address, new Date);

            this.chatEndpoint.addMessage(message);
        }
    }

    private isWhitespace(text: string): boolean {
        return text.replace(/[\s\t]/g, "").length == 0;
    }

    private async waitForConnection() {
        let connection = this.contact.getConnection();
        if(this.contact.isAuthenticated()) return connection;
        
        if(this.sendMessagePromise == null) {
            this.sendMessagePromise = this.contact.connect();

            this.sendMessagePromise.catch(e => {
                this.sendMessagePromise = null;
                throw e;
            });
        }

        connection = await this.sendMessagePromise;
        this.sendMessagePromise = null;
        return connection;
    }
    
    public async sendMessage(messageContent: string) {
        const connection = await this.waitForConnection();

        connection.send({
            type: "message",
            content: messageContent
        });

        const message = new ChatMessage(messageContent, getClient().identity.self.address, new Date);

        this.chatEndpoint.addMessage(message);
    }
}