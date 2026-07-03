/*
 * ============================================================================
 *  Background_Check_Controller (Update_System — điều phối kiểm tra nền)
 *  File: js/background-check.js
 * ============================================================================
 *
 * Điều phối luồng Background_Check (kiểm tra cập nhật tự động quanh lúc khởi
 * động) THỐNG NHẤT cho cả desktop (Electron renderer) và Android (webview).
 * Frontend `js/desktop-app.js` + `js/desktop-ui.js` được dùng chung cho cả hai
 * nền tảng, nên tầng điều phối này cũng đặt ở frontend.
 *
 * NGUYÊN TẮC "pure core, impure edges": mọi QUYẾT ĐỊNH (có nên chạy kiểm tra
 * nền không? thông báo dạng toast hay dialog?) đều uỷ quyền cho tầng logic
 * thuần dùng chung (`js/shared/update-core.js`:
 *   - shouldRunBackgroundCheck(lastCheckAt, now, enabled) — tôn trọng ngưỡng
 *     24h và cờ enabled (Yêu cầu 7.4, 7.5).
 *   - decideNotificationKind(distance) — toast khi khoảng cách <= 3, dialog khi
 *     > 3 (Yêu cầu 7.7, 7.8).
 * File này chỉ lo phần CẠNH (đọc/ghi BackgroundCheckState, gọi kiểm tra theo
 * nền tảng, phát thông báo) và KHÔNG chứa lại các ngưỡng logic.
 *
 * KIỂM THỬ (task 11.2): mọi phụ thuộc đều BƠM ĐƯỢC qua
 * `createBackgroundCheckController(overrides)` để test trong Node/Vitest mà
 * không cần DOM/Electron. Bản mặc định `window.TingBackgroundCheck` (tạo ở
 * `desktop-app.js`) bơm phụ thuộc thật.
 *
 * Nạp trong webview (SAU khi đã nạp các module dùng chung `js/shared/*`):
 *   <script src="js/shared/update-core.js"></script>
 *   <script src="js/background-check.js"></script>
 * ============================================================================
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    // Node.js / Vitest: xuất factory + hằng số để kiểm thử.
    module.exports = factory(root);
  } else {
    // Webview / trình duyệt: gắn factory vào global. Instance mặc định do
    // desktop-app.js tạo (nơi biết được phụ thuộc thật: platform, updater...).
    root.TingBackgroundCheckFactory = factory(root);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // ---- Hằng số cấu hình -------------------------------------------------

  /**
   * Khóa lưu trạng thái Background_Check trong localStorage (Android/web).
   * `enabled` mặc định BẬT (Yêu cầu 7.1). `lastCheckAt` dùng chung khóa với
   * Mobile_Updater để hai bên không phân kỳ mốc thời gian 24h.
   */
  const STORAGE_KEY_ENABLED = 'ting.update.backgroundCheckEnabled';
  const STORAGE_KEY_LAST_CHECK = 'ting.update.lastBackgroundCheck';

  // ---- Factory ----------------------------------------------------------

  /**
   * Tạo một controller Background_Check với phụ thuộc có thể bơm.
   *
   * @param {Object} [overrides]
   * @param {Object}   [overrides.updateCore]  Module Update_Core (mặc định `TingShared.UpdateCore`).
   * @param {Object}   [overrides.versionCompare] Module Version_Comparator (fallback tính khoảng cách).
   * @param {() => number} [overrides.now]      Hàm lấy thời gian hiện tại (epoch ms).
   * @param {Storage}  [overrides.storage]      Kho localStorage (Android/web).
   * @param {() => Promise<{enabled:boolean,lastCheckAt:(number|null)}>|{...}} [overrides.readState]
   *        Ghi đè cách ĐỌC BackgroundCheckState (desktop dùng electron-store qua IPC).
   * @param {(state:{enabled?:boolean,lastCheckAt?:(number|null)}) => any} [overrides.writeState]
   *        Ghi đè cách GHI BackgroundCheckState (desktop dùng electron-store qua IPC).
   * @param {(opts:{background:boolean}) => Promise<Object>} [overrides.runCheck]
   *        Hàm thực hiện kiểm tra cập nhật theo nền tảng; trả về `{status, message, info}`
   *        (Android) hoặc phát sự kiện (desktop — xem `notifyUpdateAvailable`).
   * @param {(payload:{kind:('toast'|'dialog'), info:Object, distance:number}) => void} [overrides.notify]
   *        Phát thông báo tới UI (toast nhẹ hoặc dialog nổi, kèm hành động cập nhật + bỏ qua).
   * @returns {Object} Controller với các phương thức điều phối.
   */
  function createBackgroundCheckController(overrides) {
    const deps = overrides || {};

    const shared = (root && root.TingShared) || {};
    const updateCore = deps.updateCore || shared.UpdateCore;
    const versionCompare = deps.versionCompare || shared.VersionCompare || null;
    const now = typeof deps.now === 'function' ? deps.now : function () { return Date.now(); };
    const storage = deps.storage || (root && root.localStorage) || null;
    const runCheck = typeof deps.runCheck === 'function' ? deps.runCheck : null;
    const notify = typeof deps.notify === 'function' ? deps.notify : function () {};
    const readStateOverride = typeof deps.readState === 'function' ? deps.readState : null;
    const writeStateOverride = typeof deps.writeState === 'function' ? deps.writeState : null;

    if (!updateCore || typeof updateCore.shouldRunBackgroundCheck !== 'function'
        || typeof updateCore.decideNotificationKind !== 'function') {
      throw new Error('Background_Check_Controller cần TingShared.UpdateCore (shouldRunBackgroundCheck, decideNotificationKind).');
    }

    // ---- Đọc/ghi BackgroundCheckState từ localStorage (mặc định) --------

    /**
     * Đọc cờ `enabled` từ localStorage. MẶC ĐỊNH BẬT khi chưa có giá trị
     * (Yêu cầu 7.1). Chỉ coi là tắt khi lưu tường minh `'false'`/`'0'`.
     * @returns {boolean}
     */
    function readEnabledFromStorage() {
      if (!storage) return true;
      try {
        const raw = storage.getItem(STORAGE_KEY_ENABLED);
        if (raw === null || raw === undefined || raw === '') return true;
        return raw !== 'false' && raw !== '0';
      } catch (err) {
        return true;
      }
    }

    /**
     * Đọc mốc kiểm tra gần nhất (epoch ms) hoặc `null`.
     * @returns {number|null}
     */
    function readLastCheckFromStorage() {
      if (!storage) return null;
      try {
        const raw = storage.getItem(STORAGE_KEY_LAST_CHECK);
        if (raw === null || raw === undefined || raw === '') return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
      } catch (err) {
        return null;
      }
    }

    function writeEnabledToStorage(enabled) {
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
      } catch (err) {
        /* bỏ qua lỗi lưu trữ */
      }
    }

    function writeLastCheckToStorage(epochMs) {
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY_LAST_CHECK, String(epochMs));
      } catch (err) {
        /* bỏ qua lỗi lưu trữ */
      }
    }

    /**
     * Chuẩn hoá một BackgroundCheckState về đúng kiểu (enabled mặc định true).
     * @param {*} raw
     * @returns {{enabled: boolean, lastCheckAt: (number|null)}}
     */
    function normalizeState(raw) {
      const src = (raw && typeof raw === 'object') ? raw : {};
      const enabled = src.enabled === undefined || src.enabled === null ? true : Boolean(src.enabled);
      let lastCheckAt = src.lastCheckAt;
      if (typeof lastCheckAt !== 'number' || !Number.isFinite(lastCheckAt)) lastCheckAt = null;
      return { enabled, lastCheckAt };
    }

    /**
     * Đọc BackgroundCheckState. Ưu tiên `readState` được bơm (desktop
     * electron-store); mặc định đọc từ localStorage (Android/web).
     * @returns {Promise<{enabled: boolean, lastCheckAt: (number|null)}>}
     */
    async function getState() {
      if (readStateOverride) {
        try {
          return normalizeState(await readStateOverride());
        } catch (err) {
          // Suy giảm nhẹ nhàng về mặc định bật nếu nguồn state lỗi.
          return { enabled: true, lastCheckAt: null };
        }
      }
      return normalizeState({
        enabled: readEnabledFromStorage(),
        lastCheckAt: readLastCheckFromStorage(),
      });
    }

    /**
     * Ghi một phần BackgroundCheckState. Ưu tiên `writeState` được bơm.
     * @param {{enabled?: boolean, lastCheckAt?: (number|null)}} patch
     * @returns {Promise<void>}
     */
    async function writeState(patch) {
      if (writeStateOverride) {
        try {
          await writeStateOverride(patch);
        } catch (err) {
          /* bỏ qua lỗi lưu trữ */
        }
        return;
      }
      if (patch && Object.prototype.hasOwnProperty.call(patch, 'enabled')) {
        writeEnabledToStorage(Boolean(patch.enabled));
      }
      if (patch && Object.prototype.hasOwnProperty.call(patch, 'lastCheckAt')
          && typeof patch.lastCheckAt === 'number' && Number.isFinite(patch.lastCheckAt)) {
        writeLastCheckToStorage(patch.lastCheckAt);
      }
    }

    // ---- API trạng thái cài đặt ---------------------------------------

    /**
     * Trả về cờ `enabled` hiện tại (Yêu cầu 7.1 mặc định bật).
     * @returns {Promise<boolean>}
     */
    async function isEnabled() {
      const state = await getState();
      return state.enabled;
    }

    /**
     * Bật/tắt Background_Check (Yêu cầu 7.5 — khi tắt chỉ kiểm tra thủ công).
     * @param {boolean} enabled
     * @returns {Promise<void>}
     */
    async function setEnabled(enabled) {
      await writeState({ enabled: Boolean(enabled) });
    }

    /**
     * Ghi mốc kiểm tra gần nhất.
     * @param {number} [epochMs]
     * @returns {Promise<void>}
     */
    async function markChecked(epochMs) {
      const ts = typeof epochMs === 'number' && Number.isFinite(epochMs) ? epochMs : now();
      await writeState({ lastCheckAt: ts });
    }

    // ---- Quyết định thông báo -----------------------------------------

    /**
     * Tính khoảng cách phiên bản cho một `info`. Ưu tiên `info.distance` (đã
     * do updater tính). Fallback dùng Version_Comparator nếu có đủ dữ liệu.
     * @param {Object} info UpdateInfo (có thể chứa `manifest`).
     * @returns {number} Khoảng cách phiên bản (số nguyên không âm).
     */
    function resolveDistance(info) {
      if (!info || typeof info !== 'object') return 0;
      const direct = Number(info.distance);
      if (Number.isFinite(direct) && direct >= 0) return direct;
      if (versionCompare && typeof versionCompare.versionDistance === 'function') {
        try {
          const manifest = info.manifest || null;
          const installed = info.currentVersion;
          const latest = (manifest && manifest.latestVersion) || info.latestVersion;
          const d = versionCompare.versionDistance(installed, latest);
          if (Number.isFinite(d) && d >= 0) return d;
        } catch (err) {
          /* fallback về 0 bên dưới */
        }
      }
      return 0;
    }

    /**
     * Với một bản cập nhật khả dụng, quyết định kiểu thông báo theo khoảng cách
     * (toast <= 3, dialog > 3 — Yêu cầu 7.7/7.8) và phát tới UI kèm hành động
     * cập nhật + tùy chọn bỏ qua (Yêu cầu 7.6). Dùng được cho cả Android
     * (từ kết quả checkForUpdate) lẫn desktop (từ sự kiện update-available).
     *
     * @param {Object} info UpdateInfo của bản cập nhật.
     * @returns {{ kind: ('toast'|'dialog'), distance: number }|null}
     */
    function notifyUpdateAvailable(info) {
      if (!info || typeof info !== 'object') return null;
      const distance = resolveDistance(info);
      const kind = updateCore.decideNotificationKind(distance);
      notify({ kind, info, distance });
      return { kind, distance };
    }

    /**
     * Xử lý kết quả kiểm tra (Android). Chỉ thông báo khi có bản cập nhật.
     * @param {Object} result Kết quả từ `runCheck` ({status, message, info}).
     * @returns {{ kind: ('toast'|'dialog'), distance: number }|null}
     */
    function handleCheckResult(result) {
      if (!result || result.status !== 'update-available' || !result.info) return null;
      return notifyUpdateAvailable(result.info);
    }

    // ---- Điều phối lúc khởi động --------------------------------------

    /**
     * Quyết định (không I/O) có nên chạy Background_Check lúc này hay không,
     * dựa trên state hiện tại và thời điểm `now`. Uỷ quyền hoàn toàn cho
     * `updateCore.shouldRunBackgroundCheck` (Yêu cầu 7.4/7.5).
     * @returns {Promise<boolean>}
     */
    async function shouldRun() {
      const state = await getState();
      return updateCore.shouldRunBackgroundCheck(state.lastCheckAt, now(), state.enabled);
    }

    /**
     * Điều phối Background_Check lúc app khởi động xong.
     *
     * - KHÔNG chặn khởi động: hàm này nên được gọi mà KHÔNG await ở luồng khởi
     *   động (Yêu cầu 7.3). Bản thân hàm cũng không thực hiện thao tác nặng
     *   trước khi quyết định bỏ qua.
     * - Tôn trọng cờ `enabled` (7.5) và ngưỡng 24h (7.4) qua `shouldRun`.
     * - Khi chạy: ghi mốc thời gian NGAY để khoá tần suất 24h, rồi gọi
     *   `runCheck({background:true})`. Với Android, kết quả trả về được xử lý
     *   để phát toast/dialog. Với desktop (event-driven), thông báo do
     *   `notifyUpdateAvailable` phát khi nhận sự kiện update-available.
     *
     * @returns {Promise<{ ran: boolean, reason?: string, result?: Object, notified?: Object|null, error?: Error }>}
     */
    async function runAtStartup() {
      const state = await getState();

      if (!state.enabled) {
        return { ran: false, reason: 'disabled' };
      }
      if (!updateCore.shouldRunBackgroundCheck(state.lastCheckAt, now(), state.enabled)) {
        return { ran: false, reason: 'throttled' };
      }

      // Ghi mốc NGAY để đảm bảo tối đa một lần kiểm tra mỗi 24h kể cả khi
      // runCheck lỗi/không tự lưu mốc (Yêu cầu 7.4).
      await markChecked(now());

      if (!runCheck) {
        return { ran: false, reason: 'no-runner' };
      }

      let result = null;
      try {
        result = await runCheck({ background: true });
      } catch (err) {
        return { ran: true, result: null, notified: null, error: err };
      }

      const notified = handleCheckResult(result);
      return { ran: true, result, notified };
    }

    // ---- API công khai của instance -----------------------------------

    return {
      isEnabled,
      setEnabled,
      getState,
      markChecked,
      shouldRun,
      runAtStartup,
      handleCheckResult,
      notifyUpdateAvailable,
      STORAGE_KEY_ENABLED,
      STORAGE_KEY_LAST_CHECK,
    };
  }

  // ---- Xuất API cấp module ---------------------------------------------

  return {
    createBackgroundCheckController,
    STORAGE_KEY_ENABLED,
    STORAGE_KEY_LAST_CHECK,
  };
}));
