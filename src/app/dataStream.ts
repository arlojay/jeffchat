import { throws } from "assert";

export class DataStream {
    public buffer: ArrayBuffer;
    private dataView: DataView;
    private index: number;

    constructor(buffer: ArrayBuffer) {
        this.buffer = buffer;
        this.dataView = new DataView(this.buffer);
        this.index = 0;
    }

    public readByte(): number {
        const value = this.dataView.getUint8(this.index);
        this.index++;
        return value;
    }
    public writeByte(value: number): void {
        this.dataView.setUint8(this.index, value);
        this.index++;
    }

    public readSignedByte(): number {
        const value = this.dataView.getInt8(this.index);
        this.index++;
        return value;
    }
    public writeSignedByte(value: number): void {
        this.dataView.setInt8(this.index, value);
        this.index++;
    }

    public readInt16(): number {
        const value = this.dataView.getInt16(this.index);
        this.index += 2;
        return value;
    }
    public writeInt16(value: number): void {
        this.dataView.setInt16(this.index, value);
        this.index += 2;
    }

    public readUint16(): number {
        const value = this.dataView.getUint16(this.index);
        this.index += 2;
        return value;
    }
    public writeUint16(value: number): void {
        this.dataView.setUint16(this.index, value);
        this.index += 2;
    }

    public readInt32(): number {
        const value = this.dataView.getInt32(this.index);
        this.index += 4;
        return value;
    }
    public writeInt32(value: number): void {
        this.dataView.setInt32(this.index, value);
        this.index += 4;
    }

    public readUint32(): number {
        const value = this.dataView.getUint32(this.index);
        this.index += 4;
        return value;
    }
    public writeUint32(value: number): void {
        this.dataView.setUint32(this.index, value);
        this.index += 4;
    }

    public readInt64(): bigint {
        const value = this.dataView.getBigInt64(this.index);
        this.index += 8;
        return value;
    }
    public writeInt64(value: bigint): void {
        this.dataView.setBigInt64(this.index, value);
        this.index += 8;
    }

    public readUint64(): bigint {
        const value = this.dataView.getBigInt64(this.index);
        this.index += 8;
        return value;
    }
    public writeUint64(value: bigint): void {
        this.dataView.setBigInt64(this.index, value);
        this.index += 8;
    }

    public readFloat32(): number {
        const value = this.dataView.getFloat32(this.index);
        this.index += 4;
        return value;
    }
    public writeFloat32(value: number): void {
        this.dataView.setFloat32(this.index, value);
        this.index += 4;
    }

    public readFloat64(): number {
        const value = this.dataView.getFloat64(this.index);
        this.index += 8;
        return value;
    }
    public writeFloat64(value: number): void {
        this.dataView.setFloat64(this.index, value);
        this.index += 8;
    }



    public writeString(value: string): void {
        this.dataView.setInt32(this.index, value.length);
        this.index += 4;

        for(let i = 0; i < value.length; i++) {
            this.dataView.setUint16(value.charCodeAt(i), this.index);
            this.index += 2;
        }
    }

    public readString(): string {
        const length = this.dataView.getInt32(this.index);
        this.index += 4;

        let value = "";

        for(let i = 0; i < length; i++) {
            value += String.fromCharCode(this.dataView.getUint16(this.index));
            this.index += 2;
        }

        return value;
    }
}