// ============================================================================
// Property-based test cho swapAccountSortOrder (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 11: Hoán đổi thứ tự account bảo toàn tập giá trị order
//   Với mọi danh sách Shared_Account, một `accountId` và hướng di chuyển,
//   swapAccountSortOrder(accounts, accountId, direction) CHỈ hoán đổi giá trị
//   `groupSortOrder` giữa tài khoản chỉ định và tài khoản liền kề theo hướng
//   (xác định theo thứ tự HIỂN THỊ hiện tại — dùng sortSharedAccountsForGroup).
//   Tập hợp (multiset) các giá trị `groupSortOrder` sau thao tác bằng đúng tập
//   trước thao tác (bảo toàn). Thứ tự sắp xếp thu được đúng bằng việc đổi chỗ
//   hai phần tử liền kề trong danh sách hiển thị. Hàm trả về mảng bản sao mới,
//   giữ nguyên vị trí phần tử trong mảng gốc (chỉ đổi giá trị order). Ở biên
//   (đầu + 'up', cuối + 'down') hoặc id lạ => trả bản sao không đổi giá trị.
//
// Validates: Requirements 7.5
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
  swapAccountSortOrder,
  sortSharedAccountsForGroup,
  getSharedAccountSortValue,
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
    // Stub các phụ thuộc side-effect (không dùng trong hàm thuần cần test).
    sandbox.auth = undefined;
    sandbox.db = undefined;
    sandbox.firebase = undefined;
    vm.createContext(sandbox);
    vm.runInContext(GROUPS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'groups.js' });
    return sandbox.__tingGroupExports;
}

const { swapAccountSortOrder, sortSharedAccountsForGroup } = loadGroups();

// --- Oracle tự xây (độc lập với cài đặt) ------------------------------------
// Trả về danh sách id theo THỨ TỰ HIỂN THỊ kỳ vọng sau khi hoán đổi: đổi chỗ
// phần tử chỉ định với phần tử liền kề theo hướng; ra biên/id lạ => giữ nguyên.
// Vì groupSortOrder được sinh DUY NHẤT nên thứ tự hiển thị = sắp tăng dần theo
// groupSortOrder, không phụ thuộc tie-break updatedAt.
function displayOrderIds(accounts) {
    return sortSharedAccountsForGroup(accounts).map(a => a.id);
}

function expectedDisplayIds(accounts, accountId, direction) {
    const disp = displayOrderIds(accounts);
    const idx = disp.indexOf(accountId);
    const delta = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    if (idx === -1 || delta === 0) return disp;
    const swap = idx + delta;
    if (swap < 0 || swap >= disp.length) return disp;
    const copy = disp.slice();
    [copy[idx], copy[swap]] = [copy[swap], copy[idx]];
    return copy;
}

// Multiset các groupSortOrder (đã sắp) để so sánh bảo toàn.
function sortedOrders(arr) {
    return arr.map(a => a.groupSortOrder).slice().sort((x, y) => x - y);
}

// --- Generators -------------------------------------------------------------

// Danh sách account: id duy nhất theo index, groupSortOrder DUY NHẤT (để thứ tự
// hiển thị xác định rõ, tránh tie-break theo updatedAt). Bao gồm cả danh sách rỗng.
const accountsArb = fc
    .uniqueArray(fc.integer({ min: -1000, max: 1000 }), { minLength: 0, maxLength: 8 })
    .map((orders) => orders.map((order, i) => ({
        id: `acc-${i}`,
        name: `Tài khoản ${i}`,
        groupSortOrder: order,
        updatedAt: `2024-01-0${(i % 9) + 1}T00:00:00.000Z`,
    })));

const directionArb = fc.constantFrom('up', 'down');

// Bộ chọn accountId: dùng id có thật (theo index) hoặc một id KHÔNG tồn tại.
const selectorArb = fc.record({
    useExisting: fc.boolean(),
    index: fc.nat(),
    ghost: fc.constantFrom('acc-ghost', 'missing-xyz', 'acc-99999'),
});

// --- Property ---------------------------------------------------------------

describe('Property 11 — swapAccountSortOrder bảo toàn tập order (Requirements 7.5)', () => {
    it('bảo toàn multiset order, không mutate input, chỉ đổi chỗ 2 phần tử hiển thị liền kề', () => {
        fc.assert(
            fc.property(accountsArb, selectorArb, directionArb, (accounts, selector, direction) => {
                const accountId = (selector.useExisting && accounts.length > 0)
                    ? accounts[selector.index % accounts.length].id
                    : selector.ghost;

                // Chụp ảnh sâu đầu vào để kiểm không đột biến.
                const snapshot = JSON.parse(JSON.stringify(accounts));

                const result = swapAccountSortOrder(accounts, accountId, direction);

                // (1) Trả về mảng bản sao mới (khác tham chiếu).
                expect(result).not.toBe(accounts);

                // (2) Không đột biến đầu vào.
                expect(accounts).toEqual(snapshot);

                // (3) Bảo toàn multiset các giá trị groupSortOrder.
                expect(sortedOrders(result)).toEqual(sortedOrders(accounts));

                // (4) Giữ nguyên vị trí phần tử trong mảng gốc (chỉ đổi giá trị order).
                expect(result.map(a => a.id)).toEqual(accounts.map(a => a.id));

                // (5) Thứ tự HIỂN THỊ sau thao tác khớp oracle: đúng bằng đổi chỗ
                //     2 phần tử liền kề (hoặc giữ nguyên khi ra biên/id lạ).
                expect(displayOrderIds(result)).toEqual(
                    expectedDisplayIds(accounts, accountId, direction),
                );

                // (6) Các trường khác đi kèm đúng id, không bị lẫn.
                const nameById = new Map(accounts.map(a => [a.id, a.name]));
                result.forEach((acc) => {
                    expect(acc.name).toBe(nameById.get(acc.id));
                });
            }),
            { numRuns: 300 },
        );
    });

    it('ở biên: phần tử hiển thị đầu + "up" và cuối + "down" giữ nguyên thứ tự hiển thị', () => {
        fc.assert(
            fc.property(
                accountsArb.filter(list => list.length >= 1),
                fc.boolean(),
                (accounts, moveFirstUp) => {
                    const beforeDisplay = displayOrderIds(accounts);
                    const edgeId = moveFirstUp
                        ? beforeDisplay[0] // phần tử hiển thị đầu
                        : beforeDisplay[beforeDisplay.length - 1]; // phần tử hiển thị cuối
                    const direction = moveFirstUp ? 'up' : 'down';

                    const result = swapAccountSortOrder(accounts, edgeId, direction);

                    // Ra ngoài biên => thứ tự hiển thị giữ nguyên và order không đổi.
                    expect(displayOrderIds(result)).toEqual(beforeDisplay);
                    expect(sortedOrders(result)).toEqual(sortedOrders(accounts));
                },
            ),
            { numRuns: 300 },
        );
    });

    it('id lạ => trả bản sao không đổi giá trị order', () => {
        fc.assert(
            fc.property(accountsArb, directionArb, (accounts, direction) => {
                const beforeDisplay = displayOrderIds(accounts);
                const result = swapAccountSortOrder(accounts, 'khong-ton-tai', direction);

                expect(result).not.toBe(accounts);
                expect(displayOrderIds(result)).toEqual(beforeDisplay);
                // Giá trị order từng account giữ nguyên (map theo id).
                const orderById = new Map(accounts.map(a => [a.id, a.groupSortOrder]));
                result.forEach((acc) => {
                    expect(acc.groupSortOrder).toBe(orderById.get(acc.id));
                });
            }),
            { numRuns: 100 },
        );
    });
});
