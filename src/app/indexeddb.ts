export class ObjectStoreOptions implements IDBObjectStoreParameters {
    autoIncrement?: boolean;
    keyPath?: string | string[] | null;
    indices: IDBValidKey[] = new Array;
    
    addIndex(property: IDBValidKey) {
        this.indices.push(property);
    }
}

export class ObjectStore {
    db: IndexedDatabase;
    name: string;

    private readTransaction: IDBTransaction;
    private writeTransaction: IDBTransaction;
    containsRequest: IDBRequest<IDBValidKey[]>;

    constructor(db: IndexedDatabase, name: string) {
        this.db = db;
        this.name = name;
    }

    createReadTransaction() {
        this.readTransaction = this.db.indexedDB.transaction(this.name, "readonly");
        const rm = (): any => (this.readTransaction as IDBTransaction | null) = null;
        
        this.readTransaction.addEventListener("abort", rm);
        this.readTransaction.addEventListener("complete", rm);
        this.readTransaction.addEventListener("error", rm);
    }
    createWriteTransaction() {
        this.writeTransaction = this.db.indexedDB.transaction(this.name, "readwrite");
        const rm = (): any => (this.writeTransaction as IDBTransaction | null) = null;
        
        this.writeTransaction.addEventListener("abort", rm);
        this.writeTransaction.addEventListener("complete", rm);
        this.writeTransaction.addEventListener("error", rm);
    }

    get(query: IDBValidKey): Promise<any> {
        if(this.readTransaction == null) this.createReadTransaction();

        const store = this.readTransaction.objectStore(this.name);
        const request = store.get(query);

        return new Promise((res, rej) => {
            request.addEventListener("success", () => res(request.result));
            request.addEventListener("error", error => rej(error));
        });
    }

    add(object: any): Promise<any> {
        if(this.writeTransaction == null) this.createWriteTransaction();

        const store = this.writeTransaction.objectStore(this.name);
        const request = store.add(object);

        return new Promise((res, rej) => {
            request.addEventListener("success", () => res(object));
            request.addEventListener("error", error => rej(error));
        });
    }

    put(object: any): Promise<any> {
        if(this.writeTransaction == null) this.createWriteTransaction();

        const store = this.writeTransaction.objectStore(this.name);
        const request = store.put(object);

        return new Promise((res, rej) => {
            request.addEventListener("success", () => res(object));
            request.addEventListener("error", error => rej(error));
        });
    }

    delete(object: any): Promise<any> {
        if(this.writeTransaction == null) this.createWriteTransaction();

        const store = this.writeTransaction.objectStore(this.name);
        const request = store.delete(object);

        return new Promise((res, rej) => {
            request.addEventListener("success", () => res(object));
            request.addEventListener("error", error => rej(error));
        });
    }

    async has(query: IDBValidKey) {
        return await this.get(query) != null;
    }

    getAllKeys(query?: IDBValidKey | IDBKeyRange | null, count?: number): Promise<IDBValidKey[]> {
        if(this.readTransaction == null) this.createReadTransaction();

        const request = this.readTransaction.objectStore(this.name).getAllKeys(query, count);

        return new Promise((res, rej) => {
            request.addEventListener("error", error => rej(error));
            request.addEventListener("success", () => res(request.result));
        })
    }
}

export class IndexedDatabase {
    name: string;
    indexedDB: IDBDatabase;
    private objectStoreOptions: Map<string, ObjectStoreOptions> = new Map;
    private objectStores: Map<string, ObjectStore> = new Map;

    constructor(name: string) {
        this.name = name;
    }

    public createObjectStore(name: string): ObjectStoreOptions {
        const options = new ObjectStoreOptions;
        this.objectStoreOptions.set(name, options);
        return options;
    }

    private async getDatabaseVersion() {
        const databases = await indexedDB.databases();
        const db = databases.find(info => info.name == this.name);

        return db?.version ?? 0;
    }

    public open(): Promise<void> {
        return new Promise(async (res, rej) => {
            const request = indexedDB.open(this.name, await this.getDatabaseVersion() + 1);

            request.addEventListener("upgradeneeded", () => {
                const db = request.result;

                for(const name of this.objectStoreOptions.keys()) {
                    const options = this.objectStoreOptions.get(name);
                    
                    if(db.objectStoreNames.contains(name)) {
                        console.debug("Object store with name", name, "already exists");
                    } else {
                        db.createObjectStore(name, options);
                    }
                }
            });

            request.addEventListener("error", error => rej(error));
            request.addEventListener("blocked", () => rej(new Error("IndexedDB open request was blocked")));

            request.addEventListener("success", () => {
                this.indexedDB = request.result;
                
                for(const name of this.indexedDB.objectStoreNames) {
                    const objectStore = new ObjectStore(this, name);
                    this.objectStores.set(name, objectStore);
                }

                res();
            })
        });
    }

    public objectStore(name: string) {
        return this.objectStores.get(name);
    }

    public close() {
        this.indexedDB.close();
    }
}