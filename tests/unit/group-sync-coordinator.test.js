// ============================================================================
// Edge-case test cho Group_Sync_Coordinator trong `js/groups.js`
// (notifyGroupsChanged + runGroupsChangedRender + cổng shouldRenderGroupDetail).
//
// Feature: group-tab-redesign, Task 5.2
//   Kiểm chứng: nhiều Snapshot_Event trong cùng cửa sổ 50ms gộp thành ĐÚNG một
//   lần render; sự kiện khác nhóm hoặc chỉ đổi Snapshot_Metadata KHÔNG làm tăng
//   số lần render Group_Detail_View.
//
// Validates: Requirements 1.1, 1.3, 1.4, 1.5, 1.6
//
// Ghi chú kỹ thuật: notifyGroupsChanged debounce qua setTimeout/clearTimeout và
// hàm chạy trong sandbox `vm`, nên KHÔNG dùng vi.useFakeTimers. Thay vào đó ta
// tự cấp setTimeout/clearTimeout GIẢ trong sandbox: lưu callback + mốc thời gian
// ảo vào hàng đợi, rồi dùng advance(ms) để chạy callback khi đủ thời gian. Nhờ
// vậy test kiểm soát chính xác cửa sổ gộp 50ms.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GROUPS_PATH = path.join(__dirname, '..', '..', 'js', 'groups.js');
const GROUPS_SRC = fs.readFileSync(GROUPS_PATH, 'utf8');

// Đưa các hàm/hằng cần dùng ra ngoài sandbox để test truy cập được.
const EXPORT_SNIPPET = `
;globalThis.__tingGroupExports = {
  notifyGroupsChanged,
  runGroupsChangedRender,
  shouldRenderGroupDetail,
  GROUP_RENDER_DEBOUNCE_MS,
};
`;

// --- Dựng harness: sandbox + timer giả + các stub đếm số lần gọi -------------
// Mỗi test tạo một harness riêng để reset hoàn toàn state module-level trong
// groups.js (_groupsRenderTimer, _pendingGroupRenderId, _pendingContentChanged).
function createHarness({ currentPage = 'group-detail', currentGroupId = 'g1' } = {}) {
    // --- Bộ đếm thời gian ảo do test tự điều khiển ---
    let now = 0;          // đồng hồ ảo (ms)
    let seq = 0;          // sinh id timer
    const timers = new Map(); // id -> { cb, at } (at = mốc thời gian ảo sẽ chạy)

    function setTimeoutFake(cb, delay) {
        const id = ++seq;
        timers.set(id, { cb, at: now + (Number(delay) || 0) });
        return id;
    }
    function clearTimeoutFake(id) {
        timers.delete(id);
    }
    // Đẩy đồng hồ ảo tiến ms mili-giây, chạy mọi callback đến hạn theo đúng thứ tự thời gian.
    function advance(ms) {
        const target = now + ms;
        for (;;) {
            let nextId = null;
            let nextAt = Infinity;
            for (const [id, t] of timers) {
                if (t.at <= target && t.at < nextAt) {
                    nextAt = t.at;
                    nextId = id;
                }
            }
            if (nextId === null) break;
            const t = timers.get(nextId);
            timers.delete(nextId);
            now = t.at;
            t.cb();
        }
        now = target;
    }

    // --- Bộ đếm số lần gọi các hàm render (stub) ---
    const counts = { renderGroupDetail: 0, renderGroupList: 0, updateHeader: 0, renderGroupDesign: 0 };
    const lastArgs = { renderGroupDetail: null };

    const appState = { currentPage, currentGroupId };

    // groups.js tham chiếu các hàm render như biến toàn cục tự do; đặt trực tiếp
    // trên sandbox context để `typeof renderGroupDetail === 'function'` là true.
    const sandbox = {
        window: { appState },
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
        setTimeout: setTimeoutFake,
        clearTimeout: clearTimeoutFake,
        updateHeader: () => { counts.updateHeader += 1; },
        renderGroupList: () => { counts.renderGroupList += 1; },
        renderGroupDetail: (gid, opts) => {
            counts.renderGroupDetail += 1;
            lastArgs.renderGroupDetail = { gid, opts };
        },
        renderGroupDesign: () => { counts.renderGroupDesign += 1; },
        // Stub hạ tầng (không dùng trong luồng test này).
        auth: undefined,
        db: undefined,
        firebase: undefined,
        firestore: undefined,
    };
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(GROUPS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'groups.js' });

    return {
        api: sandbox.__tingGroupExports,
        counts,
        lastArgs,
        appState,
        advance,
        pendingTimers: () => timers.size,
    };
}

