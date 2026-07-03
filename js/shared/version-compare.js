/*
 * ============================================================================
 *  Version_Comparator (Update_System — tầng logic thuần)
 *  File: js/shared/version-compare.js
 * ============================================================================
 *
 * Module THUẦN (pure): chỉ so sánh/chuẩn hoá chuỗi phiên bản, KHÔNG truy cập
 * DOM, `window`, `document`, `fs`, `https` hay bất kỳ I/O nào. Nhờ vậy có thể
 * `require(...)` trong Electron main (Node) và nạp `<script>` trong webview
 * Android mà không phát sinh side effect, đảm bảo một nguồn sự thật duy nhất
 * cho so sánh phiên bản giữa các nền tảng.
 *
 * Tương thích hành vi với `compareVersions`/`normalizeVersion` sẵn có trong
 * `DongGoi/electron/main.cjs` (bản sao đó sẽ được refactor để gọi module này).
 *
 * Cách dùng:
 *   - Node/Electron: const VC = require('../shared/version-compare.js');
 *   - Webview:       <script src="js/shared/version-compare.js"></script>
 *                    rồi dùng window.TingShared.VersionCompare
 * ============================================================================
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    // Node.js / Electron main process (CommonJS): require(...) sẽ nhận exports.
    module.exports = factory();
  } else {
    // Webview / trình duyệt (<script>): gắn vào namespace toàn cục TingShared.
    root.TingShared = root.TingShared || {};
    root.TingShared.VersionCompare = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Chuẩn hoá chuỗi phiên bản:
   *   - Bỏ tiền tố "v"/"V" ở đầu.
   *   - Cắt metadata build ở đuôi (mọi ký tự sau đoạn số dạng chấm, ví dụ
   *     "+build.5", "-beta.1").
   *   - Chỉ giữ lại đoạn số dạng chấm đầu tiên (tối đa 3 đoạn: major.minor.patch).
   *   - Nếu chuỗi không chứa đoạn số phân tích được → coi như "0.0.0"
   *     (theo Requirement 2.5).
   *
   * @param {string|number|null|undefined} value  Chuỗi/số phiên bản đầu vào.
   * @returns {string} Chuỗi phiên bản đã chuẩn hoá (ví dụ "1.4.0" hoặc "0.0.0").
   */
  function normalizeVersion(value) {
    const raw = String(value == null ? '' : value).trim().replace(/^v/i, '');
    const match = raw.match(/\d+(?:\.\d+){0,2}/);
    return match ? match[0] : '0.0.0';
  }

  /**
   * Phân tích một chuỗi phiên bản thành mảng các đoạn số nguyên.
   * Đoạn không phải số hữu hạn được coi là 0.
   *
   * @param {string|number|null|undefined} value
   * @returns {number[]} Mảng các đoạn số (ví dụ [1, 4, 0]).
   */
  function parseSegments(value) {
    return normalizeVersion(value)
      .split('.')
      .map(function (part) { return Number.parseInt(part, 10); })
      .map(function (part) { return Number.isFinite(part) ? part : 0; });
  }

  /**
   * So sánh hai chuỗi phiên bản theo từng đoạn số.
   *   - Trả về  1 khi left > right.
   *   - Trả về  0 khi left === right.
   *   - Trả về -1 khi left < right.
   *
   * Đoạn thiếu được coi là 0 (Requirement 2.3); chuỗi không có đoạn số hợp lệ
   * được coi như "0.0.0" (Requirement 2.5). Hàm bảo đảm tính phản đối xứng
   * (Requirement 2.4): compareVersions(a, b) === -compareVersions(b, a).
   *
   * @param {string|number|null|undefined} left
   * @param {string|number|null|undefined} right
   * @returns {(-1|0|1)}
   */
  function compareVersions(left, right) {
    const a = parseSegments(left);
    const b = parseSegments(right);
    const length = Math.max(a.length, b.length, 3);
    for (let index = 0; index < length; index += 1) {
      const diff = (a[index] || 0) - (b[index] || 0);
      if (diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
  }

  /**
   * Phân loại trạng thái cập nhật dựa trên so sánh phiên bản.
   *   - `'up-to-date'`   khi Installed_Version >= Latest_Version
   *                      (bao gồm cả trường hợp bản đã cài cao hơn bản chính
   *                      thức — bản dev/beta), tức compareVersions >= 0.
   *   - `'update-available'` khi Latest_Version > Installed_Version.
   *
   * Tái dùng `compareVersions` nên hỗ trợ cả chuỗi phiên bản (desktop) lẫn
   * version code dạng số (Android).
   *
   * @param {string|number|null|undefined} installed  Phiên bản đã cài.
   * @param {string|number|null|undefined} latest      Phiên bản mới nhất.
   * @returns {('up-to-date'|'update-available')}
   */
  function classifyUpdateStatus(installed, latest) {
    return compareVersions(installed, latest) >= 0
      ? 'up-to-date'
      : 'update-available';
  }

  /**
   * Ép một giá trị về số nguyên hữu hạn không âm dùng làm version code.
   * Giá trị không phải số hữu hạn → 0.
   *
   * @param {*} value
   * @returns {number}
   */
  function toVersionCode(value) {
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : 0;
  }

  /**
   * Khoảng cách phiên bản (số nguyên không âm) dùng cho ngưỡng toast/dialog
   * của Background_Check.
   *
   * Hai chế độ tính, phân biệt theo kiểu đầu vào:
   *   - **Android (version code)**: khi cả `installed` và `latest` là kiểu
   *     `number`, khoảng cách là chênh lệch tuyệt đối giữa hai version code
   *     nguyên (`|latest - installed|`).
   *   - **Desktop (đoạn số phiên bản)**: khi đầu vào là chuỗi, khoảng cách là
   *     chênh lệch tuyệt đối tại đoạn số có trọng số cao nhất mà hai phiên bản
   *     khác nhau (ví dụ "1.3.x" ↔ "1.4.x" → 1; "1.3" ↔ "1.7" → 4).
   *
   * Luôn trả về số nguyên không âm và bằng `0` khi và chỉ khi hai phiên bản
   * được coi là tương đương theo tiêu chí tương ứng (tức `compareVersions`
   * trả về 0). Bảo đảm tính đối xứng: distance(a, b) === distance(b, a).
   *
   * @param {string|number|null|undefined} installed
   * @param {string|number|null|undefined} latest
   * @returns {number} Khoảng cách phiên bản, số nguyên >= 0.
   */
  function versionDistance(installed, latest) {
    // Chế độ Android: cả hai là version code dạng số.
    if (typeof installed === 'number' && typeof latest === 'number') {
      return Math.abs(toVersionCode(latest) - toVersionCode(installed));
    }

    // Chế độ desktop: dựa trên đoạn số phiên bản đã chuẩn hoá.
    const a = parseSegments(installed);
    const b = parseSegments(latest);
    const length = Math.max(a.length, b.length, 3);
    for (let index = 0; index < length; index += 1) {
      const diff = (a[index] || 0) - (b[index] || 0);
      if (diff !== 0) return Math.abs(diff);
    }
    return 0;
  }

  // ---- Xuất API công khai ----
  return {
    normalizeVersion: normalizeVersion,
    compareVersions: compareVersions,
    classifyUpdateStatus: classifyUpdateStatus,
    versionDistance: versionDistance,
  };
}));
