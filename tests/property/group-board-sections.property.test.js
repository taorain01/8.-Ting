// ============================================================================
// Property-based test cho buildGroupBoardSections (`js/groups.js`).
//
// Feature: group-tab-redesign, Property 9: "Chưa phân loại" luôn ở cuối và
//   chứa đúng account chưa phân loại
//   Với mọi danh sách `accounts` và `categories`,
//   buildGroupBoardSections(accounts, categories) phải:
//     - Sinh các section danh mục theo thứ tự `order` tăng dần (ties theo thứ
//       tự xuất hiện ban đầu).
//     - Section CUỐI CÙNG luôn là "Chưa phân loại" (id === null,
//       name === 'Chưa phân loại').
//     - Section cuối chứa ĐÚNG các tài khoản không thuộc danh mục nào — bao gồm
//       account có groupCategoryId null/'' hoặc trỏ tới id danh mục không tồn tại.
//     - Account có groupCategoryId khớp một danh mục (so bằng
//       normalizeGroupCategoryId) nằm trong section danh mục đó.
//     - Khi categories rỗng => đúng một section "Chưa phân loại" chứa toàn bộ
//       account.
//     - Hợp (union) tài khoản của mọi section === đúng tập account đầu vào
//       (không mất, không nhân bản).
//
// Validates: Requirements 6.9, 6.10
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
  buildGroupBoardSections,
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

const { buildGroupBoardSections, normalizeGroupCategoryId } = loadGroups();

// --- Generators -------------------------------------------------------------

// Danh mục: name + order ngẫu nhiên. id được gán duy nhất theo chỉ số bên dưới
// (cat-0, cat-1, ...) để bảo đảm không trùng và là slug hợp lệ.
const categoryArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 12 }),
    order: fc.integer({ min: -50, max: 50 }),
});

// Danh sách danh mục (bao gồm mảng rỗng) -> gán id duy nhất dạng slug 'cat-<n>'.
const categoriesArb = fc
    .array(categoryArb, { maxLength: 8 })
    .map(list => list.map((cat, index) => ({ id: `cat-${index}`, name: cat.name, order: cat.order })));

// Nguồn groupCategoryId cho mỗi tài khoản: trộn giữa id danh mục có thể tồn tại
// (cat-0..cat-9), id lạ (không thuộc danh mục nào), và null/'' (chưa phân loại).
const accountCategoryRefArb = fc.oneof(
    fc.constantFrom('cat-0', 'cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-8', 'cat-9'),
    fc.constantFrom('cat-ghost', 'missing-xyz', 'khong-ton-tai', 'cat-99999'),
    fc.constantFrom(null, ''),
);

// Một tài khoản: id duy nhất (uuid) + groupCategoryId + groupSortOrder ngẫu nhiên.
const accountArb = fc.record({
    id: fc.uuid(),
    groupCategoryId: accountCategoryRefArb,
    name: fc.string(),
    groupSortOrder: fc.integer({ min: 0, max: 1000 }),
});

// Danh sách tài khoản (bao gồm mảng rỗng). uuid bảo đảm id không trùng.
const accountsArb = fc.array(accountArb, { maxLength: 25 });

// --- Helpers ----------------------------------------------------------------

// Thứ tự id danh mục kỳ vọng: sắp theo order tăng dần, ties theo chỉ số xuất hiện.
function expectedCategoryIdOrder(categories) {
    return categories
        .map((cat, index) => ({ id: cat.id, order: cat.order, index }))
        .sort((a, b) => (a.order - b.order) || (a.index - b.index))
        .map(item => item.id);
}

// Đa tập id (đếm lần xuất hiện) để so union không mất/không nhân bản.
function idMultiset(accounts) {
    const map = new Map();
    accounts.forEach(a => map.set(a.id, (map.get(a.id) || 0) + 1));
    return map;
}

function multisetEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const [key, count] of a) {
        if (b.get(key) !== count) return false;
    }
    return true;
}

// --- Property ---------------------------------------------------------------

describe('Property 9 — buildGroupBoardSections đặt "Chưa phân loại" ở cuối (Requirements 6.9, 6.10)', () => {
    it('section cuối là "Chưa phân loại", đúng thứ tự danh mục, phân loại đúng, union bảo toàn', () => {
        fc.assert(
            fc.property(accountsArb, categoriesArb, (accounts, categories) => {
                const sections = buildGroupBoardSections(accounts, categories);

                // (1) Luôn có ít nhất section "Chưa phân loại".
                expect(Array.isArray(sections)).toBe(true);
                expect(sections.length).toBeGreaterThanOrEqual(1);

                // (2) Section CUỐI luôn là "Chưa phân loại": id === null, name đúng.
                const last = sections[sections.length - 1];
                expect(last.id).toBeNull();
                expect(last.name).toBe('Chưa phân loại');

                // (3) Có đúng (số danh mục) section danh mục + 1 section cuối.
                const categorySections = sections.slice(0, -1);
                expect(categorySections.length).toBe(categories.length);

                // (4) Thứ tự các section danh mục theo `order` tăng dần.
                const actualIdOrder = categorySections.map(s => s.id);
                expect(actualIdOrder).toEqual(expectedCategoryIdOrder(categories));

                // (5) Tập id danh mục hợp lệ (đã chuẩn hoá) để phân loại account.
                const knownIds = new Set(categories.map(c => normalizeGroupCategoryId(c.id)));

                // (6) Kiểm từng account nằm đúng section theo hợp đồng.
                accounts.forEach(acc => {
                    const catId = normalizeGroupCategoryId(acc.groupCategoryId);
                    const belongsToCategory = Boolean(catId) && knownIds.has(catId);

                    // Tìm section thực chứa account này (so theo id account, uuid duy nhất).
                    const containing = sections.filter(s => s.accounts.some(a => a.id === acc.id));
                    // Account xuất hiện ở đúng một section.
                    expect(containing.length).toBe(1);

                    if (belongsToCategory) {
                        // Nằm trong section danh mục có id (chuẩn hoá) khớp.
                        expect(normalizeGroupCategoryId(containing[0].id)).toBe(catId);
                        // Và KHÔNG nằm ở section cuối.
                        expect(containing[0]).not.toBe(last);
                    } else {
                        // Chưa phân loại (null/''/id lạ) => nằm ở section cuối.
                        expect(containing[0]).toBe(last);
                    }
                });

                // (7) Union tài khoản mọi section === đúng tập account đầu vào.
                const unionAccounts = sections.flatMap(s => s.accounts);
                expect(unionAccounts.length).toBe(accounts.length);
                expect(multisetEqual(idMultiset(unionAccounts), idMultiset(accounts))).toBe(true);
            }),
            { numRuns: 300 },
        );
    });

    it('categories rỗng => đúng 1 section "Chưa phân loại" chứa toàn bộ account', () => {
        fc.assert(
            fc.property(accountsArb, (accounts) => {
                const sections = buildGroupBoardSections(accounts, []);

                // Chỉ có duy nhất một section.
                expect(sections.length).toBe(1);
                const only = sections[0];
                expect(only.id).toBeNull();
                expect(only.name).toBe('Chưa phân loại');

                // Chứa toàn bộ account (union bảo toàn, không mất/không nhân bản).
                expect(only.accounts.length).toBe(accounts.length);
                expect(multisetEqual(idMultiset(only.accounts), idMultiset(accounts))).toBe(true);
            }),
            { numRuns: 200 },
        );
    });
});
