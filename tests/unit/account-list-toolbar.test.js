// ============================================================================
// Unit test bố cục thanh công cụ, wiring nút và trạng thái rỗng của
// renderAccountList / mountSearchToolbarButtons / unmountSearchToolbarButtons
// trong js/desktop-ui.js.
//
// Feature: expired-toggle-trash-grouping — Task 4.6
// Kiểm chứng các tiêu chí về bố cục/wiring (không biến thiên theo dữ liệu):
//   2.1  Nut_Hien_Thi_Het_Han ở bên phải tiêu đề, KHÔNG có nút lọc ở đó.
//   2.2  Nut_Loc / Nut_Loc_Nen_Tang nằm trong ô tìm kiếm (#search-toolbar-buttons).
//   2.3  onclick nút lọc gọi toggleFilterPanel().
//   2.4  onclick nút lọc nền tảng gọi togglePlatformPanel().
//   2.8  Các màn khác giữ nguyên topbar → unmountSearchToolbarButtons() làm rỗng nút.
//   3.4  Khi BẬT, thẻ Tai_Khoan_Het_Han có class is-expired-dimmed; còn hạn thì không.
//   3.10 TẮT mà không còn tài khoản còn hạn → hiển thị trạng thái danh sách rỗng.
//   4.6  Quay lại màn hình render lại phản ánh đúng cờ getShowExpiredState.
//
// _Requirements: 2.1, 2.2, 2.3, 2.4, 2.8, 3.4, 3.10, 4.6_
//
// Cách nạp: dùng helper loadDesktopUi với includeUtils=true để có sẵn các hàm
// thuần thật của utils.js (getResolvedPlatform, buildAccountDisplayItems,
// isExpiredAccount, partitionActiveThenExpired, filterAccountsByExpiredToggle, ...)
// trong cùng sandbox với desktop-ui.js. getShowExpiredState (vốn ở desktop-app.js)
// được stub đọc từ chính window.appState.showExpired của phiên test.
// ============================================================================

const { loadDesktopUi } = require('../helpers/ui-loader.cjs');

// Sinh chuỗi ngày YYYY-MM-DD lệch offsetDays ngày so với hôm nay (giờ địa phương).
function dateWithOffset(offsetDays) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Tài khoản còn hạn (fixed, hết hạn còn xa).
function activeAccount(over = {}) {
  return {
    id: 'act-1', type: 'bought', name: 'Spotify Active', platform: 'spotify',
    username: 'user-active', password: 'pw', expiryType: 'fixed',
    expiryDate: dateWithOffset(120), status: 'active', ...over,
  };
}
// Tài khoản hết hạn (fixed, ngày hết hạn trong quá khứ).
function expiredAccount(over = {}) {
  return {
    id: 'exp-1', type: 'bought', name: 'Netflix Expired', platform: 'netflix',
    username: 'user-expired', password: 'pw', expiryType: 'fixed',
    expiryDate: dateWithOffset(-30), status: 'expired', ...over,
  };
}

// Tạo môi trường render: appState + phần tử DOM giả + stub getShowExpiredState.
function setup({ accounts = [], showExpired = { bought: false, personal: false } } = {}) {
  const appState = {
    accounts,
    currentFilter: 'all',
    currentTagFilter: '',
    currentPlatformFilter: '',
    searchQuery: '',
    showExpired,
    expandedGroups: {},
    visibleGroupNotes: {},
    settings: {},
    customCategories: [],
  };
  const elements = {};
  const globals = {
    // getShowExpiredState thật nằm ở desktop-app.js; ở đây đọc trực tiếp cờ phiên.
    getShowExpiredState: (type) => !!(appState.showExpired && appState.showExpired[type]),
    // Các hàm "lá" được gọi KHÔNG guard trong render nhưng nằm ở parser.js/
    // desktop-app.js (không nạp ở đây). Stub tối thiểu vì test này chỉ quan tâm
    // bố cục/wiring/làm mờ, không phải nội dung nền tảng hay mặt nạ bảo mật.
    // Stub trùng tên hàm thật trong desktop-ui.js/utils.js là vô hại: khai báo
    // hàm trong nguồn sẽ ghi đè global khi eval.
    getPlatformEmoji: () => '🔵',
    getRevealedSecret: () => null,
    isFreePlanAccount: () => false,
    getAuthMethod: (acc) => (acc && acc.authMethod) || 'email',
    getStatusBadgeClass: (s) => `badge-${s || ''}`,
    getStatusText: (s) => String(s || ''),
    getMaskedAccountUsername: () => '***',
  };
  const { sandbox, exports } = loadDesktopUi({
    appState, elements, globals, includeUtils: true,
  });
  const getHtml = (id) => (sandbox.__elements[id] ? sandbox.__elements[id].innerHTML : '');
  return { sandbox, exports, appState, getHtml };
}

