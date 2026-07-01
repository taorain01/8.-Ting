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


// ===== TOTP (2FA) — tạo mã 6 số trực tiếp từ secret key =====
function base32ToBytes(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = String(base32 || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
    if (!clean) return null;
    let bits = '';
    for (const ch of clean) {
        const val = alphabet.indexOf(ch);
        if (val < 0) continue;
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return bytes.length ? new Uint8Array(bytes) : null;
}

// Chuỗi có vẻ là secret TOTP hợp lệ (base32, đủ dài) hay không
function isLikelyTotpSecret(value) {
    const clean = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
    // Loại bỏ trường hợp toàn chữ ngắn / mã số 6-8 chữ số tĩnh
    if (/^\d+$/.test(String(value || '').replace(/\s/g, ''))) return false;
    return clean.length >= 16;
}

function totpTimeRemaining(period = 30, timestamp = Date.now()) {
    return period - (Math.floor(timestamp / 1000) % period);
}

async function generateTOTP(secret, options = {}) {
    const digits = options.digits || 6;
    const period = options.period || 30;
    const timestamp = options.timestamp || Date.now();
    const keyBytes = base32ToBytes(secret);
    if (!keyBytes || !keyBytes.length) return null;

    const counter = Math.floor(timestamp / 1000 / period);
    const counterBytes = new Uint8Array(8);
    let temp = counter;
    for (let i = 7; i >= 0; i -= 1) {
        counterBytes[i] = temp & 0xff;
        temp = Math.floor(temp / 256);
    }

    try {
        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
        );
        const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBytes));
        const offset = sig[sig.length - 1] & 0x0f;
        const binary = ((sig[offset] & 0x7f) << 24)
            | ((sig[offset + 1] & 0xff) << 16)
            | ((sig[offset + 2] & 0xff) << 8)
            | (sig[offset + 3] & 0xff);
        return (binary % 10 ** digits).toString().padStart(digits, '0');
    } catch (_) {
        return null;
    }
}

if (typeof window !== 'undefined') {
    window.base32ToBytes = base32ToBytes;
    window.isLikelyTotpSecret = isLikelyTotpSecret;
    window.totpTimeRemaining = totpTimeRemaining;
    window.generateTOTP = generateTOTP;
}
