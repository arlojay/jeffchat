import { getClient } from "..";
import { Contact } from "../contact";
import { ChatEndpoint, ChatMessage } from "../chatEndpoint";
import { RebuildableHTMLElement } from "./rebuildableHTMLElement";

export class ChatMessageElement extends RebuildableHTMLElement {
    message: ChatMessage;

    constructor(message: ChatMessage) {
        super();

        this.message = message;
    }
    protected async createElement() {
        const isOutgoing = this.message.author == getClient().identity.self.address;
        const authorContact = await this.message.getAuthorContact();

        const element = document.createElement("div");
        element.classList.add("message", isOutgoing ? "outgoing" : "incoming");
    
        const header = document.createElement("header");
    
        const author = document.createElement("span");
        author.textContent = isOutgoing ? "You" : (authorContact?.username ?? "?????");
        author.classList.add("author");
    
        const time = document.createElement("time");
        time.textContent = this.message.creationDate.toISOString();
    
        header.append(author, time);
    
        const content = document.createElement("p");
        content.textContent = this.message.content;
    
        element.append(header, content);
    
        return element;
    }
}

export interface ChatScreenEvents {
    message: (message: string) => void;
}

export class ChatScreen extends RebuildableHTMLElement<ChatScreenEvents> {
    contact: Contact;
    chat: ChatEndpoint = new ChatEndpoint;
    chatMessageElements: Map<ChatMessage, ChatMessageElement> = new Map;

    private nameChangedEventHandler: (name: string) => void;
    private messageAddedEventHandler: (message: ChatMessage) => void;
    private chatLogsElement: HTMLDivElement;

    constructor(contact: Contact) {
        super();

        this.contact = contact;
    }

    public setEndpoint(chat: ChatEndpoint) {
        if(this.nameChangedEventHandler != null)
            this.chat.off("nameChanged", this.nameChangedEventHandler);

        if(this.messageAddedEventHandler != null)
            this.chat.off("messageAdded", this.messageAddedEventHandler);
        
        this.chat = chat;
        this.chat.on("nameChanged", this.nameChangedEventHandler = name => {
            this.update();
        });
        this.chat.on("messageAdded", this.messageAddedEventHandler = message => {
            this.addMessage(message);
        });

        this.chat.setName("Chat with " + this.contact.username);
    }

    public async update() {
        await super.update();
        this.addMessages();
    }


    public async addMessage(message: ChatMessage) {
        const messageElement = new ChatMessageElement(message);
        console.log(messageElement);

        this.chatMessageElements.set(message, messageElement);
        this.chatLogsElement.append(messageElement.element);
        console.log(this.chatLogsElement);

        this.chatLogsElement.scrollTop = this.chatLogsElement.scrollHeight;
    }

    private async addMessages() {
        this.chatMessageElements.clear();
        await Promise.all(this.chat.messages.map(message => this.addMessage(message)));
    }

    protected async createElement() {
        const tabElement = document.createElement("div");
        tabElement.classList.add("content-tab");
        tabElement.classList.add("chat");


        const top = document.createElement("h1");
        top.classList.add("top");

        const icon = document.createElement("i");
        icon.classList.add("fa-solid", "fa-chat");

        const title = document.createElement("span");
        title.textContent = this.chat.name;
        
        top.append(icon, title);


        const main = document.createElement("div");
        main.classList.add("main");


        const chatLogs = document.createElement("div");
        chatLogs.classList.add("chat-logs");
        this.chatLogsElement = chatLogs;

        
        const chatBox = document.createElement("form");
        chatBox.classList.add("chat-box");

        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.name = "message";
        textInput.placeholder = "Send a message";
        textInput.autocomplete = "off";
        

        const sendButton = document.createElement("input");
        sendButton.type = "submit";
        sendButton.value = "Send";

        chatBox.append(textInput, sendButton);

        chatBox.addEventListener("submit", async e => {
            e.preventDefault();
            this.emit("message", textInput.value);
            textInput.value = "";
        });


        main.append(chatLogs, chatBox);

        tabElement.append(top, main);


        return tabElement;
    }
}