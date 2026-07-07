// ============================================================================
// Property-based test cho lớp render Chế độ sửa nhanh — hàm renderQuickEditSection
// (`js/desktop-ui.js`).
//
// Feature: quick-edit-account-detail, Property 7: Ô chỉnh sửa chứa đúng giá trị
// hiện tại — Với mọi bộ giá trị tài khoản đã giải mã, khi vào Chế độ sửa nhanh,
// mỗi Editable_Field phải chứa đúng giá trị hiện tại tương ứng của ô đó, và phải
// rỗng nếu ô đó không có giá trị.
//
// Validates: Requirements 2.1, 3.5
// Thư viện: fast-check (>= 100 vòng lặp).
//
// Cách tiếp cận: nạp toàn bộ `js/desktop-ui.js` vào sandbox vm (qua helper
// tests/helpers/ui-loader.cjs) rồi gọi trực tiếp hàm renderQuickEditSection với
// snapshot `window.appState.quickEdit.original` do test kiểm soát. Sau đó parse
// HTML kết quả, trích giá trị nạp vào từng ô và đối chiếu với giá trị gốc:
//   - Giá trị hiển thị (sau khi giải mã HTML) phải bằng đúng giá trị gốc.
//   - Chuỗi escape trong HTML phải khớp escapeHtml(giá trị) — xác nhận đã escape.
//   - Rỗng khi ô không có giá trị (chuỗi rỗng / thiếu trường).
//   - Với Auth_Method = email: có ô nhập Mật khẩu; với SSO: KHÔNG có ô nhập
//     Mật khẩu (giữ chỉ đọc qua renderSsoPasswordDetail).
// KHÔNG sửa mã sản phẩm — chỉ đọc và kiểm chứng đầu ra HTML.
// ============================================================================

const fc = require('fast-check');
const { loadDesktopUi } = require('../helpers/ui-loader.cjs');
const { QUICK_EDIT_FIELDS } = require('../../js/quick-edit-core.js');

// --- Nạp desktop-ui.js MỘT LẦN vào sandbox vm; tái sử dụng cho mọi vòng lặp ---
// Cung cấp window.QUICK_EDIT_FIELDS để getQuickEditMaxLength lấy đúng maxlength.
const { sandbox } = loadDesktopUi({
    appState: { accounts: [] },
    window: { QUICK_EDIT_FIELDS },
});
const renderQuickEditSection = sandbox.renderQuickEditSection;
// Dùng CHÍNH escapeHtml của desktop-ui.js (được nạp trong sandbox) làm chuẩn,
// tránh lệch quy ước (repo dùng &#039; cho dấu nháy đơn, không phải &#39;).
const escapeHtml = sandbox.escapeHtml;

// --- Tiện ích giải mã HTML (đảo ngược escapeHtml của repo) -------------------
// escapeHtml chỉ escape 5 ký tự: & < > " '. Giải mã &amp; SAU CÙNG để tránh
// giải mã lồng sai (ví dụ "&amp;lt;" phải ra "&lt;" chứ không phải "<").
// Hỗ trợ cả &#039; (quy ước repo) lẫn &#39; cho dấu nháy đơn.
function unescapeHtml(str) {
    return String(str)
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&amp;/g, '&');
}

// Trích giá trị thuộc tính value="..." của <input id="quick-edit-<field>">.
// escapeHtml đã escape dấu " thành &quot; nên giá trị không chứa " thô → an toàn
// khi cắt tới dấu " kế tiếp. Trả về null nếu không tìm thấy ô nhập.
function extractInputValue(html, field) {
    const idToken = `id="quick-edit-${field}"`;
    const idPos = html.indexOf(idToken);
    if (idPos === -1) return null;
    const valPos = html.indexOf('value="', idPos);
    if (valPos === -1) return null;
    const start = valPos + 'value="'.length;
    const end = html.indexOf('"', start);
    if (end === -1) return null;
    return html.slice(start, end);
}

// Trích nội dung bên trong <textarea id="quick-edit-note" ...>...</textarea>.
// escapeHtml đã escape dấu > thành &gt; nên dấu > đầu tiên sau id chính là điểm
// kết thúc thẻ mở; nội dung nằm giữa đó và </textarea>.
function extractTextareaValue(html, field) {
    const idToken = `id="quick-edit-${field}"`;
    const idPos = html.indexOf(idToken);
    if (idPos === -1) return null;
    const openEnd = html.indexOf('>', idPos);
    if (openEnd === -1) return null;
    const closePos = html.indexOf('</textarea>', openEnd);
    if (closePos === -1) return null;
    return html.slice(openEnd + 1, closePos);
}

// --- Generators -------------------------------------------------------------

// Ký tự cần escape trong HTML — phải được xử lý đúng khi nạp vào ô.
const escapeCharArb = fc.constantFrom('&', '<', '>', '"', "'");
// Ký tự tiếng Việt có dấu + Unicode ngoài Latin.
const unicodeCharArb = fc.constantFrom(
    'á', 'ệ', 'Đ', 'ô', 'ự', 'ữ', 'ậ', 'ê', 'ơ', 'ă',
    '中', '漢', 'π', 'Ω', '你', '好', '🔒', '✏️',
);
// Khoảng trắng đa dạng (space, tab, xuống dòng...).
const wsCharArb = fc.constantFrom(' ', '\t', '\n', '\r', '\u00A0');
const plainCharArb = fc.constantFrom(
    'a', 'B', 'z', '9', '0', '_', '-', '.', '@', '#', '!', '/', ':',
);

