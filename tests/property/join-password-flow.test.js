const fc = require('fast-check');
const { createEnv } = require('../helpers/join-password-env.cjs');

const validJoinPassword = fc.string({ minLength: 6, maxLength: 128 })
  .filter(s => s.trim().length >= 6 && s.length <= 128);

const whitespaceOnly = fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 8 });

const TIMEOUT = 120000;
const INVITEE = { uid: 'invitee-1', email: 'invitee@example.com' };

// Tạo nhóm đã bật Join_Password (có shared password để KHÔNG tự mở khoá).
async function makeEnabledInviteEnv(pw) {
  const env = createEnv({ user: INVITEE });
  const salt = env.cryptoFns.generateSalt();
  // Băm giá trị đã trim để khớp với hành vi của setGroupJoinPassword.
  const hash = await env.cryptoFns.hashJoinPassword(pw.trim(), salt);
  const group = {
    id: 'g1', name: 'N', ownerUid: 'owner-x', ownerEmail: 'owner@example.com',
    memberEmails: [], pendingMemberEmails: [INVITEE.email],
    sharedPwHash: 'S', sharedPwSalt: 'T',
    joinPwHash: hash, joinPwSalt: salt, role: 'invited',
  };
  env.appState.groups = [group];
  env.appState.groupInvites = [group];
  return { ...env, group };
}

describe('Join_Password luồng tham gia', () => {
  // **Feature: group-password, Property 10: Tham gia thành công khi nhập đúng Join_Password**
  it('nhập đúng P (sau trim) → email vào memberEmails, khỏi pendingMemberEmails', async () => {
    await fc.assert(
      fc.asyncProperty(validJoinPassword, async (pw) => {
        const { groups, group } = await makeEnabledInviteEnv(pw);
        await groups.acceptGroupInvite('g1', pw);
        expect(group.memberEmails).toContain(INVITEE.email);
        expect(group.pendingMemberEmails).not.toContain(INVITEE.email);
      }),
      { numRuns: 40 },
    );
  }, TIMEOUT);

  // **Feature: group-password, Property 11: Tham gia bị từ chối khi nhập sai hoặc rỗng Join_Password**
  it('nhập sai hoặc chỉ khoảng trắng → bị từ chối, email vẫn ở pendingMemberEmails', async () => {
    const badCandidate = fc.oneof(
      whitespaceOnly,
      fc.string({ minLength: 1, maxLength: 40 }),
    );
    await fc.assert(
      fc.asyncProperty(validJoinPassword, badCandidate, async (pw, bad) => {
        // Đảm bảo "bad" không khớp P sau khi trim.
        fc.pre(bad.trim() !== pw.trim());
        const { groups, group } = await makeEnabledInviteEnv(pw);
        await expect(groups.acceptGroupInvite('g1', bad)).rejects.toThrow();
        expect(group.pendingMemberEmails).toContain(INVITEE.email);
        expect(group.memberEmails).not.toContain(INVITEE.email);
      }),
      { numRuns: 40 },
    );
  }, TIMEOUT);

  // **Feature: group-password, Property 7: Gỡ Join_Password đưa về Disabled và cho phép join không mật khẩu**
  it('Owner gỡ → Disabled, verify mọi chuỗi không khớp, Invited_User join không cần mật khẩu', async () => {
    await fc.assert(
      fc.asyncProperty(validJoinPassword, fc.string({ maxLength: 30 }), async (pw, anyStr) => {
        // Owner đặt rồi gỡ.
        const owner = createEnv({ user: { uid: 'owner-x', email: 'owner@example.com' } });
        const group = {
          id: 'g1', name: 'N', ownerUid: 'owner-x', ownerEmail: 'owner@example.com',
          memberEmails: [], pendingMemberEmails: [INVITEE.email],
          sharedPwHash: 'S', sharedPwSalt: 'T', role: 'owner',
        };
        owner.appState.groups = [group];
        owner.appState.groupInvites = [group];
        await owner.groups.setGroupJoinPassword('g1', pw);
        await owner.groups.removeGroupJoinPassword('g1');

        expect(owner.groups.isJoinPasswordEnabled(group)).toBe(false);
        expect(await owner.groups.verifyGroupJoinPassword(group, anyStr)).toBe(false);

        // Invited_User tham gia không cần mật khẩu.
        owner.appState.user = INVITEE;
        await owner.groups.acceptGroupInvite('g1');
        expect(group.memberEmails).toContain(INVITEE.email);
        expect(group.pendingMemberEmails).not.toContain(INVITEE.email);
      }),
      { numRuns: 30 },
    );
  }, TIMEOUT);

  // **Feature: group-password, Property 13: Tham gia không tự động mở khoá dữ liệu nhạy cảm**
  it('sau khi tham gia bằng P, isGroupUnlocked SHALL trả về false', async () => {
    await fc.assert(
      fc.asyncProperty(validJoinPassword, async (pw) => {
        const { groups } = await makeEnabledInviteEnv(pw);
        await groups.acceptGroupInvite('g1', pw);
        expect(groups.isGroupUnlocked('g1')).toBe(false);
      }),
      { numRuns: 30 },
    );
  }, TIMEOUT);
});
