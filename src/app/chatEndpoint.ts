import { TypedEmitter } from "tiny-typed-emitter";
import { Address } from "./address";
import { getClient } from ".";

export class ChatMessage {
    public content: string;
    public author: Address;
    public creationDate: Date;

    public constructor(content: string, author: Address, creationDate: Date) {
        this.content = content;
        this.author = author;
        this.creationDate = creationDate;
    }

    async getAuthorContact() {
        return await getClient().contactList.getContact(this.author);
    }
}

export interface ChatEndpointEvents {
    "messageAdded": (message: ChatMessage) => void;
    "nameChanged": (name: string) => void;
}
export class ChatEndpoint extends TypedEmitter<ChatEndpointEvents> {
    public name: string = "";
    public members: Address[] = new Array;
    public messages: ChatMessage[] = new Array;

    public constructor() {
        super();
    }

    public addMessage(message: ChatMessage) {
        this.messages.push(message);
        this.emit("messageAdded", message);
    }

    public setName(name: string) {
        this.name = name;
        this.emit("nameChanged", name);
    }
}
