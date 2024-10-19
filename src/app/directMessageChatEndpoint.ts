import { ChatEndpoint } from "./chatEndpoint";
import { Contact } from "./contact";

export class DirectMessageChatEndpoint extends ChatEndpoint {
    other: Contact;

    constructor(other: Contact) {
        super();

        this.other = other;
    }
    public send(message: string): void {
        if(!this.other.isAuthenticated()) throw new Error("Cannot send message until contact is connected and authenticated");
        
        const connection = this.other.getConnection();
        if(connection == null) throw new Error("Connection is unavailable");
    }
}