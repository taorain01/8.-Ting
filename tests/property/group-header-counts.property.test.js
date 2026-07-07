// ============================================================================
// Property-based test cho computeGroupHeaderCounts (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 17: Số đếm header luôn là số nguyên không âm
//   Với mọi group (kể cả null/undefined/rỗng/dữ liệu bẩn),
//   computeGroupHeaderCounts(group) trả về { memberCount, sharedAccountCount }
//   trong đó cả hai luôn là số nguyên (Number.isInteger) và >= 0, dùng 0 làm
//   mặc định khi không lấy được giá trị hợp lệ.
//   - memberCount = group.memberEmails.length nếu memberEmails là mảng, ngược
//     lại = toNonNegativeInt(group.memberCount).
//   - sharedAccountCount = toNonNegativeInt(group.sharedAccountCount); nếu
//     sharedAccountCount == null và group.sharedAccounts là mảng thì dùng
//     group.sharedAccounts.length (rồi vẫn chuẩn hoá qua toNonNegativeInt).
//   - toNonNegativeInt: số âm/không hợp lệ -> 0, số thực -> floor.
//
// Validates: Requirements 11.1, 11.2
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
;globalThis.__tingGroupExports = { computeGroupHeaderCounts };
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

const { computeGroupHeaderCounts } = loadGroups();

// --- Oracle độc lập: bản sao chuẩn hoá về số nguyên không âm -----------------
// Khớp hợp đồng toNonNegativeInt trong groups.js: Number(value); nếu không hữu
// hạn hoặc < 0 -> 0; ngược lại Math.floor(n).
function refToNonNegativeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

// Oracle độc lập cho toàn bộ hợp đồng computeGroupHeaderCounts.
function refCounts(group) {
  const g = group || {};
  const memberCount = Array.isArray(g.memberEmails)
    ? g.memberEmails.length
    : refToNonNegativeInt(g.memberCount);
  let sharedRaw = g.sharedAccountCount;
  if (sharedRaw == null && Array.isArray(g.sharedAccounts)) sharedRaw = g.sharedAccounts.length;
  const sharedAccountCount = refToNonNegativeInt(sharedRaw);
  return { memberCount, sharedAccountCount };
}

// --- Generators -------------------------------------------------------------

// Giá trị "số hoặc bẩn" cho các field đếm (memberCount, sharedAccountCount).
const dirtyNumberArb = fc.oneof(
  fc.integer({ min: 0, max: 100000 }),          // số nguyên hợp lệ
  fc.integer({ min: -100000, max: -1 }),        // số âm -> 0
  fc.float({ min: 0, max: 100000, noNaN: true }), // số thực -> floor
  fc.constant(NaN),
  fc.constant(Infinity),
  fc.constant(-Infinity),
  fc.constant(''),
  fc.constant('abc'),
  fc.constant('12abc'),
  fc.constant({}),
  fc.constant([1, 2]),
  fc.string(),
  fc.integer({ min: 0, max: 100000 }).map((n) => String(n)), // chuỗi số hợp lệ
);

// Mảng độ dài ngẫu nhiên (nội dung không quan trọng, chỉ dùng .length).
const emailArrayArb = fc.array(fc.string(), { minLength: 0, maxLength: 50 });
const sharedArrayArb = fc.array(fc.anything(), { minLength: 0, maxLength: 50 });

// Sinh group đa dạng: có/không memberEmails, memberCount số/bẩn,
// sharedAccountCount số/null/bẩn, sharedAccounts mảng.
const groupArb = fc.record(
  {
    memberEmails: fc.option(emailArrayArb, { nil: undefined }),
    memberCount: fc.option(dirtyNumberArb, { nil: undefined }),
    sharedAccountCount: fc.option(dirtyNumberArb, { nil: undefined }),
    sharedAccounts: fc.option(sharedArrayArb, { nil: undefined }),
  },
  { requiredKeys: [] },
);

// Tập đầu vào tổng hợp: gồm cả group null/undefined/{} và group đa dạng.
const inputArb = fc.oneof(
  groupArb,
  fc.constant(null),
  fc.constant(undefined),
  fc.constant({}),
);

// --- Properties -------------------------------------------------------------

