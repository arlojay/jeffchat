import { DataConnection } from "peerjs";
import { Contact } from "./contact";
import { getClient } from ".";
import { decode, encode } from "@msgpack/msgpack";
import EventEmitter from "events";
import { deriveMessageSecret, exportJwk, importJwk } from "./cryptoUtil";
import { HandshakeChallenge } from "./handshakeChallenge";
import { Address } from "./address";
import { base64ToBuffer, buffersEqual, bufferToBase64 } from "./bufferUtil";

const MAX_RSA_BLOCK_SIZE = 190;
const OUTPUT_RSA_BLOCK_SIZE = 256;

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


abstract class NegotiationStage {
    type: "negotiation";
    stage: number;

    public static isValid(data: unknown): data is NegotiationStage {
        if(data == null) return false;
        if(typeof data != "object") return false;

        if(!("stage" in data)) return false;
        if(typeof data.stage != "number") return false;

        if(!("type" in data)) return false;
        if(data.type != "negotiation") return false;

        return true;
    }
}

abstract class NegotiationStage0 extends NegotiationStage {
    declare stage: 0;
    addressKey: JsonWebKey;

    public static isValid(data: unknown): data is NegotiationStage0 {
        if(!NegotiationStage.isValid(data)) return false;
        if(data.stage != 0) return false;

        if(!("addressKey" in data)) return false;
        if(typeof data.addressKey != "object") return false;

        return true;
    }
}

abstract class NegotiationStage1 extends NegotiationStage {
    declare stage: 1;
    addressKey: JsonWebKey

    public static isValid(data: unknown): data is NegotiationStage1 {
        if(!NegotiationStage.isValid(data)) return false;
        if(data.stage != 1) return false;

        if(!("addressKey" in data)) return false;
        if(typeof data.addressKey != "object") return false;

        return true;
    }
}

abstract class NegotiationStage2 extends NegotiationStage {
    declare stage: 2;
    encryptedMessageKey: ArrayBuffer;

    public static isValid(data: unknown): data is NegotiationStage2 {
        if(!NegotiationStage.isValid(data)) return false;
        if(data.stage != 2) return false;

        if(!("encryptedMessageKey" in data)) return false;
        if(!(data.encryptedMessageKey instanceof ArrayBuffer)) return false;

        return true;
    }
}

abstract class NegotiationStage3 extends NegotiationStage {
    declare stage: 3;
    encryptedMessageKey: ArrayBuffer;

    public static isValid(data: unknown): data is NegotiationStage3 {
        if(!NegotiationStage.isValid(data)) return false;
        if(data.stage != 3) return false;

        if(!("encryptedMessageKey" in data)) return false;
        if(!(data.encryptedMessageKey instanceof ArrayBuffer)) return false;

        return true;
    }
}

abstract class NegotiationStage4 extends NegotiationStage {
    declare stage: 4;
    extraData: EncryptedPacket;

    public static isValid(data: unknown): data is NegotiationStage4 {
        if(!NegotiationStage.isValid(data)) return false;
        if(data.stage != 4) return false;

        if(!("extraData" in data)) return false;
        if(typeof data.extraData != "object") return false;

        return true;
    }
}

abstract class NegotiationStage5 extends NegotiationStage {
    declare stage: 5;
    extraData: EncryptedPacket;

    public static isValid(data: unknown): data is NegotiationStage5 {
        if(!NegotiationStage.isValid(data)) return false;
        if(data.stage != 5) return false;

        if(!("extraData" in data)) return false;
        if(typeof data.extraData != "object") return false;

        return true;
    }
}

abstract class ECNegotiationPacket {
    nonce: string;
    key: JsonWebKey;

    public static isValid(data: unknown): data is ECNegotiationPacket {
        if(data == null) return false;
        if(typeof data != "object") return false;

        if(!("nonce" in data)) return false;
        if(typeof data.nonce != "string") return false;

        if(!("key" in data)) return false;
        if(typeof data.key != "object") return false;

        return true;
    }
}

export class SecureConnection extends EventEmitter {
    public contact: Contact;
    public authenticated: boolean = false;
    private secretKey: CryptoKey;
    public connection: DataConnection;
    public bufferCount = 0;
    public processingCount = 0;

