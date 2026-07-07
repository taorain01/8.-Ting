// ============================================================================
// Property-based test cho toggleAccountManager (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 13: Bật/tắt quyền Account_Manager là round-trip
//   Với mọi danh sách managerEmails và một email, toggleAccountManager trả về
//   danh sách email ĐÃ CHUẨN HOÁ (qua normalizeGroupEmailList).
//     - Bật (enable = true): email (đã chuẩn hoá) có mặt ĐÚNG MỘT LẦN trong danh
//       sách, không nhân đôi nếu đã có; các email khác vẫn được giữ.
//     - Tắt (enable = false): email (đã chuẩn hoá) bị loại khỏi danh sách.
//     - email rỗng (sau chuẩn hoá) → trả về danh sách đã chuẩn hoá, không đổi.
//     - Round-trip: với danh sách ban đầu KHÔNG chứa email, bật rồi tắt khôi phục
//       về đúng trạng thái ban đầu (so theo tập, không tính thứ tự).
//     - email biến thể hoa/thường/khoảng trắng được coi là cùng một email.
//
// Validates: Requirements 9.2, 9.3
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

// --- Nạp js/groups.js trong vm sandbox (các hàm là global trong groups.js) ---
// Cuối file groups.js có các gán `window.xxx = ...` nên sandbox PHẢI có window.

const GROUPS_PATH = path.join(__dirname, '..', '..', 'js', 'groups.js');
const GROUPS_SRC = fs.readFileSync(GROUPS_PATH, 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingGroupExports = {
  toggleAccountManager,
  normalizeGroupEmail,
  normalizeGroupEmailList,
};
`;

function loadGroups() {
  const sandbox = {
    window: {},
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
    // Các phụ thuộc runtime không dùng trong lớp logic thuần -> để undefined.
    auth: undefined,
    db: undefined,
    firebase: undefined,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(GROUPS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'groups.js' });
  return sandbox.__tingGroupExports;
}

const { toggleAccountManager, normalizeGroupEmail, normalizeGroupEmailList } = loadGroups();

// --- Helpers ----------------------------------------------------------------

// Đếm số lần một giá trị xuất hiện trong mảng.
function countOf(arr, value) {
  return arr.reduce((acc, item) => (item === value ? acc + 1 : acc), 0);
}

// So sánh hai mảng theo tập hợp (bỏ qua thứ tự và trùng lặp).
function sameSet(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

// --- Generators -------------------------------------------------------------

// Token hợp lệ cho local/domain (không chứa khoảng trắng hay '@').
const tokenArb = fc
  .string({ minLength: 1, maxLength: 10 })
  .map((s) => s.replace(/[\s@.]/g, 'x'))
  .filter((s) => s.length >= 1);

// Email "sạch" ở dạng đã chuẩn hoá (chữ thường, không khoảng trắng thừa).
const cleanEmailArb = fc
  .tuple(tokenArb, tokenArb, tokenArb)
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`.toLowerCase())
  .filter((e) => normalizeGroupEmail(e) === e && e.length > 0);

// Biến thể hoa/thường + khoảng trắng đầu cuối của một email sạch.
function variantOf(email) {
  return fc.constantFrom(
    email,
    email.toUpperCase(),
    `  ${email}  `,
    `\t${email.toUpperCase()}\n`,
    ` ${email} `,
  );
}

// Email đầu vào bất kỳ: email sạch, biến thể hoa/thường/khoảng trắng, rỗng, hay null/undefined.
const anyEmailArb = fc.oneof(
  { weight: 5, arbitrary: cleanEmailArb },
  { weight: 3, arbitrary: cleanEmailArb.chain((e) => variantOf(e)) },
  { weight: 1, arbitrary: fc.constantFrom('', '   ', '\t', '\n') },
  { weight: 1, arbitrary: fc.constantFrom(null, undefined) },
);

// Danh sách managerEmails bất kỳ (có thể lẫn biến thể hoa/thường, khoảng trắng, rỗng).
const managerListArb = fc.array(
  fc.oneof(
    cleanEmailArb,
    cleanEmailArb.chain((e) => variantOf(e)),
    fc.constantFrom('', '   ', null, undefined),
  ),
  { maxLength: 8 },
);

// --- Property 13 ------------------------------------------------------------

