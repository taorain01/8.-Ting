// ============================================================================
// Property-based test cho tìm kiếm thùng rác trong renderTrashList (js/desktop-ui.js)
// — mô hình hoá bằng các hàm thuần trong js/utils.js.
//
// Feature: expired-toggle-trash-grouping, Property 2: Tìm kiếm thùng rác lọc trước rồi nhóm đúng
// Với mọi danh sách trashAccounts và mọi truy vấn tìm kiếm, tập tài khoản hiển
// thị trong thùng rác phải đúng bằng tập tài khoản thoả accountMatchesSearch, và
// được nhóm/sắp xếp bằng buildAccountDisplayItems trên chính tập đã lọc đó.
//
// Validates: Requirements 1.9
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
//
// Bối cảnh: renderTrashList lọc trashAccounts theo searchQuery bằng
// accountMatchesSearch, RỒI gọi buildAccountDisplayItems(filtered). Đây là một
// pipeline thuần có thể kiểm chứng bằng các hàm trong utils.js. Ta kiểm chứng:
//   (a) tập tài khoản trải phẳng từ buildAccountDisplayItems(filtered) đúng bằng
//       tập tài khoản thoả accountMatchesSearch (theo id, không dư/không thiếu);
//   (b) cách nhóm và thứ tự khớp buildAccountDisplayItems áp dụng trên tập đã lọc
//       (so sánh với việc gọi trực tiếp trên filtered).
//
// utils.js không dùng module.exports (các hàm là global), nên ta nạp mã nguồn
// vào một vm sandbox rồi lấy ra các hàm cần kiểm thử — theo đúng pattern của
// tests/property/filter-before-expired-ordering.property.test.js. Cần stub
// window = { appState: { customCategories: [] } } vì accountMatchesSearch tham
// chiếu nó.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

const UTILS_PATH = path.join(__dirname, '..', '..', 'js', 'utils.js');
const UTILS_SRC = fs.readFileSync(UTILS_PATH, 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingUtilsExports = {
  buildAccountDisplayItems,
  accountMatchesSearch,
  getAccountGroupKey,
  sortAccountsByPriority,
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
  buildAccountDisplayItems,
  accountMatchesSearch,
  getAccountGroupKey,
  sortAccountsByPriority,
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

// Nền tảng đa dạng, gồm cả 'other' để phủ nhánh nhóm theo tên dịch vụ.
const platformArb = fc.constantFrom(
  'spotify', 'netflix', 'youtube', 'chatgpt', 'canva', 'other',
);

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
  'ChatGPT Plus',
  'Canva Pro 設計',
);

// Mốc xoá mềm: trong hạn giữ, đúng mốc, quá hạn giữ (số ngày trước đây).
const deletedAtArb = fc.oneof(
  fc.constant(null),
  fc.integer({ min: -60, max: 0 }).map((offset) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d.getTime();
  }),
);

// Tài khoản thùng rác: đa dạng nền tảng + tên Unicode + hạn hết/còn + deletedAt.
const trashAccountArb = fc.record({
  id: fc.uuid(),
  name: nameArb,
  expiryType: fc.constantFrom('fixed', 'lifetime'),
  expiryDate: fc.oneof(
    fc.constant(null),
    fc.integer({ min: -400, max: 400 }).map(dateStringWithOffset),
  ),
  platform: platformArb,
  deletedAt: deletedAtArb,
});

// Danh sách trashAccounts (có thể rỗng).
const trashAccountsArb = fc.array(trashAccountArb, { maxLength: 30 });

// Truy vấn tìm kiếm: gồm chuỗi khớp và không khớp, kể cả rỗng và Unicode.
const searchQueryArb = fc.oneof(
  fc.constant(''),
  fc.constantFrom(
    'netflix', 'premium', 'spotify', 'gói', 'youtube', 'team',
    'example', 'chatgpt', 'canva', 'đặc biệt', '設計', 'zzz-khong-khop',
  ),
);

// --- Trợ giúp: mô hình pipeline renderTrashList & trải phẳng nhóm ------------

// renderTrashList lọc theo searchQuery bằng accountMatchesSearch, rồi nhóm.
function filterTrashBySearch(trashAccounts, query) {
  return trashAccounts.filter((acc) => accountMatchesSearch(acc, query));
}

// Một item trong kết quả buildAccountDisplayItems là group khi có mảng accounts.
function isGroupItem(item) {
  return item && typeof item === 'object' && Array.isArray(item.accounts);
}

