import { getClient } from ".";
import { Serializable } from "./serializable";
import { Address, AddressDBEntry } from "./address";
import { MasterContactProgram } from "./contactProgram/masterContactProgram";
import { SecureConnection } from "./secureConnection";
import { TypedEmitter } from "tiny-typed-emitter";
import { ProfilePicture, ProfilePictureDBEntry } from "./profilePicture";

export interface ContactDBEntry {
    id: string,
    username: string,
    address: AddressDBEntry,
    profilePicture: ProfilePictureDBEntry
}

export interface ContactEvents {
    connected: (connection: SecureConnection) => void;
    disconnected: (connection: SecureConnection) => void;
}

export class Contact extends TypedEmitter<ContactEvents> implements Serializable {
    username: string;
    address: Address;
    program: MasterContactProgram;
    profilePicture: ProfilePicture;

    constructor(address: Address = new Address, username: string = "anonymous") {
        super();
        
        this.username = username;
        this.address = address;
        this.program = new MasterContactProgram(this);
        this.profilePicture = new ProfilePicture(this);
    }
    get id() {
        return this.address.id;
    }
    public async initPrograms() {
        await this.program.init();
    }

    public isConnected() {
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
        const newConnection = await client.socket.createSocketConnection(this.address);

        return newConnection;
    }
    
    public async serialize(): Promise<ContactDBEntry> {
        return {
            id: this.address.id,
            username: this.username,
            address: await this.address.serialize(),
            profilePicture: await this.profilePicture.serialize()
        };
    }
    public async deserialize(data: ContactDBEntry) {
        this.username = data.username;
        await this.address.deserialize(data.address);
        if("profilePicture" in data) await this.profilePicture.deserialize(data.profilePicture);
    }

    
    async update() {
        await getClient().contactList.updateContact(this);
    }
}