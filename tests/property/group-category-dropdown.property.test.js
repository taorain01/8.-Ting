// ============================================================================
// Property-based test cho buildCategoryDropdownOptions và isCategoryReassignNeeded
// (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 3: Danh sách lựa chọn của Category_Dropdown
//   Với mọi danh sách categories và currentId, buildCategoryDropdownOptions luôn
//   chứa lựa chọn "Chưa phân loại" (id = null) và đúng mọi Account_Category trong
//   categories (số lượng = categories.length + 1), và đánh dấu active cho ĐÚNG MỘT
//   lựa chọn — lựa chọn có id khớp currentId (coi null/''/id lạ là "Chưa phân loại").
//
// Feature: group-tab-redesign, Property 4: Chỉ gán lại danh mục khi thực sự đổi
//   Với mọi cặp currentId và selectedId, isCategoryReassignNeeded trả về true KHI
//   VÀ CHỈ KHI hai giá trị khác nhau sau khi chuẩn hoá null/'' về cùng dạng
//   "Chưa phân loại" (chuẩn hoá qua normalizeGroupCategoryId về slug).
//
// Validates: Requirements 5.3, 5.5
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

// --- Nạp js/groups.js trong vm sandbox --------------------------------------
// Bám mẫu tests/property/count-group-visible.property.test.js và
// tests/property/group-normalize-tab.property.test.js. Các hàm thuần được khai
// báo top-level trong groups.js; sandbox PHẢI có `window: {}` (thân một số hàm
// tham chiếu window). Cung cấp các global cơ bản và stub các tham chiếu ngoài
// (auth, db, firebase...) — hàm thuần không dùng tới nên không bị gọi khi test.

const GROUPS_PATH = path.join(__dirname, '..', '..', 'js', 'groups.js');
const GROUPS_SRC = fs.readFileSync(GROUPS_PATH, 'utf8');

// Xuất các hàm thuần cần kiểm thử; kèm normalizeGroupCategoryId để dựng oracle
// chuẩn hoá id độc lập.
const EXPORT_SNIPPET = `
;globalThis.__tingGroupExports = {
  buildCategoryDropdownOptions,
  isCategoryReassignNeeded,
  normalizeGroupCategoryId,
};
`;

function loadGroups() {
  const sandbox = {
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
    // Khối trong groups.js gán/đọc window ⇒ cần window rỗng để không lỗi.
    window: {},
    // Stub các global lạ mà groups.js tham chiếu (chỉ trong thân hàm).
    auth: undefined,
    db: undefined,
    firebase: undefined,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(GROUPS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'groups.js' });
  return sandbox.__tingGroupExports;
}

const {
  buildCategoryDropdownOptions,
  isCategoryReassignNeeded,
  normalizeGroupCategoryId,
} = loadGroups();

// --- Generators -------------------------------------------------------------

// Pool giá trị id đa dạng dùng chung cho category.id và cho currentId/selectedId
// để tạo va chạm (collision) tự nhiên giữa currentId và id của một danh mục.
// Gồm: slug thường, tên có dấu tiếng Việt (để kiểm chuẩn hoá NFD + đ→d), chuỗi
// rác, chuỗi rỗng/khoảng trắng, và uuid.
const idValueArb = fc.oneof(
  fc.constantFrom(
    'netflix', 'work-1', 'giai-tri', 'other', 'nhom_a',
    'Học tập', 'Đã dùng', 'GIẢI TRÍ', 'Công việc',
    '', '   ', '!!!', 'a b c',
  ),
  fc.uuid(),
  fc.string({ maxLength: 12 }),
);

// Một Account_Category tối thiểu (id + name). name có thể rỗng/rác.
const categoryArb = fc.record({
  id: idValueArb,
  name: fc.oneof(fc.string({ maxLength: 20 }), fc.constant('')),
});

// Danh sách danh mục, gồm cả rỗng và có khả năng trùng id sau chuẩn hoá.
const categoriesArb = fc.array(categoryArb, { maxLength: 8 });

