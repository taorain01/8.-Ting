// ============================================================================
// Unit test cho các HANDLER TƯƠNG TÁC của tab Nhóm (task 8.6 — spec
// group-tab-redesign).
//
// Kiểm chứng phần đã triển khai ở task 8.2/8.4/8.5 trong js/desktop-app.js,
// dựa trên lớp logic thuần thật trong js/groups.js (validateInviteEmail,
// toggleAccountManager, applyEditRequestDecision, isCategoryReassignNeeded,
// buildCategoryDropdownOptions, getGroupAccountManagerEmails, ...).
//
// Các case bao phủ:
//   - Req 8.2: mời email hợp lệ -> gọi addGroupMember, xoá trống ô nhập, toast thành công.
//   - Req 8.3/8.4/8.5/8.6: email rỗng/sai định dạng/quá dài/vượt giới hạn/trùng
//     -> KHÔNG gọi addGroupMember, GIỮ nguyên ô nhập, toast lý do đúng.
//   - Lỗi ghi (addGroupMember reject) -> giữ ô nhập + toast lỗi.
//   - Req 9.7: non-owner toggle phân quyền -> KHÔNG gọi setGroupAccountManager, toast "chỉ chủ nhóm".
//   - Req 9.6: owner toggle nhưng setGroupAccountManager reject -> toast lỗi + renderGroupDetail (đồng bộ công tắc).
//   - Req 10.8: duyệt/từ chối request đã xử lý -> KHÔNG gọi backend, toast "đã được xử lý".
//   - Req 10.6/10.7: request pending nhưng backend reject -> toast lỗi (giữ pending).
//   - Duyệt/từ chối thành công (pending) -> backend gọi đúng 1 lần, toast tương ứng.
//   - Req 5.6/5.8: Category_Dropdown tạo đúng 1 menu; mở menu thứ 2 đóng menu cũ
//     (tối đa 1); Escape (keydown) và click ngoài (mousedown) -> đóng menu.
//
// _Validates: Requirements 5.6, 5.8, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.6, 9.7,
//             10.6, 10.7, 10.8_
//
// Cách nạp: nạp js/groups.js TRƯỚC rồi js/desktop-app.js SAU vào CÙNG một
// sandbox vm để có sẵn các hàm thuần thật (hai file không trùng khai báo
// const/let top-level nên nối chuỗi an toàn). Sau đó ghi đè các hàm backend
// (addGroupMember, setGroupAccountManager, acceptSharedEditRequest,
// rejectSharedEditRequest, updateSharedAccountGroupMeta) + showToast /
// renderGroupDetail / confirm bằng stub để không gọi Firestore thật và đếm số
// lần gọi. DOM được giả lập nhẹ nhưng đủ hành vi thật (getElementById + .value,
// createElement/appendChild, addEventListener/removeEventListener, classList,
// contains, getBoundingClientRect).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const GROUPS_SRC = fs.readFileSync(path.join(ROOT, 'js', 'groups.js'), 'utf8');
const APP_SRC = fs.readFileSync(path.join(ROOT, 'js', 'desktop-app.js'), 'utf8');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
function escapeJsAttr(value) {
  return escapeHtml(String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

// ----------------------------------------------------------------------------
// DOM giả lập nhẹ có hành vi thật cho những gì các handler dùng tới.
// ----------------------------------------------------------------------------
function createFakeDom() {
  class FakeEl {
    constructor(tag, attrs = {}) {
      this.tagName = String(tag || 'div').toUpperCase();
      this._attrs = {};
      Object.keys(attrs).forEach(k => { this._attrs[k] = String(attrs[k]); });
      this.classList = new Set();
      // Bọc classList thành API giống DOM (add/remove/contains/toggle) dựa trên Set.
      const set = this.classList;
      this.classList = {
        add: (...c) => c.forEach(x => set.add(x)),
        remove: (...c) => c.forEach(x => set.delete(x)),
        contains: c => set.has(c),
        toggle: c => (set.has(c) ? (set.delete(c), false) : (set.add(c), true)),
        _set: set,
      };
      this.children = [];
      this.parent = null;
      this.value = '';
      this.innerHTML = '';
      this.textContent = '';
      this.disabled = false;
      this.style = {};
      this.removed = false;
    }
    getAttribute(name) { return name in this._attrs ? this._attrs[name] : null; }
    setAttribute(name, val) { this._attrs[name] = String(val); }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    contains(node) {
      let n = node;
      while (n) { if (n === this) return true; n = n.parent; }
      return false;
    }
    focus() {}
    addEventListener() {}
    removeEventListener() {}
    querySelector() { return null; }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return { width: 120, height: 100, top: 10, bottom: 40, left: 10, right: 130 }; }
    remove() {
      this.removed = true;
      if (this.parent) {
        const idx = this.parent.children.indexOf(this);
        if (idx >= 0) this.parent.children.splice(idx, 1);
        this.parent = null;
      }
    }
  }

  // Registry cho listener của document/window để test có thể "kích hoạt" handler.
  function makeListenerHost(extra = {}) {
    const listeners = {};
    return Object.assign({
      addEventListener(type, handler) {
        (listeners[type] = listeners[type] || []).push(handler);
      },
      removeEventListener(type, handler) {
        if (!listeners[type]) return;
        listeners[type] = listeners[type].filter(h => h !== handler);
      },
      // Tiện ích test: gọi mọi handler đã đăng ký cho một loại sự kiện.
      _dispatch(type, event) {
        (listeners[type] || []).slice().forEach(h => h(event));
      },
      _count(type) { return (listeners[type] || []).length; },
    }, extra);
  }

  const byId = {};
  const body = new FakeEl('body');
  const doc = makeListenerHost({
    body,
    createElement: tag => new FakeEl(tag),
    getElementById: id => (byId[id] || (byId[id] = new FakeEl('div', { id }))),
    querySelector: () => null,
    querySelectorAll: () => [],
    contains: node => body.contains(node),
  });

  return { doc, body, byId, FakeEl, makeListenerHost };
}

// ----------------------------------------------------------------------------
// Nạp groups.js + desktop-app.js vào cùng sandbox và export các handler cần test.
// ----------------------------------------------------------------------------
function loadInteractions(overrides = {}) {
  const dom = createFakeDom();
  const win = dom.makeListenerHost({
    appState: overrides.appState || {},
    innerWidth: 1280,
    innerHeight: 800,
  });

  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON,
    Promise, Error, RegExp, parseInt, parseFloat, isNaN,
    encodeURIComponent, decodeURIComponent,
    escapeHtml, escapeJsAttr,
    document: dom.doc,
    // auth phải tồn tại (getCurrentGroupUser dùng auth?.currentUser; biến chưa
    // khai báo sẽ gây ReferenceError kể cả với optional chaining).
    auth: { currentUser: null },
  };
  sandbox.window = win;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  // requestAnimationFrame: chạy đồng bộ để 'open' class được gắn ngay.
  sandbox.requestAnimationFrame = fn => { fn(); return 0; };
  vm.createContext(sandbox);

  const snippet = `
    ;globalThis.__appExports = {
      handleAddGroupMember: typeof handleAddGroupMember === 'function' ? handleAddGroupMember : undefined,
      handleToggleGroupAccountManager: typeof handleToggleGroupAccountManager === 'function' ? handleToggleGroupAccountManager : undefined,
      handleAcceptSharedEditRequest: typeof handleAcceptSharedEditRequest === 'function' ? handleAcceptSharedEditRequest : undefined,
      handleRejectSharedEditRequest: typeof handleRejectSharedEditRequest === 'function' ? handleRejectSharedEditRequest : undefined,
      openCategoryDropdown: typeof openCategoryDropdown === 'function' ? openCategoryDropdown : undefined,
      closeCategoryDropdown: typeof closeCategoryDropdown === 'function' ? closeCategoryDropdown : undefined,
      handleSetSharedAccountCategory: typeof handleSetSharedAccountCategory === 'function' ? handleSetSharedAccountCategory : undefined,
      validateInviteEmail: typeof validateInviteEmail === 'function' ? validateInviteEmail : undefined,
    };
  `;
  // Thứ tự: groups.js TRƯỚC (định nghĩa hàm thuần), desktop-app.js SAU (handler).
  vm.runInContext(GROUPS_SRC + '\n;' + APP_SRC + snippet, sandbox);

  // desktop-app.js gán window.appState = {...mặc định...} ở top-level khi nạp,
  // ghi đè state ta truyền vào. Đặt lại appState mong muốn SAU khi nạp để handler
  // đọc đúng dữ liệu test.
  if (overrides.appState) win.appState = overrides.appState;

  // --- Stub các phụ thuộc side-effect sau khi nạp (ghi đè global binding) -----
  const calls = {
    addGroupMember: [], setGroupAccountManager: [],
    acceptSharedEditRequest: [], rejectSharedEditRequest: [],
    updateSharedAccountGroupMeta: [], renderGroupDetail: [], toasts: [],
  };
  const cfg = overrides.backend || {};
  const mk = (name) => (...args) => {
    calls[name].push(args);
    if (cfg[name] === 'reject') return Promise.reject(new Error(`${name} lỗi giả lập`));
    return Promise.resolve(cfg[`${name}Result`]);
  };
  sandbox.addGroupMember = mk('addGroupMember');
  sandbox.setGroupAccountManager = mk('setGroupAccountManager');
  sandbox.acceptSharedEditRequest = mk('acceptSharedEditRequest');
  sandbox.rejectSharedEditRequest = mk('rejectSharedEditRequest');
  sandbox.updateSharedAccountGroupMeta = mk('updateSharedAccountGroupMeta');
  sandbox.showToast = (message, type) => { calls.toasts.push({ message, type }); };
  sandbox.renderGroupDetail = (...args) => { calls.renderGroupDetail.push(args); };
  // confirm mặc định true (người dùng xác nhận); có thể ép false qua override.
  sandbox.confirm = () => (overrides.confirm === undefined ? true : overrides.confirm);

  return { sandbox, dom, win, calls, exports: sandbox.__appExports };
}

