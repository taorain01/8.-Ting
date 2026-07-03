// ============================================================================
// Feature: auto-update-system — Task 10.3
//   Unit test cho Update_UI (js/desktop-ui.js): ánh xạ trạng thái → nhãn/thông
//   báo tiếng Việt, định tuyến năng lực cập nhật theo nền tảng, và cảnh báo
//   Min_Supported_Version (hiển thị NỔI BẬT nhưng KHÔNG chặn — vẫn cho bỏ qua/
//   tiếp tục dùng app).
//
//   desktop-ui.js là mã renderer thuần script (không `module.exports`) và phụ
//   thuộc `window`/`document`. Để kiểm thử CHÍNH các hàm thật mà không thêm
//   dependency jsdom, ta nạp file trong một sandbox `vm` với `window`/`document`
//   được mock tối thiểu, rồi trích các hàm cần test qua `globalThis`.
//
//   Ghi chú: vitest bật `globals: true` nên describe/it/expect là biến toàn cục,
//   KHÔNG require('vitest').
//
// Validates: Requirements 1.6, 3.5, 3.7, 4.4, 9.7, 10.1, 10.4
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const versionCompare = require('../../js/shared/version-compare.js');
const platformDetector = require('../../js/shared/platform-detector.js');

const DESKTOP_UI_PATH = path.join(__dirname, '..', '..', 'js', 'desktop-ui.js');
const DESKTOP_UI_SRC = fs.readFileSync(DESKTOP_UI_PATH, 'utf8');

// Danh sách các ký hiệu cần trích để test. Được nối vào cuối source (cùng scope
// script) nên truy cập được cả `const` (UPDATE_STATUS_LABELS, UPDATE_RELEASES_URL)
// lẫn các function declaration.
const EXPORT_SNIPPET = `
;globalThis.__tingUpdateExports = {
  UPDATE_STATUS_LABELS: UPDATE_STATUS_LABELS,
  UPDATE_RELEASES_URL: UPDATE_RELEASES_URL,
  getUpdateStatusMessage: getUpdateStatusMessage,
  getUpdatePlatform: getUpdatePlatform,
  getUpdateCapability: getUpdateCapability,
  isBelowMinSupportedVersion: isBelowMinSupportedVersion,
  renderMinSupportedWarning: renderMinSupportedWarning,
  dismissMinSupportedWarning: dismissMinSupportedWarning,
  renderUpdateStatus: renderUpdateStatus,
  renderUpdateSection: renderUpdateSection,
};
`;

// Phần tử DOM giả tối thiểu, an toàn với mọi thao tác renderX() có thể chạm tới.
function makeStubElement() {
  return {
    innerHTML: '',
    textContent: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {},
    removeChild() {},
    remove() {},
    setAttribute() {},
    getAttribute() { return null; },
    style: {},
    dataset: {},
  };
}