describe('Group_Sync_Coordinator — debounce và cổng render (Requirements 1.1, 1.3, 1.4, 1.5, 1.6)', () => {
    it('Req 1.1/1.3: nhiều Snapshot_Event trong cùng cửa sổ 50ms gộp thành đúng 1 render và mỗi lần gọi reset timer', () => {
        const h = createHarness({ currentPage: 'group-detail', currentGroupId: 'g1' });
        const { notifyGroupsChanged, GROUP_RENDER_DEBOUNCE_MS } = h.api;
        expect(GROUP_RENDER_DEBOUNCE_MS).toBe(50);

        // Lần 1: đặt timer hẹn ở mốc 50ms.
        notifyGroupsChanged('g1');
        h.advance(49); // chưa đủ 50ms kể từ lần cuối => chưa render
        expect(h.counts.renderGroupDetail).toBe(0);

        // Lần 2: reset timer. Nếu KHÔNG reset, timer cũ ở mốc 50 sẽ bắn trong advance(40) tiếp theo.
        notifyGroupsChanged('g1');
        h.advance(40); // tổng đã qua mốc 50 ban đầu, nhưng timer đã được đặt lại => vẫn chưa render
        expect(h.counts.renderGroupDetail).toBe(0);

        // Lần 3: reset timer lần nữa.
        notifyGroupsChanged('g1');
        h.advance(49); // chưa đủ 50ms kể từ lần cuối
        expect(h.counts.renderGroupDetail).toBe(0);

        h.advance(1); // đủ 50ms kể từ Snapshot_Event cuối => render đúng 1 lần
        expect(h.counts.renderGroupDetail).toBe(1);

        // Render đúng nhóm đang mở và ở chế độ quiet.
        expect(h.lastArgs.renderGroupDetail).toEqual({ gid: 'g1', opts: { quiet: true } });
        // Cả cụm chỉ chạy runGroupsChangedRender một lần => updateHeader gọi đúng 1 lần.
        expect(h.counts.updateHeader).toBe(1);

        // Sau khi bắn, không còn timer treo và không render thêm nếu advance tiếp.
        expect(h.pendingTimers()).toBe(0);
        h.advance(1000);
        expect(h.counts.renderGroupDetail).toBe(1);
    });

    it('Req 1.4: Snapshot_Event của nhóm khác không làm tăng số lần render nhóm đang mở', () => {
        const h = createHarness({ currentPage: 'group-detail', currentGroupId: 'g1' });
        const { notifyGroupsChanged } = h.api;

        notifyGroupsChanged('g2'); // sự kiện cho nhóm khác nhóm đang mở
        h.advance(50);

        expect(h.counts.renderGroupDetail).toBe(0);
        expect(h.lastArgs.renderGroupDetail).toBeNull();
    });

    it('Req 1.5: Snapshot_Event chỉ đổi metadata (contentChanged=false) không làm tăng số lần render', () => {
        const h = createHarness({ currentPage: 'group-detail', currentGroupId: 'g1' });
        const { notifyGroupsChanged } = h.api;

        notifyGroupsChanged('g1', { contentChanged: false });
        h.advance(50);

        expect(h.counts.renderGroupDetail).toBe(0);
        // Vẫn chạy runGroupsChangedRender một lần (cập nhật header), nhưng KHÔNG render detail.
        expect(h.counts.updateHeader).toBe(1);
    });

    it('Req 1.6: khi Group_Detail_View không mở (currentPage khác group-detail) thì không render detail; nhưng vẫn render danh sách khi ở trang groups', () => {
        const h = createHarness({ currentPage: 'groups', currentGroupId: 'g1' });
        const { notifyGroupsChanged } = h.api;

        notifyGroupsChanged('g1');
        h.advance(50);

        expect(h.counts.renderGroupDetail).toBe(0);
        expect(h.counts.renderGroupList).toBe(1);
    });

    it('Cụm hỗn hợp: có cả event metadata-only lẫn 1 event nội dung => coi là nội dung đổi => render đúng 1 lần', () => {
        // Thứ tự metadata-only trước, nội dung sau.
        const h1 = createHarness({ currentPage: 'group-detail', currentGroupId: 'g1' });
        h1.api.notifyGroupsChanged('g1', { contentChanged: false });
        h1.api.notifyGroupsChanged('g1', { contentChanged: true });
        h1.api.notifyGroupsChanged('g1', { contentChanged: false });
        h1.advance(50);
        expect(h1.counts.renderGroupDetail).toBe(1);
        expect(h1.lastArgs.renderGroupDetail).toEqual({ gid: 'g1', opts: { quiet: true } });

        // Thứ tự nội dung trước, metadata-only sau: cờ tích luỹ vẫn giữ true.
        const h2 = createHarness({ currentPage: 'group-detail', currentGroupId: 'g1' });
        h2.api.notifyGroupsChanged('g1', { contentChanged: true });
        h2.api.notifyGroupsChanged('g1', { contentChanged: false });
        h2.advance(50);
        expect(h2.counts.renderGroupDetail).toBe(1);
    });
});
