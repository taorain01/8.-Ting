// ============================================================================
// Property-based test cho lớp điều khiển Chế độ sửa nhanh — hàm cancelQuickEdit
// (`js/desktop-app.js`).
//
// Feature: quick-edit-account-detail, Property 9: Huỷ bỏ khôi phục đúng giá trị
// đã lưu — Với mọi bộ giá trị đã lưu và mọi chuỗi chỉnh sửa chưa lưu, sau khi
// người dùng huỷ và bỏ thay đổi, bộ giá trị dùng để render lại Chế độ xem phải
// bằng đúng bộ giá trị đã lưu ban đầu, và không có giá trị chưa lưu nào được ghi
// xuống nơi lưu trữ.
//
// Validates: Requirements 6.2, 6.4
// Thư viện: fast-check (>= 100 vòng lặp).
//
// Cách tiếp cận: nạp toàn bộ `js/desktop-app.js` vào sandbox vm MỘT LẦN (qua
// helper tests/helpers/ui-loader.cjs -> loadDesktopApp) rồi gọi trực tiếp hàm
// cancelQuickEdit(accId). Mỗi vòng lặp cấu hình lại:
//   - window.appState.quickEdit.original = savedValues (snapshot đã lưu, cũng là
//     nguồn khôi phục khi huỷ).
//   - window.appState.activeDecryptedAccount.data = savedValues (nguồn mà
//     renderDetail dùng để dựng lại Chế độ xem).
//   - Các phần tử DOM `quick-edit-<field>` mang editedValues (giá trị chỉnh sửa
//     CHƯA LƯU, khác snapshot).
// Mock:
//   - renderDetail: ghi lại lần gọi + chụp trạng thái quickEdit và nguồn dữ liệu
//     dùng để render (activeDecryptedAccount.data) tại thời điểm render.
//   - updateAccountInDB: KHẲNG ĐỊNH KHÔNG được gọi khi huỷ (đếm số lần gọi = 0).
//   - window.confirm: trả true (người dùng chọn "bỏ thay đổi").
//   - showToast: thu thập toast (không cần cho khôi phục thành công).
// Kiểm chứng sau khi huỷ:
//   1) window.appState.quickEdit === null (đã thoát Chế độ sửa nhanh).
//   2) renderDetail được gọi để về Chế độ xem, và tại lần render đó quickEdit đã null.
//   3) updateAccountInDB KHÔNG được gọi (không ghi giá trị chưa lưu xuống lưu trữ).
//   4) Nguồn để render (activeDecryptedAccount.data) VẪN bằng đúng savedValues,
//      không hề mang giá trị editedValues chưa lưu.
//   5) Dữ liệu account trong bộ nhớ (sellerName) không bị thay đổi.
// KHÔNG sửa mã sản phẩm — chỉ đọc và kiểm chứng hành vi.
// ============================================================================

const fc = require('fast-check');
const { loadDesktopApp } = require('../helpers/ui-loader.cjs');
const core = require('../../js/quick-edit-core.js');

const FIELD_NAMES = ['username', 'password', 'twoFaCode', 'sellerName', 'note'];
const ACC_ID = 'acc-cancel-restore';

// --- Trạng thái quan sát dùng chung, reset ở mỗi vòng lặp -------------------
const observed = { renderCalls: [], dbCalls: 0, toasts: [] };

// --- Nạp desktop-app.js MỘT LẦN vào sandbox vm; tái sử dụng cho mọi vòng lặp -
const { sandbox } = loadDesktopApp({
    globals: {
        // Mock renderDetail: chụp lại trạng thái quickEdit và nguồn dữ liệu render.
        renderDetail: (id) => {
            const st = sandbox.window.appState;
            observed.renderCalls.push({
                id,
                quickEditIsNull: st.quickEdit === null,
                // Nguồn để dựng lại Chế độ xem (đã giải mã) — deep copy để bắt lỗi
                // nếu bị thay đổi sau này.
                source: st.activeDecryptedAccount && st.activeDecryptedAccount.data
                    ? { ...st.activeDecryptedAccount.data }
                    : null,
            });
        },
        // Mock updateAccountInDB: nếu bị gọi khi huỷ là SAI → đếm để khẳng định = 0.
        updateAccountInDB: async () => { observed.dbCalls += 1; return true; },
        showToast: (msg, type) => { observed.toasts.push({ msg, type }); },
    },
});

// desktop-app.js gán đè window.appState khi nạp → nạp logic thuần + confirm SAU.
sandbox.window.computeDirtyFields = core.computeDirtyFields;
sandbox.window.QUICK_EDIT_FIELDS = core.QUICK_EDIT_FIELDS;
// confirm trả true = người dùng chọn "bỏ thay đổi" khi có thay đổi chưa lưu.
sandbox.window.confirm = () => true;

const cancelQuickEdit = sandbox.cancelQuickEdit;

// --- Generators -------------------------------------------------------------

