import Peer, { DataConnection } from "peerjs";
import { getClient } from ".";
import { Address } from "./address";
import { log } from "./index";
import { SecureConnection } from "./secureConnection";

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
                port: 443
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
                console.log("connection");
                const contact = await this.getContact(connection);
                const secureConnection = new SecureConnection(contact, connection);
                this.connections.set(contact.id, secureConnection);

                await this.initConnection(secureConnection);

                console.log("connection opened from " + secureConnection.contact.username);
                await secureConnection.respondHandshake();

                secureConnection.addListener("data", data => secureConnection.contact.program.onData(data));
                secureConnection.contact.program.onConnected();
            });
            this.peer.addListener("close", () => {
                rej("Premature closure");
            });
        });
    }

    public async connect(address: Address): Promise<SecureConnection> {
        const otherId = address.id;
        if(this.peer == null) throw new Error("Socket not connected");

        const connection = this.peer.connect(otherId);
        const contact = await this.getContact(connection);

        const secureConnection = new SecureConnection(contact, connection);
        this.connections.set(otherId, secureConnection);

        await this.initConnection(secureConnection);
        
        secureConnection.addListener("data", data => secureConnection.contact.program.onData(data));
        secureConnection.contact.program.onConnected();
        return secureConnection;
    }

    private async getContact(connection: DataConnection) {
        return await getClient().contactList.getContactById(connection.peer);
    }

    private async initConnection(secureConnection: SecureConnection): Promise<void> {
        const connection = secureConnection.connection;
        const contact = await this.getContact(connection);

        await new Promise<void>((res, rej) => {
            if(connection.open) return res();

            connection.addListener("close", () => {
                rej("Socket closed");
                contact.program.onDisconnected();
            });
            connection.addListener("error", error => {
                rej("Socket error: " + error);
                contact.program.onDisconnected();
            });
            connection.addListener("open", () => {
                res();
            });
        });
    }
}