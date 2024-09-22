import { log } from ".";

export function bufferToBase64(data: ArrayBuffer|Uint8Array): Promise<string> {
    return new Promise((res, rej) => {
        const fileReader = new FileReader();
        fileReader.readAsDataURL(new Blob([data]));
        fileReader.addEventListener("load", () => {
            res((fileReader.result as string).split(",")[1])
        })
        fileReader.addEventListener("error", (e) => {
            rej(e);
        })
    });
}
export async function base64ToBuffer(base64: string) {
    const url = "data:application/octet-stream;base64," + base64;
    return await fetch(url).then(v => v.arrayBuffer());
}

export function textToBuffer(text: string): ArrayBuffer {
    let array = new Uint16Array(text.length);

    for(let i = 0; i < text.length; i++) {
        array[i] = text.charCodeAt(i);
    }

    return array.buffer;
}
export function bufferToText(buffer: ArrayBuffer): string {
    const array = new Uint16Array(buffer);
    let data = new Array(array.length);

    for(let i = 0; i < array.length; i++) {
        data[i] = String.fromCharCode(array[i]);
    }

    return data.join("");
}