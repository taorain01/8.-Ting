// ============================================================================
// Property-based test cho validateInviteEmail (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 12: Validation email mời thành viên
//   Với mọi email đầu vào, danh sách memberEmails, pendingEmails và giới hạn
//   maxPending, validateInviteEmail chấp nhận (valid: true) KHI VÀ CHỈ KHI:
//   email khác rỗng, độ dài <= MAX_INVITE_EMAIL_LENGTH (254), đúng định dạng
//   (isValidGroupEmail), chưa có trong memberEmails, chưa có trong pendingEmails,
//   và pendingEmails.length < maxPending. Mọi trường hợp còn lại bị từ chối với
//   reason ∈ {empty, too_long, invalid_format, limit_reached, already_member,
//   already_pending}. Thứ tự kiểm trong cài đặt (quyết định reason khi nhiều lỗi
//   cùng xảy ra): empty → too_long → invalid_format → limit_reached →
//   already_member → already_pending. Email được chuẩn hoá qua normalizeGroupEmail
//   (trim + lowercase) trước khi kiểm và khi trả về.
//
// Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.6
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
  validateInviteEmail,
  normalizeGroupEmail,
  normalizeGroupEmailList,
  isValidGroupEmail,
  MAX_INVITE_EMAIL_LENGTH,
  MAX_PENDING_INVITES,
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

const {
  validateInviteEmail,
  normalizeGroupEmail,
  normalizeGroupEmailList,
  isValidGroupEmail,
  MAX_INVITE_EMAIL_LENGTH,
  MAX_PENDING_INVITES,
} = loadGroups();

// Kiểm tra hằng số hợp đồng đúng như thiết kế mong đợi.
expect(MAX_INVITE_EMAIL_LENGTH).toBe(254);
expect(MAX_PENDING_INVITES).toBe(100);

// --- Oracle độc lập cho kết quả kỳ vọng -------------------------------------
// Tái phát biểu đúng thứ tự kiểm của Property 12, dùng chính normalizeGroupEmail
// / isValidGroupEmail để định nghĩa "đúng định dạng" nhất quán với cài đặt.
function refValidate(email, memberEmails, pendingEmails, maxPending) {
  const normalized = normalizeGroupEmail(email);
  const members = normalizeGroupEmailList(memberEmails);
  const pending = normalizeGroupEmailList(pendingEmails);
  const parsedLimit = Number(maxPending);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : MAX_PENDING_INVITES;

  if (!normalized) return { valid: false, reason: 'empty' };
  if (normalized.length > MAX_INVITE_EMAIL_LENGTH) return { valid: false, reason: 'too_long' };
  if (!isValidGroupEmail(normalized)) return { valid: false, reason: 'invalid_format' };
  if (pending.length >= limit) return { valid: false, reason: 'limit_reached' };
  if (members.includes(normalized)) return { valid: false, reason: 'already_member' };
  if (pending.includes(normalized)) return { valid: false, reason: 'already_pending' };
  return { valid: true, email: normalized };
}

// --- Generators -------------------------------------------------------------

// Chuỗi khoảng trắng thuần (email rỗng sau khi trim).
const whitespaceArb = fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'), { maxLength: 6 });

// Phần cục bộ / tên miền hợp lệ (không chứa khoảng trắng và '@').
const tokenArb = fc
  .string({ minLength: 1, maxLength: 12 })
  .map((s) => s.replace(/[\s@.]/g, 'x'))
  .filter((s) => s.length >= 1);

