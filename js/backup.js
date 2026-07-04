/* Ting! — Sao lưu & Phục hồi (backup/restore)
   Xuất toàn bộ kho tài khoản ra 1 file .ting ĐÃ MÃ HOÁ bằng Master Password,
   để lưu ở nơi khác ngoài Firebase (Google Drive, USB...). Nhập lại khi cần.

   Bảo mật: file backup được mã hoá AES-256-GCM (tái dùng TingCrypto), nên kể cả
   khi file lọt ra ngoài, không có Master Password thì không đọc được.

   Nền tảng:
   - Desktop (Electron) & Web: tải/đọc file bằng Blob + <input type=file> (chạy sẵn).
   - Android: cần plugin @capacitor/filesystem + @capacitor/share để lưu/chia sẻ file
     (tự động dùng nếu có; nếu chưa cài sẽ fallback sang tải kiểu web). */
(function () {
    'use strict';

    var BACKUP_MAGIC = 'ting-backup';
    var BACKUP_FORMAT = 1;

    function nowStamp() {
        var d = new Date();
        var p = function (n) { return String(n).padStart(2, '0'); };
        return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
    }

    function appVersion() {
        try { return document.querySelector('.d-sidebar-version')?.textContent || 'Ting!'; }
        catch (e) { return 'Ting!'; }
    }

    // Gom dữ liệu cần sao lưu (tài khoản đã ở dạng mã hoá per-account sẵn trong Firestore)
    function collectBackupData() {
        var s = window.appState || {};
        return {
            accounts: Array.isArray(s.accounts) ? s.accounts : [],
            trashAccounts: Array.isArray(s.trashAccounts) ? s.trashAccounts : [],
            customCategories: Array.isArray(s.customCategories) ? s.customCategories : [],
        };
    }

    // Tạo nội dung file backup (chuỗi JSON), đã mã hoá toàn bộ bằng Master Password
    async function buildEncryptedBackup(masterPassword) {
        if (!masterPassword) throw new Error('Thiếu Master Password');
        if (typeof encryptAccountData !== 'function') throw new Error('Thiếu module mã hoá');
        var data = collectBackupData();
        var encrypted = await encryptAccountData(data, masterPassword);
        var envelope = {
            magic: BACKUP_MAGIC,
            format: BACKUP_FORMAT,
            app: appVersion(),
            exportedAt: new Date().toISOString(),
            counts: {
                accounts: data.accounts.length,
                categories: data.customCategories.length,
                trash: data.trashAccounts.length,
            },
            payload: encrypted, // { encryptedData, salt, iv }
        };
        return JSON.stringify(envelope, null, 2);
    }

    // Giải mã & đọc file backup → trả về { envelope, data }
    async function readEncryptedBackup(fileText, masterPassword) {
        var envelope;
        try { envelope = JSON.parse(fileText); }
        catch (e) { throw new Error('File backup không hợp lệ (không phải JSON)'); }
        if (!envelope || envelope.magic !== BACKUP_MAGIC || !envelope.payload) {
            throw new Error('File này không phải backup của Ting!');
        }
        if (typeof decryptAccountData !== 'function') throw new Error('Thiếu module giải mã');
        var data;
        try {
            data = await decryptAccountData(envelope.payload, masterPassword);
        } catch (e) {
            throw new Error('Giải mã thất bại — sai Master Password hoặc file hỏng');
        }
        return { envelope: envelope, data: data };
    }

    // ---------- Lưu file ra thiết bị ----------
    function downloadTextFile(filename, text) {
        var blob = new Blob([text], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    // Android: nếu có Capacitor Filesystem + Share thì ghi file rồi mở share sheet
    async function saveViaCapacitor(filename, text) {
        var Cap = window.Capacitor;
        var FS = Cap?.Plugins?.Filesystem;
        var Share = Cap?.Plugins?.Share;
        if (!FS) return false;
        try {
            var res = await FS.writeFile({
                path: filename,
                data: text,
                directory: 'CACHE',
                encoding: 'utf8',
            });
            if (Share && res?.uri) {
                await Share.share({
                    title: 'Sao lưu Ting!',
                    text: 'File sao lưu tài khoản Ting! (đã mã hoá)',
                    url: res.uri,
                    dialogTitle: 'Lưu backup vào Google Drive / nơi khác',
                });
            }
            return true;
        } catch (e) {
            console.warn('Capacitor save/share thất bại, fallback web download:', e);
            return false;
        }
    }

    // ---------- Hành động chính ----------
    async function exportBackup() {
        try {
            var unlocked = true;
            if (typeof requireMasterPassword === 'function') {
                unlocked = await requireMasterPassword('Để tạo file sao lưu mã hoá');
            }
            if (!unlocked) return;
            var master = window.appState?.masterPassword;
            if (!master) { if (typeof showToast === 'function') showToast('Chưa mở khoá Master Password', 'error'); return; }

            var text = await buildEncryptedBackup(master);
            var filename = 'ting-backup-' + nowStamp() + '.ting';

            var savedNative = false;
            if (window.Capacitor?.isNativePlatform?.()) {
                savedNative = await saveViaCapacitor(filename, text);
            }
            if (!savedNative) downloadTextFile(filename, text);

            if (typeof showToast === 'function') showToast('Đã tạo file sao lưu', 'success');
        } catch (error) {
            console.error('❌ Lỗi xuất backup:', error);
            if (typeof showToast === 'function') showToast(error.message || 'Không tạo được backup', 'error');
        }
    }

    // Phục hồi: mở file → giải mã → thêm lại các tài khoản CHƯA có (không ghi đè)
    async function importBackupFromText(fileText) {
        var unlocked = true;
        if (typeof requireMasterPassword === 'function') {
            unlocked = await requireMasterPassword('Để giải mã file sao lưu');
        }
        if (!unlocked) return;
        var master = window.appState?.masterPassword;
        if (!master) { if (typeof showToast === 'function') showToast('Chưa mở khoá Master Password', 'error'); return; }

        var parsed = await readEncryptedBackup(fileText, master);
        var accounts = Array.isArray(parsed.data?.accounts) ? parsed.data.accounts : [];
        if (!accounts.length) {
            if (typeof showToast === 'function') showToast('File backup không có tài khoản', 'error');
            return;
        }

        // Chữ ký để tránh trùng: name|type|encryptedData
        var sig = function (a) { return [a.name, a.type, a.encryptedData].join('|'); };
        var existing = new Set((window.appState?.accounts || []).map(sig));

        var toAdd = accounts.filter(function (a) { return !existing.has(sig(a)); });
        if (!toAdd.length) {
            if (typeof showToast === 'function') showToast('Tất cả tài khoản trong backup đã có sẵn', 'success');
            return;
        }

        if (typeof addAccountToDB !== 'function') {
            if (typeof showToast === 'function') showToast('Không thể ghi dữ liệu (thiếu addAccountToDB)', 'error');
            return;
        }

        var ok = 0;
        for (var i = 0; i < toAdd.length; i++) {
            var acc = Object.assign({}, toAdd[i]);
            delete acc.id; // để Firestore cấp id mới, tránh xung đột
            try {
                var docId = await addAccountToDB(acc);
                if (docId) ok++;
            } catch (e) {
                console.warn('Bỏ qua 1 tài khoản khi phục hồi:', e);
            }
        }
        if (typeof showToast === 'function') {
            showToast('Đã phục hồi ' + ok + '/' + toAdd.length + ' tài khoản', ok ? 'success' : 'error');
        }
    }

    function pickBackupFileAndImport() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ting,application/json';
        input.onchange = function () {
            var file = input.files && input.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function () {
                importBackupFromText(String(reader.result || '')).catch(function (err) {
                    console.error('❌ Lỗi phục hồi backup:', err);
                    if (typeof showToast === 'function') showToast(err.message || 'Không phục hồi được', 'error');
                });
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // Xuất API ra global
    window.TingBackup = {
        buildEncryptedBackup: buildEncryptedBackup,
        readEncryptedBackup: readEncryptedBackup,
        exportBackup: exportBackup,
        importBackupFromText: importBackupFromText,
        pickBackupFileAndImport: pickBackupFileAndImport,
    };
    window.exportBackup = exportBackup;
    window.importBackup = pickBackupFileAndImport;
})();
