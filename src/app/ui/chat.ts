export function addChatMessage(message: string, creation: Date, isOutgoing: boolean) {
    const element = document.createElement("div");
    element.classList.add("message", isOutgoing ? "outgoing" : "incoming");

    const header = document.createElement("header");

    const author = document.createElement("span");
    author.classList.add("author");

    const time = document.createElement("time");
    time.textContent = creation.toLocaleString();

    header.append(author, time);

    const content = document.createElement("p");
    content.textContent = message;

    element.append(time, content);

    document.querySelector(".chat-logs")?.appendChild(element);
}