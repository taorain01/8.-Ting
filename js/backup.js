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

    var pendingRestore = null;

    function normalizeBackupData(data) {
        var accounts = Array.isArray(data?.accounts) ? data.accounts.filter(function (item) { return item && item.isDeleted !== true; }) : [];
        var trashAccounts = Array.isArray(data?.trashAccounts) ? data.trashAccounts.filter(Boolean) : [];
        if (Array.isArray(data?.accounts)) trashAccounts = trashAccounts.concat(data.accounts.filter(function (item) { return item?.isDeleted === true; }));
        return {
            accounts: accounts,
            trashAccounts: trashAccounts,
            customCategories: Array.isArray(data?.customCategories) ? data.customCategories.filter(function (item) { return item?.id && item?.name; }) : [],
        };
    }

    function normalizedCategoryName(value) {
        return String(value || '').trim().toLocaleLowerCase('vi-VN');
    }

    function uniqueRestoredCategoryId(sourceId, usedIds) {
        var base = String(sourceId || 'category').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'category';
        var candidate = base + '-restored';
        var index = 2;
        while (usedIds.has(candidate)) candidate = base + '-restored-' + index++;
        usedIds.add(candidate);
        return candidate;
    }

    function buildCategoryRestorePlan(incoming, existing, includeNew) {
        var current = (Array.isArray(existing) ? existing : []).map(function (item) { return Object.assign({}, item); });
        var byId = new Map(current.map(function (item) { return [String(item.id), item]; }));
        var byName = new Map(current.map(function (item) { return [normalizedCategoryName(item.name), item]; }));
        var usedIds = new Set(current.map(function (item) { return String(item.id); }));
        var idMap = {};
        var added = [];
        var conflicts = [];
        (Array.isArray(incoming) ? incoming : []).forEach(function (category) {
            var sourceId = String(category?.id || '');
            var sourceName = String(category?.name || '').trim();
            if (!sourceId || !sourceName) return;
            var sameId = byId.get(sourceId);
            var sameName = byName.get(normalizedCategoryName(sourceName));
            if (sameId && normalizedCategoryName(sameId.name) === normalizedCategoryName(sourceName)) {
                idMap[sourceId] = sameId.id;
                return;
            }
            if (sameName) {
                idMap[sourceId] = sameName.id;
                return;
            }
            if (!includeNew) {
                idMap[sourceId] = null;
                return;
            }
            var targetId = sameId ? uniqueRestoredCategoryId(sourceId, usedIds) : sourceId;
            if (!sameId) usedIds.add(targetId);
            if (sameId) conflicts.push('Danh mục "' + sourceName + '" được đổi ID vì ' + sourceId + ' đang được dùng');
            var restored = Object.assign({}, category, { id: targetId, name: sourceName, order: current.length + added.length });
            idMap[sourceId] = targetId;
            added.push(restored);
            byId.set(targetId, restored);
            byName.set(normalizedCategoryName(sourceName), restored);
        });
        return { merged: current.concat(added), idMap: idMap, added: added, conflicts: conflicts };
    }

    function backupAccountFingerprint(account) {
        return [account?.name, account?.type, account?.platform, account?.encryptedData, account?.username]
            .map(function (item) { return String(item || '').trim().toLocaleLowerCase('vi-VN'); })
            .join('|');
    }

    function buildAccountRestoreCandidates(incoming, existing) {
        var current = Array.isArray(existing) ? existing : [];
        var ids = new Set(current.map(function (item) { return String(item?.id || ''); }).filter(Boolean));
        var fingerprints = new Set(current.map(backupAccountFingerprint));
        var candidates = [];
        var conflicts = [];
        (Array.isArray(incoming) ? incoming : []).forEach(function (account) {
            var sourceId = String(account?.id || '');
            var label = String(account?.name || 'Tài khoản');
            var fingerprint = backupAccountFingerprint(account);
            if (sourceId && ids.has(sourceId)) conflicts.push('Bỏ qua "' + label + '": ID đã tồn tại');
            else if (fingerprints.has(fingerprint)) conflicts.push('Bỏ qua "' + label + '": nội dung đã tồn tại');
            else {
                candidates.push(account);
                fingerprints.add(fingerprint);
            }
        });
        return { candidates: candidates, conflicts: conflicts };
    }

    function createBackupRestorePreview(data, state) {
        var normalized = normalizeBackupData(data);
        var current = state || window.appState || {};
        var existing = (current.accounts || []).concat(current.trashAccounts || []);
        var activePlan = buildAccountRestoreCandidates(normalized.accounts, existing);
        var trashPlan = buildAccountRestoreCandidates(normalized.trashAccounts, existing.concat(activePlan.candidates));
        var categoryPlan = buildCategoryRestorePlan(normalized.customCategories, current.customCategories || [], true);
        return {
            data: normalized,
            activeAccounts: activePlan.candidates,
            trashAccounts: trashPlan.candidates,
            categories: categoryPlan.added,
            conflicts: activePlan.conflicts.concat(trashPlan.conflicts, categoryPlan.conflicts),
            counts: { active: activePlan.candidates.length, trash: trashPlan.candidates.length, categories: categoryPlan.added.length },
        };
    }

    async function parseBackupForRestore(fileText, masterPassword, state) {
        var parsed = await readEncryptedBackup(fileText, masterPassword);
        var data = normalizeBackupData(parsed.data);
        return { envelope: parsed.envelope, data: data, preview: createBackupRestorePreview(data, state || window.appState) };
    }

    function remapBackupAccount(account, idMap, isDeleted) {
        var restored = Object.assign({}, account);
        delete restored.id;
        delete restored.pendingSync;
        restored.categoryIds = (Array.isArray(account?.categoryIds) ? account.categoryIds : [])
            .map(function (id) { return idMap[String(id)] || null; })
            .filter(Boolean);
        restored.isDeleted = isDeleted === true;
        restored.deletedAt = isDeleted ? (account.deletedAt || new Date().toISOString()) : null;
        return restored;
    }

    async function persistBackupAccount(account) {
        if (window.appState?.isDemo) {
            var restored = Object.assign({ id: 'restored_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }, account);
            (restored.isDeleted ? window.appState.trashAccounts : window.appState.accounts).unshift(restored);
            return restored.id;
        }
        if (typeof addAccountToDB !== 'function') throw new Error('Không thể ghi dữ liệu tài khoản');
        return addAccountToDB(account);
    }

    async function applyBackupRestore(selection) {
        var parsed = selection?.parsed || pendingRestore;
        if (!parsed?.data) throw new Error('Chưa có bản xem trước để khôi phục');
        var includeActive = selection?.includeActive !== false;
        var includeTrash = selection?.includeTrash !== false;
        var includeCategories = selection?.includeCategories !== false;
        var current = window.appState || {};
        var preview = createBackupRestorePreview(parsed.data, current);
        var categoryPlan = buildCategoryRestorePlan(parsed.data.customCategories, current.customCategories || [], includeCategories);
        if (includeCategories && categoryPlan.added.length) {
            if (current.isDemo) current.customCategories = categoryPlan.merged;
            else {
                if (typeof saveUserCategories !== 'function' || !(await saveUserCategories(categoryPlan.merged))) throw new Error('Không lưu được danh mục từ backup');
            }
        }
        var accounts = [];
        if (includeActive) accounts = accounts.concat(preview.activeAccounts.map(function (item) { return remapBackupAccount(item, categoryPlan.idMap, false); }));
        if (includeTrash) accounts = accounts.concat(preview.trashAccounts.map(function (item) { return remapBackupAccount(item, categoryPlan.idMap, true); }));
        var result = { attempted: accounts.length, restored: 0, failed: 0, categoriesAdded: includeCategories ? categoryPlan.added.length : 0, conflicts: preview.conflicts };
        for (var i = 0; i < accounts.length; i += 1) {
            try {
                if (await persistBackupAccount(accounts[i])) result.restored += 1;
                else result.failed += 1;
            } catch (error) {
                result.failed += 1;
                console.warn('Bỏ qua 1 tài khoản khi phục hồi:', error);
            }
        }
        if (typeof updateHeader === 'function') updateHeader();
        return result;
    }

    function backupPreviewHtml(parsed) {
        var preview = parsed.preview;
        var safe = typeof escapeHtml === 'function' ? escapeHtml : function (value) { return String(value || '').replace(/[&<>"']/g, ''); };
        var conflicts = preview.conflicts.length ? '<div class="ting-backup-conflicts"><strong>Sẽ bỏ qua / điều chỉnh</strong>' + preview.conflicts.slice(0, 8).map(function (item) { return '<div>• ' + safe(item) + '</div>'; }).join('') + '</div>' : '';
        return '<div class="ting-backup-preview"><p>Chọn dữ liệu muốn nhập. Ting! giữ nguyên dữ liệu hiện có.</p>'
            + '<label class="ting-backup-choice"><input type="checkbox" id="backup-restore-active" checked><span>Tài khoản đang dùng</span><strong>' + preview.counts.active + '</strong></label>'
            + '<label class="ting-backup-choice"><input type="checkbox" id="backup-restore-trash" checked><span>Tài khoản trong thùng rác</span><strong>' + preview.counts.trash + '</strong></label>'
            + '<label class="ting-backup-choice"><input type="checkbox" id="backup-restore-categories" checked><span>Danh mục mới</span><strong>' + preview.counts.categories + '</strong></label>'
            + conflicts + '<button type="button" id="backup-restore-confirm" class="btn btn-primary" style="margin-top:18px" onclick="confirmBackupRestore()">Khôi phục dữ liệu đã chọn</button></div>';
    }

    function openBackupRestorePreview(parsed) {
        if (typeof openModal !== 'function') throw new Error('Không thể mở màn hình xem trước');
        pendingRestore = parsed;
        openModal('Xem trước khôi phục', backupPreviewHtml(parsed));
    }

    async function confirmBackupRestore() {
        var button = document.getElementById('backup-restore-confirm');
        if (button) button.disabled = true;
        try {
            var result = await applyBackupRestore({
                parsed: pendingRestore,
                includeActive: document.getElementById('backup-restore-active')?.checked !== false,
                includeTrash: document.getElementById('backup-restore-trash')?.checked !== false,
                includeCategories: document.getElementById('backup-restore-categories')?.checked !== false,
            });
            if (typeof closeModal === 'function') closeModal();
            pendingRestore = null;
            var message = 'Đã phục hồi ' + result.restored + '/' + result.attempted + ' tài khoản';
            if (result.categoriesAdded) message += ', ' + result.categoriesAdded + ' danh mục';
            if (typeof showToast === 'function') showToast(message, result.failed ? 'warning' : 'success');
            return result;
        } catch (error) {
            console.error('Backup restore failed:', error);
            if (typeof showToast === 'function') showToast(error?.message || 'Không thể khôi phục bản sao lưu', 'error');
            return null;
        } finally {
            if (button) button.disabled = false;
        }
    }

    // Phục hồi: giải mã, xem trước, rồi merge dữ liệu được chọn mà không ghi đè.
    async function importBackupFromText(fileText) {
        var unlocked = true;
        if (typeof requireMasterPassword === 'function') {
            unlocked = await requireMasterPassword('Để giải mã file sao lưu');
        }
        if (!unlocked) return null;
        var master = window.appState?.masterPassword;
        if (!master) {
            if (typeof showToast === 'function') showToast('Chưa mở khoá Master Password', 'error');
            return null;
        }
        var parsed = await parseBackupForRestore(fileText, master, window.appState);
        var total = parsed.preview.counts.active + parsed.preview.counts.trash + parsed.preview.counts.categories;
        if (!total && !parsed.preview.conflicts.length) {
            if (typeof showToast === 'function') showToast('File backup không có dữ liệu để khôi phục', 'error');
            return parsed;
        }
        openBackupRestorePreview(parsed);
        return parsed;
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
        parseBackupForRestore: parseBackupForRestore,
        applyBackupRestore: applyBackupRestore,
        createBackupRestorePreview: createBackupRestorePreview,
        buildCategoryRestorePlan: buildCategoryRestorePlan,
        exportBackup: exportBackup,
        importBackupFromText: importBackupFromText,
        pickBackupFileAndImport: pickBackupFileAndImport,
    };
    window.confirmBackupRestore = confirmBackupRestore;
    window.exportBackup = exportBackup;
    window.importBackup = pickBackupFileAndImport;
})();
