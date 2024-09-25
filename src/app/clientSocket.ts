import Peer, { DataConnection } from "peerjs";
import { getClient } from ".";
import { Address } from "./address";
import { log } from "./index";
import { SecureConnection } from "./secureConnection";
import { Contact } from "./contact";

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
                this.respondToConnection(connection);
            });
            this.peer.addListener("close", () => {
                rej("Premature closure");
            });
        });
    }

    private async createNegotiationData(contact: Contact): Promise<object> {
        return {
            username: getClient().identity.username
        };
    }

    private async loadNegotiationData(data: object, secureConnection: SecureConnection, contact: Contact) {
        await contact.address.setAddressKey(secureConnection.contactPublicAddressKey);

        if("username" in data && typeof data.username == "string") {
            contact.username = data.username;
        }
    }

    private async respondToConnection(connection: DataConnection) {
        const contact = await this.getContact(connection);
        console.log("connection from " + contact.username);
        
        const secureConnection = new SecureConnection(contact, connection);
        this.connections.set(connection.peer, secureConnection);

        await this.initConnection(secureConnection);
        
        let negotiationResponse: any;
        try {
            negotiationResponse = await secureConnection.respondNegotiation(await this.createNegotiationData(contact));
        } catch(e) {
            console.error(e);
            secureConnection.close();
            throw e;
        }

        await this.loadNegotiationData(negotiationResponse, secureConnection, contact);
        await contact.update();

        secureConnection.addListener("data", data => secureConnection.contact.program.onData(data));
        secureConnection.contact.program.onConnected();
    }

    public async connect(address: Address): Promise<SecureConnection> {
        const otherId = address.id;
        if(this.peer == null) throw new Error("Socket not connected");

        const contact = await getClient().contactList.getContact(address);
        console.log("connect to " + contact.username);
        const connection = this.peer.connect(otherId);

        const secureConnection = new SecureConnection(contact, connection);
        this.connections.set(connection.peer, secureConnection);

        await this.initConnection(secureConnection);
        
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
        
        secureConnection.addListener("data", data => secureConnection.contact.program.onData(data));
        secureConnection.contact.program.onConnected();
        return secureConnection;
    }

    private async getContact(connection: DataConnection) {
        return await getClient().contactList.getContactById(connection.peer) ?? new Contact;
    }

    private async initConnection(secureConnection: SecureConnection): Promise<void> {
        const connection = secureConnection.connection;

        const contact = await this.getContact(connection);


        await new Promise<void>((res, rej) => {
            if(connection.open) return res();

            connection.addListener("iceStateChanged", () => {
                console.debug("ICE change");
            });
            connection.addListener("close", () => {
                rej("Socket closed");
                console.debug("socket closed");
                contact.program.onDisconnected();
            });
            connection.addListener("error", error => {
                console.debug(error);
                rej("Socket error: " + error);
                contact.program.onDisconnected();
            });
            connection.addListener("open", () => {
                res();
            });
        });
    }
}