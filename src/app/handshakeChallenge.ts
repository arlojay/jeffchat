import { DataConnection } from "peerjs";
import { buffersEqual } from "./bufferUtil";

abstract class HandshakeStage {
    type: "handshake";
    stage: number;

    public static isValid(data: unknown): data is HandshakeStage {
        if(data == null) return false;
        if(typeof data != "object") return false;

        if(!("stage" in data)) return false;
        if(typeof data.stage != "number") return false;

        if(!("type" in data)) return false;
        if(data.type != "handshake") return false;

        return true;
    }
}

abstract class HandshakeStage0 extends HandshakeStage {
    declare stage: 0;
    challenge: ArrayBuffer;

    public static isValid(data: unknown): data is HandshakeStage0 {
        if(!HandshakeStage.isValid(data)) return false;
        if(data.stage != 0) return false;

        if(!("challenge" in data)) return false;
        if(!(data.challenge instanceof ArrayBuffer)) return false;

        return true;
    }
}
abstract class HandshakeStage1 extends HandshakeStage {
    declare stage: 1;
    response: ArrayBuffer;

    public static isValid(data: unknown): data is HandshakeStage1 {
        if(!HandshakeStage.isValid(data)) return false;
        if(data.stage != 1) return false;

        if(!("response" in data)) return false;
        if(!(data.response instanceof ArrayBuffer)) return false;

        return true;
    }
}
abstract class HandshakeStage2 extends HandshakeStage {
    declare stage: 2;
    public static isValid(data: unknown): data is HandshakeStage2 {
        if(!HandshakeStage.isValid(data)) return false;
        if(data.stage != 2) return false;

        return true;
    }
}

export class HandshakeChallenge {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
    handshakeData: ArrayBuffer;

    public constructor(publicKey: CryptoKey, privateKey: CryptoKey) {
        this.publicKey = publicKey;
        this.privateKey = privateKey;
    }

    private async expectResponse(connection: DataConnection, timeout: number): Promise<any> {
        let timeoutId: NodeJS.Timeout;

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

    private async generateHandshakeChallenge(): Promise<ArrayBuffer> {
        return crypto.getRandomValues(new Uint8Array(190)).buffer;
    }
    private async encryptHandshakeChallenge(handshakeData: ArrayBuffer) {
        return await crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            this.publicKey, handshakeData
        );
    }
    private async decryptHandshakeResponse(handshakeResponse: ArrayBuffer) {
        return await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            this.privateKey, handshakeResponse
        );
    }
    private handshakeResponseSanityCheck(handshakeResponse: ArrayBuffer) {
        if(handshakeResponse == null) throw new Error("Malformed handshake response");
        if(!(handshakeResponse instanceof ArrayBuffer)) throw new Error("Data is not an ArrayBuffer");
        if(handshakeResponse.byteLength != 256) throw new Error("Malformed handshake response");
    }

    public async send(connection: DataConnection) {
        const handshakeChallenge = await this.generateHandshakeChallenge();
        const encryptedHandshakeChallenge = await this.encryptHandshakeChallenge(handshakeChallenge);
        this.handshakeData = handshakeChallenge;

        // Stage 0: pose challenge
        connection.send({
            type: "handshake",
            stage: 0,
            challenge: encryptedHandshakeChallenge
        } as HandshakeStage0);

        // Stage 1: other side decrypts and encrypts
        const responseStage1 = await this.expectResponse(connection, 5000) as HandshakeStage1;
        if(!HandshakeStage1.isValid(responseStage1)) throw new Error("Malformed handshake response");

        // Stage 2: checks if other side completed the challenge correctly and notify them when finished
        const handshakeResponse = responseStage1.response;
        this.handshakeResponseSanityCheck(handshakeResponse);

        const decryptedHandshakeResponse = await this.decryptHandshakeResponse(handshakeResponse);

        if(!buffersEqual(handshakeChallenge, decryptedHandshakeResponse)) throw new Error("Received key is illegitimate");

        // Notify other side the client has finished
        connection.send({
            type: "handshake",
            stage: 2
        } as HandshakeStage2);
    }

    public async receive(connection: DataConnection) {
        // Stage 0: receieve challenge from other side
        const responseStage0 = await this.expectResponse(connection, 5000) as HandshakeStage0;
        if(!HandshakeStage0.isValid(responseStage0)) throw new Error("Malformed handshake response");

        const encryptedHandshakeChallenge = responseStage0.challenge;
        this.handshakeResponseSanityCheck(encryptedHandshakeChallenge);

        const decryptedHandshakeChallenge = await this.decryptHandshakeResponse(encryptedHandshakeChallenge);
        const encryptedHandshakeResponse = await this.encryptHandshakeChallenge(decryptedHandshakeChallenge);
        this.handshakeData = decryptedHandshakeChallenge;
        
        // Stage 1: send re-encrypted data
        connection.send({
            type: "handshake",
            stage: 1,
            response: encryptedHandshakeResponse
        } as HandshakeStage1);

        // Stage 2: other side notifies they've finished
        const responseStage2 = await this.expectResponse(connection, 5000) as HandshakeStage2;
        if(!HandshakeStage2.isValid(responseStage2)) throw new Error("Malformed handshake response");
    }
}