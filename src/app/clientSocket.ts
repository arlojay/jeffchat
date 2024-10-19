import Peer, { DataConnection } from "peerjs";
import { getClient, login } from ".";
import { Address } from "./address";
import { log } from "./index";
import { SecureConnection } from "./secureConnection";
import { Contact } from "./contact";
import { buildContactList } from "./ui/ui";
import { iceServers } from "./turn";
import { ProfilePictureDBEntry } from "./profilePicture";

export class ClientSocket {
    peer: Peer | null;
    connections: Map<string, SecureConnection>;

    constructor() {
        this.peer = null;
        this.connections = new Map;
    }

    public async login(preferredId: string): Promise<void> {
        log("Attempting to log in with id " + preferredId);
        return new Promise((res, rej) => {
            this.peer = new Peer(preferredId, {
                host: "peerjs.arlojay.cc",
                port: 443,
                config: {
                    iceServers: [
                        { url: "stun:stun.l.google.com:19302" },

                        ...iceServers
                        
                        // { url: "turn:turn.cloudflare.com:3478" },
                        // { url: "turn:turn.cloudflare.com:53" },
                        // { url: "turn:turn.cloudflare.com:80" },
                        // { url: "turn:turn.cloudflare.com:5349" },
                        // { url: "turn:turn.cloudflare.com:443" },
                    ]
                }
            });

            this.peer.addListener("disconnected", (id) => {
                rej("Peer disconnected");
            });
            this.peer.addListener("open", (id) => {
                log("Logged in with id " + preferredId);
                res();
            });
            this.peer.addListener("error", (error) => {
                rej(error.message);
            });
            this.peer.addListener("connection", async (connection) => {
                try {
                    await this.respondToConnection(connection);
                } catch(e) {
                    log(e.stack ?? e);
                    throw e;
                }
            });
            this.peer.addListener("close", () => {
                rej("Premature closure");
            });
        });
    }

    private async createNegotiationData(contact: Contact): Promise<object> {
        return {
            username: getClient().identity.username,
            profilePicture: await getClient().identity.self.profilePicture.serialize()
        };
    }

    private async loadNegotiationData(data: object, secureConnection: SecureConnection, contact: Contact) {
        await contact.address.setAddressKey(secureConnection.contactPublicAddressKey);

        if("username" in data && typeof data.username == "string") {
            contact.username = data.username;
        }
        if("profilePicture" in data && typeof data.profilePicture == "object") {
            contact.profilePicture.deserialize(data.profilePicture as ProfilePictureDBEntry);
        }
    }

    private async respondToConnection(connection: DataConnection) {
        const contact = await this.getContact(connection);
        const isNewContact = contact.address.addressKey == null;
        log("connection from " + contact.username);
        
        const secureConnection = new SecureConnection(contact, connection);
        this.connections.set(connection.peer, secureConnection);

        log("init connection");
        await this.initConnection(secureConnection);
        
        log("respond negotiation");
        let negotiationResponse: any;
        try {
            negotiationResponse = await secureConnection.respondNegotiation(await this.createNegotiationData(contact));
        } catch(e) {
            console.error(e);
            secureConnection.close();
            throw e;
        }

        log("load negotiation data");
        await this.loadNegotiationData(negotiationResponse, secureConnection, contact);
        if(isNewContact) {
            await getClient().contactList.addContact(contact);
        } else {
            await contact.update();
        }
        log("build contact list");
        await buildContactList();

        log("send connected events");
        secureConnection.addListener("data", data => secureConnection.contact.program.onData(data));
        secureConnection.contact.program.onConnected();
        contact.emit("connected", secureConnection);
    }

    public async createSocketConnection(address: Address): Promise<SecureConnection> {
        const otherId = address.id;
        if(this.peer == null) throw new Error("Socket not connected");
        if(this.connections.has(otherId)) return this.connections.get(otherId);

        const contact = await getClient().contactList.getContact(address);
        console.log("connect to " + contact.username);
        const connection = this.peer.connect(otherId);

        const secureConnection = new SecureConnection(contact, connection);

        await this.initConnection(secureConnection);
        console.log("connection opened");
        
        let negotiationResponse: any;
        try {
            negotiationResponse = await secureConnection.startNegotiation(await this.createNegotiationData(contact));
        } catch(e) {
            console.error(e);
            secureConnection.close();
            throw e;
        }

        await this.loadNegotiationData(negotiationResponse, secureConnection, contact);
        await contact.update();
        await buildContactList();
        
        secureConnection.addListener("data", data => secureConnection.contact.program.onData(data));
        secureConnection.contact.program.onConnected();
        contact.emit("connected", secureConnection);
        return secureConnection;
    }

    private async getContact(connection: DataConnection) {
        return await getClient().contactList.getContactById(connection.peer) ?? new Contact;
    }

    private async initConnection(secureConnection: SecureConnection): Promise<void> {
        const connection = secureConnection.connection;
        this.connections.set(connection.peer, secureConnection);

        const contact = await this.getContact(connection);


        await new Promise<void>((res, rej) => {
            connection.addListener("iceStateChanged", () => {
                console.log("ice change");
                console.debug("ICE change");
            });
            connection.addListener("close", () => {
                console.log("close");
                rej("Socket closed");
                this.disposeConnection(secureConnection);
                console.debug("socket closed");

                contact.emit("disconnected", secureConnection);
                contact.program.onDisconnected();
            });
            connection.addListener("error", error => {
                console.log("error");
                console.debug(error);
                this.disposeConnection(secureConnection);
                rej("Socket error: " + error);

                contact.emit("disconnected", secureConnection);
                contact.program.onDisconnected();
            });
            connection.addListener("open", () => {
                log("open");
                res();
            });

            if(connection.open) res();

            setTimeout(() => {
                if(connection.open) return;

                this.disposeConnection(secureConnection);
                rej(new Error("Connection timed out"));
            }, 5000);
        });
    }

    private disposeConnection(secureConnection: SecureConnection) {
        const id = secureConnection.connection.peer;

        console.trace("dispose connection " + id);
        if(this.connections.get(id) != secureConnection) return;
        this.connections.delete(id);
        console.log("disposed connection");
    }
}