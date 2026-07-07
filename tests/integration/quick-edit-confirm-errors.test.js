// ============================================================================
// Integration test cho nhánh LỖI và TIMEOUT của confirmQuickEdit
// (`js/desktop-app.js`) — spec quick-edit-account-detail, task 3.6.
//
// Validates: Requirements 4.6, 4.7, 7.2, 7.3, 7.4
//
// Mục tiêu: kiểm chứng nguyên tắc lưu NGUYÊN TỬ (all-or-nothing) của
// confirmQuickEdit ở ba kịch bản thất bại. Trong mọi kịch bản:
//   - `appState` KHÔNG được thay đổi (accounts + activeDecryptedAccount giữ nguyên).
//   - Vẫn GIỮ Chế độ sửa nhanh (quickEdit vẫn active, giữ giá trị đang nhập).
//   - Hiển thị toast lỗi (showToast được gọi với loại 'error').
//
// Ba kịch bản:
//   1) updateAccountInDB KHÔNG resolve (treo) → advance fake timer 5000ms →
//      Promise.race trong confirmQuickEdit reject bằng timeout →
//      toast "Đã quá thời gian chờ, vui lòng thử lại" (Yêu cầu 7.2, 7.4).
//   2) updateAccountInDB trả về false → toast "Lưu không thành công"
//      (Yêu cầu 4.6, 7.3).
//   3) encryptAccountData ném lỗi → toast "Mã hoá không thành công"; đặc biệt
//      updateAccountInDB KHÔNG được gọi (Yêu cầu 4.7).
//
// Cách tiếp cận: nạp `js/desktop-app.js` vào sandbox vm qua helper
// tests/helpers/ui-loader.cjs (loadDesktopApp). Các hàm logic thuần của
// `js/quick-edit-core.js` được nạp bằng require rồi gắn lên `window` của sandbox
// (đúng như desktop-app.js truy cập `window.computeDirtyFields`, ...). Các phụ
// thuộc hạ tầng (`showToast`, `encryptAccountData`, `updateAccountInDB`,
// `getAuthMethod`, `maskUsername`, `renderDetail`) được mock qua globals.
//
// LƯU Ý fake timers + Promise.race: `setTimeout`/`clearTimeout` trong sandbox
// được uỷ quyền về `globalThis` của realm test (nơi vi.useFakeTimers() thay thế
// bộ đếm giờ), nên `vi.advanceTimersByTimeAsync(5000)` mới kích hoạt đúng timer
// 5 giây bên trong confirmQuickEdit và flush microtask để promise timeout reject.
//
// KHÔNG sửa mã sản phẩm — chỉ nạp và kiểm chứng hành vi.
// ============================================================================

const { loadDesktopApp, makeElement } = require('../helpers/ui-loader.cjs');
const core = require('../../js/quick-edit-core.js');

// --- Nạp các hàm logic thuần lên window của sandbox (desktop-app đọc từ window) ---
function coreWindowApi() {
    return {
        QUICK_EDIT_FIELDS: core.QUICK_EDIT_FIELDS,
        normalizeQuickEditValue: core.normalizeQuickEditValue,
        truncateToLimit: core.truncateToLimit,
        computeDirtyFields: core.computeDirtyFields,
        buildQuickEditPayload: core.buildQuickEditPayload,
        isValidQuickEdit2fa: core.isValidQuickEdit2fa,
        validateQuickEditLengths: core.validateQuickEditLengths,
    };
}

// Tạo map phần tử DOM giả lập cho các ô sửa nhanh với giá trị hiện tại cho trước.
// collectQuickEditValues() đọc document.getElementById(`quick-edit-<field>`).value.
// Phải seed ĐỦ 5 ô: các ô không đổi seed đúng giá trị snapshot để không bị coi là dirty.
function seedFieldElements(currentValues) {
    const elements = {};
    Object.keys(currentValues).forEach(field => {
        const el = makeElement();
        el.value = currentValues[field];
        elements[`quick-edit-${field}`] = el;
    });
    return elements;
}

