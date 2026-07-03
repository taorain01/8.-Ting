// ============================================================================
// Feature: auto-update-system — Task 6.4
//   Integration test cho luồng cập nhật DESKTOP qua electron-updater, dùng
//   `latest.yml` MẪU (tests/fixtures/latest.yml) + MOCK autoUpdater.
//
//   Vì luồng thật nằm trong `DongGoi/electron/main.cjs` và electron-updater cần
//   Electron runtime thật (không nạp được trong vitest/Node thuần, main.cjs có
//   side-effect lúc require), test này dựng lại TRUNG THỰC phần "wiring" của
//   `setupAutoUpdater` + `startUpdateDownload` trong `createDesktopUpdaterFlow`
//   dưới đây, sử dụng LẠI các module shared THẬT (update-core, version-compare)
//   giống hệt main.cjs. Mock autoUpdater mô phỏng đúng ngữ nghĩa event của
//   electron-updater (checking-for-update / update-available / download-progress
//   / update-downloaded / error) và các phương thức checkForUpdates /
//   downloadUpdate / quitAndInstall.
//
//   Phần chạy electron-updater THẬT với feed `latest.yml` cục bộ (Electron
//   runtime) được mô tả trong tests/integration/desktop-updater-manual.md.
//
//   Kiểm chứng:
//     1) checkForUpdates phát 'update-available' → TỰ ĐỘNG downloadUpdate,
//        rồi tiến độ → 'downloaded' (Yêu cầu 3.2, 3.3).
//     2) download-progress phát trạng thái 'downloading' kèm phần trăm (3.4).
//     3) update-downloaded → trạng thái 'downloaded', bật cài đặt (3.5).
//     4) IPC updates:quit-and-install gọi updater.quitAndInstall (3.6).
//     5) SINGLE-FLIGHT: nhiều 'update-available' chồng lấn chỉ tải MỘT lần (3.4).
//     6) Đang ở bản mới nhất → 'not-available' (3.7), KHÔNG tải.
//
//   Ghi chú: vitest bật `globals: true` nên describe/it/expect/vi là biến toàn
//   cục, KHÔNG require('vitest').
//
// Validates: Requirements 3.2, 3.3, 3.6
// ============================================================================

const fs = require('fs');
const path = require('path');

const { normalizeVersion, compareVersions } = require('../../js/shared/version-compare.js');
const { sanitizeUpdateMessage, appendUpdateLogEntry } = require('../../js/shared/update-core.js');

// ---------------------------------------------------------------------------
// Đọc `version` từ `latest.yml` mẫu (feed electron-updater) mà không cần thư
// viện YAML: metadata phát hành desktop chỉ cần trường `version` cho luồng này.
// ---------------------------------------------------------------------------
function readLatestYmlVersion() {
  const ymlPath = path.join(__dirname, '..', 'fixtures', 'latest.yml');
  const raw = fs.readFileSync(ymlPath, 'utf8');
  const match = raw.match(/^version:\s*(.+)$/m);
  if (!match) throw new Error('latest.yml mẫu thiếu trường version');
  return match[1].trim();
}

// ---------------------------------------------------------------------------
// store giả lập (thay electron-store): get(key, default) / set(key, value).
// ---------------------------------------------------------------------------
function makeMemoryStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get: (key, fallback) => (map.has(key) ? map.get(key) : fallback),
    set: (key, value) => { map.set(key, value); },
  };
}

// ---------------------------------------------------------------------------
// Mock autoUpdater mô phỏng electron-updater: đăng ký handler qua `.on`, phát
// event qua `.emit`, và các phương thức checkForUpdates/downloadUpdate/
// quitAndInstall trả về Promise + phát chuỗi event tương ứng theo kịch bản.
//
//   scenario.available: true  → checkForUpdates phát 'update-available'
//                        false → phát 'update-not-available'
//   scenario.version:  phiên bản Latest_Version công bố trong feed.
//   scenario.progressSteps: mảng phần trăm phát ra khi downloadUpdate chạy.
// ---------------------------------------------------------------------------
function makeMockAutoUpdater(scenario) {
  const handlers = new Map();
  const calls = { downloadUpdate: 0, checkForUpdates: 0, quitAndInstall: 0 };

  const updater = {
    autoDownload: true, // main.cjs sẽ đặt lại thành false trong setupAutoUpdater
    calls,
    on(event, cb) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(cb);
      return updater;
    },
    emit(event, payload) {
      const list = handlers.get(event) || [];
      for (const cb of list) cb(payload);
    },
    async checkForUpdates() {
      calls.checkForUpdates += 1;
      updater.emit('checking-for-update');
      if (scenario.available) {
        updater.emit('update-available', { version: scenario.version });
      } else {
        updater.emit('update-not-available', { version: scenario.version });
      }
      return { updateInfo: { version: scenario.version } };
    },
    async downloadUpdate() {
      calls.downloadUpdate += 1;
      // Mô phỏng tiến độ tải rồi hoàn tất (electron-updater phát 'download-progress'
      // nhiều lần, sau đó 'update-downloaded').
      for (const percent of (scenario.progressSteps || [])) {
        updater.emit('download-progress', { percent, transferred: percent, total: 100 });
      }
      updater.emit('update-downloaded', { version: scenario.version });
      return [`Ting-setup-${scenario.version}.exe`];
    },
    quitAndInstall() {
      calls.quitAndInstall += 1;
      return true;
    },
  };

  return updater;
}