describe('Property 17 — computeGroupHeaderCounts số đếm header luôn là số nguyên không âm (Requirements 11.1, 11.2)', () => {
  // Bất biến tổng quát: cả hai số đếm luôn là số nguyên không âm và khớp oracle.
  it('memberCount và sharedAccountCount luôn là số nguyên >= 0 và khớp hợp đồng', () => {
    fc.assert(
      fc.property(inputArb, (group) => {
        const result = computeGroupHeaderCounts(group);
        const expected = refCounts(group);

        expect(Number.isInteger(result.memberCount)).toBe(true);
        expect(result.memberCount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(result.sharedAccountCount)).toBe(true);
        expect(result.sharedAccountCount).toBeGreaterThanOrEqual(0);

        expect(result.memberCount).toBe(expected.memberCount);
        expect(result.sharedAccountCount).toBe(expected.sharedAccountCount);
      }),
      { numRuns: 300 },
    );
  });

  // memberEmails là mảng -> memberCount === memberEmails.length.
  it('khi memberEmails là mảng: memberCount === memberEmails.length', () => {
    fc.assert(
      fc.property(emailArrayArb, dirtyNumberArb, (emails, noiseCount) => {
        // memberCount (field số/bẩn) phải bị bỏ qua khi có mảng memberEmails.
        const result = computeGroupHeaderCounts({ memberEmails: emails, memberCount: noiseCount });
        expect(result.memberCount).toBe(emails.length);
      }),
      { numRuns: 200 },
    );
  });

  // Thiếu memberEmails nhưng có memberCount -> floor/không âm theo toNonNegativeInt.
  it('khi thiếu memberEmails: memberCount = toNonNegativeInt(memberCount)', () => {
    fc.assert(
      fc.property(dirtyNumberArb, (raw) => {
        const result = computeGroupHeaderCounts({ memberCount: raw });
        expect(result.memberCount).toBe(refToNonNegativeInt(raw));
      }),
      { numRuns: 200 },
    );
  });

  // group null/undefined/rỗng -> cả hai = 0.
  it('group null/undefined/rỗng: cả hai số đếm = 0', () => {
    for (const g of [null, undefined, {}]) {
      const result = computeGroupHeaderCounts(g);
      expect(result.memberCount).toBe(0);
      expect(result.sharedAccountCount).toBe(0);
    }
  });

  // sharedAccountCount ưu tiên field số; fallback sharedAccounts.length khi null.
  it('sharedAccountCount ưu tiên field số hợp lệ hơn sharedAccounts.length', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), sharedArrayArb, (count, arr) => {
        const result = computeGroupHeaderCounts({ sharedAccountCount: count, sharedAccounts: arr });
        expect(result.sharedAccountCount).toBe(count);
      }),
      { numRuns: 200 },
    );
  });

  // sharedAccountCount == null (null/undefined) và có sharedAccounts mảng -> dùng length.
  it('khi sharedAccountCount null và có sharedAccounts mảng: dùng sharedAccounts.length', () => {
    fc.assert(
      fc.property(sharedArrayArb, fc.constantFrom(null, undefined), (arr, nilVal) => {
        const result = computeGroupHeaderCounts({ sharedAccountCount: nilVal, sharedAccounts: arr });
        expect(result.sharedAccountCount).toBe(arr.length);
      }),
      { numRuns: 200 },
    );
  });

  // Dữ liệu bẩn (NaN, chuỗi, âm) ở cả hai field -> chuẩn hoá về 0.
  it('dữ liệu bẩn (NaN/chuỗi/âm) cho các field số -> 0', () => {
    const dirtyArb = fc.oneof(
      fc.constant(NaN),
      fc.constant('abc'),
      fc.integer({ min: -100000, max: -1 }),
      fc.constant(Infinity),
      fc.constant(-Infinity),
    );
    fc.assert(
      fc.property(dirtyArb, dirtyArb, (mCount, sCount) => {
        // Không có memberEmails/sharedAccounts để buộc dùng nhánh field số.
        const result = computeGroupHeaderCounts({ memberCount: mCount, sharedAccountCount: sCount });
        expect(result.memberCount).toBe(0);
        expect(result.sharedAccountCount).toBe(0);
      }),
      { numRuns: 200 },
    );
  });

  // Ví dụ cụ thể trong hợp đồng: số thực -> floor.
  it('ví dụ: memberCount = 4.9 (không có memberEmails) -> 4', () => {
    const result = computeGroupHeaderCounts({ memberCount: 4.9 });
    expect(result.memberCount).toBe(4);
  });
});
