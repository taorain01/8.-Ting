/*
 * ============================================================================
 *  Platform_Detector (Update_System — tầng logic thuần)
 * ============================================================================
 *
 * Xác định nền tảng đang chạy ('electron' | 'android' | 'ios' | 'web') và năng
 * lực cập nhật tương ứng của nền tảng đó.
 *
 * Module này thuần (pure): KHÔNG truy cập trực tiếp `window`/`document`/Node I/O.
 * `detectPlatform` nhận một object `env` được bơm phụ thuộc (từ `window`) để
 * kiểm thử được thuần tuý. Xem `js/shared/types.js` để biết mẫu UMD chuẩn.
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
    root.TingShared.PlatformDetector = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Nền tảng runtime được Update_System nhận diện.
   * @typedef {('electron'|'android'|'ios'|'web')} Platform
   */

  /**
   * Object môi trường được bơm phụ thuộc (thường là `window`) để phát hiện nền tảng.
   * @typedef {Object} PlatformEnv
   * @property {{ isElectron?: boolean }} [electronAPI] Cầu nối Electron (preload).
   * @property {{ getPlatform?: () => string, isNativePlatform?: () => boolean }} [Capacitor] Runtime Capacitor.
   */

  /**
   * Kết quả mô tả năng lực cập nhật của một nền tảng.
   * @typedef {Object} UpdateCapability
   * @property {boolean} canCheck            Có bật hành động "Kiểm tra"/"Cập nhật" hay không.
   * @property {(string|null)} disabledMessage Thông báo tiếng Việt khi bị vô hiệu hoá (null nếu bật).
   */

  // Thông báo tiếng Việt cho các nền tảng không hỗ trợ tự cập nhật trong app.
  const IOS_DISABLED_MESSAGE = 'Cập nhật qua App Store';
  const WEB_DISABLED_MESSAGE = 'Không hỗ trợ tự cập nhật trên nền tảng này';

  /**
   * Xác định nền tảng lúc chạy từ object `env` được bơm phụ thuộc.
   *
   * Thứ tự ưu tiên:
   *   1. `env.electronAPI.isElectron` truthy  → 'electron'
   *   2. `env.Capacitor.getPlatform()`        → 'android' | 'ios' | (khác) → 'web'
   *   3. Mặc định                             → 'web'
   *
   * @param {PlatformEnv} [env] Object môi trường (thường là `window`).
   * @returns {Platform}
   */
  function detectPlatform(env) {
    const source = env || {};

    // 1. Electron: preload bơm `electronAPI.isElectron = true`.
    if (source.electronAPI && source.electronAPI.isElectron) {
      return 'electron';
    }

    // 2. Capacitor: hỏi runtime nền tảng native.
    const capacitor = source.Capacitor;
    if (capacitor && typeof capacitor.getPlatform === 'function') {
      const capPlatform = capacitor.getPlatform();
      if (capPlatform === 'android') {
        return 'android';
      }
      if (capPlatform === 'ios') {
        return 'ios';
      }
      // Capacitor có thể trả 'web' (hoặc giá trị khác) khi không chạy native.
      return 'web';
    }

    // 3. Mặc định: trình duyệt web thường.
    return 'web';
  }

  /**
   * Năng lực cập nhật của một nền tảng.
   *
   * - 'electron' / 'android': `canCheck = true`, không có thông báo vô hiệu hoá.
   * - 'ios': `canCheck = false`, thông báo "Cập nhật qua App Store".
   * - 'web' (và mọi giá trị khác): `canCheck = false`, thông báo không hỗ trợ.
   *
   * @param {Platform} platform
   * @returns {UpdateCapability}
   */
  function updateCapability(platform) {
    if (platform === 'electron' || platform === 'android') {
      return { canCheck: true, disabledMessage: null };
    }
    if (platform === 'ios') {
      return { canCheck: false, disabledMessage: IOS_DISABLED_MESSAGE };
    }
    // 'web' và mọi nền tảng không xác định khác đều suy giảm nhẹ nhàng.
    return { canCheck: false, disabledMessage: WEB_DISABLED_MESSAGE };
  }

  return {
    detectPlatform,
    updateCapability,
  };
}));
