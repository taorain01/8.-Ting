/*
 * ============================================================================
 *  MẪU MODULE UMD DÙNG CHUNG (Update_System — tầng logic thuần)
 * ============================================================================
 *
 * File này vừa là:
 *   1. Tài liệu tham chiếu các kiểu dữ liệu runtime dùng chung (JSDoc typedef).
 *   2. MẪU (template) module UMD nhẹ mà MỌI module trong `js/shared/*` phải
 *      tuân theo (ví dụ: version-compare.js, update-core.js, platform-detector.js).
 *
 * ----------------------------------------------------------------------------
 *  MẪU UMD — copy nguyên khối wrapper dưới đây cho mỗi module mới:
 * ----------------------------------------------------------------------------
 *
 *   (function (root, factory) {
 *     'use strict';
 *     if (typeof module === 'object' && module.exports) {
 *       // Node.js / Electron main process (CommonJS): require(...) sẽ nhận exports.
 *       module.exports = factory();
 *     } else {
 *       // Webview / trình duyệt (<script>): gắn vào namespace toàn cục TingShared.
 *       root.TingShared = root.TingShared || {};
 *       root.TingShared.TenModule = factory();
 *     }
 *   }(typeof globalThis !== 'undefined' ? globalThis : this, function () {
 *     'use strict';
 *
 *     // ---- Thân module (chỉ logic thuần, KHÔNG phụ thuộc DOM/Node I/O) ----
 *     function viDu() { return 42; }
 *
 *     // ---- Xuất API công khai ----
 *     return { viDu };
 *   }));
 *
 * Quy ước:
 *   - Module `js/shared/*` PHẢI thuần (pure): không truy cập `window`, `document`,
 *     `fs`, `https`, hay bất kỳ I/O nào — để `require` được trong test Node và
 *     nạp `<script>` được trong webview mà không phát sinh side effect.
 *   - Trong Node/Electron: `const m = require('../shared/ten-module.js');`
 *   - Trong webview: `<script src="js/shared/ten-module.js"></script>` rồi dùng
 *     `window.TingShared.TenModule`.
 * ============================================================================
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TingShared = root.TingShared || {};
    root.TingShared.Types = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Các trạng thái vòng đời cập nhật (Update_System).
   * @typedef {('idle'|'checking'|'update-available'|'downloading'|'downloaded'|'up-to-date'|'error'|'offline')} UpdateStatusKind
   */

  /**
   * Danh sách hằng số của {@link UpdateStatusKind} dùng để validate lúc chạy.
   * @type {ReadonlyArray<UpdateStatusKind>}
   */
  const UPDATE_STATUS_KINDS = Object.freeze([
    'idle',
    'checking',
    'update-available',
    'downloading',
    'downloaded',
    'up-to-date',
    'error',
    'offline',
  ]);

  /**
   * Thông tin cập nhật trả về cho UI sau khi kiểm tra.
   * @typedef {Object} UpdateInfo
   * @property {string} currentVersion  Installed_Version đang chạy.
   * @property {string} latestVersion   Latest_Version do nguồn phát hành công bố.
   * @property {string} [releaseNotes]  Ghi chú phát hành (tiếng Việt).
   * @property {string} [releaseUrl]    URL trang phát hành / tải thủ công.
   * @property {('github'|'manifest')} source  Nguồn phát hiện bản cập nhật.
   * @property {number} [distance]      Khoảng cách phiên bản (số nguyên không âm).
   */

  /**
   * Tiến độ tải một artifact cập nhật.
   * @typedef {Object} DownloadProgress
   * @property {number} percent       Phần trăm hoàn thành (0..100).
   * @property {number} [transferred] Số byte đã tải.
   * @property {number} [total]       Tổng số byte cần tải.
   */

  /**
   * Một mục nhật ký cập nhật (giữ tối đa 10 mục gần nhất).
   * @typedef {Object} UpdateLogEntry
   * @property {string} version            Phiên bản liên quan.
   * @property {string} status             Ví dụ: 'checking' | 'available' | 'downloaded' | 'error'.
   * @property {('github'|'manifest')} [source] Nguồn phát hành.
   * @property {string} [message]          Thông báo (đã qua sanitizeUpdateMessage).
   * @property {string} date               Mốc thời gian định dạng vi-VN.
   */

  /**
   * Manifest phát hành Android (`version.json`) trong Releases_Repository.
   * @typedef {Object} ReleaseManifest
   * @property {string} latestVersion       Latest_Version (semantic, ví dụ "1.4.0").
   * @property {number} versionCode         Version code dùng so sánh trên Android.
   * @property {string} releaseNotes        Ghi chú phát hành (tiếng Việt).
   * @property {string} apkUrl              URL tải APK.
   * @property {number} apkSize             Kích thước file APK (byte).
   * @property {string} apkSha256           APK_Checksum (SHA-256, hex).
   * @property {number} minSupportedVersion Min_Supported_Version (theo versionCode).
   */

  /**
   * Danh sách khóa bắt buộc của {@link ReleaseManifest} (dùng cho parseReleaseManifest).
   * @type {ReadonlyArray<string>}
   */
  const RELEASE_MANIFEST_REQUIRED_KEYS = Object.freeze([
    'latestVersion',
    'versionCode',
    'releaseNotes',
    'apkUrl',
    'apkSize',
    'apkSha256',
    'minSupportedVersion',
  ]);

  /**
   * Trạng thái điều khiển Background_Check.
   * @typedef {Object} BackgroundCheckState
   * @property {boolean} enabled          Mặc định true.
   * @property {(number|null)} lastCheckAt Epoch ms lần kiểm tra gần nhất (null nếu chưa từng).
   */

  return {
    UPDATE_STATUS_KINDS,
    RELEASE_MANIFEST_REQUIRED_KEYS,
  };
}));
