const { createEnv } = require('../helpers/join-password-env.cjs');

function makeGroup(extra = {}) {
  return {
    id: 'g1', name: 'N', ownerUid: 'owner-1', ownerEmail: 'owner@example.com',
    memberEmails: ['owner@example.com'], pendingMemberEmails: [],
    sharedPwHash: 'S', sharedPwSalt: 'T', role: 'owner', ...extra,
  };
}

describe('Join_Password rollback khi lưu lỗi/offline (Req 1.5, 3.4, 8.5)', () => {
  it('set thất bại (Firestore lỗi) → khôi phục hash/salt cũ và ném lỗi', async () => {
    const env = createEnv({ isDemo: false, failUpdate: true, user: { uid: 'owner-1', email: 'owner@example.com' } });
    const group = makeGroup();
    env.appState.groups = [group];
    await expect(env.groups.setGroupJoinPassword('g1', 'matkhau123')).rejects.toThrow();
    // Nhóm ban đầu Disabled → sau rollback vẫn Disabled.
    expect(group.joinPwHash).toBeUndefined();
    expect(group.joinPwSalt).toBeUndefined();
  });

  it('remove thất bại (Firestore lỗi) → giữ nguyên hash/salt và ném lỗi', async () => {
    const env = createEnv({ isDemo: false, failUpdate: true, user: { uid: 'owner-1', email: 'owner@example.com' } });
    const group = makeGroup({ joinPwHash: 'HASH', joinPwSalt: 'SALT' });
    env.appState.groups = [group];
    await expect(env.groups.removeGroupJoinPassword('g1')).rejects.toThrow();
    expect(group.joinPwHash).toBe('HASH');
    expect(group.joinPwSalt).toBe('SALT');
  });

  it('set khi offline (update treo quá 10s) → timeout, rollback và ném lỗi', async () => {
    const env = createEnv({ isDemo: false, hangUpdate: true, user: { uid: 'owner-1', email: 'owner@example.com' } });
    const group = makeGroup();
    env.appState.groups = [group];
    await expect(env.groups.setGroupJoinPassword('g1', 'matkhau123')).rejects.toThrow();
    expect(group.joinPwHash).toBeUndefined();
    expect(group.joinPwSalt).toBeUndefined();
  }, 20000);
});
