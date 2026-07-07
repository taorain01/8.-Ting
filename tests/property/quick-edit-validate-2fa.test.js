// ============================================================================
// Property test — spec "quick-edit-account-detail".
//
// Feature: quick-edit-account-detail, Property 5: Xác thực định dạng 2FA.
//
// Nội dung Property 5 (từ design.md):
//   Với mọi chuỗi giá trị 2FA sau khi chuẩn hoá, `isValidQuickEdit2fa` phải trả
//   về HỢP LỆ khi và chỉ khi:
//     (1) chuỗi rỗng, HOẶC
//     (2) là một Secret TOTP hợp lệ (Base32 độ dài 16–128 ký tự), HOẶC
//     (3) là một URL otpauth hợp lệ (bắt đầu bằng `otpauth://`);
//   mọi chuỗi KHÔNG rỗng khác không khớp hai định dạng trên phải bị coi là
//   KHÔNG hợp lệ.
//
// Ghi chú khớp hành vi thực tế trong js/quick-edit-core.js:
//   - Giá trị được chuẩn hoá (trim) trước khi xét → chuỗi toàn khoảng trắng coi
//     như rỗng ⇒ hợp lệ.
//   - Nhánh Secret TOTP: LỌC ký tự Base32 (A-Z, 2-7; chữ thường được viết hoa)
//     rồi ràng buộc độ dài chuỗi đã lọc trong khoảng 16–128.
//   - Chuỗi TOÀN CHỮ SỐ bị loại (không phải secret) ⇒ không hợp lệ.
//
// Phương pháp: dùng fast-check sinh các nhóm đầu vào ĐÃ BIẾT TRƯỚC phân loại
// (hợp lệ / không hợp lệ) để kiểm chứng cả hai chiều của quan hệ "khi và chỉ khi".
//
// Validates: Requirements 5.2, 5.3
// ============================================================================

const fc = require('fast-check');
const { isValidQuickEdit2fa } = require('../../js/quick-edit-core.js');

// --- Bảng chữ cái Base32 dùng để dựng Secret TOTP hợp lệ --------------------
// Chữ cái (A-Z, a-z — chữ thường sẽ được viết hoa khi lọc) và chữ số Base32 (2-7).
const BASE32_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
const BASE32_DIGITS = ['2', '3', '4', '5', '6', '7'];

const base32LetterArb = fc.constantFrom(...BASE32_LETTERS);
const base32CharArb = fc.oneof(fc.constantFrom(...BASE32_LETTERS), fc.constantFrom(...BASE32_DIGITS));

// Ký tự khoảng trắng để bọc đầu/cuối (bị trim khi chuẩn hoá).
const wsArb = fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { maxLength: 4 });

// Dựng một chuỗi Base32 độ dài `len`, ĐẢM BẢO có ít nhất một chữ cái (để không
// bị coi là "chuỗi toàn chữ số"). Tất cả ký tự đều thuộc Base32 nên độ dài chuỗi
// đã lọc bằng đúng `len`.
function base32OfLengthArb(len) {
    if (len <= 0) return fc.constant('');
    return fc
        .tuple(base32LetterArb, fc.array(base32CharArb, { minLength: len - 1, maxLength: len - 1 }))
        .map(([lead, rest]) => lead + rest.join(''));
}

// --- Nhóm HỢP LỆ ------------------------------------------------------------

// (1) Chuỗi rỗng / toàn khoảng trắng → hợp lệ.
const emptyArb = fc
    .stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { maxLength: 8 })
    .map((value) => ({ value, expected: true }));

// (2) Secret TOTP hợp lệ: Base32 độ dài 16–128 (phủ biên 16, 17, 128 + ngẫu nhiên),
// có thể bọc khoảng trắng đầu/cuối (bị trim).
const validSecretArb = fc
    .tuple(
        fc.oneof(
            fc.constantFrom(16, 17, 32, 64, 100, 127, 128),
            fc.integer({ min: 16, max: 128 }),
        ),
        wsArb,
        wsArb,
    )
    .chain(([len, pre, post]) =>
        base32OfLengthArb(len).map((core) => ({ value: pre + core + post, expected: true })),
    );

// (3) URL otpauth:// → hợp lệ (không phân biệt hoa/thường, có thể bọc khoảng trắng).
const otpauthArb = fc
    .tuple(
        fc.constantFrom('otpauth://', 'OTPAUTH://', 'Otpauth://'),
        fc.string({ maxLength: 60 }),
        wsArb,
        wsArb,
    )
    .map(([prefix, suffix, pre, post]) => ({ value: pre + prefix + suffix + post, expected: true }));

// --- Nhóm KHÔNG HỢP LỆ ------------------------------------------------------

// (a) Base32 quá ngắn: độ dài đã lọc 1–15 (< 16) → không hợp lệ.
const tooShortArb = fc
    .integer({ min: 1, max: 15 })
    .chain((len) => base32OfLengthArb(len).map((value) => ({ value, expected: false })));

// (b) Base32 quá dài: độ dài đã lọc 129–170 (> 128) → không hợp lệ.
const tooLongArb = fc
    .integer({ min: 129, max: 170 })
    .chain((len) => base32OfLengthArb(len).map((value) => ({ value, expected: false })));

// (c) Chuỗi TOÀN CHỮ SỐ (kể cả độ dài lớn) → bị loại → không hợp lệ.
const allDigitsArb = fc
    .stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 1, maxLength: 40 })
    .map((value) => ({ value, expected: false }));

// (d) Chuỗi rác ký tự đặc biệt (không có ký tự Base32) → chuỗi đã lọc rỗng → không hợp lệ.
const specialGarbageArb = fc
    .stringOf(fc.constantFrom('!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '=', '.', '/', '?'), {
        minLength: 1,
        maxLength: 30,
    })
    .map((value) => ({ value, expected: false }));

// Bộ sinh tổng hợp phủ mọi nhóm trên.
const case2faArb = fc.oneof(
    emptyArb,
    validSecretArb,
    otpauthArb,
    tooShortArb,
    tooLongArb,
    allDigitsArb,
    specialGarbageArb,
);

// ==========================================================================
// Property 5 — isValidQuickEdit2fa hợp lệ KHI VÀ CHỈ KHI rỗng / Secret TOTP
// Base32 16–128 / URL otpauth.
// ==========================================================================

describe('Feature: quick-edit-account-detail, Property 5: Xác thực định dạng 2FA', () => {
    it('trả về hợp lệ khi và chỉ khi chuỗi rỗng, hoặc Secret TOTP Base32 16–128, hoặc URL otpauth', () => {
        fc.assert(
            fc.property(case2faArb, ({ value, expected }) => {
                expect(isValidQuickEdit2fa(value)).toBe(expected);
            }),
            { numRuns: 300 },
        );
    });

    it('phủ chính xác biên độ dài Base32: 15 không hợp lệ, 16 và 128 hợp lệ, 129 không hợp lệ', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(
                    { len: 15, expected: false },
                    { len: 16, expected: true },
                    { len: 17, expected: true },
                    { len: 128, expected: true },
                    { len: 129, expected: false },
                ),
                ({ len, expected }) => {
                    // Dựng chuỗi Base32 có ĐÚNG `len` ký tự (đảm bảo có chữ cái ở đầu).
                    const core = 'A' + 'BCDEFGHIJKLMNOPQRSTUVWXYZ234567'.repeat(6).slice(0, Math.max(0, len - 1));
                    expect(core.length).toBe(len);
                    expect(isValidQuickEdit2fa(core)).toBe(expected);
                },
            ),
            { numRuns: 100 },
        );
    });
});
