// ============================================================================
// Property-based test cho computeAccountMoveButtons (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 10: Trạng thái nút di chuyển account theo vị trí
//   Với mọi total >= 1 và 0 <= index < total,
//   computeAccountMoveButtons(index, total) trả về { upDisabled, downDisabled }
//   với upDisabled === (index === 0) và downDisabled === (index === total - 1).
//   Do đó khi total === 1 cả hai nút đều bị vô hiệu hoá; ở biên đầu (index 0) nút
//   lên bị vô hiệu, ở biên cuối (index total - 1) nút xuống bị vô hiệu.
//
// Validates: Requirements 7.2, 7.3, 7.4
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
;globalThis.__tingGroupExports = { computeAccountMoveButtons };
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
    vm.createContext(sandbox);
    vm.runInContext(GROUPS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'groups.js' });
    return sandbox.__tingGroupExports;
}

const { computeAccountMoveButtons } = loadGroups();

// --- Generator: cặp (total, index) hợp lệ -----------------------------------
// total trong [1, 50]; index trong [0, total - 1].
const positionArb = fc
    .integer({ min: 1, max: 50 })
    .chain((total) => fc.record({
        total: fc.constant(total),
        index: fc.integer({ min: 0, max: total - 1 }),
    }));

// --- Property ---------------------------------------------------------------

describe('Property 10 — Trạng thái nút di chuyển account theo vị trí (Requirements 7.2, 7.3, 7.4)', () => {
    it('upDisabled === (index === 0) và downDisabled === (index === total - 1)', () => {
        fc.assert(
            fc.property(positionArb, ({ index, total }) => {
                const { upDisabled, downDisabled } = computeAccountMoveButtons(index, total);
                expect(upDisabled).toBe(index === 0);
                expect(downDisabled).toBe(index === total - 1);
            }),
            { numRuns: 300 },
        );
    });

    it('khi total === 1 cả hai nút đều bị vô hiệu hoá', () => {
        const { upDisabled, downDisabled } = computeAccountMoveButtons(0, 1);
        expect(upDisabled).toBe(true);
        expect(downDisabled).toBe(true);
    });

    it('biên đầu: index === 0 (total > 1) => up vô hiệu, down không vô hiệu', () => {
        fc.assert(
            fc.property(fc.integer({ min: 2, max: 50 }), (total) => {
                const { upDisabled, downDisabled } = computeAccountMoveButtons(0, total);
                expect(upDisabled).toBe(true);
                expect(downDisabled).toBe(false);
            }),
            { numRuns: 100 },
        );
    });

    it('biên cuối: index === total - 1 (total > 1) => down vô hiệu, up không vô hiệu', () => {
        fc.assert(
            fc.property(fc.integer({ min: 2, max: 50 }), (total) => {
                const { upDisabled, downDisabled } = computeAccountMoveButtons(total - 1, total);
                expect(upDisabled).toBe(false);
                expect(downDisabled).toBe(true);
            }),
            { numRuns: 100 },
        );
    });
});
