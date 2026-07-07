// ============================================================================
// Property-based test cho reassignAccountsOnCategoryDelete (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 8: Xoá danh mục chuyển account về "Chưa phân loại"
//   Với mọi danh sách `accounts` và một `deletedId`,
//   reassignAccountsOnCategoryDelete(accounts, deletedId) phải:
//     - Đặt groupCategoryId = null cho ĐÚNG mọi tài khoản đang thuộc deletedId
//       (so bằng normalizeGroupCategoryId).
//     - Giữ nguyên groupCategoryId của mọi tài khoản khác (so sau chuẩn hoá).
//     - Trả về một mảng bản sao MỚI, không đột biến (mutate) đầu vào.
//     - Giữ nguyên độ dài mảng.
//
// Validates: Requirements 6.6
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

// --- Nạp js/groups.js trong vm sandbox (hàm được gán vào window ở cuối file) --

const GROUPS_PATH = path.join(__dirname, '..', '..', 'js', 'groups.js');
const GROUPS_SRC = fs.readFileSync(GROUPS_PATH, 'utf8');

// Xuất các hàm thuần cần test ra ngoài sandbox để test truy cập được.
const EXPORT_SNIPPET = `
;globalThis.__tingGroupExports = {
  reassignAccountsOnCategoryDelete,
  normalizeGroupCategoryId,
};
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
        // Các phụ thuộc runtime không dùng trong hàm thuần => stub undefined.
        auth: undefined,
        db: undefined,
        firebase: undefined,
    };
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(GROUPS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'groups.js' });
    return sandbox.__tingGroupExports;
}

const { reassignAccountsOnCategoryDelete, normalizeGroupCategoryId } = loadGroups();

// --- Generators -------------------------------------------------------------

// Pool id danh mục "hợp lệ" dạng slug (normalize giữ nguyên), kèm null và ''
// để phủ trường hợp tài khoản chưa phân loại.
const CATEGORY_POOL = ['cat-a', 'cat-b', 'cat-c', 'work', 'personal', null, ''];

// Nguồn id danh mục cho từng tài khoản: lấy từ pool trên.
const accountCategoryArb = fc.constantFrom(...CATEGORY_POOL);

// Một tài khoản: có id duy nhất + groupCategoryId lấy từ pool + vài trường phụ
// để kiểm tra không lẫn dữ liệu khi tạo bản sao.
const accountArb = fc.record({
    id: fc.uuid(),
    groupCategoryId: accountCategoryArb,
    name: fc.string(),
    groupSortOrder: fc.integer({ min: 0, max: 100 }),
});

// Danh sách tài khoản (bao gồm mảng rỗng).
const accountsArb = fc.array(accountArb, { maxLength: 25 });

// deletedId: có thể là id trong pool (kể cả null/'') hoặc id KHÔNG tồn tại.
const deletedIdArb = fc.oneof(
    fc.constantFrom(...CATEGORY_POOL),
    fc.constantFrom('cat-ghost', 'missing-xyz', 'cat-99999'),
);

// --- Property ---------------------------------------------------------------

describe('Property 8 — reassignAccountsOnCategoryDelete gán account về "Chưa phân loại" (Requirements 6.6)', () => {
    it('đặt null đúng account thuộc deletedId, giữ nguyên phần còn lại, không mutate input', () => {
        fc.assert(
            fc.property(accountsArb, deletedIdArb, (accounts, deletedId) => {
                // Chụp lại snapshot đầu vào (deep-ish) để phát hiện mutate.
                const beforeSnapshot = accounts.map(a => ({ ...a }));
                const target = normalizeGroupCategoryId(deletedId);

                const result = reassignAccountsOnCategoryDelete(accounts, deletedId);

                // (1) Trả về mảng bản sao MỚI (không cùng tham chiếu).
                expect(result).not.toBe(accounts);

                // (2) Giữ nguyên độ dài mảng.
                expect(result.length).toBe(accounts.length);

                // (3) Không đột biến đầu vào: từng phần tử gốc và mảng gốc bất biến.
                expect(accounts).toEqual(beforeSnapshot);
                result.forEach((item, i) => {
                    expect(item).not.toBe(accounts[i]); // mỗi phần tử là bản sao mới
                });

                // (4) Kiểm từng phần tử theo hợp đồng.
                result.forEach((item, i) => {
                    const original = beforeSnapshot[i];
                    const accCat = normalizeGroupCategoryId(original.groupCategoryId);

                    if (target && accCat === target) {
                        // Tài khoản thuộc deletedId => groupCategoryId phải là null.
                        expect(item.groupCategoryId).toBeNull();
                    } else {
                        // Tài khoản khác => giữ nguyên groupCategoryId gốc (giá trị y hệt).
                        expect(item.groupCategoryId).toBe(original.groupCategoryId);
                    }

                    // Các trường khác không bị thay đổi.
                    expect(item.id).toBe(original.id);
                    expect(item.name).toBe(original.name);
                    expect(item.groupSortOrder).toBe(original.groupSortOrder);
                });
            }),
            { numRuns: 300 },
        );
    });

    it('khi deletedId chuẩn hoá rỗng (null/""/không khớp slug), không đổi phân loại nào', () => {
        fc.assert(
            fc.property(accountsArb, fc.constantFrom(null, '', '   ', '---'), (accounts, deletedId) => {
                // normalizeGroupCategoryId của các giá trị này đều là chuỗi rỗng.
                expect(normalizeGroupCategoryId(deletedId)).toBe('');

                const result = reassignAccountsOnCategoryDelete(accounts, deletedId);

                // target rỗng => giữ nguyên groupCategoryId của mọi tài khoản.
                result.forEach((item, i) => {
                    expect(item.groupCategoryId).toBe(accounts[i].groupCategoryId);
                });
            }),
            { numRuns: 200 },
        );
    });
});
