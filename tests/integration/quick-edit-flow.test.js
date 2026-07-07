// ============================================================================
// Feature: quick-edit-account-detail — Task 3.5
//   Integration/mock test cho luồng VÀO Chế độ sửa nhanh (enterQuickEditMode)
//   và luồng LƯU (confirmQuickEdit) của Quick_Edit_Controller trong
//   `js/desktop-app.js`.
//
//   Cách tiếp cận: nạp TOÀN BỘ `js/desktop-app.js` vào sandbox vm (qua helper
//   tests/helpers/ui-loader.cjs → loadDesktopApp) và nạp thêm lớp logic thuần
//   `js/quick-edit-core.js` vào `window` để controller dùng đúng các hàm
//   computeDirtyFields / buildQuickEditPayload / validate... như khi chạy thật.
//   Sau khi nạp, ta THAY THẾ (mock/spy) các hàm hạ tầng bảo mật ở phạm vi global
//   của sandbox: getSensitiveAccountData, requireMasterPassword, encryptAccountData,
//   updateAccountInDB (cùng vài phụ trợ showToast/maskUsername/renderDetail).
//
//   Kiểm chứng:
//     1) enterQuickEditMode CHỈ set `active` sau khi mở khoá thành công
//        (getSensitiveAccountData trả dữ liệu) — Yêu cầu 3.1.
//     2) getSensitiveAccountData trả null (huỷ/sai Master) thì KHÔNG set active,
//        giữ Chế độ xem — Yêu cầu 3.3 (nhánh của 3.1).
//     3) Phiên đã mở khoá (activeDecryptedAccount có sẵn) thì chuyển THẲNG sang
//        Chế độ sửa nhanh, KHÔNG hỏi lại Master — Yêu cầu 3.2.
//     4) confirmQuickEdit với Trường nhạy cảm dirty gọi ĐÚNG THỨ TỰ
//        requireMasterPassword → encryptAccountData → updateAccountInDB — Yêu cầu 4.5.
//
//   Ghi chú: vitest bật `globals: true` nên describe/it/expect/vi là biến toàn
//   cục, KHÔNG require('vitest').
//
// Validates: Requirements 3.1, 3.2, 4.5
// ============================================================================

const { loadDesktopApp, makeElement } = require('../helpers/ui-loader.cjs');
// Lớp logic thuần được nạp vào window để controller dùng đúng như bản thật.
const quickEditCore = require('../../js/quick-edit-core.js');

// ---------------------------------------------------------------------------
// Nạp desktop-app.js vào sandbox vm; đính kèm quick-edit-core lên window.
// Trả về sandbox để test gọi trực tiếp enterQuickEditMode/confirmQuickEdit và
// gán mock cho các hàm bảo mật ở phạm vi global.
// LƯU Ý: desktop-app.js GHI ĐÈ window.appState lúc load, nên mọi thiết lập
// appState phải thực hiện SAU khi nạp (trên sandbox.window.appState).
// ---------------------------------------------------------------------------
function loadApp({ elements = {} } = {}) {
    const { sandbox } = loadDesktopApp({
        elements,
        // Đưa toàn bộ API logic thuần lên window (computeDirtyFields,
        // buildQuickEditPayload, isValidQuickEdit2fa, validateQuickEditLengths,
        // normalizeQuickEditValue, truncateToLimit, QUICK_EDIT_FIELDS).
        window: { ...quickEditCore },
    });
    return sandbox;
}

// Tạo phần tử input giả có sẵn `value` để collectQuickEditValues đọc được.
function inputWithValue(value) {
    const el = makeElement();
    el.value = value;
    return el;
}

