// ============================================================================
// Unit test cho "quiet render bảo toàn trạng thái" của Group_Detail_View
// (task 4.2 — spec group-tab-redesign).
//
// Kiểm chứng phần đã triển khai ở task 4.1 trong js/desktop-ui.js:
//   - captureDetailUiState(container): chụp scrollTop vùng cuộn + phần tử đang
//     focus (selector ổn định) + selectionStart/End.
//   - restoreDetailUiState(container, snapshot): khôi phục scrollTop (sai số 0px),
//     focus lại đúng phần tử và setSelectionRange.
//   - getGroupDetailScrollEl / buildStableFocusSelector: chọn vùng cuộn và dựng
//     selector ổn định.
//   - renderGroupDetail(groupId, { quiet }): Group Detail không gắn entrance
//     animation ở head; quiet vẫn gắn wrapper .group-detail-quiet.
//
// _Validates: Requirements 1.2, 2.1, 2.4, 2.5_
//
// Cách nạp: các hàm trên là hàm NỘI BỘ của desktop-ui.js (không nằm trong export
// của tests/helpers/ui-loader.cjs). jsdom KHÔNG có trong devDependencies, nên thay
// vì thêm dependency nặng, ta dựng một DOM giả lập NHẸ nhưng đủ hành vi thật
// (scrollTop / activeElement / focus / selectionStart-End / contains / querySelector
// theo tag + [attr="..."] + .class) rồi nạp js/desktop-ui.js trong sandbox vm với
// document/window giả lập này, và chèn snippet export 4 hàm nội bộ + renderGroupDetail.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// describe/it/expect dùng ở dạng biến toàn cục của Vitest (globals bật sẵn trong dự án),
// giống các test hiện có; không import 'vitest' để tránh lỗi require ESM.

