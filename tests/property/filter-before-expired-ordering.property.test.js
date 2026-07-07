// ============================================================================
// Property-based test cho thứ tự "lọc trước, sắp xếp hết hạn sau" trong pipeline
// hiển thị của renderAccountList (js/desktop-ui.js) — mô hình hoá bằng các hàm
// thuần trong js/utils.js.
//
// Feature: expired-toggle-trash-grouping, Property 7: Lọc/tìm kiếm được áp dụng trước quy tắc hiển thị hết hạn
// Với mọi danh sách tài khoản kèm bộ lọc (trạng thái/thẻ/nền tảng/tìm kiếm) và
// khi Trang_Thai_Hien_Het_Han BẬT, tập kết quả cuối cùng chỉ chứa các tài khoản
// thoả điều kiện lọc, và tập đó đã được áp dụng quy tắc sắp xếp
// còn-hạn-trước-hết-hạn.
//
// Validates: Requirements 3.9
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
//
// renderAccountList thao tác DOM và phụ thuộc nhiều, nên ta kiểm thử pipeline
// thuần: renderAccountList áp dụng lọc filter/tag/platform/search TRƯỚC, sau đó
// (khi BẬT) gọi partitionActiveThenExpired(filtered). Ta tái hiện đúng thứ tự đó
// bằng các hàm thuần đã có trong js/utils.js và kiểm chứng:
//   (a) kết quả chỉ gồm tài khoản thoả điều kiện lọc;
//   (b) mọi tài khoản còn hạn đứng trước mọi tài khoản hết hạn;
//   (c) không thêm/bớt so với tập đã lọc (cùng multiset).
//
// utils.js không dùng module.exports (các hàm là global), nên ta nạp mã nguồn
// vào một vm sandbox rồi lấy ra các hàm cần kiểm thử — theo đúng pattern của
// tests/property/partition-active-then-expired.property.test.js.
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
  filterAccountsByExpiredToggle,
  isExpiredAccount,
  getStatusFromExpiry,
  accountMatchesSearch,
  getResolvedPlatform,
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
    RegExp,
    encodeURIComponent,
    decodeURIComponent,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  // accountMatchesSearch tham chiếu window.appState?.customCategories.
  sandbox.window = { appState: { customCategories: [] } };
  vm.createContext(sandbox);
  vm.runInContext(UTILS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'utils.js' });
  return sandbox.__tingUtilsExports;
}

const {
  partitionActiveThenExpired,
  filterAccountsByExpiredToggle,
  isExpiredAccount,
  getStatusFromExpiry,
  accountMatchesSearch,
  getResolvedPlatform,
} = loadUtils();

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

// Nền tảng cụ thể (không dùng 'other' để getResolvedPlatform trả về ổn định,
// không phụ thuộc suy luận từ tên).
const platformArb = fc.constantFrom('spotify', 'netflix', 'youtube', 'chatgpt', 'canva');

// Tên tài khoản đa dạng gồm cả Unicode/ký tự đặc biệt để phủ tìm kiếm.
const nameArb = fc.constantFrom(
  'Tài khoản A',
  'Netflix Premium',
  'spotify family',
  'Gói Cá Nhân',
  'user@example.com',
  'YouTube Pro',
  'Đặc biệt #1',
  'shared-team',
);

// Tài khoản HẾT HẠN: fixed, ngày hết hạn trong quá khứ (offset < 0 => days < 0).
const expiredAccountArb = fc.record({
  id: fc.uuid(),
  name: nameArb,
  expiryType: fc.constant('fixed'),
  expiryDate: fc.integer({ min: -400, max: -1 }).map(dateStringWithOffset),
  platform: platformArb,
});

// Tài khoản CÒN HẠN (active fixed): ngày hết hạn còn xa (offset > 5 => days > 5).
const activeFixedAccountArb = fc.record({
  id: fc.uuid(),
  name: nameArb,
  expiryType: fc.constant('fixed'),
  expiryDate: fc.integer({ min: 6, max: 400 }).map(dateStringWithOffset),
  platform: platformArb,
});

// Tài khoản SẮP HẾT HẠN (expiring): còn 0..5 ngày => KHÔNG bị coi là hết hạn.
const expiringAccountArb = fc.record({
  id: fc.uuid(),
  name: nameArb,
  expiryType: fc.constant('fixed'),
  expiryDate: fc.integer({ min: 0, max: 5 }).map(dateStringWithOffset),
  platform: platformArb,
});

