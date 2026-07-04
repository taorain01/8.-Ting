/* Ting! — Mở khoá bằng vân tay / khuôn mặt (mobile)
   Dùng plugin @capgo/capacitor-native-biometric (khi đã cài + build lại APK).
   Cơ chế: sinh trắc học KHÔNG tự giải mã được dữ liệu (khoá AES dẫn xuất từ
   Master Password). Nên khi bật, ta lưu Master Password vào Android Keystore
   (mã hoá phần cứng), khoá sau lớp sinh trắc. Quét vân tay đúng → lấy lại
   Master Password từ Keystore → mở khoá.

   AN TOÀN: nếu plugin/Capacitor chưa có (web, desktop, hoặc APK chưa build lại),
   mọi hàm tự no-op để không phá luồng nhập PIN hiện tại. */
(function () {
    'use strict';

    var SERVER = 'app.ting.manager';
    var FLAG = 'ting.biometricEnabled';

    function plugin() {
        return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeBiometric;
    }
    function isNative() {
        try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
        catch (e) { return false; }
    }

    async function isAvailable() {
        var p = plugin();
        if (!p || !isNative()) return false;
        try {
            var r = await p.isAvailable();
            return !!(r && r.isAvailable);
        } catch (e) { return false; }
    }

    function isEnabled() {
        try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; }
    }

    async function isReady() {
        return isEnabled() && (await isAvailable());
    }

    async function enable(masterPassword) {
        var p = plugin();
        if (!p) throw new Error('Bản app này chưa hỗ trợ sinh trắc học — cần cập nhật');
        if (!(await isAvailable())) throw new Error('Chưa thiết lập vân tay/khuôn mặt trên thiết bị');
        if (!masterPassword) throw new Error('Chưa có Master Password để lưu');
        await p.verifyIdentity({
            reason: 'Xác nhận để bật mở khoá bằng sinh trắc học',
            title: 'Ting!',
            subtitle: 'Xác thực bằng vân tay / khuôn mặt',
        });
        await p.setCredentials({ username: 'master', password: String(masterPassword), server: SERVER });
        try { localStorage.setItem(FLAG, '1'); } catch (e) { /* ignore */ }
    }

    async function disable() {
        var p = plugin();
        try { if (p) await p.deleteCredentials({ server: SERVER }); } catch (e) { /* ignore */ }
        try { localStorage.removeItem(FLAG); } catch (e) { /* ignore */ }
    }

    // Trả về Master Password nếu sinh trắc thành công; null nếu không / bị huỷ
    async function tryUnlock(reason) {
        if (!(await isReady())) return null;
        var p = plugin();
        try {
            await p.verifyIdentity({
                reason: reason || 'Mở khoá Ting!',
                title: 'Ting!',
                subtitle: 'Dùng vân tay / khuôn mặt',
            });
            var creds = await p.getCredentials({ server: SERVER });
            return creds && creds.password ? creds.password : null;
        } catch (e) {
            return null; // huỷ hoặc thất bại → để luồng PIN xử lý tiếp
        }
    }

    // Cập nhật credential sau khi mở khoá PIN thành công (giữ đồng bộ nếu đã bật)
    async function onMasterUnlocked(masterPassword) {
        if (!isEnabled() || !masterPassword) return;
        var p = plugin();
        if (!p || !(await isAvailable())) return;
        try { await p.setCredentials({ username: 'master', password: String(masterPassword), server: SERVER }); }
        catch (e) { /* ignore */ }
    }

    window.TingBiometric = {
        isAvailable: isAvailable,
        isEnabled: isEnabled,
        isReady: isReady,
        enable: enable,
        disable: disable,
        tryUnlock: tryUnlock,
        onMasterUnlocked: onMasterUnlocked,
    };
})();
