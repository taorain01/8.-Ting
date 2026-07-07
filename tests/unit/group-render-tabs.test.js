// ============================================================================
// Unit test cho lớp render 3 tab con và trạng thái thẻ tài khoản của
// Group_Detail_View (task 6.5 — spec group-tab-redesign).
//
// Kiểm chứng phần render đã triển khai ở task 6.1/6.2/6.3 trong js/desktop-ui.js:
//   - renderGroupTabs: ĐÚNG 3 tab con (board/accounts/members), không còn tab
//     "Cài đặt" (Req 3.1).
//   - renderGroupDetail: header có nút bánh răng cài đặt (group-detail-settings-btn)
//     mở openGroupSettings, hiển thị nhãn vai trò + số thành viên + số tài khoản
//     (Req 3.1, 11.1, 11.2).
//   - renderGroupBoard/renderGroupBoardAccount: owner thấy nút thêm/sửa/xoá/di
//     chuyển danh mục; non-owner ẩn (Req 6.1, 6.2). Nút đưa account lên/xuống bị
//     vô hiệu hoá đúng ở biên (Req 7.1). Category_Dropdown hiện khi có quyền, ẩn
//     khi không (Req 5.1, 5.2).
//   - renderSharedAccountCard: chưa mở khoá -> ẩn dữ liệu + nút mở khoá (Req 4.1);
//     đang giải mã -> "Đang giải mã" (Req 4.4); lỗi giải mã theo TỪNG tài khoản
//     (Req 4.6); badge số Edit_Request hiện khi >= 1, ẩn khi 0 (Req 10.9, 10.10).
//   - renderGroupMembers: nhãn vai trò đúng (Chủ nhóm/Quản lý TK/Thành viên) và
//     công tắc phân quyền chỉ hiện với owner cho thành viên không phải chủ
//     (Req 9.1, 9.5, và 9.4 gián tiếp qua nhãn).
//   - renderSharedEditRequestCard/renderGroupAccountsTab: nút duyệt/từ chối khi
//     có quyền, "Chờ duyệt" khi không (Req 10.2, 10.3).
//   - Trạng thái rỗng mỗi tab có tiêu đề mô tả (Req 11.4).
//
// _Validates: Requirements 3.1, 4.1, 4.4, 4.6, 5.1, 5.2, 6.1, 6.2, 7.1, 9.1,
//   9.5, 10.2, 10.3, 10.9, 10.10, 11.4_
//
// CÁCH NẠP (bám mẫu tests/unit/group-quiet-render-state.test.js):
//   Dựng DOM giả lập NHẸ (không cài jsdom) rồi nạp js/groups.js VÀ js/desktop-ui.js
//   vào CÙNG một sandbox vm. Nạp groups.js TRƯỚC để có sẵn các hàm thuần THẬT
//   (buildGroupBoardSections, computeAccountMoveButtons, computeRoleLabel,
//   computeGroupHeaderCounts, buildCategoryDropdownOptions, computeEditRequestBadge,
//   getGroupAccountCategories, getGroupAccountManagerEmails, getSharedEditRequestsForAccount,
//   normalizeGroupEmail...). Hai file KHÔNG có khai báo const/let top-level trùng
//   tên nên nối chuỗi an toàn. Các phụ thuộc runtime nằm ở desktop-app.js/utils.js
//   (canManageSharedAccountForUi, getGroupAccountTargetId, getStatusText,
//   getResolvedPlatform, decryptSharedAccountForDisplay...) được STUB trên sandbox.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// describe/it/expect dùng ở dạng biến toàn cục của Vitest (globals: true).