// Email đúng định dạng: local@domain.tld (khớp regex isValidGroupEmail).
const validEmailArb = fc
  .tuple(tokenArb, tokenArb, tokenArb)
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`)
  .filter((e) => isValidGroupEmail(e));

// Email sai định dạng (khác rỗng, độ dài hợp lệ, nhưng không khớp regex).
const invalidFormatArb = fc
  .oneof(
    fc.constant('khong-co-at'),
    fc.constant('a@b'), // thiếu dấu chấm ở domain
    fc.constant('@domain.com'), // thiếu local
    fc.constant('local@'), // thiếu domain
    fc.constant('a b@domain.com'), // có khoảng trắng
    fc.constant('a@@b.com'),
    fc.constant('a@b..'),
    fc.string({ minLength: 1, maxLength: 20 }).map((s) => s.replace(/@/g, '')),
  )
  .map((s) => normalizeGroupEmail(s))
  .filter((s) => s.length > 0 && s.length <= MAX_INVITE_EMAIL_LENGTH && !isValidGroupEmail(s));

// Email đúng định dạng nhưng quá dài (> 254 sau chuẩn hoá).
const tooLongEmailArb = fc
  .integer({ min: MAX_INVITE_EMAIL_LENGTH - 8, max: MAX_INVITE_EMAIL_LENGTH + 40 })
  .map((localLen) => `${'a'.repeat(Math.max(1, localLen))}@example.com`)
  .filter((e) => normalizeGroupEmail(e).length > MAX_INVITE_EMAIL_LENGTH);

// Email đầu vào bất kỳ (có thể kèm khoảng trắng/hoa thường để kiểm chuẩn hoá).
const anyEmailArb = fc.oneof(
  { weight: 4, arbitrary: validEmailArb },
  { weight: 2, arbitrary: validEmailArb.map((e) => `  ${e.toUpperCase()}  `) },
  { weight: 2, arbitrary: invalidFormatArb },
  { weight: 1, arbitrary: tooLongEmailArb },
  { weight: 1, arbitrary: whitespaceArb },
  { weight: 1, arbitrary: fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant('')) },
);

// Danh sách email (member/pending) bất kỳ.
const emailListArb = fc.array(
  fc.oneof(validEmailArb, validEmailArb.map((e) => ` ${e.toUpperCase()} `), invalidFormatArb, fc.constant('')),
  { maxLength: 8 },
);

// maxPending: số hữu hạn, số không hợp lệ (NaN/Infinity -> fallback), hoặc âm.
const maxPendingArb = fc.oneof(
  fc.integer({ min: 0, max: 120 }),
  fc.constantFrom(null, undefined, NaN, Infinity, -Infinity, 'abc'),
  fc.integer({ min: -5, max: -1 }),
);

// --- Property 12 (tổng quát) ------------------------------------------------

describe('Property 12 — validateInviteEmail chấp nhận iff hợp lệ theo mọi điều kiện (Requirements 8.2–8.6)', () => {
  it('khớp oracle: valid, reason, và email (đã chuẩn hoá) trên toàn không gian đầu vào', () => {
    fc.assert(
      fc.property(anyEmailArb, emailListArb, emailListArb, maxPendingArb, (email, members, pending, maxPending) => {
        const result = validateInviteEmail(email, members, pending, maxPending);
        const expected = refValidate(email, members, pending, maxPending);

        expect(result.valid).toBe(expected.valid);
        if (expected.valid) {
          expect(result.reason).toBeUndefined();
          // Email trả về luôn là bản đã chuẩn hoá (trim + lowercase).
          expect(result.email).toBe(normalizeGroupEmail(email));
        } else {
          expect(result.reason).toBe(expected.reason);
        }
      }),
      { numRuns: 300 },
    );
  });

  // --- Các trường hợp cần bao phủ (theo yêu cầu task) -----------------------

  it('email rỗng hoặc toàn khoảng trắng → reason "empty" (Req 8.3)', () => {
    fc.assert(
      fc.property(whitespaceArb, emailListArb, emailListArb, (ws, members, pending) => {
        const result = validateInviteEmail(ws, members, pending, MAX_PENDING_INVITES);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('empty');
      }),
      { numRuns: 150 },
    );
  });

  it('email > 254 ký tự → reason "too_long" (Req 8.3)', () => {
    fc.assert(
      fc.property(tooLongEmailArb, emailListArb, emailListArb, (email, members, pending) => {
        const result = validateInviteEmail(email, members, pending, MAX_PENDING_INVITES);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('too_long');
      }),
      { numRuns: 150 },
    );
  });

  it('email sai định dạng (khác rỗng, độ dài hợp lệ) → reason "invalid_format" (Req 8.4)', () => {
    fc.assert(
      fc.property(invalidFormatArb, emailListArb, emailListArb, (email, members, pending) => {
        const result = validateInviteEmail(email, members, pending, MAX_PENDING_INVITES);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('invalid_format');
      }),
      { numRuns: 200 },
    );
  });

  it('đạt giới hạn pending (length >= maxPending) → reason "limit_reached" (Req 8.5)', () => {
    fc.assert(
      fc.property(
        validEmailArb,
        fc.integer({ min: 0, max: 20 }),
        (email, limit) => {
          // Dựng đúng `limit` email pending khác hẳn email đang mời.
          const pending = Array.from({ length: limit }, (_, i) => `pending${i}@example.com`);
          const normalized = normalizeGroupEmail(email);
          fc.pre(!pending.includes(normalized));
          // members không chứa email để không "che" reason limit_reached.
          const result = validateInviteEmail(email, [], pending, limit);
          expect(result.valid).toBe(false);
          expect(result.reason).toBe('limit_reached');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('email trùng thành viên (chưa đạt giới hạn) → reason "already_member" (Req 8.6)', () => {
    fc.assert(
      fc.property(validEmailArb, emailListArb, fc.constantFrom('same', 'upper', 'pad'), (email, extras, mode) => {
        const normalized = normalizeGroupEmail(email);
        let variant = normalized;
        if (mode === 'upper') variant = normalized.toUpperCase();
        else if (mode === 'pad') variant = `  ${normalized}  `;
        const members = [...extras, variant];
        // pending không chứa email và giới hạn đủ rộng để không kích hoạt limit_reached.
        const result = validateInviteEmail(email, members, [], MAX_PENDING_INVITES);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('already_member');
      }),
      { numRuns: 200 },
    );
  });

  it('email trùng lời mời đang chờ (không trùng member, chưa đạt giới hạn) → reason "already_pending" (Req 8.6)', () => {
    fc.assert(
      fc.property(validEmailArb, fc.constantFrom('same', 'upper', 'pad'), (email, mode) => {
        const normalized = normalizeGroupEmail(email);
        let variant = normalized;
        if (mode === 'upper') variant = normalized.toUpperCase();
        else if (mode === 'pad') variant = `  ${normalized}  `;
        const pending = ['other1@example.com', variant, 'other2@example.com'];
        // Giới hạn > số pending để không kích hoạt limit_reached, members rỗng.
        const result = validateInviteEmail(email, [], pending, MAX_PENDING_INVITES);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('already_pending');
      }),
      { numRuns: 200 },
    );
  });

  it('email hợp lệ mới (đúng định dạng, không trùng, chưa đạt giới hạn) → valid + email chuẩn hoá (Req 8.2)', () => {
    fc.assert(
      fc.property(validEmailArb, (email) => {
        const normalized = normalizeGroupEmail(email);
        // members/pending chứa các email khác hẳn để không gây trùng.
        const members = ['m1@example.com', 'm2@example.com'].filter((e) => e !== normalized);
        const pending = ['p1@example.com', 'p2@example.com'].filter((e) => e !== normalized);
        const result = validateInviteEmail(email, members, pending, MAX_PENDING_INVITES);
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
        expect(result.email).toBe(normalized);
      }),
      { numRuns: 200 },
    );
  });

  it('bất biến chuẩn hoá: hoa/thường và khoảng trắng đầu cuối không đổi kết quả', () => {
    fc.assert(
      fc.property(validEmailArb, emailListArb, emailListArb, maxPendingArb, (email, members, pending, maxPending) => {
        const normalized = normalizeGroupEmail(email);
        const padded = `  ${normalized.toUpperCase()}  `;
        const a = validateInviteEmail(normalized, members, pending, maxPending);
        const b = validateInviteEmail(padded, members, pending, maxPending);
        expect(b.valid).toBe(a.valid);
        expect(b.reason).toBe(a.reason);
        expect(b.email).toBe(a.email);
      }),
      { numRuns: 200 },
    );
  });
});
