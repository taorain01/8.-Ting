// ============================================================================
// Feature: auto-update-system — Task 8.4 (phần tự động hoá)
//   Integration test cho luồng điều phối native Android phía JS
//   (js/mobile-updater.js) dùng MOCK plugin `TingUpdater` bơm qua
//   createMobileUpdater({ tingUpdater: mockPlugin, ... }).
//
//   Kiểm chứng:
//     1) downloadAndInstall gọi downloadApk → installApk → cleanup ĐÚNG THỨ TỰ
//        khi tải + xác minh + cài đặt thành công.
//     2) KHÔNG gọi installApk khi downloadApk reject do lỗi TOÀN VẸN
//        (Property 11 — không bao giờ cài đặt artifact hỏng toàn vẹn).
//
//   Phần chạy trên THIẾT BỊ/EMULATOR thật (FileProvider, PackageInstaller,
//   Settings, kiểm tra chữ ký OS) được mô tả trong
//   tests/integration/android-updater-manual.md — KHÔNG chạy ở đây.
//
//   Ghi chú: vitest bật `globals: true` nên describe/it/expect/vi là biến toàn
//   cục, KHÔNG require('vitest').
//
// Validates: Requirements 4.5, 4.7, 4.9, 5.3, 9.4
// ============================================================================

const versionCompare = require('../../js/shared/version-compare.js');
const updateCore = require('../../js/shared/update-core.js');
const { createMobileUpdater } = require('../../js/mobile-updater.js');

// URL hợp lệ thuộc origin tin cậy (khớp isAllowedReleaseUrl).
const APK_URL =
  'https://github.com/taorain01/ting-releases/releases/download/v1.4.0/ting-1.4.0.apk';

// UpdateInfo mẫu (dạng trả về từ checkForUpdate) có bọc `manifest` đầy đủ
// thông tin toàn vẹn để downloadAndInstall chạy được nhánh tải thật.
function makeUpdateInfo() {
  return {
    currentVersion: '1.3',
    latestVersion: '1.4.0',
    releaseNotes: 'Bản cập nhật thử nghiệm',
    releaseUrl: APK_URL,
    source: 'manifest',
    distance: 1,
    manifest: {
      latestVersion: '1.4.0',
      versionCode: 4,
      releaseNotes: 'Bản cập nhật thử nghiệm',
      apkUrl: APK_URL,
      apkSize: 12345678,
      apkSha256: 'a'.repeat(64),
      minSupportedVersion: 2,
    },
  };
}

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

// Tạo instance Mobile_Updater với plugin mock được bơm vào.
function makeUpdater(mockPlugin) {
  return createMobileUpdater({
    tingUpdater: mockPlugin,
    versionCompare,
    updateCore,
    localStorage: makeMemoryStorage(),
    navigator: { onLine: true },
    now: () => 1700000000000,
    installedVersionName: '1.3',
    installedVersionCode: 3,
  });
}

describe('Mobile_Updater.downloadAndInstall — luồng native Android (mock plugin)', () => {
  it('gọi downloadApk → installApk → cleanup đúng thứ tự khi thành công', async () => {
    const callOrder = [];

    const mockPlugin = {
      addListener: vi.fn(async () => ({ remove: () => {} })),
      ensureInstallPermission: vi.fn(async () => {
        callOrder.push('ensureInstallPermission');
        return { granted: true };
      }),
      downloadApk: vi.fn(async () => {
        callOrder.push('downloadApk');
        return { filePath: '/data/user/0/app.ting.manager/files/ting-update.apk', size: 12345678, sha256: 'a'.repeat(64) };
      }),
      installApk: vi.fn(async () => {
        callOrder.push('installApk');
        return { launched: true };
      }),
      cleanupApk: vi.fn(async () => {
        callOrder.push('cleanupApk');
        return { deleted: true };
      }),
    };

    const updater = makeUpdater(mockPlugin);
    const result = await updater.downloadAndInstall(makeUpdateInfo());

    // Kết quả thành công: trạng thái downloaded, đã mời cài đặt.
    expect(result.status).toBe('downloaded');

    // downloadApk được gọi đúng 1 lần, trước installApk.
    expect(mockPlugin.downloadApk).toHaveBeenCalledTimes(1);
    expect(mockPlugin.installApk).toHaveBeenCalledTimes(1);

    // downloadApk nhận đúng URL + thông tin toàn vẹn từ manifest (4.5, 9.4).
    expect(mockPlugin.downloadApk).toHaveBeenCalledWith({
      url: APK_URL,
      expectedSha256: 'a'.repeat(64),
      expectedSize: 12345678,
    });

    // installApk nhận đúng filePath do downloadApk trả về (4.7).
    expect(mockPlugin.installApk).toHaveBeenCalledWith({
      filePath: '/data/user/0/app.ting.manager/files/ting-update.apk',
    });

    // Thứ tự tương đối: downloadApk phải đứng TRƯỚC installApk.
    const idxDownload = callOrder.indexOf('downloadApk');
    const idxInstall = callOrder.indexOf('installApk');
    expect(idxDownload).toBeGreaterThanOrEqual(0);
    expect(idxInstall).toBeGreaterThan(idxDownload);

    // Dọn dẹp APK sau cài đặt (4.9) — cleanupDownloadedApk uỷ quyền cho cleanupApk.
    await updater.cleanupDownloadedApk();
    expect(mockPlugin.cleanupApk).toHaveBeenCalled();
    const idxCleanup = callOrder.lastIndexOf('cleanupApk');
    expect(idxCleanup).toBeGreaterThan(idxInstall);
  });

  it('KHÔNG gọi installApk khi downloadApk reject do lỗi toàn vẹn', async () => {
    const integrityError = new Error('Bản tải không qua kiểm tra toàn vẹn. Đã xoá file tải về.');

    const mockPlugin = {
      addListener: vi.fn(async () => ({ remove: () => {} })),
      ensureInstallPermission: vi.fn(async () => ({ granted: true })),
      // Luôn reject lỗi toàn vẹn để kích hoạt chính sách thử lại.
      downloadApk: vi.fn(async () => { throw integrityError; }),
      installApk: vi.fn(async () => ({ launched: true })),
      cleanupApk: vi.fn(async () => ({ deleted: true })),
    };

    const updater = makeUpdater(mockPlugin);
    const result = await updater.downloadAndInstall(makeUpdateInfo());

    // Thất bại toàn vẹn: trạng thái error, cho phép thử lại thủ công (6.4).
    expect(result.status).toBe('error');
    expect(result.canRetry).toBe(true);

    // Chính sách thử lại: tối đa 2 lần tải (1 gốc + 1 tự thử lại).
    expect(mockPlugin.downloadApk).toHaveBeenCalledTimes(2);

    // BẤT BIẾN QUAN TRỌNG (Property 11): installApk KHÔNG bao giờ được gọi.
    expect(mockPlugin.installApk).not.toHaveBeenCalled();

    // Artifact hỏng được dọn dẹp (native cũng tự xoá; JS gọi cleanup idempotent).
    expect(mockPlugin.cleanupApk).toHaveBeenCalled();
  });
});
