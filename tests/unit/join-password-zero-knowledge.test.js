const { createEnv } = require('../helpers/join-password-env.cjs');

// Kiểm chứng: quản lý Join_Password KHÔNG ảnh hưởng tới khả năng mở khoá
// dữ liệu nhạy cảm bằng Shared_Password (mô hình zero-knowledge giữ nguyên).
describe('Join_Password độc lập với Shared_Password (Req 9.3, 9.5)', () => {
  const SHARED = 'sharedpass123';

  async function setup() {
    const env = createEnv({ user: { uid: 'owner-1', email: 'owner@example.com' } });
    const sharedPwSalt = env.cryptoFns.generateSalt();
    const sharedPwHash = await env.cryptoFns.hashSharedPassword(SHARED, sharedPwSalt);
    const group = {
      id: 'g1', name: 'N', ownerUid: 'owner-1', ownerEmail: 'owner@example.com',
      memberEmails: ['owner@example.com'], pendingMemberEmails: [],
      sharedPwHash, sharedPwSalt, role: 'owner',
    };
    env.appState.groups = [group];
    return { env, group };
  }

  it('sau khi đặt/đổi/gỡ Join_Password: Shared_Password đúng vẫn mở khoá, sai thì không', async () => {
    const { env, group } = await setup();

    // Trước khi có Join_Password.
    expect(await env.groups.verifyGroupPassword(group, SHARED)).toBe(true);
    expect(await env.groups.verifyGroupPassword(group, 'saibet')).toBe(false);

    // Đặt Join_Password.
    await env.groups.setGroupJoinPassword('g1', 'joinpass123');
    expect(await env.groups.verifyGroupPassword(group, SHARED)).toBe(true);
    expect(await env.groups.verifyGroupPassword(group, 'saibet')).toBe(false);

    // Đổi Join_Password.
    await env.groups.setGroupJoinPassword('g1', 'joinpass456');
    expect(await env.groups.verifyGroupPassword(group, SHARED)).toBe(true);

    // Gỡ Join_Password.
    await env.groups.removeGroupJoinPassword('g1');
    expect(await env.groups.verifyGroupPassword(group, SHARED)).toBe(true);
    expect(await env.groups.verifyGroupPassword(group, 'saibet')).toBe(false);
  }, 60000);
});
