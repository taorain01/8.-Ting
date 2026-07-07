const { loadDesktopApp } = require('../helpers/ui-loader.cjs');

// Task 2.4 — Kiểm thử nhánh khôi phục của restoreAccount(id) trong js/desktop-app.js.
// Nhánh non-demo gọi restoreAccountFromDB(id) trong try/catch:
//  - trả true  => toast success, không đổi trashAccounts trong hàm (listener xử lý sau)
//  - trả false => KHÔNG đổi trashAccounts, toast lỗi 'Khôi phục không thành công'
//  - ném lỗi   => KHÔNG đổi trashAccounts, toast lỗi 'Khôi phục không thành công'
// _Requirements: 1.6, 1.7_

// Nạp desktop-app.js với appState + các stub nghiệp vụ cần thiết cho restoreAccount.
function loadWithStubs({ restoreImpl } = {}) {
  const toasts = [];
  // Một tài khoản đã xoá mềm nằm trong thùng rác; isDemo=false để đi vào nhánh non-demo.
  const trashAccount = {
    id: 'acc-1',
    platform: 'Netflix',
    expiryDate: '2099-01-01',
    expiryType: 'fixed',
    deletedAt: Date.now(),
  };
  const calls = { restore: [] };
  const globals = {
    showToast: (msg, type) => toasts.push({ msg, type }),
    getStatusFromExpiry: () => 'active',
    renderTrashList: () => {},
    // updateHeader được định nghĩa trong desktop-app.js; chỉ dùng ở nhánh demo nên không ảnh hưởng.
    restoreAccountFromDB: async (id) => {
      calls.restore.push(id);
      return restoreImpl ? restoreImpl(id) : true;
    },
  };

  const { exports, sandbox } = loadDesktopApp({ globals });
  // desktop-app.js tự khởi tạo window.appState ở top-level khi eval, nên phải
  // cấu hình lại state SAU khi nạp để đi vào đúng nhánh non-demo với 1 tài khoản trong thùng rác.
  const appState = sandbox.window.appState;
  appState.isDemo = false;
  appState.accounts = [];
  appState.trashAccounts = [trashAccount];
  return { exports, sandbox, toasts, calls, appState, trashAccount };
}

describe('restoreAccount — nhánh khôi phục (Req 1.6, 1.7)', () => {
  it('restoreAccountFromDB trả true → gọi đúng restoreAccountFromDB(id) và toast success', async () => {
    const { exports, toasts, calls } = loadWithStubs({ restoreImpl: () => true });

    await exports.restoreAccount('acc-1');

    // Gọi đúng hàm lưu trữ với đúng id.
    expect(calls.restore).toEqual(['acc-1']);
    // Toast thành công.
    expect(toasts.some(t => t.type === 'success' && /khôi phục/i.test(t.msg))).toBe(true);
    // Không có toast lỗi.
    expect(toasts.some(t => t.type === 'error')).toBe(false);
  });

  it('restoreAccountFromDB trả false → giữ nguyên trashAccounts và toast lỗi', async () => {
    const { exports, toasts, calls, appState, trashAccount } = loadWithStubs({
      restoreImpl: () => false,
    });

    await exports.restoreAccount('acc-1');

    // Vẫn gọi tầng lưu trữ với đúng id.
    expect(calls.restore).toEqual(['acc-1']);
    // trashAccounts giữ nguyên: tài khoản vẫn còn.
    expect(appState.trashAccounts).toContain(trashAccount);
    expect(appState.trashAccounts.some(a => a.id === 'acc-1')).toBe(true);
    // Toast lỗi hiển thị.
    expect(toasts.some(t => t.type === 'error' && /không thành công/i.test(t.msg))).toBe(true);
    // Không có toast success.
    expect(toasts.some(t => t.type === 'success')).toBe(false);
  });

  it('restoreAccountFromDB ném lỗi → giữ nguyên trashAccounts và toast lỗi', async () => {
    const { exports, toasts, calls, appState, trashAccount } = loadWithStubs({
      restoreImpl: () => { throw new Error('Lỗi mạng'); },
    });

    await exports.restoreAccount('acc-1');

    // Vẫn gọi tầng lưu trữ với đúng id trước khi ném lỗi.
    expect(calls.restore).toEqual(['acc-1']);
    // trashAccounts giữ nguyên: tài khoản vẫn còn.
    expect(appState.trashAccounts).toContain(trashAccount);
    expect(appState.trashAccounts.some(a => a.id === 'acc-1')).toBe(true);
    // Toast lỗi hiển thị.
    expect(toasts.some(t => t.type === 'error' && /không thành công/i.test(t.msg))).toBe(true);
    // Không có toast success.
    expect(toasts.some(t => t.type === 'success')).toBe(false);
  });
});
