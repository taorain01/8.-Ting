// ============================================================================
// Property-based test cho Quick_Edit_Core.normalizeQuickEditValue
// (`js/quick-edit-core.js`).
//
// Feature: quick-edit-account-detail, Property 1: Chuẩn hoá giá trị cắt hai đầu
// và bảo toàn phần giữa — Với mọi chuỗi đầu vào, normalizeQuickEditValue phải
// loại bỏ toàn bộ khoảng trắng ở đầu và cuối, giữ nguyên mọi ký tự (kể cả
// khoảng trắng) nằm giữa các ký tự không-khoảng-trắng, và phải idempotent
// (áp dụng hai lần cho cùng kết quả như áp dụng một lần).
//
// Validates: Requirements 5.1
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fc = require('fast-check');
const { normalizeQuickEditValue } = require('../../js/quick-edit-core.js');

// --- Generators -------------------------------------------------------------

// Các ký tự khoảng trắng mà String.prototype.trim() sẽ loại bỏ (space, tab,
// xuống dòng, vertical tab, form feed, no-break space, ideographic space, BOM).
const WS_CHARS = [' ', '\t', '\n', '\r', '\f', '\v', '\u00A0', '\u3000', '\uFEFF'];
const wsCharArb = fc.constantFrom(...WS_CHARS);
// Chuỗi khoảng trắng bất kỳ ở hai đầu (bao gồm chuỗi rỗng).
const wsArb = fc.stringOf(wsCharArb, { maxLength: 8 });

// Ký tự KHÔNG phải khoảng trắng, phủ chữ Latin, số, ký hiệu, tiếng Việt, Unicode.
const nonWsCharArb = fc.constantFrom(
  'a', 'Z', '9', '0', '_', '@', '#', '.', '-', '!',
  'á', 'ệ', 'Đ', 'ô', 'ự', 'ữ', 'ậ',   // tiếng Việt có dấu
  '中', '漢', 'π', 'Ω',                  // Unicode ngoài Latin
);

// Nội dung "phần giữa" bất kỳ (có thể chứa khoảng trắng, xuống dòng, Unicode).
const middleArb = fc.stringOf(
  fc.oneof(
    wsCharArb,
    nonWsCharArb,
    fc.fullUnicode(),
  ),
  { maxLength: 30 },
);

// "Phần lõi" cần được bảo toàn nguyên vẹn sau khi chuẩn hoá:
//   - chuỗi rỗng, HOẶC
//   - một ký tự không-khoảng-trắng, HOẶC
//   - bắt đầu và kết thúc bằng ký tự không-khoảng-trắng, giữa là nội dung bất kỳ.
// Nhờ hai đầu là ký tự không-khoảng-trắng, trim() sẽ không đụng tới phần lõi.
const coreArb = fc.oneof(
  fc.constant(''),
  nonWsCharArb,
  fc.tuple(nonWsCharArb, middleArb, nonWsCharArb).map(([a, m, b]) => a + m + b),
);

// Chuỗi phong phú bất kỳ để kiểm idempotence và các bất biến chung.
const richStringArb = fc.stringOf(
  fc.oneof(wsCharArb, nonWsCharArb, fc.fullUnicode()),
  { maxLength: 40 },
);

// Regex loại bỏ khoảng trắng hai đầu, dùng làm tham chiếu độc lập với cài đặt.
const TRIM_EDGES = /^\s+|\s+$/g;

// --- Properties -------------------------------------------------------------

describe('Property 1 — normalizeQuickEditValue cắt hai đầu, giữ phần giữa (Requirements 5.1)', () => {
  it('cắt khoảng trắng đầu/cuối và bảo toàn nguyên vẹn phần lõi ở giữa', () => {
    fc.assert(
      fc.property(wsArb, coreArb, wsArb, (lead, core, trail) => {
        const input = lead + core + trail;
        const result = normalizeQuickEditValue(input);
        // Kết quả phải đúng bằng phần lõi: khoảng trắng hai đầu bị cắt,
        // toàn bộ ký tự (kể cả khoảng trắng) ở giữa được giữ nguyên.
        expect(result).toBe(core);
      }),
      { numRuns: 300 },
    );
  });

  it('idempotent: chuẩn hoá hai lần cho cùng kết quả như một lần', () => {
    fc.assert(
      fc.property(richStringArb, (s) => {
        const once = normalizeQuickEditValue(s);
        const twice = normalizeQuickEditValue(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 200 },
    );
  });

  it('kết quả không còn khoảng trắng thừa ở hai đầu', () => {
    fc.assert(
      fc.property(richStringArb, (s) => {
        const result = normalizeQuickEditValue(s);
        // Không còn gì để cắt thêm ở hai đầu.
        expect(result).toBe(result.replace(TRIM_EDGES, ''));
      }),
      { numRuns: 200 },
    );
  });

  it('edge case: null/undefined và chuỗi toàn khoảng trắng đều cho chuỗi rỗng', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(null, undefined, ''),
          fc.stringOf(wsCharArb, { minLength: 1, maxLength: 12 }), // chuỗi toàn khoảng trắng
        ),
        (value) => {
          expect(normalizeQuickEditValue(value)).toBe('');
        },
      ),
      { numRuns: 150 },
    );
  });
});
