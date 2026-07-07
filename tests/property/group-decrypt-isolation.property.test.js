// ============================================================================
// Property test cho "cô lập lỗi giải mã giữa các Shared_Account"
// (task 6.4 — spec group-tab-redesign).
//
// Feature: group-tab-redesign, Property 5: Cô lập lỗi giải mã giữa các Shared_Account
// Validates: Requirements 4.6
//
// Hợp đồng (Property 5): với mọi danh sách Shared_Account và tập con bất kỳ được
// đánh dấu giải mã thất bại/timeout (decryptFailedSharedAccounts[`${groupId}:${accountId}`]),
// kết quả render mỗi tài khoản là ĐỘC LẬP:
//   - Mọi tài khoản BỊ đánh dấu lỗi -> ở trạng thái ẩn dữ liệu nhạy cảm kèm chỉ
//     báo lỗi giải mã (renderSharedAccountCard chứa 'shared-decrypt-error' và
//     KHÔNG chứa vùng dữ liệu đã giải mã).
//   - Mọi tài khoản KHÔNG bị đánh dấu lỗi (đã có dữ liệu giải mã) -> hiển thị
//     dữ liệu đã giải mã bình thường, KHÔNG kèm chỉ báo lỗi.
//   - Lỗi của một tài khoản không làm tài khoản khác đổi trạng thái (render từng
//     thẻ độc lập theo key riêng `${groupId}:${accountId}`).
//
// Cách nạp: renderSharedAccountCard là hàm NỘI BỘ của js/desktop-ui.js (không nằm
// trong export của tests/helpers/ui-loader.cjs) và jsdom KHÔNG có trong
// devDependencies. Bám mẫu tests/unit/group-quiet-render-state.test.js: nạp
// js/desktop-ui.js trong sandbox vm với document/window giả lập nhẹ, rồi chèn
// snippet export renderSharedAccountCard; stub các phụ thuộc bằng phép gán sau khi
// nạp (function declaration top-level tạo binding trên global object nên gán đè
// được, giống cách test quiet render đè renderGroupBoard...).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');
// describe/it/expect dùng ở dạng biến toàn cục của Vitest (globals bật sẵn).

const ROOT = path.join(__dirname, '..', '..');
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
// Nạp js/desktop-ui.js trong vm với document/window giả lập tối thiểu và export
// renderSharedAccountCard. Sau đó stub toàn bộ phụ thuộc của thẻ bằng phép gán.
// ----------------------------------------------------------------------------
function loadCardUi() {
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON,
    Promise, Error, RegExp, parseInt, parseFloat, isNaN,
    escapeHtml, escapeJsAttr,
    // document giả lập tối thiểu (renderSharedAccountCard không đụng DOM thật).
    document: {
      addEventListener() {}, removeEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; }, querySelectorAll() { return []; },
      createElement() { return {}; },
      body: {},
    },
  };
  sandbox.window = { appState: {} };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  const snippet = `
    ;globalThis.__cardExports = {
      renderSharedAccountCard: typeof renderSharedAccountCard === 'function' ? renderSharedAccountCard : undefined,
    };
  `;
  vm.runInContext(UI_SRC + snippet, sandbox);

  // --- Stub phụ thuộc của renderSharedAccountCard (đè sau khi nạp) ----------
  // Coi như nhóm đã mở khoá để tách nhánh "lỗi" vs "hiện dữ liệu".
  sandbox.isGroupUnlocked = () => true;
  sandbox.getGroupAccountCategories = () => [];
  sandbox.getSharedEditRequestsForAccount = () => [];
  sandbox.canManageSharedAccountForUi = () => false;
  sandbox.renderSharedAccountMeta = () => ({ logoStyle: '', logoMark: '', expiryText: '' });
  sandbox.getGroupAccountTargetId = (groupId, accountId) => `group-account-${groupId}-${accountId}`;
  sandbox.getStatusBadgeClass = () => 'badge-neutral';
  sandbox.getStatusText = () => 'Đang hoạt động';
  // Ẩn Category_Dropdown để giữ HTML gọn, không ảnh hưởng nhánh lỗi/hiện.
  sandbox.renderGroupAccountCategorySelect = () => '';
  // No-op: không kích hoạt giải mã thật (chỉ chạy khi unlocked && !decrypted && !failed).
  sandbox.decryptSharedAccountForDisplay = () => Promise.resolve();
  // Vùng dữ liệu đã giải mã: in marker riêng theo account để phát hiện rò rỉ chéo.
  // Bọc trong wrapper 'shared-secret-rows' — chuỗi này KHÔNG thể sinh ra từ tên/
  // username của người dùng vì các giá trị đó đã qua escapeHtml (dấu " -> &quot;).
  sandbox.renderSharedSecretRows = (group, account, decrypted) =>
    `<div class="shared-secret-rows">${escapeHtml(decrypted && decrypted.__marker)}</div>`;

  return { sandbox, exports: sandbox.__cardExports };
}

// Marker dữ liệu đã giải mã cho một account (chứa id duy nhất để bắt rò rỉ chéo).
// Có dấu kết thúc '::' để marker của id này KHÔNG là tiền tố (substring) của id khác
// (vd tránh 'SECRET::acc-1' lọt vào 'SECRET::acc-10').
function secretMarker(accountId) {
  return `SECRET::${accountId}::`;
}

