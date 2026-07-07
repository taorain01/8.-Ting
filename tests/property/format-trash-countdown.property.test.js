// ============================================================================
// Property-based test cho formatTrashCountdown (`js/utils.js`).
//
// Feature: expired-toggle-trash-grouping, Property 4: Đếm ngược ngày giữ không âm
// và đúng mốc hết hạn — Với mọi tài khoản đã xoá mềm có `deletedAt` bất kỳ, chuỗi
// `Dem_Nguoc_Giu` do `formatTrashCountdown` sinh ra không bao giờ chứa số âm; khi
// `getTrashDaysLeft(acc) >= 1` chuỗi ở dạng "còn X ngày giữ" với X đúng bằng số
// ngày giữ còn lại; khi `getTrashDaysLeft(acc) = 0` chuỗi ở trạng thái hết hạn
// ("hết hạn giữ") thay cho định dạng "còn X ngày giữ".
//
// Validates: Requirements 1.4, 1.5
// Thư viện: fast-check + vitest (>= 100 vòng lặp mỗi property).
//
// GHI CHÚ KỸ THUẬT: `formatTrashCountdown` phụ thuộc `getTrashDaysLeft`, hàm này
// KHÔNG định nghĩa trong utils.js mà ở desktop-ui.js. Ta nạp utils.js vào một
// sandbox vm và inject stub `getTrashDaysLeft` trả về số ngày do generator sinh
// (0..40), để kiểm chứng output của `formatTrashCountdown` một cách xác định
// (deterministic) theo giá trị daysLeft — bao phủ mốc 0, 1 và >1.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

const UTILS_PATH = path.join(__dirname, '..', '..', 'js', 'utils.js');
const UTILS_SRC = fs.readFileSync(UTILS_PATH, 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingUtilsExports = {
  formatTrashCountdown,
};
`;

// Nạp utils.js vào sandbox vm, inject stub getTrashDaysLeft đọc từ acc.__daysLeft.
// Stub mô phỏng đúng hợp đồng của hàm thật: luôn trả số nguyên >= 0.
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
    // Stub xác định: lấy số ngày giữ còn lại từ chính tài khoản do generator gắn vào.
    getTrashDaysLeft(acc) {
      const value = acc && typeof acc.__daysLeft === 'number' ? acc.__daysLeft : 30;
      return Math.max(0, Math.trunc(value));
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UTILS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'utils.js' });
  return sandbox.__tingUtilsExports;
}

const { formatTrashCountdown } = loadUtils();

// --- Generators -------------------------------------------------------------

// Số ngày giữ còn lại: 0..40 (gồm mốc 0, mốc 1, và >1).
const daysLeftArb = fc.integer({ min: 0, max: 40 });

// deletedAt bất kỳ: timestamp số, chuỗi ISO, null/undefined — giá trị này không
// ảnh hưởng kết quả vì getTrashDaysLeft đã được inject, nhưng vẫn phủ "deletedAt bất kỳ".
const deletedAtArb = fc.oneof(
  fc.integer({ min: 0, max: 4102444800000 }), // timestamp ms
  fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }).map((d) => d.toISOString()),
  fc.constantFrom(null, undefined, ''),
);

// Tài khoản đã xoá mềm với số ngày giữ do generator quyết định.
const trashedAccountArb = fc.record({
  daysLeft: daysLeftArb,
  deletedAt: deletedAtArb,
}).map(({ daysLeft, deletedAt }) => ({
  id: 'acc',
  name: 'Tài khoản',
  deletedAt,
  __daysLeft: daysLeft,
}));

// Chuỗi ở trạng thái hết hạn khi hết thời hạn giữ (daysLeft = 0).
const EXPIRED_TEXT = 'hết hạn giữ';

// --- Properties -------------------------------------------------------------

describe('Property 4 — formatTrashCountdown không âm và đúng mốc hết hạn (Requirements 1.4, 1.5)', () => {
  it('không bao giờ chứa số âm; >=1 ngày dạng "còn X ngày giữ"; 0 ngày là trạng thái hết hạn', () => {
    fc.assert(
      fc.property(trashedAccountArb, (acc) => {
        const daysLeft = acc.__daysLeft;
        const result = formatTrashCountdown(acc);

        // (chung) Không bao giờ xuất hiện số âm trong chuỗi.
        expect(result).not.toMatch(/-\s*\d/);

        if (daysLeft >= 1) {
          // Requirement 1.4: dạng "còn X ngày giữ" với X đúng bằng số ngày còn lại.
          expect(result).toBe(`còn ${daysLeft} ngày giữ`);
        } else {
          // Requirement 1.5: mốc 0 ngày -> trạng thái hết hạn, KHÔNG dùng định dạng "còn X ngày giữ".
          expect(result).toBe(EXPIRED_TEXT);
          expect(result).not.toMatch(/còn .* ngày giữ/);
        }
      }),
      { numRuns: 200 },
    );
  });
});
