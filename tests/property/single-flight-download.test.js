// ============================================================================
// Property test cho Mobile_Updater.downloadAndInstall (`js/mobile-updater.js`).
//
// Feature: auto-update-system, Property 14: Bất biến chỉ một tiến trình tải tại
// một thời điểm (single-flight) — với bất kỳ chuỗi lệnh yêu cầu tải cập nhật nào
// (kể cả các lệnh chồng lấn), số tiến trình tải đang hoạt động tại mọi thời điểm
// luôn <= 1: khi đã có một tiến trình tải đang chạy, mọi yêu cầu tải mới bị khoá
// (trả 'downloading') cho tới khi tiến trình hiện tại kết thúc.
//
// Validates: Requirements 3.4, 4.6
//
// Ghi chú: vitest bật `globals: true` nên describe/it/expect là biến toàn cục,
// KHÔNG require('vitest'). Chạy tối thiểu 100 vòng lặp.
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

// --- Tiện ích: Promise điều khiển được (deferred) ------------------------
// Cho phép mô phỏng một tiến trình tải "đang diễn ra" (chưa resolve ngay) để
// kiểm chứng khoá single-flight khi có lệnh tải chồng lấn.

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Xả toàn bộ microtask đang chờ (một macrotask setTimeout(0) flush hết microtask
// vì không có await nào chờ timer trong luồng downloadAndInstall).
function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

// --- Generators nền -------------------------------------------------------

/**
 * apkUrl HỢP LỆ (HTTPS + host thuộc allowlist GitHub) để vượt qua
 * `isAllowedReleaseUrl`, nhờ đó luồng tiến tới bước tải thật.
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
 * Tạo một plugin native mô phỏng, trong đó `downloadApk` KHÔNG resolve ngay mà
 * chờ một deferred do test điều khiển. Theo dõi số tiến trình tải đang hoạt
 * động (`activeDownloads`) và đỉnh (`maxActive`) để kiểm chứng bất biến <= 1.
 */
function createControllablePlugin(state) {
  return {
    async ensureInstallPermission() {
      return { granted: true };
    },
    async downloadApk() {
      state.downloadApkCalls += 1;
      state.activeDownloads += 1;
      if (state.activeDownloads > state.maxActive) {
        state.maxActive = state.activeDownloads;
      }
      const d = createDeferred();
      state.deferreds.push(d);
      try {
        await d.promise;
        return { filePath: '/data/user/0/app.ting.manager/files/ting-update.apk' };
      } finally {
        state.activeDownloads -= 1;
      }
    },
    async installApk() {
      return { launched: true };
    },
    async cleanupApk() {
      return { deleted: true };
    },
  };
}

function makeUpdater(tingUpdater) {
  return MobileUpdater.createMobileUpdater({
    versionCompare: VersionCompare,
    updateCore: UpdateCore,
    localStorage: createMemoryStorage(),
    navigator: { onLine: true },
    now: () => 1_700_000_000_000,
    installedVersionName: '1.3',
    installedVersionCode: 3,
    tingUpdater,
  });
}

// --- Property 14 ----------------------------------------------------------

describe('Mobile_Updater.downloadAndInstall — Property 14 (single-flight)', () => {
  it('nhiều lệnh tải CHỒNG LẤN ⇒ chỉ MỘT tiến trình tải hoạt động, các lệnh khác bị khoá', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Số lệnh tải chồng lấn thêm (>= 1) → tổng lệnh trong một đợt >= 2.
        fc.integer({ min: 1, max: 6 }),
        manifestArb,
        async (overlapCount, manifest) => {
          const state = { activeDownloads: 0, maxActive: 0, downloadApkCalls: 0, deferreds: [] };
          const updater = makeUpdater(createControllablePlugin(state));
          const info = { manifest, latestVersion: manifest.latestVersion };

          // 1) Khởi động tiến trình tải GỐC (không await — để nó "đang diễn ra").
          const primary = updater.downloadAndInstall(info);

          // 2) Bắn các lệnh tải CHỒNG LẤN trong khi tiến trình gốc chưa kết thúc.
          //    Mọi lệnh chồng lấn phải bị khoá và trả 'downloading' ngay.
          for (let i = 0; i < overlapCount; i += 1) {
            const overlap = await updater.downloadAndInstall(info);
            expect(overlap.status).toBe('downloading');
          }

          // 3) Đợi tiến trình gốc thực sự vào downloadApk (đang bị chặn ở deferred).
          await flush();

          // BẤT BIẾN: tại thời điểm này chỉ có ĐÚNG một tiến trình tải hoạt động,
          //           và downloadApk mới chỉ được khởi động một lần.
          expect(state.activeDownloads).toBe(1);
          expect(state.maxActive).toBeLessThanOrEqual(1);
          expect(state.downloadApkCalls).toBe(1);

          // 4) Giải phóng tiến trình gốc → hoàn tất tải + cài đặt.
          state.deferreds[state.deferreds.length - 1].resolve();
          const result = await primary;
          expect(result.status).toBe('downloaded');

          // Sau khi kết thúc: không còn tiến trình nào hoạt động; đỉnh vẫn <= 1.
          expect(state.activeDownloads).toBe(0);
          expect(state.maxActive).toBeLessThanOrEqual(1);
          // Toàn bộ đợt chỉ thực sự tải đúng MỘT lần dù có nhiều lệnh chồng lấn.
          expect(state.downloadApkCalls).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('chuỗi nhiều ĐỢT tải (mỗi đợt có lệnh chồng lấn) ⇒ tại mọi thời điểm số tiến trình tải <= 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Chuỗi các đợt: mỗi phần tử là số lệnh chồng lấn thêm (>= 1) trong đợt đó.
        fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 1, maxLength: 5 }),
        manifestArb,
        async (rounds, manifest) => {
          const state = { activeDownloads: 0, maxActive: 0, downloadApkCalls: 0, deferreds: [] };
          const updater = makeUpdater(createControllablePlugin(state));
          const info = { manifest, latestVersion: manifest.latestVersion };

          let expectedRealDownloads = 0;

          for (let r = 0; r < rounds.length; r += 1) {
            const overlapCount = rounds[r];

            // Tiến trình tải gốc của đợt (chưa await).
            const primary = updater.downloadAndInstall(info);

            // Các lệnh chồng lấn phải bị khoá trong khi tiến trình gốc còn chạy.
            for (let i = 0; i < overlapCount; i += 1) {
              const overlap = await updater.downloadAndInstall(info);
              expect(overlap.status).toBe('downloading');
            }

            // Chờ tiến trình gốc vào downloadApk → chỉ đúng 1 tiến trình hoạt động.
            await flush();
            expect(state.activeDownloads).toBe(1);
            expect(state.maxActive).toBeLessThanOrEqual(1);

            // Kết thúc đợt: giải phóng deferred, đợi tiến trình gốc hoàn tất.
            state.deferreds[state.deferreds.length - 1].resolve();
            const result = await primary;
            expect(result.status).toBe('downloaded');
            expect(state.activeDownloads).toBe(0);

            expectedRealDownloads += 1;
          }

          // Bất biến toàn cục: đỉnh số tiến trình tải đồng thời không bao giờ > 1.
          expect(state.maxActive).toBeLessThanOrEqual(1);
          // Mỗi đợt chỉ thực sự tải đúng một lần, bất kể số lệnh chồng lấn.
          expect(state.downloadApkCalls).toBe(expectedRealDownloads);
        },
      ),
      { numRuns: 100 },
    );
  });
});
