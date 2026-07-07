// ============================================================================
// Property-based test cho isExpiredAccount (js/utils.js).
//
// Feature: expired-toggle-trash-grouping, Property 8: Làm mờ đúng các tài khoản hết hạn khi BẬT
//   Với mọi danh sách tài khoản hiển thị khi Trang_Thai_Hien_Het_Han BẬT, một thẻ
//   nhận hiệu ứng Do_Mo_Giam (class `is-expired-dimmed`) khi và chỉ khi tài khoản
//   của nó là Tai_Khoan_Het_Han (isExpiredAccount trả về true); mọi Tai_Khoan_Con_Han
//   không bị làm mờ. Test này kiểm chứng hàm quyết định `isExpiredAccount` — nguồn
//   phân loại để gắn class làm mờ — trả về true KHI VÀ CHỈ KHI getStatusFromExpiry
//   trả về 'expired', và lifetime luôn trả về false.
//
// Validates: Requirements 3.4
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
//
// utils.js không dùng module.exports (các hàm là global), nên ta nạp mã nguồn
// vào một vm sandbox rồi lấy ra các hàm cần kiểm thử — theo đúng pattern của các
// test property khác trong tests/property/.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

const UTILS_PATH = path.join(__dirname, '..', '..', 'js', 'utils.js');
const UTILS_SRC = fs.readFileSync(UTILS_PATH, 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingUtilsExports = {
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

const { isExpiredAccount, getStatusFromExpiry } = loadUtils();

// --- Generators -------------------------------------------------------------

// Sinh chuỗi ngày YYYY-MM-DD lệch `offsetDays` ngày so với hôm nay (giờ địa phương),
// khớp cách daysUntil() trong utils.js diễn giải ngày => số ngày còn lại = offsetDays.
function dateStringWithOffset(offsetDays) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const platformArb = fc.constantFrom('spotify', 'netflix', 'youtube', 'chatgpt', 'other', '');

// Tài khoản FIXED có expiryDate suy ra từ offset (giữ __offsetDays để oracle dùng).
// Offset bao phủ: quá hạn, hôm nay, sắp hết (≤5 ngày), còn hạn dài.
// Tránh biên -1 dễ nhiễu do timezone khi phân loại chính xác.
const fixedOffsetArb = fc.oneof(
  fc.integer({ min: -400, max: -2 }), // quá hạn => expired
  fc.constant(0),                     // hôm nay => expiring (còn hạn)
  fc.integer({ min: 1, max: 5 }),     // sắp hết ≤5 ngày => expiring (còn hạn)
  fc.integer({ min: 6, max: 400 }),   // còn hạn dài => active
);

const fixedAccountArb = fc.record({
  id: fc.uuid(),
  expiryType: fc.constant('fixed'),
  platform: platformArb,
  __offsetDays: fixedOffsetArb,
}).map((a) => ({ ...a, expiryDate: dateStringWithOffset(a.__offsetDays) }));

// Tài khoản LIFETIME: luôn còn hạn dù có expiryDate quá khứ/tương lai hay null.
const lifetimeAccountArb = fc.record({
  id: fc.uuid(),
  expiryType: fc.constant('lifetime'),
  platform: platformArb,
  expiryDate: fc.oneof(
    fc.constant(null),
    fc.integer({ min: -400, max: 400 }).map(dateStringWithOffset),
  ),
});

const anyAccountArb = fc.oneof(fixedAccountArb, lifetimeAccountArb);

// --- Properties -------------------------------------------------------------

describe('Property 8 — isExpiredAccount là nguồn phân loại làm mờ đúng (Requirements 3.4)', () => {
  it('(a) isExpiredAccount(acc) === (getStatusFromExpiry(...) === "expired") với mọi tài khoản', () => {
    fc.assert(
      fc.property(anyAccountArb, (acc) => {
        const expected = getStatusFromExpiry(acc.expiryDate, acc.expiryType) === 'expired';
        expect(isExpiredAccount(acc)).toBe(expected);
      }),
      { numRuns: 300 },
    );
  });

  it('(b) tài khoản lifetime luôn trả về false, bất kể expiryDate', () => {
    fc.assert(
      fc.property(lifetimeAccountArb, (acc) => {
        expect(isExpiredAccount(acc)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it('(c) tài khoản expiring (còn ≤5 ngày) và active đều trả về false', () => {
    // Fixed còn hạn: offset >= 0 (0..5 => expiring, >5 => active) => không hết hạn.
    const activeOrExpiringFixedArb = fc.record({
      id: fc.uuid(),
      expiryType: fc.constant('fixed'),
      platform: platformArb,
      __offsetDays: fc.integer({ min: 0, max: 400 }),
    }).map((a) => ({ ...a, expiryDate: dateStringWithOffset(a.__offsetDays) }));

    fc.assert(
      fc.property(activeOrExpiringFixedArb, (acc) => {
        // Chỉ nhận 'active' hoặc 'expiring', không bao giờ 'expired'.
        expect(getStatusFromExpiry(acc.expiryDate, acc.expiryType)).not.toBe('expired');
        expect(isExpiredAccount(acc)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it('(d) tài khoản fixed quá hạn (offset < 0) luôn trả về true', () => {
    const expiredFixedArb = fc.record({
      id: fc.uuid(),
      expiryType: fc.constant('fixed'),
      platform: platformArb,
      __offsetDays: fc.integer({ min: -400, max: -2 }),
    }).map((a) => ({ ...a, expiryDate: dateStringWithOffset(a.__offsetDays) }));

    fc.assert(
      fc.property(expiredFixedArb, (acc) => {
        expect(getStatusFromExpiry(acc.expiryDate, acc.expiryType)).toBe('expired');
        expect(isExpiredAccount(acc)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
