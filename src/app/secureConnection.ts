import { DataConnection } from "peerjs";
import { Contact } from "./contact";
import { getClient } from ".";
import { decode, encode } from "@msgpack/msgpack";
import EventEmitter from "events";
import { deriveMessageSecret, exportJwk, importJwk } from "./cryptoUtil";

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

    private contactPublicMessageKey: CryptoKey;


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
        this.secretKey = await deriveMessageSecret(
            getClient().identity.messageKey.privateKey,
            this.contactPublicMessageKey
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

        // Stage 0: let peer know the client is ready to receieve data
        this.connection.send({
            stage: 0
        });

        // Stage 1: decrypt the peer's encrypted handshake challenge and resend it,
        //          encrypted with the client's key (alongside public messaging key).
        //          Also receives the peer's public id key (which is unverified)
        const request = await this.expectResponse(this.connection, 10000);
        console.log(request);

        if(request == null) throw new Error("Malformed handshake request");
        if(!(request.data instanceof ArrayBuffer)) throw new Error("Encrypted data is not an ArrayBuffer");
        if(request.data.byteLength != 256) throw new Error("Malformed handshake request");


        let contactPublicAddressKey: CryptoKey;

        if(this.contact.address.addressKey == null) {
        
            // Load peer's public address key
            if(typeof request.addressKey != "object") throw new Error("Address key not found");

            try {
                contactPublicAddressKey = await importJwk(request.addressKey, { name: "RSA-OAEP", hash: "SHA-256" });
            } catch(e) {
                console.debug(e);
                throw new Error("Invalid address key");
            }

            const dummy = new Contact;
            await dummy.address.setAddressKey(contactPublicAddressKey);
            if(dummy.id != this.connection.peer) throw new Error("Illegitimate address key");
        } else {
            contactPublicAddressKey = await this.contact.address.getAddressKey();
        }

        const clientPublicMessageKey = getClient().identity.messageKey.publicKey;
        const clientPrivateAddressKey = getClient().identity.addressKey.privateKey;

        const decryptedData = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            clientPrivateAddressKey, request.data
        );

        const encryptedData = await crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            contactPublicAddressKey, decryptedData
        );

        // Stage 2: peer verifies legitimacy of the client's keys (and sets username if specified)
        this.connection.send({
            stage: 2,
            data: encryptedData,
            messageKey: await exportJwk(clientPublicMessageKey),
            username: getClient().identity.username
        });
        
        // Stage 3: peer sends their public messaging key for secret key derivation (and sets their username if sent)
        const finalizeData = await this.expectResponse(this.connection, 5000);

        // Load peer's public messaging key
        if(typeof finalizeData.messageKey != "object") throw new Error("Message key not found");
        try {
            this.contactPublicMessageKey = await importJwk(finalizeData.messageKey, { name: "ECDH", namedCurve: "P-256" });
        } catch(e) {
            console.debug(e);
            throw new Error("Invalid message key");
        }

        if(typeof finalizeData.username == "string") {
            if(this.contact.username != finalizeData.username) {
                this.contact.username = finalizeData.username;
                await this.contact.update();
            }
        }

        await this.createSecretKey();

        // Stage 4: let peer know the client is done with the handshake
        this.connection.send({
            stage: 4
        });

        // Authentication complete
        this.authenticated = true;
    }

    public async startHandshake() {
        if(!this.connected) throw new Error("Cannot start handshake request when connection is closed");

        // Stage 0: wait for peer to be ready for data
        const setupResponse = this.expectResponse(this.connection, 4000);

        // Create handshake challenge while waiting
        const clientPublicMessageKey = getClient().identity.messageKey.publicKey;
        const clientPrivateAddressKey = getClient().identity.addressKey.privateKey;
        const clientPublicAddressKey = getClient().identity.addressKey.publicKey;
        const contactPublicAddressKey = await this.contact.address.getAddressKey();

        const handshakeData = crypto.getRandomValues(new Uint8Array(190));
        const encryptedData = await crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            contactPublicAddressKey, handshakeData.buffer
        );

        // Wait for stage 0 response
        await setupResponse;

        // Stage 1: create handshake challenge
        this.connection.send({
            stage: 1,
            data: encryptedData,
            addressKey: await exportJwk(clientPublicAddressKey)
        });

        // Stage 2: peer decrypts data and resends encrypted (alongside public message key for deriving secret and username)
        const response = await this.expectResponse(this.connection, 5000);

        if(response == null) throw new Error("Malformed handshake response");
        if(!(response.data instanceof ArrayBuffer)) throw new Error("Data is not an ArrayBuffer");
        if(response.data.byteLength != 256) throw new Error("Malformed handshake response");
        if(typeof response.messageKey != "object") throw new Error("Message key not found");

        // Load peer's public message key
        try {
            console.log(response);
            this.contactPublicMessageKey = await importJwk(response.messageKey, { name: "ECDH", namedCurve: "P-256" });
        } catch(e) {
            console.debug(e);
            throw new Error("Invalid message key");
        }

        if(typeof response.username == "string") {
            if(this.contact.username != response.username) {
                this.contact.username = response.username;
                await this.contact.update();
            }
        }

        // Check handshake equivalence
        const decryptedData = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            clientPrivateAddressKey, response.data
        );
        const decryptedDataView = new Uint8Array(decryptedData);

        if(decryptedDataView.length != handshakeData.length) throw new Error("Received key is illegitimate");
        for(let i = 0; i < handshakeData.length; i++) {
            if(decryptedDataView[i] != handshakeData[i]) throw new Error("Received key is illegitimate");
        }
        
        // Stage 3: send client's public message key
        this.connection.send({
            stage: 3,
            messageKey: await exportJwk(clientPublicMessageKey),
            username: getClient().identity.username
        });


        // Stage 4: wait for peer to be ready for data

        // Create secret key while waiting
        const createSecretKeyPromise = this.createSecretKey();

        await this.expectResponse(this.connection, 5000);
        await createSecretKeyPromise;

        // Authentication complete
        this.authenticated = true;
    }
    close() {
        this.connection.close();
    }
}