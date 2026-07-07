// ============================================================================
// Property-based test cho moveCategoryOrder (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 7: Di chuyển thứ tự danh mục là hoán vị bảo toàn
//   Với mọi danh sách `categories`, một `categoryId` và hướng di chuyển,
//   moveCategoryOrder(categories, categoryId, direction) trả về một HOÁN VỊ của
//   cùng tập danh mục (không thêm/bớt phần tử — so theo tập id) và chỉ hoán đổi
//   danh mục chỉ định với danh mục liền kề theo hướng ('up'/'down'). Ở biên
//   (đầu danh sách + 'up', hoặc cuối + 'down') giữ nguyên trật tự. Trường `order`
//   được đánh lại theo vị trí mới (0..n-1). categoryId được so bằng
//   normalizeGroupCategoryId.
//
// Validates: Requirements 6.7, 6.8
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
  moveCategoryOrder,
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
    };
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(GROUPS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'groups.js' });
    return sandbox.__tingGroupExports;
}

const { moveCategoryOrder, normalizeGroupCategoryId } = loadGroups();

// --- Oracle tự xây (độc lập với cài đặt) ------------------------------------
// Trả về chuỗi id (đã chuẩn hoá) theo THỨ TỰ MẢNG kỳ vọng sau khi di chuyển:
// chỉ đổi chỗ phần tử chỉ định với phần tử liền kề theo hướng; ra biên/id lạ
// thì giữ nguyên. Lưu ý: moveCategoryOrder làm việc theo thứ tự MẢNG, không
// phụ thuộc trường `order` của đầu vào.
function oracleIdOrder(categories, categoryId, direction) {
    const ids = categories.map(c => normalizeGroupCategoryId(c.id));
    const target = normalizeGroupCategoryId(categoryId);
    const idx = ids.findIndex(x => x === target);
    const delta = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    if (idx === -1 || delta === 0) return ids.slice();
    const swap = idx + delta;
    if (swap < 0 || swap >= ids.length) return ids.slice();
    const copy = ids.slice();
    [copy[idx], copy[swap]] = [copy[swap], copy[idx]];
    return copy;
}

// --- Generators -------------------------------------------------------------

// Danh sách danh mục: id duy nhất dạng slug hợp lệ 'cat-<n>' (normalize giữ
// nguyên), name và order ngẫu nhiên. Bao gồm cả danh sách rỗng.
const categoriesArb = fc
    .uniqueArray(fc.integer({ min: 0, max: 999 }), { minLength: 0, maxLength: 8 })
    .chain((nums) => {
        if (nums.length === 0) return fc.constant([]);
        return fc
            .array(fc.integer({ min: -50, max: 50 }), { minLength: nums.length, maxLength: nums.length })
            .map((orders) => nums.map((n, i) => ({
                id: `cat-${n}`,
                name: `Danh mục ${n}`,
                order: orders[i],
                icon: 'folder',
                color: '#6C5CE7',
            })));
    });

const directionArb = fc.constantFrom('up', 'down');

// Bộ chọn categoryId: dùng id có trong list (theo index) hoặc một id KHÔNG tồn tại.
const selectorArb = fc.record({
    useExisting: fc.boolean(),
    index: fc.nat(),
    ghost: fc.constantFrom('cat-ghost', 'missing-xyz', 'cat-99999'),
});

// Sắp xếp chuỗi id để so sánh theo TẬP (bảo toàn, không mất/nhân bản).
function sortedIds(arr) {
    return arr.map(c => normalizeGroupCategoryId(c.id)).slice().sort();
}

// --- Property ---------------------------------------------------------------

describe('Property 7 — moveCategoryOrder là hoán vị bảo toàn (Requirements 6.7, 6.8)', () => {
    it('bảo toàn tập id, chỉ đổi chỗ liền kề, giữ nguyên ở biên/id lạ, và đánh lại order', () => {
        fc.assert(
            fc.property(categoriesArb, selectorArb, directionArb, (categories, selector, direction) => {
                // Chọn categoryId: id có thật trong list, hoặc id lạ không tồn tại.
                const categoryId = (selector.useExisting && categories.length > 0)
                    ? categories[selector.index % categories.length].id
                    : selector.ghost;

                const result = moveCategoryOrder(categories, categoryId, direction);

                // (1) Không đột biến đầu vào (trả về bản sao mới).
                expect(result).not.toBe(categories);

                // (2) Bảo toàn tập id trước và sau: không mất, không nhân bản.
                expect(sortedIds(result)).toEqual(sortedIds(categories));

                // (3) Thứ tự id sau khi trả về khớp oracle: đúng bằng việc đổi chỗ
                //     2 phần tử liền kề (hoặc giữ nguyên khi ra biên/id lạ).
                const expectedOrder = oracleIdOrder(categories, categoryId, direction);
                expect(result.map(c => normalizeGroupCategoryId(c.id))).toEqual(expectedOrder);

                // (4) order sau khi trả về khớp index 0..n-1.
                result.forEach((cat, i) => {
                    expect(cat.order).toBe(i);
                });

                // (5) Các trường khác (name) đi kèm đúng id, không bị lẫn.
                const nameById = new Map(categories.map(c => [normalizeGroupCategoryId(c.id), c.name]));
                result.forEach((cat) => {
                    expect(cat.name).toBe(nameById.get(normalizeGroupCategoryId(cat.id)));
                });
            }),
            { numRuns: 300 },
        );
    });

    it('ở biên: đầu danh sách + "up" và cuối danh sách + "down" giữ nguyên trật tự id', () => {
        fc.assert(
            fc.property(
                categoriesArb.filter(list => list.length >= 1),
                fc.boolean(),
                (categories, moveFirstUp) => {
                    const beforeIds = categories.map(c => normalizeGroupCategoryId(c.id));
                    const edgeId = moveFirstUp
                        ? categories[0].id // đầu danh sách
                        : categories[categories.length - 1].id; // cuối danh sách
                    const direction = moveFirstUp ? 'up' : 'down';

                    const result = moveCategoryOrder(categories, edgeId, direction);
                    // Di chuyển ra ngoài biên => thứ tự id giữ nguyên.
                    expect(result.map(c => normalizeGroupCategoryId(c.id))).toEqual(beforeIds);
                },
            ),
            { numRuns: 300 },
        );
    });
});