    public contactPublicAddressKey: CryptoKey;
    public contactPublicMessageKey: CryptoKey;


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
        this.secretKey = await deriveMessageSecret(
            getClient().identity.messageKey.privateKey,
            this.contactPublicMessageKey
        );
    }

    public async encrypt(data: any): Promise<EncryptedPacket> {
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

    private async importAddressKey(addressKey: JsonWebKey | null, peerId: string) {
        // Load peer's public address key
        if(addressKey == null) throw new TypeError("Malformed address key");
        if(typeof addressKey != "object") throw new TypeError("Malformed address key");

        let loadedKey: CryptoKey;
        try {
            loadedKey = await importJwk(addressKey, { name: "RSA-OAEP", hash: "SHA-256" });
        } catch(e) {
            console.debug(e);
            throw new Error("Malformed address key");
        }

        const dummy = new Address;
        await dummy.setAddressKey(loadedKey);
        if(dummy.id != peerId) throw new Error("Illegitimate address key");

        return loadedKey;
    }

    private async encryptRSA(publicKey: CryptoKey, buffer: ArrayBuffer) {
        const buffers = new Array;

        for(let i = 0; i < buffer.byteLength; i += MAX_RSA_BLOCK_SIZE) {
            buffers.push(buffer.slice(i, Math.min(buffer.byteLength, i + MAX_RSA_BLOCK_SIZE)));
        }


        const encryptedBuffers = await Promise.all(buffers.map(async buffer => {
            return await crypto.subtle.encrypt(
                { name: "RSA-OAEP" },
                publicKey, buffer
            );
        }));

        const encryptedBuffer = new ArrayBuffer(encryptedBuffers.length * OUTPUT_RSA_BLOCK_SIZE);
        const encryptedBufferView = new Uint8Array(encryptedBuffer);
        let bufferSize = 0;
        for(let i = 0; i < encryptedBuffers.length; i++) {
            encryptedBufferView.set(new Uint8Array(encryptedBuffers[i]), i * OUTPUT_RSA_BLOCK_SIZE);
            bufferSize += encryptedBuffers[i].byteLength;
        }

        return encryptedBuffer.slice(0, bufferSize);
    }

    private async decryptRSA(privateKey: CryptoKey, encryptedBuffer: ArrayBuffer) {
        const encryptedBuffers = new Array;

        for(let i = 0; i < encryptedBuffer.byteLength; i += OUTPUT_RSA_BLOCK_SIZE) {
            encryptedBuffers.push(encryptedBuffer.slice(i, Math.min(encryptedBuffer.byteLength, i + OUTPUT_RSA_BLOCK_SIZE)));
        }

        const buffers = await Promise.all(encryptedBuffers.map(async encryptedBuffer => {
            return await crypto.subtle.decrypt(
                { name: "RSA-OAEP" },
                privateKey, encryptedBuffer
            );
        }));

        const buffer = new ArrayBuffer(encryptedBuffers.length * MAX_RSA_BLOCK_SIZE);
        const bufferView = new Uint8Array(buffer);
        let bufferSize = 0;
        for(let i = 0; i < buffers.length; i++) {
            bufferView.set(new Uint8Array(buffers[i]), i * MAX_RSA_BLOCK_SIZE);
            bufferSize += buffers[i].byteLength;
        }

        return buffer.slice(0, bufferSize);
    }













    /** Client who responds to negotiation will end first */
    public async respondNegotiation(extraData: any): Promise<any> {
        if(!this.connected) throw new Error("Cannot listen for handshake request when connection is closed");

        
        /* ================ CHECKPOINT ================ *\
        |  Convince peer that this client is legitimate  |
        \* ============================================ */

        const client = getClient();
        const clientAddressKey = client.identity.addressKey;
        const clientMessageKey = client.identity.messageKey;

        // Stage 0: signify this client is ready and send address key
        this.connection.send({
            type: "negotiation",
            stage: 0,
            addressKey: await exportJwk(clientAddressKey.publicKey)
        } as NegotiationStage0);

        // Stage 1: receive peer's public address key and begin client-incited handshake
        const responseStage1 = await this.expectResponse(this.connection, 5000) as NegotiationStage1;
        if(!NegotiationStage1.isValid(responseStage1)) throw new Error("Invalid negotiation stage 1");

        const peerAddressKey = await this.importAddressKey(responseStage1.addressKey, this.connection.peer);
        this.contactPublicAddressKey = peerAddressKey;
        
        // Begin client-incited handshake
        const clientHandshakeChallenge = new HandshakeChallenge(peerAddressKey, clientAddressKey.privateKey);
        await clientHandshakeChallenge.send(this.connection);
        
        // Begin peer-incited handshake
        const peerHandshakeChallenge = new HandshakeChallenge(peerAddressKey, clientAddressKey.privateKey);
        await peerHandshakeChallenge.receive(this.connection);

        
        /* ============== CHECKPOINT ============== *\
        |      Peer's address key is legitimate      |
        |     Client's address key is legitimate     |
        \* ======================================== */


        // Stage 2: receive encrypted peer message key
        const responseStage2 = await this.expectResponse(this.connection, 5000) as NegotiationStage2;
        if(!NegotiationStage2.isValid(responseStage2)) throw new Error("Invalid negotiation stage 2");

        const responseStage2Processed = await this.decryptRSA(clientAddressKey.privateKey, responseStage2.encryptedMessageKey).then(data => decode(data));
        if(!ECNegotiationPacket.isValid(responseStage2Processed)) throw new Error("Invalid peer message EC key negotiation");

        const nonceStage2 = await base64ToBuffer(responseStage2Processed.nonce);

        if(!buffersEqual(nonceStage2, clientHandshakeChallenge.handshakeData)) throw new Error("Invalid nonce in EC key negotiation");
        const peerMessageKey = await importJwk(responseStage2Processed.key, { name: "ECDH", namedCurve: "P-256" });


        // Stage 3: send encrypted client message key
        this.connection.send({
            type: "negotiation",
            stage: 3,
            encryptedMessageKey: await this.encryptRSA(
                peerAddressKey,
                new Uint8Array(encode({
                    key: await exportJwk(clientMessageKey.publicKey),
                    nonce: await bufferToBase64(peerHandshakeChallenge.handshakeData)
                } as ECNegotiationPacket)).buffer
            )
        } as NegotiationStage3);


        
        /* ============== CHECKPOINT ============== *\
        |      Peer's message key is legitimate      |
        |     Client's message key is legitimate     |
        \* ======================================== */


        this.contactPublicMessageKey = peerMessageKey;
        await this.createSecretKey();


        const responseStage4 = await this.expectResponse(this.connection, 5000) as NegotiationStage4;
        if(!NegotiationStage4.isValid(responseStage4)) throw new Error("Invalid negotiation stage 4");

        
        this.connection.send({
            type: "negotiation",
            stage: 5,
            extraData: await this.encrypt(extraData)
        } as NegotiationStage5);
        

        const peerExtraData = await this.decrypt(responseStage4.extraData);

        // Authentication complete
        this.authenticated = true;

        return peerExtraData;
    }





    /** Client who started negotiation will end last */
    public async startNegotiation(extraData: any): Promise<any> {
        if(!this.connected) throw new Error("Cannot start handshake request when connection is closed");

        
        /* ================ CHECKPOINT ================ *\
        |  Convince peer that this client is legitimate  |
        \* ============================================ */


        // Stage 0: wait for peer to be ready for data
        const responsePromiseStage0 = this.expectResponse(this.connection, 4000) as Promise<NegotiationStage0>;
        
        // Load client keys
        const client = getClient();
        const clientAddressKey = client.identity.addressKey;
        const clientMessageKey = client.identity.messageKey;
        

        // Wait for stage 0 response
        const responseStage0 = await responsePromiseStage0;
        if(!NegotiationStage0.isValid(responseStage0)) throw new Error("Invalid negotiation stage 0");

        const peerAddressKey = await this.importAddressKey(responseStage0.addressKey, this.connection.peer);
        this.contactPublicAddressKey = peerAddressKey;

        // Stage 1: send address key to peer and begin handshakes
        this.connection.send({
            type: "negotiation",
            stage: 1,
            addressKey: await exportJwk(clientAddressKey.publicKey)
        } as NegotiationStage1);

        
        // Begin peer-incited handshake
        const peerHandshakeChallenge = new HandshakeChallenge(peerAddressKey, clientAddressKey.privateKey);
        await peerHandshakeChallenge.receive(this.connection);
        
        // Begin client-incited handshake
        const clientHandshakeChallenge = new HandshakeChallenge(peerAddressKey, clientAddressKey.privateKey);
        await clientHandshakeChallenge.send(this.connection);

        
        /* ============== CHECKPOINT ============== *\
        |      Peer's address key is legitimate      |
        |     Client's address key is legitimate     |
        \* ======================================== */


        // Stage 2: send rsa-encrypted message key
        this.connection.send({
            type: "negotiation",
            stage: 2,
            encryptedMessageKey: await this.encryptRSA(
                peerAddressKey,
                new Uint8Array(encode({
                    key: await exportJwk(clientMessageKey.publicKey),
                    nonce: await bufferToBase64(peerHandshakeChallenge.handshakeData)
                } as ECNegotiationPacket)).buffer
            )
        } as NegotiationStage2);


        // Wait for stage 3 response
        const responseStage3 = await this.expectResponse(this.connection, 5000) as NegotiationStage3;
        if(!NegotiationStage3.isValid(responseStage3)) throw new Error("Invalid negotiation stage 3");

        const responseStage3Processed = await this.decryptRSA(clientAddressKey.privateKey, responseStage3.encryptedMessageKey).then(data => decode(data));
        if(!ECNegotiationPacket.isValid(responseStage3Processed)) throw new Error("Invalid peer message EC key negotiation");

        const nonceStage2 = await base64ToBuffer(responseStage3Processed.nonce);

        if(!buffersEqual(nonceStage2, clientHandshakeChallenge.handshakeData)) throw new Error("Invalid nonce in EC key negotiation");
        const peerMessageKey = await importJwk(responseStage3Processed.key, { name: "ECDH", namedCurve: "P-256" });


        
        /* ============== CHECKPOINT ============== *\
        |      Peer's message key is legitimate      |
        |     Client's message key is legitimate     |
        \* ======================================== */


        this.contactPublicMessageKey = peerMessageKey;
        await this.createSecretKey();

        // Stage 4: send extra data with new message key
        this.connection.send({
            type: "negotiation",
            stage: 4,
            extraData: await this.encrypt(extraData)
        } as NegotiationStage4);
        
        // Wait for stage 5 response
        const responseStage5 = await this.expectResponse(this.connection, 5000) as NegotiationStage5;
        if(!NegotiationStage5.isValid(responseStage5)) throw new Error("Invalid negotiation stage 5");

        const peerExtraData = await this.decrypt(responseStage5.extraData);

        // Authentication complete
        this.authenticated = true;

        return peerExtraData;
    }
    close() {
        this.connection.close();
    }
}