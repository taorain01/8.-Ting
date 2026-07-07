// ============================================================================
// Property-based test cho computeEditRequestBadge (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 16: Chỉ báo số Edit_Request trên thẻ account
//   Với mọi số lượng Edit_Request đang chờ `count`, computeEditRequestBadge(count)
//   trả về { visible, count } trong đó count được chuẩn hoá bằng toNonNegativeInt
//   (số âm/không hợp lệ -> 0, số thực -> floor). Chỉ báo hiển thị (visible = true)
//   với đúng số đã chuẩn hoá khi count_chuẩn_hoá >= 1, và ẩn (visible = false)
//   khi count_chuẩn_hoá === 0.
//
// Validates: Requirements 10.9, 10.10
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

// --- Nạp js/groups.js trong vm sandbox --------------------------------------
// Các hàm thuần được khai báo top-level trong groups.js. Cuối file có khối
// `window.xxx = ...` chạy lúc load, nên sandbox PHẢI có `window`. Ngoài ra cung
// cấp các global cơ bản và stub các tham chiếu hạ tầng (auth, db, firebase...)
// là undefined — các hàm thuần không dùng tới chúng nên không bị gọi khi test.

const GROUPS_PATH = path.join(__dirname, '..', '..', 'js', 'groups.js');
const GROUPS_SRC = fs.readFileSync(GROUPS_PATH, 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingGroupExports = { computeEditRequestBadge };
`;

function loadGroups() {
  const sandbox = {
    window: {},
    document: undefined,
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
    encodeURIComponent,
    decodeURIComponent,
    setTimeout,
    clearTimeout,
    // Stub các tham chiếu hạ tầng (không được các hàm thuần gọi tới lúc test).
    auth: undefined,
    db: undefined,
    firebase: undefined,
    firestore: undefined,
  };
  sandbox.window = sandbox.window || {};
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(GROUPS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'groups.js' });
  return sandbox.__tingGroupExports;
}

const { computeEditRequestBadge } = loadGroups();

// --- Oracle độc lập: bản sao chuẩn hoá về số nguyên không âm -----------------
// Khớp hợp đồng toNonNegativeInt trong groups.js: Number(value); nếu không hữu
// hạn hoặc < 0 -> 0; ngược lại Math.floor(n).
function refToNonNegativeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

// --- Generators -------------------------------------------------------------

// Số nguyên >= 1 (chỉ báo phải hiển thị đúng số).
const positiveIntArb = fc.integer({ min: 1, max: 100000 });

// Số nguyên âm (chuẩn hoá về 0 -> ẩn).
const negativeIntArb = fc.integer({ min: -100000, max: -1 });

// Số thực dương (floor); tách nhánh >= 1 và trong (0,1) để phủ cả visible/ẩn.
const positiveFloatArb = fc.float({ min: Math.fround(0.0001), max: 100000, noNaN: true });

// Giá trị không hợp lệ hoặc không phải số -> chuẩn hoá về 0.
const invalidArb = fc.oneof(
  fc.constant(NaN),
  fc.constant(Infinity),
  fc.constant(-Infinity),
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(''),
  fc.constant('abc'),
  fc.constant('12abc'),
  fc.constant({}),
  fc.constant([1, 2]),
  fc.string(),
);

// Chuỗi số hợp lệ (Number() chuyển được), gồm cả số thực dạng chuỗi.
const numericStringArb = fc.oneof(
  fc.integer({ min: 0, max: 100000 }).map((n) => String(n)),
  fc.float({ min: 0, max: 100000, noNaN: true }).map((n) => String(n)),
);

// Tập đầu vào tổng hợp, đa dạng theo yêu cầu.
const countArb = fc.oneof(
  positiveIntArb,
  negativeIntArb,
  fc.constant(0),
  positiveFloatArb,
  invalidArb,
  numericStringArb,
);

// --- Properties -------------------------------------------------------------

describe('Property 16 — computeEditRequestBadge chỉ báo số Edit_Request (Requirements 10.9, 10.10)', () => {
  // Bất biến tổng quát: count trả về luôn bằng chuẩn hoá, và visible === (count >= 1).
  it('trả về count đã chuẩn hoá không âm và visible === (count_chuẩn_hoá >= 1)', () => {
    fc.assert(
      fc.property(countArb, (raw) => {
        const expected = refToNonNegativeInt(raw);
        const badge = computeEditRequestBadge(raw);

        expect(badge.count).toBe(expected);
        expect(Number.isInteger(badge.count)).toBe(true);
        expect(badge.count).toBeGreaterThanOrEqual(0);
        expect(badge.visible).toBe(expected >= 1);
      }),
      { numRuns: 300 },
    );
  });

  // count >= 1 (số nguyên) -> hiển thị đúng số.
  it('count nguyên >= 1: visible = true và count giữ nguyên đúng số', () => {
    fc.assert(
      fc.property(positiveIntArb, (n) => {
        const badge = computeEditRequestBadge(n);
        expect(badge.visible).toBe(true);
        expect(badge.count).toBe(n);
      }),
      { numRuns: 200 },
    );
  });

  // count === 0 -> ẩn chỉ báo.
  it('count === 0: visible = false và count = 0', () => {
    const badge = computeEditRequestBadge(0);
    expect(badge.visible).toBe(false);
    expect(badge.count).toBe(0);
  });

  // count âm hoặc không hợp lệ -> chuẩn hoá về 0, ẩn chỉ báo.
  it('count âm hoặc không hợp lệ: count = 0 và visible = false', () => {
    fc.assert(
      fc.property(fc.oneof(negativeIntArb, invalidArb), (raw) => {
        const badge = computeEditRequestBadge(raw);
        expect(badge.count).toBe(0);
        expect(badge.visible).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  // count thực -> floor; hiển thị khi phần nguyên >= 1, ẩn khi trong (0,1).
  it('count thực: floor về số nguyên, visible theo phần nguyên', () => {
    fc.assert(
      fc.property(positiveFloatArb, (f) => {
        const badge = computeEditRequestBadge(f);
        expect(badge.count).toBe(Math.floor(f));
        expect(badge.visible).toBe(Math.floor(f) >= 1);
      }),
      { numRuns: 200 },
    );
  });

  // Ví dụ cụ thể trong hợp đồng: 3.7 -> floor 3, visible = true.
  it('ví dụ: count = 3.7 -> count = 3, visible = true', () => {
    const badge = computeEditRequestBadge(3.7);
    expect(badge.count).toBe(3);
    expect(badge.visible).toBe(true);
  });
});