// Dựng sandbox desktop-app với appState, DOM và các mock hạ tầng cho một kịch bản.
// Trả về { sandbox, toasts, updateCalls, encryptCalls } để kiểm chứng sau khi chạy.
function buildScenario({ appState, currentValues, updateAccountInDB, encryptAccountData }) {
    const toasts = [];            // ghi lại mọi lần gọi showToast: { message, type }
    const updateCalls = [];       // ghi lại mọi lần gọi updateAccountInDB: { id, patch }
    const encryptCalls = [];      // ghi lại mọi lần gọi encryptAccountData

    const globals = {
        // Uỷ quyền timer về globalThis của realm test để fake timers có hiệu lực.
        setTimeout: (...args) => globalThis.setTimeout(...args),
        clearTimeout: (...args) => globalThis.clearTimeout(...args),
        // Mock toast: chỉ ghi lại lời gọi để kiểm chứng loại/thông điệp.
        showToast: (message, type) => { toasts.push({ message, type }); },
        // Mock ghi DB: hành vi do từng kịch bản quyết định.
        updateAccountInDB: (id, patch) => {
            updateCalls.push({ id, patch });
            return updateAccountInDB(id, patch);
        },
        // Mock mã hoá: hành vi do từng kịch bản quyết định.
        encryptAccountData: async (data, mp) => {
            encryptCalls.push({ data, mp });
            return encryptAccountData(data, mp);
        },
        // Phụ thuộc hạ tầng UI khác — trả giá trị ổn định.
        getAuthMethod: acc => acc?.authMethod || 'email',
        maskUsername: value => `masked-${String(value ?? '')}`,
        renderDetail: () => {},
    };

    const elements = seedFieldElements(currentValues);
    const { sandbox } = loadDesktopApp({
        appState,
        elements,
        globals,
        window: coreWindowApi(),
    });

    // LƯU Ý: js/desktop-app.js gán `window.appState = {...}` ở top-level khi nạp,
    // ghi đè appState truyền qua loader. Vì vậy phải GÁN LẠI appState của kịch bản
    // SAU khi nạp để confirmQuickEdit đọc đúng trạng thái ta dựng.
    sandbox.window.appState = appState;

    return { sandbox, toasts, updateCalls, encryptCalls };
}

// --- Dữ liệu dùng chung cho kịch bản 1 & 2 (tài khoản KHÔNG mã hoá) ------------
// Chỉ đổi ô "Người bán" (sellerName) — trường thường, không cần Master/mã hoá,
// nên luồng đi thẳng tới updateAccountInDB (nơi ta ép lỗi/timeout).
function makeUnprotectedState() {
    const original = {
        username: 'user@example.com',
        password: 'pw-old',
        twoFaCode: '',
        sellerName: 'Shop A',
        note: 'Ghi chú cũ',
    };
    const acc = {
        id: 'acc1',
        name: 'TK không mã hoá',
        authMethod: 'email',
        protectedByMasterPassword: false,
        sellerName: 'Shop A',
        username: 'user@example.com',
    };
    const appState = {
        isDemo: false,
        accounts: [acc],
        // Cache dữ liệu giải mã để confirmQuickEdit KHÔNG phải gọi getSensitiveAccountData.
        activeDecryptedAccount: {
            id: 'acc1',
            data: { username: 'user@example.com', password: 'pw-old', twoFaCode: '', note: 'Ghi chú cũ' },
        },
        quickEdit: { accId: 'acc1', active: true, original, saving: false },
    };
    // Giá trị đang nhập trong DOM: chỉ sellerName đổi -> 'Shop B'.
    const currentValues = {
        username: 'user@example.com',
        password: 'pw-old',
        twoFaCode: '',
        sellerName: 'Shop B',
        note: 'Ghi chú cũ',
    };
    return { appState, acc, currentValues, original };
}