// currentId có thể là null/undefined/'' (⇒ "Chưa phân loại") hoặc một giá trị id.
const currentIdArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  idValueArb,
);

// --- Oracle độc lập cho Property 3 ------------------------------------------
// Trả về chỉ số danh mục được đánh dấu active (theo danh mục ĐẦU TIÊN khớp), hoặc
// -1 nếu "Chưa phân loại" là mục active (currentId rỗng hoặc không khớp danh mục).
function expectedActiveIndex(categories, currentId) {
  const current = normalizeGroupCategoryId(currentId);
  if (!current) return -1;
  return categories.findIndex(cat => normalizeGroupCategoryId(cat && cat.id) === current);
}

// --- Property 3 -------------------------------------------------------------

describe('Property 3 — buildCategoryDropdownOptions dựng danh sách lựa chọn (Requirements 5.3)', () => {
  it('luôn có "Chưa phân loại", đúng độ dài, và ĐÚNG MỘT lựa chọn active khớp currentId', () => {
    fc.assert(
      fc.property(categoriesArb, currentIdArb, (categories, currentId) => {
        const options = buildCategoryDropdownOptions(categories, currentId);

        // (1) Độ dài = số danh mục + 1 (thêm "Chưa phân loại").
        expect(options.length).toBe(categories.length + 1);

        // (2) Lựa chọn "Chưa phân loại" (id = null) LUÔN tồn tại và ở cuối danh sách.
        const last = options[options.length - 1];
        expect(last.id).toBeNull();
        expect(last.name).toBe('Chưa phân loại');

        // (3) ĐÚNG MỘT lựa chọn được đánh dấu active.
        const activeCount = options.filter(opt => opt.active).length;
        expect(activeCount).toBe(1);

        // (4) Vị trí active khớp oracle: danh mục đầu tiên khớp currentId, hoặc
        //     "Chưa phân loại" (phần tử cuối) khi rỗng/không khớp.
        const idx = expectedActiveIndex(categories, currentId);
        if (idx === -1) {
          expect(last.active).toBe(true);
        } else {
          expect(options[idx].active).toBe(true);
          expect(last.active).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// --- Property 4 -------------------------------------------------------------

// Cặp id để kiểm: dùng chung pool + null/undefined để trộn null/'' lẫn nhau.
const idOrNullArb = fc.oneof(fc.constant(null), fc.constant(undefined), idValueArb);

describe('Property 4 — isCategoryReassignNeeded chỉ true khi thực sự đổi (Requirements 5.5)', () => {
  it('true KHI VÀ CHỈ KHI hai id khác nhau sau khi chuẩn hoá', () => {
    fc.assert(
      fc.property(idOrNullArb, idOrNullArb, (currentId, selectedId) => {
        const result = isCategoryReassignNeeded(currentId, selectedId);
        const expected =
          normalizeGroupCategoryId(currentId) !== normalizeGroupCategoryId(selectedId);
        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('phản xạ (cùng giá trị ⇒ false) và đối xứng (không phụ thuộc thứ tự)', () => {
    fc.assert(
      fc.property(idOrNullArb, idOrNullArb, (a, b) => {
        // Cùng một giá trị ⇒ không cần gán lại.
        expect(isCategoryReassignNeeded(a, a)).toBe(false);
        // Đối xứng: đổi thứ tự tham số không đổi kết quả.
        expect(isCategoryReassignNeeded(a, b)).toBe(isCategoryReassignNeeded(b, a));
      }),
      { numRuns: 200 },
    );
  });

  it('coi null/undefined/rỗng là cùng "Chưa phân loại" ⇒ không cần gán lại', () => {
    // Các biến thể "rỗng" đều chuẩn hoá về '' nên không cần gán lại lẫn nhau.
    const blanks = [null, undefined, '', '   '];
    for (const a of blanks) {
      for (const b of blanks) {
        expect(isCategoryReassignNeeded(a, b)).toBe(false);
      }
    }
  });
});
