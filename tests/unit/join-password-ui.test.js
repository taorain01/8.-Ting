const { loadDesktopUi } = require('../helpers/ui-loader.cjs');

// Nạp desktop-ui.js với các stub cần thiết cho render Join_Password.
function render(group, { joinEnabled, hasShared = false, unlocked = false } = {}) {
  const { exports } = loadDesktopUi({
    globals: {
      isJoinPasswordEnabled: () => joinEnabled,
      groupHasSharedPassword: () => hasShared,
      isGroupUnlocked: () => unlocked,
    },
  });
  return exports;
}

describe('Join_Password UI render', () => {
  const ownerGroup = { id: 'g1', name: 'N', role: 'owner', memberEmails: ['a@b.c'], ownerEmail: 'a@b.c' };
  const memberGroup = { id: 'g1', name: 'N', role: 'member', memberEmails: ['a@b.c'], ownerEmail: 'a@b.c' };

  it('chủ nhóm thấy khu quản lý Join_Password; badge "Đã bật" khi Enabled (Req 1.1, 1.6, 2.1, 3.1)', () => {
    const ex = render(ownerGroup, { joinEnabled: true });
    const html = ex.renderGroupSettings(ownerGroup);
    expect(html).toContain('Mật khẩu vào nhóm');
    expect(html).toContain('Đã bật mật khẩu vào nhóm');
    expect(html).toContain('Đổi mật khẩu vào nhóm');
    expect(html).toContain('handleRemoveGroupJoinPassword');
    expect(html).toContain("openJoinPasswordModal('g1','change')");
  });

  it('chủ nhóm chưa đặt: badge "Chưa đặt" và nút "Đặt mật khẩu vào nhóm" (Req 1.6, 3.5)', () => {
    const ex = render(ownerGroup, { joinEnabled: false });
    const html = ex.renderGroupSettings(ownerGroup);
    expect(html).toContain('Chưa đặt mật khẩu vào nhóm');
    expect(html).toContain('Đặt mật khẩu vào nhóm');
    expect(html).toContain("openJoinPasswordModal('g1','set')");
    expect(html).not.toContain('handleRemoveGroupJoinPassword');
  });

  it('người không phải chủ nhóm KHÔNG thấy khu quản lý Join_Password (Req 1.2, 2.1, 3.2)', () => {
    const ex = render(memberGroup, { joinEnabled: true });
    const html = ex.renderGroupSettings(memberGroup);
    expect(html).not.toContain('openJoinPasswordModal');
    expect(html).not.toContain('handleRemoveGroupJoinPassword');
  });

  it('thẻ lời mời: nhóm Enabled hiển thị "Nhập mật khẩu", Disabled hiển thị "Tham gia" (Req 4.3, 5.1)', () => {
    const enabled = render({ id: 'g1', name: 'N', memberEmails: [], ownerEmail: 'o@e.c' }, { joinEnabled: true });
    const enabledHtml = enabled.renderGroupInviteCard({ id: 'g1', name: 'N', memberEmails: [], ownerEmail: 'o@e.c' });
    expect(enabledHtml).toContain('Nhập mật khẩu');

    const disabled = render({ id: 'g1', name: 'N', memberEmails: [], ownerEmail: 'o@e.c' }, { joinEnabled: false });
    const disabledHtml = disabled.renderGroupInviteCard({ id: 'g1', name: 'N', memberEmails: [], ownerEmail: 'o@e.c' });
    expect(disabledHtml).toContain('Tham gia');
    expect(disabledHtml).not.toContain('Nhập mật khẩu');
  });
});
