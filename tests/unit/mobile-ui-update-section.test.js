const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MOBILE_UI_PATH = path.join(__dirname, '..', '..', 'mobile', 'js', 'ui.js');
const MOBILE_UI_SRC = fs.readFileSync(MOBILE_UI_PATH, 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingMobileUiExports = {
  renderSettings: renderSettings,
  renderUpdateSection: renderUpdateSection,
};
`;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function makeStubElement() {
  return {
    innerHTML: '',
    textContent: '',
    className: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {},
    remove() {},
    setAttribute() {},
    removeAttribute() {},
    style: {},
    dataset: {},
  };
}

function loadMobileUi(windowOverrides = {}) {
  const pageContent = makeStubElement();
  const windowObj = Object.assign({
    appState: {
      appVersion: '1.4.3',
      updateStatus: null,
      updateLog: [],
      settings: { theme: 'system' },
      trashAccounts: [],
      customCategories: [],
    },
    TingShared: {
      PlatformDetector: {
        detectPlatform: () => 'android',
        updateCapability: () => ({ canCheck: true, disabledMessage: null }),
      },
    },
  }, windowOverrides);

  const documentMock = {
    addEventListener() {},
    removeEventListener() {},
    getElementById(id) {
      if (id === 'page-content') return pageContent;
      return makeStubElement();
    },
    createElement() { return makeStubElement(); },
    querySelector() { return makeStubElement(); },
    querySelectorAll() { return []; },
    body: { style: {} },
  };

  const sandbox = {
    window: windowObj,
    document: documentMock,
    console,
    setTimeout,
    clearTimeout,
    Date,
    escapeHtml,
  };
  vm.createContext(sandbox);
  vm.runInContext(MOBILE_UI_SRC + EXPORT_SNIPPET, sandbox, { filename: MOBILE_UI_PATH });
  return { exports: sandbox.__tingMobileUiExports, pageContent, window: windowObj };
}

describe('mobile Settings update section', () => {
  it('renders version and Check button in Settings', () => {
    const { exports, pageContent } = loadMobileUi();
    exports.renderSettings();

    expect(pageContent.innerHTML).toContain('Phiên bản');
    expect(pageContent.innerHTML).toContain('Ting! v1.4.3');
    expect(pageContent.innerHTML).toContain('Kiểm tra');
  });

  it('shows Update button when Android update is available', () => {
    const { exports } = loadMobileUi({
      appState: {
        appVersion: '1.4.3',
        updateStatus: { status: 'update-available', info: { latestVersion: '1.3.10', releaseNotes: 'Fix' } },
        updateLog: [],
        settings: { theme: 'system' },
        trashAccounts: [],
        customCategories: [],
      },
    });

    const html = exports.renderUpdateSection();
    expect(html).toContain('Phiên bản mới 1.3.10');
    expect(html).toContain('startUpdateDownload()');
  });

  it('hides same-version release info when already up to date', () => {
    const { exports } = loadMobileUi({
      appState: {
        appVersion: '1.4.3',
        updateStatus: {
          status: 'up-to-date',
          info: { latestVersion: '1.4.3', releaseNotes: '<p>Current release notes</p>' },
        },
        updateLog: [],
        settings: { theme: 'system' },
        trashAccounts: [],
        customCategories: [],
      },
    });

    const html = exports.renderUpdateSection();
    expect(html).not.toContain('settings-update-latest');
    expect(html).not.toContain('settings-update-notes');
  });

  it('renders HTML release notes as clean text for available updates', () => {
    const { exports } = loadMobileUi({
      appState: {
        appVersion: '1.4.0',
        updateStatus: {
          status: 'update-available',
          info: { latestVersion: '1.4.2', releaseNotes: '<p>Fix html notes</p>' },
        },
        updateLog: [],
        settings: { theme: 'system' },
        trashAccounts: [],
        customCategories: [],
      },
    });

    const html = exports.renderUpdateSection();
    expect(html).toContain('Fix html notes');
    expect(html).not.toContain('&lt;p&gt;');
    expect(html).not.toContain('<p>Fix html notes</p>');
  });
});
