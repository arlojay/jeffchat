const charset = new Array(256).fill(0).map((_, i) => String.fromCharCode(i));

export class PacketBuffer {
    view: DataView;
    index: number;
    constructor(arrayBuffer: ArrayBuffer) {
        if(arrayBuffer == null) arrayBuffer = new ArrayBuffer(65536);
        /** @type {DataView} */ this.view = new DataView(arrayBuffer);

        this.index = 0;
    }

    slice(start: number, end?: number) {
        const buffer = new PacketBuffer(this.view.buffer.slice(start, end));
        buffer.index = this.index - start;
        return buffer;
    }
    sliceToIndex() {
        const buffer = new PacketBuffer(this.view.buffer.slice(0, this.index));
        buffer.index = this.index;
        return buffer;
    }

    resetIndex() {
        this.index = 0;
    }


    readBoolean(): boolean {
        return this.view.getUint8(this.index++) > 0;
    }
    readUint8(): number {
        return this.view.getUint8(this.index++);
    }
    readInt8(): number {
        return this.view.getInt8(this.index++);
    }
    readUint16(): number {
        return this.view.getUint16((this.index += 2) - 2, false);
    }
    readInt16(): number {
        return this.view.getInt16((this.index += 2) - 2, false);
    }
    readInt32(): number {
        return this.view.getInt32((this.index += 4) - 4, false);
    }
    readUint32(): number {
        return this.view.getUint32((this.index += 4) - 4, false);
    }
    readFloat(): number {
        return this.view.getFloat32((this.index += 4) - 4, false);
    }
    readString(): string {
        const length = this.view.getInt16(this.index, false);
        const string = new Array(length);
        for(let i = 0; i < length; i++) {
            string[i] = charset[this.view.getUint8(this.index + i + 2)];
        }

        this.index += length + 2;

        return string.join("");
    }

    writeBoolean(boolean: boolean): void {
        return this.view.setUint8(this.index++, boolean ? 1 : 0);
    }
    writeUint8(uint8: number): void {
        return this.view.setUint8(this.index++, uint8);
    }
    writeInt8(int8: number): void {
        return this.view.setInt8(this.index++, int8);
    }
    writeUint16(uint16: number): void {
        return this.view.setUint16((this.index += 2) - 2, uint16, false);
    }
    writeInt16(int16: number): void {
        return this.view.setInt16((this.index += 2) - 2, int16, false);
    }
    writeInt32(int32: number): void {
        return this.view.setInt32((this.index += 4) - 4, int32, false);
    }
    writeUint32(uint32: number): void {
        return this.view.setUint32((this.index += 4) - 4, uint32, false);
    }
    writeFloat(float: number): void {
        return this.view.setFloat32((this.index += 4) - 4, float, false);
    }
    writeString(string: string): void {
        this.view.setInt16(this.index, string.length);

        for(let i = 0; i < string.length; i++) {
            this.view.setUint8(this.index + i + 2, string.charCodeAt(i));
        }
        
        this.index += string.length + 2;
    }
}


export interface Packet {
    getPredictedSize(): number;
    getId(): number;

    serialize(buffer: PacketBuffer): void;
    deserialize(buffer: PacketBuffer): void;
}

export class PacketType {
    static types: Map<number, () => Packet> = new Map();

    static register(id: number, factory: () => Packet): void {
        this.types.set(id, factory);
    }

    static deserialize(buffer: PacketBuffer): Packet {
        const type: number = buffer.readInt32();
        const factory = this.types.get(type);
        if(factory == null) throw new ReferenceError("Unknown packet id " + (type).toString(16));

        const packet: Packet = factory();
        packet.deserialize(buffer);
        return packet;
    }
    static serialize(packet: Packet): PacketBuffer {
        const buffer = new PacketBuffer(new ArrayBuffer(packet.getPredictedSize() + 4));
        buffer.writeInt32(packet.getId());
        // console.time("Serialize packet " + `${packet.getId()}`);
        packet.serialize(buffer);
        if(buffer.index == packet.getPredictedSize() + 4) {
            // console.timeEnd("Serialize packet " + `${packet.getId()}`);
            return buffer;
        }
        buffer.sliceToIndex();
        // console.timeEnd("Serialize packet " + `${packet.getId()}`);
        return buffer;
    }
}