// ===========================================================================
// enterQuickEditMode — chỉ set active sau khi mở khoá thành công (3.1, 3.3)
// ===========================================================================
describe('enterQuickEditMode — chỉ vào Chế độ sửa nhanh khi mở khoá thành công', () => {
    it('mở khoá thành công (getSensitiveAccountData trả dữ liệu) → set active=true + chụp snapshot + renderDetail', async () => {
        const sandbox = loadApp();

        // Tài khoản email, chưa ở Chế độ sửa nhanh.
        const acc = { id: 'acc-ok', authMethod: 'email', sellerName: 'Shop A' };
        sandbox.window.appState.accounts = [acc];
        sandbox.window.appState.quickEdit = null;
        sandbox.window.appState.activeDecryptedAccount = null;

        // Mock hạ tầng: getSensitiveAccountData mở khoá THÀNH CÔNG.
        const getSensitive = vi.fn(async () => ({
            username: 'user@example.com',
            password: 'plain-pass',
            twoFaCode: 'JBSWY3DPEHPK3PXP', // Secret TOTP gốc (không phải mã 6 số)
            note: 'ghi chú',
        }));
        sandbox.getSensitiveAccountData = getSensitive;
        const renderDetail = vi.fn();
        sandbox.renderDetail = renderDetail;

        await sandbox.enterQuickEditMode('acc-ok');

        // Đã gọi mở khoá đúng tài khoản với lý do "Mở khoá để sửa nhanh".
        expect(getSensitive).toHaveBeenCalledTimes(1);
        expect(getSensitive.mock.calls[0][0]).toBe(acc);

        // active chỉ được set SAU khi mở khoá thành công.
        const qe = sandbox.window.appState.quickEdit;
        expect(qe).toBeTruthy();
        expect(qe.active).toBe(true);
        expect(qe.accId).toBe('acc-ok');

        // Snapshot đúng giá trị đã giải mã (2FA giữ Secret TOTP gốc).
        expect(qe.original).toEqual({
            username: 'user@example.com',
            password: 'plain-pass',
            twoFaCode: 'JBSWY3DPEHPK3PXP',
            sellerName: 'Shop A',
            note: 'ghi chú',
        });

        // Đã render lại thẻ chi tiết ở Chế độ sửa nhanh.
        expect(renderDetail).toHaveBeenCalledWith('acc-ok');
    });

    it('mở khoá thất bại (getSensitiveAccountData trả null) → KHÔNG set active, giữ Chế độ xem', async () => {
        const sandbox = loadApp();

        const acc = { id: 'acc-cancel', authMethod: 'email', sellerName: 'Shop B' };
        sandbox.window.appState.accounts = [acc];
        sandbox.window.appState.quickEdit = null;
        sandbox.window.appState.activeDecryptedAccount = null;

        // getSensitiveAccountData trả null: người dùng huỷ hộp Master hoặc nhập sai.
        const getSensitive = vi.fn(async () => null);
        sandbox.getSensitiveAccountData = getSensitive;
        const renderDetail = vi.fn();
        sandbox.renderDetail = renderDetail;

        await sandbox.enterQuickEditMode('acc-cancel');

        expect(getSensitive).toHaveBeenCalledTimes(1);
        // KHÔNG chuyển sang Chế độ sửa nhanh: quickEdit vẫn null (giữ Chế độ xem).
        expect(sandbox.window.appState.quickEdit).toBeNull();
        // Không render lại thẻ khi giữ nguyên Chế độ xem.
        expect(renderDetail).not.toHaveBeenCalled();
    });
});

// ===========================================================================
// enterQuickEditMode — phiên đã mở khoá thì chuyển thẳng (3.2)
// ===========================================================================
describe('enterQuickEditMode — phiên đã mở khoá thì chuyển thẳng, không hỏi lại Master', () => {
    it('activeDecryptedAccount có sẵn cho đúng tài khoản → set active mà KHÔNG gọi requireMasterPassword', async () => {
        const sandbox = loadApp();

        const acc = {
            id: 'acc-unlocked',
            authMethod: 'email',
            sellerName: 'Shop C',
            type: 'personal',
            protectedByMasterPassword: true,
            encryptedData: 'ZW5j', salt: 'c2FsdA==', iv: 'aXY=',
        };
        sandbox.window.appState.accounts = [acc];
        sandbox.window.appState.quickEdit = null;

        // Phiên đã mở khoá: dữ liệu giải mã của đúng tài khoản đã có trong cache.
        sandbox.window.appState.activeDecryptedAccount = {
            id: 'acc-unlocked',
            data: {
                username: 'unlocked@example.com',
                password: 'cached-pass',
                twoFaCode: 'KRSXG5CTMVRXEZLU',
                note: 'ghi chú cache',
            },
        };

        // Spy requireMasterPassword để khẳng định KHÔNG bị gọi lại (chuyển thẳng).
        // DÙNG getSensitiveAccountData THẬT (không mock) để test đúng hành vi cache.
        const requireMaster = vi.fn(async () => true);
        sandbox.requireMasterPassword = requireMaster;
        const renderDetail = vi.fn();
        sandbox.renderDetail = renderDetail;

        await sandbox.enterQuickEditMode('acc-unlocked');

        // Chuyển thẳng vào Chế độ sửa nhanh.
        const qe = sandbox.window.appState.quickEdit;
        expect(qe).toBeTruthy();
        expect(qe.active).toBe(true);
        expect(qe.accId).toBe('acc-unlocked');
        // Snapshot lấy từ dữ liệu đã mở khoá trong phiên.
        expect(qe.original.username).toBe('unlocked@example.com');
        expect(qe.original.twoFaCode).toBe('KRSXG5CTMVRXEZLU');

        // KHÔNG hỏi lại Master vì phiên đã mở khoá.
        expect(requireMaster).not.toHaveBeenCalled();
        expect(renderDetail).toHaveBeenCalledWith('acc-unlocked');
    });
});

