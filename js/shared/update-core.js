/*
 * ============================================================================
 *  Update_Core (`js/shared/update-core.js`) — tầng logic thuần dùng chung
 * ============================================================================
 *
 * Gom các QUYẾT ĐỊNH logic thuần của Update_System, tách hoàn toàn khỏi I/O.
 * Module tuân theo MẪU UMD trong `js/shared/types.js`: `require` được trong
 * Node/Electron main và nạp `<script>` được trong webview, KHÔNG side effect.
 *
 * Trong Node/Electron:  const UpdateCore = require('../shared/update-core.js');
 * Trong webview:        <script src="js/shared/update-core.js"></script>
 *                       rồi dùng `window.TingShared.UpdateCore`.
 *
 * LƯU Ý MỞ RỘNG: file này sẽ còn được bổ sung ở task 3.4 và 3.7
 *   (parseReleaseManifest, verifyArtifactIntegrity, decideNotificationKind,
 *    shouldRunBackgroundCheck, isAllowedReleaseUrl). Cấu trúc dưới đây thiết kế
 *   để dễ thêm hàm mới: mỗi hàm là một khối thuần độc lập, cùng gom vào object
 *   export ở cuối factory.
 * ============================================================================
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    // Node.js / Electron main process (CommonJS): nạp Types dùng chung qua require.
    module.exports = factory(require('./types.js'));
  } else {
    // Webview / trình duyệt (<script>): gắn vào namespace toàn cục TingShared.
    // LƯU Ý: `types.js` phải được nạp TRƯỚC `update-core.js` trong webview.
    root.TingShared = root.TingShared || {};
    root.TingShared.UpdateCore = factory(root.TingShared.Types);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Types) {
  'use strict';

  // ---- Hằng số nội bộ ---------------------------------------------------

  /**
   * Số mục nhật ký cập nhật tối đa được giữ lại (mới nhất ở đầu).
   * @type {number}
   */
  const MAX_UPDATE_LOG_ENTRIES = 10;

  /**
   * Thông báo tiếng Việt chung, an toàn — dùng khi phát hiện thông tin nhạy
   * cảm (token/credential/response header) trong thông báo lỗi gốc.
   * @type {string}
   */
  const SAFE_UPDATE_MESSAGE =
    'Không thể kiểm tra cập nhật tự động. Vui lòng tải bản mới từ GitHub Releases.';

  /**
   * Độ dài tối đa của thông báo lỗi sau khi làm sạch (tránh rò rỉ chuỗi dài).
   * @type {number}
   */
  const MAX_SANITIZED_MESSAGE_LENGTH = 220;

  /**
   * Các dấu hiệu (đã hạ chữ thường) cho thấy thông báo chứa response header
   * hoặc cookie nhạy cảm — khi khớp sẽ thay bằng thông báo chung an toàn.
   * @type {ReadonlyArray<string>}
   */
  const SENSITIVE_MARKERS = Object.freeze([
    'set-cookie',
    'domain=.github.com',
    'logged_in=',
    'samesite=',
    'latest.yml',
    'authorization:',
    'authorization=',
  ]);

  /**
   * Regex bắt token dạng thông tin xác thực của GitHub (`ghp_`, `gho_`,
   * `ghs_`, `ghu_`, ...). Thay bằng `***` để không lộ credential.
   * @type {RegExp}
   */
  const GITHUB_TOKEN_PATTERN = /gh[opsu]_[A-Za-z0-9_]+/g;

  /**
   * Danh sách khóa bắt buộc của Release_Manifest. Ưu tiên dùng định nghĩa
   * dùng chung trong `js/shared/types.js`; có fallback nội bộ (cùng nội dung)
   * để module vẫn hoạt động nếu `Types` chưa được nạp trong webview.
   * @type {ReadonlyArray<string>}
   */
  const RELEASE_MANIFEST_REQUIRED_KEYS =
    (Types && Array.isArray(Types.RELEASE_MANIFEST_REQUIRED_KEYS))
      ? Types.RELEASE_MANIFEST_REQUIRED_KEYS
      : Object.freeze([
          'latestVersion',
          'versionCode',
          'releaseNotes',
          'apkUrl',
          'apkSize',
          'apkSha256',
          'minSupportedVersion',
        ]);

  /**
   * Kiểu dữ liệu mong đợi cho từng khóa bắt buộc của Release_Manifest.
   * Dùng để kiểm tra schema trong {@link parseReleaseManifest}.
   * @type {Readonly<Record<string, ('string'|'number')>>}
   */
  const RELEASE_MANIFEST_FIELD_TYPES = Object.freeze({
    latestVersion: 'string',
    versionCode: 'number',
    releaseNotes: 'string',
    apkUrl: 'string',
    apkSize: 'number',
    apkSha256: 'string',
    minSupportedVersion: 'number',
  });

  /**
   * Ngưỡng khoảng cách phiên bản: `distance <= 3` dùng thông báo dạng `toast`,
   * `distance > 3` dùng `dialog` nổi bật hơn.
   * @type {number}
   */
  const NOTIFICATION_TOAST_MAX_DISTANCE = 3;

  /**
   * Khoảng thời gian tối thiểu (mili-giây) giữa hai lần Background_Check: 24 giờ.
   * @type {number}
   */
  const BACKGROUND_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

  /**
   * Danh sách host được phép tải Release_Manifest/artifact qua HTTPS. Phải KHỚP
   * với allowlist của plugin native (raw.githubusercontent.com, github.com,
   * codeload.github.com, objects.githubusercontent.com,
   * release-assets.githubusercontent.com). Ngoài các host tường minh này, mọi
   * subdomain `*.githubusercontent.com` cũng được chấp nhận (xem
   * {@link isAllowedReleaseUrl}).
   * @type {ReadonlyArray<string>}
   */
  const ALLOWED_RELEASE_HOSTS = Object.freeze([
    'raw.githubusercontent.com',
    'github.com',
    'codeload.github.com',
    'objects.githubusercontent.com',
    'release-assets.githubusercontent.com',
  ]);

  /**
   * Hậu tố miền cho phép mọi subdomain phục vụ asset của GitHub.
   * Ví dụ hợp lệ: `raw.githubusercontent.com`, `objects.githubusercontent.com`.
   * @type {string}
   */
  const GITHUBUSERCONTENT_SUFFIX = '.githubusercontent.com';

  // ---- sanitizeUpdateMessage -------------------------------------------

  /**
   * Làm sạch thông báo lỗi trước khi hiển thị cho người dùng.
   *
   * - Nếu thông báo chứa dấu hiệu response header / cookie nhạy cảm
   *   ({@link SENSITIVE_MARKERS}) → trả về {@link SAFE_UPDATE_MESSAGE}.
   * - Ngược lại, thay token GitHub bằng `***` và cắt bớt độ dài.
   *
   * Hàm thuần: cùng input luôn cho cùng output, không phụ thuộc trạng thái.
   *
   * @param {unknown} message  Thông báo gốc (có thể là bất kỳ kiểu nào).
   * @returns {string}         Thông báo đã làm sạch (an toàn để hiển thị).
   */
  function sanitizeUpdateMessage(message) {
    const raw = String(message == null ? '' : message);
    if (!raw) return '';

    const lower = raw.toLowerCase();
    for (let i = 0; i < SENSITIVE_MARKERS.length; i += 1) {
      if (lower.includes(SENSITIVE_MARKERS[i])) {
        return SAFE_UPDATE_MESSAGE;
      }
    }

    return raw.replace(GITHUB_TOKEN_PATTERN, '***').slice(0, MAX_SANITIZED_MESSAGE_LENGTH);
  }

  // ---- appendUpdateLogEntry --------------------------------------------

  /**
   * Chèn một mục nhật ký mới lên ĐẦU danh sách và giữ tối đa
   * {@link MAX_UPDATE_LOG_ENTRIES} mục gần nhất.
   *
   * Hàm thuần: KHÔNG thay đổi mảng `log` đầu vào, trả về mảng MỚI. Việc gắn
   * `date` / lưu trữ (I/O) do tầng cạnh (Electron main, webview) đảm nhiệm.
   *
   * @param {Array<import('./types.js').UpdateLogEntry>} log  Nhật ký hiện tại (mới nhất ở đầu).
   * @param {import('./types.js').UpdateLogEntry} entry        Mục mới cần chèn.
   * @returns {Array<import('./types.js').UpdateLogEntry>}     Nhật ký mới, tối đa 10 mục.
   */
  function appendUpdateLogEntry(log, entry) {
    const current = Array.isArray(log) ? log : [];
    return [entry, ...current].slice(0, MAX_UPDATE_LOG_ENTRIES);
  }

  // ---- parseReleaseManifest --------------------------------------------

  /**
   * Kiểm tra schema và phân tích Release_Manifest (`version.json`).
   *
   * Chấp nhận đầu vào là chuỗi JSON (sẽ được `JSON.parse`) hoặc một object đã
   * phân tích sẵn. Mọi khóa trong {@link RELEASE_MANIFEST_REQUIRED_KEYS} đều
   * bắt buộc và phải đúng kiểu ({@link RELEASE_MANIFEST_FIELD_TYPES}); thiếu
   * bất kỳ trường bắt buộc nào → `ok = false`.
   *
   * Hàm thuần: không I/O, không side effect. Khi hợp lệ trả về `manifest` đã
   * chuẩn hoá chỉ gồm các trường bắt buộc (bảo toàn giá trị để round-trip).
   *
   * @param {unknown} raw  Chuỗi JSON hoặc object Release_Manifest.
   * @returns {{ ok: boolean, manifest?: import('./types.js').ReleaseManifest, error?: string }}
   */
  function parseReleaseManifest(raw) {
    // 1) Chuẩn hoá đầu vào về một object.
    let data = raw;
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
      } catch (err) {
        return { ok: false, error: 'Release_Manifest không phải JSON hợp lệ.' };
      }
    }

    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, error: 'Release_Manifest phải là một object.' };
    }

    // 2) Kiểm tra sự hiện diện và kiểu của từng khóa bắt buộc.
    const missing = [];
    const invalidType = [];
    for (let i = 0; i < RELEASE_MANIFEST_REQUIRED_KEYS.length; i += 1) {
      const key = RELEASE_MANIFEST_REQUIRED_KEYS[i];
      const value = data[key];
      if (value === undefined || value === null) {
        missing.push(key);
        continue;
      }
      const expectedType = RELEASE_MANIFEST_FIELD_TYPES[key];
      if (expectedType === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          invalidType.push(key);
        }
      } else if (typeof value !== expectedType) {
        invalidType.push(key);
      }
    }

    if (missing.length > 0) {
      return { ok: false, error: 'Release_Manifest thiếu trường bắt buộc: ' + missing.join(', ') + '.' };
    }
    if (invalidType.length > 0) {
      return { ok: false, error: 'Release_Manifest có trường sai kiểu dữ liệu: ' + invalidType.join(', ') + '.' };
    }

    // 3) Chuẩn hoá manifest (chỉ giữ các trường bắt buộc, bảo toàn giá trị).
    /** @type {import('./types.js').ReleaseManifest} */
    const manifest = {
      latestVersion: data.latestVersion,
      versionCode: data.versionCode,
      releaseNotes: data.releaseNotes,
      apkUrl: data.apkUrl,
      apkSize: data.apkSize,
      apkSha256: data.apkSha256,
      minSupportedVersion: data.minSupportedVersion,
    };

    return { ok: true, manifest };
  }

  // ---- verifyArtifactIntegrity -----------------------------------------

  /**
   * Quyết định kết quả kiểm tra tính toàn vẹn của bản tải.
   *
   * Trả về `true` KHI VÀ CHỈ KHI cả `size` lẫn `sha256` khớp nhau. `sha256`
   * so sánh không phân biệt hoa/thường và bỏ khoảng trắng đầu/cuối (mã băm hex
   * từ các nguồn khác nhau có thể khác kiểu chữ). Mọi khác biệt ở bất kỳ trường
   * nào đều cho `false`.
   *
   * Hàm thuần: không I/O, không side effect.
   *
   * @param {{ size: number, sha256: string }} actual   Giá trị đo được từ file đã tải.
   * @param {{ size: number, sha256: string }} expected Giá trị công bố trong Release_Manifest.
   * @returns {boolean} `true` nếu toàn vẹn, ngược lại `false`.
   */
  function verifyArtifactIntegrity(actual, expected) {
    if (actual === null || typeof actual !== 'object') return false;
    if (expected === null || typeof expected !== 'object') return false;

    const sizeMatches = actual.size === expected.size;

    const actualHash = String(actual.sha256 == null ? '' : actual.sha256).trim().toLowerCase();
    const expectedHash = String(expected.sha256 == null ? '' : expected.sha256).trim().toLowerCase();
    const hashMatches = actualHash !== '' && actualHash === expectedHash;

    return sizeMatches && hashMatches;
  }

  // ---- decideNotificationKind ------------------------------------------

  /**
   * Quyết định kiểu thông báo Background_Check theo khoảng cách phiên bản.
   *
   * - `distance <= 3` → `'toast'` (thông báo nhẹ, ít làm phiền).
   * - `distance > 3`  → `'dialog'` (hộp thoại nổi bật, khuyến khích cập nhật).
   *
   * Hàm thuần: giá trị không phải số hữu hạn được coi như `0` (⇒ `'toast'`),
   * để không bao giờ trả về giá trị ngoài `'toast' | 'dialog'`.
   *
   * @param {number} distance  Khoảng cách phiên bản (số nguyên không âm).
   * @returns {'toast'|'dialog'} Kiểu thông báo phù hợp.
   */
  function decideNotificationKind(distance) {
    const d = (typeof distance === 'number' && Number.isFinite(distance)) ? distance : 0;
    return d <= NOTIFICATION_TOAST_MAX_DISTANCE ? 'toast' : 'dialog';
  }

  // ---- shouldRunBackgroundCheck ----------------------------------------

  /**
   * Kiểm soát tần suất Background_Check: chỉ chạy khi tính năng được bật VÀ đã
   * qua đủ 24 giờ ({@link BACKGROUND_CHECK_INTERVAL_MS}) kể từ lần kiểm tra cuối.
   *
   * Trả về `true` KHI VÀ CHỈ KHI `enabled === true` VÀ (`lastCheckAt === null`
   * HOẶC `now - lastCheckAt >= 24h`). Mọi trường hợp `enabled === false` luôn
   * cho `false`.
   *
   * Hàm thuần: không I/O, không side effect. `lastCheckAt`/`now` không phải số
   * hữu hạn được xử lý an toàn (coi `lastCheckAt` như chưa từng kiểm tra).
   *
   * @param {number|null} lastCheckAt  Mốc kiểm tra gần nhất (epoch ms) hoặc `null`.
   * @param {number} now               Thời điểm hiện tại (epoch ms).
   * @param {boolean} enabled          Cờ bật/tắt Background_Check.
   * @returns {boolean} `true` nếu nên chạy kiểm tra nền lúc này.
   */
  function shouldRunBackgroundCheck(lastCheckAt, now, enabled) {
    if (enabled !== true) return false;
    if (lastCheckAt === null || lastCheckAt === undefined) return true;
    if (typeof lastCheckAt !== 'number' || !Number.isFinite(lastCheckAt)) return true;
    if (typeof now !== 'number' || !Number.isFinite(now)) return false;
    return now - lastCheckAt >= BACKGROUND_CHECK_INTERVAL_MS;
  }

  // ---- isAllowedReleaseUrl ---------------------------------------------

  /**
   * Kiểm tra một URL có thuộc origin tin cậy để tải Release_Manifest/artifact
   * hay không.
   *
   * Trả về `true` KHI VÀ CHỈ KHI:
   *   1) scheme là `https`, VÀ
   *   2) host (không phân biệt hoa/thường) thuộc {@link ALLOWED_RELEASE_HOSTS}
   *      HOẶC là một subdomain `*.githubusercontent.com`
   *      ({@link GITHUBUSERCONTENT_SUFFIX}).
   *
   * Mọi scheme khác `https`, URL không phân tích được, hoặc host ngoài allowlist
   * đều cho `false`.
   *
   * Hàm thuần: không I/O, không side effect.
   *
   * @param {string} url  Chuỗi URL cần kiểm tra.
   * @returns {boolean} `true` nếu URL thuộc origin tin cậy qua HTTPS.
   */
  function isAllowedReleaseUrl(url) {
    if (typeof url !== 'string' || url === '') return false;

    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      return false;
    }

    if (parsed.protocol !== 'https:') return false;

    const host = String(parsed.hostname || '').toLowerCase();
    if (host === '') return false;

    if (ALLOWED_RELEASE_HOSTS.indexOf(host) !== -1) return true;
    if (host.endsWith(GITHUBUSERCONTENT_SUFFIX)) return true;

    return false;
  }

  // ---- Xuất API công khai ----------------------------------------------

  return {
    MAX_UPDATE_LOG_ENTRIES,
    SAFE_UPDATE_MESSAGE,
    RELEASE_MANIFEST_REQUIRED_KEYS,
    BACKGROUND_CHECK_INTERVAL_MS,
    ALLOWED_RELEASE_HOSTS,
    sanitizeUpdateMessage,
    appendUpdateLogEntry,
    parseReleaseManifest,
    verifyArtifactIntegrity,
    decideNotificationKind,
    shouldRunBackgroundCheck,
    isAllowedReleaseUrl,
  };
}));
