import { importJwk } from "./cryptoUtil";
import { Serializable } from "./serializable";

export interface AddressDBEntry {
    idKey: JsonWebKey;
    messageKey: JsonWebKey;
}

export class Address implements Serializable {
    public idKey: JsonWebKey;
    public messageKey: JsonWebKey;

    private importedIdKey: CryptoKey;
    private importedMessageKey: CryptoKey;

    public id: string;

    private recalcualteId() {
        if(this.idKey == null) this.id = "-";
        else this.id = "A" + this.idKey.n.replace(/\_/g, "0_").replace(/\-/g, "1-") + "Z";
    }

    constructor(identificationKey: JsonWebKey = null, messagingKey: JsonWebKey = null) {
        this.idKey = identificationKey;
        this.messageKey = messagingKey;
        this.recalcualteId();
    }

    async serialize(): Promise<AddressDBEntry> {
        return {
            idKey: this.idKey,
            messageKey: this.messageKey
        };
    }
    async deserialize(data: AddressDBEntry) {
        this.idKey = data.idKey;
        this.messageKey = data.messageKey;
        this.recalcualteId();
    }

    public async getIdKey() {
        if(this.importedIdKey != null) return this.importedIdKey;
        return this.importedIdKey = await importJwk(this.idKey, { name: "RSA-OAEP", hash: "SHA-256" });
    }

    public async getMessageKey() {
        if(this.importedMessageKey != null) return this.importedMessageKey;
        return this.importedMessageKey = await importJwk(this.messageKey, { name: "ECDH", namedCurve: "P-256" });
    }

    public async deriveMessageKey(privateMessageKey: CryptoKey) {
        const publicMessageKey = await this.getMessageKey();

        return await crypto.subtle.deriveKey(
            { name: "ECDH", public: publicMessageKey },
            privateMessageKey,
            { name: "AES-GCM", length: 256 },
            false,
            [ "encrypt", "decrypt" ]
        );
    }
}