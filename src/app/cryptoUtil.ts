export interface SerializedJwkPair {
    publicKey: JsonWebKey;
    privateKey: JsonWebKey;
}

export type CryptoAlgorithm = AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm;


export async function exportJwk(key: CryptoKey): Promise<JsonWebKey> {
    return await crypto.subtle.exportKey("jwk", key);
}
export async function exportJwkPair(keyPair: CryptoKeyPair): Promise<SerializedJwkPair> {
    return {
        publicKey: await exportJwk(keyPair.publicKey),
        privateKey: await exportJwk(keyPair.privateKey)
    };
}

export async function forceJwkCapabilities(key: JsonWebKey, capabilities: KeyUsage[]) {
    for(const capability of capabilities) {
        if(!key.key_ops.includes(capability)) key.key_ops.push(capability);
    }
}

export async function importJwk(key: JsonWebKey, algorithm: CryptoAlgorithm): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        "jwk",
        key,
        algorithm,
        true,
        key.key_ops as KeyUsage[]
    );
}

export async function importJwkPair(key: SerializedJwkPair, algorithm: CryptoAlgorithm): Promise<CryptoKeyPair> {
    return {
        privateKey: await importJwk(key.privateKey, algorithm),
        publicKey: await importJwk(key.publicKey, algorithm)
    }
}

export async function deriveMessageSecret(privateMessageKey: CryptoKey, publicMessageKey: CryptoKey) {
    return await crypto.subtle.deriveKey(
        { name: "ECDH", public: publicMessageKey },
        privateMessageKey,
        { name: "AES-GCM", length: 256 },
        false,
        [ "encrypt", "decrypt" ]
    );
}