// ============================================================================
// Property-based test cho Quick_Edit_Core.validateQuickEditLengths
// (`js/quick-edit-core.js`).
//
// Feature: quick-edit-account-detail, Property 6: Xác thực độ dài trường thường
// — Với mọi bộ giá trị các ô sau khi chuẩn hoá, validateQuickEditLengths phải
// báo KHÔNG hợp lệ khi và chỉ khi ô Người bán (sellerName) vượt quá 255 ký tự
// HOẶC ô Ghi chú (note) vượt quá 1000 ký tự; ngược lại phải báo hợp lệ.
//
// Validates: Requirements 5.4
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fc = require('fast-check');
const {
  validateQuickEditLengths,
  normalizeQuickEditValue,
  QUICK_EDIT_FIELDS,
} = require('../../js/quick-edit-core.js');

// --- Hằng số ----------------------------------------------------------------

const SELLER_LIMIT = QUICK_EDIT_FIELDS.sellerName.maxLength; // 255
const NOTE_LIMIT = QUICK_EDIT_FIELDS.note.maxLength;         // 1000
const FIELD_NAMES = Object.keys(QUICK_EDIT_FIELDS); // [username, password, twoFaCode, sellerName, note]

// Tên các trường THƯỜNG (không nhạy cảm) — chỉ hai trường này bị ràng buộc độ dài.
const PLAIN_FIELDS = FIELD_NAMES.filter((f) => !QUICK_EDIT_FIELDS[f].sensitive);
// Tên các trường NHẠY CẢM (không bị coi là lỗi độ dài dù dài bao nhiêu).
const SENSITIVE_FIELDS = FIELD_NAMES.filter((f) => QUICK_EDIT_FIELDS[f].sensitive);

// --- Generators -------------------------------------------------------------

// Ký tự khoảng trắng mà trim() loại bỏ ở hai đầu.
const WS_CHARS = [' ', '\t', '\n', '\r', '\f', '\v', '\u00A0', '\u3000', '\uFEFF'];
const wsCharArb = fc.constantFrom(...WS_CHARS);
// Chuỗi khoảng trắng bất kỳ ở hai đầu (bao gồm rỗng) — dùng để bọc quanh phần lõi.
const wsPadArb = fc.stringOf(wsCharArb, { maxLength: 6 });

// Ký tự KHÔNG phải khoảng trắng, phủ Latin, số, ký hiệu, tiếng Việt, Unicode.
// Mỗi phần tử là MỘT code unit đơn (dùng để kiểm soát chính xác .length sau chuẩn hoá).
const nonWsCharArb = fc.constantFrom(
  'a', 'Z', '9', '0', '_', '@', '#', '.', '-', '!',
  'á', 'ệ', 'Đ', 'ô', 'ự', 'ữ', 'ậ',   // tiếng Việt có dấu (dạng tổ hợp sẵn, 1 code unit)
  '中', '漢', 'π', 'Ω',                  // Unicode ngoài Latin (BMP, 1 code unit)
);

// Sinh một chuỗi "lõi" có ĐỘ DÀI CHÍNH XÁC bằng `len`, hai đầu là ký tự
// không-khoảng-trắng nên độ dài được bảo toàn qua normalizeQuickEditValue.
function coreOfLengthArb(len) {
  if (len <= 0) return fc.constant('');
  if (len === 1) return nonWsCharArb;
  // Ký tự đầu và cuối là non-WS để chuẩn hoá không cắt mất; phần giữa tuỳ ý non-WS.
  return fc
    .array(nonWsCharArb, { minLength: len - 2, maxLength: len - 2 })
    .chain((mid) =>
      fc.tuple(nonWsCharArb, fc.constant(mid.join('')), nonWsCharArb).map(
        ([a, m, b]) => a + m + b,
      ),
    );
}

// Bọc một lõi bằng khoảng trắng hai đầu (không đổi độ dài sau chuẩn hoá).
function paddedArb(coreArb) {
  return fc.tuple(wsPadArb, coreArb, wsPadArb).map(([l, c, r]) => l + c + r);
}

// Giá trị tuỳ ý cho một ô (có thể null/undefined, khoảng trắng, Unicode, tiếng Việt).
const anyValueArb = fc.oneof(
  fc.constantFrom(null, undefined),
  fc.stringOf(fc.oneof(wsCharArb, nonWsCharArb, fc.fullUnicode()), { maxLength: 40 }),
);

// Bộ giá trị đầy đủ 5 ô, mỗi ô độc lập.
function valuesArb() {
  return fc.record(
    FIELD_NAMES.reduce((acc, name) => {
      acc[name] = anyValueArb;
      return acc;
    }, {}),
  );
}

// Định nghĩa tham chiếu độc lập: tính lại kỳ vọng ok theo đúng đặc tả Property 6.
function expectedOk(values) {
  const seller = normalizeQuickEditValue(values.sellerName);
  const note = normalizeQuickEditValue(values.note);
  return seller.length <= SELLER_LIMIT && note.length <= NOTE_LIMIT;
}

// --- Properties -------------------------------------------------------------