const ROOT = path.join(__dirname, '..', '..');
const UI_SRC = fs.readFileSync(path.join(ROOT, 'js', 'desktop-ui.js'), 'utf8');
const COMPONENTS_CSS = fs.readFileSync(path.join(ROOT, 'css', 'components.css'), 'utf8');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
function escapeJsAttr(value) {
  return escapeHtml(String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

// ----------------------------------------------------------------------------
// DOM giả lập nhẹ có hành vi thật cho những gì các hàm cần kiểm dùng tới.
// ----------------------------------------------------------------------------

// So khớp một selector đơn giản dạng: [tag][.class...][ [attr="val"]... ]
// Đủ để phủ selector do buildStableFocusSelector sinh (vd: input[id="x"][name="y"])
// và các selector vùng cuộn (.group-tab-body / .group-detail-scroll / .group-detail-body).
function matchSelector(el, selector) {
  const tagMatch = selector.match(/^[a-zA-Z]+/);
  const tag = tagMatch ? tagMatch[0].toLowerCase() : null;
  if (tag && el.tagName.toLowerCase() !== tag) return false;
  let m;
  const classRe = /\.([a-zA-Z0-9_-]+)/g;
  while ((m = classRe.exec(selector))) {
    if (!el.classList.has(m[1])) return false;
  }
  const attrRe = /\[([\w-]+)="([^"]*)"\]/g;
  while ((m = attrRe.exec(selector))) {
    if (el.getAttribute(m[1]) !== m[2]) return false;
  }
  return true;
}

function createFakeDom() {
  const doc = { activeElement: null };

  class FakeEl {
    constructor(tag, attrs = {}) {
      this.tagName = String(tag || 'div').toUpperCase();
      this._attrs = {};
      Object.keys(attrs).forEach(k => { this._attrs[k] = String(attrs[k]); });
      this.classList = new Set();
      this.children = [];
      this.parent = null;
      this.scrollTop = 0;
      this.selectionStart = null;
      this.selectionEnd = null;
      this.innerHTML = '';
      this.textContent = '';
    }
    get className() { return Array.from(this.classList).join(' '); }
    addClass(...cls) { cls.forEach(c => this.classList.add(c)); return this; }
    getAttribute(name) { return name in this._attrs ? this._attrs[name] : null; }
    setAttribute(name, val) { this._attrs[name] = String(val); }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    contains(node) {
      let n = node;
      while (n) { if (n === this) return true; n = n.parent; }
      return false;
    }
    focus() { doc.activeElement = this; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    querySelector(selector) {
      for (const child of this.children) {
        if (matchSelector(child, selector)) return child;
        const found = child.querySelector(selector);
        if (found) return found;
      }
      return null;
    }
    querySelectorAll() { return []; }
    remove() {
      if (this.parent) {
        const idx = this.parent.children.indexOf(this);
        if (idx >= 0) this.parent.children.splice(idx, 1);
      }
    }
  }

  const byId = {};
  doc.body = new FakeEl('body');
  doc.createElement = tag => new FakeEl(tag);
  doc.getElementById = id => {
    if (!byId[id]) byId[id] = new FakeEl('div', { id });
    return byId[id];
  };
  doc.querySelector = sel => doc.body.querySelector(sel);
  doc.querySelectorAll = () => [];
  doc.addEventListener = () => {};
  doc.removeEventListener = () => {};

  return { doc, FakeEl, byId };
}

// ----------------------------------------------------------------------------
// Nạp js/desktop-ui.js trong vm với DOM giả lập và export các hàm nội bộ.
// ----------------------------------------------------------------------------
function loadQuietUi(overrides = {}) {
  const dom = createFakeDom();
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON,
    Promise, Error, RegExp, parseInt, parseFloat, isNaN,
    escapeHtml, escapeJsAttr,
    document: dom.doc,
  };
  sandbox.window = { appState: overrides.appState || {} };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  const snippet = `
    ;globalThis.__quietExports = {
      captureDetailUiState: typeof captureDetailUiState === 'function' ? captureDetailUiState : undefined,
      restoreDetailUiState: typeof restoreDetailUiState === 'function' ? restoreDetailUiState : undefined,
      getGroupDetailScrollEl: typeof getGroupDetailScrollEl === 'function' ? getGroupDetailScrollEl : undefined,
      buildStableFocusSelector: typeof buildStableFocusSelector === 'function' ? buildStableFocusSelector : undefined,
      patchGroupDetailShell: typeof patchGroupDetailShell === 'function' ? patchGroupDetailShell : undefined,
      renderGroupDetail: typeof renderGroupDetail === 'function' ? renderGroupDetail : undefined,
    };
  `;
  vm.runInContext(UI_SRC + snippet, sandbox);
  return { sandbox, dom, exports: sandbox.__quietExports };
}

describe('quiet render bảo toàn trạng thái Group_Detail_View (task 4.2)', () => {
  it('nạp được các hàm nội bộ capture/restore/scroll/selector từ desktop-ui.js', () => {
    const { exports } = loadQuietUi();
    expect(typeof exports.captureDetailUiState).toBe('function');
    expect(typeof exports.restoreDetailUiState).toBe('function');
    expect(typeof exports.getGroupDetailScrollEl).toBe('function');
    expect(typeof exports.buildStableFocusSelector).toBe('function');
    expect(typeof exports.patchGroupDetailShell).toBe('function');
    expect(typeof exports.renderGroupDetail).toBe('function');
  });

  it('chuyển tab chỉ thay panel, giữ nguyên shell và cập nhật trạng thái tab tại chỗ', () => {
    const { exports } = loadQuietUi();
    const tokens = initial => ({
      values: new Set(initial),
      toggle(name, force) { force ? this.values.add(name) : this.values.delete(name); },
      has(name) { return this.values.has(name); },
    });
    const makeTab = id => ({
      dataset: { tab: id },
      classList: tokens(id === 'board' ? ['active'] : []),
      attrs: {},
      tabIndex: id === 'board' ? 0 : -1,
      setAttribute(name, value) { this.attrs[name] = value; },
    });
    const tabs = ['board', 'accounts', 'members'].map(makeTab);
    const title = { textContent: 'Nhóm A' };
    const meta = { textContent: 'Chủ nhóm · 1 thành viên · 0 tài khoản' };
    const settings = {
      classList: tokens([]), attrs: {},
      setAttribute(name, value) { this.attrs[name] = value; },
    };
    const panel = {
      dataset: { activeTab: 'board' },
      innerHTML: '<div>Bảng cũ</div>',
      scrollTop: 240,
      __tingGroupPanelSignature: 'old',
      attrs: {},
      setAttribute(name, value) { this.attrs[name] = value; },
    };
    const root = {
      dataset: { groupId: 'g1', activeTab: 'board' },
      classList: tokens([]),
      parentElement: null,
      querySelector(selector) {
        if (selector === '#group-tab-panel' || selector === '.group-tab-surface') return panel;
        if (selector === '[data-group-detail-title]') return title;
        if (selector === '[data-group-detail-meta]') return meta;
        if (selector === '.group-detail-settings-btn') return settings;
        return null;
      },
      querySelectorAll(selector) { return selector === '.group-tab[data-tab]' ? tabs : []; },
    };

    const didPatch = exports.patchGroupDetailShell(root, {
      activeTab: 'accounts',
      title: 'Nhóm A',
      meta: 'Chủ nhóm · 1 thành viên · 3 tài khoản',
      tabContent: '<div>Tài khoản mới</div>',
      panelSignature: 'new',
    });

    expect(didPatch).toBe(true);
    expect(root.dataset.activeTab).toBe('accounts');
    expect(panel.dataset.activeTab).toBe('accounts');
    expect(panel.innerHTML).toContain('Tài khoản mới');
    expect(panel.scrollTop).toBe(0);
    expect(meta.textContent).toContain('3 tài khoản');
    expect(tabs[0].classList.has('active')).toBe(false);
    expect(tabs[1].classList.has('active')).toBe(true);
    expect(tabs[1].attrs['aria-selected']).toBe('true');
    expect(panel.attrs['aria-labelledby']).toBe('group-tab-accounts');
  });

  // --- Case 1: giữ nguyên scroll offset (sai số 0px) — Req 1.2, 2.1 ---------
  it('giữ nguyên scrollTop qua capture → swap → restore với sai số 0px (fallback container)', () => {
    const { dom, exports } = loadQuietUi();
    const container = new dom.FakeEl('div', { id: 'page-content' });
    container.scrollTop = 512; // vùng cuộn là chính container (không có vùng con)

    const snapshot = exports.captureDetailUiState(container);
    expect(snapshot.scrollTop).toBe(512);

    // Mô phỏng swap innerHTML: trình duyệt thật sẽ reset scrollTop về 0.
    container.scrollTop = 0;
    exports.restoreDetailUiState(container, snapshot);

    expect(container.scrollTop).toBe(512); // khôi phục chính xác, sai số 0px
  });

  it('chọn đúng vùng cuộn .group-tab-body khi tồn tại và bảo toàn scrollTop của nó', () => {
    const { dom, exports } = loadQuietUi();
    const container = new dom.FakeEl('div', { id: 'page-content' });
    const scrollBody = new dom.FakeEl('div').addClass('group-tab-body');
    scrollBody.scrollTop = 333;
    container.appendChild(scrollBody);

    // getGroupDetailScrollEl phải trả về phần tử con .group-tab-body, không phải container.
    expect(exports.getGroupDetailScrollEl(container)).toBe(scrollBody);

    const snapshot = exports.captureDetailUiState(container);
    expect(snapshot.scrollTop).toBe(333);

    scrollBody.scrollTop = 0; // mô phỏng mất scroll sau khi vẽ lại
    exports.restoreDetailUiState(container, snapshot);
    expect(scrollBody.scrollTop).toBe(333);
  });

  // --- Case 2: giữ focus + vị trí con trỏ — Req 1.2, 2.4 --------------------
  it('giữ focus và vị trí con trỏ (selectionStart/End) qua re-render', () => {
    const { dom, exports } = loadQuietUi();
    const container = new dom.FakeEl('div', { id: 'page-content' });
    const input = new dom.FakeEl('input', { id: 'group-invite-email', name: 'inviteEmail' });
    input.selectionStart = 3;
    input.selectionEnd = 7;
    container.appendChild(input);
    dom.doc.activeElement = input; // phần tử đang focus nằm trong container

    const snapshot = exports.captureDetailUiState(container);
    expect(snapshot.focusSelector).toBe('input[id="group-invite-email"][name="inviteEmail"]');
    expect(snapshot.selStart).toBe(3);
    expect(snapshot.selEnd).toBe(7);

    // Mô phỏng swap innerHTML: phần tử cũ bị thay bằng phần tử MỚI cùng selector,
    // và focus rời khỏi container (về body) như khi gán lại innerHTML.
    input.remove();
    dom.doc.activeElement = dom.doc.body;
    const fresh = new dom.FakeEl('input', { id: 'group-invite-email', name: 'inviteEmail' });
    container.appendChild(fresh);

    exports.restoreDetailUiState(container, snapshot);

    expect(dom.doc.activeElement).toBe(fresh);   // focus khôi phục đúng phần tử mới
    expect(fresh.selectionStart).toBe(3);        // con trỏ khôi phục đúng vị trí
    expect(fresh.selectionEnd).toBe(7);
  });

  it('không bảo toàn focus khi phần tử đang focus nằm ngoài container', () => {
    const { dom, exports } = loadQuietUi();
    const container = new dom.FakeEl('div', { id: 'page-content' });
    const outside = new dom.FakeEl('input', { id: 'search-box' }); // không append vào container
    dom.doc.activeElement = outside;

    const snapshot = exports.captureDetailUiState(container);
    expect(snapshot.focusSelector).toBeNull();
    expect(snapshot.selStart).toBeNull();
    expect(snapshot.selEnd).toBeNull();
  });

  it('buildStableFocusSelector trả null khi không đủ thuộc tính ổn định', () => {
    const { dom, exports } = loadQuietUi();
    const plain = new dom.FakeEl('div'); // không có id/name/data-*/placeholder
    expect(exports.buildStableFocusSelector(plain)).toBeNull();

    const withData = new dom.FakeEl('button', { 'data-account-id': 'acc-9' });
    expect(exports.buildStableFocusSelector(withData)).toBe('button[data-account-id="acc-9"]');
  });

  // --- Case 3 + 4: Group Detail không nháy và quiet không xoá trắng ---------
  function setupRenderStubs(sandbox, tab = 'board') {
    sandbox.window.appState.currentGroupTab = tab;
    sandbox.window.appState.user = { email: 'me@example.com' };
    // Stub các phụ thuộc của renderGroupDetail để cô lập phần logic quiet/animated.
    sandbox.getGroupById = () => ({ id: 'g1', name: 'Nhóm A', role: 'owner', memberEmails: ['a@x.com'] });
    sandbox.getGroupSharedAccounts = () => [];
    sandbox.getGroupAccountManagerEmails = () => [];
    sandbox.normalizeGroupEmail = e => String(e || '').toLowerCase();
    sandbox.computeRoleLabel = (isOwner, isManager) => (isOwner ? 'Chủ nhóm' : (isManager ? 'Quản lý TK' : 'Thành viên'));
    sandbox.computeGroupHeaderCounts = () => ({ memberCount: 1, sharedAccountCount: 0 });
    // Stub các hàm render tab con để nội dung body sạch, dễ kiểm marker ở head.
    sandbox.renderGroupTabs = () => '<div class="stub-tabs"></div>';
    sandbox.renderGroupBoard = () => '<div class="stub-board">NỘI DUNG BẢNG</div>';
    sandbox.renderGroupMembers = () => '<div class="stub-members"></div>';
    sandbox.renderGroupAccountsTab = () => '<div class="stub-accounts"></div>';
    sandbox.renderGroupList = () => {};
  }

  it('điều hướng vào Group Detail: head hiện ngay, không gắn anim-fade-in-up', () => {
    const { sandbox, dom, exports } = loadQuietUi();
    setupRenderStubs(sandbox);

    exports.renderGroupDetail('g1');
    const html = dom.doc.getElementById('page-content').innerHTML;

    expect(html).toContain('class="group-detail-head"');
    expect(html).not.toContain('group-detail-head anim-fade-in-up');
    expect(html).toContain('class="group-detail-root"'); // không kèm group-detail-quiet
    expect(html).not.toContain('group-detail-quiet');
  });

  it('CSS của tab nhóm tắt cả entrance animation và transition active', () => {
    const tabRule = COMPONENTS_CSS.match(/\.group-tab\s*\{[\s\S]*?\}/)?.[0] || '';
    const panelRule = COMPONENTS_CSS.match(/\.group-tab-surface \.anim-fade-in-up\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(tabRule).toContain('transition:none');
    expect(panelRule).toContain('animation:none !important');
    expect(panelRule).toContain('opacity:1 !important');
    expect(panelRule).toContain('transform:none !important');
  });

  it('quiet (refresh dữ liệu): wrapper có group-detail-quiet và head KHÔNG gắn anim-fade-in-up', () => {
    const { sandbox, dom, exports } = loadQuietUi();
    setupRenderStubs(sandbox);

    exports.renderGroupDetail('g1', { quiet: true });
    const html = dom.doc.getElementById('page-content').innerHTML;

    expect(html).toContain('group-detail-root group-detail-quiet');
    expect(html).not.toContain('group-detail-head anim-fade-in-up');
    // head ở dạng "trần" không marker animation
    expect(html).toContain('class="group-detail-head"');
  });

  it('quiet render KHÔNG xoá trắng: nội dung đầy đủ được gán trong một lần và giữ nguyên', () => {
    const { sandbox, dom, exports } = loadQuietUi();
    setupRenderStubs(sandbox);
    const pageContent = dom.doc.getElementById('page-content');
    pageContent.scrollTop = 120; // có scroll trước khi refresh

    exports.renderGroupDetail('g1', { quiet: true });

    const html = pageContent.innerHTML;
    expect(html.trim().length).toBeGreaterThan(0);   // không rỗng
    expect(html).toContain('NỘI DUNG BẢNG');          // nội dung tab con đầy đủ
    expect(html).toContain('stub-tabs');              // thanh tab con còn nguyên
    // Sau quiet render, scrollTop được khôi phục (fallback container = page-content).
    expect(pageContent.scrollTop).toBe(120);
  });
});