// ---------------------------------------------------------------------------
// createDesktopUpdaterFlow — dựng lại TRUNG THỰC wiring của
// `setupAutoUpdater` + `startUpdateDownload` + IPC `updates:*` trong
// `DongGoi/electron/main.cjs` (dùng lại module shared thật). Trả về các hàm
// tương ứng IPC để test kích hoạt.
// ---------------------------------------------------------------------------
function createDesktopUpdaterFlow({ updater, store, sendToRenderer, getAppVersion }) {
  // KHOÁ single-flight cho luồng tải (Yêu cầu 3.4) — tương ứng biến
  // `updateDownloadInFlight` ở main.cjs.
  let updateDownloadInFlight = false;

  function appendUpdateLog(entry) {
    const current = store.get('updateLog', []) || [];
    const next = appendUpdateLogEntry(current, {
      ...entry,
      date: new Date().toLocaleString('vi-VN'),
    });
    store.set('updateLog', next);
    return next;
  }

  function sendUpdateEvent(payload) {
    const log = store.get('updateLog', []) || [];
    sendToRenderer('update-event', {
      ...payload,
      message: sanitizeUpdateMessage(payload?.message),
      log,
    });
  }

  function logAndSendUpdateEvent(payload, logEntry) {
    const log = logEntry
      ? appendUpdateLog(logEntry)
      : (store.get('updateLog', []) || []);
    sendToRenderer('update-event', {
      ...payload,
      message: sanitizeUpdateMessage(payload?.message),
      log,
    });
    return log;
  }

  // Single-flight: nếu đã có tiến trình tải đang chạy thì bỏ qua yêu cầu mới.
  function startUpdateDownload() {
    if (!updater) return false;
    if (updateDownloadInFlight) return false;
    updateDownloadInFlight = true;
    Promise.resolve()
      .then(() => updater.downloadUpdate())
      .catch(error => {
        updateDownloadInFlight = false;
        logAndSendUpdateEvent(
          { status: 'error', type: 'error', message: error?.message || 'Không thể tải bản cập nhật' },
          { version: 'unknown', status: 'error', source: 'github' },
        );
      });
    return true;
  }

  // ==== setupAutoUpdater: đăng ký handler event electron-updater ====
  updater.autoDownload = false;

  updater.on('checking-for-update', () => {
    sendUpdateEvent({ status: 'checking', message: 'Đang kiểm tra cập nhật...' });
  });
  updater.on('update-available', info => {
    logAndSendUpdateEvent(
      { status: 'available', message: `Có bản cập nhật ${info?.version || ''}`, info },
      { version: info?.version || 'unknown', status: 'available', source: 'github' },
    );
    startUpdateDownload();
  });
  updater.on('update-not-available', info => {
    logAndSendUpdateEvent(
      { status: 'not-available', message: 'Đang ở bản mới nhất', info },
      { version: info?.version || normalizeVersion(getAppVersion()), status: 'not-available', source: 'github' },
    );
  });
  updater.on('download-progress', progress => {
    sendUpdateEvent({
      status: 'downloading',
      message: `Đang tải ${Math.round(progress?.percent || 0)}%`,
      progress,
    });
  });
  updater.on('update-downloaded', info => {
    updateDownloadInFlight = false;
    logAndSendUpdateEvent(
      { status: 'downloaded', message: `Bản cập nhật đã sẵn sàng${info?.version ? ` (${info.version})` : ''}`, info },
      { version: info?.version || 'unknown', status: 'downloaded', source: 'github' },
    );
  });
  updater.on('error', error => {
    updateDownloadInFlight = false;
    logAndSendUpdateEvent(
      { status: 'error', type: 'error', message: error?.message || 'Lỗi cập nhật' },
      { version: 'unknown', status: 'error', source: 'github' },
    );
  });

  return {
    // IPC updates:check → checkForUpdates() (các event phát qua handler ở trên).
    async check() {
      const result = await updater.checkForUpdates();
      return { ok: true, source: 'electron-updater', version: result?.updateInfo?.version };
    },
    // IPC updates:quit-and-install → quitAndInstall().
    quitAndInstall() {
      if (!updater) return false;
      updater.quitAndInstall();
      return true;
    },
    // IPC updates:get-log.
    getLog() {
      return store.get('updateLog', []) || [];
    },
  };
}

// Tiện ích dựng đủ bộ đôi (mock updater + flow) với các phần bơm giả lập.
function makeHarness(scenario, { installedVersion = '1.3.0' } = {}) {
  const events = [];
  const store = makeMemoryStore({ updateLog: [] });
  const updater = makeMockAutoUpdater(scenario);
  const flow = createDesktopUpdaterFlow({
    updater,
    store,
    sendToRenderer: (_channel, payload) => events.push(payload),
    getAppVersion: () => installedVersion,
  });
  return { events, store, updater, flow };
}

