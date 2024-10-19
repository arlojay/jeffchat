import { base64ToBuffer, bufferToBase64, bufferToText, textToBuffer } from "./bufferUtil";

export async function obfuscate(data: string) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const lock = crypto.getRandomValues(new Uint8Array(32));

    const key = await crypto.subtle.importKey(
        "raw",
        lock,
        { name: "AES-GCM" },
        false,
        [ "encrypt" ]
    );

    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key, textToBuffer(data)
    );

    return btoa(JSON.stringify(Array.from(iv)) + "!" + JSON.stringify(Array.from(new Float32Array(lock.buffer))) + "!" + await bufferToBase64(encrypted));
}

export async function deobfuscate(data: string) {
    try {
        const [ ivBase, base64Lock, base64Encrypted ] = atob(data).split("!");
        const iv = new Uint8Array(JSON.parse(ivBase));
        const lock = new Uint8Array(new Float32Array(JSON.parse(base64Lock)).buffer);
        const encrypted = await base64ToBuffer(base64Encrypted);

        const key = await crypto.subtle.importKey(
            "raw",
            lock,
            { name: "AES-GCM" },
            false,
            [ "decrypt" ]
        );

        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key, encrypted
        );
        return bufferToText(decrypted);
    } catch(e) {
        console.debug(e);
        throw new SyntaxError("Corrupted data");
    }
}