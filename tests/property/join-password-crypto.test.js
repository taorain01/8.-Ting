const fc = require('fast-check');
const { createEnv } = require('../helpers/join-password-env.cjs');

// Generator: Join_Password hợp lệ (độ dài 6..128), có thể chứa khoảng trắng giữa.
const validJoinPassword = fc.string({ minLength: 6, maxLength: 128 })
  .filter(s => s.length >= 6 && s.length <= 128);

// Cặp mật khẩu hợp lệ đã lọc để khác nhau (so sánh sau khi trim vì verify sẽ trim).
const distinctValidPair = fc.tuple(validJoinPassword, validJoinPassword)
  .filter(([a, b]) => a.trim() !== b.trim() && a.trim().length >= 6 && b.trim().length >= 6);

describe('Join_Password crypto wrappers', () => {
  const { cryptoFns } = createEnv();

  // **Feature: group-password, Property 3: Round-trip băm/xác minh Join_Password**
  it('băm rồi xác minh chính giá trị đó SHALL khớp (round-trip)', async () => {
    await fc.assert(
      fc.asyncProperty(validJoinPassword, async (pw) => {
        const salt = cryptoFns.generateSalt();
        const hash = await cryptoFns.hashJoinPassword(pw, salt);
        const ok = await cryptoFns.verifyJoinPassword(pw, hash, salt);
        expect(ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  }, 120000);

  // **Feature: group-password, Property 4: Xác minh phân biệt các mật khẩu khác nhau**
  it('băm P1 rồi xác minh P2 khác P1 SHALL không khớp', async () => {
    await fc.assert(
      fc.asyncProperty(distinctValidPair, async ([p1, p2]) => {
        const salt = cryptoFns.generateSalt();
        const hash = await cryptoFns.hashJoinPassword(p1, salt);
        const ok = await cryptoFns.verifyJoinPassword(p2, hash, salt);
        expect(ok).toBe(false);
      }),
      { numRuns: 100 },
    );
  }, 120000);
});