describe('renderAccountList — bố cục thanh công cụ, wiring, trạng thái rỗng (Task 4.6)', () => {
  it('Nut_Hien_Thi_Het_Han ở list-toolbar-right, KHÔNG có nút lọc ở topbar tiêu đề (2.1)', () => {
    const { exports, getHtml } = setup({ accounts: [activeAccount()] });
    exports.renderAccountList('bought');
    const html = getHtml('page-content');

    // Có vùng bên phải tiêu đề chứa nút toggle.
    expect(html).toContain('list-toolbar-right');
    expect(html).toContain('show-expired-toggle');
    // Nút toggle nằm BÊN TRONG list-toolbar-right (đứng sau, trước khi đóng vùng).
    const rightIdx = html.indexOf('list-toolbar-right');
    const toggleIdx = html.indexOf('show-expired-toggle');
    expect(rightIdx).toBeGreaterThanOrEqual(0);
    expect(toggleIdx).toBeGreaterThan(rightIdx);
    // KHÔNG đặt nút lọc ở vùng tiêu đề (page-content) — chúng ở trong ô tìm kiếm.
    expect(html).not.toContain('toolbar-filter-btn');
    expect(html).not.toContain('toolbar-platform-btn');
  });

  it('Nut_Loc / Nut_Loc_Nen_Tang được chèn vào ô tìm kiếm #search-toolbar-buttons (2.2)', () => {
    const { exports, getHtml } = setup({ accounts: [activeAccount()] });
    exports.renderAccountList('bought');
    const searchHtml = getHtml('search-toolbar-buttons');

    expect(searchHtml).toContain('toolbar-filter-btn');
    expect(searchHtml).toContain('toolbar-platform-btn');
  });

  it('onclick của các nút lọc gọi đúng toggleFilterPanel() và togglePlatformPanel() (2.3, 2.4)', () => {
    const { exports, getHtml } = setup({ accounts: [activeAccount()] });
    exports.renderAccountList('bought');
    const searchHtml = getHtml('search-toolbar-buttons');

    expect(searchHtml).toContain('onclick="toggleFilterPanel()"');
    expect(searchHtml).toContain('onclick="togglePlatformPanel()"');
  });

  it('unmountSearchToolbarButtons() làm rỗng #search-toolbar-buttons (2.8)', () => {
    const { exports, getHtml } = setup({ accounts: [activeAccount()] });
    exports.renderAccountList('bought');
    expect(getHtml('search-toolbar-buttons')).not.toBe('');

    exports.unmountSearchToolbarButtons();
    expect(getHtml('search-toolbar-buttons')).toBe('');
  });

  it('Khi BẬT: thẻ hết hạn có class is-expired-dimmed, thẻ còn hạn thì KHÔNG (3.4)', () => {
    const { exports, getHtml } = setup({
      accounts: [activeAccount(), expiredAccount()],
      showExpired: { bought: true, personal: false },
    });
    exports.renderAccountList('bought');
    const html = getHtml('page-content');

    // Cả hai thẻ đều hiển thị khi BẬT.
    expect(html).toContain('Spotify Active');
    expect(html).toContain('Netflix Expired');
    // Đúng một thẻ (thẻ hết hạn) nhận class làm mờ.
    const dimmedCount = (html.match(/is-expired-dimmed/g) || []).length;
    expect(dimmedCount).toBe(1);
  });

  it('Khi TẮT và không còn tài khoản còn hạn → trạng thái danh sách rỗng (3.10)', () => {
    const { exports, getHtml } = setup({
      accounts: [expiredAccount(), expiredAccount({ id: 'exp-2', name: 'YouTube Expired', platform: 'youtube' })],
      showExpired: { bought: false, personal: false },
    });
    exports.renderAccountList('bought');
    const html = getHtml('page-content');

    // Hiển thị trạng thái rỗng, không có thẻ tài khoản nào.
    expect(html).toContain('d-empty-state');
    expect(html).toContain('Không có tài khoản nào');
    expect(html).not.toContain('d-account-card');
    // Không có thẻ hết hạn nào bị làm mờ (vì không hiển thị gì).
    expect(html).not.toContain('is-expired-dimmed');
  });

  it('Quay lại màn hình render lại phản ánh đúng cờ getShowExpiredState (4.6)', () => {
    const { exports, appState, getHtml } = setup({
      accounts: [activeAccount(), expiredAccount()],
      showExpired: { bought: false, personal: false },
    });

    // Lượt 1: cờ TẮT → nút ở trạng thái "đang tắt", ẩn tài khoản hết hạn.
    exports.renderAccountList('bought');
    let html = getHtml('page-content');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('Spotify Active');
    expect(html).not.toContain('Netflix Expired');
    expect(html).not.toContain('is-expired-dimmed');

    // Người dùng bật cờ ở màn hình bought rồi rời đi và quay lại → render lại.
    appState.showExpired.bought = true;
    exports.renderAccountList('bought');
    html = getHtml('page-content');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Spotify Active');
    expect(html).toContain('Netflix Expired'); // hết hạn hiển thị lại
    expect((html.match(/is-expired-dimmed/g) || []).length).toBe(1);

    // Quay lại lần nữa với cờ vẫn BẬT → vẫn phản ánh đúng.
    exports.renderAccountList('bought');
    html = getHtml('page-content');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Netflix Expired');
  });
});