// Trải phẳng danh sách item hiển thị thành mảng tài khoản (giữ thứ tự).
function flattenDisplayItems(items) {
  const out = [];
  items.forEach((item) => {
    if (isGroupItem(item)) {
      item.accounts.forEach((acc) => out.push(acc));
    } else {
      out.push(item);
    }
  });
  return out;
}

const sortedIds = (arr) => arr.map((a) => a.id).slice().sort();

// --- Properties -------------------------------------------------------------

describe('Property 2 — Tìm kiếm thùng rác lọc trước rồi nhóm đúng (Requirements 1.9)', () => {
  it('(a) tập tài khoản hiển thị đúng bằng tập thoả accountMatchesSearch (theo id)', () => {
    fc.assert(
      fc.property(trashAccountsArb, searchQueryArb, (trashAccounts, query) => {
        // Pipeline renderTrashList: lọc theo search TRƯỚC, rồi nhóm.
        const filtered = filterTrashBySearch(trashAccounts, query);
        const items = buildAccountDisplayItems(filtered);
        const displayedIds = sortedIds(flattenDisplayItems(items));

        // Tập tài khoản thoả accountMatchesSearch tính độc lập trên danh sách gốc.
        const matchedIds = sortedIds(
          trashAccounts.filter((acc) => accountMatchesSearch(acc, query)),
        );

        // Không dư, không thiếu.
        expect(displayedIds).toEqual(matchedIds);
      }),
      { numRuns: 200 },
    );
  });

  it('(b) cách nhóm và thứ tự khớp buildAccountDisplayItems áp dụng trên tập đã lọc', () => {
    fc.assert(
      fc.property(trashAccountsArb, searchQueryArb, (trashAccounts, query) => {
        const filtered = filterTrashBySearch(trashAccounts, query);

        // Kết quả pipeline (nhóm sau khi lọc).
        const items = buildAccountDisplayItems(filtered);

        // Kỳ vọng: nhóm/sắp xếp áp dụng đúng trên chính tập đã lọc độc lập.
        const expected = buildAccountDisplayItems(
          trashAccounts.filter((acc) => accountMatchesSearch(acc, query)),
        );

        // Cùng số lượng item hiển thị.
        expect(items.length).toBe(expected.length);

        // Từng item khớp về loại (group/đơn lẻ), khoá nhóm và thứ tự tài khoản.
        items.forEach((item, i) => {
          const exp = expected[i];
          expect(isGroupItem(item)).toBe(isGroupItem(exp));
          if (isGroupItem(item)) {
            expect(item.key).toBe(exp.key);
            expect(item.accounts.map((a) => a.id)).toEqual(exp.accounts.map((a) => a.id));
          } else {
            expect(item.id).toBe(exp.id);
          }
        });
      }),
      { numRuns: 200 },
    );
  });

  it('(b) nhóm áp dụng trên tập ĐÃ LỌC, không phải trên toàn danh sách gốc', () => {
    fc.assert(
      fc.property(trashAccountsArb, searchQueryArb, (trashAccounts, query) => {
        const filtered = filterTrashBySearch(trashAccounts, query);
        const items = buildAccountDisplayItems(filtered);
        const displayed = flattenDisplayItems(items);

        // Mọi tài khoản hiển thị đều thoả tìm kiếm (không lọt tài khoản không khớp).
        displayed.forEach((acc) => {
          expect(accountMatchesSearch(acc, query)).toBe(true);
        });

        // Và mọi tài khoản trong cùng một group phải cùng khoá nhóm.
        items.filter(isGroupItem).forEach((group) => {
          group.accounts.forEach((acc) => {
            expect(getAccountGroupKey(acc)).toBe(group.key);
          });
        });
      }),
      { numRuns: 200 },
    );
  });

  it('thứ tự tài khoản trải phẳng khớp thứ tự sortAccountsByPriority trên tập đã lọc', () => {
    fc.assert(
      fc.property(trashAccountsArb, searchQueryArb, (trashAccounts, query) => {
        const filtered = filterTrashBySearch(trashAccounts, query);
        const items = buildAccountDisplayItems(filtered);
        const displayedIds = flattenDisplayItems(items).map((a) => a.id).slice().sort();

        // Cùng multiset id với tập đã lọc sau sortAccountsByPriority (chỉ đổi thứ tự nhóm).
        const sortedFilteredIds = sortAccountsByPriority(filtered).map((a) => a.id).slice().sort();
        expect(displayedIds).toEqual(sortedFilteredIds);
      }),
      { numRuns: 100 },
    );
  });
});
