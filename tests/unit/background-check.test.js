// ============================================================================
// Feature: auto-update-system, Task 11.2: Unit test cho Background_Check.
//   Kiểm chứng điều phối Background_Check trong `js/background-check.js`:
//     - 7.1: `enabled` MẶC ĐỊNH BẬT khi chưa có state lưu trữ.
//     - 7.2: khởi động (runAtStartup) gọi kiểm tra KHÔNG CHẶN khi đủ điều kiện
//            (enabled + qua ngưỡng 24h hoặc chưa từng kiểm tra) — runCheck được gọi.
//     - 7.5: khi enabled = false (cờ tắt) → runAtStartup KHÔNG gọi runCheck.
//     - Ngưỡng 24h: lastCheckAt gần đây (< 24h) → KHÔNG chạy; cũ (>= 24h)
//            hoặc null → chạy.
//     - notifyUpdateAvailable chọn toast/dialog theo decideNotificationKind.
//
// Nguyên tắc kiểm thử: bơm phụ thuộc qua createBackgroundCheckController để
//   chạy trong Node/Vitest mà không cần DOM/Electron. Dùng Update_Core THẬT
//   (js/shared/update-core.js) để kiểm chứng ngưỡng logic đúng như production.
//
// Ghi chú: vitest bật `globals: true` nên describe/it/expect/vi là biến toàn
//   cục, KHÔNG cần require('vitest').
//
// Validates: Requirements 7.1, 7.2, 7.5
// ============================================================================

const {
  createBackgroundCheckController,
  STORAGE_KEY_ENABLED,
  STORAGE_KEY_LAST_CHECK,
} = require('../../js/background-check.js');
const UpdateCore = require('../../js/shared/update-core.js');

// Ngưỡng 24h thật lấy từ Update_Core để test khớp production.
const DAY_MS = UpdateCore.BACKGROUND_CHECK_INTERVAL_MS; // 24 * 60 * 60 * 1000

