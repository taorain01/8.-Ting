// ============================================================================
// Unit test cho điều hướng wizard 3 tab của form "Thêm/Sửa TK" trong js/utils.js:
//   - goAddTab(tab, opts): clamp 1..3, cập nhật addFormTab/addFormMaxTabReached,
//     ẩn/hiện đúng .add-wizard-panel, luật hủy auto-nav R6.4 (manual + lùi tab).
//   - maybeAutoAdvanceToStep3(): chỉ nhảy Tab 3 khi đủ tên+hạn; guard 1 lần/phiên
//     (R6.2) và guard kill-switch (R6.4).
//   - selectPlatformThenAdvance / skipPlatformStep.
//
// Dựng sandbox vm nạp js/utils.js với DOM mock hỗ trợ querySelectorAll cho panel
// (.add-wizard-panel[data-tab]) + stepper. Theo mẫu vm-sandbox sẵn có của dự án
// (không dùng jsdom — không có trong dependencies).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const UTILS_SRC = fs.readFileSync(path.join(ROOT, 'js', 'utils.js'), 'utf8');

function createWizardEnv() {
  // --- DOM mock ------------------------------------------------------------
  const elements = {};
  function makeElement(id, attrs = {}) {
    const el = {
      id,
      value: '',
      checked: false,
      disabled: false,
      hidden: false,
      style: {},
      dataset: { ...(attrs.dataset || {}) },
      classList: {
        _set: new Set(),
        add(...c) { c.forEach(x => this._set.add(x)); },
        remove(...c) { c.forEach(x => this._set.delete(x)); },
        toggle(c, force) {
          const has = this._set.has(c);
          const on = force === undefined ? !has : force;
          if (on) this._set.add(c); else this._set.delete(c);
          return on;
        },
        contains(c) { return this._set.has(c); },
      },
      focus() {},
      blur() {},
      scrollIntoView() {},
      setSelectionRange() {},
      closest() { return null; },
    };
    return el;
  }

  // 3 panel wizard + stepper buttons + các ô dữ liệu cho maybeAutoAdvance.
  const panels = [1, 2, 3].map(tab => makeElement(`add-tab-${tab}`, { dataset: { tab: String(tab) } }));
  panels.forEach(p => { elements[p.id] = p; });
  const steps = [1, 2, 3].map(tab => makeElement(`step-${tab}`, { dataset: { step: String(tab) } }));

  ['add-name', 'add-expiry', 'add-lifetime', 'paste-input', 'add-note'].forEach(id => {
    elements[id] = makeElement(id);
  });

  const documentMock = {
    getElementById(id) { return elements[id] || null; },
    querySelectorAll(sel) {
      if (sel === '.add-wizard-panel') return panels;
      if (sel.includes('add-wizard-step')) return steps;
      return [];
    },
    get activeElement() { return null; },
  };

  // --- Sandbox -------------------------------------------------------------
  const sandbox = {
    console,
    Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON, RegExp,
    parseInt, parseFloat, isNaN,
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    document: documentMock,
  };
  sandbox.window = {
    appState: {
      addFormTab: 1,
      addFormMaxTabReached: 1,
      addFormAutoAdvancedToStep3: false,
      addFormAutoNavDisabled: false,
      addFormPlatform: null,
    },
    document: documentMock,
    setTimeout: sandbox.setTimeout,
    clearTimeout: sandbox.clearTimeout,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UTILS_SRC, sandbox);

  return {
    window: sandbox.window,
    state: sandbox.window.appState,
    elements,
    panels,
    visibleTab() {
      const shown = panels.filter(p => p.hidden === false);
      return shown.length === 1 ? Number(shown[0].dataset.tab) : shown.map(p => Number(p.dataset.tab));
    },
    call(name, ...args) { return sandbox.window[name](...args); },
  };
}

describe('goAddTab — điều hướng cơ bản', () => {
  it('clamp về [1..3] và cập nhật addFormTab + addFormMaxTabReached', () => {
    const env = createWizardEnv();
    env.call('goAddTab', 2);
    expect(env.state.addFormTab).toBe(2);
    expect(env.state.addFormMaxTabReached).toBe(2);

    env.call('goAddTab', 99);
    expect(env.state.addFormTab).toBe(3);
    expect(env.state.addFormMaxTabReached).toBe(3);

    env.call('goAddTab', -5);
    expect(env.state.addFormTab).toBe(1);
    // maxReached không giảm
    expect(env.state.addFormMaxTabReached).toBe(3);
  });

  it('chỉ hiển thị đúng một panel theo tab hiện tại', () => {
    const env = createWizardEnv();
    env.call('goAddTab', 1);
    expect(env.visibleTab()).toBe(1);
    env.call('goAddTab', 3);
    expect(env.visibleTab()).toBe(3);
  });

  it('stepper cho phép nhảy thẳng tới bất kỳ tab nào', () => {
    const env = createWizardEnv();
    env.call('goAddTab', 3, { fromStepper: true });
    expect(env.state.addFormTab).toBe(3);
    expect(env.state.addFormMaxTabReached).toBe(3);
  });
});

