export interface IDBLoadable {
    load(db: IDBDatabase): Promise<void>;
    save(db: IDBDatabase): Promise<void>;
}