describe('Property 6 — validateQuickEditLengths xác thực độ dài trường thường (Requirements 5.4)', () => {
  it('iff: ok=false KHI VÀ CHỈ KHI sellerName>255 hoặc note>1000 (sau chuẩn hoá)', () => {
    fc.assert(
      fc.property(valuesArb(), (values) => {
        const result = validateQuickEditLengths(values);
        const shouldBeOk = expectedOk(values);

        expect(result.ok).toBe(shouldBeOk);

        if (shouldBeOk) {
          // Hợp lệ: không có field vi phạm.
          expect(result.field).toBeUndefined();
        } else {
          // Không hợp lệ: phải chỉ đúng field vi phạm là sellerName hoặc note.
          expect(['sellerName', 'note']).toContain(result.field);
          expect(typeof result.message).toBe('string');
          expect(result.message.length).toBeGreaterThan(0);
          // Field báo cáo phải thực sự vượt giới hạn của nó.
          const norm = normalizeQuickEditValue(values[result.field]);
          const limit = QUICK_EDIT_FIELDS[result.field].maxLength;
          expect(norm.length).toBeGreaterThan(limit);
        }
      }),
      { numRuns: 300 },
    );
  });

  // Sinh một cặp { len, padded } trong đó `padded` là lõi độ dài `len` được bọc
  // khoảng trắng hai đầu; `len` lấy quanh ngưỡng `limit` (bằng, dưới 1, vượt 1).
  function paddedAroundLimitArb(limit) {
    return fc
      .constantFrom(limit - 1, limit, limit + 1)
      .chain((len) =>
        paddedArb(coreOfLengthArb(len)).map((padded) => ({ len, padded })),
      );
  }

  it('edge case: sellerName quanh ngưỡng 255 (bằng/dưới 1 => hợp lệ; vượt 1 => lỗi)', () => {
    fc.assert(
      fc.property(paddedAroundLimitArb(SELLER_LIMIT), ({ len, padded }) => {
        const values = { sellerName: padded, note: 'ghi chú ngắn hợp lệ' };
        // Xác nhận độ dài sau chuẩn hoá đúng bằng len (khoảng trắng hai đầu bị cắt).
        expect(normalizeQuickEditValue(padded).length).toBe(len);
        const result = validateQuickEditLengths(values);
        if (len <= SELLER_LIMIT) {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
          expect(result.field).toBe('sellerName');
        }
      }),
      { numRuns: 150 },
    );
  });

  it('edge case: note quanh ngưỡng 1000 (bằng/dưới 1 => hợp lệ; vượt 1 => lỗi)', () => {
    fc.assert(
      fc.property(paddedAroundLimitArb(NOTE_LIMIT), ({ len, padded }) => {
        const values = { sellerName: 'người bán ngắn', note: padded };
        expect(normalizeQuickEditValue(padded).length).toBe(len);
        const result = validateQuickEditLengths(values);
        if (len <= NOTE_LIMIT) {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
          expect(result.field).toBe('note');
        }
      }),
      { numRuns: 150 },
    );
  });

  it('edge case: khoảng trắng hai đầu bị cắt trước khi tính độ dài (độ dài tính sau chuẩn hoá)', () => {
    fc.assert(
      fc.property(
        // Lõi đúng bằng giới hạn (hợp lệ) nhưng bọc thêm nhiều khoảng trắng hai đầu.
        coreOfLengthArb(SELLER_LIMIT),
        wsPadArb,
        wsPadArb,
        (core, lead, trail) => {
          const values = { sellerName: lead + core + trail, note: '' };
          // Dù chuỗi thô dài hơn 255 do khoảng trắng, sau chuẩn hoá vẫn đúng 255 => hợp lệ.
          const result = validateQuickEditLengths(values);
          expect(result.ok).toBe(true);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('edge case: trường NHẠY CẢM dài bao nhiêu cũng KHÔNG bị coi là lỗi độ dài', () => {
    fc.assert(
      fc.property(
        // Chuỗi rất dài (vượt xa mọi giới hạn) cho các trường nhạy cảm.
        fc.string({ minLength: 300, maxLength: 1500 }),
        fc.constantFrom(...SENSITIVE_FIELDS),
        (longStr, sensitiveField) => {
          // sellerName/note để hợp lệ; chỉ nhồi trường nhạy cảm dài quá mức.
          const values = { sellerName: '', note: '' };
          values[sensitiveField] = longStr;
          const result = validateQuickEditLengths(values);
          // Trường nhạy cảm không nằm trong phạm vi kiểm tra độ dài => vẫn hợp lệ.
          expect(result.ok).toBe(true);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('edge case: cả sellerName và note cùng vượt giới hạn => vẫn báo lỗi (ưu tiên sellerName)', () => {
    fc.assert(
      fc.property(
        coreOfLengthArb(SELLER_LIMIT + 1),
        coreOfLengthArb(NOTE_LIMIT + 1),
        (sellerCore, noteCore) => {
          const values = { sellerName: sellerCore, note: noteCore };
          const result = validateQuickEditLengths(values);
          expect(result.ok).toBe(false);
          // Theo thứ tự khai báo QUICK_EDIT_FIELDS, sellerName được xét trước note.
          expect(result.field).toBe('sellerName');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('edge case: bộ giá trị rỗng/thiếu ô đều hợp lệ (chuẩn hoá về chuỗi rỗng)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom({}, { sellerName: null }, { note: undefined }, { sellerName: '   ', note: '\n\t' }),
        (values) => {
          const result = validateQuickEditLengths(values);
          expect(result.ok).toBe(true);
          // Đối chiếu với định nghĩa tham chiếu độc lập.
          expect(result.ok).toBe(expectedOk(values));
        },
      ),
      { numRuns: 100 },
    );
  });
});