describe('goAddTab — luật hủy auto-nav R6.4', () => {
  it('KHI user chủ động (manual) lùi về tab nhỏ hơn THÌ bật addFormAutoNavDisabled', () => {
    const env = createWizardEnv();
    env.call('goAddTab', 3);                       // auto tiến tới 3
    expect(env.state.addFormAutoNavDisabled).toBe(false);
    env.call('goAddTab', 1, { manual: true });     // user lùi về 1
    expect(env.state.addFormAutoNavDisabled).toBe(true);
  });

  it('tiến tới tab lớn hơn (manual) KHÔNG bật kill-switch', () => {
    const env = createWizardEnv();
    env.call('goAddTab', 2, { manual: true });
    expect(env.state.addFormAutoNavDisabled).toBe(false);
  });
});

describe('maybeAutoAdvanceToStep3 — R6.1 / R6.2 / R6.4', () => {
  it('KHÔNG nhảy khi thiếu tên (và không có nền tảng)', () => {
    const env = createWizardEnv();
    env.elements['add-name'].value = '';
    env.state.addFormPlatform = null;
    env.elements['add-lifetime'].checked = true;
    env.call('maybeAutoAdvanceToStep3');
    expect(env.state.addFormTab).toBe(1);
    expect(env.state.addFormAutoAdvancedToStep3).toBe(false);
  });

  it('KHÔNG nhảy khi thiếu hạn (không lifetime, không expiry)', () => {
    const env = createWizardEnv();
    env.elements['add-name'].value = 'ChatGPT';
    env.elements['add-lifetime'].checked = false;
    env.elements['add-expiry'].value = '';
    env.call('maybeAutoAdvanceToStep3');
    expect(env.state.addFormTab).toBe(1);
  });

  it('nhảy sang Tab 3 khi đủ tên + hạn, và set guard 1 lần/phiên', () => {
    const env = createWizardEnv();
    env.elements['add-name'].value = 'ChatGPT';
    env.elements['add-expiry'].value = '2030-01-01';
    env.call('maybeAutoAdvanceToStep3');
    expect(env.state.addFormTab).toBe(3);
    expect(env.state.addFormAutoAdvancedToStep3).toBe(true);
  });

  it('lifetime cũng tính là có hạn (đủ điều kiện nhảy)', () => {
    const env = createWizardEnv();
    env.state.addFormPlatform = 'openai';   // hasName qua nền tảng
    env.elements['add-lifetime'].checked = true;
    env.call('maybeAutoAdvanceToStep3');
    expect(env.state.addFormTab).toBe(3);
  });

  it('guard R6.2: chỉ auto-nhảy MỘT lần/phiên', () => {
    const env = createWizardEnv();
    env.elements['add-name'].value = 'ChatGPT';
    env.elements['add-expiry'].value = '2030-01-01';
    env.call('maybeAutoAdvanceToStep3');       // nhảy tới 3
    env.call('goAddTab', 2, { manual: true }); // nhưng manual lùi → cũng bật kill-switch
    // reset kill-switch để cô lập test guard R6.2:
    env.state.addFormAutoNavDisabled = false;
    env.call('maybeAutoAdvanceToStep3');       // không nhảy lại vì đã advanced
    expect(env.state.addFormTab).toBe(2);
  });

  it('guard R6.4: khi addFormAutoNavDisabled=true thì KHÔNG auto-nhảy', () => {
    const env = createWizardEnv();
    env.state.addFormAutoNavDisabled = true;
    env.elements['add-name'].value = 'ChatGPT';
    env.elements['add-expiry'].value = '2030-01-01';
    env.call('maybeAutoAdvanceToStep3');
    expect(env.state.addFormTab).toBe(1);
    expect(env.state.addFormAutoAdvancedToStep3).toBe(false);
  });
});

describe('skipPlatformStep — R2.3', () => {
  it('chuyển sang Tab 2 (manual)', () => {
    const env = createWizardEnv();
    env.call('skipPlatformStep');
    expect(env.state.addFormTab).toBe(2);
  });
});
