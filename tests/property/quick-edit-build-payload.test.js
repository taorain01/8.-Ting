// ============================================================================
// Property-based test cho Quick_Edit_Core.buildQuickEditPayload
// (`js/quick-edit-core.js`).
//
// Feature: quick-edit-account-detail, Property 3: Payload chỉ ghi đè ô đã thay
// đổi và giữ nguyên ô còn lại — Với mọi bộ giá trị đã lưu, tập ô đã thay đổi và
// bộ giá trị hiện tại, kết quả của buildQuickEditPayload phải mang giá trị hiện
// tại đã chuẩn hoá cho mỗi ô thuộc tập đã thay đổi (kể cả khi giá trị chuẩn hoá
// là rỗng đối với Trường nhạy cảm) và phải giữ đúng giá trị đã lưu trước đó cho
// mọi ô không thuộc tập đã thay đổi.
//
// Validates: Requirements 4.2, 4.3, 5.5
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fc = require('fast-check');
const {
  buildQuickEditPayload,
  normalizeQuickEditValue,
  QUICK_EDIT_FIELDS,
} = require('../../js/quick-edit-core.js');

// --- Hằng số ----------------------------------------------------------------

// Danh sách 5 khoá ô theo đúng thứ tự khai báo trong QUICK_EDIT_FIELDS.
const FIELD_KEYS = Object.keys(QUICK_EDIT_FIELDS);
// Tập các ô nhạy cảm — dùng để phủ edge case "xoá trắng Trường nhạy cảm".
const SENSITIVE_KEYS = FIELD_KEYS.filter((k) => QUICK_EDIT_FIELDS[k].sensitive);

// --- Generators -------------------------------------------------------------

// Ký tự khoảng trắng hai đầu (để kiểm việc chuẩn hoá cắt đầu/cuối).
const wsCharArb = fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\u00A0');
const wsArb = fc.stringOf(wsCharArb, { maxLength: 5 });

// Nội dung "lõi" phong phú: Latin, số, ký hiệu, tiếng Việt có dấu, Unicode,
// kèm cả khoảng trắng ở giữa (phần giữa phải được bảo toàn khi chuẩn hoá).
const coreCharArb = fc.constantFrom(
  'a', 'Z', '9', '0', '_', '@', '#', '.', '-', '!', ' ',
  'á', 'ệ', 'Đ', 'ô', 'ự', 'ữ', 'ậ', 'ê', 'ơ',   // tiếng Việt có dấu
  '中', '漢', 'π', 'Ω', '🙂',                       // Unicode / emoji
);

// Một giá trị ô bất kỳ: có thể rỗng, toàn khoảng trắng, hoặc có khoảng trắng
// bao quanh phần lõi (phủ edge case khoảng trắng đầu/cuối và giá trị rỗng).
const rawValueArb = fc.oneof(
  fc.constant(''),
  fc.constant(null),
  fc.constant(undefined),
  fc.stringOf(wsCharArb, { minLength: 1, maxLength: 6 }),          // toàn khoảng trắng
  fc.tuple(wsArb, fc.stringOf(coreCharArb, { maxLength: 20 }), wsArb)
    .map(([lead, core, trail]) => lead + core + trail),
);

// Bộ giá trị đủ 5 khoá (dùng cho cả savedValues và currentValues).
const valuesArb = fc.record({
  username: rawValueArb,
  password: rawValueArb,
  twoFaCode: rawValueArb,
  sellerName: rawValueArb,
  note: rawValueArb,
});

// Tập ô đã thay đổi: một tập con bất kỳ của 5 khoá (kể cả rỗng và đủ 5).
const dirtyFieldsArb = fc.subarray(FIELD_KEYS);

// --- Properties -------------------------------------------------------------

describe('Property 3 — buildQuickEditPayload ghi đè ô dirty, giữ nguyên ô còn lại (Requirements 4.2, 4.3, 5.5)', () => {
  it('ô dirty mang giá trị hiện tại đã chuẩn hoá; ô không dirty giữ đúng giá trị đã lưu; payload luôn đủ 5 khoá', () => {
    fc.assert(
      fc.property(valuesArb, dirtyFieldsArb, valuesArb, (savedValues, dirtyFields, currentValues) => {
        const payload = buildQuickEditPayload(savedValues, dirtyFields, currentValues);
        const dirtySet = new Set(dirtyFields);

        // Payload luôn có đúng 5 khoá theo QUICK_EDIT_FIELDS.
        expect(Object.keys(payload).sort()).toEqual([...FIELD_KEYS].sort());

        for (const field of FIELD_KEYS) {
          if (dirtySet.has(field)) {
            // Ô đã thay đổi: đúng bằng giá trị hiện tại đã chuẩn hoá.
            expect(payload[field]).toBe(normalizeQuickEditValue(currentValues[field]));
          } else {
            // Ô không đổi: giữ đúng giá trị đã lưu (mặc định '' nếu thiếu).
            const expected = savedValues[field] !== undefined ? savedValues[field] : '';
            expect(payload[field]).toBe(expected);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it('edge case: xoá trắng Trường nhạy cảm — dirty field có giá trị hiện tại rỗng thì payload phải là chuỗi rỗng', () => {
    // Giá trị hiện tại rỗng hoặc toàn khoảng trắng cho một Trường nhạy cảm bất kỳ,
    // và ô đó thuộc tập dirty => payload của ô đó phải là '' (được phép xoá trắng).
    const blankArb = fc.oneof(
      fc.constant(''),
      fc.constant(null),
      fc.constant(undefined),
      fc.stringOf(wsCharArb, { minLength: 1, maxLength: 6 }),
    );
    fc.assert(
      fc.property(
        valuesArb,
        fc.constantFrom(...SENSITIVE_KEYS),
        blankArb,
        (savedValues, sensitiveField, blankValue) => {
          const currentValues = { ...savedValues, [sensitiveField]: blankValue };
          const payload = buildQuickEditPayload(savedValues, [sensitiveField], currentValues);
          expect(payload[sensitiveField]).toBe('');
        },
      ),
      { numRuns: 150 },
    );
  });

  it('tập dirty rỗng: payload giữ nguyên toàn bộ giá trị đã lưu', () => {
    fc.assert(
      fc.property(valuesArb, valuesArb, (savedValues, currentValues) => {
        const payload = buildQuickEditPayload(savedValues, [], currentValues);
        for (const field of FIELD_KEYS) {
          const expected = savedValues[field] !== undefined ? savedValues[field] : '';
          expect(payload[field]).toBe(expected);
        }
      }),
      { numRuns: 150 },
    );
  });
});
