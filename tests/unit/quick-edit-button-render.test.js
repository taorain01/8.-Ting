// Unit test cho lớp render Chế độ sửa nhanh (task 4.5 — spec quick-edit-account-detail).
// Kiểm tra:
//  - Nút "Sửa nhanh" đúng vị trí (liền trước "✏️ Sửa"), có aria-label, giữ nguyên
//    các nút Sửa/Chia sẻ/Xoá và nút mắt/copy.
//  - Nút disabled khi không giải mã được (không có onclick → bấm không đổi state).
//  - Auth_Method `email` cho sửa đủ 5 ô; SSO giữ ô Mật khẩu chỉ đọc.
//  - Trường nhạy cảm về dạng masked ở Chế độ xem (sau khi huỷ/lưu, quickEdit đã tắt).
// Nạp js/desktop-ui.js qua helper tests/helpers/ui-loader.cjs (loadDesktopUi) rồi
// truy cập trực tiếp các hàm khai báo ở phạm vi global của sandbox vm.
const { loadDesktopUi } = require('../helpers/ui-loader.cjs');

// Các stub tối thiểu cho những hàm mà desktop-ui.js phụ thuộc từ file khác.
// Chỉ cần trả giá trị ổn định để renderDetail chạy được trong sandbox.
function baseGlobals() {
  return {
    daysUntil: () => 30,
    getResolvedPlatform: acc => acc?.platform || 'openai',
    getPlatformEmoji: () => 'AI',
    stringToColor: () => '#6C5CE7',
    getStatusBadgeClass: () => 'badge-active',
    getStatusText: () => 'Hoạt động',
    formatDateVN: value => String(value || ''),
    renderSmartNote: value => `<div class="smart-note">${String(value || '')}</div>`,
    isAccountPinned: () => false,
    isAccountFavorite: () => false,
    getRevealedSecret: () => undefined,
    // maskUsername dùng tiền tố dễ nhận biết để khẳng định giá trị đã bị che.
    maskUsername: value => `masked-${String(value || '')}`,
    isLikelyTotpSecret: () => false,
  };
}

// Nạp desktop-ui.js với appState + globals cho trước, trả về sandbox để gọi hàm.
function loadUi({ appState = {}, globals = {} } = {}) {
  const elements = {};
  const { sandbox } = loadDesktopUi({
    appState,
    elements,
    globals: { ...baseGlobals(), ...globals },
  });
  return { sandbox, elements };
}

// Tài khoản "mua" thường (không bảo vệ) → luôn giải mã được, không cần Master.
function makeBoughtAccount(overrides = {}) {
  return {
    id: 'acc-bought',
    name: 'ChatGPT Plus',
    type: 'bought',
    platform: 'openai',
    authMethod: 'email',
    username: 'buyer@example.com',
    password: 'plain-pass',
    expiryType: 'fixed',
    expiryDate: '2099-01-01',
    purchaseDate: '2024-01-01',
    ...overrides,
  };
}

// Tài khoản cá nhân có payload mã hoá → cần Master nhưng vẫn giải mã được.
function makePersonalEncryptedAccount(overrides = {}) {
  return {
    id: 'acc-personal',
    name: 'Gmail cá nhân',
    type: 'personal',
    platform: 'google',
    authMethod: 'email',
    displayUsername: 'ng***@gmail.com',
    protectedByMasterPassword: true,
    encryptedData: 'ZW5jcnlwdGVk',
    salt: 'c2FsdA==',
    iv: 'aXY=',
    expiryType: 'lifetime',
    purchaseDate: '2024-01-01',
    ...overrides,
  };
}

