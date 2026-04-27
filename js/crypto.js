/* Ting! - Client-side crypto helpers
   Zero-knowledge account encryption using Web Crypto API */

const TING_CRYPTO_ITERATIONS = 600000;
const TING_CRYPTO_KEY_ALGORITHM = 'AES-GCM';

function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function generateSalt(length = 16) {
    const salt = new Uint8Array(length);
    crypto.getRandomValues(salt);
    return bytesToBase64(salt);
}

function generateIv(length = 12) {
    const iv = new Uint8Array(length);
    crypto.getRandomValues(iv);
    return bytesToBase64(iv);
}

async function importPasswordMaterial(masterPassword) {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(masterPassword),
        'PBKDF2',
        false,
        ['deriveKey', 'deriveBits']
    );
}

async function deriveMasterKey(masterPassword, salt) {
    const material = await importPasswordMaterial(masterPassword);
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: base64ToBytes(salt),
            iterations: TING_CRYPTO_ITERATIONS,
            hash: 'SHA-256',
        },
        material,
        { name: TING_CRYPTO_KEY_ALGORITHM, length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptAccountData(data, masterPassword) {
    const salt = generateSalt();
    const iv = generateIv();
    const key = await deriveMasterKey(masterPassword, salt);
    const plaintext = new TextEncoder().encode(JSON.stringify(data || {}));
    const encrypted = await crypto.subtle.encrypt(
        { name: TING_CRYPTO_KEY_ALGORITHM, iv: base64ToBytes(iv) },
        key,
        plaintext
    );

    return {
        encryptedData: bytesToBase64(new Uint8Array(encrypted)),
        salt,
        iv,
    };
}

async function decryptAccountData(encryptedPayload, masterPassword) {
    if (!encryptedPayload?.encryptedData || !encryptedPayload?.salt || !encryptedPayload?.iv) {
        throw new Error('Thiếu dữ liệu mã hoá');
    }

    const key = await deriveMasterKey(masterPassword, encryptedPayload.salt);
    const decrypted = await crypto.subtle.decrypt(
        { name: TING_CRYPTO_KEY_ALGORITHM, iv: base64ToBytes(encryptedPayload.iv) },
        key,
        base64ToBytes(encryptedPayload.encryptedData)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
}

async function hashMasterPassword(masterPassword, salt) {
    const effectiveSalt = salt || generateSalt();
    const material = await importPasswordMaterial(masterPassword);
    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: base64ToBytes(effectiveSalt),
            iterations: TING_CRYPTO_ITERATIONS,
            hash: 'SHA-256',
        },
        material,
        256
    );
    return bytesToBase64(new Uint8Array(bits));
}

function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    let diff = a.length ^ b.length;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
        diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return diff === 0;
}

async function verifyMasterPasswordHash(masterPassword, storedHash, salt) {
    const candidateHash = await hashMasterPassword(masterPassword, salt);
    return timingSafeEqual(candidateHash, storedHash);
}

window.TingCrypto = {
    generateSalt,
    generateIv,
    deriveMasterKey,
    encryptAccountData,
    decryptAccountData,
    hashMasterPassword,
    verifyMasterPassword: verifyMasterPasswordHash,
    verifyMasterPasswordHash,
};

window.generateSalt = generateSalt;
window.generateIv = generateIv;
window.deriveMasterKey = deriveMasterKey;
window.encryptAccountData = encryptAccountData;
window.decryptAccountData = decryptAccountData;
window.hashMasterPassword = hashMasterPassword;
window.verifyMasterPasswordHash = verifyMasterPasswordHash;
