import { RebuildableHTMLElement } from "./rebuildableHTMLElement";
import { ChatEndpoint } from "../chatEndpoint";

export class ChatEndpointOverlay extends RebuildableHTMLElement {
    private chatEndpoint: ChatEndpoint;

    constructor(chatEndpoint: ChatEndpoint) {
        super();
        this.chatEndpoint = chatEndpoint;
    }
    
    protected async createElement() {
        const element = document.createElement("div");
        element.classList.add("chat-endpoint-overlay");

        const unreadMessageCount = this.chatEndpoint.getUnreadMessageCount();

        const unreadMessageCounter = document.createElement("span");
        unreadMessageCounter.classList.add("unread-messages");
        unreadMessageCounter.textContent = unreadMessageCount + "";

        if(unreadMessageCount > 0) {
            element.classList.add("unread");
        } else {
            unreadMessageCounter.hidden = true;
        }

        element.append(unreadMessageCounter);

        return element;
    }
}