// Tài khoản LIFETIME: luôn còn hạn dù có expiryDate hay không.
const lifetimeAccountArb = fc.record({
  id: fc.uuid(),
  name: nameArb,
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

// Danh sách tài khoản trộn ngẫu nhiên (có thể rỗng).
const accountsArb = fc.array(anyAccountArb, { maxLength: 30 });

// Bộ lọc: nền tảng cụ thể (hoặc không lọc) và/hoặc truy vấn tìm kiếm (hoặc rỗng).
const platformFilterArb = fc.oneof(
  fc.constant(null), // không lọc nền tảng
  fc.constantFrom('spotify', 'netflix', 'youtube', 'chatgpt', 'canva'),
);
const searchQueryArb = fc.oneof(
  fc.constant(''), // không tìm kiếm
  fc.constantFrom('netflix', 'premium', 'spotify', 'gói', 'youtube', 'team', 'example', 'zzz-khong-khop'),
);

// --- Mô hình pipeline lọc giống renderAccountList --------------------------

// Áp dụng lọc filter/tag/platform/search TRƯỚC (giống bước đầu của
// renderAccountList), trả về tập tài khoản khớp điều kiện lọc.
function applyFilters(accounts, { platformFilter, searchQuery }) {
  return accounts.filter((acc) => {
    if (platformFilter && getResolvedPlatform(acc) !== platformFilter) return false;
    if (!accountMatchesSearch(acc, searchQuery)) return false;
    return true;
  });
}

// Một tài khoản có thoả điều kiện lọc hay không (dùng để kiểm chứng (a)).
function matchesFilter(acc, { platformFilter, searchQuery }) {
  if (platformFilter && getResolvedPlatform(acc) !== platformFilter) return false;
  if (!accountMatchesSearch(acc, searchQuery)) return false;
  return true;
}

// --- Properties -------------------------------------------------------------

describe('Property 7 — Lọc/tìm kiếm áp dụng trước quy tắc hiển thị hết hạn (Requirements 3.9)', () => {
  it('khi BẬT: kết quả chỉ chứa tài khoản thoả điều kiện lọc', () => {
    fc.assert(
      fc.property(accountsArb, platformFilterArb, searchQueryArb, (accounts, platformFilter, searchQuery) => {
        const filter = { platformFilter, searchQuery };

        // renderAccountList: lọc TRƯỚC, rồi (BẬT) partitionActiveThenExpired.
        const filtered = applyFilters(accounts, filter);
        const result = partitionActiveThenExpired(filtered);

        // (a) Mọi phần tử kết quả đều thoả điều kiện lọc.
        result.forEach((acc) => {
          expect(matchesFilter(acc, filter)).toBe(true);
        });
      }),
      { numRuns: 200 },
    );
  });

  it('khi BẬT: mọi tài khoản còn hạn đứng trước mọi tài khoản hết hạn', () => {
    fc.assert(
      fc.property(accountsArb, platformFilterArb, searchQueryArb, (accounts, platformFilter, searchQuery) => {
        const filtered = applyFilters(accounts, { platformFilter, searchQuery });
        const result = partitionActiveThenExpired(filtered);

        let lastActiveIdx = -1;
        let firstExpiredIdx = result.length;
        result.forEach((acc, i) => {
          if (isExpiredAccount(acc)) {
            if (i < firstExpiredIdx) firstExpiredIdx = i;
          } else if (i > lastActiveIdx) {
            lastActiveIdx = i;
          }
        });
        // Không có tài khoản còn hạn nào nằm sau tài khoản hết hạn.
        expect(lastActiveIdx).toBeLessThan(firstExpiredIdx);
      }),
      { numRuns: 200 },
    );
  });

  it('khi BẬT: không thêm/bớt so với tập đã lọc (cùng multiset theo id)', () => {
    fc.assert(
      fc.property(accountsArb, platformFilterArb, searchQueryArb, (accounts, platformFilter, searchQuery) => {
        const filtered = applyFilters(accounts, { platformFilter, searchQuery });
        const result = partitionActiveThenExpired(filtered);

        // Cùng số lượng phần tử.
        expect(result.length).toBe(filtered.length);

        // Cùng tập id (không dư, không thiếu) — chỉ đổi thứ tự, không thêm/bớt.
        const filteredIds = filtered.map(a => a.id).sort();
        const resultIds = result.map(a => a.id).sort();
        expect(resultIds).toEqual(filteredIds);
      }),
      { numRuns: 200 },
    );
  });

  it('lọc TRƯỚC rồi sắp xếp == sắp xếp áp dụng lên đúng tập đã lọc (thứ tự các bước)', () => {
    fc.assert(
      fc.property(accountsArb, platformFilterArb, searchQueryArb, (accounts, platformFilter, searchQuery) => {
        const filter = { platformFilter, searchQuery };
        const filtered = applyFilters(accounts, filter);

        // Kết quả pipeline BẬT phải bằng đúng partitionActiveThenExpired(tập-đã-lọc):
        // xác nhận quy tắc hiển thị hết hạn chỉ tác động lên tập đã lọc, không phải
        // lên toàn bộ danh sách gốc.
        const result = partitionActiveThenExpired(filtered);
        const expected = partitionActiveThenExpired(filterAccountsByExpiredToggle(filtered, true));
        expect(result).toEqual(expected);

        // Đồng thời tập đã lọc phải đúng bằng tập tài khoản thoả điều kiện lọc
        // trên danh sách gốc (không bị quy tắc hết hạn loại bớt/ thêm vào).
        const expectedFilteredIds = accounts.filter(a => matchesFilter(a, filter)).map(a => a.id).sort();
        expect(filtered.map(a => a.id).sort()).toEqual(expectedFilteredIds);
      }),
      { numRuns: 200 },
    );
  });

  it('generator/pipeline hợp lệ: khi BẬT, tập kết quả gồm cả còn hạn lẫn hết hạn thoả lọc', () => {
    fc.assert(
      fc.property(expiredAccountArb, activeFixedAccountArb, (expired, active) => {
        // Không lọc gì => cả hai đều qua; partition đặt còn hạn trước hết hạn.
        const result = partitionActiveThenExpired([expired, active]);
        expect(result.map(a => a.id)).toEqual([active.id, expired.id]);
        expect(getStatusFromExpiry(expired.expiryDate, expired.expiryType)).toBe('expired');
      }),
      { numRuns: 100 },
    );
  });
});
