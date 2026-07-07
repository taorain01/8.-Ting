// Helper dựng DOM mô phỏng + fake timers để test luồng gợi ý form "Thêm tài khoản"
// trong `js/utils.js` (`handleQuickPasteGuidance`, `guideAddFormTo`, trạng thái
// `addFormGuide`). Vì logic phụ thuộc `document.activeElement` và `setTimeout`,
// helper cung cấp:
//   - DOM tối thiểu có theo dõi `activeElement` (focus/blur cập nhật đúng).
//   - Hàng đợi timer thủ công (`runAllTimers`) để điều khiển thứ tự chạy callback,
//     mô phỏng đúng chuỗi setTimeout(0) của guidance rồi focus trễ ~80ms trong
//     `guideAddFormTo`.
//
// Không dùng jsdom (không có trong dependencies); theo mẫu vm-sandbox sẵn có của dự án.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const UTILS_SRC = fs.readFileSync(path.join(ROOT, 'js', 'utils.js'), 'utf8');

// Tập id ô nhập mặc định của form "Thêm tài khoản" liên quan tới guidance.
const DEFAULT_IDS = [
  'paste-input',
  'add-smart-date',
  'add-name',
  'add-seller-name',
  'add-price',
  'add-note',
];

function createGuidanceEnv(options = {}) {
  // --- Hàng đợi timer thủ công -------------------------------------------
  const timers = [];
  let seq = 0;
  function fakeSetTimeout(fn, delay = 0) {
    const id = ++seq;
    timers.push({ id, fn, delay: Number(delay) || 0, order: seq });
    return id;
  }
  function fakeClearTimeout(id) {
    const idx = timers.findIndex(t => t.id === id);
    if (idx >= 0) timers.splice(idx, 1);
  }
  // Chạy toàn bộ timer (kể cả timer sinh thêm khi đang chạy) theo thứ tự
  // (delay tăng dần, cùng delay thì theo thứ tự lên lịch). Điều này tái hiện
  // đúng: guidance callback (delay 0) chạy trước, rồi focus trễ 80ms của
  // guideAddFormTo chạy sau.
  function runAllTimers() {
    let guard = 0;
    while (timers.length) {
      if (++guard > 10000) throw new Error('runAllTimers: nghi ngờ vòng lặp timer vô hạn');
      timers.sort((a, b) => (a.delay - b.delay) || (a.order - b.order));
      const t = timers.shift();
      t.fn();
    }
  }

  // --- DOM tối thiểu có theo dõi focus ------------------------------------
  let activeElement = null;
  const elements = {};
  function makeElement(id) {
    const el = {
      id,
      value: '',
      disabled: false,
      hidden: false,
      style: {},
      dataset: {},
      focus() { activeElement = el; },
      blur() { if (activeElement === el) activeElement = null; },
      scrollIntoView() {},
      setSelectionRange() {},
      closest() { return null; },
    };
    return el;
  }
  const ids = options.ids || DEFAULT_IDS;
  ids.forEach(id => { elements[id] = makeElement(id); });

  const documentMock = {
    getElementById(id) { return elements[id] || null; },
    get activeElement() { return activeElement; },
  };

  // --- Sandbox nạp js/utils.js -------------------------------------------
  // Cố ý KHÔNG cung cấp `requestAnimationFrame` và `getComputedStyle`:
  //   - Thiếu requestAnimationFrame => guideAddFormTo cuộn đồng bộ (nhánh else).
  //   - Thiếu getComputedStyle => isAddFormGuideTargetAvailable coi target khả dụng.
  const sandbox = {
    console,
    Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON, RegExp,
    parseInt, parseFloat, isNaN,
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    document: documentMock,
  };
  sandbox.window = {
    appState: {},
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    document: documentMock,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UTILS_SRC, sandbox);

  return {
    sandbox,
    window: sandbox.window,
    document: documentMock,
    elements,
    getActiveElement: () => activeElement,
    setActiveElement(id) { activeElement = elements[id] || null; return activeElement; },
    getGuideState() { return sandbox.window.appState.addFormGuide; },
    runAllTimers,
  };
}

module.exports = { createGuidanceEnv, DEFAULT_IDS };
