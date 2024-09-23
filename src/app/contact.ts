import { getClient } from ".";
import { Serializable } from "./serializable";
import { Address, AddressDBEntry } from "./address";
import { MasterContactProgram } from "./contactProgram/masterContactProgram";
import { SecureConnection } from "./secureConnection";

export interface ContactDBEntry {
    id: string,
    username: string,
    address: AddressDBEntry
}

export class Contact implements Serializable {
    username: string;
    address: Address;
    program: MasterContactProgram;

    constructor(address: Address = new Address, username: string = "anonymous") {
        this.username = username;
        this.address = address;
        this.program = new MasterContactProgram(this);
    }
    get id() {
        return this.address.id;
    }
    public async initPrograms() {
        await this.program.init();
    }

    public isConnecting() {
        return getClient().socket.connections.has(this.address.id);
    }
    public isAuthenticated() {
        const connection = this.getConnection();
        if(connection == null) return false;
        return connection.authenticated;
    }
    public getConnection() {
        return getClient().socket.connections.get(this.address.id);
    }

    public async connect(): Promise<SecureConnection> {
        const existingConnection = this.getConnection();
        if(existingConnection != null) return existingConnection;

        const client = getClient();
        const newConnection = await client.socket.connect(this.address);

        return newConnection;
    }
    
    public async serialize(): Promise<ContactDBEntry> {
        return {
            id: this.address.id,
            username: this.username,
            address: await this.address.serialize()
        };
    }
    public async deserialize(data: any) {
        this.username = data.username;
        await this.address.deserialize(data.address);
    }

    
    async update() {
        await getClient().contactList.updateContact(this);
    }
}