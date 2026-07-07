// ============================================================================
// Property-based test cho applyEditRequestDecision (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 15: Quyết định duyệt/từ chối Edit_Request
//   là idempotent trên trạng thái đã xử lý.
//   applyEditRequestDecision(requests, requestId, decision) CHỈ đổi trạng thái
//   của request đang 'pending' có id === requestId thành decision
//   ('approved'/'rejected') và loại nó khỏi danh sách chờ (pending). Nếu request
//   đã ở trạng thái approved/rejected (đã xử lý) thì kết quả KHÔNG đổi
//   (idempotence), không áp dụng lại. decision không hợp lệ (khác
//   approved/rejected) => không đổi (changed=false). requestId không tồn tại =>
//   không đổi. Hàm trả về { requests, pending, changed, request }.
//
// Validates: Requirements 10.4, 10.5, 10.8
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

// --- Nạp js/groups.js trong vm sandbox (hàm được gán vào window ở cuối file) --

const GROUPS_PATH = path.join(__dirname, '..', '..', 'js', 'groups.js');
const GROUPS_SRC = fs.readFileSync(GROUPS_PATH, 'utf8');

// Xuất hàm thuần cần test ra ngoài sandbox để test truy cập được.
const EXPORT_SNIPPET = `
;globalThis.__tingGroupExports = { applyEditRequestDecision };
`;

function loadGroups() {
    const sandbox = {
        // groups.js gán window.xxx = ... ở cấp module => cần một window object.
        window: {},
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
    };
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    // Stub các phụ thuộc side-effect (không dùng trong hàm thuần cần test).
    sandbox.auth = undefined;
    sandbox.db = undefined;
    sandbox.firebase = undefined;
    vm.createContext(sandbox);
    vm.runInContext(GROUPS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'groups.js' });
    return sandbox.__tingGroupExports;
}

const { applyEditRequestDecision } = loadGroups();

// --- Generators -------------------------------------------------------------

const STATUSES = ['pending', 'approved', 'rejected'];

// Danh sách requests: id DUY NHẤT theo index, status ngẫu nhiên trong 3 trạng thái.
// Bao gồm cả danh sách rỗng để phủ trường hợp không có yêu cầu nào.
const requestsArb = fc
    .array(fc.constantFrom(...STATUSES), { minLength: 0, maxLength: 8 })
    .map((statuses) => statuses.map((status, i) => ({
        id: `req-${i}`,
        status,
        note: `Ghi chú ${i}`,
    })));

// Bộ chọn requestId: dùng id có thật (theo index) hoặc một id KHÔNG tồn tại.
const selectorArb = fc.record({
    useExisting: fc.boolean(),
    index: fc.nat(),
    ghost: fc.constantFrom('req-ghost', 'missing-xyz', 'req-99999'),
});

// decision: giá trị hợp lệ (approved/rejected) hoặc giá trị lạ.
const decisionArb = fc.constantFrom('approved', 'rejected', 'maybe', 'pending', '', 'APPROVED');

const VALID_DECISIONS = new Set(['approved', 'rejected']);

function pickRequestId(requests, selector) {
    return (selector.useExisting && requests.length > 0)
        ? requests[selector.index % requests.length].id
        : selector.ghost;
}

// --- Property ---------------------------------------------------------------

