// ============================================================================
// Property-based test cho validateCategoryName (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 6: Validation tên Account_Category
//   Với mọi chuỗi tên đầu vào, danh sách tên đã tồn tại, và id đang sửa (nếu có),
//   validateCategoryName chấp nhận (valid: true) KHI VÀ CHỈ KHI độ dài sau khi
//   loại bỏ khoảng trắng đầu cuối nằm trong [CATEGORY_NAME_MIN=1, CATEGORY_NAME_MAX=50]
//   VÀ tên không trùng (không phân biệt hoa/thường, so sau trim.toLowerCase) với
//   danh mục KHÁC trong cùng nhóm. Khi entry là đối tượng { id, name } và có
//   editingId thì loại trừ chính danh mục đang sửa theo id. Mọi trường hợp còn
//   lại đều bị từ chối với reason ∈ {empty, too_long, duplicate}.
//
// Validates: Requirements 6.3, 6.4
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

// --- Nạp js/groups.js trong vm sandbox (các hàm là global trong groups.js) ---
// Cuối file groups.js có các gán `window.xxx = ...` nên sandbox PHẢI có window.

const GROUPS_PATH = path.join(__dirname, '..', '..', 'js', 'groups.js');
const GROUPS_SRC = fs.readFileSync(GROUPS_PATH, 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingGroupExports = {
  validateCategoryName,
  normalizeGroupCategoryId,
};
`;

function loadGroups() {
  const sandbox = {
    window: {},
    console,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    JSON,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(GROUPS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'groups.js' });
  return sandbox.__tingGroupExports;
}

const { validateCategoryName, normalizeGroupCategoryId } = loadGroups();

// Hằng số hợp đồng (đồng bộ với CATEGORY_NAME_MIN/MAX trong groups.js).
const NAME_MIN = 1;
const NAME_MAX = 50;

// --- Oracle độc lập cho tính hợp lệ -----------------------------------------
// Xác định kết quả kỳ vọng theo đúng phát biểu Property 6, không phụ thuộc cài đặt.
function refValidate(name, existingNames, editingId) {
  const trimmed = String(name == null ? '' : name).trim();
  const length = trimmed.length;
  if (length < NAME_MIN) return { valid: false, reason: 'empty' };
  if (length > NAME_MAX) return { valid: false, reason: 'too_long' };

  const editing = editingId == null ? '' : normalizeGroupCategoryId(editingId);
  const key = trimmed.toLowerCase();
  const others = (Array.isArray(existingNames) ? existingNames : []).filter((entry) => {
    if (editing && entry && typeof entry === 'object') {
      return normalizeGroupCategoryId(entry.id) !== editing;
    }
    return true;
  });
  const duplicated = others.some((entry) => {
    const otherName = entry && typeof entry === 'object' ? entry.name : entry;
    return String(otherName == null ? '' : otherName).trim().toLowerCase() === key;
  });
  if (duplicated) return { valid: false, reason: 'duplicate' };
  return { valid: true };
}

// --- Generators -------------------------------------------------------------

// Chuỗi khoảng trắng thuần (để dựng tên rỗng sau trim).
const whitespaceArb = fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'), { maxLength: 6 });

// Tên hợp lệ về độ dài (1..50 sau trim): lõi không phải khoảng trắng ở hai đầu.
const validCoreArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length >= NAME_MIN && s.trim().length <= NAME_MAX);

// Tên quá dài (> 50 sau trim).
const tooLongArb = fc
  .string({ minLength: 51, maxLength: 120 })
  .map((s) => s.replace(/\s/g, 'x')) // đảm bảo mọi ký tự đều không phải khoảng trắng
  .filter((s) => s.trim().length > NAME_MAX);

// Tên bất kỳ (phủ toàn không gian đầu vào, gồm cả unicode tiếng Việt).
const anyNameArb = fc.oneof(
  { weight: 3, arbitrary: validCoreArb },
  { weight: 1, arbitrary: whitespaceArb },
  { weight: 1, arbitrary: tooLongArb },
  { weight: 1, arbitrary: fc.constantFrom('Netflix', 'netflix', ' NETFLIX ', 'Chưa phân loại', 'Học tập') },
  { weight: 1, arbitrary: fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant('')) },
);

// Một entry trong existingNames: hoặc chuỗi tên, hoặc đối tượng { id, name }.
const entryArb = fc.oneof(
  fc.string({ maxLength: 30 }),
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    name: fc.string({ maxLength: 30 }),
  }),
);

const existingNamesArb = fc.array(entryArb, { maxLength: 8 });

// editingId: có thể vắng (null/undefined) hoặc là một id chuỗi.
const editingIdArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.string({ minLength: 1, maxLength: 20 }),
);

// --- Property 6 (tổng quát) -------------------------------------------------

describe('Property 6 — validateCategoryName chấp nhận iff độ dài trong [1,50] và không trùng (Requirements 6.3, 6.4)', () => {
  it('khớp oracle: valid, reason, và name (trim) trên toàn không gian đầu vào', () => {
    fc.assert(
      fc.property(anyNameArb, existingNamesArb, editingIdArb, (name, existingNames, editingId) => {
        const result = validateCategoryName(name, existingNames, editingId);
        const expected = refValidate(name, existingNames, editingId);

        // name trả về luôn là chuỗi đã trim.
        expect(result.name).toBe(String(name == null ? '' : name).trim());

        expect(result.valid).toBe(expected.valid);
        if (expected.valid) {
          expect(result.reason).toBeUndefined();
        } else {
          expect(result.reason).toBe(expected.reason);
        }
      }),
      { numRuns: 300 },
    );
  });

  // --- Các trường hợp cần bao phủ (theo yêu cầu task) -----------------------

  it('tên rỗng hoặc toàn khoảng trắng → reason "empty"', () => {
    fc.assert(
      fc.property(whitespaceArb, existingNamesArb, (ws, existingNames) => {
        const result = validateCategoryName(ws, existingNames, null);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('empty');
      }),
      { numRuns: 150 },
    );
  });

  it('tên > 50 ký tự sau trim → reason "too_long"', () => {
    fc.assert(
      fc.property(tooLongArb, existingNamesArb, (name, existingNames) => {
        const result = validateCategoryName(name, existingNames, null);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('too_long');
      }),
      { numRuns: 150 },
    );
  });

  it('tên trùng (không phân biệt hoa/thường) với một phần tử khác → reason "duplicate"', () => {
    // Dựng tên hợp lệ rồi ghép biến thể hoa/thường/khoảng trắng vào danh sách.
    fc.assert(
      fc.property(
        validCoreArb,
        fc.array(entryArb, { maxLength: 5 }),
        fc.constantFrom('lower', 'upper', 'pad'),
        (core, extras, mode) => {
          const name = core.trim();
          let dupName = name;
          if (mode === 'lower') dupName = name.toLowerCase();
          else if (mode === 'upper') dupName = name.toUpperCase();
          else dupName = `  ${name}  `;
          // Đặt bản trùng dưới dạng chuỗi (không có id) nên editingId không loại trừ nó.
          const existingNames = [...extras, dupName];
          const result = validateCategoryName(name, existingNames, null);
          expect(result.valid).toBe(false);
          expect(result.reason).toBe('duplicate');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('tên hợp lệ, không trùng bất kỳ phần tử nào → valid', () => {
    fc.assert(
      fc.property(validCoreArb, (core) => {
        const name = core.trim();
        const key = name.toLowerCase();
        // Danh sách chỉ chứa các tên khác hẳn (thêm hậu tố duy nhất).
        const existingNames = ['aaa', 'bbb', 'ccc'].map((s) => `${s}-${key}-zzz`);
        const result = validateCategoryName(name, existingNames, null);
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
        expect(result.name).toBe(name);
      }),
      { numRuns: 200 },
    );
  });

  it('editingId: sửa danh mục giữ nguyên tên của chính nó vẫn hợp lệ (không tính là trùng chính mình)', () => {
    fc.assert(
      fc.property(
        validCoreArb,
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.array(entryArb, { maxLength: 4 }),
        (core, rawId, extras) => {
          const name = core.trim();
          const editId = normalizeGroupCategoryId(rawId);
          // Bỏ qua id rỗng sau chuẩn hoá (không xác định được danh mục đang sửa).
          fc.pre(editId.length > 0);

          // Danh mục đang sửa mang chính tên đó; các entry khác không được trùng tên.
          const self = { id: editId, name };
          const key = name.toLowerCase();
          const safeExtras = extras
            .map((entry) => {
              if (entry && typeof entry === 'object') {
                // Đảm bảo id khác editId và name khác key để không gây trùng.
                return { id: `${normalizeGroupCategoryId(entry.id)}-other`, name: `${entry.name}-x-${key}-q` };
              }
              return `${entry}-x-${key}-q`;
            });
          const existingNames = [self, ...safeExtras];

          const result = validateCategoryName(name, existingNames, editId);
          expect(result.valid).toBe(true);
          expect(result.reason).toBeUndefined();
        },
      ),
      { numRuns: 200 },
    );
  });
});
