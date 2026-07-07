// ============================================================================
// Property test cho Mobile_Updater.downloadAndInstall (`js/mobile-updater.js`).
//
// Feature: auto-update-system, Property 11: Chính sách thử lại khi lỗi toàn vẹn
// không bao giờ cài đặt — với bất kỳ kịch bản nào mà bản tải LIÊN TỤC không qua
// kiểm tra toàn vẹn, luồng cập nhật thực hiện tối đa 2 lần tải (1 lần gốc + tối
// đa 1 lần tự thử lại) rồi dừng, VÀ trình cài đặt (installApk) KHÔNG BAO GIỜ
// được khởi chạy trong mọi trường hợp thất bại toàn vẹn.
//
// Validates: Requirements 6.4
// ============================================================================

const fc = require('fast-check');
const MobileUpdater = require('../../js/mobile-updater.js');
const VersionCompare = require('../../js/shared/version-compare.js');
const UpdateCore = require('../../js/shared/update-core.js');

// --- Tiện ích: localStorage giả lập trong bộ nhớ (không I/O thật) --------

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

// --- Generators nền -------------------------------------------------------

/**
 * Sinh apkUrl HỢP LỆ (HTTPS + host thuộc allowlist GitHub) để vượt qua
 * `isAllowedReleaseUrl`, nhờ đó luồng tiến tới bước tải và ta kiểm chứng được
 * chính sách thử lại toàn vẹn.
 */
const validApkUrlArb = fc
  .tuple(
    fc.constantFrom(
      'github.com',
      'raw.githubusercontent.com',
      'objects.githubusercontent.com',
      'release-assets.githubusercontent.com',
    ),
    fc.stringMatching(/^[a-zA-Z0-9._-]{1,20}$/),
    fc.integer({ min: 0, max: 99 }),
  )
  .map(([host, name, patch]) => `https://${host}/taorain01/ting-releases/releases/download/v1.4.${patch}/${name}.apk`);

/** Manifest tối thiểu đủ thông tin toàn vẹn để luồng đi tới bước tải. */
const manifestArb = fc.record({
  latestVersion: fc.stringMatching(/^1\.[4-9]\.[0-9]$/),
  versionCode: fc.integer({ min: 4, max: 1000 }),
  apkUrl: validApkUrlArb,
  apkSize: fc.integer({ min: 1, max: 5_000_000_000 }),
  apkSha256: fc.hexaString({ minLength: 64, maxLength: 64 }),
});

/**
 * Sinh một lỗi TOÀN VẸN theo nhiều dạng plugin native có thể reject:
 *   - `err.code === 'INTEGRITY_FAILED'`
 *   - message chứa từ khoá "toàn vẹn" / "integrity" / "checksum" / "sha256"
 * Có thể kèm `filePath` để kiểm chứng nhánh dọn dẹp idempotent.
 */
const integrityErrorArb = fc.oneof(
  fc.record({ code: fc.constant('INTEGRITY_FAILED'), message: fc.string() }),
  fc.record({ message: fc.constantFrom(
    'Bản tải không qua kiểm tra toàn vẹn',
    'integrity check failed',
    'checksum mismatch',
    'sha256 mismatch',
  ) }),
).map((base) => Object.assign(new Error(base.message || 'integrity'), base));

// --- Property 11 ----------------------------------------------------------

describe('Mobile_Updater.downloadAndInstall — Property 11 (chính sách thử lại toàn vẹn)', () => {
  it('lỗi toàn vẹn LIÊN TỤC ⇒ tải tối đa 2 lần, KHÔNG BAO GIỜ cài đặt', async () => {
    await fc.assert(
      fc.asyncProperty(
        manifestArb,
        integrityErrorArb,
        fc.boolean(), // có kèm filePath trong lỗi để test nhánh dọn dẹp
        fc.boolean(), // plugin có hàm ensureInstallPermission hay không
        async (manifest, integrityError, withFilePath, hasEnsurePermission) => {
          let downloadApkCalls = 0;
          let installApkCalls = 0;
          let cleanupApkCalls = 0;

          const tingUpdater = {
            async downloadApk() {
              downloadApkCalls += 1;
              // Luôn reject bằng lỗi toàn vẹn (mô phỏng bản tải hỏng liên tục).
              const err = integrityError;
              if (withFilePath) err.filePath = '/data/ting-update.apk';
              throw err;
            },
            async installApk() {
              installApkCalls += 1;
              return { installed: true };
            },
            async cleanupApk() {
              cleanupApkCalls += 1;
            },
          };

          if (hasEnsurePermission) {
            tingUpdater.ensureInstallPermission = async () => {};
          }

          const updater = MobileUpdater.createMobileUpdater({
            versionCompare: VersionCompare,
            updateCore: UpdateCore,
            localStorage: createMemoryStorage(),
            now: () => 1_700_000_000_000,
            tingUpdater,
          });

          const info = { manifest, latestVersion: manifest.latestVersion };
          const result = await updater.downloadAndInstall(info);

          // 1) Tổng số lần tải KHÔNG vượt quá 2 (1 gốc + tối đa 1 thử lại).
          expect(downloadApkCalls).toBeGreaterThanOrEqual(1);
          expect(downloadApkCalls).toBeLessThanOrEqual(2);

          // 2) Installer KHÔNG BAO GIỜ được khởi chạy khi thất bại toàn vẹn.
          expect(installApkCalls).toBe(0);

          // 3) Kết thúc ở trạng thái lỗi và cho phép thử lại thủ công.
          expect(result.status).toBe('error');
          expect(result.canRetry).toBe(true);

          // 4) APK cũ được dọn trước khi tải, artifact hỏng được dọn sau mỗi lần fail.
          expect(cleanupApkCalls).toBe(downloadApkCalls + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('lỗi toàn vẹn liên tục ⇒ đúng 2 lần tải (thử lại đúng 1 lần)', async () => {
    await fc.assert(
      fc.asyncProperty(manifestArb, integrityErrorArb, async (manifest, integrityError) => {
        let downloadApkCalls = 0;
        let installApkCalls = 0;

        const tingUpdater = {
          async downloadApk() {
            downloadApkCalls += 1;
            throw integrityError;
          },
          async installApk() {
            installApkCalls += 1;
          },
          async cleanupApk() {},
        };

        const updater = MobileUpdater.createMobileUpdater({
          versionCompare: VersionCompare,
          updateCore: UpdateCore,
          localStorage: createMemoryStorage(),
          now: () => 1_700_000_000_000,
          tingUpdater,
        });

        await updater.downloadAndInstall({ manifest });

        // Lỗi toàn vẹn LIÊN TỤC luôn kích hoạt đúng 1 lần thử lại ⇒ tổng 2 lần.
        expect(downloadApkCalls).toBe(2);
        expect(installApkCalls).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});
