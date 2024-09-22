import { log } from "./index";

export function createTransaction(db: IDBDatabase, storeId: string, intention: "readonly" | "readwrite", callback: (objectStore: IDBObjectStore) => IDBRequest | Promise<IDBRequest>) {
    return new Promise(async (res, rej) => {
        log("create transaction");
        const transaction = db.transaction([ storeId ], intention);
        log("open object store")
        const objectStore = transaction.objectStore(storeId);
        log("get request");
        const request = await callback(objectStore);
        log("resolve request");
        request.addEventListener("error", error => {
            log("request error: " + error);
            rej(error);
        });
        request.addEventListener("success", () => {
            log("request success");
            res(request.result);
        });
    })
}

export async function getObject(db: IDBDatabase, storeId: string, objectId: string): Promise<any> {
    console.debug("get", storeId, objectId);
    return await createTransaction(db, storeId, "readonly", objectStore => objectStore.get(objectId));
}
export async function addObject(db: IDBDatabase, storeId: string, value: any) {
    console.debug("add", storeId, value);
    return await createTransaction(db, storeId, "readwrite", objectStore => objectStore.add(value));
}
export async function putObject(db: IDBDatabase, storeId: string, value: any) {
    console.debug("put", storeId, value);
    return await createTransaction(db, storeId, "readwrite", objectStore => objectStore.put(value));
}
export async function deleteObject(db: IDBDatabase, storeId: string, objectId: string) {
    console.debug("delete", storeId, objectId);
    return await createTransaction(db, storeId, "readwrite", objectStore => objectStore.delete(objectId));
}
export async function hasObject(db: IDBDatabase, storeId: string, objectId: string) {
    console.debug("has", storeId, objectId);
    return await getObject(db, storeId, objectId) != null;
}