describe('Property 15 — applyEditRequestDecision idempotent (Requirements 10.4, 10.5, 10.8)', () => {
    it('chỉ đổi target đang pending với decision hợp lệ; các trường hợp khác giữ nguyên', () => {
        fc.assert(
            fc.property(requestsArb, selectorArb, decisionArb, (requests, selector, decision) => {
                const requestId = pickRequestId(requests, selector);
                const target = requests.find(r => r.id === requestId) || null;
                const validDecision = VALID_DECISIONS.has(decision);
                const shouldChange = !!target && target.status === 'pending' && validDecision;

                // Chụp ảnh sâu đầu vào để kiểm không đột biến.
                const snapshot = JSON.parse(JSON.stringify(requests));

                const result = applyEditRequestDecision(requests, requestId, decision);

                // (0) Không đột biến mảng đầu vào.
                expect(requests).toEqual(snapshot);

                // (1) requests.length không đổi và giữ nguyên thứ tự id.
                expect(result.requests.map(r => r.id)).toEqual(requests.map(r => r.id));

                // (2) pending = đúng các request có status === 'pending' trong requests trả về.
                expect(result.pending).toEqual(result.requests.filter(r => r.status === 'pending'));

                if (shouldChange) {
                    // (3a) changed=true; target có status mới = decision.
                    expect(result.changed).toBe(true);
                    const changedReq = result.requests.find(r => r.id === requestId);
                    expect(changedReq.status).toBe(decision);
                    // request trả về chính là bản đã cập nhật.
                    expect(result.request).toEqual(changedReq);
                    // (3b) pending không còn chứa target.
                    expect(result.pending.some(r => r.id === requestId)).toBe(false);
                    // (3c) các request khác giữ nguyên trạng thái.
                    requests.forEach((orig) => {
                        if (orig.id !== requestId) {
                            const after = result.requests.find(r => r.id === orig.id);
                            expect(after.status).toBe(orig.status);
                        }
                    });
                } else {
                    // (4) Không đổi: changed=false, mọi trạng thái giữ nguyên (idempotent
                    //     với request đã xử lý / decision không hợp lệ / id không tồn tại).
                    expect(result.changed).toBe(false);
                    expect(result.request).toBeNull();
                    expect(result.requests.map(r => ({ id: r.id, status: r.status })))
                        .toEqual(requests.map(r => ({ id: r.id, status: r.status })));
                }
            }),
            { numRuns: 300 },
        );
    });

    it('idempotence: gọi 2 lần liên tiếp cùng requestId/decision => lần 2 không đổi', () => {
        fc.assert(
            fc.property(
                requestsArb,
                selectorArb,
                fc.constantFrom('approved', 'rejected'),
                (requests, selector, decision) => {
                    const requestId = pickRequestId(requests, selector);

                    const first = applyEditRequestDecision(requests, requestId, decision);
                    const second = applyEditRequestDecision(first.requests, requestId, decision);

                    // Lần 2 không tạo thay đổi nào (đã ở trạng thái đã xử lý hoặc không có target).
                    expect(second.changed).toBe(false);
                    expect(second.request).toBeNull();

                    // requests sau lần 2 giữ nguyên trạng thái so với sau lần 1.
                    expect(second.requests.map(r => ({ id: r.id, status: r.status })))
                        .toEqual(first.requests.map(r => ({ id: r.id, status: r.status })));
                    // pending cũng không đổi.
                    expect(second.pending.map(r => r.id)).toEqual(first.pending.map(r => r.id));
                },
            ),
            { numRuns: 200 },
        );
    });

    it('request đã approved/rejected => quyết định lại là no-op (changed=false, giữ nguyên trạng thái)', () => {
        // Sinh danh sách chỉ gồm các request đã xử lý (approved/rejected) để tập trung idempotence.
        const processedRequestsArb = fc
            .array(fc.constantFrom('approved', 'rejected'), { minLength: 1, maxLength: 6 })
            .map((statuses) => statuses.map((status, i) => ({ id: `req-${i}`, status })));

        fc.assert(
            fc.property(
                processedRequestsArb,
                fc.nat(),
                fc.constantFrom('approved', 'rejected'),
                (requests, index, decision) => {
                    const requestId = requests[index % requests.length].id;
                    const result = applyEditRequestDecision(requests, requestId, decision);

                    expect(result.changed).toBe(false);
                    expect(result.request).toBeNull();
                    expect(result.requests.map(r => ({ id: r.id, status: r.status })))
                        .toEqual(requests.map(r => ({ id: r.id, status: r.status })));
                },
            ),
            { numRuns: 100 },
        );
    });
});