// ===========================================================================
// confirmQuickEdit — thứ tự gọi hạ tầng bảo mật khi có Trường nhạy cảm dirty (4.5)
// ===========================================================================
describe('confirmQuickEdit — Trường nhạy cảm dirty gọi đúng thứ tự requireMasterPassword → encryptAccountData → updateAccountInDB', () => {
    it('sửa Mật khẩu (ô blob nhạy cảm) trên tài khoản được bảo vệ → gọi 3 hàm đúng thứ tự và lưu thành công', async () => {
        // Chuẩn bị các ô nhập DOM: chỉ Mật khẩu thay đổi so với snapshot.
        const elements = {
            'quick-edit-username': inputWithValue('user@example.com'),
            'quick-edit-password': inputWithValue('new-strong-pass'), // dirty
            'quick-edit-twoFaCode': inputWithValue(''),
            'quick-edit-sellerName': inputWithValue('Shop D'),
            'quick-edit-note': inputWithValue('ghi chú'),
        };
        const sandbox = loadApp({ elements });

        const acc = {
            id: 'acc-save',
            authMethod: 'email',
            type: 'personal',
            protectedByMasterPassword: true, // được bảo vệ → cần mã hoá lại
            sellerName: 'Shop D',
            encryptedData: 'old-enc', salt: 'old-salt', iv: 'old-iv',
        };
        sandbox.window.appState.accounts = [acc];
        sandbox.window.appState.isDemo = false;

        // Đang ở Chế độ sửa nhanh, snapshot ban đầu (password = 'old-pass').
        sandbox.window.appState.quickEdit = {
            accId: 'acc-save',
            active: true,
            saving: false,
            original: {
                username: 'user@example.com',
                password: 'old-pass',
                twoFaCode: '',
                sellerName: 'Shop D',
                note: 'ghi chú',
            },
        };
        // Phiên đã mở khoá: dữ liệu giải mã sẵn trong cache để bảo toàn trường blob khác.
        sandbox.window.appState.activeDecryptedAccount = {
            id: 'acc-save',
            data: {
                username: 'user@example.com',
                password: 'old-pass',
                twoFaCode: '',
                note: 'ghi chú',
                rawInput: 'giá trị blob cần bảo toàn',
            },
        };

        // --- Mảng ghi lại THỨ TỰ gọi ---
        const callOrder = [];

        // getSensitiveAccountData KHÔNG nên bị gọi (đã có cache) — spy để khẳng định.
        const getSensitive = vi.fn(async () => {
            callOrder.push('getSensitiveAccountData');
            return sandbox.window.appState.activeDecryptedAccount.data;
        });
        sandbox.getSensitiveAccountData = getSensitive;

        const requireMaster = vi.fn(async () => {
            callOrder.push('requireMasterPassword');
            sandbox.window.appState.masterUnlocked = true;
            sandbox.window.appState.masterPassword = 'master-pin';
            return true;
        });
        sandbox.requireMasterPassword = requireMaster;

        const encrypt = vi.fn(async (data, mp) => {
            callOrder.push('encryptAccountData');
            // Trả blob mã hoá mới (giống encryptAccountData thật).
            return { encryptedData: 'new-enc', salt: 'new-salt', iv: 'new-iv' };
        });
        sandbox.encryptAccountData = encrypt;

        const updateDb = vi.fn(async (id, patch) => {
            callOrder.push('updateAccountInDB');
            return true; // ghi thành công
        });
        sandbox.updateAccountInDB = updateDb;

        // Phụ trợ.
        sandbox.maskUsername = vi.fn(u => `masked:${u}`);
        sandbox.showToast = vi.fn();
        const renderDetail = vi.fn();
        sandbox.renderDetail = renderDetail;

        await sandbox.confirmQuickEdit('acc-save');

        // 1) Thứ tự gọi hạ tầng bảo mật đúng như thiết kế (Yêu cầu 4.5).
        expect(callOrder).toEqual([
            'requireMasterPassword',
            'encryptAccountData',
            'updateAccountInDB',
        ]);

        // 2) Đã tái sử dụng cache: getSensitiveAccountData KHÔNG bị gọi lại.
        expect(getSensitive).not.toHaveBeenCalled();

        // 3) encryptAccountData nhận sensitiveData đã ghi đè Mật khẩu mới,
        //    đồng thời BẢO TOÀN trường blob không đổi (rawInput).
        const encArg = encrypt.mock.calls[0][0];
        expect(encArg.password).toBe('new-strong-pass');
        expect(encArg.rawInput).toBe('giá trị blob cần bảo toàn');
        // Master password truyền đúng cho hàm mã hoá.
        expect(encrypt.mock.calls[0][1]).toBe('master-pin');

        // 4) updateAccountInDB ghi đúng tài khoản với blob mã hoá MỚI.
        expect(updateDb).toHaveBeenCalledTimes(1);
        expect(updateDb.mock.calls[0][0]).toBe('acc-save');
        const dbPatch = updateDb.mock.calls[0][1];
        expect(dbPatch.encryptedData).toBe('new-enc');
        expect(dbPatch.salt).toBe('new-salt');
        expect(dbPatch.iv).toBe('new-iv');

        // 5) Lưu thành công → thoát Chế độ sửa nhanh, cập nhật cache & render lại.
        expect(sandbox.window.appState.quickEdit).toBeNull();
        expect(sandbox.window.appState.activeDecryptedAccount.data.password).toBe('new-strong-pass');
        expect(sandbox.showToast).toHaveBeenCalledWith('Đã lưu thay đổi', 'success');
        expect(renderDetail).toHaveBeenCalledWith('acc-save');
    });
});
