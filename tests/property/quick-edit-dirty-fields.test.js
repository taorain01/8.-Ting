// ============================================================================
// Property-based test cho Quick_Edit_Core.computeDirtyFields
// (`js/quick-edit-core.js`).
//
// Feature: quick-edit-account-detail, Property 2: Xác định đúng tập ô đã thay đổi
// — Với mọi cặp bộ giá trị ban đầu và bộ giá trị hiện tại, một ô nằm trong tập
// computeDirtyFields khi và chỉ khi giá trị đã chuẩn hoá của nó khác với giá trị
// ban đầu đã chuẩn hoá; đặc biệt, khi mọi ô có giá trị hiện tại chuẩn hoá bằng
// giá trị ban đầu chuẩn hoá thì tập trả về là rỗng.
//
// Validates: Requirements 4.1, 4.4
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fc = require('fast-check');
const {
  computeDirtyFields,
  normalizeQuickEditValue,
  QUICK_EDIT_FIELDS,
} = require('../../js/quick-edit-core.js');

// --- Hằng số ----------------------------------------------------------------

// Danh sách tên ô theo đúng thứ tự khai báo trong QUICK_EDIT_FIELDS.
const FIELD_NAMES = Object.keys(QUICK_EDIT_FIELDS); // [username, password, twoFaCode, sellerName, note]

// --- Generators -------------------------------------------------------------

// Ký tự khoảng trắng mà trim() loại bỏ (space, tab, xuống dòng, no-break space,
// ideographic space, BOM...). Dùng để dựng biến thể "chỉ khác khoảng trắng đầu/cuối".
const WS_CHARS = [' ', '\t', '\n', '\r', '\f', '\v', '\u00A0', '\u3000', '\uFEFF'];
const wsCharArb = fc.constantFrom(...WS_CHARS);
// Chuỗi khoảng trắng bất kỳ ở hai đầu (bao gồm chuỗi rỗng).
const wsArb = fc.stringOf(wsCharArb, { maxLength: 6 });

// Ký tự KHÔNG phải khoảng trắng, phủ Latin, số, ký hiệu, tiếng Việt, Unicode.
const nonWsCharArb = fc.constantFrom(
  'a', 'Z', '9', '0', '_', '@', '#', '.', '-', '!',
  'á', 'ệ', 'Đ', 'ô', 'ự', 'ữ', 'ậ',   // tiếng Việt có dấu
  '中', '漢', 'π', 'Ω',                  // Unicode ngoài Latin
);

// Nội dung "phần giữa" bất kỳ (có thể chứa khoảng trắng, xuống dòng, Unicode).
const middleArb = fc.stringOf(
  fc.oneof(wsCharArb, nonWsCharArb, fc.fullUnicode()),
  { maxLength: 20 },
);

// "Phần lõi" bền vững qua chuẩn hoá: rỗng, một ký tự không-khoảng-trắng, hoặc
// bắt đầu/kết thúc bằng ký tự không-khoảng-trắng. Nhờ hai đầu không-khoảng-trắng,
// normalizeQuickEditValue giữ nguyên phần lõi này.
const coreArb = fc.oneof(
  fc.constant(''),
  nonWsCharArb,
  fc.tuple(nonWsCharArb, middleArb, nonWsCharArb).map(([a, m, b]) => a + m + b),
);

// Giá trị bất kỳ (có thể lẫn khoảng trắng hai đầu, null/undefined) cho một ô.
const anyValueArb = fc.oneof(
  fc.constantFrom(null, undefined),
  richValueArb(),
);

function richValueArb() {
  return fc.stringOf(
    fc.oneof(wsCharArb, nonWsCharArb, fc.fullUnicode()),
    { maxLength: 30 },
  );
}

// Bộ giá trị bất kỳ cho toàn bộ 5 ô (mỗi ô nhận anyValueArb độc lập).
function valuesArb() {
  return fc.record(
    FIELD_NAMES.reduce((acc, name) => {
      acc[name] = anyValueArb;
      return acc;
    }, {}),
  );
}

// Biến thể "chỉ thêm khoảng trắng hai đầu" của một phần lõi: giá trị mới KHÁC
// chuỗi gốc về mặt ký tự nhưng BẰNG nhau sau khi chuẩn hoá => KHÔNG được dirty.
const paddedCoreArb = fc.tuple(wsArb, coreArb, wsArb).map(([lead, core, trail]) => ({
  core,
  padded: lead + core + trail,
}));

