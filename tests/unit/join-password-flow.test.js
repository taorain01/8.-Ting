const { createEnv } = require('../helpers/join-password-env.cjs');

const INVITEE = { uid: 'invitee-1', email: 'invitee@example.com' };

async function makeEnabledInviteEnv(pw) {
  const env = createEnv({ user: INVITEE });
  const salt = env.cryptoFns.generateSalt();
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

describe('Join_Password rate limiting (Req 5.7)', () => {
  it('sai 5 lần → khoá 60s (kèm số giây), hết hạn thì cho thử lại và join thành công', async () => {
    const PW = 'dungmatkhau';
    const { groups, group, sandbox } = await makeEnabledInviteEnv(PW);

    // Giả lập thời gian để kiểm soát cửa sổ khoá.
    let nowMs = 1_000_000;
    const RealDate = sandbox.Date;
    class FakeDate extends RealDate { static now() { return nowMs; } }
    sandbox.Date = FakeDate;

    // 5 lần nhập sai liên tiếp đều bị từ chối vì sai mật khẩu.
    for (let i = 0; i < 5; i += 1) {
      await expect(groups.acceptGroupInvite('g1', 'saibet')).rejects.toThrow('Mật khẩu vào nhóm không đúng');
    }
    // Lần thứ 6 bị khoá — thông báo có kèm số giây.
    await expect(groups.acceptGroupInvite('g1', PW)).rejects.toThrow(/giây/);
    expect(group.memberEmails).not.toContain(INVITEE.email);

    // Sau khi hết 60s, được thử lại và nhập đúng thì tham gia thành công.
    nowMs += 61_000;
    await groups.acceptGroupInvite('g1', PW);
    expect(group.memberEmails).toContain(INVITEE.email);
    expect(group.pendingMemberEmails).not.toContain(INVITEE.email);
  });
});

describe('Join_Password chuyển trạng thái giữa chừng & rollback thành viên', () => {
  it('Owner bật mật khẩu sau khi mời → accept không mật khẩu bị chặn (Req 4.4)', async () => {
    const { createEnv } = require('../helpers/join-password-env.cjs');
    const env = createEnv({ user: INVITEE });
    const group = {
      id: 'g1', name: 'N', ownerUid: 'owner-x', ownerEmail: 'owner@example.com',
      memberEmails: [], pendingMemberEmails: [INVITEE.email], role: 'invited',
    };
    env.appState.groups = [group];
    env.appState.groupInvites = [group];
    // Owner bật Join_Password trước khi invitee hoàn tất join.
    const salt = env.cryptoFns.generateSalt();
    group.joinPwHash = await env.cryptoFns.hashJoinPassword('secret123', salt);
    group.joinPwSalt = salt;
    await expect(env.groups.acceptGroupInvite('g1')).rejects.toThrow('Nhập mật khẩu vào nhóm');
    expect(group.memberEmails).not.toContain(INVITEE.email);
    expect(group.pendingMemberEmails).toContain(INVITEE.email);
  });

  it('cập nhật thành viên thất bại → không thêm vào nhóm, giữ pending (Req 4.5)', async () => {
    const { createEnv } = require('../helpers/join-password-env.cjs');
    const env = createEnv({ isDemo: false, failUpdate: true, user: INVITEE });
    const group = {
      id: 'g1', name: 'N', ownerUid: 'owner-x', ownerEmail: 'owner@example.com',
      memberEmails: [], pendingMemberEmails: [INVITEE.email], role: 'invited',
    };
    env.appState.groups = [group];
    env.appState.groupInvites = [group];
    await expect(env.groups.acceptGroupInvite('g1')).rejects.toThrow();
    expect(group.memberEmails).not.toContain(INVITEE.email);
    expect(group.pendingMemberEmails).toContain(INVITEE.email);
  });
});
