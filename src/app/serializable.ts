export interface Serializable {
    serialize(): Promise<any>;
    deserialize(data: any): Promise<void>;
}