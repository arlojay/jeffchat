import { bufferToBase64 } from "./bufferUtil";
import { DataStream } from "./dataStream";
import { Serializable } from "./serializable";

export class SecureMessage implements Serializable {    
    private static generateNonce(): string {
        const randomBytes = new Uint8Array(512).map(v => Math.random() * 256);
        return bufferToBase64(randomBytes);
    }

    recipient: string;
    message: string;
    nonce: string;

    constructor(recipient: string = "", message: string = "") {
        this.recipient = recipient;
        this.message = message;
        this.nonce = SecureMessage.generateNonce();
    }

    public async serialize(): Promise<ArrayBuffer> {
        const byteSize =
            4 + this.nonce.length * 2 +
            4 + this.message.length * 2 +
            4 + this.recipient.length * 2
        ;

        const stream = new DataStream(new ArrayBuffer(byteSize));
        stream.writeString(this.nonce);
        stream.writeString(this.message);
        stream.writeString(this.recipient);
        return stream.buffer;
    }

    public async deserialize(data: any) {
        const stream = new DataStream(data);
        this.nonce = stream.readString();
        this.message = stream.readString();
        this.recipient = stream.readString();
    }
}