// --- Properties -------------------------------------------------------------

describe('Property 2 — computeDirtyFields xác định đúng tập ô đã thay đổi (Requirements 4.1, 4.4)', () => {
  it('một ô là dirty KHI VÀ CHỈ KHI giá trị chuẩn hoá của nó khác giá trị ban đầu chuẩn hoá', () => {
    fc.assert(
      fc.property(valuesArb(), valuesArb(), (original, current) => {
        const dirty = computeDirtyFields(original, current);
        const dirtySet = new Set(dirty);

        for (const field of FIELD_NAMES) {
          const changed =
            normalizeQuickEditValue(current[field]) !==
            normalizeQuickEditValue(original[field]);
          // Tương đương hai chiều (iff): thuộc tập dirty đúng bằng "đã đổi sau chuẩn hoá".
          expect(dirtySet.has(field)).toBe(changed);
        }

        // Kết quả chỉ chứa các field hợp lệ và không trùng lặp.
        expect(dirty.every((f) => FIELD_NAMES.includes(f))).toBe(true);
        expect(dirty.length).toBe(dirtySet.size);
      }),
      { numRuns: 300 },
    );
  });

  it('khi mọi ô có giá trị hiện tại chuẩn hoá BẰNG giá trị ban đầu chuẩn hoá thì tập trả về rỗng', () => {
    // Với mỗi ô, sinh một phần lõi rồi tạo biến thể chỉ khác khoảng trắng hai đầu.
    const perFieldArb = fc.record(
      FIELD_NAMES.reduce((acc, name) => {
        acc[name] = paddedCoreArb;
        return acc;
      }, {}),
    );

    fc.assert(
      fc.property(perFieldArb, (spec) => {
        const original = {};
        const current = {};
        for (const field of FIELD_NAMES) {
          original[field] = spec[field].core;      // giá trị gốc (đã sạch hai đầu)
          current[field] = spec[field].padded;     // cùng lõi, chỉ thêm khoảng trắng đầu/cuối
        }
        // Dù khác nhau về khoảng trắng hai đầu, chuẩn hoá cho cùng kết quả => không dirty.
        expect(computeDirtyFields(original, current)).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });

  it('edge case: khác biệt phần GIỮA luôn làm ô đó dirty', () => {
    fc.assert(
      fc.property(
        // Sinh hai lõi khác nhau (khác về ký tự giữa, không thể bằng sau chuẩn hoá).
        coreArb,
        coreArb,
        fc.constantFrom(...FIELD_NAMES),
        (coreA, coreB, target) => {
          // Chỉ xét khi hai lõi thực sự khác nhau sau chuẩn hoá.
          fc.pre(normalizeQuickEditValue(coreA) !== normalizeQuickEditValue(coreB));
          const original = {};
          const current = {};
          for (const field of FIELD_NAMES) {
            original[field] = 'giá trị chung ổn định';
            current[field] = 'giá trị chung ổn định';
          }
          original[target] = coreA;
          current[target] = coreB;
          const dirty = computeDirtyFields(original, current);
          // Đúng ô target phải nằm trong tập dirty, các ô còn lại không đổi.
          expect(dirty).toEqual([target]);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('edge case: rỗng vs khoảng trắng KHÔNG dirty; rỗng vs nội dung thật thì dirty', () => {
    fc.assert(
      fc.property(
        wsArb,                 // chuỗi toàn khoảng trắng (chuẩn hoá -> '')
        nonWsCharArb,          // một ký tự thật (chuẩn hoá -> khác '')
        fc.constantFrom(...FIELD_NAMES),
        (whitespace, realChar, target) => {
          const base = FIELD_NAMES.reduce((acc, f) => { acc[f] = ''; return acc; }, {});

          // (1) '' so với chuỗi toàn khoảng trắng: cùng chuẩn hoá '' => KHÔNG dirty.
          const currWs = { ...base, [target]: whitespace };
          expect(computeDirtyFields(base, currWs)).toEqual([]);

          // (2) '' so với nội dung thật: chuẩn hoá khác nhau => dirty đúng ô target.
          const currReal = { ...base, [target]: realChar };
          expect(computeDirtyFields(base, currReal)).toEqual([target]);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('edge case: original === current (cùng tham chiếu/nội dung) luôn cho tập rỗng', () => {
    fc.assert(
      fc.property(valuesArb(), (values) => {
        expect(computeDirtyFields(values, values)).toEqual([]);
      }),
      { numRuns: 150 },
    );
  });
});