// Chuỗi phong phú phủ mọi loại ký tự (escape, unicode, khoảng trắng, thường).
const richStringArb = fc.stringOf(
    fc.oneof(
        { weight: 3, arbitrary: plainCharArb },
        { weight: 2, arbitrary: escapeCharArb },
        { weight: 2, arbitrary: unicodeCharArb },
        { weight: 1, arbitrary: wsCharArb },
        { weight: 1, arbitrary: fc.fullUnicode() },
    ),
    { maxLength: 40 },
);

// Giá trị của một ô: có thể rỗng, toàn khoảng trắng, chuỗi phong phú, hoặc
// THIẾU (undefined/null) để kiểm điều kiện "rỗng nếu ô không có giá trị".
const fieldValueArb = fc.oneof(
    { weight: 5, arbitrary: richStringArb },
    { weight: 2, arbitrary: fc.constant('') },
    { weight: 1, arbitrary: fc.stringOf(wsCharArb, { minLength: 1, maxLength: 6 }) },
    { weight: 1, arbitrary: fc.constantFrom(undefined, null) },
);

// Auth_Method: 'email' cho phép sửa Mật khẩu; các phương thức SSO thì không.
const authMethodArb = fc.constantFrom('email', 'google', 'facebook', 'github', 'apple', 'microsoft');

// Bộ giá trị original đã giải mã (snapshot khi vào Chế độ sửa nhanh).
const originalArb = fc.record({
    username: fieldValueArb,
    password: fieldValueArb,
    twoFaCode: fieldValueArb,
    sellerName: fieldValueArb,
    note: fieldValueArb,
});

// Giá trị hiển thị kỳ vọng: renderQuickEditSection dùng String(original.x || '')
// → chuỗi không rỗng thì giữ nguyên, còn '' / null / undefined thì thành ''.
function expectedDisplay(value) {
    return value ? String(value) : '';
}

// Kiểm chứng một ô: HTML đã escape đúng, giải mã lại đúng giá trị gốc, rỗng khi
// không có giá trị.
function assertFieldValue(rawInHtml, originalValue, field) {
    const expected = expectedDisplay(originalValue);
    // Không tìm thấy ô là sai (trừ trường hợp gọi riêng cho password/SSO).
    expect(rawInHtml).not.toBeNull();
    // 1) Chuỗi trong HTML phải là escapeHtml(giá trị hiển thị) — đã escape đúng.
    expect(rawInHtml).toBe(escapeHtml(expected));
    // 2) Giải mã HTML phải cho đúng giá trị hiển thị — ô chứa đúng giá trị hiện tại.
    expect(unescapeHtml(rawInHtml)).toBe(expected);
    // 3) Rỗng khi ô không có giá trị.
    if (expected === '') {
        expect(rawInHtml).toBe('');
    }
}

// --- Properties -------------------------------------------------------------

describe('Property 7 — ô chỉnh sửa chứa đúng giá trị hiện tại (Requirements 2.1, 3.5)', () => {
    it('mỗi Editable_Field nạp đúng giá trị hiện tại (đã escape), rỗng khi không có giá trị', () => {
        fc.assert(
            fc.property(originalArb, authMethodArb, (original, authMethod) => {
                // Thiết lập snapshot Chế độ sửa nhanh cho vòng lặp hiện tại.
                sandbox.window.appState.quickEdit = {
                    accId: 'acc-under-test',
                    active: true,
                    original,
                };
                const acc = { id: 'acc-under-test', authMethod };
                const html = renderQuickEditSection(acc);

                // Các ô luôn là <input>: username, twoFaCode, sellerName.
                assertFieldValue(extractInputValue(html, 'username'), original.username, 'username');
                assertFieldValue(extractInputValue(html, 'twoFaCode'), original.twoFaCode, 'twoFaCode');
                assertFieldValue(extractInputValue(html, 'sellerName'), original.sellerName, 'sellerName');

                // Ghi chú là <textarea>.
                assertFieldValue(extractTextareaValue(html, 'note'), original.note, 'note');

                // Mật khẩu: chỉ email mới có ô nhập; SSO giữ chỉ đọc (không có input).
                const passwordRaw = extractInputValue(html, 'password');
                if (authMethod === 'email') {
                    assertFieldValue(passwordRaw, original.password, 'password');
                } else {
                    // SSO: không render ô nhập Mật khẩu, thay bằng chip chỉ đọc.
                    expect(passwordRaw).toBeNull();
                    expect(html).toContain('sso-password-chip');
                }
            }),
            { numRuns: 200 },
        );
    });

    it('mọi ô đều rỗng khi snapshot original hoàn toàn không có giá trị', () => {
        fc.assert(
            fc.property(authMethodArb, (authMethod) => {
                sandbox.window.appState.quickEdit = {
                    accId: 'acc-empty',
                    active: true,
                    original: {}, // không có trường nào
                };
                const acc = { id: 'acc-empty', authMethod };
                const html = renderQuickEditSection(acc);

                expect(extractInputValue(html, 'username')).toBe('');
                expect(extractInputValue(html, 'twoFaCode')).toBe('');
                expect(extractInputValue(html, 'sellerName')).toBe('');
                expect(extractTextareaValue(html, 'note')).toBe('');
                if (authMethod === 'email') {
                    expect(extractInputValue(html, 'password')).toBe('');
                } else {
                    expect(extractInputValue(html, 'password')).toBeNull();
                }
            }),
            { numRuns: 120 },
        );
    });
});
