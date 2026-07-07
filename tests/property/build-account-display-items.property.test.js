// ============================================================================
// Property-based test cho buildAccountDisplayItems (js/utils.js).
//
// Feature: expired-toggle-trash-grouping, Property 1: Nhóm nền tảng phân hoạch và sắp xếp đúng
//
// Với mọi danh sách tài khoản, buildAccountDisplayItems phải:
//  (a) đặt mọi tài khoản có cùng getAccountGroupKey vào đúng một item nhóm;
//  (b) trả về thẻ đơn lẻ (không phải nhóm) cho mọi khoá chỉ có đúng một tài khoản;
//  (c) giữ thứ tự các item và thứ tự tài khoản bên trong mỗi nhóm khớp với
//      sortAccountsByPriority.
// Kết quả này áp dụng như nhau cho cả màn hình danh sách và màn hình thùng rác.
//
// Validates: Requirements 1.1, 1.3
// Thư viện: fast-check + vitest (>= 100 vòng lặp mỗi property).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

const UTILS_PATH = path.join(__dirname, '..', '..', 'js', 'utils.js');
const UTILS_SRC = fs.readFileSync(UTILS_PATH, 'utf8');

// Xuất đúng các hàm thuần cần kiểm chứng ra ngoài sandbox.
const EXPORT_SNIPPET = `
;globalThis.__tingUtilsExports = {
  buildAccountDisplayItems,
  getAccountGroupKey,
  sortAccountsByPriority,
  getResolvedPlatform,
  isAccountExpiredForSort,
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
    Map,
    Set,
    JSON,
    encodeURIComponent,
    decodeURIComponent,
    Infinity,
  };
  sandbox.Object = Object;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  // Không định nghĩa detectPlatform / getPlatformIconConfig: utils.js đã bảo vệ
  // bằng `typeof ... === 'function'`, nên tài khoản 'other'/rỗng sẽ gom nhóm
  // theo tên dịch vụ (service key). Điều này vẫn thuộc không gian đầu vào cần phủ.
  vm.createContext(sandbox);
  vm.runInContext(UTILS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'utils.js' });
  return sandbox.__tingUtilsExports;
}

const {
  buildAccountDisplayItems,
  getAccountGroupKey,
  sortAccountsByPriority,
} = loadUtils();

// --- Generators -------------------------------------------------------------

// Chuyển offset ngày (so với hôm nay) thành chuỗi YYYY-MM-DD theo giờ địa phương.
function toDateStr(offsetDays) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Nhiều nền tảng khác nhau, có cả 'other' và chuỗi rỗng (buộc rơi về group theo tên).
const platformArb = fc.constantFrom(
  'openai', 'youtube', 'canva', 'netflix', 'spotify', 'github',
  'notion', 'claude', 'suno', 'other', '',
);

// Tên tài khoản: phủ Latin, tiếng Việt có dấu, CJK, emoji và chuỗi Unicode bất kỳ.
const nameArb = fc.oneof(
  fc.constantFrom(
    'ChatGPT Plus', 'Netflix Premium', 'Tài khoản Cá nhân', 'Spotify Family',
    '日本語アカウント', 'Ñoño café', '😀 Emoji Acc', 'Gói Pro', 'Canva Team',
    '', 'unknown',
  ),
  fc.fullUnicode({ maxLength: 12 }),
);

// expiryType: fixed (đa số) hoặc lifetime.
const expiryTypeArb = fc.constantFrom('fixed', 'fixed', 'lifetime');

// expiryDate: quá hạn, đúng hôm nay, sắp hết (<=5 ngày), còn hạn xa, hoặc null.
const expiryDateArb = fc.oneof(
  fc.integer({ min: -400, max: -1 }).map(toDateStr),  // đã quá hạn
  fc.constant(toDateStr(0)),                          // hôm nay
  fc.integer({ min: 1, max: 5 }).map(toDateStr),      // sắp hết hạn
  fc.integer({ min: 6, max: 400 }).map(toDateStr),    // còn hạn xa
  fc.constant(null),                                  // thiếu ngày
);

const isoOrNull = fc.oneof(
  fc.constant(undefined),
  fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map(d => d.toISOString()),
);

const accountArb = fc.record({
  id: fc.integer({ min: 0, max: 1e9 }).map(n => `acc-${n}`),
  name: nameArb,
  platform: platformArb,
  status: fc.constantFrom('active', 'expiring', 'expired'),
  expiryType: expiryTypeArb,
  expiryDate: expiryDateArb,
  isPinned: fc.boolean(),
  isFavorite: fc.boolean(),
  pinnedAt: isoOrNull,
  favoriteAt: isoOrNull,
});

// Danh sách tài khoản với id duy nhất để đối chiếu theo danh tính rõ ràng.
const accountListArb = fc
  .array(accountArb, { maxLength: 25 })
  .map((accs) => accs.map((acc, i) => ({ ...acc, id: `${acc.id}#${i}` })));

