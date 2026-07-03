// ============================================================================
// Feature: auto-update-system — Task 7.4
//   Unit test cho XỬ LÝ LỖI của Mobile_Updater (js/mobile-updater.js) dùng
//   MOCK bơm qua createMobileUpdater({ fetch, navigator, localStorage,
//   tingUpdater, ... }).
//
//   Bao phủ các tình huống lỗi ở Error Handling của design:
//     - Offline khi kiểm tra: navigator.onLine = false → status 'offline',
//       "Không có kết nối mạng", KHÔNG báo có cập nhật, KHÔNG gọi fetch (6.1).
//     - Mất kết nối giữa chừng: fetch throw → status 'offline' (6.1).
//     - Nguồn phát hành trả lỗi HTTP 4xx/5xx: response.ok = false →
//       status 'error', giữ nguyên Installed_Version (info = null) (6.2).
//     - Manifest sai định dạng (JSON hỏng) tuy response ok → status 'error' (4.2).
//     - Manifest thiếu trường bắt buộc → status 'error' (4.2).
//     - Tải thất bại giữa chừng (lỗi mạng thường, KHÔNG phải toàn vẹn):
//       downloadApk reject → status 'error', canRetry = true, KHÔNG tự thử lại
//       kiểu toàn vẹn (downloadApk chỉ gọi 1 lần) (6.3).
//
//   Ghi chú: vitest bật `globals: true` nên describe/it/expect/vi là biến toàn
//   cục, KHÔNG require('vitest'). Dùng localStorage giả lập trong bộ nhớ.
//
// Validates: Requirements 6.1, 6.2, 6.3 (kèm 4.2 cho manifest sai định dạng)
// ============================================================================

const versionCompare = require('../../js/shared/version-compare.js');
const updateCore = require('../../js/shared/update-core.js');
const { createMobileUpdater } = require('../../js/mobile-updater.js');

// URL hợp lệ thuộc origin tin cậy (khớp isAllowedReleaseUrl).
const APK_URL =
  'https://github.com/taorain01/ting-releases/releases/download/v1.4.0/ting-1.4.0.apk';

// localStorage giả lập trong bộ nhớ để writeUpdateLogEntry không phụ thuộc môi trường.
function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); },
  };
}

// Manifest hợp lệ đầy đủ (dùng cho các case cần body JSON đúng schema).
function makeValidManifest() {
  return {
    latestVersion: '1.4.0',
    versionCode: 4,
    releaseNotes: 'Bản cập nhật thử nghiệm',
    apkUrl: APK_URL,
    apkSize: 12345678,
    apkSha256: 'a'.repeat(64),
    minSupportedVersion: 2,
  };
}

// Tạo một Response giả (đủ dùng cho checkForUpdate: ok, status, text()).
function makeResponse({ ok = true, status = 200, body = '' } = {}) {
  return {
    ok,
    status,
    text: async () => body,
  };
}

// Tạo instance Mobile_Updater với các phụ thuộc bơm vào.
function makeUpdater(overrides) {
  return createMobileUpdater(Object.assign({
    versionCompare,
    updateCore,
    localStorage: makeMemoryStorage(),
    navigator: { onLine: true },
    now: () => 1700000000000,
    installedVersionName: '1.3',
    installedVersionCode: 3,
  }, overrides));
}

