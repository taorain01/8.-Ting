// ============================================================================
// Property-based test cho normalizeGroupTab (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 2: Chuẩn hoá Active_Subtab
//   Với mọi giá trị tab đầu vào (kể cả rỗng, undefined, hoặc chuỗi bất kỳ) và
//   tập tab khả dụng availableTabs, normalizeGroupTab(tab, availableTabs) luôn
//   trả về một tab nằm trong availableTabs (sau khi đã lọc theo VALID_GROUP_TABS;
//   nếu availableTabs rỗng thì coi như cả 3 tab). Nếu tab hợp lệ và khả dụng thì
//   trả về đúng tab; ngược lại trả về 'board' (hoặc phần tử fallback available[0]
//   nếu 'board' không khả dụng).
//
// Validates: Requirements 3.4, 3.6
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

// --- Nạp js/groups.js trong vm sandbox --------------------------------------
// Bám mẫu tests/property/count-group-visible.property.test.js. Cuối groups.js có
// khối `window.xxx = ...` nên sandbox BẮT BUỘC có `window: {}`.

const GROUPS_PATH = path.join(__dirname, '..', '..', 'js', 'groups.js');
const GROUPS_SRC = fs.readFileSync(GROUPS_PATH, 'utf8');

// Xuất hàm thuần cần kiểm thử cùng danh sách tab hợp lệ để đối chiếu độc lập.
const EXPORT_SNIPPET = `
;globalThis.__tingGroupExports = { normalizeGroupTab, VALID_GROUP_TABS };
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
    // Khối cuối file gán các hàm lên window ⇒ cần window rỗng để không lỗi.
    window: {},
    // Stub các global lạ mà groups.js tham chiếu (chỉ trong thân hàm, nhưng
    // khai báo sẵn cho an toàn nếu có tham chiếu top-level bất ngờ).
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

const { normalizeGroupTab, VALID_GROUP_TABS } = loadGroups();

// --- Oracle độc lập ---------------------------------------------------------
// Tính tập tab khả dụng đã lọc: chỉ giữ tab hợp lệ; nếu rỗng thì dùng cả 3 tab.
function computeAvailable(availableTabs) {
  const filtered = (Array.isArray(availableTabs) ? availableTabs : [])
    .filter(item => VALID_GROUP_TABS.includes(item));
  return filtered.length ? filtered : VALID_GROUP_TABS.slice();
}

// --- Generators -------------------------------------------------------------

// Giá trị tab đầu vào đa dạng: rỗng, undefined, null, chuỗi rác, tab hợp lệ,
// và cả kiểu không phải chuỗi để chắc chắn hàm luôn chịu được input bẩn.
const tabInputArb = fc.oneof(
  fc.constantFrom('board', 'accounts', 'members'),
  fc.constant(''),
  fc.constant(undefined),
  fc.constant(null),
  fc.string(),
  fc.constantFrom('settings', 'BOARD', 'Members', 'invalid-tab'),
  fc.integer(),
  fc.boolean(),
);

// availableTabs là tập con bất kỳ của 3 tab hợp lệ, có thể chèn thêm giá trị rác
// và thứ tự ngẫu nhiên (bao gồm cả mảng rỗng và không-phải-mảng).
const availableTabsArb = fc.oneof(
  fc.array(
    fc.oneof(
      fc.constantFrom('board', 'accounts', 'members'),
      fc.constantFrom('settings', 'trash', 'xxx'),
      fc.string(),
    ),
    { maxLength: 6 },
  ),
  fc.constant([]),
  fc.constant(undefined),
  fc.constant(null),
);

// --- Property ---------------------------------------------------------------

describe('Property 2 — normalizeGroupTab chuẩn hoá Active_Subtab (Requirements 3.4, 3.6)', () => {
  it('luôn trả về tab nằm trong tập khả dụng; giữ nguyên khi hợp lệ + khả dụng, ngược lại fallback', () => {
    fc.assert(
      fc.property(tabInputArb, availableTabsArb, (tab, availableTabs) => {
        const result = normalizeGroupTab(tab, availableTabs);
        const available = computeAvailable(availableTabs);
        const expectedFallback = available.includes('board') ? 'board' : available[0];

        // (1) Kết quả LUÔN nằm trong tập tab khả dụng đã lọc.
        expect(available).toContain(result);

        // (2) Nếu tab hợp lệ và khả dụng ⇒ trả về đúng tab đó (Req 3.4).
        const tabIsValidAvailable =
          typeof tab === 'string' &&
          VALID_GROUP_TABS.includes(tab) &&
          available.includes(tab);

        if (tabIsValidAvailable) {
          expect(result).toBe(tab);
        } else {
          // (3) Ngược lại ⇒ trả về fallback: 'board' nếu khả dụng, nếu không
          //     thì phần tử đầu của tập khả dụng (Req 3.6).
          expect(result).toBe(expectedFallback);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('khi availableTabs rỗng/không hợp lệ, coi như cả 3 tab và mặc định là board', () => {
    fc.assert(
      fc.property(tabInputArb, (tab) => {
        // availableTabs rỗng ⇒ tập khả dụng là cả 3 tab; fallback là 'board'.
        const result = normalizeGroupTab(tab, []);
        expect(VALID_GROUP_TABS).toContain(result);

        const tabIsValid = typeof tab === 'string' && VALID_GROUP_TABS.includes(tab);
        expect(result).toBe(tabIsValid ? tab : 'board');
      }),
      { numRuns: 100 },
    );
  });
});
