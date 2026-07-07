const { loadDesktopApp } = require('../helpers/ui-loader.cjs');

// Nạp js/desktop-app.js trong vm sandbox với renderAccountList là một spy.
// File tự khởi tạo window.appState = {..., showExpired: { bought: false, personal: false }},
// nên mỗi lần loadApp() tương đương một lần "khởi động lại app" với state mới.
function loadApp() {
  const renderCalls = [];
  const globals = {
    // Spy thay cho renderAccountList (định nghĩa thật ở desktop-ui.js, không nạp ở đây).
    renderAccountList: (type) => { renderCalls.push(type); },
  };
  const { exports, sandbox } = loadDesktopApp({ globals });
  return { exports, sandbox, renderCalls };
}

describe('Trang_Thai_Hien_Het_Han: khởi tạo/ghi nhớ theo phiên và toggle (Req 3.5, 4.1, 4.2, 4.4, 4.5)', () => {
  it('mặc định TẮT cho cả bought và personal khi mở app lần đầu (Req 4.1)', () => {
    const { exports, sandbox } = loadApp();
    expect(exports.getShowExpiredState('bought')).toBe(false);
    expect(exports.getShowExpiredState('personal')).toBe(false);
    // State được lưu trong window.appState theo phiên.
    expect(sandbox.window.appState.showExpired).toEqual({ bought: false, personal: false });
  });

  it('toggleShowExpired("bought") bật cờ bought sang true, KHÔNG đổi personal (độc lập — Req 4.4)', () => {
    const { exports, sandbox } = loadApp();
    sandbox.window.appState.currentPage = 'bought';

    exports.toggleShowExpired('bought');
    expect(exports.getShowExpiredState('bought')).toBe(true);
    expect(exports.getShowExpiredState('personal')).toBe(false);
  });

  it('hai cờ màn hình hoàn toàn độc lập với nhau (Req 4.4)', () => {
    const { exports, sandbox } = loadApp();
    sandbox.window.appState.currentPage = 'bought';
    exports.toggleShowExpired('bought'); // bought: true, personal: false
    expect(exports.getShowExpiredState('bought')).toBe(true);
    expect(exports.getShowExpiredState('personal')).toBe(false);

    sandbox.window.appState.currentPage = 'personal';
    exports.toggleShowExpired('personal'); // bought: true, personal: true
    expect(exports.getShowExpiredState('bought')).toBe(true);
    expect(exports.getShowExpiredState('personal')).toBe(true);

    sandbox.window.appState.currentPage = 'bought';
    exports.toggleShowExpired('bought'); // bought: false, personal: true
    expect(exports.getShowExpiredState('bought')).toBe(false);
    expect(exports.getShowExpiredState('personal')).toBe(true);
  });

  it('đảo cờ hai lần trở về trạng thái ban đầu (Req 3.5)', () => {
    const { exports, sandbox } = loadApp();
    sandbox.window.appState.currentPage = 'bought';

    const before = exports.getShowExpiredState('bought');
    exports.toggleShowExpired('bought');
    exports.toggleShowExpired('bought');
    expect(exports.getShowExpiredState('bought')).toBe(before);
    expect(exports.getShowExpiredState('bought')).toBe(false);
  });

  it('chỉ render lại đúng type đang hiển thị khi toggle (Req 3.5)', () => {
    const { exports, sandbox, renderCalls } = loadApp();

    // Đang ở màn hình 'bought': toggle('bought') phải render lại đúng 'bought'.
    sandbox.window.appState.currentPage = 'bought';
    exports.toggleShowExpired('bought');
    expect(renderCalls).toEqual(['bought']);

    // Đang ở 'personal' nhưng toggle cờ của 'bought': KHÔNG render lại (không tác động màn hình khác).
    sandbox.window.appState.currentPage = 'personal';
    exports.toggleShowExpired('bought');
    expect(renderCalls).toEqual(['bought']); // không thêm lời gọi mới

    // toggle('personal') khi đang ở 'personal' → render lại đúng 'personal'.
    exports.toggleShowExpired('personal');
    expect(renderCalls).toEqual(['bought', 'personal']);
  });

  it('giữ nguyên cờ qua nhiều lần điều hướng trong cùng phiên (Req 4.2, 4.5)', () => {
    const { exports, sandbox } = loadApp();
    sandbox.window.appState.currentPage = 'bought';
    exports.toggleShowExpired('bought'); // bought: true

    // Mô phỏng rời khỏi rồi quay lại nhiều lần bằng cách đổi currentPage.
    for (const page of ['dashboard', 'personal', 'trash', 'bought', 'settings', 'bought']) {
      sandbox.window.appState.currentPage = page;
      // Chỉ đọc cờ, không thao tác toggle → giá trị phải giữ nguyên.
      expect(exports.getShowExpiredState('bought')).toBe(true);
    }
    expect(exports.getShowExpiredState('personal')).toBe(false);
  });

  it('reset về TẮT khi "khởi động lại app" (nạp lại module → appState mới, Req 4.2)', () => {
    // Phiên 1: bật cờ bought và personal.
    const first = loadApp();
    first.sandbox.window.appState.currentPage = 'bought';
    first.exports.toggleShowExpired('bought');
    first.sandbox.window.appState.currentPage = 'personal';
    first.exports.toggleShowExpired('personal');
    expect(first.exports.getShowExpiredState('bought')).toBe(true);
    expect(first.exports.getShowExpiredState('personal')).toBe(true);

    // Phiên 2: nạp lại module (tương đương đóng và mở lại app) → mặc định TẮT lại.
    const second = loadApp();
    expect(second.exports.getShowExpiredState('bought')).toBe(false);
    expect(second.exports.getShowExpiredState('personal')).toBe(false);
  });

  it('toggle với type không hợp lệ không làm hỏng state (biên)', () => {
    const { exports, sandbox } = loadApp();
    exports.toggleShowExpired('unknown');
    expect(sandbox.window.appState.showExpired).toEqual({ bought: false, personal: false });
    expect(exports.getShowExpiredState('unknown')).toBe(false);
  });
});
