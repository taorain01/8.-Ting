/* ============================================================================
 *  Quick_Edit_Core (`js/quick-edit-core.js`) — lớp logic thuần cho tính năng
 *  "Sửa nhanh inline" thẻ chi tiết tài khoản.
 * ============================================================================
 *
 *  Đây là tầng logic THUẦN: không chạm DOM, không side-effect, dễ kiểm thử bằng
 *  property-based testing. Module được export qua `window` theo quy ước của repo
 *  (giống `js/crypto.js`) để dùng trong webview, đồng thời hỗ trợ `module.exports`
 *  để nạp trực tiếp trong test (vitest/node) qua `require(...)`.
 *
 *  LƯU Ý MỞ RỘNG: file này sẽ còn được BỔ SUNG ở các task sau bằng `fs_append`:
 *    - Task 1.4: computeDirtyFields, buildQuickEditPayload
 *    - Task 1.7: isValidQuickEdit2fa, validateQuickEditLengths
 *  Mỗi lần bổ sung nên khai báo hàm mới ở dạng khối thuần độc lập rồi thêm một
 *  KHỐI EXPORT riêng dùng `Object.assign(...)` để gộp thêm vào namespace hiện có
 *  mà không ghi đè các hàm đã export trước đó (xem khối export ở cuối file).
 * ============================================================================
 */

// ---- Danh sách các ô có thể sửa và giới hạn ký tự -------------------------
// Mỗi ô khai báo: `sensitive` (Trường nhạy cảm cần mã hoá zero-knowledge) và
// `maxLength` (giới hạn ký tự tối đa cho ô đó).
const QUICK_EDIT_FIELDS = {
    username: { sensitive: true, maxLength: 255 },   // Tài khoản (nhạy cảm)
    password: { sensitive: true, maxLength: 255 },   // Mật khẩu (nhạy cảm)
    twoFaCode: { sensitive: true, maxLength: 255 },  // 2FA — lưu Secret TOTP gốc (nhạy cảm)
    sellerName: { sensitive: false, maxLength: 255 },// Người bán (trường thường)
    note: { sensitive: false, maxLength: 1000 },     // Ghi chú (trường thường)
};

// ---- Chuẩn hoá giá trị -----------------------------------------------------
// Cắt bỏ toàn bộ khoảng trắng ở ĐẦU và CUỐI, GIỮ NGUYÊN mọi ký tự nằm giữa
// (kể cả khoảng trắng và ký tự xuống dòng). Xử lý an toàn với `null`/`undefined`
// bằng cách trả về chuỗi rỗng. Hàm idempotent: áp dụng nhiều lần cho cùng kết quả.
function normalizeQuickEditValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

// ---- Cắt nội dung theo giới hạn ký tự --------------------------------------
// Trả về tiền tố của `value` có độ dài KHÔNG vượt quá `limit`. Nếu `value` đã
// ngắn hơn hoặc bằng `limit` thì trả về nguyên vẹn `value` (bao gồm mọi khoảng
// trắng và ký tự xuống dòng — KHÔNG chuẩn hoá ở bước này). Dùng khi người dùng
// dán nội dung có thể vượt quá giới hạn của ô.
function truncateToLimit(value, limit) {
    const str = (value === null || value === undefined) ? '' : String(value);
    // Giới hạn phải là số nguyên không âm; nếu không hợp lệ thì không cắt.
    const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : str.length;
    if (str.length <= max) return str;
    return str.slice(0, max);
}

// ============================================================================
//  KHỐI EXPORT — gộp API vào `window` (webview) và `module.exports` (test/node).
//  Các task sau khi bổ sung hàm mới nên thêm KHỐI EXPORT riêng theo đúng mẫu
//  `Object.assign(...)` này để không ghi đè các hàm đã export.
// ============================================================================
(function exportQuickEditCore() {
    const api = {
        QUICK_EDIT_FIELDS,
        normalizeQuickEditValue,
        truncateToLimit,
    };

    if (typeof window !== 'undefined') {
        // Namespace gộp (giống window.TingCrypto của js/crypto.js).
        window.QuickEditCore = Object.assign(window.QuickEditCore || {}, api);
        // Export lẻ từng thành phần theo quy ước repo để tiện dùng trực tiếp.
        window.QUICK_EDIT_FIELDS = QUICK_EDIT_FIELDS;
        window.normalizeQuickEditValue = normalizeQuickEditValue;
        window.truncateToLimit = truncateToLimit;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Object.assign(module.exports || {}, api);
    }
})();