describe('renderQuickEditButton — hiển thị & trạng thái nút Sửa nhanh', () => {
  it('tài khoản giải mã được: có onclick enterQuickEditMode, aria-label "Sửa nhanh", không disabled', () => {
    const acc = makeBoughtAccount();
    const { sandbox } = loadUi({ appState: { accounts: [acc], settings: {} } });

    const html = sandbox.renderQuickEditButton(acc);

    expect(html).toContain(`onclick="enterQuickEditMode('acc-bought')"`);
    expect(html).toContain('aria-label="Sửa nhanh"');
    expect(html).toContain('title="Sửa nhanh"');
    expect(html).not.toContain('disabled');
    expect(html).toContain('Sửa nhanh');
  });

  it('tài khoản cần Master và không giải mã được: nút disabled, aria-label giải thích, không có onclick (bấm không đổi state)', () => {
    // Cá nhân, không có payload mã hoá lẫn dữ liệu thô, chưa mở khoá trong phiên.
    const acc = {
      id: 'acc-locked',
      name: 'TK khoá',
      type: 'personal',
      authMethod: 'email',
      displayUsername: '******',
    };
    const { sandbox } = loadUi({ appState: { accounts: [acc], settings: {} } });

    const html = sandbox.renderQuickEditButton(acc);

    expect(html).toContain('disabled');
    // aria-label giải thích cần giải mã trước.
    expect(html).toMatch(/aria-label="[^"]*giải mã[^"]*"/);
    // Không gắn onclick vào enterQuickEditMode → bấm không chuyển sang Chế độ sửa nhanh.
    expect(html).not.toContain('enterQuickEditMode');
  });

  it('tài khoản cần Master nhưng còn payload mã hoá: nút vẫn bật (enabled) để mở khoá sửa nhanh', () => {
    const acc = makePersonalEncryptedAccount();
    const { sandbox } = loadUi({ appState: { accounts: [acc], settings: {} } });

    const html = sandbox.renderQuickEditButton(acc);

    expect(html).toContain(`onclick="enterQuickEditMode('acc-personal')"`);
    expect(html).not.toContain('disabled');
  });
});

describe('renderQuickEditSection — số ô chỉnh sửa theo Auth_Method', () => {
  it('Auth_Method email: render đủ 5 ô (username/password/twoFaCode/sellerName + textarea note)', () => {
    const acc = makeBoughtAccount({ id: 'acc-email', authMethod: 'email' });
    const appState = {
      accounts: [acc],
      settings: {},
      quickEdit: {
        accId: 'acc-email',
        active: true,
        original: {
          username: 'buyer@example.com',
          password: 'secret-pass',
          twoFaCode: 'JBSWY3DPEHPK3PXP',
          sellerName: 'Shop A',
          note: 'ghi chú',
        },
      },
    };
    const { sandbox } = loadUi({ appState });

    const html = sandbox.renderQuickEditSection(acc);

    // 4 input một dòng + 1 textarea = 5 ô sửa được.
    expect(html).toContain('id="quick-edit-username"');
    expect(html).toContain('id="quick-edit-password"');
    expect(html).toContain('id="quick-edit-twoFaCode"');
    expect(html).toContain('id="quick-edit-sellerName"');
    expect(html).toContain('id="quick-edit-note"');
    expect(html).toContain('<textarea');
    // Auth email KHÔNG hiển thị chip SSO chỉ đọc.
    expect(html).not.toContain('sso-password-chip');
    // Giá trị nạp đúng snapshot.
    expect(html).toContain('value="buyer@example.com"');
    expect(html).toContain('value="secret-pass"');
    expect(html).toContain('value="JBSWY3DPEHPK3PXP"');
  });

  it('Auth_Method SSO (google): không có input password, giữ ô Mật khẩu chỉ đọc (sso-password-chip)', () => {
    const acc = makeBoughtAccount({ id: 'acc-sso', authMethod: 'google', password: '' });
    const appState = {
      accounts: [acc],
      settings: {},
      quickEdit: {
        accId: 'acc-sso',
        active: true,
        original: {
          username: 'sso-user@example.com',
          password: '',
          twoFaCode: '',
          sellerName: 'Shop B',
          note: '',
        },
      },
    };
    const { sandbox } = loadUi({ appState });

    const html = sandbox.renderQuickEditSection(acc);

    // Không có input sửa mật khẩu cho SSO.
    expect(html).not.toContain('id="quick-edit-password"');
    // Vẫn giữ ô Mật khẩu chỉ đọc qua renderSsoPasswordDetail.
    expect(html).toContain('sso-password-chip');
    // Các ô còn lại vẫn sửa được.
    expect(html).toContain('id="quick-edit-username"');
    expect(html).toContain('id="quick-edit-twoFaCode"');
    expect(html).toContain('id="quick-edit-sellerName"');
    expect(html).toContain('id="quick-edit-note"');
  });
});

