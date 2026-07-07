// ============================================================================
// Property-based test cho partitionActiveThenExpired (js/utils.js).
//
// Feature: expired-toggle-trash-grouping, Property 6: Sắp xếp ổn định còn hạn trước hết hạn
// Với mọi danh sách tài khoản, partitionActiveThenExpired(accounts) phải trả về
// một danh sách trong đó mọi Tai_Khoan_Con_Han đứng trước mọi Tai_Khoan_Het_Han,
// đồng thời giữ nguyên thứ tự tương đối ban đầu của các tài khoản trong từng
// phân nhóm (ổn định/stable), và không thêm/bớt phần tử nào.
//
// Validates: Requirements 3.3
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
//
// utils.js không dùng module.exports (các hàm là global), nên ta nạp mã nguồn
// vào một vm sandbox rồi lấy ra các hàm cần kiểm thử — theo đúng pattern của
// tests/property/filter-accounts-by-expired-toggle.property.test.js.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

const UTILS_PATH = path.join(__dirname, '..', '..', 'js', 'utils.js');
const UTILS_SRC = fs.readFileSync(UTILS_PATH, 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingUtilsExports = {
  partitionActiveThenExpired,
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

const { partitionActiveThenExpired, isExpiredAccount, getStatusFromExpiry } = loadUtils();

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

// Danh sách tài khoản trộn ngẫu nhiên (có thể rỗng). Gắn index gốc để kiểm chứng
// tính ổn định (stable) của thứ tự trong từng phân nhóm.
const accountsArb = fc
  .array(anyAccountArb, { maxLength: 30 })
  .map(accounts => accounts.map((acc, origIndex) => ({ ...acc, origIndex })));

// --- Properties -------------------------------------------------------------

describe('Property 6 — partitionActiveThenExpired sắp xếp ổn định còn hạn trước hết hạn (Requirements 3.3)', () => {
  it('mọi tài khoản còn hạn đứng trước mọi tài khoản hết hạn', () => {
    fc.assert(
      fc.property(accountsArb, (accounts) => {
        const result = partitionActiveThenExpired(accounts);

        // Tìm chỉ số cuối cùng của tài khoản còn hạn và chỉ số đầu tiên của
        // tài khoản hết hạn; mọi còn hạn phải nằm trước mọi hết hạn.
        let lastActiveIdx = -1;
        let firstExpiredIdx = result.length;
        result.forEach((acc, i) => {
          if (isExpiredAccount(acc)) {
            if (i < firstExpiredIdx) firstExpiredIdx = i;
          } else {
            if (i > lastActiveIdx) lastActiveIdx = i;
          }
        });
        expect(lastActiveIdx).toBeLessThan(firstExpiredIdx);
      }),
      { numRuns: 200 },
    );
  });

  it('giữ nguyên thứ tự tương đối ban đầu trong từng phân nhóm (ổn định)', () => {
    fc.assert(
      fc.property(accountsArb, (accounts) => {
        const result = partitionActiveThenExpired(accounts);

        // Thứ tự các tài khoản còn hạn trong kết quả phải khớp thứ tự gốc.
        const activeOrig = accounts.filter(a => !isExpiredAccount(a)).map(a => a.origIndex);
        const activeResult = result.filter(a => !isExpiredAccount(a)).map(a => a.origIndex);
        expect(activeResult).toEqual(activeOrig);

        // Thứ tự các tài khoản hết hạn trong kết quả phải khớp thứ tự gốc.
        const expiredOrig = accounts.filter(isExpiredAccount).map(a => a.origIndex);
        const expiredResult = result.filter(isExpiredAccount).map(a => a.origIndex);
        expect(expiredResult).toEqual(expiredOrig);
      }),
      { numRuns: 200 },
    );
  });

  it('không thêm/bớt phần tử: multiset theo origIndex không đổi và tổng số bằng đầu vào', () => {
    fc.assert(
      fc.property(accountsArb, (accounts) => {
        const result = partitionActiveThenExpired(accounts);

        // Tổng số phần tử bằng đầu vào.
        expect(result.length).toBe(accounts.length);

        // Cùng tập phần tử (theo origIndex là định danh duy nhất), không dư/thiếu.
        const inputIds = accounts.map(a => a.origIndex).sort((x, y) => x - y);
        const resultIds = result.map(a => a.origIndex).sort((x, y) => x - y);
        expect(resultIds).toEqual(inputIds);
      }),
      { numRuns: 200 },
    );
  });

  it('không mutate mảng đầu vào (trả về mảng mới, tham chiếu khác)', () => {
    fc.assert(
      fc.property(accountsArb, (accounts) => {
        const snapshot = accounts.map(a => ({ ...a }));
        const result = partitionActiveThenExpired(accounts);

        // Mảng đầu vào giữ nguyên độ dài và nội dung phần tử theo thứ tự gốc.
        expect(accounts.length).toBe(snapshot.length);
        accounts.forEach((acc, i) => {
          expect(acc).toEqual(snapshot[i]);
        });

        // Kết quả là một mảng mới, không mutate tại chỗ.
        expect(result).not.toBe(accounts);
      }),
      { numRuns: 200 },
    );
  });

  it('generator đúng phân loại: getStatusFromExpiry phản ánh đúng còn/hết hạn', () => {
    fc.assert(
      fc.property(expiredAccountArb, activeFixedAccountArb, expiringAccountArb, lifetimeAccountArb,
        (expired, active, expiring, lifetime) => {
          expect(getStatusFromExpiry(expired.expiryDate, expired.expiryType)).toBe('expired');
          expect(isExpiredAccount(expired)).toBe(true);
          expect(isExpiredAccount(active)).toBe(false);
          expect(isExpiredAccount(expiring)).toBe(false);
          expect(isExpiredAccount(lifetime)).toBe(false);
        }),
      { numRuns: 100 },
    );
  });
});