// ============================================================================
//  TASK 1.4 — Dirty detection & dựng payload lưu
// ============================================================================

// ---- Xác định tập ô đã thay đổi (dirty detection) --------------------------
// So sánh giá trị hiện tại với snapshot ban đầu THEO GIÁ TRỊ ĐÃ CHUẨN HOÁ.
// Trả về mảng tên field mà `normalizeQuickEditValue(current) !==
// normalizeQuickEditValue(original)`. Thứ tự field theo thứ tự khai báo trong
// `fields`. Nếu mọi ô có giá trị chuẩn hoá bằng nhau thì trả về mảng rỗng.
//   - `originalValues`: bộ giá trị mốc (snapshot lúc vào Chế độ sửa nhanh).
//   - `currentValues` : bộ giá trị hiện tại đọc từ các ô nhập liệu.
//   - `fields`        : bảng field cần xét, mặc định là QUICK_EDIT_FIELDS.
function computeDirtyFields(originalValues, currentValues, fields = QUICK_EDIT_FIELDS) {
    const orig = originalValues || {};
    const curr = currentValues || {};
    const dirty = [];
    for (const field of Object.keys(fields || {})) {
        const originalNorm = normalizeQuickEditValue(orig[field]);
        const currentNorm = normalizeQuickEditValue(curr[field]);
        if (currentNorm !== originalNorm) {
            dirty.push(field);
        }
    }
    return dirty;
}

// ---- Dựng payload lưu (all-or-nothing) -------------------------------------
// Bắt đầu từ bộ giá trị ĐÃ LƯU (`savedValues`) và CHỈ ghi đè các ô thuộc
// `dirtyFields` bằng giá trị hiện tại đã chuẩn hoá (kể cả chuỗi rỗng — cho phép
// xoá trắng Trường nhạy cảm). Các ô không dirty giữ nguyên đúng giá trị đã lưu.
// Luôn trả về đối tượng đủ 5 khoá: { username, password, twoFaCode, sellerName, note }.
//   - `savedValues` : giá trị đã lưu trước đó (nguồn cho các ô không thay đổi).
//   - `dirtyFields` : danh sách tên ô cần ghi đè (từ computeDirtyFields).
//   - `currentValues`: giá trị hiện tại (dùng cho các ô dirty, sẽ được chuẩn hoá).
function buildQuickEditPayload(savedValues, dirtyFields, currentValues) {
    const saved = savedValues || {};
    const curr = currentValues || {};
    const dirtySet = new Set(Array.isArray(dirtyFields) ? dirtyFields : []);
    const payload = {};
    for (const field of Object.keys(QUICK_EDIT_FIELDS)) {
        if (dirtySet.has(field)) {
            // Ô đã thay đổi: ghi đè bằng giá trị hiện tại đã chuẩn hoá.
            payload[field] = normalizeQuickEditValue(curr[field]);
        } else {
            // Ô không đổi: giữ nguyên đúng giá trị đã lưu (mặc định '' nếu thiếu).
            payload[field] = saved[field] !== undefined ? saved[field] : '';
        }
    }
    return payload;
}

// ============================================================================
//  KHỐI EXPORT (Task 1.4) — gộp thêm API mới vào namespace mà KHÔNG ghi đè
//  các hàm đã export ở khối trước, dùng đúng mẫu Object.assign.
// ============================================================================
(function exportQuickEditCoreDirtyPayload() {
    const api = {
        computeDirtyFields,
        buildQuickEditPayload,
    };

    if (typeof window !== 'undefined') {
        window.QuickEditCore = Object.assign(window.QuickEditCore || {}, api);
        window.computeDirtyFields = computeDirtyFields;
        window.buildQuickEditPayload = buildQuickEditPayload;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Object.assign(module.exports || {}, api);
    }
})();

// ============================================================================
//  TASK 1.7 — Xác thực định dạng 2FA & xác thực độ dài trường thường
// ============================================================================

// ---- Nhãn hiển thị tiếng Việt cho từng ô (dùng cho thông báo lỗi độ dài) ----
const QUICK_EDIT_FIELD_LABELS = {
    username: 'Tài khoản',
    password: 'Mật khẩu',
    twoFaCode: '2FA',
    sellerName: 'Người bán',
    note: 'Ghi chú',
};

