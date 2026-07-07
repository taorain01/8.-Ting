const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DESKTOP_UI_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'desktop-ui.js'), 'utf8');
const MOBILE_UI_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'mobile', 'js', 'ui.js'), 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingGroupExports = {
  renderAccountGroup,
  getAccountGroupNoteRows,
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

function escapeJsAttr(value) {
  return escapeHtml(String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

function makeDocument() {
  const element = {
    innerHTML: '',
    textContent: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {},
    remove() {},
    setAttribute() {},
    style: {},
    dataset: {},
  };
  return {
    addEventListener() {},
    removeEventListener() {},
    getElementById() { return element; },
    querySelector() { return element; },
    querySelectorAll() { return []; },
    createElement() { return { ...element }; },
    body: { style: {} },
  };
}

function makeSandbox() {
  const appState = {
    expandedGroups: {},
    visibleGroupNotes: {},
    settings: {},
  };
  const sandbox = {
    window: {
      appState,
      AUTH_METHOD_CONFIG: {},
      TingShared: {
        PlatformDetector: {
          detectPlatform: () => 'web',
          updateCapability: () => ({ canCheck: false }),
        },
      },
    },
    document: makeDocument(),
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    JSON,
    escapeHtml,
    escapeJsAttr,
    renderInlineNoteSegments: line => escapeHtml(line),
    renderSmartNote: note => `<div class="smart-note">${String(note || '')
      .split(/\r?\n/)
      .map(line => `<div class="smart-note-line">${escapeHtml(line)}</div>`)
      .join('')}</div>`,
    daysUntil: date => (date === '2000-01-01' ? -1 : 30),
    formatDateVN: date => date,
    getStatusFromExpiry: date => (date === '2000-01-01' ? 'expired' : 'active'),
    getStatusBadgeClass: status => `badge-${status}`,
    getStatusText: status => ({ active: 'Hoạt động', expiring: 'Sắp hết hạn', expired: 'Đã hết hạn' }[status] || status),
    getGroupExpirySummary: () => '2 ngày hạn khác nhau',
    getPlatformLabel: () => 'ChatGPT / OpenAI',
    getPlatformEmoji: () => 'AI',
    getPlatformLogoStyle: () => '',
    renderPlatformLogoMark: () => '<span>AI</span>',
    stringToColor: () => '#6C5CE7',
    maskUsername: value => String(value || ''),
    isAccountFavorite: acc => acc?.isFavorite === true,
    isAccountPinned: acc => acc?.isPinned === true,
    accountMatchesTag: () => true,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  return sandbox;
}

function loadRenderer(src) {
  const sandbox = makeSandbox();
  vm.createContext(sandbox);
  vm.runInContext(src + EXPORT_SNIPPET, sandbox);
  return { exports: sandbox.__tingGroupExports, window: sandbox.window };
}

function makeGroup() {
  return {
    key: 'platform-openai',
    platform: 'openai',
    accounts: [
      {
        id: 'active-note',
        name: 'ChatGPT / OpenAI',
        platform: 'openai',
        status: 'active',
        expiryDate: '2099-01-01',
        expiryType: 'fixed',
        displayUsername: 'active@example.com',
        note: 'Alpha <tag>',
      },
      {
        id: 'expired-note',
        name: 'ChatGPT / OpenAI',
        platform: 'openai',
        status: 'expired',
        expiryDate: '2000-01-01',
        expiryType: 'fixed',
        displayUsername: 'expired@example.com',
        note: 'Beta note',
      },
      {
        id: 'empty-note',
        name: 'ChatGPT / OpenAI',
        platform: 'openai',
        status: 'active',
        expiryDate: '2099-01-02',
        expiryType: 'fixed',
        displayUsername: 'empty@example.com',
        note: '',
      },
    ],
  };
}

describe.each([
  ['desktop', DESKTOP_UI_SRC],
  ['mobile', MOBILE_UI_SRC],
])('account group note rendering: %s', (_label, src) => {
  it('does not render a group-level expired badge but keeps expired summary text', () => {
    const { exports } = loadRenderer(src);
    const html = exports.renderAccountGroup(makeGroup(), false);

    expect(html).not.toContain('account-badge badge-expired');
    expect(html).toContain('1 hết hạn');
    expect(html).toContain('account-group-note-toggle');
  });

  it('renders all readable notes only when the group note toggle is enabled', () => {
    const { exports, window } = loadRenderer(src);
    const group = makeGroup();

    const collapsedHtml = exports.renderAccountGroup(group, false);
    expect(collapsedHtml).not.toContain('Alpha &lt;tag&gt;');
    expect(collapsedHtml).not.toContain('Beta note');

    window.appState.visibleGroupNotes[group.key] = true;
    const notesHtml = exports.renderAccountGroup(group, false);

    expect(notesHtml).toContain('account-group-notes');
    expect(notesHtml).toContain('checked');
    expect(notesHtml).toContain('Alpha &lt;tag&gt;');
    expect(notesHtml).toContain('Beta note');
    expect(notesHtml).not.toContain('empty@example.com');
  });

  it('hides the note toggle when no account in the group has a readable note', () => {
    const { exports } = loadRenderer(src);
    const group = makeGroup();
    group.accounts = group.accounts.map(acc => ({ ...acc, note: '' }));

    const html = exports.renderAccountGroup(group, false);

    expect(exports.getAccountGroupNoteRows(group.accounts)).toHaveLength(0);
    expect(html).not.toContain('account-group-note-toggle');
  });
});
