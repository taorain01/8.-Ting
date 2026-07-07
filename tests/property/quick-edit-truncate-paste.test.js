// ============================================================================
// Property test — spec "quick-edit-account-detail".
//
// Feature: quick-edit-account-detail, Property 4: Dán bảo toàn nội dung trong
// giới hạn và cắt phần vượt.
//
// Nội dung Property 4 (từ design.md):
//   Với mọi chuỗi được dán và mọi giới hạn ký tự dương của ô, kết quả sau khi
//   áp dụng `truncateToLimit` phải:
//     (a) có độ dài KHÔNG vượt quá giới hạn, và
//     (b) là TIỀN TỐ (prefix) của chuỗi được dán;
//   ngoài ra, nếu chuỗi dán có độ dài KHÔNG vượt giới hạn thì kết quả bằng ĐÚNG
//   chuỗi dán ban đầu (bao gồm mọi khoảng trắng và ký tự xuống dòng).
//
// Phương pháp: dùng fast-check sinh ngẫu nhiên chuỗi dán và giới hạn ký tự dương,
// phủ các edge case theo Chiến lược Kiểm thử của thiết kế: chuỗi quanh ngưỡng
// 16/128/255/1000, chuỗi rỗng, ký tự xuống dòng, Unicode/tiếng Việt, và nhiều
// giới hạn dương khác nhau (kể cả giới hạn thực tế của các ô trong QUICK_EDIT_FIELDS).
//
// Validates: Requirements 2.6, 2.7
// ============================================================================

const fc = require('fast-check');
const { truncateToLimit, QUICK_EDIT_FIELDS } = require('../../js/quick-edit-core.js');

// Các ngưỡng giới hạn quan trọng cần phủ (giới hạn thực tế của các ô + biên).
const KNOWN_LIMITS = [1, 15, 16, 17, 127, 128, 129, 254, 255, 256, 999, 1000, 1001];

// --- Generators -------------------------------------------------------------

// Ký tự đa dạng: ASCII, khoảng trắng, xuống dòng, tab, Unicode và tiếng Việt.
const richCharArb = fc.constantFrom(
    'a', 'Z', '1', '@', ' ', '\t', '\n', '\r\n',
    'à', 'ệ', 'ữ', 'Đ', 'ngọc', 'tài khoản',
    'Ω', '汉', '🔒', '\u00a0',
);

// Chuỗi dán "giàu" edge case: ghép nhiều mảnh ký tự đa dạng, cho phép rỗng.
const richPasteArb = fc
    .array(richCharArb, { minLength: 0, maxLength: 40 })
    .map((parts) => parts.join(''));

// Chuỗi dán độ dài lớn để chạm/ vượt các ngưỡng 255/1000.
const longPasteArb = fc
    .tuple(
        fc.constantFrom('x', 'ệ', ' ', '\n', 'ab'),
        fc.integer({ min: 0, max: 1200 }),
    )
    .map(([unit, n]) => unit.repeat(n));

// Chuỗi dán tổng hợp: phủ cả chuỗi ngắn giàu ký tự lẫn chuỗi rất dài.
const pasteArb = fc.oneof(richPasteArb, longPasteArb, fc.string({ maxLength: 60 }));

// Giới hạn dương: trộn giá trị ngẫu nhiên với các ngưỡng đã biết.
const positiveLimitArb = fc.oneof(
    fc.integer({ min: 1, max: 1200 }),
    fc.constantFrom(...KNOWN_LIMITS),
);

// --- Tính chất hỗ trợ -------------------------------------------------------

// Kiểm tra `candidate` có phải tiền tố của `full` không (theo đơn vị code unit
// của JS string, đúng với cách `String.prototype.slice` hoạt động).
function isPrefix(candidate, full) {
    return full.slice(0, candidate.length) === candidate;
}

// ==========================================================================
// Property 4 — truncateToLimit bảo toàn tiền tố, tôn trọng giới hạn.
// ==========================================================================

describe('Feature: quick-edit-account-detail, Property 4: Dán bảo toàn nội dung trong giới hạn và cắt phần vượt', () => {
    it('với mọi chuỗi dán và giới hạn dương: kết quả <= giới hạn, là tiền tố, và bằng nguyên chuỗi khi không vượt giới hạn', () => {
        fc.assert(
            fc.property(pasteArb, positiveLimitArb, (pasted, limit) => {
                const result = truncateToLimit(pasted, limit);

                // (a) Độ dài kết quả không vượt quá giới hạn.
                expect(result.length).toBeLessThanOrEqual(limit);

                // (b) Kết quả là tiền tố của chuỗi được dán.
                expect(isPrefix(result, pasted)).toBe(true);

                if (pasted.length <= limit) {
                    // Không vượt giới hạn → giữ nguyên vẹn (kể cả khoảng trắng, xuống dòng).
                    expect(result).toBe(pasted);
                } else {
                    // Vượt giới hạn → cắt đúng tại giới hạn (kết quả = slice(0, limit)).
                    expect(result.length).toBe(limit);
                    expect(result).toBe(pasted.slice(0, limit));
                }
            }),
            { numRuns: 300 },
        );
    });

    it('phủ đúng các giới hạn thực tế của mọi ô trong QUICK_EDIT_FIELDS', () => {
        const fieldLimits = Object.values(QUICK_EDIT_FIELDS).map((f) => f.maxLength);

        fc.assert(
            fc.property(pasteArb, fc.constantFrom(...fieldLimits), (pasted, limit) => {
                const result = truncateToLimit(pasted, limit);

                expect(result.length).toBeLessThanOrEqual(limit);
                expect(isPrefix(result, pasted)).toBe(true);
                if (pasted.length <= limit) {
                    expect(result).toBe(pasted);
                }
            }),
            { numRuns: 200 },
        );
    });
});