// Nạp desktop-ui.js trong sandbox vm với window/document mock; trả về { exports, window }.
// `windowOverrides` cho phép test thiết lập electronAPI/Capacitor/TingShared/appState...
function loadDesktopUi(windowOverrides = {}) {
  const windowObj = Object.assign({}, windowOverrides);
  const documentMock = {
    addEventListener() {},
    removeEventListener() {},
    getElementById() { return makeStubElement(); },
    querySelector() { return makeStubElement(); },
    querySelectorAll() { return []; },
    createElement() { return makeStubElement(); },
  };

  const sandbox = {
    window: windowObj,
    document: documentMock,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    Number,
    JSON,
    String,
    Boolean,
    Array,
    Object,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(DESKTOP_UI_SRC + EXPORT_SNIPPET, sandbox, { filename: 'desktop-ui.js' });

  return { exports: sandbox.__tingUpdateExports, window: windowObj };
}

// window mặc định có TingShared (VersionCompare + PlatformDetector) và appState rỗng.
function makeWindow(overrides = {}) {
  return Object.assign({
    appState: {},
    TingShared: {
      VersionCompare: versionCompare,
      PlatformDetector: platformDetector,
    },
  }, overrides);
}

// ---------------------------------------------------------------------------
// 1) Ánh xạ 8 trạng thái vòng đời → nhãn/thông báo tiếng Việt (1.6, 3.5, 3.7, 4.4)
// ---------------------------------------------------------------------------
describe('getUpdateStatusMessage: ánh xạ trạng thái → thông báo tiếng Việt', () => {
  const { exports } = loadDesktopUi(makeWindow());
  const { getUpdateStatusMessage, UPDATE_STATUS_LABELS } = exports;

  // Đủ 8 trạng thái theo design/tasks.
  const EXPECTED = {
    idle: 'Chưa kiểm tra trong phiên này',
    checking: 'Đang kiểm tra cập nhật...',
    'update-available': 'Đã có bản cập nhật mới',
    downloading: 'Đang tải bản cập nhật...',
    downloaded: 'Bản cập nhật đã sẵn sàng',
    'up-to-date': 'Đang ở bản mới nhất',
    error: 'Đã xảy ra lỗi khi cập nhật',
    offline: 'Không có kết nối mạng',
  };

  it('bảng nhãn UPDATE_STATUS_LABELS bao phủ đúng 8 trạng thái vòng đời', () => {
    expect(Object.keys(UPDATE_STATUS_LABELS).sort()).toEqual(
      Object.keys(EXPECTED).sort()
    );
  });

  for (const [kind, label] of Object.entries(EXPECTED)) {
    // 'downloading' xử lý riêng ở test kèm phần trăm bên dưới.
    if (kind === 'downloading') continue;
    it(`trạng thái "${kind}" → "${label}"`, () => {
      expect(getUpdateStatusMessage({ status: kind })).toBe(label);
    });
  }

  it('status = null → nhãn idle mặc định (chưa kiểm tra trong phiên này)', () => {
    expect(getUpdateStatusMessage(null)).toBe(EXPECTED.idle);
    expect(getUpdateStatusMessage(undefined)).toBe(EXPECTED.idle);
  });

  it('downloading kèm progress.percent → thêm phần trăm đã làm tròn', () => {
    expect(getUpdateStatusMessage({ status: 'downloading', progress: { percent: 42.6 } }))
      .toBe('Đang tải bản cập nhật... 43%');
  });

  it('downloading đọc được percent phẳng (status.percent)', () => {
    expect(getUpdateStatusMessage({ status: 'downloading', percent: 10 }))
      .toBe('Đang tải bản cập nhật... 10%');
  });

  it('downloading không có percent → chỉ nhãn, không kèm số', () => {
    expect(getUpdateStatusMessage({ status: 'downloading' }))
      .toBe('Đang tải bản cập nhật...');
  });

  it('message tuỳ biến (ví dụ lỗi đã làm sạch) được ưu tiên hơn nhãn mặc định', () => {
    const msg = 'Không thể kết nối máy chủ cập nhật. Vui lòng thử lại sau.';
    expect(getUpdateStatusMessage({ status: 'error', message: msg })).toBe(msg);
  });

  it('trạng thái lạ không có message → trả về chính giá trị kind (fallback an toàn)', () => {
    expect(getUpdateStatusMessage({ status: 'weird-kind' })).toBe('weird-kind');
  });
});

// ---------------------------------------------------------------------------
// 2) Định tuyến năng lực cập nhật theo nền tảng (10.1, 10.2, 10.4)
// ---------------------------------------------------------------------------
describe('getUpdatePlatform / getUpdateCapability: định tuyến theo nền tảng', () => {
  it('electron: detect "electron", canCheck = true, không có disabledMessage', () => {
    const { exports } = loadDesktopUi(makeWindow({ electronAPI: { isElectron: true } }));
    const platform = exports.getUpdatePlatform();
    expect(platform).toBe('electron');
    expect(exports.getUpdateCapability(platform)).toEqual({ canCheck: true, disabledMessage: null });
  });

  it('android: detect "android", canCheck = true, không có disabledMessage', () => {
    const { exports } = loadDesktopUi(makeWindow({ Capacitor: { getPlatform: () => 'android' } }));
    const platform = exports.getUpdatePlatform();
    expect(platform).toBe('android');
    expect(exports.getUpdateCapability(platform)).toEqual({ canCheck: true, disabledMessage: null });
  });

  it('ios: detect "ios", canCheck = false, thông báo "Cập nhật qua App Store"', () => {
    const { exports } = loadDesktopUi(makeWindow({ Capacitor: { getPlatform: () => 'ios' } }));
    const platform = exports.getUpdatePlatform();
    expect(platform).toBe('ios');
    const cap = exports.getUpdateCapability(platform);
    expect(cap.canCheck).toBe(false);
    expect(cap.disabledMessage).toBe('Cập nhật qua App Store');
  });

  it('web: detect "web", canCheck = false, kèm thông báo không hỗ trợ', () => {
    const { exports } = loadDesktopUi(makeWindow());
    const platform = exports.getUpdatePlatform();
    expect(platform).toBe('web');
    const cap = exports.getUpdateCapability(platform);
    expect(cap.canCheck).toBe(false);
    expect(typeof cap.disabledMessage).toBe('string');
    expect(cap.disabledMessage.length).toBeGreaterThan(0);
  });

  it('fallback khi TingShared.PlatformDetector chưa nạp: electronAPI → "electron", không có → "web"', () => {
    const elec = loadDesktopUi({ appState: {}, electronAPI: { isElectron: true } });
    expect(elec.exports.getUpdatePlatform()).toBe('electron');

    const web = loadDesktopUi({ appState: {} });
    expect(web.exports.getUpdatePlatform()).toBe('web');
    // Fallback capability vẫn phân loại đúng electron/android là bật.
    expect(elec.exports.getUpdateCapability('electron').canCheck).toBe(true);
    expect(web.exports.getUpdateCapability('web').canCheck).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3) renderUpdateSection: hiển thị theo nền tảng (10.1, 10.4, 3.5)
// ---------------------------------------------------------------------------
describe('renderUpdateSection: hiển thị Installed_Version + định tuyến nền tảng', () => {
  it('luôn hiển thị Installed_Version trên mọi nền tảng (10.1)', () => {
    const { exports } = loadDesktopUi(makeWindow({
      appState: { appVersion: '1.3.0', updateStatus: null, updateLog: [] },
    }));
    const html = exports.renderUpdateSection();
    expect(html).toContain('Ting! v1.3.0');
    expect(html).toContain('Phiên bản');
  });

  it('web: hiển thị thông báo không hỗ trợ + link tải thủ công (10.4)', () => {
    const { exports } = loadDesktopUi(makeWindow({
      appState: { appVersion: '1.3.0', updateStatus: null, updateLog: [] },
    }));
    const html = exports.renderUpdateSection();
    expect(html).toContain('Tải thủ công');
    expect(html).toContain(exports.UPDATE_RELEASES_URL);
  });

  it('ios: hiển thị "Cập nhật qua App Store" (10.2)', () => {
    const { exports } = loadDesktopUi(makeWindow({
      Capacitor: { getPlatform: () => 'ios' },
      appState: { appVersion: '1.3.0', updateStatus: null, updateLog: [] },
    }));
    const html = exports.renderUpdateSection();
    expect(html).toContain('Cập nhật qua App Store');
  });

  it('electron đã tải xong (downloaded): hiển thị nút "Cài đặt" (3.5)', () => {
    const { exports } = loadDesktopUi(makeWindow({
      electronAPI: { isElectron: true },
      appState: {
        appVersion: '1.3.0',
        updateStatus: { status: 'downloaded' },
        updateLog: [],
      },
    }));
    const html = exports.renderUpdateSection();
    expect(html).toContain('Bản cập nhật đã sẵn sàng');
    expect(html).toContain('installDownloadedUpdate()');
  });

  it('electron có bản mới từ fallback GitHub (available): hiển thị nút "Cập nhật"', () => {
    const { exports } = loadDesktopUi(makeWindow({
      electronAPI: { isElectron: true },
      appState: {
        appVersion: '1.3.0',
        updateStatus: { status: 'available', info: { latestVersion: '1.3.2', releaseName: 'Ting! 1.3.2' } },
        updateLog: [],
      },
    }));
    const html = exports.renderUpdateSection();
    expect(html).toContain('Phiên bản mới 1.3.2');
    expect(html).toContain('startUpdateDownload()');
  });

  it('electron đang tải: nút "Kiểm tra" bị vô hiệu (khoá hành động khi đang tải) (4.6)', () => {
    const { exports } = loadDesktopUi(makeWindow({
      electronAPI: { isElectron: true },
      appState: {
        appVersion: '1.3.0',
        updateStatus: { status: 'downloading', progress: { percent: 20 } },
        updateLog: [],
      },
    }));
    const html = exports.renderUpdateSection();
    expect(html).toContain('disabled');
    expect(html).toContain('Đang tải bản cập nhật... 20%');
  });

  it('android có bản mới (update-available): hiển thị nút "Cập nhật" (4.4)', () => {
    const { exports } = loadDesktopUi(makeWindow({
      Capacitor: { getPlatform: () => 'android' },
      appState: {
        appVersion: '1.3.0',
        updateStatus: { status: 'update-available', info: { latestVersion: '1.4.0', releaseNotes: 'Ghi chú' } },
        updateLog: [],
      },
    }));
    const html = exports.renderUpdateSection();
    expect(html).toContain('Phiên bản mới 1.4.0');
    expect(html).toContain('startUpdateDownload()');
  });
});

// ---------------------------------------------------------------------------
// 4) Cảnh báo Min_Supported_Version: hiển thị nhưng KHÔNG chặn (9.7)
// ---------------------------------------------------------------------------
describe('Min_Supported_Version: cảnh báo nổi bật nhưng vẫn cho bỏ qua/tiếp tục (9.7)', () => {
  // Trạng thái Android: versionCode đang cài < minSupportedVersion → dưới ngưỡng.
  function belowStatus() {
    return {
      status: 'update-available',
      info: {
        latestVersion: '1.5.0',
        manifest: { latestVersion: '1.5.0', minSupportedVersion: 5 },
      },
    };
  }

  it('isBelowMinSupportedVersion: android với installedCode < minSupported → true', () => {
    const { exports } = loadDesktopUi(makeWindow({
      Capacitor: { getPlatform: () => 'android' },
      TingMobileUpdater: { INSTALLED_VERSION_CODE: 3 },
      appState: {},
    }));
    expect(exports.isBelowMinSupportedVersion('android', belowStatus())).toBe(true);
  });

  it('isBelowMinSupportedVersion: android với installedCode >= minSupported → false', () => {
    const { exports } = loadDesktopUi(makeWindow({
      Capacitor: { getPlatform: () => 'android' },
      TingMobileUpdater: { INSTALLED_VERSION_CODE: 7 },
      appState: {},
    }));
    expect(exports.isBelowMinSupportedVersion('android', belowStatus())).toBe(false);
  });

  it('isBelowMinSupportedVersion: không phải android (electron) → false (không có versionCode)', () => {
    const { exports } = loadDesktopUi(makeWindow({
      electronAPI: { isElectron: true },
      appState: {},
    }));
    expect(exports.isBelowMinSupportedVersion('electron', belowStatus())).toBe(false);
  });

  it('isBelowMinSupportedVersion: thiếu minSupportedVersion → false', () => {
    const { exports } = loadDesktopUi(makeWindow({
      Capacitor: { getPlatform: () => 'android' },
      TingMobileUpdater: { INSTALLED_VERSION_CODE: 1 },
      appState: {},
    }));
    const status = { status: 'update-available', info: { manifest: { latestVersion: '1.5.0' } } };
    expect(exports.isBelowMinSupportedVersion('android', status)).toBe(false);
  });

  it('renderMinSupportedWarning: dưới ngưỡng → hiện cảnh báo + nút "Bỏ qua" (không chặn) và "Cập nhật ngay"', () => {
    const { exports } = loadDesktopUi(makeWindow({
      Capacitor: { getPlatform: () => 'android' },
      TingMobileUpdater: { INSTALLED_VERSION_CODE: 3 },
      appState: { minSupportedWarningDismissed: false },
    }));
    const html = exports.renderMinSupportedWarning('android', belowStatus());
    expect(html).not.toBe('');
    // Vẫn cho bỏ qua/tiếp tục dùng app (KHÔNG chặn).
    expect(html).toContain('dismissMinSupportedWarning()');
    expect(html).toContain('Bỏ qua');
    // Khuyến nghị cập nhật ngay.
    expect(html).toContain('Cập nhật ngay');
    expect(html).toContain('startUpdateDownload()');
    // Nhắc rõ vẫn có thể tiếp tục sử dụng.
    expect(html).toContain('vẫn có thể bỏ qua và tiếp tục sử dụng');
    // Kèm phiên bản mới nhất khuyến nghị.
    expect(html).toContain('1.5.0');
  });

  it('renderMinSupportedWarning: đã bấm "Bỏ qua" (dismissed) → trả về rỗng, không chặn', () => {
    const { exports } = loadDesktopUi(makeWindow({
      Capacitor: { getPlatform: () => 'android' },
      TingMobileUpdater: { INSTALLED_VERSION_CODE: 3 },
      appState: { minSupportedWarningDismissed: true },
    }));
    expect(exports.renderMinSupportedWarning('android', belowStatus())).toBe('');
  });

  it('renderMinSupportedWarning: không dưới ngưỡng → không hiện cảnh báo', () => {
    const { exports } = loadDesktopUi(makeWindow({
      Capacitor: { getPlatform: () => 'android' },
      TingMobileUpdater: { INSTALLED_VERSION_CODE: 9 },
      appState: { minSupportedWarningDismissed: false },
    }));
    expect(exports.renderMinSupportedWarning('android', belowStatus())).toBe('');
  });

  it('dismissMinSupportedWarning: đặt cờ dismissed = true và KHÔNG chặn app (không ném lỗi)', () => {
    const { exports, window } = loadDesktopUi(makeWindow({
      Capacitor: { getPlatform: () => 'android' },
      TingMobileUpdater: { INSTALLED_VERSION_CODE: 3 },
      appState: { minSupportedWarningDismissed: false, currentPage: 'home' },
    }));

    expect(() => exports.dismissMinSupportedWarning()).not.toThrow();
    expect(window.appState.minSupportedWarningDismissed).toBe(true);

    // Sau khi bỏ qua, cảnh báo không còn hiển thị → người dùng tiếp tục dùng bình thường.
    expect(exports.renderMinSupportedWarning('android', belowStatus())).toBe('');
  });
});
