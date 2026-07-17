const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const UTILS = fs.readFileSync(path.join(ROOT, 'js', 'utils.js'), 'utf8');

function makeClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    toggle(value, force) {
      if (force === undefined ? !values.has(value) : force) values.add(value);
      else values.delete(value);
    },
    contains(value) { return values.has(value); },
  };
}

function loadReleaseHistory() {
  const buttons = ['1.7.3', '1.7.2', '1.7.1', '1.7.0', '1.6.0'].map(version => ({
    dataset: { releaseVersion: version },
    classList: makeClassList(),
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    scrollIntoView() {},
  }));
  const detail = {
    innerHTML: '',
    classList: makeClassList(),
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const root = {
    querySelectorAll: selector => selector === '[data-release-version]' ? buttons : [],
    querySelector(selector) {
      if (selector === '[data-release-detail]') return detail;
      const match = selector.match(/data-release-version="([^"]+)"/);
      return match ? buttons.find(button => button.dataset.releaseVersion === match[1]) : null;
    },
  };
  const documentMock = {
    querySelector: selector => selector === '[data-release-history]' ? root : null,
    documentElement: { classList: makeClassList() },
  };
  const sandbox = {
    window: {}, document: documentMock, console, setTimeout, clearTimeout,
    requestAnimationFrame: callback => callback(),
    Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${UTILS}\n;globalThis.__release = { getTingReleaseHistory, renderTingReleaseHistory, selectTingReleaseVersion };`, sandbox);
  return { exports: sandbox.__release, window: sandbox.window, buttons, detail };
}

describe('Release history selector', () => {
  it('renders all versions but only one selected detail panel', () => {
    const { exports } = loadReleaseHistory();
    const html = exports.renderTingReleaseHistory();

    expect(html).toContain('Lịch sử phiên bản');
    expect(html).toContain('data-release-version="1.7.3"');
    expect(html).toContain('data-release-version="1.7.2"');
    expect(html).toContain('data-release-version="1.7.1"');
    expect(html).toContain('data-release-version="1.7.0"');
    expect(html).toContain('data-release-version="1.6.0"');
    expect(html).toContain('Ổn định giao diện Nhóm và biểu đồ Chi tiêu');
    expect((html.match(/role="tabpanel"/g) || []).length).toBe(1);
  });

  it('hides the previous detail and shows the clicked version', () => {
    const { exports, window, buttons, detail } = loadReleaseHistory();

    expect(exports.selectTingReleaseVersion('1.6.0')).toBe(true);
    expect(window.__tingSelectedReleaseVersion).toBe('1.6.0');
    expect(buttons[0].attributes['aria-selected']).toBe('false');
    expect(buttons[4].attributes['aria-selected']).toBe('true');
    expect(detail.innerHTML).toContain('Smart Paste và form thêm tài khoản');
    expect(detail.innerHTML).not.toContain('Ổn định PC/mobile và lịch sử phiên bản');
  });

  it('is wired into both desktop and mobile update screens', () => {
    const desktop = fs.readFileSync(path.join(ROOT, 'js', 'desktop-ui.js'), 'utf8');
    const mobile = fs.readFileSync(path.join(ROOT, 'mobile', 'js', 'ui.js'), 'utf8');
    expect(desktop).toContain('renderTingReleaseHistory()');
    expect(mobile).toContain('renderTingReleaseHistory()');
  });
});
