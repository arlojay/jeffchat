import { DataConnection } from "peerjs";
import { Contact } from "./contact";
import { getClient } from ".";
import { decode, encode } from "@msgpack/msgpack";
import EventEmitter from "events";

interface HandshakeRequest {
    stage: number;
    data: ArrayBuffer;
}

interface EncryptedPacket {
    i: ArrayBuffer,
    d: ArrayBuffer
}

interface UnsecurePacket {
    d: PacketData
}

export interface PacketData {
    type: string,
    content: any
}

export class SecureConnection extends EventEmitter {
    public contact: Contact;
    public authenticated: boolean = false;
    private secretKey: CryptoKey;
    public connection: DataConnection;
    public bufferCount = 0;
    public processingCount = 0;


    constructor(contact: Contact, connection: DataConnection) {
        super();

        this.contact = contact;
        this.connection = connection;

        this.connection.addListener("close", () => this.emit("close"));
        this.connection.addListener("data", d => this.emit("rawdata", d));
        this.connection.addListener("error", e => this.emit("error", e));
        this.connection.addListener("iceStateChanged", s => this.emit("iceStateChanged", s));

        this.initDecrypter();
    }

    private initDecrypter() {
        // wait for previous packet to finish decrypting before broadcasting the next event
        // this method is memory-efficient when compared to storing an array of Promises
        let previousPacketProcessing: Promise<void>;
        this.connection.addListener("data", (data) => {
            previousPacketProcessing = (async () => {
                this.bufferCount++;
                this.processingCount++;

                const processResult = this.interpretPacket(data);
                processResult.then(_ => this.processingCount--);

                await previousPacketProcessing;


                this.bufferCount--;
                this.emit("data", await processResult);
            })();
        });
    }

    get connected() {
        return this.connection != null && this.connection.open;
    }

    async createSecretKey() {
        console.log("Create secret key");
        this.secretKey = await this.contact.address.deriveMessageKey(
            getClient().identity.messageKey.privateKey
        );
        console.log("Created secret key");
    }

    public async encrypt(data: any) {
        const iv = new ArrayBuffer(96);
        crypto.getRandomValues(new Uint8Array(iv));

        const dataArray = encode(data);

        const encrypted = await crypto.subtle.encrypt({
            name: "AES-GCM", iv
        }, this.secretKey, dataArray);

        return { i: iv, d: encrypted };
    }
    public async decrypt(packet: EncryptedPacket): Promise<PacketData> {
        const decrypted = await crypto.subtle.decrypt({
            name: "AES-GCM", iv: packet.i
        }, this.secretKey, packet.d);

        return await decode(new Uint8Array(decrypted)) as PacketData;
    }
    public async interpretPacket(data: any): Promise<PacketData> {
        if("i" in data && "d" in data) {
            const packet = data as EncryptedPacket;
            return await this.decrypt(packet);
        } else if ("d" in data) {
            const packet = data as UnsecurePacket;
            return packet.d;
        }

        return data;
    }

    public async send(data: PacketData) {
        const packet = await this.encrypt(data);
        this.connection.send(packet);
    }
    public async sendUnsecure(data: PacketData) {
        this.connection.send({ d: data });
    }

    private async expectResponse(connection: DataConnection, timeout: number): Promise<any> {
        let timeoutId: NodeJS.Timeout;
        if(!this.connected) throw new Error("Cannot expect response when connection is closed");

        return new Promise((res, rej) => {
            connection.once("data", data => {
                clearTimeout(timeoutId);
                res(data);
            });
            timeoutId = setTimeout(() => {
                rej(new Error("Response timeout"));
            }, timeout);
        });
    }

    public async respondHandshake() {
        if(!this.connected) throw new Error("Cannot listen for handshake request when connection is closed");

        this.connection.send({
            stage: 0,
            data: new ArrayBuffer(0)
        });

        const request: HandshakeRequest | null = await this.expectResponse(this.connection, 10000);
        console.log(request);

        if(request == null) throw new Error("Malformed handshake request");
        if(!(request.data instanceof ArrayBuffer)) throw new Error("Encrypted data is not an ArrayBuffer");
        if(request.data.byteLength != 256) throw new Error("Malformed handshake request");

        const clientPrivateKey = getClient().identity.addressKey.privateKey;
        const contactPublicKey = await this.contact.address.getIdKey();

        const decryptedData = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            clientPrivateKey, request.data
        );

        const encryptedData = await crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            contactPublicKey, decryptedData
        );

        this.connection.send({
            stage: 2,
            data: encryptedData
        });
        
        const finalizePromise = this.expectResponse(this.connection, 5000);
        await this.createSecretKey();
        await finalizePromise;

        this.authenticated = true;
    }

    public async startHandshake() {
        if(!this.connected) throw new Error("Cannot start handshake request when connection is closed");
        const setupResponse = this.expectResponse(this.connection, 4000);

        const contactPublicKey = await this.contact.address.getIdKey();
        const handshakeData = crypto.getRandomValues(new Uint8Array(190));
        const encryptedData = await crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            contactPublicKey, handshakeData.buffer
        );

        await setupResponse;

        this.connection.send({
            stage: 1,
            data: encryptedData
        });

        const response: HandshakeRequest | null = await this.expectResponse(this.connection, 5000);

        if(response == null) throw new Error("Malformed handshake response");
        if(!(response.data instanceof ArrayBuffer)) throw new Error("Decrypted data is not an ArrayBuffer");
        if(response.data.byteLength != 256) throw new Error("Malformed handshake response");

        const clientPrivateKey = getClient().identity.addressKey.privateKey;
        const decryptedData = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            clientPrivateKey, response.data
        );
        const decryptedDataView = new Uint8Array(decryptedData);

        if(decryptedDataView.length != handshakeData.length) throw new Error("Received key is illegitimate");
        for(let i = 0; i < handshakeData.length; i++) {
            if(decryptedDataView[i] != handshakeData[i]) throw new Error("Received key is illegitimate");
        }
        
        await this.createSecretKey();
        this.connection.send({
            stage: 3,
            data: new ArrayBuffer(0)
        });

        this.authenticated = true;
    }
    close() {
        this.connection.close();
    }
}