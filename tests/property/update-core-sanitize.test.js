// ============================================================================
// Property-based test cho Update_Core.sanitizeUpdateMessage (`js/shared/update-core.js`).
//
// Feature: auto-update-system, Property 7: Làm sạch thông báo lỗi loại bỏ
// token/credential — For any chuỗi thông báo lỗi có chứa mẫu token GitHub
// (gh[opsu]_...), set-cookie, hoặc response header nhạy cảm, chuỗi trả về từ
// sanitizeUpdateMessage không còn chứa token/credential đó và là một thông báo
// tiếng Việt an toàn để hiển thị.
//
// Validates: Requirements 6.6
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fc = require('fast-check');
const UpdateCore = require('../../js/shared/update-core.js');

const { sanitizeUpdateMessage, SAFE_UPDATE_MESSAGE } = UpdateCore;

// --- Generators -------------------------------------------------------------

// Ký tự hợp lệ cho phần thân token GitHub theo GITHUB_TOKEN_PATTERN: [A-Za-z0-9_].
const TOKEN_BODY_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_'.split('');

// Token GitHub dạng gh[opsu]_<body>, ví dụ ghp_..., gho_..., ghs_..., ghu_...
const githubTokenArb = fc
  .tuple(
    fc.constantFrom('o', 'p', 's', 'u'),
    fc.stringOf(fc.constantFrom(...TOKEN_BODY_CHARS), { minLength: 1, maxLength: 40 }),
  )
  .map(([kind, body]) => `gh${kind}_${body}`);

// Các dòng chứa dấu hiệu response header / cookie nhạy cảm (khớp SENSITIVE_MARKERS,
// so khớp không phân biệt hoa/thường). Đây là "credential" cần bị loại bỏ.
const sensitiveCredentialArb = fc.constantFrom(
  'set-cookie: logged_in=yes; Domain=.github.com; SameSite=Lax',
  'Set-Cookie: _gh_sess=SECRETVALUE12345; samesite=lax',
  'logged_in=yes; domain=.github.com',
  'authorization: Bearer super-secret-token-value',
  'Authorization=token abc123secret',
  'không tải được latest.yml từ máy chủ phát hành',
);

// Văn bản bao quanh ngẫu nhiên (mô phỏng thông báo lỗi thật).
const surroundingTextArb = fc.string({ maxLength: 80 });

// --- Helpers ----------------------------------------------------------------

// Ghép credential vào giữa văn bản bao quanh để mô phỏng thông báo lỗi thực tế.
function embed(prefix, credential, suffix) {
  return `${prefix} ${credential} ${suffix}`;
}

describe('Property 7 — sanitizeUpdateMessage loại bỏ token/credential (Requirements 6.6)', () => {
  it('loại bỏ token GitHub gh[opsu]_... khỏi thông báo trả về', () => {
    fc.assert(
      fc.property(
        surroundingTextArb,
        githubTokenArb,
        surroundingTextArb,
        (prefix, token, suffix) => {
          const message = embed(prefix, token, suffix);
          const result = sanitizeUpdateMessage(message);

          // Kết quả luôn là chuỗi và KHÔNG còn chứa token GitHub đã chèn.
          expect(typeof result).toBe('string');
          expect(result.includes(token)).toBe(false);
          // Không còn bất kỳ mẫu token GitHub nào sót lại.
          expect(/gh[opsu]_[A-Za-z0-9_]+/.test(result)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('thay thông báo chứa set-cookie / header nhạy cảm bằng thông báo an toàn tiếng Việt', () => {
    fc.assert(
      fc.property(
        surroundingTextArb,
        sensitiveCredentialArb,
        surroundingTextArb,
        (prefix, credential, suffix) => {
          const message = embed(prefix, credential, suffix);
          const result = sanitizeUpdateMessage(message);

          // Khi phát hiện dấu hiệu nhạy cảm, trả về đúng thông báo chung an toàn.
          expect(result).toBe(SAFE_UPDATE_MESSAGE);
          // Thông báo an toàn không chứa credential đã chèn.
          expect(result.includes(credential)).toBe(false);
          // Không rò rỉ dấu hiệu nhạy cảm nào (kiểm tra không phân biệt hoa/thường).
          const lower = result.toLowerCase();
          for (const marker of ['set-cookie', 'logged_in=', 'authorization', 'samesite=', 'latest.yml']) {
            expect(lower.includes(marker)).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('vẫn loại bỏ token GitHub ngay cả khi thông báo có nhiều token', () => {
    fc.assert(
      fc.property(
        fc.array(githubTokenArb, { minLength: 1, maxLength: 5 }),
        surroundingTextArb,
        (tokens, filler) => {
          const message = tokens.join(` ${filler} `);
          const result = sanitizeUpdateMessage(message);

          expect(typeof result).toBe('string');
          for (const token of tokens) {
            expect(result.includes(token)).toBe(false);
          }
          expect(/gh[opsu]_[A-Za-z0-9_]+/.test(result)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});