describe('Mobile_Updater.checkForUpdate — xử lý lỗi (mock)', () => {
  it('Offline: navigator.onLine=false → status "offline", KHÔNG báo cập nhật, KHÔNG gọi fetch (6.1)', async () => {
    const fetchFn = vi.fn(async () => makeResponse({ ok: true, body: JSON.stringify(makeValidManifest()) }));

    const updater = makeUpdater({
      fetch: fetchFn,
      navigator: { onLine: false },
    });

    const result = await updater.checkForUpdate();

    expect(result.status).toBe('offline');
    expect(result.message).toBe('Không có kết nối mạng');
    // KHÔNG báo là có bản cập nhật.
    expect(result.info).toBeNull();
    // Không được gọi fetch khi đã biết offline.
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('Mất kết nối giữa chừng: fetch throw → status "offline" (6.1)', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('network down'); });

    const updater = makeUpdater({
      fetch: fetchFn,
      navigator: { onLine: true },
    });

    const result = await updater.checkForUpdate();

    expect(result.status).toBe('offline');
    expect(result.message).toBe('Không có kết nối mạng');
    expect(result.info).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('HTTP 404 (4xx): response.ok=false → status "error", giữ nguyên phiên bản (info=null) (6.2)', async () => {
    const fetchFn = vi.fn(async () => makeResponse({ ok: false, status: 404 }));

    const updater = makeUpdater({ fetch: fetchFn });
    const result = await updater.checkForUpdate();

    expect(result.status).toBe('error');
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
    // Giữ nguyên Installed_Version: không có thông tin bản cập nhật.
    expect(result.info).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('HTTP 500 (5xx): response.ok=false → status "error", giữ nguyên phiên bản (info=null) (6.2)', async () => {
    const fetchFn = vi.fn(async () => makeResponse({ ok: false, status: 500 }));

    const updater = makeUpdater({ fetch: fetchFn });
    const result = await updater.checkForUpdate();

    expect(result.status).toBe('error');
    expect(result.info).toBeNull();
  });

  it('Manifest sai định dạng: response ok nhưng body JSON hỏng → status "error" (4.2)', async () => {
    const fetchFn = vi.fn(async () => makeResponse({ ok: true, body: '{ this is not valid json' }));

    const updater = makeUpdater({ fetch: fetchFn });
    const result = await updater.checkForUpdate();

    expect(result.status).toBe('error');
    expect(result.message).toBe('Dữ liệu phát hành không hợp lệ. Vui lòng thử lại sau.');
    expect(result.info).toBeNull();
  });

  it('Manifest thiếu trường bắt buộc → status "error" (4.2)', async () => {
    const incomplete = makeValidManifest();
    delete incomplete.apkSha256; // thiếu một trường bắt buộc

    const fetchFn = vi.fn(async () => makeResponse({ ok: true, body: JSON.stringify(incomplete) }));

    const updater = makeUpdater({ fetch: fetchFn });
    const result = await updater.checkForUpdate();

    expect(result.status).toBe('error');
    expect(result.message).toBe('Dữ liệu phát hành không hợp lệ. Vui lòng thử lại sau.');
    expect(result.info).toBeNull();
  });

  it('fetch không khả dụng (không phải hàm) → status "error", không ném lỗi', async () => {
    const updater = makeUpdater({ fetch: null });
    const result = await updater.checkForUpdate();

    expect(result.status).toBe('error');
    expect(result.info).toBeNull();
  });
});

describe('Mobile_Updater.downloadAndInstall — tải thất bại giữa chừng (mock)', () => {
  // UpdateInfo hợp lệ (bọc manifest đầy đủ thông tin toàn vẹn) để vào được nhánh tải.
  function makeUpdateInfo() {
    const manifest = makeValidManifest();
    return {
      currentVersion: '1.3',
      latestVersion: manifest.latestVersion,
      releaseNotes: manifest.releaseNotes,
      releaseUrl: manifest.apkUrl,
      source: 'manifest',
      distance: 1,
      manifest,
    };
  }

  it('downloadApk reject lỗi mạng thường → status "error", canRetry=true, KHÔNG tự thử lại (6.3)', async () => {
    // Lỗi mạng thường (KHÔNG phải lỗi toàn vẹn) → chính sách thử lại toàn vẹn
    // không áp dụng: chỉ tải đúng 1 lần rồi dừng.
    const networkError = new Error('Kết nối bị ngắt khi đang tải');

    const mockPlugin = {
      addListener: vi.fn(async () => ({ remove: () => {} })),
      ensureInstallPermission: vi.fn(async () => ({ granted: true })),
      downloadApk: vi.fn(async () => { throw networkError; }),
      installApk: vi.fn(async () => ({ launched: true })),
      cleanupApk: vi.fn(async () => ({ deleted: true })),
    };

    const updater = makeUpdater({ tingUpdater: mockPlugin });
    const result = await updater.downloadAndInstall(makeUpdateInfo());

    // Báo lỗi và cho thử lại thủ công (6.3).
    expect(result.status).toBe('error');
    expect(result.canRetry).toBe(true);
    expect(result.message).toBe('Tải bản cập nhật thất bại. Vui lòng thử lại.');

    // KHÔNG tự thử lại kiểu toàn vẹn: downloadApk chỉ được gọi đúng 1 lần.
    expect(mockPlugin.downloadApk).toHaveBeenCalledTimes(1);

    // Không bao giờ cài đặt khi tải thất bại.
    expect(mockPlugin.installApk).not.toHaveBeenCalled();
  });
});
