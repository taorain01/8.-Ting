// ============================================================================
// Unit test cho trạng thái rỗng và wiring khôi phục của Thùng rác
// (task 5.3 — spec expired-toggle-trash-grouping).
//
// Kiểm chứng 3 kịch bản của renderTrashList() trong js/desktop-ui.js:
//   1. trashAccounts rỗng            → hiển thị "Thùng rác trống" (Req 1.8)
//   2. có TK nhưng search không khớp → hiển thị trạng thái không có kết quả
//                                      tìm kiếm, KHÔNG phải "Thùng rác trống" (Req 1.10)
//   3. có TK hiển thị                → nút "Khôi phục" gọi restoreAccount(<id>) (Req 1.6)
//
// _Requirements: 1.6, 1.8, 1.10_
//
// renderTrashList gán HTML vào document.getElementById('page-content').innerHTML.
// Ta nạp js/desktop-ui.js trong vm sandbox qua helper tests/helpers/ui-loader.cjs
// (loadDesktopUi), cấu hình window.appState (trashAccounts, searchQuery) qua
// overrides, cung cấp element `page-content` để đọc lại innerHTML, và stub các
// hàm phụ thuộc nằm ngoài desktop-ui.js (utils.js / parser.js) để hàm render
// chạy được trong sandbox mà không cần nạp toàn bộ ứng dụng.
// ============================================================================

const { loadDesktopUi } = require('../helpers/ui-loader.cjs');

// Stub tối thiểu cho các hàm mà renderTrashList/renderTrashCard phụ thuộc từ
// file khác (utils.js, parser.js). Các hàm khai báo ngay trong desktop-ui.js
// (buildAccountDisplayItems, renderTrashCard, renderAuthMethodBadge, ...) sẽ
// dùng bản thật khi chạy trong sandbox.
function baseGlobals() {
  return {
    // Nhóm/sắp xếp (utils.js) — giữ nguyên thứ tự, nhóm theo nền tảng.
    sortAccountsByPriority: accounts => (accounts || []).slice(),
    getAccountGroupKey: acc => `platform-${acc?.platform || 'other'}`,
    getResolvedPlatform: acc => acc?.platform || 'other',
    // Nền tảng/nhãn (parser.js/utils.js).
    getPlatformEmoji: () => '🎵',
    getPlatformLabel: () => 'Spotify',
    getPlatformLogoStyle: () => 'background:#eee;color:#333',
    renderPlatformLogoMark: () => '🎵',
    // Đếm ngược ngày giữ (utils.js) — không cần logic thật cho 3 kịch bản này.
    formatTrashCountdown: () => 'còn 30 ngày giữ',
    formatDateVN: value => String(value || ''),
    getAccountDisplayName: acc => acc?.name || '',
    // Lọc tìm kiếm (utils.js): rỗng → khớp mọi TK; ngược lại so khớp theo tên.
    accountMatchesSearch: (acc, query) => {
      const q = String(query || '').toLowerCase();
      if (!q) return true;
      return String(acc?.name || '').toLowerCase().includes(q);
    },
  };
}

// Nạp desktop-ui.js với appState + globals cho trước; trả về { exports, elements }.
function loadUi({ appState = {}, globals = {} } = {}) {
  const elements = {};
  const { exports } = loadDesktopUi({
    appState: { settings: {}, ...appState },
    elements,
    globals: { ...baseGlobals(), ...globals },
  });
  return { exports, elements };
}

// Đọc lại innerHTML của #page-content sau khi render.
function pageHtml(elements) {
  return elements['page-content'] ? elements['page-content'].innerHTML : '';
}

function makeTrashAccount(overrides = {}) {
  return {
    id: 'acc-1',
    name: 'Spotify Premium',
    platform: 'spotify',
    type: 'bought',
    authMethod: 'email',
    username: 'buyer@example.com',
    expiryType: 'fixed',
    expiryDate: '2099-01-01',
    ...overrides,
  };
}

describe('renderTrashList — trạng thái rỗng và wiring khôi phục (Req 1.6, 1.8, 1.10)', () => {
  it('trashAccounts rỗng → hiển thị "Thùng rác trống" (Req 1.8)', () => {
    const { exports, elements } = loadUi({
      appState: { trashAccounts: [], searchQuery: '' },
    });

    exports.renderTrashList();
    const html = pageHtml(elements);

    expect(html).toContain('Thùng rác trống');
    // Không phải trạng thái tìm kiếm rỗng, cũng không có thẻ tài khoản nào.
    expect(html).not.toContain('Không tìm thấy kết quả');
    expect(html).not.toContain('restoreAccount(');
  });

  it('có TK nhưng search không khớp → trạng thái không có kết quả tìm kiếm, không phải "Thùng rác trống" (Req 1.10)', () => {
    const { exports, elements } = loadUi({
      appState: {
        trashAccounts: [makeTrashAccount()],
        searchQuery: 'zzz-khong-khop',
      },
    });

    exports.renderTrashList();
    const html = pageHtml(elements);

    // Phân biệt rõ với trạng thái thùng rác trống (Req 1.8 vs 1.10).
    expect(html).toContain('Không tìm thấy kết quả');
    expect(html).toContain('zzz-khong-khop');
    expect(html).not.toContain('Thùng rác trống');
    // Không render thẻ tài khoản nào vì không có kết quả khớp.
    expect(html).not.toContain('restoreAccount(');
  });

  it('có TK hiển thị → nút "Khôi phục" gọi restoreAccount(<id>) (Req 1.6)', () => {
    const acc = makeTrashAccount({ id: 'acc-restore-1' });
    const { exports, elements } = loadUi({
      appState: { trashAccounts: [acc], searchQuery: '' },
    });

    exports.renderTrashList();
    const html = pageHtml(elements);

    // Nút Khôi phục nối đúng vào restoreAccount với id của tài khoản.
    expect(html).toContain("restoreAccount('acc-restore-1')");
    expect(html).toContain('Khôi phục');
    // Không rơi vào các nhánh trạng thái rỗng.
    expect(html).not.toContain('Thùng rác trống');
    expect(html).not.toContain('Không tìm thấy kết quả');
  });

  it('search khớp một phần → vẫn render thẻ khôi phục cho TK khớp (Req 1.6, 1.10)', () => {
    const acc = makeTrashAccount({ id: 'acc-match', name: 'Netflix Premium', platform: 'netflix' });
    const { exports, elements } = loadUi({
      appState: { trashAccounts: [acc], searchQuery: 'netflix' },
    });

    exports.renderTrashList();
    const html = pageHtml(elements);

    expect(html).toContain("restoreAccount('acc-match')");
    expect(html).not.toContain('Không tìm thấy kết quả');
    expect(html).not.toContain('Thùng rác trống');
  });
});
