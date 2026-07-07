// ============================================================================
// Property-based test cho shouldRenderGroupDetail (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 1: Điều kiện render Group_Detail_View
//   Với mọi trạng thái ứng dụng `state` và sự kiện `event`,
//   shouldRenderGroupDetail(state, event) trả về true KHI VÀ CHỈ KHI đồng thời:
//   state.currentPage === 'group-detail', event.groupId === state.currentGroupId,
//   và event.contentChanged === true. Mọi trường hợp khác (khác trang, khác nhóm,
//   hoặc chỉ đổi Snapshot_Metadata) hàm trả về false.
//
// Validates: Requirements 1.4, 1.5, 1.6
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

// --- Nạp js/groups.js trong vm sandbox --------------------------------------
// Các hàm thuần được khai báo top-level trong groups.js. Cuối file có khối
// `window.xxx = ...` chạy lúc load, nên sandbox PHẢI có `window`. Ngoài ra cung
// cấp các global cơ bản và stub các tham chiếu ngoài (auth, db, firebase...) là
// undefined — các hàm thuần không dùng tới chúng nên không bị gọi khi test.

const GROUPS_PATH = path.join(__dirname, '..', '..', 'js', 'groups.js');
const GROUPS_SRC = fs.readFileSync(GROUPS_PATH, 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingGroupExports = { shouldRenderGroupDetail };
`;

function loadGroups() {
  const sandbox = {
    window: {},
    document: undefined,
    console,
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
    encodeURIComponent,
    decodeURIComponent,
    setTimeout,
    clearTimeout,
    // Stub các tham chiếu hạ tầng (không được các hàm thuần gọi tới lúc test).
    auth: undefined,
    db: undefined,
    firebase: undefined,
    firestore: undefined,
  };
  sandbox.window = sandbox.window || {};
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(GROUPS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'groups.js' });
  return sandbox.__tingGroupExports;
}

const { shouldRenderGroupDetail } = loadGroups();

// --- Generators -------------------------------------------------------------

// Định danh nhóm đa dạng nhưng thuộc một tập nhỏ để hai trường groupId có xác
// suất khớp/không-khớp đáng kể.
const groupIdArb = fc.constantFrom('g1', 'g2', 'g3', 'g4', null, undefined, '');

// currentPage: có 'group-detail' và các trang khác để bao phủ điều kiện trang.
const pageArb = fc.constantFrom(
  'group-detail', 'groups', 'accounts', 'home', 'settings', '', null, undefined,
);

// contentChanged: bao phủ true và các giá trị "không phải true" (false, truthy lạ).
const contentChangedArb = fc.oneof(
  fc.boolean(),
  fc.constantFrom(1, 0, 'true', 'false', null, undefined),
);

const stateArb = fc.record({
  currentPage: pageArb,
  currentGroupId: groupIdArb,
});

const eventArb = fc.record({
  groupId: groupIdArb,
  contentChanged: contentChangedArb,
});

// Oracle độc lập: tái phát biểu hợp đồng "khi và chỉ khi".
function expected(state, event) {
  return state.currentPage === 'group-detail'
    && event.groupId === state.currentGroupId
    && event.contentChanged === true;
}

// --- Property ---------------------------------------------------------------

describe('Property 1 — shouldRenderGroupDetail render đúng điều kiện (Requirements 1.4, 1.5, 1.6)', () => {
  it('trả true khi và chỉ khi đúng trang, đúng nhóm, và nội dung thực sự đổi', () => {
    fc.assert(
      fc.property(stateArb, eventArb, (state, event) => {
        expect(shouldRenderGroupDetail(state, event)).toBe(expected(state, event));
      }),
      { numRuns: 200 },
    );
  });

  it('Req 1.6: khác trang => false dù đúng nhóm và nội dung đổi', () => {
    fc.assert(
      fc.property(
        pageArb.filter((p) => p !== 'group-detail'),
        groupIdArb,
        (page, gid) => {
          const state = { currentPage: page, currentGroupId: gid };
          const event = { groupId: gid, contentChanged: true };
          expect(shouldRenderGroupDetail(state, event)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Req 1.4: khác nhóm => false dù đúng trang và nội dung đổi', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('g1', 'g2', 'g3', 'g4'),
        fc.constantFrom('g1', 'g2', 'g3', 'g4'),
        (currentGid, eventGid) => {
          fc.pre(currentGid !== eventGid);
          const state = { currentPage: 'group-detail', currentGroupId: currentGid };
          const event = { groupId: eventGid, contentChanged: true };
          expect(shouldRenderGroupDetail(state, event)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Req 1.5: chỉ đổi Snapshot_Metadata (contentChanged !== true) => false', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('g1', 'g2', 'g3', 'g4'),
        contentChangedArb.filter((c) => c !== true),
        (gid, changed) => {
          const state = { currentPage: 'group-detail', currentGroupId: gid };
          const event = { groupId: gid, contentChanged: changed };
          expect(shouldRenderGroupDetail(state, event)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('trường hợp thoả mãn đầy đủ => true', () => {
    fc.assert(
      fc.property(fc.constantFrom('g1', 'g2', 'g3', 'g4'), (gid) => {
        const state = { currentPage: 'group-detail', currentGroupId: gid };
        const event = { groupId: gid, contentChanged: true };
        expect(shouldRenderGroupDetail(state, event)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
