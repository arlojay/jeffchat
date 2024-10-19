import { exportJwk, importJwk } from "../common/cryptoUtil";
import { Serializable } from "./serializable";

export interface AddressDBEntry {
    addressKey: JsonWebKey;
}

export class Address implements Serializable {
    public addressKey: JsonWebKey;
    private importedAddressKey: CryptoKey;
    public id: string;

    private recalcualteId() {
        if(this.addressKey == null) this.id = "-";
        else this.id = "A" + this.addressKey.n.replace(/\_/g, "0_").replace(/\-/g, "1-") + "Z";
    }

    constructor(identificationKey: JsonWebKey = null) {
        this.addressKey = identificationKey;
        this.recalcualteId();
    }

    async serialize(): Promise<AddressDBEntry> {
        return {
            addressKey: this.addressKey
        };
    }
    async deserialize(data: AddressDBEntry) {
        this.addressKey = data.addressKey;
        this.recalcualteId();
    }

    public async getAddressKey() {
        if(this.importedAddressKey != null) return this.importedAddressKey;
        return this.importedAddressKey = await importJwk(this.addressKey, { name: "RSA-OAEP", hash: "SHA-256" });
    }
    public async setAddressKey(clientAddressKey: CryptoKey) {
        this.importedAddressKey = clientAddressKey;
        this.addressKey = await exportJwk(clientAddressKey);
        this.recalcualteId();
    }
}