describe('renderDetail — vị trí nút Sửa nhanh & giữ nguyên các nút hành động', () => {
  it('chỉ hiện giờ mua trong chi tiết, không đưa giờ ra thông tin thẻ danh sách', () => {
    const acc = makeBoughtAccount({ id: 'acc-time', purchaseTime: '14:35' });
    const { sandbox, elements } = loadUi({
      appState: { accounts: [acc], trashAccounts: [], settings: {} },
    });

    sandbox.renderDetail('acc-time');
    const detailHtml = elements['page-content'].innerHTML;
    const cardDetailsHtml = sandbox.renderAccountCardDetails(acc, '30 ngày');

    expect(detailHtml).toContain('Giờ mua');
    expect(detailHtml).toContain('14:35');
    expect(cardDetailsHtml).not.toContain('Giờ mua');
    expect(cardDetailsHtml).not.toContain('14:35');
  });

  it('Chế độ xem: nút Sửa nhanh đặt liền trước "✏️ Sửa", giữ nút Chia sẻ/Sửa/Xoá và nút mắt/copy', () => {
    const acc = makePersonalEncryptedAccount({ id: 'acc-view' });
    const { sandbox, elements } = loadUi({
      appState: { accounts: [acc], trashAccounts: [], settings: {} },
    });

    sandbox.renderDetail('acc-view');
    const html = elements['page-content'].innerHTML;

    // Các nút hành động gốc vẫn còn.
    expect(html).toContain(`openShareAccountModal('acc-view')`);
    expect(html).toContain(`editAccount('acc-view')`);
    expect(html).toContain(`deleteAccount('acc-view')`);
    // Nút mắt (reveal) và nút copy vẫn xuất hiện với tài khoản cần Master.
    expect(html).toContain('revealField(');
    expect(html).toContain('copyField(');

    // Nút Sửa nhanh nằm giữa nút Chia sẻ và nút "✏️ Sửa" (liền trước Sửa).
    const shareIdx = html.indexOf('openShareAccountModal(');
    const quickIdx = html.indexOf(`enterQuickEditMode('acc-view')`);
    const editIdx = html.indexOf(`editAccount('acc-view')`);
    expect(quickIdx).toBeGreaterThan(shareIdx);
    expect(editIdx).toBeGreaterThan(quickIdx);
    // Giữa nút Sửa nhanh và nút "✏️ Sửa" không chèn thêm nút hành động nào khác.
    const between = html.slice(quickIdx, editIdx);
    expect(between).not.toContain('deleteAccount(');
    expect(between).not.toContain('openShareAccountModal(');
  });

  it('Chế độ xem (sau huỷ/lưu, quickEdit đã tắt): Trường nhạy cảm hiển thị dạng masked', () => {
    const acc = makePersonalEncryptedAccount({ id: 'acc-masked' });
    // quickEdit tắt (giống trạng thái sau khi huỷ hoặc lưu xong).
    const { sandbox, elements } = loadUi({
      appState: {
        accounts: [acc],
        trashAccounts: [],
        settings: {},
        quickEdit: null,
        activeDecryptedAccount: null,
      },
    });

    sandbox.renderDetail('acc-masked');
    const html = elements['page-content'].innerHTML;

    // Mật khẩu bị che, username dùng bản hiển thị đã che, không lộ ô nhập sửa nhanh.
    expect(html).toContain('******');
    expect(html).toContain('ng***@gmail.com');
    expect(html).not.toContain('id="quick-edit-username"');
    expect(html).not.toContain('quick-edit-section');
  });
});
