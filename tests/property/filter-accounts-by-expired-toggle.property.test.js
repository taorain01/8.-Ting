// ============================================================================
// Property-based test cho filterAccountsByExpiredToggle (js/utils.js).
//
// Feature: expired-toggle-trash-grouping, Property 5: Lọc theo trạng thái hiển thị hết hạn
// Với mọi danh sách tài khoản lẫn lộn còn hạn và hết hạn,
// filterAccountsByExpiredToggle(accounts, showExpired) phải:
//   - loại bỏ toàn bộ Tai_Khoan_Het_Han và giữ đủ mọi Tai_Khoan_Con_Han khi
//     showExpired = false;
//   - giữ nguyên toàn bộ tài khoản (không mất phần tử) khi showExpired = true.
//
// Validates: Requirements 3.1, 3.2
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
//
// utils.js không dùng module.exports (các hàm là global), nên ta nạp mã nguồn
// vào một vm sandbox rồi lấy ra các hàm cần kiểm thử — theo đúng pattern của
// tests/unit/account-priority-sort.test.js.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

const UTILS_PATH = path.join(__dirname, '..', '..', 'js', 'utils.js');
const UTILS_SRC = fs.readFileSync(UTILS_PATH, 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingUtilsExports = {
  filterAccountsByExpiredToggle,
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

const { filterAccountsByExpiredToggle, isExpiredAccount, getStatusFromExpiry } = loadUtils();

// --- Generators -------------------------------------------------------------

// Sinh chuỗi ngày YYYY-MM-DD lệch `offsetDays` ngày so với hôm nay (giờ địa phương).
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

// Tài khoản HẾT HẠN: fixed, ngày hết hạn trong quá khứ (offset < 0 => days < 0).
const expiredAccountArb = fc.record({
  id: fc.uuid(),
  expiryType: fc.constant('fixed'),
  expiryDate: fc.integer({ min: -400, max: -1 }).map(dateStringWithOffset),
  platform: platformArb,
});

// Tài khoản CÒN HẠN (active fixed): ngày hết hạn còn xa (offset > 5 => days > 5).
const activeFixedAccountArb = fc.record({
  id: fc.uuid(),
  expiryType: fc.constant('fixed'),
  expiryDate: fc.integer({ min: 6, max: 400 }).map(dateStringWithOffset),
  platform: platformArb,
});

// Tài khoản SẮP HẾT HẠN (expiring): còn 0..5 ngày => KHÔNG bị coi là hết hạn.
const expiringAccountArb = fc.record({
  id: fc.uuid(),
  expiryType: fc.constant('fixed'),
  expiryDate: fc.integer({ min: 0, max: 5 }).map(dateStringWithOffset),
  platform: platformArb,
});

// Tài khoản LIFETIME: luôn còn hạn dù có expiryDate hay không.
const lifetimeAccountArb = fc.record({
  id: fc.uuid(),
  expiryType: fc.constant('lifetime'),
  expiryDate: fc.oneof(
    fc.constant(null),
    fc.integer({ min: -400, max: 400 }).map(dateStringWithOffset),
  ),
  platform: platformArb,
});

// Bất kỳ tài khoản nào (lẫn lộn còn hạn / hết hạn / sắp hết / lifetime).
const anyAccountArb = fc.oneof(
  expiredAccountArb,
  activeFixedAccountArb,
  expiringAccountArb,
  lifetimeAccountArb,
);

// Danh sách tài khoản lẫn lộn (có thể rỗng).
const accountsArb = fc.array(anyAccountArb, { maxLength: 30 });

// --- Properties -------------------------------------------------------------

describe('Property 5 — filterAccountsByExpiredToggle lọc theo trạng thái hiển thị hết hạn (Requirements 3.1, 3.2)', () => {
  it('showExpired = false: loại bỏ toàn bộ tài khoản hết hạn và giữ đủ mọi tài khoản còn hạn', () => {
    fc.assert(
      fc.property(accountsArb, (accounts) => {
        const result = filterAccountsByExpiredToggle(accounts, false);

        // (a) Không còn bất kỳ tài khoản hết hạn nào trong kết quả.
        expect(result.some(isExpiredAccount)).toBe(false);

        // (b) Giữ ĐỦ mọi tài khoản còn hạn: tập id còn hạn của kết quả phải
        //     trùng khớp tập id còn hạn của đầu vào (không thiếu, không dư).
        const expectedActiveIds = accounts.filter(a => !isExpiredAccount(a)).map(a => a.id);
        expect(result.map(a => a.id)).toEqual(expectedActiveIds);
      }),
      { numRuns: 200 },
    );
  });

  it('showExpired = true: giữ nguyên toàn bộ tài khoản, không mất phần tử', () => {
    fc.assert(
      fc.property(accountsArb, (accounts) => {
        const result = filterAccountsByExpiredToggle(accounts, true);

        // Cùng số lượng và cùng thứ tự các phần tử như đầu vào.
        expect(result).toEqual(accounts);
        expect(result.length).toBe(accounts.length);
      }),
      { numRuns: 200 },
    );
  });

  it('không mutate mảng đầu vào (cả hai chế độ trả về bản sao)', () => {
    fc.assert(
      fc.property(accountsArb, fc.boolean(), (accounts, showExpired) => {
        const snapshot = accounts.map(a => ({ ...a }));
        const result = filterAccountsByExpiredToggle(accounts, showExpired);

        // Mảng đầu vào không bị thay đổi độ dài lẫn nội dung phần tử.
        expect(accounts.length).toBe(snapshot.length);
        accounts.forEach((acc, i) => {
          expect(acc).toEqual(snapshot[i]);
        });

        // Kết quả là một mảng mới (tham chiếu khác) — không mutate tại chỗ.
        expect(result).not.toBe(accounts);
      }),
      { numRuns: 200 },
    );
  });

  it('generator đúng phân loại: getStatusFromExpiry phản ánh đúng còn/hết hạn', () => {
    // Kiểm chứng chéo rằng generator sinh đủ hai loại còn hạn/hết hạn như mong đợi.
    fc.assert(
      fc.property(expiredAccountArb, activeFixedAccountArb, lifetimeAccountArb,
        (expired, active, lifetime) => {
          expect(getStatusFromExpiry(expired.expiryDate, expired.expiryType)).toBe('expired');
          expect(isExpiredAccount(expired)).toBe(true);
          expect(isExpiredAccount(active)).toBe(false);
          expect(isExpiredAccount(lifetime)).toBe(false);
        }),
      { numRuns: 100 },
    );
  });
});