// Nhóm mẫu dùng chung.
function makeGroup(extra = {}) {
  return {
    id: 'g1', name: 'Nhóm A', role: 'owner', ownerUid: 'u1',
    memberEmails: ['alice@example.com'],
    pendingMemberEmails: [],
    accountManagerEmails: [],
    accountCategories: [
      { id: 'ai', name: 'AI', order: 0 },
      { id: 'giai-tri', name: 'Giải trí', order: 1 },
    ],
    ...extra,
  };
}

function makeAppState(group, extra = {}) {
  return {
    user: { uid: 'u1', email: 'owner@example.com' },
    groups: [group],
    sharedAccounts: { g1: [{ id: 'acc1', name: 'Netflix', groupCategoryId: 'ai', groupSortOrder: 0 }] },
    sharedEditRequests: {},
    decryptedSharedAccounts: {},
    currentPage: 'group-detail',
    currentGroupId: 'g1',
    currentGroupTab: 'members',
    ...extra,
  };
}

describe('handler tương tác tab Nhóm (task 8.6)', () => {
  it('nạp được các handler cần test từ desktop-app.js + groups.js', () => {
    const { exports } = loadInteractions({ appState: makeAppState(makeGroup()) });
    expect(typeof exports.handleAddGroupMember).toBe('function');
    expect(typeof exports.handleToggleGroupAccountManager).toBe('function');
    expect(typeof exports.handleAcceptSharedEditRequest).toBe('function');
    expect(typeof exports.handleRejectSharedEditRequest).toBe('function');
    expect(typeof exports.openCategoryDropdown).toBe('function');
    expect(typeof exports.closeCategoryDropdown).toBe('function');
    expect(typeof exports.handleSetSharedAccountCategory).toBe('function');
    // Lớp logic thuần thật đã sẵn sàng (không phải fallback).
    expect(typeof exports.validateInviteEmail).toBe('function');
  });

  // ==========================================================================
  // Nhóm 1: Mời thành viên (Req 8.2 – 8.6, lỗi ghi)
  // ==========================================================================
  describe('handleAddGroupMember — mời thành viên', () => {
    it('Req 8.2: email hợp lệ mới -> gọi addGroupMember, xoá trống ô nhập, toast thành công', async () => {
      const ctx = loadInteractions({ appState: makeAppState(makeGroup()) });
      const input = ctx.dom.byId['group-member-email'] = new ctx.dom.FakeEl('input', { id: 'group-member-email' });
      input.value = 'bob@example.com';

      await ctx.exports.handleAddGroupMember('g1');

      expect(ctx.calls.addGroupMember.length).toBe(1);
      expect(ctx.calls.addGroupMember[0]).toEqual(['g1', 'bob@example.com']);
      expect(input.value).toBe(''); // xoá trống khi thành công
      expect(ctx.calls.toasts).toContainEqual({ message: 'Đã gửi lời mời', type: 'success' });
    });

    it('Req 8.3: email rỗng -> KHÔNG gọi backend, giữ ô nhập, toast "Nhập email thành viên"', async () => {
      const ctx = loadInteractions({ appState: makeAppState(makeGroup()) });
      const input = ctx.dom.byId['group-member-email'] = new ctx.dom.FakeEl('input', { id: 'group-member-email' });
      input.value = '   ';

      await ctx.exports.handleAddGroupMember('g1');

      expect(ctx.calls.addGroupMember.length).toBe(0);
      expect(input.value).toBe('   '); // giữ nguyên
      expect(ctx.calls.toasts).toContainEqual({ message: 'Nhập email thành viên', type: 'error' });
    });

    it('Req 8.4: email sai định dạng -> KHÔNG gọi backend, giữ ô nhập, toast "Email không hợp lệ"', async () => {
      const ctx = loadInteractions({ appState: makeAppState(makeGroup()) });
      const input = ctx.dom.byId['group-member-email'] = new ctx.dom.FakeEl('input', { id: 'group-member-email' });
      input.value = 'khong-phai-email';

      await ctx.exports.handleAddGroupMember('g1');

      expect(ctx.calls.addGroupMember.length).toBe(0);
      expect(input.value).toBe('khong-phai-email');
      expect(ctx.calls.toasts).toContainEqual({ message: 'Email không hợp lệ', type: 'error' });
    });

    it('Req 8.3: email quá dài (>254 ký tự) -> KHÔNG gọi backend, giữ ô nhập, toast độ dài', async () => {
      const ctx = loadInteractions({ appState: makeAppState(makeGroup()) });
      const input = ctx.dom.byId['group-member-email'] = new ctx.dom.FakeEl('input', { id: 'group-member-email' });
      const longLocal = 'a'.repeat(250);
      input.value = `${longLocal}@example.com`; // > 254 ký tự

      await ctx.exports.handleAddGroupMember('g1');

      expect(ctx.calls.addGroupMember.length).toBe(0);
      expect(ctx.calls.toasts).toContainEqual({ message: 'Email tối đa 254 ký tự', type: 'error' });
    });

    it('Req 8.5: đã đạt 100 lời mời đang chờ -> KHÔNG gọi backend, toast giới hạn', async () => {
      const pending = Array.from({ length: 100 }, (_, i) => `p${i}@example.com`);
      const ctx = loadInteractions({ appState: makeAppState(makeGroup({ pendingMemberEmails: pending })) });
      const input = ctx.dom.byId['group-member-email'] = new ctx.dom.FakeEl('input', { id: 'group-member-email' });
      input.value = 'moi@example.com';

      await ctx.exports.handleAddGroupMember('g1');

      expect(ctx.calls.addGroupMember.length).toBe(0);
      expect(ctx.calls.toasts).toContainEqual({ message: 'Đã đạt giới hạn 100 lời mời đang chờ', type: 'error' });
    });

    it('Req 8.6: trùng thành viên hiện có -> KHÔNG gọi backend, toast "Email đã có trong nhóm"', async () => {
      const ctx = loadInteractions({ appState: makeAppState(makeGroup({ memberEmails: ['alice@example.com'] })) });
      const input = ctx.dom.byId['group-member-email'] = new ctx.dom.FakeEl('input', { id: 'group-member-email' });
      input.value = 'alice@example.com';

      await ctx.exports.handleAddGroupMember('g1');

      expect(ctx.calls.addGroupMember.length).toBe(0);
      expect(ctx.calls.toasts).toContainEqual({ message: 'Email đã có trong nhóm', type: 'error' });
    });

    it('Req 8.6: trùng lời mời đang chờ -> KHÔNG gọi backend, toast "Email này đã được mời"', async () => {
      const ctx = loadInteractions({ appState: makeAppState(makeGroup({ pendingMemberEmails: ['bob@example.com'] })) });
      const input = ctx.dom.byId['group-member-email'] = new ctx.dom.FakeEl('input', { id: 'group-member-email' });
      input.value = 'bob@example.com';

      await ctx.exports.handleAddGroupMember('g1');

      expect(ctx.calls.addGroupMember.length).toBe(0);
      expect(ctx.calls.toasts).toContainEqual({ message: 'Email này đã được mời', type: 'error' });
    });

    it('lỗi ghi (addGroupMember reject) -> giữ ô nhập + toast lỗi', async () => {
      const ctx = loadInteractions({
        appState: makeAppState(makeGroup()),
        backend: { addGroupMember: 'reject' },
      });
      const input = ctx.dom.byId['group-member-email'] = new ctx.dom.FakeEl('input', { id: 'group-member-email' });
      input.value = 'bob@example.com';

      await ctx.exports.handleAddGroupMember('g1');

      expect(ctx.calls.addGroupMember.length).toBe(1); // đã thử ghi
      expect(input.value).toBe('bob@example.com');       // GIỮ nguyên ô nhập
      expect(ctx.calls.toasts.some(t => t.type === 'error')).toBe(true);
    });
  });

  // ==========================================================================
  // Nhóm 2: Phân quyền quản lý tài khoản (Req 9.6, 9.7)
  // ==========================================================================
  describe('handleToggleGroupAccountManager — phân quyền', () => {
    it('Req 9.7: non-owner -> KHÔNG gọi setGroupAccountManager, toast "chỉ chủ nhóm"', async () => {
      const ctx = loadInteractions({ appState: makeAppState(makeGroup({ role: 'member' })) });

      await ctx.exports.handleToggleGroupAccountManager('g1', 'bob@example.com', true);

      expect(ctx.calls.setGroupAccountManager.length).toBe(0);
      expect(ctx.calls.toasts).toContainEqual({ message: 'Chỉ chủ nhóm mới có quyền phân quyền', type: 'error' });
      // Render lại (quiet) để đưa công tắc về đúng trạng thái.
      expect(ctx.calls.renderGroupDetail.length).toBe(1);
    });

    it('Req 9.6: owner bật nhưng backend reject -> toast lỗi + renderGroupDetail (đồng bộ công tắc)', async () => {
      const ctx = loadInteractions({
        appState: makeAppState(makeGroup({ accountManagerEmails: [] })),
        backend: { setGroupAccountManager: 'reject' },
      });

      await ctx.exports.handleToggleGroupAccountManager('g1', 'bob@example.com', true);

      expect(ctx.calls.setGroupAccountManager.length).toBe(1);
      expect(ctx.calls.toasts.some(t => t.type === 'error')).toBe(true);
      expect(ctx.calls.renderGroupDetail.length).toBe(1);
    });

    it('owner bật thành công -> gọi setGroupAccountManager đúng 1 lần + toast cấp quyền', async () => {
      const ctx = loadInteractions({ appState: makeAppState(makeGroup({ accountManagerEmails: [] })) });

      await ctx.exports.handleToggleGroupAccountManager('g1', 'bob@example.com', true);

      expect(ctx.calls.setGroupAccountManager.length).toBe(1);
      expect(ctx.calls.setGroupAccountManager[0]).toEqual(['g1', 'bob@example.com', true]);
      expect(ctx.calls.toasts).toContainEqual({ message: 'Đã cấp quyền quản lý tài khoản', type: 'success' });
    });
  });

  // ==========================================================================
  // Nhóm 3: Duyệt/Từ chối Edit_Request (Req 10.6, 10.7, 10.8)
  // ==========================================================================
  describe('handleAcceptSharedEditRequest / handleRejectSharedEditRequest', () => {
    function stateWithRequest(status) {
      const group = makeGroup();
      return makeAppState(group, {
        sharedEditRequests: { g1: [{ id: 'r1', accountId: 'acc1', status }] },
      });
    }

    it('Req 10.8: duyệt request đã approved -> KHÔNG gọi backend, toast "Yêu cầu đã được xử lý"', async () => {
      const ctx = loadInteractions({ appState: stateWithRequest('approved') });

      await ctx.exports.handleAcceptSharedEditRequest('g1', 'r1');

      expect(ctx.calls.acceptSharedEditRequest.length).toBe(0);
      expect(ctx.calls.toasts).toContainEqual({ message: 'Yêu cầu đã được xử lý', type: 'info' });
    });

    it('Req 10.8: từ chối request đã rejected -> KHÔNG gọi backend, toast "Yêu cầu đã được xử lý"', async () => {
      const ctx = loadInteractions({ appState: stateWithRequest('rejected') });

      await ctx.exports.handleRejectSharedEditRequest('g1', 'r1');

      expect(ctx.calls.rejectSharedEditRequest.length).toBe(0);
      expect(ctx.calls.toasts).toContainEqual({ message: 'Yêu cầu đã được xử lý', type: 'info' });
    });

    it('duyệt request pending + confirm -> gọi acceptSharedEditRequest đúng 1 lần + toast thành công', async () => {
      const ctx = loadInteractions({ appState: stateWithRequest('pending'), confirm: true });

      await ctx.exports.handleAcceptSharedEditRequest('g1', 'r1');

      expect(ctx.calls.acceptSharedEditRequest.length).toBe(1);
      expect(ctx.calls.acceptSharedEditRequest[0]).toEqual(['g1', 'r1']);
      expect(ctx.calls.toasts).toContainEqual({ message: 'Đã duyệt thay đổi', type: 'success' });
    });

    it('từ chối request pending + confirm -> gọi rejectSharedEditRequest đúng 1 lần + toast thành công', async () => {
      const ctx = loadInteractions({ appState: stateWithRequest('pending'), confirm: true });

      await ctx.exports.handleRejectSharedEditRequest('g1', 'r1');

      expect(ctx.calls.rejectSharedEditRequest.length).toBe(1);
      expect(ctx.calls.rejectSharedEditRequest[0]).toEqual(['g1', 'r1']);
      expect(ctx.calls.toasts).toContainEqual({ message: 'Đã từ chối yêu cầu', type: 'success' });
    });

    it('duyệt pending nhưng huỷ hộp xác nhận -> KHÔNG gọi backend', async () => {
      const ctx = loadInteractions({ appState: stateWithRequest('pending'), confirm: false });

      await ctx.exports.handleAcceptSharedEditRequest('g1', 'r1');

      expect(ctx.calls.acceptSharedEditRequest.length).toBe(0);
    });

    it('Req 10.6: duyệt pending + confirm nhưng backend reject -> toast lỗi (giữ pending)', async () => {
      const ctx = loadInteractions({
        appState: stateWithRequest('pending'), confirm: true,
        backend: { acceptSharedEditRequest: 'reject' },
      });

      await ctx.exports.handleAcceptSharedEditRequest('g1', 'r1');

      expect(ctx.calls.acceptSharedEditRequest.length).toBe(1);
      expect(ctx.calls.toasts.some(t => t.type === 'error')).toBe(true);
      // Request vẫn giữ trạng thái pending trong state cục bộ (không đổi).
      expect(ctx.win.appState.sharedEditRequests.g1[0].status).toBe('pending');
    });

    it('Req 10.7: từ chối pending + confirm nhưng backend reject -> toast lỗi (giữ pending)', async () => {
      const ctx = loadInteractions({
        appState: stateWithRequest('pending'), confirm: true,
        backend: { rejectSharedEditRequest: 'reject' },
      });

      await ctx.exports.handleRejectSharedEditRequest('g1', 'r1');

      expect(ctx.calls.rejectSharedEditRequest.length).toBe(1);
      expect(ctx.calls.toasts.some(t => t.type === 'error')).toBe(true);
      expect(ctx.win.appState.sharedEditRequests.g1[0].status).toBe('pending');
    });
  });

  // ==========================================================================
  // Nhóm 4: Category_Dropdown (Req 5.6, 5.8)
  // ==========================================================================
  describe('openCategoryDropdown / closeCategoryDropdown — Req 5.6, 5.8', () => {
    // Đếm số menu .cat-menu đang gắn vào body (chưa bị remove). openCategoryDropdown
    // gán menu.className = 'cat-menu' (chuỗi trực tiếp) nên kiểm qua className.
    function countMenus(body) {
      return body.children.filter(el => String(el.className || '').includes('cat-menu')).length;
    }
    // Bật timer đồng bộ để listener (đăng ký trong setTimeout 0) và remove menu
    // (setTimeout 120) chạy ngay, giúp assert không phải chờ.
    function withSyncTimers(ctx) {
      ctx.sandbox.setTimeout = (fn) => { fn(); return 0; };
    }

    it('Req 5.8: mở dropdown tạo đúng 1 menu; mở menu thứ 2 (trigger khác) đóng menu cũ', () => {
      const ctx = loadInteractions({ appState: makeAppState(makeGroup()) });
      withSyncTimers(ctx);
      const trigger1 = new ctx.dom.FakeEl('button', { 'data-account-id': 'acc1' });
      const trigger2 = new ctx.dom.FakeEl('button', { 'data-account-id': 'acc2' });

      ctx.exports.openCategoryDropdown(trigger1, 'g1', 'acc1');
      expect(countMenus(ctx.dom.body)).toBe(1);

      ctx.exports.openCategoryDropdown(trigger2, 'g1', 'acc1');
      // Tối đa 1 menu tại một thời điểm: menu cũ đã bị gỡ khỏi body.
      expect(countMenus(ctx.dom.body)).toBe(1);
    });

    it('Req 5.6: nhấn Escape -> đóng menu (gỡ khỏi body)', () => {
      const ctx = loadInteractions({ appState: makeAppState(makeGroup()) });
      withSyncTimers(ctx);
      const trigger = new ctx.dom.FakeEl('button', { 'data-account-id': 'acc1' });

      ctx.exports.openCategoryDropdown(trigger, 'g1', 'acc1');
      expect(countMenus(ctx.dom.body)).toBe(1);

      // Kích hoạt handler keydown đã đăng ký trên document với phím Escape.
      ctx.dom.doc._dispatch('keydown', { key: 'Escape' });
      expect(countMenus(ctx.dom.body)).toBe(0);
    });

    it('Req 5.6: click ra ngoài (mousedown) -> đóng menu (gỡ khỏi body)', () => {
      const ctx = loadInteractions({ appState: makeAppState(makeGroup()) });
      withSyncTimers(ctx);
      const trigger = new ctx.dom.FakeEl('button', { 'data-account-id': 'acc1' });
      const outside = new ctx.dom.FakeEl('div'); // phần tử nằm ngoài menu/trigger

      ctx.exports.openCategoryDropdown(trigger, 'g1', 'acc1');
      expect(countMenus(ctx.dom.body)).toBe(1);

      ctx.dom.doc._dispatch('mousedown', { target: outside });
      expect(countMenus(ctx.dom.body)).toBe(0);
    });

    it('Req 5.8: mở lại cùng trigger đang mở -> đóng menu (toggle)', () => {
      const ctx = loadInteractions({ appState: makeAppState(makeGroup()) });
      withSyncTimers(ctx);
      const trigger = new ctx.dom.FakeEl('button', { 'data-account-id': 'acc1' });

      ctx.exports.openCategoryDropdown(trigger, 'g1', 'acc1');
      expect(countMenus(ctx.dom.body)).toBe(1);

      ctx.exports.openCategoryDropdown(trigger, 'g1', 'acc1');
      expect(countMenus(ctx.dom.body)).toBe(0);
    });
  });
});