// --- Helpers ----------------------------------------------------------------

// Một item là "nhóm" khi có mảng accounts và khoá nhóm; ngược lại là thẻ đơn lẻ.
function isGroup(item) {
  return !!item
    && Array.isArray(item.accounts)
    && typeof item.key === 'string'
    && typeof item.firstIndex === 'number';
}

// Trải phẳng kết quả thành danh sách tài khoản theo đúng thứ tự hiển thị.
function flattenItems(items) {
  const flat = [];
  for (const item of items) {
    if (isGroup(item)) flat.push(...item.accounts);
    else flat.push(item);
  }
  return flat;
}

// --- Property ---------------------------------------------------------------

describe('Property 1 — buildAccountDisplayItems phân hoạch & sắp xếp đúng (Requirements 1.1, 1.3)', () => {
  it('gom đúng theo getAccountGroupKey, tách thẻ đơn lẻ, giữ thứ tự theo sortAccountsByPriority', () => {
    fc.assert(
      fc.property(accountListArb, (accounts) => {
        const items = buildAccountDisplayItems(accounts);
        const sorted = sortAccountsByPriority(accounts);
        const flat = flattenItems(items);

        // (0) Bảo toàn phần tử: không thêm/bớt, đúng cùng tập tài khoản (theo danh tính).
        expect(flat.length).toBe(accounts.length);
        const flatSet = new Set(flat);
        expect(flatSet.size).toBe(accounts.length);
        for (const acc of accounts) {
          expect(flatSet.has(acc)).toBe(true);
        }

        // Đếm số tài khoản theo từng khoá nhóm trên đầu vào (nguồn chân lý).
        const countByKey = new Map();
        for (const acc of accounts) {
          const k = getAccountGroupKey(acc);
          countByKey.set(k, (countByKey.get(k) || 0) + 1);
        }

        // (a) Mỗi khoá nhóm chỉ xuất hiện trong đúng MỘT item.
        // (b) Item nhóm chỉ dành cho khoá có >= 2 tài khoản; khoá có đúng 1 tài
        //     khoản phải là thẻ đơn lẻ (không phải nhóm).
        const seenKeys = new Set();
        for (const item of items) {
          if (isGroup(item)) {
            // Mọi tài khoản trong nhóm phải cùng một khoá.
            const keys = item.accounts.map(getAccountGroupKey);
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(1);
            const key = keys[0];
            // Nhóm phải có >= 2 tài khoản và bằng đúng tổng số tài khoản của khoá đó.
            expect(item.accounts.length).toBeGreaterThanOrEqual(2);
            expect(item.accounts.length).toBe(countByKey.get(key));
            // Khoá chưa từng xuất hiện ở item khác.
            expect(seenKeys.has(key)).toBe(false);
            seenKeys.add(key);
          } else {
            const key = getAccountGroupKey(item);
            // Thẻ đơn lẻ chỉ hợp lệ khi khoá đó có đúng 1 tài khoản trên đầu vào.
            expect(countByKey.get(key)).toBe(1);
            expect(seenKeys.has(key)).toBe(false);
            seenKeys.add(key);
          }
        }
        // Tổng số khoá xuất hiện đúng bằng số khoá nhóm phân biệt.
        expect(seenKeys.size).toBe(countByKey.size);

        // (c1) Thứ tự tài khoản bên trong mỗi nhóm khớp với sortAccountsByPriority:
        //      lọc `sorted` theo khoá của nhóm phải cho đúng dãy accounts của nhóm.
        for (const item of items) {
          if (isGroup(item)) {
            const key = item.key;
            const expectedOrder = sorted.filter(acc => getAccountGroupKey(acc) === key);
            expect(item.accounts).toEqual(expectedOrder);
          }
        }

        // (c2) Thứ tự các item khớp thứ tự xuất hiện đầu tiên của khoá trong `sorted`.
        const firstSeenOrder = [];
        const added = new Set();
        for (const acc of sorted) {
          const k = getAccountGroupKey(acc);
          if (!added.has(k)) {
            added.add(k);
            firstSeenOrder.push(k);
          }
        }
        const itemKeys = items.map(item => (isGroup(item) ? item.key : getAccountGroupKey(item)));
        expect(itemKeys).toEqual(firstSeenOrder);
      }),
      { numRuns: 300 },
    );
  });
});
