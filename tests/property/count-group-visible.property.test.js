// ============================================================================
// Property-based test cho countGroupVisible (`js/utils.js`).
//
// Feature: expired-toggle-trash-grouping, Property 3: Số lượng nhóm theo trạng thái toggle
//   Với mọi nhóm nền tảng, countGroupVisible(accounts, showExpired) phải bằng:
//   số Tai_Khoan_Con_Han trong nhóm khi showExpired = false; và tổng số tài khoản
//   của nhóm (còn hạn cộng hết hạn) khi showExpired = true. Số lượng hiển thị của
//   nhóm luôn bằng đúng giá trị này.
//
// Validates: Requirements 1.2, 3.8, 3.11
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

// --- Nạp js/utils.js trong vm sandbox (các hàm là global trong utils.js) -----

const UTILS_PATH = path.join(__dirname, '..', '..', 'js', 'utils.js');
const UTILS_SRC = fs.readFileSync(UTILS_PATH, 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingUtilsExports = {
  countGroupVisible,
  isExpiredAccount,
  getStatusFromExpiry,
};
`;

function loadUtils() {
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
    encodeURIComponent,
    decodeURIComponent,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UTILS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'utils.js' });
  return sandbox.__tingUtilsExports;
}

const { countGroupVisible } = loadUtils();

// --- Tiện ích tạo ngày theo độ lệch (offset) so với hôm nay -----------------
//
// Dựng chuỗi YYYY-MM-DD từ hôm nay + offsetDays theo giờ địa phương, khớp với
// cách daysUntil() trong utils.js diễn giải ngày. Nhờ đó số ngày còn lại đúng
// bằng offsetDays.
function dateFromOffset(offsetDays) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Oracle độc lập với cài đặt: một tài khoản là HẾT HẠN khi expiryType !== 'lifetime'
// và số ngày còn lại (__offsetDays đã dùng để dựng expiryDate) < 0.
// Tài khoản 'lifetime' luôn còn hạn. expiring (offset trong [0..5]) KHÔNG hết hạn.
function refIsExpired(acc) {
  if (!acc) return false;
  if (acc.expiryType === 'lifetime') return false;
  return acc.__offsetDays < 0;
}

// --- Generators -------------------------------------------------------------

// Offset ngày bao phủ đủ 4 tình huống, tránh biên ±1 ngày dễ nhiễu do timezone:
//  - quá hạn:            offset ∈ [-400, -2]  => hết hạn
//  - hôm nay:            offset = 0           => còn hạn (expiring)
//  - sắp hết (≤5 ngày):  offset ∈ [1, 5]      => còn hạn (expiring)
//  - còn hạn dài:        offset ∈ [6, 400]    => còn hạn (active)
const offsetArb = fc.oneof(
  fc.integer({ min: -400, max: -2 }),
  fc.constant(0),
  fc.integer({ min: 1, max: 5 }),
  fc.integer({ min: 6, max: 400 }),
);

// Nền tảng đa dạng, gồm cả 'other'.
const platformArb = fc.constantFrom(
  'netflix', 'spotify', 'youtube', 'chatgpt', 'canva', 'other',
);

// Một tài khoản: loại fixed (theo offset) hoặc lifetime (luôn còn hạn).
const accountArb = fc.oneof(
  fc.record({
    id: fc.uuid(),
    platform: platformArb,
    expiryType: fc.constant('fixed'),
    __offsetDays: offsetArb,
  }).map((a) => ({ ...a, expiryDate: dateFromOffset(a.__offsetDays) })),
  fc.record({
    id: fc.uuid(),
    platform: platformArb,
    expiryType: fc.constant('lifetime'),
  }).map((a) => ({ ...a, __offsetDays: 999999, expiryDate: null })),
);

// Một "nhóm nền tảng" là mảng tài khoản (bao gồm cả nhóm rỗng).
const groupArb = fc.array(accountArb, { maxLength: 25 });

// --- Property ---------------------------------------------------------------

describe('Property 3 — countGroupVisible đếm đúng theo trạng thái toggle (Requirements 1.2, 3.8, 3.11)', () => {
  it('TẮT: đếm chỉ tài khoản còn hạn; BẬT: đếm tổng cả nhóm', () => {
    fc.assert(
      fc.property(groupArb, (accounts) => {
        const expectedActive = accounts.filter((acc) => !refIsExpired(acc)).length;

        // showExpired = false => chỉ đếm tài khoản còn hạn (Requirement 1.2, 3.8).
        expect(countGroupVisible(accounts, false)).toBe(expectedActive);

        // showExpired = true => đếm tổng số tài khoản của nhóm (Requirement 3.11).
        expect(countGroupVisible(accounts, true)).toBe(accounts.length);
      }),
      { numRuns: 200 },
    );
  });
});