const ROOT = path.join(__dirname, '..', '..');
// Nạp thêm js/utils.js để có các hàm thuần group-tab-edit-mode
// (resolveGroupEditMode, shouldShowEditToggleButton, isCategoryEditControlVisible,
// isAccountEditControlVisible, nextGroupEditState, resetGroupEditState) mà lớp render
// trong desktop-ui.js tham chiếu tới. Không nạp utils.js sẽ khiến render báo
// "resolveGroupEditMode is not defined".
const UTILS_SRC = fs.readFileSync(path.join(ROOT, 'js', 'utils.js'), 'utf8');
const GROUPS_SRC = fs.readFileSync(path.join(ROOT, 'js', 'groups.js'), 'utf8');
const UI_SRC = fs.readFileSync(path.join(ROOT, 'js', 'desktop-ui.js'), 'utf8');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
function escapeJsAttr(value) {
  return escapeHtml(String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

// ----------------------------------------------------------------------------
// DOM giả lập nhẹ: chỉ cần getElementById trả phần tử có textContent/innerHTML
// cho renderGroupDetail (các hàm render tab con khác chỉ trả chuỗi, không đụng DOM).
// ----------------------------------------------------------------------------
function createFakeDom() {
  const byId = {};
  const doc = {
    activeElement: null,
    getElementById(id) {
      if (!byId[id]) {
        byId[id] = {
          _id: id, textContent: '', innerHTML: '', scrollTop: 0,
          querySelector() { return null; }, contains() { return false; },
        };
      }
      return byId[id];
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return {}; },
    addEventListener() {}, removeEventListener() {},
    body: {},
  };
  return { doc, byId };
}

// ----------------------------------------------------------------------------
// Nạp groups.js + desktop-ui.js trong vm và STUB các phụ thuộc runtime.
// options: { appState, group, accounts, canManage }
//   - group: đối tượng nhóm dùng cho getGroupById.
//   - accounts: danh sách Shared_Account dùng cho getGroupSharedAccounts.
//   - canManage(group, account) -> bool: quyền quản lý (mặc định: owner).
// ----------------------------------------------------------------------------
function loadUi(options = {}) {
  const appState = options.appState || {};
  const dom = createFakeDom();
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON,
    Promise, Error, RegExp, parseInt, parseFloat, isNaN, encodeURIComponent,
    escapeHtml, escapeJsAttr,
    document: dom.doc,
    // Phụ thuộc runtime của groups.js không dùng trong render -> stub undefined.
    auth: undefined, db: undefined, firebase: undefined,
  };
  sandbox.window = { appState };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  const snippet = `
    ;globalThis.__uiExports = {
      renderGroupTabs: typeof renderGroupTabs === 'function' ? renderGroupTabs : undefined,
      renderGroupBoard: typeof renderGroupBoard === 'function' ? renderGroupBoard : undefined,
      renderGroupBoardAccount: typeof renderGroupBoardAccount === 'function' ? renderGroupBoardAccount : undefined,
      renderGroupMembers: typeof renderGroupMembers === 'function' ? renderGroupMembers : undefined,
      renderGroupAccountsTab: typeof renderGroupAccountsTab === 'function' ? renderGroupAccountsTab : undefined,
      renderSharedAccountCard: typeof renderSharedAccountCard === 'function' ? renderSharedAccountCard : undefined,
      renderGroupAccountCategorySelect: typeof renderGroupAccountCategorySelect === 'function' ? renderGroupAccountCategorySelect : undefined,
      renderSharedEditRequestCard: typeof renderSharedEditRequestCard === 'function' ? renderSharedEditRequestCard : undefined,
      renderGroupDetail: typeof renderGroupDetail === 'function' ? renderGroupDetail : undefined,
    };
  `;
  // Nạp utils.js TRƯỚC (hàm thuần group-tab-edit-mode + escape helpers thật),
  // rồi groups.js (hàm thuần thật), sau cùng desktop-ui.js (lớp render).
  vm.runInContext(UTILS_SRC + '\n;' + GROUPS_SRC + '\n;' + UI_SRC + snippet, sandbox, { filename: 'group-render-tabs.sandbox.js' });

  // --- STUB các phụ thuộc runtime (gán sau khi chạy để override global) -----
  const group = options.group || null;
  const accounts = options.accounts || [];
  const canManage = options.canManage;

  sandbox.getGroupById = id => (group && group.id === id ? group : null);
  sandbox.getGroupSharedAccounts = () => accounts;
  // Trạng thái mở khoá xác định trực tiếp qua appState.groupUnlocked để test kiểm soát.
  sandbox.isGroupUnlocked = gid => Boolean(appState.groupUnlocked && appState.groupUnlocked[gid]);
  sandbox.getGroupLockLabel = gid => (sandbox.isGroupUnlocked(gid) ? 'Mở' : 'Đã khoá');
  // Quyền quản lý tài khoản: mặc định owner; test có thể truyền canManage riêng.
  sandbox.canManageSharedAccountForUi = (g, acc) => (typeof canManage === 'function'
    ? canManage(g, acc)
    : (g?.role === 'owner' || (acc?.sharedByUid && acc.sharedByUid === appState.user?.uid)));
  sandbox.getGroupAccountTargetId = (gid, aid) => `group-account-${gid}-${aid}`;
  // Giải mã: stub trả Promise đã resolve (chỉ bị gọi ở trạng thái "đang giải mã").
  sandbox.decryptSharedAccountForDisplay = () => Promise.resolve();
  sandbox.getGroupRoleLabel = () => 'Thành viên';
  // Phụ thuộc hiển thị nền tảng/ngày/trạng thái (utils.js) -> stub gọn.
  sandbox.getResolvedPlatform = () => 'other';
  sandbox.getPlatformEmoji = () => '🔒';
  sandbox.stringToColor = () => '#888888';
  sandbox.formatDateVN = d => String(d || '');
  sandbox.getStatusText = s => String(s || '');
  sandbox.getStatusBadgeClass = () => 'badge-active';

  return { sandbox, dom, exports: sandbox.__uiExports };
}

// ----------------------------------------------------------------------------
// Dữ liệu giả lập tiện dụng.
// ----------------------------------------------------------------------------
function makeGroup(overrides = {}) {
  return {
    id: 'g1',
    name: 'Nhóm A',
    role: 'owner',
    ownerEmail: 'owner@x.com',
    ownerUid: 'u-owner',
    memberEmails: ['owner@x.com', 'bob@x.com'],
    pendingMemberEmails: [],
    accountManagerEmails: [],
    accountCategories: [],
    ...overrides,
  };
}
function makeAccount(overrides = {}) {
  return {
    id: 'a1',
    name: 'Netflix',
    displayUsername: 'user@mail.com',
    groupCategoryId: null,
    groupSortOrder: 0,
    status: 'active',
    ...overrides,
  };
}
function baseAppState(overrides = {}) {
  return {
    currentGroupTab: 'board',
    user: { uid: 'u-owner', email: 'owner@x.com' },
    groupUnlocked: {},
    decryptedSharedAccounts: {},
    decryptingSharedAccounts: {},
    decryptFailedSharedAccounts: {},
    sharedEditRequests: {},
    ...overrides,
  };
}

describe('render 3 tab con và trạng thái thẻ tài khoản Group_Detail_View (task 6.5)', () => {
  it('nạp được các hàm render nhóm từ groups.js + desktop-ui.js', () => {
    const { exports } = loadUi({ appState: baseAppState(), group: makeGroup(), accounts: [] });
    expect(typeof exports.renderGroupTabs).toBe('function');
    expect(typeof exports.renderGroupBoard).toBe('function');
    expect(typeof exports.renderGroupMembers).toBe('function');
    expect(typeof exports.renderGroupAccountsTab).toBe('function');
    expect(typeof exports.renderSharedAccountCard).toBe('function');
    expect(typeof exports.renderGroupDetail).toBe('function');
    expect(typeof exports.renderSharedEditRequestCard).toBe('function');
  });

  // --- Case 1: ĐÚNG 3 tab con, không còn tab "Cài đặt" — Req 3.1 -----------
  it('renderGroupTabs render đúng 3 tab (board/accounts/members), không có tab Cài đặt', () => {
    const { exports } = loadUi({ appState: baseAppState(), group: makeGroup(), accounts: [] });
    const html = exports.renderGroupTabs(makeGroup());

    // Đúng 3 nút tab.
    const tabCount = (html.match(/class="group-tab /g) || []).length;
    expect(tabCount).toBe(3);
    // Đủ 3 nhãn tab con.
    expect(html).toContain('Bảng danh mục');
    expect(html).toContain('Tài khoản');
    expect(html).toContain('Thành viên');
    // Đúng 3 target điều hướng tab.
    expect(html).toContain("setGroupDetailTab('board')");
    expect(html).toContain("setGroupDetailTab('accounts')");
    expect(html).toContain("setGroupDetailTab('members')");
    // KHÔNG còn tab "Cài đặt" trong thanh tab con.
    expect(html).not.toContain("setGroupDetailTab('settings')");
    expect(html).not.toContain('Cài đặt');
  });

  // --- Case 2: header có nút bánh răng + nhãn vai trò + số đếm — Req 3.1, 11.1, 11.2
  it('renderGroupDetail dựng header với nút bánh răng cài đặt, nhãn vai trò và số đếm', () => {
    const appState = baseAppState({ currentGroupTab: 'board' });
    const group = makeGroup({ memberEmails: ['owner@x.com', 'bob@x.com'] });
    const accounts = [makeAccount({ id: 'a1' }), makeAccount({ id: 'a2' })];
    const { exports, dom } = loadUi({ appState, group, accounts });

    exports.renderGroupDetail('g1'); // animated (điều hướng), không quiet
    const html = dom.doc.getElementById('page-content').innerHTML;

    // Nút bánh răng mở cài đặt nhóm ở header (không còn là tab con).
    expect(html).toContain('group-detail-settings-btn');
    expect(html).toContain("openGroupSettings('g1')");
    // Nhãn vai trò (owner -> "Chủ nhóm") + số thành viên (2) + số tài khoản (2).
    expect(html).toContain('Chủ nhóm · 2 thành viên · 2 tài khoản');
    // Tiêu đề trang được đặt theo tên nhóm.
    expect(dom.doc.getElementById('page-title').textContent).toBe('Nhóm A');
  });

  it('renderGroupDetail dùng 0 làm mặc định khi thiếu memberEmails (Req 11.2)', () => {
    const appState = baseAppState();
    // Nhóm thiếu memberEmails -> computeGroupHeaderCounts trả memberCount = 0.
    const group = makeGroup({ memberEmails: undefined });
    const { exports, dom } = loadUi({ appState, group, accounts: [] });

    exports.renderGroupDetail('g1');
    const html = dom.doc.getElementById('page-content').innerHTML;
    expect(html).toContain('0 thành viên · 0 tài khoản');
  });

  // --- Case 3: Board owner vs non-owner + nút di chuyển + dropdown — Req 6.1/6.2, 7.1, 5.1/5.2
  it('renderGroupBoard: owner ở Edit_Mode thấy nút thêm/sửa/xoá/di chuyển danh mục', () => {
    // Edit_Control chỉ hiện trong Edit_Mode (feature group-tab-edit-mode).
    const appState = baseAppState({ groupEditMode: { groupId: 'g1', active: true } });
    const group = makeGroup({
      role: 'owner',
      accountCategories: [{ id: 'c1', name: 'Ngân hàng', order: 0, color: '#f00' }],
    });
    const accounts = [makeAccount({ id: 'a1', groupCategoryId: 'c1' })];
    const { exports } = loadUi({ appState, group, accounts });

    const html = exports.renderGroupBoard(group);
    expect(html).toContain('Thêm danh mục');           // nút thêm danh mục
    expect(html).toContain('openGroupCategoryModal');   // nút sửa danh mục
    expect(html).toContain('handleDeleteGroupCategory'); // nút xoá danh mục
    expect(html).toContain('handleMoveGroupCategory');   // nút di chuyển danh mục
  });

  it('renderGroupBoard: non-owner ẩn nút thêm/sửa/xoá/di chuyển danh mục', () => {
    const appState = baseAppState({ user: { uid: 'u-bob', email: 'bob@x.com' } });
    const group = makeGroup({
      role: 'member',
      accountCategories: [{ id: 'c1', name: 'Ngân hàng', order: 0 }],
    });
    const accounts = [makeAccount({ id: 'a1', groupCategoryId: 'c1' })];
    // Non-owner và không phải người chia sẻ -> không có quyền quản lý.
    const { exports } = loadUi({ appState, group, accounts, canManage: () => false });

    const html = exports.renderGroupBoard(group);
    expect(html).not.toContain('Thêm danh mục');
    expect(html).not.toContain('openGroupCategoryModal');
    expect(html).not.toContain('handleDeleteGroupCategory');
    expect(html).not.toContain('handleMoveGroupCategory');
  });

  it('renderGroupBoardAccount: vô hiệu hoá nút đưa lên/xuống đúng ở biên (Req 7.1)', () => {
    const appState = baseAppState();
    const group = makeGroup({ role: 'owner' });
    const acc = makeAccount({ id: 'a1' });
    const { exports } = loadUi({ appState, group, accounts: [acc] });

    // Mũi tên di chuyển thuộc Edit_Control -> chỉ hiện ở Edit_Mode (tham số editMode=true).
    // Vị trí đầu trong danh mục 3 phần tử: nút "Đưa lên" bị disabled, "Đưa xuống" bật.
    const first = exports.renderGroupBoardAccount(group, acc, 'c1', 0, 3, true);
    expect(first).toMatch(/title="Đưa lên"[^>]*disabled/);
    expect(first).not.toMatch(/title="Đưa xuống"[^>]*disabled/);

    // Vị trí cuối: "Đưa xuống" disabled, "Đưa lên" bật.
    const last = exports.renderGroupBoardAccount(group, acc, 'c1', 2, 3, true);
    expect(last).toMatch(/title="Đưa xuống"[^>]*disabled/);
    expect(last).not.toMatch(/title="Đưa lên"[^>]*disabled/);

    // Danh mục chỉ 1 tài khoản: cả hai nút disabled (Req 7.4 gián tiếp).
    const only = exports.renderGroupBoardAccount(group, acc, 'c1', 0, 1, true);
    expect(only).toMatch(/title="Đưa lên"[^>]*disabled/);
    expect(only).toMatch(/title="Đưa xuống"[^>]*disabled/);
  });

  it('Category_Dropdown hiện khi có quyền, ẩn khi không (Req 5.1, 5.2)', () => {
    const group = makeGroup({ accountCategories: [{ id: 'c1', name: 'Ngân hàng', order: 0 }] });
    const acc = makeAccount({ id: 'a1', groupCategoryId: 'c1' });

    // Có quyền -> hiện cat-select.
    const withPerm = loadUi({ appState: baseAppState(), group, accounts: [acc], canManage: () => true });
    const shown = withPerm.exports.renderGroupAccountCategorySelect(group, acc);
    expect(shown).toContain('cat-select');
    expect(shown).toContain('openCategoryDropdown');

    // Không quyền -> chuỗi rỗng (ẩn hoàn toàn).
    const noPerm = loadUi({ appState: baseAppState(), group, accounts: [acc], canManage: () => false });
    const hidden = noPerm.exports.renderGroupAccountCategorySelect(group, acc);
    expect(hidden).toBe('');
  });

  // --- Case 4: trạng thái thẻ tài khoản locked/đang giải mã/lỗi + badge -----
  it('renderSharedAccountCard: chưa mở khoá -> ẩn dữ liệu + nút mở khoá (Req 4.1)', () => {
    const appState = baseAppState({ groupUnlocked: {} }); // chưa mở khoá
    const group = makeGroup();
    const acc = makeAccount({ id: 'a1' });
    const { exports } = loadUi({ appState, group, accounts: [acc] });

    const html = exports.renderSharedAccountCard(group, acc);
    expect(html).toContain('Nội dung nhạy cảm đang ẩn');
    expect(html).toContain("openUnlockGroupModal('g1')");
    // Không lộ dữ liệu bí mật.
    expect(html).not.toContain('secret-value');
  });

  it('renderSharedAccountCard: đã mở khoá + đang giải mã -> chỉ báo "Đang giải mã" (Req 4.4)', () => {
    const appState = baseAppState({ groupUnlocked: { g1: 'pw' } });
    const group = makeGroup();
    const acc = makeAccount({ id: 'a1' });
    const { exports } = loadUi({ appState, group, accounts: [acc] });

    const html = exports.renderSharedAccountCard(group, acc);
    expect(html).toContain('Đang giải mã');
    expect(html).not.toContain('secret-value');
  });

  it('renderSharedAccountCard: lỗi giải mã -> ẩn dữ liệu + chỉ báo lỗi riêng account (Req 4.6)', () => {
    const appState = baseAppState({
      groupUnlocked: { g1: 'pw' },
      decryptFailedSharedAccounts: { 'g1:a1': true },
    });
    const group = makeGroup();
    const acc = makeAccount({ id: 'a1' });
    const { exports } = loadUi({ appState, group, accounts: [acc] });

    const html = exports.renderSharedAccountCard(group, acc);
    expect(html).toContain('Không giải mã được tài khoản này');
    expect(html).toContain('shared-decrypt-error');
    expect(html).not.toContain('Đang giải mã');
    expect(html).not.toContain('secret-value');
  });

  it('renderSharedAccountCard: lỗi 1 tài khoản KHÔNG ảnh hưởng tài khoản khác (Req 4.6)', () => {
    const appState = baseAppState({
      groupUnlocked: { g1: 'pw' },
      decryptFailedSharedAccounts: { 'g1:a1': true },              // a1 lỗi
      decryptedSharedAccounts: { 'g1:a2': { username: 'u2', password: 'p2' } }, // a2 ok
    });
    const group = makeGroup();
    const a1 = makeAccount({ id: 'a1' });
    const a2 = makeAccount({ id: 'a2' });
    const { exports } = loadUi({ appState, group, accounts: [a1, a2] });

    const htmlA1 = exports.renderSharedAccountCard(group, a1);
    const htmlA2 = exports.renderSharedAccountCard(group, a2);
    // a1 lỗi.
    expect(htmlA1).toContain('Không giải mã được tài khoản này');
    // a2 vẫn hiển thị dữ liệu đã giải mã bình thường.
    expect(htmlA2).toContain('secret-value');
    expect(htmlA2).toContain('u2');
    expect(htmlA2).not.toContain('Không giải mã được tài khoản này');
  });

  it('renderSharedAccountCard: badge Edit_Request hiện khi >=1, ẩn khi 0 (Req 10.9, 10.10)', () => {
    const group = makeGroup();
    const acc = makeAccount({ id: 'a1' });

    // Có 2 yêu cầu pending cho a1 -> badge "2 chờ duyệt".
    const withReqs = loadUi({
      appState: baseAppState({
        sharedEditRequests: {
          g1: [
            { id: 'r1', accountId: 'a1', status: 'pending' },
            { id: 'r2', accountId: 'a1', status: 'pending' },
            { id: 'r3', accountId: 'a1', status: 'approved' }, // đã xử lý -> không đếm
          ],
        },
      }),
      group, accounts: [acc],
    });
    const shown = withReqs.exports.renderSharedAccountCard(group, acc);
    expect(shown).toContain('2 chờ duyệt');

    // Không có yêu cầu pending -> ẩn badge.
    const noReqs = loadUi({ appState: baseAppState(), group, accounts: [acc] });
    const hidden = noReqs.exports.renderSharedAccountCard(group, acc);
    expect(hidden).not.toContain('chờ duyệt');
  });

  // --- Case 5: Members nhãn vai trò + công tắc phân quyền — Req 9.1, 9.5, 9.4
  it('renderGroupMembers (owner): nhãn vai trò đúng + công tắc/xoá cho thành viên không phải chủ', () => {
    const appState = baseAppState();
    const group = makeGroup({
      role: 'owner',
      ownerEmail: 'owner@x.com',
      memberEmails: ['owner@x.com', 'bob@x.com', 'carol@x.com'],
      accountManagerEmails: ['bob@x.com'],
    });
    const { exports } = loadUi({ appState, group, accounts: [] });

    const html = exports.renderGroupMembers(group);
    // Nhãn vai trò: owner -> Chủ nhóm, bob (manager) -> Quản lý TK, carol -> Thành viên.
    expect(html).toContain('Chủ nhóm');
    expect(html).toContain('Quản lý TK');
    expect(html).toContain('Thành viên');
    // Owner thấy công tắc phân quyền + nút xoá thành viên (cho thành viên không phải chủ).
    expect(html).toContain('group-manager-toggle');
    expect(html).toContain("handleToggleGroupAccountManager('g1','bob@x.com'");
    expect(html).toContain("handleRemoveGroupMember('g1','carol@x.com'");
  });

  it('renderGroupMembers (non-owner): ẩn công tắc phân quyền và nút xoá thành viên (Req 9.5)', () => {
    const appState = baseAppState({ user: { uid: 'u-bob', email: 'bob@x.com' } });
    const group = makeGroup({
      role: 'member',
      ownerEmail: 'owner@x.com',
      memberEmails: ['owner@x.com', 'bob@x.com'],
    });
    const { exports } = loadUi({ appState, group, accounts: [] });

    const html = exports.renderGroupMembers(group);
    expect(html).not.toContain('group-manager-toggle');
    expect(html).not.toContain('handleToggleGroupAccountManager');
    expect(html).not.toContain('handleRemoveGroupMember');
    // Vẫn hiển thị nhãn vai trò cho từng thành viên.
    expect(html).toContain('Chủ nhóm');
    expect(html).toContain('Thành viên');
  });

  // --- Case 6: Edit_Request nút duyệt/từ chối vs "Chờ duyệt" — Req 10.2, 10.3
  it('renderSharedEditRequestCard: người có quyền duyệt thấy nút Duyệt/Từ chối (Req 10.2)', () => {
    const appState = baseAppState({ user: { uid: 'u-owner', email: 'owner@x.com' } });
    const group = makeGroup();
    const { exports } = loadUi({ appState, group, accounts: [] });

    const request = {
      id: 'r1', accountId: 'a1', status: 'pending',
      reviewerUid: 'u-owner', reviewerEmail: 'owner@x.com',
      requestedByEmail: 'req@x.com', proposedSafeData: { name: 'Netflix' },
    };
    const html = exports.renderSharedEditRequestCard(group, request);
    expect(html).toContain("handleAcceptSharedEditRequest('g1','r1')");
    expect(html).toContain("handleRejectSharedEditRequest('g1','r1')");
    expect(html).toContain('Duyệt');
    expect(html).toContain('Từ chối');
    expect(html).not.toContain('>Chờ duyệt<');
  });

  it('renderSharedEditRequestCard: người không có quyền duyệt chỉ thấy "Chờ duyệt" (Req 10.3)', () => {
    const appState = baseAppState({ user: { uid: 'u-carol', email: 'carol@x.com' } });
    const group = makeGroup({ role: 'member' });
    const { exports } = loadUi({ appState, group, accounts: [] });

    const request = {
      id: 'r1', accountId: 'a1', status: 'pending',
      reviewerUid: 'u-owner', reviewerEmail: 'owner@x.com',
      requestedByEmail: 'req@x.com', proposedSafeData: { name: 'Netflix' },
    };
    const html = exports.renderSharedEditRequestCard(group, request);
    expect(html).toContain('Chờ duyệt');
    expect(html).not.toContain('handleAcceptSharedEditRequest');
    expect(html).not.toContain('handleRejectSharedEditRequest');
  });

  // --- Case 7: trạng thái rỗng mỗi tab có tiêu đề mô tả — Req 11.4 ----------
  it('trạng thái rỗng Board: hiện tiêu đề mô tả khi không có danh mục lẫn tài khoản', () => {
    const appState = baseAppState();
    const group = makeGroup({ role: 'owner', accountCategories: [] });
    const { exports } = loadUi({ appState, group, accounts: [] });

    const html = exports.renderGroupBoard(group);
    expect(html).toContain('Chưa có danh mục hay tài khoản chia sẻ');
  });

  it('trạng thái rỗng Accounts: hiện tiêu đề mô tả khi chưa có tài khoản chia sẻ', () => {
    const appState = baseAppState();
    const group = makeGroup();
    const { exports } = loadUi({ appState, group, accounts: [] });

    const html = exports.renderGroupAccountsTab(group);
    expect(html).toContain('Chưa có tài khoản chia sẻ');
  });

  it('trạng thái rỗng Members: hiện tiêu đề mô tả khi chưa có thành viên', () => {
    const appState = baseAppState();
    // Nhóm không có thành viên và không có lời mời đang chờ.
    const group = makeGroup({ role: 'member', memberEmails: [], pendingMemberEmails: [] });
    const { exports } = loadUi({ appState, group, accounts: [] });

    const html = exports.renderGroupMembers(group);
    expect(html).toContain('Chưa có thành viên');
  });
});
