// ============================================================================
// Property-based test cho mountSearchToolbarButtons (js/desktop-ui.js).
//
// Feature: expired-toggle-trash-grouping, Property 9: Hiển thị chấm lọc theo trạng thái bộ lọc
//
//   Với mọi tổ hợp trạng thái bộ lọc, `toolbar-filter-dot` xuất hiện trên
//   `toolbar-filter-btn` khi và chỉ khi hasStatusOrTagFilter, và trên
//   `toolbar-platform-btn` khi và chỉ khi hasPlatformFilter; khi không bộ lọc nào
//   áp dụng thì không nút nào có chấm.
//
// Validates: Requirements 2.5, 2.6, 2.7
// Thư viện: fast-check + vitest (>= 100 vòng lặp mỗi property).
//
// mountSearchToolbarButtons(type, { hasStatusOrTagFilter, hasPlatformFilter }) gán
// HTML vào document.getElementById('search-toolbar-buttons').innerHTML. Hàm không
// phụ thuộc helper nào của utils.js — nó dựng chuỗi HTML trực tiếp bằng template
// literal. Để giữ nguồn chân lý là mã thật trong desktop-ui.js (không nhân bản
// logic) mà không phải nạp toàn bộ file với nhiều phụ thuộc DOM/global, ta TRÍCH
// đúng nguồn hàm bằng cách đếm ngoặc nhọn cân bằng (giống mẫu ở
// render-show-expired-toggle.property.test.js) rồi eval trong một vm sandbox có
// `document` giả lập. `getElementById('search-toolbar-buttons')` trả về một element
// giả có getter/setter `innerHTML`. Sau khi gọi hàm, ta đọc lại innerHTML đã gán và
// kiểm chứng.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

const UI_PATH = path.join(__dirname, '..', '..', 'js', 'desktop-ui.js');
const UI_SRC = fs.readFileSync(UI_PATH, 'utf8');

// Trích đúng phần mã nguồn của một khai báo `function <name>(...) { ... }` bằng
// cách đếm ngoặc nhọn cân bằng kể từ dấu `{` mở đầu thân hàm. Lưu ý: hàm này có
// tham số destructuring `{ ... } = {}`, nên phải bỏ qua danh sách tham số (cân bằng
// ngoặc tròn từ dấu `(` đầu tiên) trước khi tìm ngoặc `{` mở thân hàm — nếu không sẽ
// bắt nhầm ngoặc của destructuring. Các template literal trong thân dùng `${...}` có
// cặp `{`/`}` cân bằng nên phép đếm thô vẫn dừng đúng.
function extractFunctionSource(src, name) {
  const marker = `function ${name}`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`Không tìm thấy hàm ${name} trong nguồn.`);
  // Bỏ qua danh sách tham số: cân bằng ngoặc tròn kể từ dấu `(` đầu tiên.
  const parenStart = src.indexOf('(', start);
  if (parenStart === -1) throw new Error(`Không tìm thấy danh sách tham số của ${name}.`);
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let i = parenStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') {
      parenDepth--;
      if (parenDepth === 0) {
        paramsEnd = i;
        break;
      }
    }
  }
  if (paramsEnd === -1) throw new Error(`Không cân bằng được ngoặc tròn cho ${name}.`);
  const braceStart = src.indexOf('{', paramsEnd);
  if (braceStart === -1) throw new Error(`Không tìm thấy thân hàm ${name}.`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(start, i + 1);
      }
    }
  }
  throw new Error(`Không cân bằng được ngoặc cho hàm ${name}.`);
}

const MOUNT_SRC = extractFunctionSource(UI_SRC, 'mountSearchToolbarButtons');

const EXPORT_SNIPPET = `
;${MOUNT_SRC}
;globalThis.__tingMountExports = { mountSearchToolbarButtons };
`;