describe('cô lập lỗi giải mã giữa các Shared_Account (task 6.4, Property 5)', () => {
  it('nạp được renderSharedAccountCard từ desktop-ui.js', () => {
    const { exports } = loadCardUi();
    expect(typeof exports.renderSharedAccountCard).toBe('function');
  });

  // Property 5 — Validates: Requirements 4.6
  it('render mỗi tài khoản độc lập: account lỗi ẩn dữ liệu + báo lỗi, account không lỗi vẫn hiện dữ liệu', () => {
    const { sandbox, exports } = loadCardUi();
    const renderSharedAccountCard = exports.renderSharedAccountCard;
    const groupId = 'g1';
    const group = { id: groupId, name: 'Nhóm A', role: 'owner' };

    fc.assert(
      fc.property(
        // Danh sách account: mỗi phần tử có cờ lỗi + phần nội dung ngẫu nhiên.
        fc.array(
          fc.record({
            failed: fc.boolean(),
            name: fc.string({ maxLength: 24 }),
            user: fc.string({ maxLength: 24 }),
          }),
          { minLength: 1, maxLength: 12 },
        ),
        (specs) => {
          // Gán id duy nhất theo chỉ số để đảm bảo key `${groupId}:${accountId}` không trùng.
          const accounts = specs.map((spec, i) => ({
            id: `acc-${i}`,
            name: spec.name,
            displayUsername: spec.user,
            groupCategoryId: null,
            status: 'active',
            failed: spec.failed,
          }));

          // Dựng appState mới cho mỗi lần chạy: account KHÔNG lỗi có dữ liệu giải mã,
          // account lỗi được đánh dấu trong decryptFailedSharedAccounts.
          const decryptedSharedAccounts = {};
          const decryptFailedSharedAccounts = {};
          for (const acc of accounts) {
            const key = `${groupId}:${acc.id}`;
            if (acc.failed) {
              decryptFailedSharedAccounts[key] = true;
            } else {
              decryptedSharedAccounts[key] = { __marker: secretMarker(acc.id) };
            }
          }
          sandbox.window.appState = {
            groupUnlocked: { [groupId]: 'pw' },
            decryptedSharedAccounts,
            decryptFailedSharedAccounts,
            decryptingSharedAccounts: {},
            user: { uid: 'u-owner', email: 'owner@example.com' },
          };

          // Render TẤT CẢ thẻ từ cùng một appState (chia sẻ trạng thái) để kiểm cô lập.
          const htmlByAccount = accounts.map(acc => ({
            acc,
            html: renderSharedAccountCard(group, acc),
          }));

          for (const { acc, html } of htmlByAccount) {
            const ownMarker = secretMarker(acc.id);
            if (acc.failed) {
              // Account lỗi: có chỉ báo lỗi giải mã, KHÔNG có vùng dữ liệu đã giải mã,
              // và không rò rỉ marker của bất kỳ account nào.
              expect(html).toContain('shared-decrypt-error');
              expect(html).not.toContain('class="shared-secret-rows"');
              expect(html).not.toContain('SECRET::');
            } else {
              // Account không lỗi: hiện đúng dữ liệu đã giải mã của CHÍNH nó, không kèm lỗi.
              expect(html).toContain('class="shared-secret-rows"');
              expect(html).toContain(ownMarker);
              expect(html).not.toContain('shared-decrypt-error');
              // Không rò rỉ marker của account khác.
              for (const other of accounts) {
                if (other.id !== acc.id) {
                  expect(html).not.toContain(secretMarker(other.id));
                }
              }
            }
          }

          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  // Kiểm định trực tiếp tính cô lập: một account lỗi nằm cạnh một account không lỗi
  // -> trạng thái mỗi thẻ chỉ phụ thuộc key riêng của nó.
  it('lỗi của một account không làm account khác đổi trạng thái (ví dụ trộn lỗi/không lỗi)', () => {
    const { sandbox, exports } = loadCardUi();
    const renderSharedAccountCard = exports.renderSharedAccountCard;
    const groupId = 'g1';
    const group = { id: groupId, name: 'Nhóm A', role: 'owner' };

    const bad = { id: 'acc-bad', name: 'Tài khoản lỗi', displayUsername: 'u-bad', groupCategoryId: null, status: 'active' };
    const good = { id: 'acc-good', name: 'Tài khoản tốt', displayUsername: 'u-good', groupCategoryId: null, status: 'active' };

    sandbox.window.appState = {
      groupUnlocked: { [groupId]: 'pw' },
      decryptedSharedAccounts: { [`${groupId}:${good.id}`]: { __marker: secretMarker(good.id) } },
      decryptFailedSharedAccounts: { [`${groupId}:${bad.id}`]: true },
      decryptingSharedAccounts: {},
      user: { uid: 'u-owner', email: 'owner@example.com' },
    };

    const badHtml = renderSharedAccountCard(group, bad);
    const goodHtml = renderSharedAccountCard(group, good);

    expect(badHtml).toContain('shared-decrypt-error');
    expect(badHtml).not.toContain('class="shared-secret-rows"');

    expect(goodHtml).toContain('class="shared-secret-rows"');
    expect(goodHtml).toContain(secretMarker(good.id));
    expect(goodHtml).not.toContain('shared-decrypt-error');
  });
});