// ---- Fake localStorage (in-memory) ----------------------------------------
// Mô phỏng đủ getItem/setItem/removeItem cho controller. `seed` cho phép nạp
// sẵn các cặp key/value như trạng thái đã lưu trước đó.
function createFakeStorage(seed) {
  const map = new Map(Object.entries(seed || {}));
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
    // Tiện ích cho test đọc trực tiếp giá trị đã ghi.
    _dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

// Tạo controller với Update_Core thật + phụ thuộc bơm được. Trả về cả các mock
// để test có thể assert số lần gọi.
function makeController(options) {
  const opts = options || {};
  const storage = opts.storage || createFakeStorage(opts.seed);
  const now = typeof opts.now === 'number' ? opts.now : 1_000_000_000_000;
  const runCheck = 'runCheck' in opts ? opts.runCheck : vi.fn(async () => ({ status: 'up-to-date' }));
  const notify = opts.notify || vi.fn();

  const controller = createBackgroundCheckController({
    updateCore: UpdateCore,
    storage,
    now: () => now,
    runCheck,
    notify,
  });

  return { controller, storage, runCheck, notify, now };
}

// ===========================================================================
// 7.1 — enabled MẶC ĐỊNH BẬT khi chưa có state lưu trữ
// ===========================================================================
describe('7.1 Background_Check enabled mặc định BẬT', () => {
  it('isEnabled() trả về true khi storage rỗng (chưa lưu cờ)', async () => {
    const { controller } = makeController();
    await expect(controller.isEnabled()).resolves.toBe(true);
  });

  it('getState() trả về enabled=true và lastCheckAt=null khi chưa có state', async () => {
    const { controller } = makeController();
    const state = await controller.getState();
    expect(state).toEqual({ enabled: true, lastCheckAt: null });
  });

  it('coi là BẬT khi giá trị lưu là chuỗi rỗng', async () => {
    const { controller } = makeController({ seed: { [STORAGE_KEY_ENABLED]: '' } });
    await expect(controller.isEnabled()).resolves.toBe(true);
  });

  it('chỉ coi là TẮT khi lưu tường minh "false"', async () => {
    const { controller } = makeController({ seed: { [STORAGE_KEY_ENABLED]: 'false' } });
    await expect(controller.isEnabled()).resolves.toBe(false);
  });

  it('coi là TẮT khi lưu tường minh "0"', async () => {
    const { controller } = makeController({ seed: { [STORAGE_KEY_ENABLED]: '0' } });
    await expect(controller.isEnabled()).resolves.toBe(false);
  });
});

// ===========================================================================
// 7.2 — khởi động gọi kiểm tra KHÔNG CHẶN khi đủ điều kiện
// ===========================================================================
describe('7.2 runAtStartup gọi kiểm tra khi đủ điều kiện', () => {
  it('gọi runCheck({background:true}) khi enabled + chưa từng kiểm tra', async () => {
    const { controller, runCheck } = makeController(); // storage rỗng ⇒ enabled=true, lastCheckAt=null
    const result = await controller.runAtStartup();

    expect(runCheck).toHaveBeenCalledTimes(1);
    expect(runCheck).toHaveBeenCalledWith({ background: true });
    expect(result.ran).toBe(true);
  });

  it('runAtStartup trả về Promise (không chặn — có thể gọi mà không await)', () => {
    const { controller } = makeController();
    const returned = controller.runAtStartup();
    expect(typeof returned.then).toBe('function');
    return returned; // đảm bảo promise được giải quyết, tránh unhandled rejection
  });

  it('ghi mốc kiểm tra NGAY để khoá tần suất 24h trước khi chạy', async () => {
    const { controller, storage, now } = makeController();
    await controller.runAtStartup();
    expect(storage._dump()[STORAGE_KEY_LAST_CHECK]).toBe(String(now));
  });

  it('vẫn báo ran=true nhưng kèm error khi runCheck ném lỗi (không làm sập khởi động)', async () => {
    const boom = new Error('mạng lỗi');
    const runCheck = vi.fn(async () => { throw boom; });
    const { controller } = makeController({ runCheck });
    const result = await controller.runAtStartup();

    expect(result.ran).toBe(true);
    expect(result.error).toBe(boom);
    expect(result.notified).toBeNull();
  });

  it('báo reason="no-runner" khi không có runCheck được bơm', async () => {
    const { controller } = makeController({ runCheck: null });
    const result = await controller.runAtStartup();
    expect(result.ran).toBe(false);
    expect(result.reason).toBe('no-runner');
  });
});

// ===========================================================================
// 7.5 — cờ tắt: runAtStartup KHÔNG gọi runCheck
// ===========================================================================
describe('7.5 tôn trọng cờ tắt (enabled=false)', () => {
  it('KHÔNG gọi runCheck khi enabled=false, trả reason="disabled"', async () => {
    const { controller, runCheck } = makeController({
      seed: { [STORAGE_KEY_ENABLED]: 'false' },
    });
    const result = await controller.runAtStartup();

    expect(runCheck).not.toHaveBeenCalled();
    expect(result.ran).toBe(false);
    expect(result.reason).toBe('disabled');
  });

  it('KHÔNG gọi runCheck ngay cả khi đã quá 24h nhưng cờ tắt', async () => {
    const now = 2_000_000_000_000;
    const { controller, runCheck } = makeController({
      now,
      seed: {
        [STORAGE_KEY_ENABLED]: 'false',
        [STORAGE_KEY_LAST_CHECK]: String(now - DAY_MS - 1),
      },
    });
    const result = await controller.runAtStartup();

    expect(runCheck).not.toHaveBeenCalled();
    expect(result.ran).toBe(false);
  });

  it('setEnabled(false) rồi runAtStartup không chạy kiểm tra', async () => {
    const { controller, runCheck } = makeController();
    await controller.setEnabled(false);
    await expect(controller.isEnabled()).resolves.toBe(false);

    const result = await controller.runAtStartup();
    expect(runCheck).not.toHaveBeenCalled();
    expect(result.reason).toBe('disabled');
  });
});

// ===========================================================================
// Ngưỡng 24h — throttle theo lastCheckAt
// ===========================================================================
describe('Ngưỡng 24h kiểm soát tần suất', () => {
  const now = 2_000_000_000_000;

  it('lastCheckAt gần đây (< 24h) → KHÔNG chạy, reason="throttled"', async () => {
    const { controller, runCheck } = makeController({
      now,
      seed: { [STORAGE_KEY_LAST_CHECK]: String(now - (DAY_MS - 1)) },
    });
    const result = await controller.runAtStartup();

    expect(runCheck).not.toHaveBeenCalled();
    expect(result.ran).toBe(false);
    expect(result.reason).toBe('throttled');
  });

  it('lastCheckAt đúng bằng 24h trước (>= ngưỡng) → CHẠY', async () => {
    const { controller, runCheck } = makeController({
      now,
      seed: { [STORAGE_KEY_LAST_CHECK]: String(now - DAY_MS) },
    });
    const result = await controller.runAtStartup();

    expect(runCheck).toHaveBeenCalledTimes(1);
    expect(result.ran).toBe(true);
  });

  it('lastCheckAt rất cũ (> 24h) → CHẠY', async () => {
    const { controller, runCheck } = makeController({
      now,
      seed: { [STORAGE_KEY_LAST_CHECK]: String(now - DAY_MS * 10) },
    });
    const result = await controller.runAtStartup();

    expect(runCheck).toHaveBeenCalledTimes(1);
    expect(result.ran).toBe(true);
  });

  it('lastCheckAt = null (chưa từng kiểm tra) → CHẠY', async () => {
    const { controller, runCheck } = makeController({ now });
    const result = await controller.runAtStartup();

    expect(runCheck).toHaveBeenCalledTimes(1);
    expect(result.ran).toBe(true);
  });

  it('shouldRun() phản ánh đúng quyết định throttle (chưa chạy I/O)', async () => {
    const recent = makeController({
      now,
      seed: { [STORAGE_KEY_LAST_CHECK]: String(now - (DAY_MS - 1)) },
    });
    await expect(recent.controller.shouldRun()).resolves.toBe(false);

    const stale = makeController({
      now,
      seed: { [STORAGE_KEY_LAST_CHECK]: String(now - DAY_MS) },
    });
    await expect(stale.controller.shouldRun()).resolves.toBe(true);
  });
});

// ===========================================================================
// notifyUpdateAvailable — chọn toast/dialog theo decideNotificationKind
// ===========================================================================
describe('notifyUpdateAvailable chọn toast/dialog theo khoảng cách', () => {
  it('distance <= 3 → toast', () => {
    const { controller, notify } = makeController();
    const out = controller.notifyUpdateAvailable({ distance: 3 });

    expect(out).toEqual({ kind: 'toast', distance: 3 });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({ kind: 'toast', info: { distance: 3 }, distance: 3 });
  });

  it('distance > 3 → dialog', () => {
    const { controller, notify } = makeController();
    const out = controller.notifyUpdateAvailable({ distance: 4 });

    expect(out).toEqual({ kind: 'dialog', distance: 4 });
    expect(notify).toHaveBeenCalledWith({ kind: 'dialog', info: { distance: 4 }, distance: 4 });
  });

  it('trả về null và không notify khi info không hợp lệ', () => {
    const { controller, notify } = makeController();
    expect(controller.notifyUpdateAvailable(null)).toBeNull();
    expect(notify).not.toHaveBeenCalled();
  });

  it('runAtStartup phát thông báo khi kết quả có update-available (khoảng cách nhỏ ⇒ toast)', async () => {
    const info = { distance: 1 };
    const runCheck = vi.fn(async () => ({ status: 'update-available', info }));
    const { controller, notify } = makeController({ runCheck });

    const result = await controller.runAtStartup();
    expect(result.ran).toBe(true);
    expect(result.notified).toEqual({ kind: 'toast', distance: 1 });
    expect(notify).toHaveBeenCalledWith({ kind: 'toast', info, distance: 1 });
  });

  it('runAtStartup KHÔNG thông báo khi không có bản cập nhật', async () => {
    const runCheck = vi.fn(async () => ({ status: 'up-to-date' }));
    const { controller, notify } = makeController({ runCheck });

    const result = await controller.runAtStartup();
    expect(result.notified).toBeNull();
    expect(notify).not.toHaveBeenCalled();
  });
});