// ---- Fallback nhận diện Secret TOTP khi window.isLikelyTotpSecret chưa nạp ---
// Tái hiện đúng logic của `isLikelyTotpSecret` trong `js/crypto.js` để dùng
// trong môi trường test (node/require) — nơi không có `window` và `js/crypto.js`
// không export qua `module.exports`. Lọc ký tự Base32 (A-Z, 2-7) rồi kiểm độ dài
// tối thiểu, đồng thời loại chuỗi toàn chữ số (mã OTP tĩnh 6–8 số).
function fallbackIsLikelyTotpSecret(value) {
    const clean = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
    // Loại chuỗi toàn chữ số (đã bỏ khoảng trắng) — đây là mã OTP tĩnh, không phải secret.
    if (/^\d+$/.test(String(value || '').replace(/\s/g, ''))) return false;
    return clean.length >= 16;
}

// ---- Xác thực định dạng 2FA ------------------------------------------------
// Chuẩn hoá giá trị trước, sau đó coi là HỢP LỆ khi và chỉ khi:
//   1) chuỗi rỗng (cho phép để trống 2FA), HOẶC
//   2) là URL otpauth (bắt đầu bằng `otpauth://`), HOẶC
//   3) là Secret TOTP hợp lệ: chuỗi sau khi lọc ký tự Base32 (A-Z, 2-7) có độ
//      dài trong khoảng 16–128 ký tự VÀ không phải chuỗi toàn chữ số.
// Ràng buộc độ dài Base32 16–128 áp dụng trên CHUỖI ĐÃ LỌC ký tự Base32.
// Nhánh Secret TOTP tái sử dụng `window.isLikelyTotpSecret` (js/crypto.js) nếu
// đã nạp; nếu không thì dùng `fallbackIsLikelyTotpSecret` tương đương.
function isValidQuickEdit2fa(value) {
    const norm = normalizeQuickEditValue(value);
    if (norm === '') return true;                     // rỗng => hợp lệ
    if (/^otpauth:\/\//i.test(norm)) return true;     // URL otpauth => hợp lệ

    // Nhánh Secret TOTP: lọc ký tự Base32 rồi ràng buộc độ dài 16–128.
    const clean = norm.toUpperCase().replace(/[^A-Z2-7]/g, '');
    if (clean.length < 16 || clean.length > 128) return false;

    // Loại chuỗi toàn chữ số — tái sử dụng isLikelyTotpSecret nếu nạp được.
    const isLikely = (typeof window !== 'undefined' && typeof window.isLikelyTotpSecret === 'function')
        ? window.isLikelyTotpSecret
        : fallbackIsLikelyTotpSecret;
    return isLikely(norm) === true;
}

// ---- Xác thực độ dài các trường thường (Plain_Field) -----------------------
// Kiểm tra độ dài SAU KHI chuẩn hoá của các ô KHÔNG nhạy cảm (mặc định là
// `sellerName` <= 255 và `note` <= 1000 theo QUICK_EDIT_FIELDS). Trả về ô đầu
// tiên vượt giới hạn kèm thông báo lỗi tiếng Việt; nếu tất cả hợp lệ trả `{ ok: true }`.
//   - `values`: bộ giá trị hiện tại của các ô.
//   - `fields`: bảng field kèm cấu hình, mặc định QUICK_EDIT_FIELDS.
function validateQuickEditLengths(values, fields = QUICK_EDIT_FIELDS) {
    const vals = values || {};
    const table = fields || {};
    for (const field of Object.keys(table)) {
        const cfg = table[field] || {};
        if (cfg.sensitive) continue; // chỉ xét các trường thường (không nhạy cảm)
        const limit = Number.isFinite(cfg.maxLength) ? cfg.maxLength : Infinity;
        const norm = normalizeQuickEditValue(vals[field]);
        if (norm.length > limit) {
            const label = QUICK_EDIT_FIELD_LABELS[field] || field;
            return {
                ok: false,
                field,
                message: `${label} không được vượt quá ${limit} ký tự.`,
            };
        }
    }
    return { ok: true };
}

// ============================================================================
//  KHỐI EXPORT (Task 1.7) — gộp thêm API mới vào namespace mà KHÔNG ghi đè
//  các hàm đã export ở các khối trước, dùng đúng mẫu Object.assign.
// ============================================================================
(function exportQuickEditCoreValidation() {
    const api = {
        isValidQuickEdit2fa,
        validateQuickEditLengths,
        QUICK_EDIT_FIELD_LABELS,
    };

    if (typeof window !== 'undefined') {
        window.QuickEditCore = Object.assign(window.QuickEditCore || {}, api);
        window.isValidQuickEdit2fa = isValidQuickEdit2fa;
        window.validateQuickEditLengths = validateQuickEditLengths;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Object.assign(module.exports || {}, api);
    }
})();
