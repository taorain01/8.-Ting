const fc = require('fast-check');
const { createEnv } = require('../helpers/join-password-env.cjs');

const validJoinPassword = fc.string({ minLength: 6, maxLength: 128 })
  .filter(s => s.length >= 6 && s.length <= 128);

const invalidLengthString = fc.oneof(
  fc.string({ minLength: 0, maxLength: 5 }).filter(s => s.length <= 5),
  fc.string({ minLength: 129, maxLength: 200 }).filter(s => s.length >= 129),
);

// Khác nhau kể cả sau khi trim (vì set/verify đều thao tác trên giá trị đã trim).
const distinctValidPair = fc.tuple(validJoinPassword, validJoinPassword)
  .filter(([a, b]) => a.trim() !== b.trim() && a.trim().length >= 6 && b.trim().length >= 6);

// Cặp uid (owner, actor) gồm cả trường hợp bằng và khác nhau.
const uidPair = fc.tuple(
  fc.string({ minLength: 1, maxLength: 16 }),
  fc.string({ minLength: 1, maxLength: 16 }),
);

const TIMEOUT = 120000;

// Tạo môi trường demo với một nhóm mà người dùng hiện tại là chủ.
function envWithOwnedGroup(overrides = {}) {
  const env = createEnv({ user: { uid: 'owner-1', email: 'owner@example.com' } });
  const group = {
    id: 'g1',
    name: 'Nhóm test',
    ownerUid: 'owner-1',
    ownerEmail: 'owner@example.com',
    memberEmails: ['owner@example.com'],
    pendingMemberEmails: [],
    sharedPwHash: 'SHARED_HASH',
    sharedPwSalt: 'SHARED_SALT',
    role: 'owner',
    ...overrides,
  };
  env.appState.groups = [group];
  return { ...env, group };
}

describe('Join_Password quản lý (đặt/đổi/gỡ)', () => {
  // **Feature: group-password, Property 1: Đặt Join_Password hợp lệ chuyển nhóm sang Enabled và lưu an toàn**
  it('đặt Join_Password hợp lệ → Enabled, hash/salt không rỗng và không lưu mật khẩu dạng rõ', async () => {
    await fc.assert(
      fc.asyncProperty(validJoinPassword, async (pw) => {
        const { groups, group } = envWithOwnedGroup();
        await groups.setGroupJoinPassword('g1', pw);
        expect(groups.isJoinPasswordEnabled(group)).toBe(true);
        expect(group.joinPwHash).toBeTruthy();
        expect(group.joinPwSalt).toBeTruthy();
        // Không trường nào chứa mật khẩu dạng rõ.
        for (const value of Object.values(group)) {
          if (typeof value === 'string') expect(value).not.toBe(pw);
        }
      }),
      { numRuns: 100 },
    );
  }, TIMEOUT);

  // **Feature: group-password, Property 2: Mỗi lần lưu sinh salt duy nhất**
  it('đặt cùng một giá trị trên hai lần lưu độc lập → salt và hash khác nhau', async () => {
    await fc.assert(
      fc.asyncProperty(validJoinPassword, async (pw) => {
        const a = envWithOwnedGroup();
        await a.groups.setGroupJoinPassword('g1', pw);
        const b = envWithOwnedGroup();
        await b.groups.setGroupJoinPassword('g1', pw);
        expect(a.group.joinPwSalt).not.toBe(b.group.joinPwSalt);
        expect(a.group.joinPwHash).not.toBe(b.group.joinPwHash);
      }),
      { numRuns: 60 },
    );
  }, TIMEOUT);

  // **Feature: group-password, Property 8: Từ chối Join_Password có độ dài không hợp lệ**
  it('đặt/đổi bằng chuỗi độ dài không hợp lệ SHALL bị từ chối, giữ nguyên hash/salt', async () => {
    await fc.assert(
      fc.asyncProperty(invalidLengthString, async (bad) => {
        const { groups, group } = envWithOwnedGroup();
        const before = { hash: group.joinPwHash, salt: group.joinPwSalt };
        await expect(groups.setGroupJoinPassword('g1', bad)).rejects.toThrow();
        expect(group.joinPwHash).toBe(before.hash);
        expect(group.joinPwSalt).toBe(before.salt);
      }),
      { numRuns: 100 },
    );
  }, TIMEOUT);

  // **Feature: group-password, Property 6: Đổi Join_Password thu hồi mật khẩu cũ**
  it('sau khi đổi: xác minh mật khẩu mới khớp, mật khẩu cũ không khớp', async () => {
    await fc.assert(
      fc.asyncProperty(distinctValidPair, async ([oldPw, newPw]) => {
        const { groups, group } = envWithOwnedGroup();
        await groups.setGroupJoinPassword('g1', oldPw);
        await groups.setGroupJoinPassword('g1', newPw);
        expect(await groups.verifyGroupJoinPassword(group, newPw)).toBe(true);
        expect(await groups.verifyGroupJoinPassword(group, oldPw)).toBe(false);
      }),
      { numRuns: 40 },
    );
  }, TIMEOUT);

  // **Feature: group-password, Property 9: Chỉ chủ nhóm được quản lý Join_Password**
  it('uid !== ownerUid → set/change/remove bị từ chối; quyền được cấp ⟺ uid === ownerUid', async () => {
    await fc.assert(
      fc.asyncProperty(uidPair, validJoinPassword, async ([ownerUid, actorUid], pw) => {
        const env = createEnv({ user: { uid: actorUid, email: 'actor@example.com' } });
        const group = {
          id: 'g1', name: 'N', ownerUid, ownerEmail: 'owner@example.com',
          memberEmails: [], pendingMemberEmails: [],
          sharedPwHash: 'S', sharedPwSalt: 'T', role: actorUid === ownerUid ? 'owner' : 'member',
        };
        env.appState.groups = [group];
        if (actorUid === ownerUid) {
          await env.groups.setGroupJoinPassword('g1', pw);
          expect(env.groups.isJoinPasswordEnabled(group)).toBe(true);
        } else {
          await expect(env.groups.setGroupJoinPassword('g1', pw)).rejects.toThrow();
          await expect(env.groups.removeGroupJoinPassword('g1')).rejects.toThrow();
          expect(group.joinPwHash).toBeUndefined();
          expect(group.joinPwSalt).toBeUndefined();
        }
      }),
      { numRuns: 60 },
    );
  }, TIMEOUT);

  // **Feature: group-password, Property 14: Quản lý Join_Password không thay đổi Shared_Password**
  it('mọi thao tác set/change/remove giữ nguyên sharedPwHash và sharedPwSalt', async () => {
    await fc.assert(
      fc.asyncProperty(distinctValidPair, async ([p1, p2]) => {
        const { groups, group } = envWithOwnedGroup();
        const sh = group.sharedPwHash;
        const ss = group.sharedPwSalt;
        await groups.setGroupJoinPassword('g1', p1);
        expect(group.sharedPwHash).toBe(sh);
        expect(group.sharedPwSalt).toBe(ss);
        await groups.setGroupJoinPassword('g1', p2);
        expect(group.sharedPwHash).toBe(sh);
        expect(group.sharedPwSalt).toBe(ss);
        await groups.removeGroupJoinPassword('g1');
        expect(group.sharedPwHash).toBe(sh);
        expect(group.sharedPwSalt).toBe(ss);
      }),
      { numRuns: 40 },
    );
  }, TIMEOUT);
});
