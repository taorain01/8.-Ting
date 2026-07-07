// Helper nạp js/desktop-ui.js và js/desktop-app.js vào sandbox vm cho test UI.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const UI_SRC = fs.readFileSync(path.join(ROOT, 'js', 'desktop-ui.js'), 'utf8');
const APP_SRC = fs.readFileSync(path.join(ROOT, 'js', 'desktop-app.js'), 'utf8');
const UTILS_SRC = fs.readFileSync(path.join(ROOT, 'js', 'utils.js'), 'utf8');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
function escapeJsAttr(value) {
  return escapeHtml(String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

// Element giả lập tối thiểu, giữ được value để test "giữ nội dung ô nhập".
function makeElement() {
  return {
    value: '',
    innerHTML: '',
    textContent: '',
    disabled: false,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {}, remove() {}, setAttribute() {}, focus() {},
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
}

function makeDocument(elements = {}) {
  return {
    addEventListener() {},
    removeEventListener() {},
    getElementById(id) {
      if (!elements[id]) elements[id] = makeElement();
      return elements[id];
    },
    querySelector() { return makeElement(); },
    querySelectorAll() { return []; },
    createElement() { return makeElement(); },
    body: { style: {}, appendChild() {} },
  };
}

function baseSandbox(overrides = {}) {
  const elements = overrides.elements || {};
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON,
    Promise, Error, RegExp, parseInt, parseFloat, isNaN,
    escapeHtml, escapeJsAttr,
    document: makeDocument(elements),
    ...overrides.globals,
  };
  sandbox.window = { appState: overrides.appState || {}, ...overrides.window };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.__elements = elements;
  return sandbox;
}

function loadDesktopUi(overrides = {}) {
  const snippet = `
    ;globalThis.__uiExports = {
      renderGroupSettings: typeof renderGroupSettings === 'function' ? renderGroupSettings : undefined,
      renderGroupInviteCard: typeof renderGroupInviteCard === 'function' ? renderGroupInviteCard : undefined,
      renderAccountList: typeof renderAccountList === 'function' ? renderAccountList : undefined,
      mountSearchToolbarButtons: typeof mountSearchToolbarButtons === 'function' ? mountSearchToolbarButtons : undefined,
      unmountSearchToolbarButtons: typeof unmountSearchToolbarButtons === 'function' ? unmountSearchToolbarButtons : undefined,
      renderShowExpiredToggle: typeof renderShowExpiredToggle === 'function' ? renderShowExpiredToggle : undefined,
      renderTrashList: typeof renderTrashList === 'function' ? renderTrashList : undefined,
      renderTrashCard: typeof renderTrashCard === 'function' ? renderTrashCard : undefined,
    };
  `;
  const sandbox = baseSandbox(overrides);
  vm.createContext(sandbox);
  // Tuỳ chọn nạp kèm js/utils.js vào CÙNG sandbox (opt-in, mặc định tắt để không
  // ảnh hưởng các test hiện có). Hữu ích khi cần các hàm thuần thật của utils.js
  // (getResolvedPlatform, buildAccountDisplayItems, isExpiredAccount, ...) cho các
  // hàm render trong desktop-ui.js. Hai file không có khai báo const/let top-level
  // trùng tên nên nối chuỗi an toàn.
  const src = overrides.includeUtils ? (UTILS_SRC + '\n;' + UI_SRC) : UI_SRC;
  vm.runInContext(src + snippet, sandbox);
  return { sandbox, exports: sandbox.__uiExports };
}

function loadDesktopApp(overrides = {}) {
  const snippet = `
    ;globalThis.__appExports = {
      isJoinPasswordInputAcceptable: typeof isJoinPasswordInputAcceptable === 'function' ? isJoinPasswordInputAcceptable : undefined,
      updateAcceptGroupInviteButton: typeof updateAcceptGroupInviteButton === 'function' ? updateAcceptGroupInviteButton : undefined,
      submitAcceptGroupInvite: typeof submitAcceptGroupInvite === 'function' ? submitAcceptGroupInvite : undefined,
      submitJoinPassword: typeof submitJoinPassword === 'function' ? submitJoinPassword : undefined,
      handleRemoveGroupJoinPassword: typeof handleRemoveGroupJoinPassword === 'function' ? handleRemoveGroupJoinPassword : undefined,
      openJoinPasswordModal: typeof openJoinPasswordModal === 'function' ? openJoinPasswordModal : undefined,
      getShowExpiredState: typeof getShowExpiredState === 'function' ? getShowExpiredState : undefined,
      toggleShowExpired: typeof toggleShowExpired === 'function' ? toggleShowExpired : undefined,
      restoreAccount: typeof restoreAccount === 'function' ? restoreAccount : undefined,
    };
  `;
  const sandbox = baseSandbox(overrides);
  vm.createContext(sandbox);
  vm.runInContext(APP_SRC + snippet, sandbox);
  return { sandbox, exports: sandbox.__appExports };
}

module.exports = { loadDesktopUi, loadDesktopApp, makeElement, escapeHtml, escapeJsAttr };
