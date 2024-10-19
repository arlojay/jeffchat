import { exportJwkPair, importJwkPair } from "../common/cryptoUtil";
import { Serializable } from "./serializable";
import { obfuscate } from "../common/obscurify";
import { Contact } from "./contact";

export class Identity implements Serializable {
    public self: Contact = new Contact;

    addressKey: CryptoKeyPair;
    messageKey: CryptoKeyPair;

    get username() {
        return this.self.username;
    }

    async createNew(username: string) {
        this.self.username = username;

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

        await this.self.address.setAddressKey(this.addressKey.publicKey);
    }

    async serialize(): Promise<any> {
        return {
            contact: await this.self.serialize(),
            addressKey: await exportJwkPair(this.addressKey),
            messageKey: await exportJwkPair(this.messageKey)
        }
    }
    async deserialize(data: any): Promise<void> {
        await this.self.deserialize(data.contact);
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
            this.self.address.addressKey, this.username
        ]));
    }
}