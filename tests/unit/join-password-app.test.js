const { loadDesktopApp } = require('../helpers/ui-loader.cjs');

// Nạp desktop-app.js với stub nghiệp vụ/toast để kiểm tra wiring UI.
function loadWithStubs(stubs = {}) {
  const toasts = [];
  const elements = {};
  const globals = {
    showToast: (msg, type) => toasts.push({ msg, type }),
    closeModal: () => {},
    openModal: () => {},
    openGroupDetail: () => {},
    renderGroupDetail: () => {},
    getGroupById: () => ({ id: 'g1', role: 'owner' }),
    confirmAction: async () => true,
    acceptGroupInvite: async () => true,
    setGroupJoinPassword: async () => true,
    removeGroupJoinPassword: async () => true,
    ...stubs,
  };
  const { exports, sandbox } = loadDesktopApp({ globals, elements });
  return { exports, sandbox, toasts, elements };
}

describe('Join_Password wiring desktop-app (Req 2.3, 5.5, 6.3)', () => {
  it('submitJoinPassword thành công → toast xác nhận cập nhật', async () => {
    const { exports, elements, toasts } = loadWithStubs();
    elements['group-join-password'] = { value: 'matkhau123' };
    elements['group-join-password-confirm'] = { value: 'matkhau123' };
    await exports.submitJoinPassword('g1');
    expect(toasts.some(t => t.type === 'success' && /mật khẩu vào nhóm/i.test(t.msg))).toBe(true);
  });

  it('submitJoinPassword nhập lại lệch → toast lỗi, không gọi setGroupJoinPassword', async () => {
    let called = false;
    const { exports, elements, toasts } = loadWithStubs({
      setGroupJoinPassword: async () => { called = true; return true; },
    });
    elements['group-join-password'] = { value: 'matkhau123' };
    elements['group-join-password-confirm'] = { value: 'khac123456' };
    await exports.submitJoinPassword('g1');
    expect(called).toBe(false);
    expect(toasts.some(t => t.type === 'error')).toBe(true);
  });

  it('submitAcceptGroupInvite sai mật khẩu → toast lỗi và GIỮ nguyên nội dung ô nhập (Req 5.5)', async () => {
    const { exports, elements, toasts } = loadWithStubs({
      acceptGroupInvite: async () => { throw new Error('Mật khẩu vào nhóm không đúng'); },
    });
    const input = { value: 'saibet' };
    elements['group-invite-join-password'] = input;
    await exports.submitAcceptGroupInvite('g1');
    expect(toasts.some(t => t.type === 'error')).toBe(true);
    // Không xoá nội dung ô nhập để người dùng thử lại.
    expect(input.value).toBe('saibet');
  });

  it('handleRemoveGroupJoinPassword xác nhận → toast đã gỡ', async () => {
    const { exports, toasts } = loadWithStubs();
    await exports.handleRemoveGroupJoinPassword('g1');
    expect(toasts.some(t => t.type === 'success' && /gỡ/i.test(t.msg))).toBe(true);
  });

  it('updateAcceptGroupInviteButton bật/tắt nút theo giá trị đã trim', () => {
    const { exports, elements } = loadWithStubs();
    const input = { value: '   ' };
    const btn = { disabled: false };
    elements['group-invite-join-password'] = input;
    elements['group-invite-submit'] = btn;
    exports.updateAcceptGroupInviteButton('g1');
    expect(btn.disabled).toBe(true);

    input.value = '  abc  ';
    exports.updateAcceptGroupInviteButton('g1');
    expect(btn.disabled).toBe(false);
  });
});
