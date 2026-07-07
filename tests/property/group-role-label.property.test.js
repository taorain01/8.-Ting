// ============================================================================
// Property-based test cho computeRoleLabel (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 14: Nhãn vai trò xác định duy nhất
//   Với mọi cặp (isOwner, isManager), computeRoleLabel trả về đúng một nhãn
//   theo thứ tự ưu tiên: 'Chủ nhóm' nếu isOwner; ngược lại 'Quản lý TK' nếu
//   isManager; ngược lại 'Thành viên'. Đặc biệt, khi isOwner truthy thì luôn
//   ra 'Chủ nhóm' bất kể giá trị của isManager.
//
// Validates: Requirements 9.4
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
;globalThis.__tingGroupExports = { computeRoleLabel };
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

const { computeRoleLabel } = loadGroups();

// Ba nhãn hợp lệ duy nhất mà hàm được phép trả về.
const CHU_NHOM = 'Chủ nhóm';
const QUAN_LY = 'Quản lý TK';
const THANH_VIEN = 'Thành viên';

// Oracle độc lập tính nhãn kỳ vọng theo đúng thứ tự ưu tiên trong hợp đồng.
function expectedRoleLabel(isOwner, isManager) {
    if (isOwner) return CHU_NHOM;
    if (isManager) return QUAN_LY;
    return THANH_VIEN;
}

describe('Property 14 — Nhãn vai trò xác định duy nhất (Requirements 9.4)', () => {
    it('khớp oracle 3 nhánh với mọi cặp boolean (isOwner, isManager)', () => {
        fc.assert(
            fc.property(fc.boolean(), fc.boolean(), (isOwner, isManager) => {
                const label = computeRoleLabel(isOwner, isManager);
                expect(label).toBe(expectedRoleLabel(isOwner, isManager));
                // Nhãn luôn nằm trong tập 3 nhãn hợp lệ (xác định duy nhất).
                expect([CHU_NHOM, QUAN_LY, THANH_VIEN]).toContain(label);
            }),
            { numRuns: 200 },
        );
    });

    it('isOwner truthy luôn ra "Chủ nhóm" bất kể isManager', () => {
        fc.assert(
            fc.property(fc.boolean(), (isManager) => {
                expect(computeRoleLabel(true, isManager)).toBe(CHU_NHOM);
            }),
            { numRuns: 100 },
        );
    });

    it('không phải chủ nhóm nhưng là quản lý => "Quản lý TK"', () => {
        expect(computeRoleLabel(false, true)).toBe(QUAN_LY);
    });

    it('không phải chủ nhóm và không phải quản lý => "Thành viên"', () => {
        expect(computeRoleLabel(false, false)).toBe(THANH_VIEN);
    });

    // Bao phủ cả giá trị truthy/falsy "lạ" để khẳng định tính ưu tiên theo độ
    // truthy của isOwner rồi tới isManager, luôn cho ra một trong ba nhãn.
    it('ổn định với giá trị truthy/falsy bất kỳ theo độ truthy', () => {
        const anyArb = fc.oneof(
            fc.boolean(),
            fc.constant(0),
            fc.constant(1),
            fc.constant(''),
            fc.constant('x'),
            fc.constant(null),
            fc.constant(undefined),
            fc.integer(),
            fc.string(),
        );
        fc.assert(
            fc.property(anyArb, anyArb, (isOwner, isManager) => {
                const label = computeRoleLabel(isOwner, isManager);
                expect(label).toBe(expectedRoleLabel(isOwner, isManager));
                expect([CHU_NHOM, QUAN_LY, THANH_VIEN]).toContain(label);
            }),
            { numRuns: 200 },
        );
    });
});
