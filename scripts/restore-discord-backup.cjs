#!/usr/bin/env node
/* Ting! — Giải mã & ghép backup tải về từ Discord.

   Cách dùng:
     1. Tải TẤT CẢ các phần (ting-backup-<date>.tbk.partNNofMM) về 1 thư mục.
     2. Chạy:
        set BACKUP_KEY=<mật khẩu backup>   (Windows CMD)
        node scripts/restore-discord-backup.cjs <thư-mục-chứa-parts> [file-json-đầu-ra]

   Script sẽ ghép các phần theo đúng thứ tự, giải mã bằng BACKUP_KEY, giải nén,
   và ghi ra file JSON (mặc định: ting-backup-restored.json).

   Lưu ý: script này CHỈ dựng lại file JSON để bạn kiểm tra / phục hồi thủ công.
   Nó KHÔNG tự ghi ngược vào Firestore (tránh rủi ro ghi đè). */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

function fail(msg) {
    console.error('❌ ' + msg);
    process.exit(1);
}

const inputDir = process.argv[2];
const outFile = process.argv[3] || 'ting-backup-restored.json';
if (!inputDir) fail('Thiếu tham số: node scripts/restore-discord-backup.cjs <thư-mục-parts> [output.json]');
if (!fs.existsSync(inputDir)) fail('Không tìm thấy thư mục: ' + inputDir);

const backupKey = process.env.BACKUP_KEY;
if (!backupKey) fail('Thiếu biến môi trường BACKUP_KEY');

// Gom các file part, sắp theo số thứ tự partNN
const files = fs.readdirSync(inputDir)
    .filter(f => /\.tbk\.part\d+of\d+$/i.test(f))
    .map(f => {
        const m = f.match(/\.part(\d+)of(\d+)$/i);
        return { f, idx: Number(m[1]), total: Number(m[2]) };
    })
    .sort((a, b) => a.idx - b.idx);

if (!files.length) fail('Không thấy file phần nào (dạng *.tbk.partNNofMM) trong thư mục');
const total = files[0].total;
if (files.length !== total) {
    fail(`Thiếu phần: có ${files.length}/${total} phần. Cần đủ tất cả trước khi giải mã.`);
}

console.log(`→ Ghép ${files.length} phần...`);
const blob = Buffer.concat(files.map(x => fs.readFileSync(path.join(inputDir, x.f))));

// Định dạng: TBK1 | salt(16) | iv(12) | tag(16) | ciphertext
if (blob.slice(0, 4).toString() !== 'TBK1') fail('File không đúng định dạng backup Ting! (thiếu magic TBK1)');
const salt = blob.subarray(4, 20);
const iv = blob.subarray(20, 32);
const tag = blob.subarray(32, 48);
const ciphertext = blob.subarray(48);

console.log('→ Giải mã...');
let gz;
try {
    const key = crypto.scryptSync(backupKey, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    gz = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
} catch (e) {
    fail('Giải mã thất bại — sai BACKUP_KEY hoặc file hỏng/thiếu phần');
}

console.log('→ Giải nén...');
const json = zlib.gunzipSync(gz);
fs.writeFileSync(outFile, json);

try {
    const parsed = JSON.parse(json.toString('utf8'));
    console.log(`✅ Đã khôi phục: ${outFile}`);
    console.log(`   Xuất lúc: ${parsed?.meta?.exportedAt}`);
    console.log(`   ${parsed?.meta?.stats?.collections} collections, ${parsed?.meta?.stats?.docs} documents.`);
} catch (e) {
    console.log(`✅ Đã ghi ${outFile} (không parse được meta, nhưng file đã giải mã).`);
}
