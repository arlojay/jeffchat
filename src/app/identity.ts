import { Address } from "./address";
import { exportJwkPair, exportJwk, importJwkPair } from "./cryptoUtil";
import { Serializable } from "./serializable";
import { obfuscate } from "./obscurify";

export class Identity implements Serializable {
    username: string;
    address: Address;
    addressKey: CryptoKeyPair;
    messageKey: CryptoKeyPair;

    constructor() {
        this.username = "";
        this.address = new Address;
    }
    async createNew(username: string) {
        this.username = username;

        this.addressKey = await crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([ 1, 0, 1 ]),
                hash: "SHA-256",
            },
            true,
            [ "encrypt", "decrypt" ]
        );

        this.messageKey = await crypto.subtle.generateKey(
            {
                name: "ECDH",
                namedCurve: "P-256"
            },
            true,
            [ "deriveKey", "deriveBits" ]
        );

        this.address = new Address(
            await exportJwk(this.addressKey.publicKey),
            await exportJwk(this.messageKey.publicKey)
        );
    }

    async serialize(): Promise<any> {
        return {
            username: this.username,
            address: await this.address.serialize(),
            addressKey: await exportJwkPair(this.addressKey),
            messageKey: await exportJwkPair(this.messageKey)
        }
    }
    async deserialize(data: any): Promise<void> {
        this.username = data.username;
        this.address.deserialize(data.address);
        this.addressKey = await importJwkPair(data.addressKey, {
            name: "RSA-OAEP",
            hash: "SHA-256",
        });
        this.messageKey = await importJwkPair(data.messageKey, {
            name: "ECDH",
            namedCurve: "P-256"
        });
    }

    async exportIdentityFile(): Promise<string> {
        return await obfuscate(JSON.stringify([
            this.address.addressKey, this.username
        ]));
    }
}