// Ký tự tiếng Việt có dấu + Unicode ngoài Latin.
const unicodeCharArb = fc.constantFrom(
    'á', 'ệ', 'Đ', 'ô', 'ự', 'ữ', 'ậ', 'ê', 'ơ', 'ă',
    '中', '漢', 'π', 'Ω', '你', '好', '🔒', '✏️',
);
const wsCharArb = fc.constantFrom(' ', '\t', '\n', '\r', '\u00A0');
const plainCharArb = fc.constantFrom(
    'a', 'B', 'z', '9', '0', '_', '-', '.', '@', '#', '!', '/', ':',
);

// Chuỗi phong phú phủ mọi loại ký tự (unicode/tiếng Việt, khoảng trắng, thường).
const richStringArb = fc.stringOf(
    fc.oneof(
        { weight: 3, arbitrary: plainCharArb },
        { weight: 2, arbitrary: unicodeCharArb },
        { weight: 1, arbitrary: wsCharArb },
        { weight: 1, arbitrary: fc.fullUnicode() },
    ),
    { maxLength: 40 },
);

// Giá trị một ô: có thể rỗng, toàn khoảng trắng, hoặc chuỗi phong phú.
const fieldValueArb = fc.oneof(
    { weight: 6, arbitrary: richStringArb },
    { weight: 2, arbitrary: fc.constant('') },
    { weight: 1, arbitrary: fc.stringOf(wsCharArb, { minLength: 1, maxLength: 6 }) },
);

const valuesArb = fc.record({
    username: fieldValueArb,
    password: fieldValueArb,
    twoFaCode: fieldValueArb,
    sellerName: fieldValueArb,
    note: fieldValueArb,
});

// --- Thiết lập một vòng lặp -------------------------------------------------
function setupRound(savedValues, editedValues) {
    observed.renderCalls = [];
    observed.dbCalls = 0;
    observed.toasts = [];

    const st = sandbox.window.appState;
    st.isDemo = false;

    // Account: authMethod email để đủ 5 ô; sellerName là trường thường trên account.
    const acc = { id: ACC_ID, authMethod: 'email', sellerName: savedValues.sellerName };
    st.accounts = [acc];

    // Nguồn để render Chế độ xem = dữ liệu đã giải mã đã lưu (deep copy).
    st.activeDecryptedAccount = { id: ACC_ID, data: { ...savedValues } };

    // Vào Chế độ sửa nhanh với snapshot = savedValues.
    st.quickEdit = {
        accId: ACC_ID,
        active: true,
        original: { ...savedValues },
        saving: false,
    };

    // Các ô DOM mang giá trị chỉnh sửa CHƯA LƯU (editedValues).
    FIELD_NAMES.forEach((field) => {
        sandbox.__elements[`quick-edit-${field}`] = { value: String(editedValues[field] ?? '') };
    });

    return acc;
}

// --- Property ---------------------------------------------------------------

describe('Property 9 — huỷ bỏ khôi phục đúng giá trị đã lưu (Requirements 6.2, 6.4)', () => {
    it('sau khi huỷ + bỏ thay đổi: về Chế độ xem với giá trị đã lưu, không ghi giá trị chưa lưu', () => {
        fc.assert(
            fc.property(valuesArb, valuesArb, (savedValues, editedValues) => {
                const acc = setupRound(savedValues, editedValues);

                // Người dùng huỷ Chế độ sửa nhanh (confirm trả true = bỏ thay đổi).
                cancelQuickEdit(ACC_ID);

                const st = sandbox.window.appState;

                // 1) Đã thoát Chế độ sửa nhanh.
                expect(st.quickEdit).toBeNull();

                // 2) renderDetail được gọi để về Chế độ xem, quickEdit đã null lúc render.
                expect(observed.renderCalls.length).toBeGreaterThanOrEqual(1);
                const lastRender = observed.renderCalls[observed.renderCalls.length - 1];
                expect(lastRender.id).toBe(ACC_ID);
                expect(lastRender.quickEditIsNull).toBe(true);

                // 3) KHÔNG ghi bất kỳ giá trị chưa lưu nào xuống nơi lưu trữ.
                expect(observed.dbCalls).toBe(0);

                // 4) Nguồn dùng để render lại Chế độ xem = đúng bộ giá trị đã lưu.
                expect(lastRender.source).toEqual(savedValues);
                expect(st.activeDecryptedAccount.data).toEqual(savedValues);

                // 5) Dữ liệu account trong bộ nhớ (trường thường) không đổi.
                expect(acc.sellerName).toBe(savedValues.sellerName);
            }),
            { numRuns: 200 },
        );
    });

    it('không có thay đổi chưa lưu (edited == saved): huỷ vẫn về Chế độ xem, không ghi lưu trữ', () => {
        fc.assert(
            fc.property(valuesArb, (savedValues) => {
                // editedValues bằng đúng savedValues → không dirty → không hỏi confirm.
                const acc = setupRound(savedValues, savedValues);

                cancelQuickEdit(ACC_ID);

                const st = sandbox.window.appState;
                expect(st.quickEdit).toBeNull();
                expect(observed.dbCalls).toBe(0);
                expect(observed.renderCalls.length).toBeGreaterThanOrEqual(1);
                const lastRender = observed.renderCalls[observed.renderCalls.length - 1];
                expect(lastRender.source).toEqual(savedValues);
                expect(acc.sellerName).toBe(savedValues.sellerName);
            }),
            { numRuns: 120 },
        );
    });
});
