#!/usr/bin/env node
/* Ting! — Sao lưu toàn bộ Firestore → gửi lên Discord webhook.

   Luồng: đọc toàn bộ collections (đệ quy) → JSON → gzip → mã hoá AES-256-GCM
   bằng BACKUP_KEY → tự chia nhỏ theo giới hạn Discord → gửi từng phần qua webhook.
   Toàn bộ xử lý TRONG BỘ NHỚ, KHÔNG ghi file ra đĩa (không để lại rác).

   Bảo mật:
   - Không hardcode secret. Đọc từ biến môi trường hoặc file scripts/.backup-secrets
     (đã .gitignore).
   - Dữ liệu gửi lên Discord là khối MÃ HOÁ MÙ (kể cả metadata) — cần BACKUP_KEY
     để giải mã bằng scripts/restore-discord-backup.cjs.

   Biến môi trường cần:
   - DISCORD_WEBHOOK_URL : URL webhook Discord.
   - BACKUP_KEY          : mật khẩu mã hoá backup (BẮT BUỘC, giữ kỹ — mất là mất backup).
   - FIREBASE_SERVICE_ACCOUNT : nội dung JSON service account (dạng chuỗi, dùng cho CI)
     HOẶC SERVICE_ACCOUNT_PATH : đường dẫn tới file service account .json (chạy local).
*/
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

// ---- Nạp secrets từ file local (nếu có), không ghi đè env đã set ----
function loadLocalSecrets() {
    const p = path.resolve(__dirname, '.backup-secrets');
    if (!fs.existsSync(p)) return;
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const s = line.trim();
        if (!s || s.startsWith('#')) continue;
        const idx = s.indexOf('=');
        if (idx === -1) continue;
        const k = s.slice(0, idx).trim();
        const v = s.slice(idx + 1).trim();
        if (k && process.env[k] === undefined) process.env[k] = v;
    }
}

function requireEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Thiếu biến môi trường ${name}`);
    return v;
}

// ---- Khởi tạo Firebase Admin ----
function initAdmin() {
    const admin = require('firebase-admin');
    if (admin.apps.length) return admin;
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const saPath = process.env.SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let credential;
    if (saJson) {
        credential = admin.credential.cert(JSON.parse(saJson));
    } else if (saPath) {
        const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
        credential = admin.credential.cert(sa);
    } else {
        throw new Error('Chưa cấu hình service account: đặt FIREBASE_SERVICE_ACCOUNT (JSON) hoặc SERVICE_ACCOUNT_PATH (đường dẫn file .json)');
    }
    admin.initializeApp({ credential });
    return admin;
}

// ---- Đệ quy dump toàn bộ Firestore ----
function serializeValue(value) {
    if (value === null || value === undefined) return value;
    if (typeof value?.toDate === 'function') {
        return { __type: 'timestamp', value: value.toDate().toISOString() };
    }
    if (typeof value?.latitude === 'number' && typeof value?.longitude === 'number') {
        return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
    }
    if (Buffer.isBuffer(value)) return { __type: 'bytes', value: value.toString('base64') };
    if (Array.isArray(value)) return value.map(serializeValue);
    if (typeof value === 'object') {
        const out = {};
        for (const k of Object.keys(value)) out[k] = serializeValue(value[k]);
        return out;
    }
    return value;
}

async function dumpCollection(colRef, stats) {
    const snap = await colRef.get();
    const out = {};
    for (const doc of snap.docs) {
        stats.docs += 1;
        const entry = { data: serializeValue(doc.data()) };
        const subcols = await doc.ref.listCollections();
        if (subcols.length) {
            entry.__subcollections = {};
            for (const sc of subcols) {
                entry.__subcollections[sc.id] = await dumpCollection(sc, stats);
            }
        }
        out[doc.id] = entry;
    }
    return out;
}

async function dumpAll(db, stats) {
    const root = await db.listCollections();
    const out = {};
    for (const c of root) {
        stats.collections += 1;
        out[c.id] = await dumpCollection(c, stats);
    }
    return out;
}

// ---- Mã hoá: TBK1 | salt(16) | iv(12) | tag(16) | ciphertext ----
function encryptBlob(plainBuf, backupKey) {
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(backupKey, salt, 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from('TBK1'), salt, iv, tag, enc]);
}

// ---- Chia nhỏ theo giới hạn Discord ----
const MAX_PART_BYTES = 7_800_000; // an toàn dưới mốc 8MB của server chưa boost

function chunkBuffer(buf, size) {
    const parts = [];
    for (let i = 0; i < buf.length; i += size) parts.push(buf.subarray(i, i + size));
    return parts.length ? parts : [Buffer.alloc(0)];
}

// ---- Gửi 1 phần lên Discord webhook (có xử lý rate limit 429) ----
async function uploadPart(webhookUrl, filename, buffer, content) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const form = new FormData();
        form.append('content', content);
        form.append('file', new Blob([buffer]), filename);
        const res = await fetch(webhookUrl, { method: 'POST', body: form });
        if (res.status === 429) {
            let waitMs = 2000;
            try { const j = await res.json(); if (j.retry_after) waitMs = Math.ceil(j.retry_after * 1000) + 250; } catch (e) { /* ignore */ }
            await new Promise(r => setTimeout(r, waitMs));
            continue;
        }
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Discord từ chối (HTTP ${res.status}): ${body.slice(0, 200)}`);
        }
        return;
    }
    throw new Error('Bị rate limit quá nhiều lần, bỏ cuộc');
}

function stamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function main() {
    loadLocalSecrets();
    const webhookUrl = requireEnv('DISCORD_WEBHOOK_URL');
    const backupKey = requireEnv('BACKUP_KEY');

    console.log('→ Kết nối Firestore...');
    const admin = initAdmin();
    const db = admin.firestore();

    console.log('→ Đang dump toàn bộ dữ liệu...');
    const stats = { collections: 0, docs: 0 };
    const dump = await dumpAll(db, stats);
    const meta = {
        app: 'Ting!',
        format: 'ting-fulldb-1',
        exportedAt: new Date().toISOString(),
        stats,
    };
    const json = Buffer.from(JSON.stringify({ meta, data: dump }), 'utf8');
    console.log(`   ${stats.collections} collections, ${stats.docs} documents, ${json.length} bytes (JSON thô).`);

    const gz = zlib.gzipSync(json, { level: 9 });
    const blob = encryptBlob(gz, backupKey);
    console.log(`→ Đã nén + mã hoá: ${blob.length} bytes.`);

    const parts = chunkBuffer(blob, MAX_PART_BYTES);
    const date = stamp();
    console.log(`→ Chia thành ${parts.length} phần, đang gửi lên Discord...`);

    for (let i = 0; i < parts.length; i += 1) {
        const filename = `ting-backup-${date}.tbk.part${String(i + 1).padStart(2, '0')}of${String(parts.length).padStart(2, '0')}`;
        const content = i === 0
            ? `🗄️ **Ting! backup ${date}** — ${stats.docs} docs, ${parts.length} phần, ${blob.length} bytes (đã mã hoá).\nPhần ${i + 1}/${parts.length}`
            : `Phần ${i + 1}/${parts.length} (${date})`;
        await uploadPart(webhookUrl, filename, parts[i], content);
        console.log(`   ✓ Gửi phần ${i + 1}/${parts.length}`);
    }

    console.log('✅ Xong. Không có file nào được ghi ra đĩa.');
}

main().catch(err => {
    console.error('❌ Backup thất bại:', err.message);
    process.exit(1);
});