describe('Property 13 — toggleAccountManager bật/tắt là round-trip (Requirements 9.2, 9.3)', () => {
  it('kết quả luôn là danh sách đã chuẩn hoá (idempotent với normalizeGroupEmailList)', () => {
    fc.assert(
      fc.property(managerListArb, anyEmailArb, fc.boolean(), (list, email, enable) => {
        const result = toggleAccountManager(list, email, enable);
        expect(Array.isArray(result)).toBe(true);
        // Mỗi phần tử đã ở dạng chuẩn hoá và khác rỗng.
        for (const item of result) {
          expect(item).toBe(normalizeGroupEmail(item));
          expect(item.length).toBeGreaterThan(0);
        }
        // Chuẩn hoá lại không làm đổi kết quả (đã chuẩn hoá triệt để).
        expect(normalizeGroupEmailList(result)).toEqual(result);
      }),
      { numRuns: 200 },
    );
  });

  it('bật (enable=true): email chuẩn hoá có mặt ĐÚNG MỘT LẦN; các email khác vẫn còn (Req 9.2)', () => {
    fc.assert(
      fc.property(managerListArb, anyEmailArb, (list, email) => {
        const result = toggleAccountManager(list, email, true);
        const normalized = normalizeGroupEmail(email);
        const baseline = normalizeGroupEmailList(list);

        if (!normalized) {
          // Email rỗng: danh sách chuẩn hoá không đổi.
          expect(result).toEqual(baseline);
          return;
        }

        // Có mặt đúng một lần (không nhân đôi kể cả khi đã có sẵn).
        expect(countOf(result, normalized)).toBe(1);
        // Mọi email khác trong baseline vẫn được giữ.
        for (const other of new Set(baseline)) {
          if (other !== normalized) {
            expect(result).toContain(other);
          }
        }
        // Tập kết quả = tập baseline ∪ {email}.
        const expectedSet = new Set([...baseline, normalized]);
        expect(sameSet(result, [...expectedSet])).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('không nhân đôi khi bật email đã có sẵn trong danh sách (Req 9.2)', () => {
    fc.assert(
      fc.property(managerListArb, cleanEmailArb, (list, email) => {
        // Đưa sẵn email (dạng biến thể) vào danh sách trước khi bật.
        const seeded = [...list, `  ${email.toUpperCase()}  `];
        const result = toggleAccountManager(seeded, email, true);
        expect(countOf(result, normalizeGroupEmail(email))).toBe(1);
      }),
      { numRuns: 200 },
    );
  });

  it('tắt (enable=false): email chuẩn hoá bị loại khỏi danh sách (Req 9.3)', () => {
    fc.assert(
      fc.property(managerListArb, anyEmailArb, (list, email) => {
        const result = toggleAccountManager(list, email, false);
        const normalized = normalizeGroupEmail(email);
        const baseline = normalizeGroupEmailList(list);

        if (!normalized) {
          expect(result).toEqual(baseline);
          return;
        }

        // Không còn chứa email đã tắt.
        expect(result).not.toContain(normalized);
        // Tập kết quả = tập baseline trừ đi email.
        const expectedSet = new Set(baseline);
        expectedSet.delete(normalized);
        expect(sameSet(result, [...expectedSet])).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('round-trip: danh sách KHÔNG chứa email → bật rồi tắt khôi phục tập ban đầu (Req 9.2, 9.3)', () => {
    fc.assert(
      fc.property(managerListArb, cleanEmailArb, (list, email) => {
        const normalized = normalizeGroupEmail(email);
        const baseline = normalizeGroupEmailList(list);
        // Chỉ xét trường hợp danh sách ban đầu không chứa email.
        fc.pre(!baseline.includes(normalized));

        const afterEnable = toggleAccountManager(list, email, true);
        const afterDisable = toggleAccountManager(afterEnable, email, false);

        // Khôi phục đúng trạng thái ban đầu (so theo tập, không tính thứ tự).
        expect(sameSet(afterDisable, baseline)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('bất biến chuẩn hoá: biến thể hoa/thường/khoảng trắng cho cùng kết quả', () => {
    fc.assert(
      fc.property(managerListArb, cleanEmailArb, fc.boolean(), (list, email, enable) => {
        const base = toggleAccountManager(list, email, enable);
        const upper = toggleAccountManager(list, email.toUpperCase(), enable);
        const padded = toggleAccountManager(list, `  ${email}  `, enable);
        expect(sameSet(upper, base)).toBe(true);
        expect(sameSet(padded, base)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('email rỗng: trả về danh sách chuẩn hoá không đổi cho cả bật và tắt', () => {
    fc.assert(
      fc.property(managerListArb, fc.constantFrom('', '   ', '\t\n', null, undefined), fc.boolean(), (list, email, enable) => {
        const result = toggleAccountManager(list, email, enable);
        expect(result).toEqual(normalizeGroupEmailList(list));
      }),
      { numRuns: 150 },
    );
  });
});