describe('confirmQuickEdit — nhánh lỗi & timeout (all-or-nothing)', () => {
    beforeEach(() => {
        // Bật fake timers cho mọi kịch bản; chỉ kịch bản timeout mới advance timer.
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('Kịch bản 1 — updateAccountInDB treo quá 5 giây → toast quá thời gian, giữ nguyên state', async () => {
        const { appState, acc, currentValues, original } = makeUnprotectedState();
        const { sandbox, toasts, updateCalls } = buildScenario({
            appState,
            currentValues,
            // Không bao giờ resolve → buộc Promise.race rơi vào nhánh timeout 5s.
            updateAccountInDB: () => new Promise(() => {}),
            encryptAccountData: async () => ({}), // không dùng tới trong kịch bản này
        });

        // Gọi confirmQuickEdit; timer 5s được đăng ký đồng bộ trước await Promise.race.
        const pending = sandbox.confirmQuickEdit('acc1');
        // Đẩy đồng hồ ảo đúng 5000ms để kích hoạt timeout + flush microtask.
        await vi.advanceTimersByTimeAsync(5000);
        await pending;

        // Toast lỗi timeout đúng thông điệp & loại 'error'.
        expect(toasts).toContainEqual({ message: 'Đã quá thời gian chờ, vui lòng thử lại', type: 'error' });
        expect(toasts.every(t => t.type === 'error')).toBe(true);

        // updateAccountInDB có được gọi (nhưng treo) — với patch chỉ chứa sellerName.
        expect(updateCalls).toHaveLength(1);
        expect(updateCalls[0].patch).toEqual({ sellerName: 'Shop B' });

        // appState KHÔNG đổi: sellerName giữ nguyên, dữ liệu giải mã giữ nguyên.
        expect(acc.sellerName).toBe('Shop A');
        expect(appState.activeDecryptedAccount.data).toEqual({
            username: 'user@example.com', password: 'pw-old', twoFaCode: '', note: 'Ghi chú cũ',
        });

        // Vẫn ở Chế độ sửa nhanh, snapshot original giữ nguyên, cờ saving đã nhả.
        expect(appState.quickEdit).not.toBeNull();
        expect(appState.quickEdit.active).toBe(true);
        expect(appState.quickEdit.accId).toBe('acc1');
        expect(appState.quickEdit.original).toEqual(original);
        expect(appState.quickEdit.saving).toBe(false);
    });

    it('Kịch bản 2 — updateAccountInDB trả false → toast lưu không thành công, giữ nguyên state', async () => {
        const { appState, acc, currentValues, original } = makeUnprotectedState();
        const { sandbox, toasts, updateCalls } = buildScenario({
            appState,
            currentValues,
            updateAccountInDB: async () => false, // ghi DB báo thất bại
            encryptAccountData: async () => ({}),
        });

        await sandbox.confirmQuickEdit('acc1');

        // Toast lỗi đúng thông điệp & loại 'error'.
        expect(toasts).toContainEqual({ message: 'Lưu không thành công', type: 'error' });
        expect(toasts.every(t => t.type === 'error')).toBe(true);

        // updateAccountInDB được gọi một lần với patch sellerName.
        expect(updateCalls).toHaveLength(1);
        expect(updateCalls[0].patch).toEqual({ sellerName: 'Shop B' });

        // appState KHÔNG đổi.
        expect(acc.sellerName).toBe('Shop A');
        expect(appState.activeDecryptedAccount.data).toEqual({
            username: 'user@example.com', password: 'pw-old', twoFaCode: '', note: 'Ghi chú cũ',
        });

        // Vẫn ở Chế độ sửa nhanh, giữ giá trị đang nhập.
        expect(appState.quickEdit).not.toBeNull();
        expect(appState.quickEdit.active).toBe(true);
        expect(appState.quickEdit.original).toEqual(original);
        expect(appState.quickEdit.saving).toBe(false);
    });

    it('Kịch bản 3 — encryptAccountData ném lỗi → toast mã hoá lỗi, KHÔNG gọi updateAccountInDB, giữ nguyên state', async () => {
        // Tài khoản CÓ mã hoá; đổi ô Mật khẩu (thuộc blob nhạy cảm) → buộc mã hoá lại.
        const original = {
            username: 'u3',
            password: 'pass-old',
            twoFaCode: '',
            sellerName: 'S3',
            note: 'n3',
        };
        const acc = {
            id: 'acc3',
            name: 'TK mã hoá',
            authMethod: 'email',
            protectedByMasterPassword: true,
            sellerName: 'S3',
        };
        const appState = {
            isDemo: false,
            // Master đã mở khoá trong phiên → requireMasterPassword trả true ngay.
            masterUnlocked: true,
            masterPassword: 'mp',
            accounts: [acc],
            activeDecryptedAccount: {
                id: 'acc3',
                data: { username: 'u3', password: 'pass-old', twoFaCode: '', note: 'n3' },
            },
            quickEdit: { accId: 'acc3', active: true, original, saving: false },
        };
        // Giá trị đang nhập: chỉ password đổi -> 'pass-new'.
        const currentValues = {
            username: 'u3',
            password: 'pass-new',
            twoFaCode: '',
            sellerName: 'S3',
            note: 'n3',
        };

        const { sandbox, toasts, updateCalls, encryptCalls } = buildScenario({
            appState,
            currentValues,
            updateAccountInDB: async () => true, // không được phép chạm tới
            encryptAccountData: async () => { throw new Error('encrypt-fail'); },
        });

        await sandbox.confirmQuickEdit('acc3');

        // encryptAccountData được gọi và ném lỗi.
        expect(encryptCalls).toHaveLength(1);
        // updateAccountInDB TUYỆT ĐỐI KHÔNG được gọi (Yêu cầu 4.7).
        expect(updateCalls).toHaveLength(0);

        // Toast lỗi mã hoá đúng thông điệp & loại 'error'.
        expect(toasts).toContainEqual({ message: 'Mã hoá không thành công', type: 'error' });
        expect(toasts.every(t => t.type === 'error')).toBe(true);

        // appState KHÔNG đổi: dữ liệu giải mã giữ mật khẩu cũ.
        expect(appState.activeDecryptedAccount.data.password).toBe('pass-old');
        expect(appState.activeDecryptedAccount.data).toEqual({
            username: 'u3', password: 'pass-old', twoFaCode: '', note: 'n3',
        });

        // Vẫn ở Chế độ sửa nhanh, giữ giá trị đang nhập, cờ saving đã nhả.
        expect(appState.quickEdit).not.toBeNull();
        expect(appState.quickEdit.active).toBe(true);
        expect(appState.quickEdit.accId).toBe('acc3');
        expect(appState.quickEdit.original).toEqual(original);
        expect(appState.quickEdit.saving).toBe(false);
    });
});