// Nạp mountSearchToolbarButtons trong vm sandbox có `document` giả lập. Element giả
// lưu innerHTML nội bộ để đọc lại sau khi hàm gán. getElementById chỉ trả về element
// khi đúng id 'search-toolbar-buttons', giống DOM thật.
function loadMount() {
  const fakeElement = {
    _innerHTML: '',
    set innerHTML(v) {
      this._innerHTML = String(v);
    },
    get innerHTML() {
      return this._innerHTML;
    },
  };
  const fakeDocument = {
    getElementById(id) {
      return id === 'search-toolbar-buttons' ? fakeElement : null;
    },
  };
  const sandbox = {
    console,
    document: fakeDocument,
    String,
    Boolean,
    Object,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(EXPORT_SNIPPET, sandbox, { filename: 'desktop-ui-mount.js' });
  return { mountSearchToolbarButtons: sandbox.__tingMountExports.mountSearchToolbarButtons, fakeElement };
}

const { mountSearchToolbarButtons, fakeElement } = loadMount();

// Tách chuỗi innerHTML thành phần HTML thuộc nút Lọc (toolbar-filter-btn) và phần
// HTML thuộc nút Lọc nền tảng (toolbar-platform-btn). Hai nút là hai phần tử
// <button> liên tiếp; ta cắt tại điểm bắt đầu của nút platform. Phần trước điểm cắt
// chứa toàn bộ nội dung nút filter (kể cả chấm bên trong nó), phần từ điểm cắt trở đi
// chứa toàn bộ nội dung nút platform.
function splitButtonSections(html) {
  const platformIdx = html.indexOf('toolbar-platform-btn');
  expect(platformIdx).toBeGreaterThan(-1);
  const filterIdx = html.indexOf('toolbar-filter-btn');
  expect(filterIdx).toBeGreaterThan(-1);
  // Điểm cắt: mốc bắt đầu thẻ <button ...> của nút platform. Lùi về dấu '<' gần
  // nhất trước 'toolbar-platform-btn' để không cắt lẫn thuộc tính.
  const cut = html.lastIndexOf('<button', platformIdx);
  expect(cut).toBeGreaterThan(-1);
  return {
    filterSection: html.slice(0, cut),
    platformSection: html.slice(cut),
  };
}

const DOT = 'toolbar-filter-dot';

// --- Generators -------------------------------------------------------------

const typeArb = fc.constantFrom('bought', 'personal');
const boolArb = fc.boolean();

// --- Property ---------------------------------------------------------------

describe('Property 9 — chấm lọc hiển thị theo đúng trạng thái bộ lọc (Requirements 2.5, 2.6, 2.7)', () => {
  it('dot trên filter-btn ⇔ hasStatusOrTagFilter; dot trên platform-btn ⇔ hasPlatformFilter; không cờ nào ⇒ không dot', () => {
    fc.assert(
      fc.property(typeArb, boolArb, boolArb, (type, hasStatusOrTagFilter, hasPlatformFilter) => {
        mountSearchToolbarButtons(type, { hasStatusOrTagFilter, hasPlatformFilter });
        const html = fakeElement.innerHTML;

        // innerHTML luôn chứa cả hai nút.
        expect(html).toContain('toolbar-filter-btn');
        expect(html).toContain('toolbar-platform-btn');

        const { filterSection, platformSection } = splitButtonSections(html);

        // Chấm trên nút Lọc ⇔ có bộ lọc trạng thái/thẻ (2.5, 2.7).
        expect(filterSection.includes(DOT)).toBe(hasStatusOrTagFilter);
        // Chấm trên nút Lọc nền tảng ⇔ có bộ lọc nền tảng (2.6, 2.7).
        expect(platformSection.includes(DOT)).toBe(hasPlatformFilter);

        // Tổng số chấm = số cờ đang bật (không dư/không thiếu).
        const dotCount = html.split(DOT).length - 1;
        expect(dotCount).toBe((hasStatusOrTagFilter ? 1 : 0) + (hasPlatformFilter ? 1 : 0));

        // Không cờ nào ⇒ không có chấm ở bất kỳ đâu (2.7).
        if (!hasStatusOrTagFilter && !hasPlatformFilter) {
          expect(html.includes(DOT)).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });
});