describe('Desktop_Updater — luồng electron-updater với latest.yml mẫu (mock updater)', () => {
  it('phát hiện bản mới từ latest.yml → tự động tải → sẵn sàng cài đặt', async () => {
    const latestVersion = readLatestYmlVersion(); // '1.4.0' từ fixture

    // latest.yml công bố version mới hơn Installed_Version → có bản cập nhật.
    expect(compareVersions(latestVersion, '1.3.0')).toBe(1);

    const { events, updater, flow } = makeHarness({
      available: true,
      version: latestVersion,
      progressSteps: [10, 55, 100],
    });

    const result = await flow.check();
    // Cho các Promise trong startUpdateDownload (downloadUpdate) hoàn tất.
    await Promise.resolve();
    await Promise.resolve();

    expect(result.ok).toBe(true);
    expect(result.source).toBe('electron-updater');
    expect(result.version).toBe(latestVersion);

    // setupAutoUpdater phải tắt auto-download để tự kiểm soát single-flight.
    expect(updater.autoDownload).toBe(false);

    // 3.2/3.3: phát hiện update-available → downloadUpdate được gọi (đúng 1 lần).
    expect(updater.calls.downloadUpdate).toBe(1);

    // Chuỗi trạng thái phát ra: checking → available → downloading... → downloaded.
    const statuses = events.map(e => e.status);
    expect(statuses[0]).toBe('checking');
    expect(statuses).toContain('available');
    expect(statuses).toContain('downloading');
    expect(statuses[statuses.length - 1]).toBe('downloaded');

    // 3.4: sự kiện downloading kèm phần trăm hợp lệ.
    const downloading = events.filter(e => e.status === 'downloading');
    expect(downloading.length).toBe(3);
    expect(downloading.map(e => Math.round(e.progress.percent))).toEqual([10, 55, 100]);

    // 3.5: trạng thái downloaded kèm phiên bản đã tải + thông báo tiếng Việt.
    const downloaded = events.find(e => e.status === 'downloaded');
    expect(downloaded.info.version).toBe(latestVersion);
    expect(downloaded.message).toContain('Bản cập nhật đã sẵn sàng');

    // 6.5: mọi event đính kèm nhật ký; mục mới nhất (downloaded) ở đầu, <= 10 mục.
    expect(downloaded.log.length).toBeLessThanOrEqual(10);
    expect(downloaded.log[0].status).toBe('downloaded');
  });

  it('SINGLE-FLIGHT: nhiều update-available chồng lấn chỉ tải MỘT lần (3.4)', async () => {
    const { updater, flow } = makeHarness({
      available: true,
      version: '1.4.0',
      // Không phát progress/downloaded ngay để giữ khoá đang được giữ khi
      // các update-available sau ập tới.
      progressSteps: [],
    });

    // Ghi đè downloadUpdate: KHÔNG tự hoàn tất (không phát update-downloaded),
    // giữ khoá single-flight đang được giữ để kiểm chồng lấn.
    updater.downloadUpdate = async () => {
      updater.calls.downloadUpdate += 1;
      // treo lơ lửng — khoá vẫn giữ.
      return new Promise(() => {});
    };

    await flow.check();               // update-available #1 → bắt đầu tải (giữ khoá)
    updater.emit('update-available', { version: '1.4.0' }); // #2 khi đang tải
    updater.emit('update-available', { version: '1.4.0' }); // #3 khi đang tải
    await Promise.resolve();

    // BẤT BIẾN single-flight (Property 14 / Yêu cầu 3.4): chỉ MỘT tiến trình tải.
    expect(updater.calls.downloadUpdate).toBe(1);
  });

  it('IPC updates:quit-and-install gọi updater.quitAndInstall (3.6)', async () => {
    const { updater, flow } = makeHarness({ available: true, version: '1.4.0', progressSteps: [100] });

    await flow.check();
    await Promise.resolve();
    await Promise.resolve();

    const ok = flow.quitAndInstall();
    expect(ok).toBe(true);
    expect(updater.calls.quitAndInstall).toBe(1);
  });

  it('đang ở bản mới nhất → trạng thái not-available, KHÔNG tải (3.7)', async () => {
    // latest.yml công bố version bằng Installed_Version → không có bản cập nhật.
    const { events, updater, flow } = makeHarness(
      { available: false, version: '1.3.0', progressSteps: [] },
      { installedVersion: '1.3.0' },
    );

    await flow.check();
    await Promise.resolve();

    const statuses = events.map(e => e.status);
    expect(statuses).toContain('not-available');
    expect(updater.calls.downloadUpdate).toBe(0);

    const notAvailable = events.find(e => e.status === 'not-available');
    expect(notAvailable.message).toContain('Đang ở bản mới nhất');
  });
});
