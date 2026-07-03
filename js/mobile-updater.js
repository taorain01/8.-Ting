/*
 * ============================================================================
 *  Mobile_Updater (Update_System — tầng cạnh Android / webview)
 *  File: js/mobile-updater.js
 * ============================================================================
 *
 * Điều phối luồng cập nhật cho bản Android (APK cài ngoài, Capacitor) chạy
 * trong WEBVIEW. Khác với các module `js/shared/*` (thuần, không I/O), file này
 * là TẦNG CẠNH: nó dùng `fetch` (HTTPS) và `localStorage`, đồng thời tái sử
 * dụng toàn bộ logic quyết định từ các module dùng chung để không phân kỳ hành
 * vi với desktop.
 *
 * Nạp trong webview (SAU khi đã nạp các module dùng chung):
 *   <script src="js/shared/types.js"></script>
 *   <script src="js/shared/version-compare.js"></script>
 *   <script src="js/shared/update-core.js"></script>
 *   <script src="js/mobile-updater.js"></script>
 *   // dùng: window.TingMobileUpdater.checkForUpdate()
 *
 * TASK 7.1 — file này CHỈ hiện thực `checkForUpdate`. Các hàm
 * `downloadAndInstall` / `onProgress` / chính sách thử lại toàn vẹn thuộc task
 * 7.2 và sẽ được bổ sung sau (đã chừa chỗ ở object export).
 *
 * KIỂM THỬ: tuy là tầng cạnh, module cho phép BƠM PHỤ THUỘC (fetch,
 * localStorage, navigator, versionCompare, updateCore, now, installedVersion...)
 * qua `createMobileUpdater(overrides)` để test được trong Node/Vitest mà không
 * cần webview thật. Bản mặc định `window.TingMobileUpdater` lấy phụ thuộc từ
 * `window`/`globalThis` khi chạy trong webview.
 * ============================================================================
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    // Node.js / Vitest: xuất factory + các hằng số để kiểm thử.
    module.exports = factory(root);
  } else {
    // Webview / trình duyệt: gắn factory + một instance mặc định vào global.
    const api = factory(root);
    root.TingMobileUpdater = api.createMobileUpdater();
    root.TingMobileUpdaterFactory = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // ---- Hằng số cấu hình -------------------------------------------------

  /**
   * URL cố định của Release_Manifest (`version.json`) trên nhánh `main` của
   * Releases_Repository công khai. Đọc qua HTTPS, KHÔNG cần xác thực
   * (Requirement 4.1, 9.3).
   * @type {string}
   */
  const RELEASE_MANIFEST_URL =
    'https://raw.githubusercontent.com/taorain01/ting-releases/main/version.json';

  /**
   * Phiên bản đang cài trên Android (khớp `versionName`/`versionCode` trong
   * cấu hình Capacitor: versionName "1.3.4", versionCode 10304).
   */
  const INSTALLED_VERSION_NAME = '1.3.4';
  const INSTALLED_VERSION_CODE = 10304;

  /** Khóa localStorage cho nhật ký cập nhật và mốc Background_Check. */
  const STORAGE_KEY_UPDATE_LOG = 'ting.update.log';
  const STORAGE_KEY_LAST_BACKGROUND_CHECK = 'ting.update.lastBackgroundCheck';

  /** Nguồn phát hiện bản cập nhật (dùng cho UpdateLogEntry/UpdateInfo). */
  const UPDATE_SOURCE = 'manifest';

  /**
   * Tên plugin Capacitor native (APK_Installer). Dùng để phân giải qua
   * `Capacitor.Plugins.TingUpdater` hoặc `Capacitor.registerPlugin('TingUpdater')`.
   * @type {string}
   */
  const NATIVE_PLUGIN_NAME = 'TingUpdater';

  /** Tên event tiến độ tải do plugin native phát ra (`notifyListeners`). */
  const PLUGIN_PROGRESS_EVENT = 'downloadProgress';

  /**
   * Tổng số lần tải tối đa khi gặp lỗi TOÀN VẸN: 1 lần gốc + tối đa 1 lần tự
   * thử lại = 2. Sau đó dừng và yêu cầu thử lại thủ công (Requirement 6.4).
   * KHÔNG bao giờ khởi chạy installer khi thất bại toàn vẹn (Property 11).
   * @type {number}
   */
  const MAX_DOWNLOAD_ATTEMPTS = 2;

  // ---- Thông báo tiếng Việt (bản địa hoá) ------------------------------

  const MSG_OFFLINE = 'Không có kết nối mạng';
  const MSG_HTTP_ERROR = 'Không thể kết nối tới nguồn phát hành. Vui lòng thử lại sau.';
  const MSG_MANIFEST_INVALID = 'Dữ liệu phát hành không hợp lệ. Vui lòng thử lại sau.';
  const MSG_UNTRUSTED_URL = 'Nguồn cập nhật không hợp lệ.';
  const MSG_UP_TO_DATE = 'Đang ở bản mới nhất';
  const MSG_UPDATE_AVAILABLE = 'Đã có bản cập nhật mới';

  // ---- Thông báo cho luồng tải & cài đặt (task 7.2) --------------------

  /** Đang có một tiến trình tải diễn ra (khoá single-flight — Requirement 4.6). */
  const MSG_ALREADY_DOWNLOADING = 'Đang tải bản cập nhật...';
  /** Không phân giải được plugin native (thiết bị/không phải Android). */
  const MSG_NO_INSTALLER = 'Không thể cài đặt bản cập nhật trên thiết bị này.';
  /** Thiếu thông tin toàn vẹn (sha256/size) trong manifest. */
  const MSG_MISSING_INTEGRITY_INFO = 'Dữ liệu phát hành thiếu thông tin để xác minh bản cập nhật.';
  /** Ghi log mỗi lần lỗi toàn vẹn trước khi thử lại. */
  const MSG_INTEGRITY_FAILED = 'Bản tải không qua kiểm tra toàn vẹn. Đã xoá file tải về.';
  /** Lỗi toàn vẹn kéo dài sau khi đã tự thử lại → cần thử lại thủ công (6.4). */
  const MSG_INTEGRITY_RETRY_MANUAL =
    'Bản tải không qua kiểm tra toàn vẹn sau khi thử lại. Vui lòng bấm thử lại.';
  /** Tải thất bại giữa chừng (không phải lỗi toàn vẹn) → bật lại nút thử lại (6.3). */
  const MSG_DOWNLOAD_FAILED = 'Tải bản cập nhật thất bại. Vui lòng thử lại.';
  /** Không khởi chạy được trình cài đặt sau khi tải & xác minh thành công. */
  const MSG_INSTALL_FAILED = 'Không thể khởi chạy trình cài đặt. Vui lòng thử lại.';
  /** Tải + xác minh thành công, đã mời cài đặt. */
  const MSG_UPDATE_READY = 'Bản cập nhật đã sẵn sàng';

  // ---- Tiện ích nội bộ --------------------------------------------------

  /**
   * Định dạng mốc thời gian theo vi-VN cho nhật ký; có fallback an toàn khi
   * môi trường không hỗ trợ `toLocaleString('vi-VN')`.
   * @param {number} epochMs
   * @returns {string}
   */
  function formatDateVi(epochMs) {
    const date = new Date(epochMs);
    try {
      return date.toLocaleString('vi-VN');
    } catch (err) {
      return date.toISOString();
    }
  }

  // ---- Factory ----------------------------------------------------------

  /**
   * Tạo một instance Mobile_Updater với phụ thuộc có thể bơm (dependency
   * injection). Khi chạy trong webview, các phụ thuộc mặc định lấy từ global.
   *
   * @param {Object} [overrides]
   * @param {typeof fetch}      [overrides.fetch]        Hàm fetch (mặc định `root.fetch`).
   * @param {Storage}           [overrides.localStorage] Kho localStorage (mặc định `root.localStorage`).
   * @param {Navigator}         [overrides.navigator]    Đối tượng navigator (mặc định `root.navigator`).
   * @param {Object}            [overrides.versionCompare] Module Version_Comparator.
   * @param {Object}            [overrides.updateCore]     Module Update_Core.
   * @param {() => number}      [overrides.now]          Hàm lấy thời gian hiện tại (epoch ms).
   * @param {string}            [overrides.manifestUrl]  URL Release_Manifest.
   * @param {string}            [overrides.installedVersionName] versionName đang cài.
   * @param {number}            [overrides.installedVersionCode] versionCode đang cài.
   * @param {Object}            [overrides.tingUpdater]  Plugin native APK_Installer (bơm để test).
   * @param {Object}            [overrides.capacitor]    Đối tượng Capacitor (mặc định `root.Capacitor`).
   * @returns {{ checkForUpdate: Function, downloadAndInstall: Function, onProgress: Function, cleanupDownloadedApk: Function, readUpdateLog: Function, getLastBackgroundCheck: Function, RELEASE_MANIFEST_URL: string }}
   */
  function createMobileUpdater(overrides) {
    const deps = overrides || {};

    const shared = (root && root.TingShared) || {};
    const versionCompare = deps.versionCompare || shared.VersionCompare;
    const updateCore = deps.updateCore || shared.UpdateCore;

    const fetchFn = Object.prototype.hasOwnProperty.call(deps, 'fetch')
      ? deps.fetch
      : (root && typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    const storage = deps.localStorage
      || (root && root.localStorage) || null;
    const nav = deps.navigator || (root && root.navigator) || null;
    const now = typeof deps.now === 'function' ? deps.now : function () { return Date.now(); };

    const manifestUrl = deps.manifestUrl || RELEASE_MANIFEST_URL;
    const installedVersionName = deps.installedVersionName || INSTALLED_VERSION_NAME;
    const installedVersionCode = typeof deps.installedVersionCode === 'number'
      ? deps.installedVersionCode
      : INSTALLED_VERSION_CODE;

    if (!versionCompare || !updateCore) {
      throw new Error('Mobile_Updater cần TingShared.VersionCompare và TingShared.UpdateCore.');
    }

    /**
     * Phân giải plugin native APK_Installer (`TingUpdater`). Ưu tiên phụ thuộc
     * được bơm (`deps.tingUpdater`) để test; ngược lại lấy từ Capacitor
     * (`Capacitor.Plugins.TingUpdater` hoặc `Capacitor.registerPlugin`).
     * @returns {Object|null}
     */
    function resolveNativePlugin() {
      if (deps.tingUpdater) return deps.tingUpdater;
      const cap = deps.capacitor || (root && root.Capacitor) || null;
      if (!cap) return null;
      if (cap.Plugins && cap.Plugins[NATIVE_PLUGIN_NAME]) {
        return cap.Plugins[NATIVE_PLUGIN_NAME];
      }
      if (typeof cap.registerPlugin === 'function') {
        try {
          return cap.registerPlugin(NATIVE_PLUGIN_NAME);
        } catch (err) {
          return null;
        }
      }
      return null;
    }

    // ---- localStorage: nhật ký & mốc Background_Check ------------------

    /**
     * Đọc nhật ký cập nhật từ localStorage. Trả về mảng rỗng nếu chưa có hoặc
     * dữ liệu hỏng (không ném lỗi ra ngoài).
     * @returns {Array<import('./shared/types.js').UpdateLogEntry>}
     */
    function readUpdateLog() {
      if (!storage) return [];
      try {
        const raw = storage.getItem(STORAGE_KEY_UPDATE_LOG);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }

    /**
     * Ghi một mục nhật ký mới (dùng Update_Core để cắt còn 10 mục, mới nhất ở
     * đầu) và lưu lại localStorage. Trả về nhật ký sau khi ghi.
     * @param {{ version: string, status: string, message?: string }} entry
     * @returns {Array<import('./shared/types.js').UpdateLogEntry>}
     */
    function writeUpdateLogEntry(entry) {
      const fullEntry = {
        version: entry.version,
        status: entry.status,
        source: UPDATE_SOURCE,
        message: entry.message,
        date: formatDateVi(now()),
      };
      const nextLog = updateCore.appendUpdateLogEntry(readUpdateLog(), fullEntry);
      if (storage) {
        try {
          storage.setItem(STORAGE_KEY_UPDATE_LOG, JSON.stringify(nextLog));
        } catch (err) {
          /* localStorage đầy/không khả dụng — bỏ qua, không chặn luồng kiểm tra. */
        }
      }
      return nextLog;
    }

    /**
     * Đọc mốc Background_Check gần nhất (epoch ms) hoặc `null` nếu chưa từng.
     * @returns {number|null}
     */
    function getLastBackgroundCheck() {
      if (!storage) return null;
      try {
        const raw = storage.getItem(STORAGE_KEY_LAST_BACKGROUND_CHECK);
        if (raw === null || raw === undefined || raw === '') return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
      } catch (err) {
        return null;
      }
    }

    /**
     * Ghi mốc Background_Check hiện tại vào localStorage.
     * @param {number} epochMs
     */
    function setLastBackgroundCheck(epochMs) {
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY_LAST_BACKGROUND_CHECK, String(epochMs));
      } catch (err) {
        /* bỏ qua lỗi lưu trữ */
      }
    }

    // ---- checkForUpdate -----------------------------------------------

    /**
     * Kiểm tra cập nhật Android: tải `version.json`, xác thực nguồn, phân tích
     * manifest, so sánh version code, phân loại trạng thái, và ghi nhật ký.
     *
     * Không ném lỗi ra ngoài: mọi lỗi (offline, HTTP, manifest sai) được ánh
     * xạ thành một kết quả có `status` và `message` tiếng Việt an toàn.
     *
     * @param {Object} [options]
     * @param {boolean} [options.background=false] Đánh dấu đây là Background_Check
     *        để cập nhật mốc thời gian trong localStorage.
     * @returns {Promise<{
     *   status: ('update-available'|'up-to-date'|'error'|'offline'),
     *   message: string,
     *   info: (import('./shared/types.js').UpdateInfo|null)
     * }>}
     */
    async function checkForUpdate(options) {
      const isBackground = Boolean(options && options.background);
      if (isBackground) {
        setLastBackgroundCheck(now());
      }

      // 1) Chỉ chấp nhận URL manifest thuộc origin tin cậy qua HTTPS (9.3).
      if (!updateCore.isAllowedReleaseUrl(manifestUrl)) {
        writeUpdateLogEntry({ version: installedVersionName, status: 'error', message: MSG_UNTRUSTED_URL });
        return { status: 'error', message: MSG_UNTRUSTED_URL, info: null };
      }

      // 2) Không có mạng → offline, KHÔNG báo có cập nhật (6.1).
      if (nav && nav.onLine === false) {
        writeUpdateLogEntry({ version: installedVersionName, status: 'offline', message: MSG_OFFLINE });
        return { status: 'offline', message: MSG_OFFLINE, info: null };
      }

      if (typeof fetchFn !== 'function') {
        writeUpdateLogEntry({ version: installedVersionName, status: 'error', message: MSG_HTTP_ERROR });
        return { status: 'error', message: MSG_HTTP_ERROR, info: null };
      }

      // 3) Tải manifest qua HTTPS, không xác thực (4.1, 9.3).
      let response;
      try {
        response = await fetchFn(manifestUrl, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'follow',
          headers: { Accept: 'application/json' },
        });
      } catch (err) {
        // Lỗi mạng khi đang "online" → coi như mất kết nối (6.1).
        const message = (nav && nav.onLine === false) ? MSG_OFFLINE : MSG_OFFLINE;
        writeUpdateLogEntry({ version: installedVersionName, status: 'offline', message });
        return { status: 'offline', message, info: null };
      }

      // 4) Nguồn phát hành trả lỗi HTTP → error, giữ nguyên Installed_Version (6.2).
      if (!response || !response.ok) {
        const raw = 'HTTP ' + (response ? response.status : 'error');
        const message = updateCore.sanitizeUpdateMessage(MSG_HTTP_ERROR + ' (' + raw + ')');
        writeUpdateLogEntry({ version: installedVersionName, status: 'error', message });
        return { status: 'error', message, info: null };
      }

      // 5) Đọc & phân tích manifest theo schema (4.2).
      let bodyText;
      try {
        bodyText = await response.text();
      } catch (err) {
        writeUpdateLogEntry({ version: installedVersionName, status: 'error', message: MSG_MANIFEST_INVALID });
        return { status: 'error', message: MSG_MANIFEST_INVALID, info: null };
      }

      const parsed = updateCore.parseReleaseManifest(bodyText);
      if (!parsed.ok || !parsed.manifest) {
        const message = updateCore.sanitizeUpdateMessage(parsed.error || MSG_MANIFEST_INVALID);
        writeUpdateLogEntry({ version: installedVersionName, status: 'error', message });
        return { status: 'error', message: MSG_MANIFEST_INVALID, info: null };
      }

      const manifest = parsed.manifest;

      // 6) Guard thêm: URL tải APK cũng phải thuộc origin tin cậy (9.3).
      if (!updateCore.isAllowedReleaseUrl(manifest.apkUrl)) {
        writeUpdateLogEntry({ version: manifest.latestVersion, status: 'error', message: MSG_UNTRUSTED_URL });
        return { status: 'error', message: MSG_UNTRUSTED_URL, info: null };
      }

      // 7) So sánh VERSION CODE bằng Version_Comparator, phân loại trạng thái
      //    (4.3, 4.8). installed >= latest → up-to-date; latest > installed →
      //    update-available.
      const classification = versionCompare.classifyUpdateStatus(
        installedVersionCode,
        manifest.versionCode
      );
      const distance = versionCompare.versionDistance(
        installedVersionCode,
        manifest.versionCode
      );

      /** @type {import('./shared/types.js').UpdateInfo} */
      const info = {
        currentVersion: installedVersionName,
        latestVersion: manifest.latestVersion,
        releaseNotes: manifest.releaseNotes,
        releaseUrl: manifest.apkUrl,
        source: UPDATE_SOURCE,
        distance: distance,
        manifest: manifest,
      };

      if (classification === 'up-to-date') {
        // 4.8: version code đã cài >= manifest → "Đang ở bản mới nhất".
        writeUpdateLogEntry({
          version: manifest.latestVersion,
          status: 'up-to-date',
          message: MSG_UP_TO_DATE,
        });
        return { status: 'up-to-date', message: MSG_UP_TO_DATE, info: info };
      }

      // 4.4: có bản cập nhật → trả latestVersion + release notes cho UI.
      writeUpdateLogEntry({
        version: manifest.latestVersion,
        status: 'update-available',
        message: MSG_UPDATE_AVAILABLE,
      });
      return { status: 'update-available', message: MSG_UPDATE_AVAILABLE, info: info };
    }

    // ---- Tiến độ tải: onProgress + cầu nối event plugin ---------------

    /** Danh sách callback nhận tiến độ phần trăm (0..100). */
    const progressCallbacks = [];
    /** Handle của listener plugin (đăng ký một lần, giữ suốt vòng đời instance). */
    let pluginProgressHandle = null;
    /** Cờ single-flight: chỉ một tiến trình tải tại một thời điểm (4.6, Property 14). */
    let downloadInProgress = false;

    /**
     * Đăng ký một callback nhận tiến độ tải (phần trăm 0..100).
     * @param {(percent: number) => void} cb
     * @returns {() => void} Hàm huỷ đăng ký.
     */
    function onProgress(cb) {
      if (typeof cb === 'function' && progressCallbacks.indexOf(cb) === -1) {
        progressCallbacks.push(cb);
      }
      return function off() {
        const idx = progressCallbacks.indexOf(cb);
        if (idx !== -1) progressCallbacks.splice(idx, 1);
      };
    }

    /**
     * Phát tiến độ phần trăm tới mọi callback đã đăng ký (an toàn với lỗi callback).
     * @param {number} percent
     */
    function emitProgress(percent) {
      let value = Number(percent);
      if (!Number.isFinite(value)) return;
      if (value < 0) value = 0;
      if (value > 100) value = 100;
      for (let i = 0; i < progressCallbacks.length; i += 1) {
        try {
          progressCallbacks[i](value);
        } catch (err) {
          /* callback lỗi không được làm gián đoạn luồng tải */
        }
      }
    }

    /**
     * Chuẩn hoá payload event `downloadProgress` của plugin thành phần trăm.
     * Ưu tiên `percent`; nếu không có thì suy ra từ `transferred/total`.
     * @param {{ percent?: number, transferred?: number, total?: number }} event
     */
    function handlePluginProgress(event) {
      if (!event) return;
      if (typeof event.percent === 'number' && Number.isFinite(event.percent)) {
        emitProgress(event.percent);
        return;
      }
      if (typeof event.transferred === 'number' && typeof event.total === 'number' && event.total > 0) {
        emitProgress((event.transferred / event.total) * 100);
      }
    }

    /**
     * Đăng ký listener `downloadProgress` của plugin (chỉ một lần).
     * @param {Object} plugin
     */
    async function ensureProgressListener(plugin) {
      if (pluginProgressHandle) return;
      if (plugin && typeof plugin.addListener === 'function') {
        try {
          pluginProgressHandle = await plugin.addListener(PLUGIN_PROGRESS_EVENT, handlePluginProgress);
        } catch (err) {
          pluginProgressHandle = null;
        }
      }
    }

    /**
     * Xác định một lỗi từ `downloadApk` có phải do THẤT BẠI TOÀN VẸN hay không
     * (để áp dụng chính sách tự thử lại). Plugin native reject bằng thông báo
     * chứa "toàn vẹn"; ngoài ra chấp nhận `err.code === 'INTEGRITY_FAILED'`.
     * @param {*} err
     * @returns {boolean}
     */
    function isIntegrityError(err) {
      if (!err) return false;
      if (err.code === 'INTEGRITY_FAILED') return true;
      const msg = String((err && err.message) || err || '').toLowerCase();
      return /toàn vẹn|integrity|checksum|sha-?256/.test(msg);
    }

    /**
     * Xoá artifact đã tải qua plugin (idempotent, không ném lỗi ra ngoài).
     * @param {Object} plugin
     * @param {string} [filePath]
     */
    async function safeCleanup(plugin, filePath) {
      if (plugin && typeof plugin.cleanupApk === 'function') {
        try {
          await plugin.cleanupApk(filePath ? { filePath } : {});
        } catch (err) {
          /* bỏ qua lỗi dọn dẹp */
        }
      }
    }

    // ---- downloadAndInstall -------------------------------------------

    /**
     * Tải + xác minh toàn vẹn + cài đặt bản cập nhật Android, uỷ quyền cho
     * plugin native APK_Installer.
     *
     * - Khoá single-flight: nếu đang có tiến trình tải, trả về ngay
     *   `status: 'downloading'` mà KHÔNG khởi tạo tiến trình thứ hai (4.6).
     * - Chính sách thử lại toàn vẹn: khi `downloadApk` reject do lỗi toàn vẹn,
     *   xoá artifact và tự thử lại tối đa 1 lần (tổng ≤ 2 lần tải). Sau đó dừng
     *   và cung cấp `canRetry` để UI hiện nút thử lại thủ công (6.4).
     * - CHỈ gọi `installApk` khi `downloadApk` resolve thành công. KHÔNG bao giờ
     *   khởi chạy installer khi thất bại toàn vẹn (Property 11).
     * - Lỗi tải khác (network/timeout) KHÔNG tự thử lại; báo lỗi và cho thử lại
     *   thủ công (6.3).
     *
     * Không ném lỗi ra ngoài: trả về `{ status, message, info, canRetry? }`.
     *
     * @param {import('./shared/types.js').UpdateInfo} info Kết quả từ checkForUpdate (chứa `manifest`).
     * @returns {Promise<{ status: string, message: string, info: (Object|null), canRetry?: boolean }>}
     */
    async function downloadAndInstall(info) {
      // 1) Khoá single-flight — kiểm tra & set đồng bộ, không có await ở giữa (4.6).
      if (downloadInProgress) {
        return { status: 'downloading', message: MSG_ALREADY_DOWNLOADING, info: info || null };
      }

      // 2) Trích thông tin manifest (info có thể là UpdateInfo bọc `manifest`, hoặc chính manifest).
      const manifest = (info && info.manifest) || info || {};
      const apkUrl = manifest.apkUrl || (info && info.releaseUrl) || null;
      const expectedSha256 = manifest.apkSha256;
      const expectedSize = manifest.apkSize;
      const version = manifest.latestVersion || (info && info.latestVersion) || installedVersionName;

      // 3) URL tải phải thuộc origin tin cậy qua HTTPS (9.3, 9.4).
      if (!apkUrl || !updateCore.isAllowedReleaseUrl(apkUrl)) {
        writeUpdateLogEntry({ version, status: 'error', message: MSG_UNTRUSTED_URL });
        return { status: 'error', message: MSG_UNTRUSTED_URL, info: info || null };
      }

      // 4) Bắt buộc có thông tin toàn vẹn để native xác minh (9.4).
      if (typeof expectedSha256 !== 'string' || expectedSha256 === ''
          || typeof expectedSize !== 'number' || !Number.isFinite(expectedSize)) {
        writeUpdateLogEntry({ version, status: 'error', message: MSG_MISSING_INTEGRITY_INFO });
        return { status: 'error', message: MSG_MISSING_INTEGRITY_INFO, info: info || null };
      }

      // 5) Phân giải plugin native.
      const plugin = resolveNativePlugin();
      if (!plugin || typeof plugin.downloadApk !== 'function') {
        writeUpdateLogEntry({ version, status: 'error', message: MSG_NO_INSTALLER });
        return { status: 'error', message: MSG_NO_INSTALLER, info: info || null };
      }

      downloadInProgress = true;
      try {
        await ensureProgressListener(plugin);

        // 6) Bảo đảm quyền cài gói (5.3) — best effort; native tự mở màn hình cấp quyền.
        if (typeof plugin.ensureInstallPermission === 'function') {
          try {
            await plugin.ensureInstallPermission();
          } catch (err) {
            /* tiếp tục: native đã mở màn hình cấp quyền nếu cần */
          }
        }

        // 7) Tải với chính sách tự thử lại KHI lỗi toàn vẹn (tối đa 2 lần tải).
        let attempt = 0;
        let downloadResult = null;
        let lastError = null;
        let integrityFailure = false;

        while (attempt < MAX_DOWNLOAD_ATTEMPTS) {
          attempt += 1;
          try {
            downloadResult = await plugin.downloadApk({
              url: apkUrl,
              expectedSha256: expectedSha256,
              expectedSize: expectedSize,
            });
            lastError = null;
            integrityFailure = false;
            break; // tải + xác minh (native) thành công
          } catch (err) {
            lastError = err;
            downloadResult = null;
            // Xoá artifact hỏng (idempotent — native cũng đã tự xoá).
            await safeCleanup(plugin, err && err.filePath);

            if (isIntegrityError(err)) {
              integrityFailure = true;
              writeUpdateLogEntry({ version, status: 'error', message: MSG_INTEGRITY_FAILED });
              continue; // tự thử lại cho tới khi đạt MAX_DOWNLOAD_ATTEMPTS
            }
            // Lỗi tải khác → KHÔNG tự thử lại (6.3).
            integrityFailure = false;
            break;
          }
        }

        // 8) Thất bại: KHÔNG bao giờ cài đặt (Property 11). Cung cấp thử lại thủ công.
        if (lastError || !downloadResult) {
          const message = integrityFailure ? MSG_INTEGRITY_RETRY_MANUAL : MSG_DOWNLOAD_FAILED;
          writeUpdateLogEntry({ version, status: 'error', message });
          return { status: 'error', message, info: info || null, canRetry: true };
        }

        // 9) Thành công → CHỈ giờ mới khởi chạy installer.
        if (typeof plugin.installApk === 'function') {
          try {
            await plugin.installApk({ filePath: downloadResult.filePath });
          } catch (err) {
            const message = updateCore.sanitizeUpdateMessage(MSG_INSTALL_FAILED);
            writeUpdateLogEntry({ version, status: 'error', message });
            return { status: 'error', message, info: info || null, canRetry: true };
          }
        }

        writeUpdateLogEntry({ version, status: 'downloaded', message: MSG_UPDATE_READY });
        return { status: 'downloaded', message: MSG_UPDATE_READY, info: info || null };
      } finally {
        downloadInProgress = false;
      }
    }

    /**
     * Xoá file APK đã tải (dùng khi cài đặt kết thúc hoặc lúc khởi động kế tiếp
     * để tránh tích tụ dung lượng — Requirement 4.9).
     * @param {string} [filePath]
     * @returns {Promise<void>}
     */
    async function cleanupDownloadedApk(filePath) {
      const plugin = resolveNativePlugin();
      await safeCleanup(plugin, filePath);
    }

    // ---- API công khai của instance -----------------------------------

    return {
      checkForUpdate,
      downloadAndInstall,
      onProgress,
      cleanupDownloadedApk,
      readUpdateLog,
      getLastBackgroundCheck,
      RELEASE_MANIFEST_URL: manifestUrl,
      INSTALLED_VERSION_NAME: installedVersionName,
      INSTALLED_VERSION_CODE: installedVersionCode,
    };
  }

  // ---- Xuất API cấp module ---------------------------------------------

  return {
    createMobileUpdater,
    RELEASE_MANIFEST_URL,
    INSTALLED_VERSION_NAME,
    INSTALLED_VERSION_CODE,
    STORAGE_KEY_UPDATE_LOG,
    STORAGE_KEY_LAST_BACKGROUND_CHECK,
  };
}));
