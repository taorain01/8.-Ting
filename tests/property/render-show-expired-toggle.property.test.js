// ============================================================================
// Property-based test cho renderShowExpiredToggle (js/desktop-ui.js).
//
// Feature: expired-toggle-trash-grouping, Property 10: Biểu diễn nút Hiển thị hết hạn phản ánh đúng trạng thái
//
//   Với mọi giá trị boolean của Trang_Thai_Hien_Het_Han, HTML do
//   renderShowExpiredToggle(type, showExpired) sinh ra phải phản ánh trạng thái
//   quan sát được tương ứng: trạng thái "đang bật" khi cờ BẬT (aria-pressed="true",
//   class `is-on`) và "đang tắt" khi cờ TẮT (aria-pressed="false", không có class
//   `is-on`). Nút luôn có onclick gọi toggleShowExpired('<type>').
//
// Validates: Requirements 3.6
// Thư viện: fast-check + vitest (>= 100 vòng lặp mỗi property).
//
// renderShowExpiredToggle là hàm thuần trả về CHUỖI HTML (không cần DOM). Hàm phụ
// thuộc escapeHtml/escapeJsAttr. Cả hai helper này có sẵn trong js/utils.js, nên ta
// nạp utils.js vào một vm sandbox để có escape helpers, rồi TRÍCH đúng nguồn hàm
// renderShowExpiredToggle từ js/desktop-ui.js và eval nó trong CÙNG sandbox. Cách
// này giữ nguồn chân lý là mã thật trong desktop-ui.js (không nhân bản logic), đồng
// thời tránh phải nạp toàn bộ desktop-ui.js với nhiều phụ thuộc DOM/global.
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fc = require('fast-check');

const UTILS_PATH = path.join(__dirname, '..', '..', 'js', 'utils.js');
const UI_PATH = path.join(__dirname, '..', '..', 'js', 'desktop-ui.js');
const UTILS_SRC = fs.readFileSync(UTILS_PATH, 'utf8');
const UI_SRC = fs.readFileSync(UI_PATH, 'utf8');

// Trích đúng phần mã nguồn của một khai báo `function <name>(...) { ... }` bằng
// cách đếm ngoặc nhọn cân bằng kể từ dấu `{` mở đầu thân hàm. Các template literal
// trong hàm dùng `${...}` có cặp `{`/`}` cân bằng nên phép đếm thô vẫn dừng đúng.
function extractFunctionSource(src, name) {
  const marker = `function ${name}`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`Không tìm thấy hàm ${name} trong nguồn.`);
  const braceStart = src.indexOf('{', start);
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

const RENDER_TOGGLE_SRC = extractFunctionSource(UI_SRC, 'renderShowExpiredToggle');

// Chỉ xuất escape helpers từ utils.js; renderShowExpiredToggle được định nghĩa
// tiếp sau đó trong cùng sandbox nên sẽ thấy escapeHtml/escapeJsAttr là global.
const EXPORT_SNIPPET = `
;${RENDER_TOGGLE_SRC}
;globalThis.__tingToggleExports = { renderShowExpiredToggle };
`;

function loadRenderToggle() {
  const sandbox = {
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
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UTILS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'desktop-ui-toggle.js' });
  return sandbox.__tingToggleExports;
}

const { renderShowExpiredToggle } = loadRenderToggle();

// --- Generators -------------------------------------------------------------

// type ∈ {'bought','personal'} theo đặc tả của tính năng.
const typeArb = fc.constantFrom('bought', 'personal');
// showExpired là boolean bất kỳ.
const showExpiredArb = fc.boolean();

// --- Property ---------------------------------------------------------------

describe('Property 10 — renderShowExpiredToggle phản ánh đúng trạng thái (Requirements 3.6)', () => {
  it('BẬT ⇒ aria-pressed="true" + class is-on; TẮT ⇒ aria-pressed="false" + không có is-on; luôn có onclick toggleShowExpired(type)', () => {
    fc.assert(
      fc.property(typeArb, showExpiredArb, (type, showExpired) => {
        const html = renderShowExpiredToggle(type, showExpired);

        // Luôn là chuỗi HTML của nút toggle.
        expect(typeof html).toBe('string');
        expect(html).toContain('class="show-expired-toggle');

        // onclick luôn gọi toggleShowExpired với đúng type.
        expect(html).toContain(`onclick="toggleShowExpired('${type}')"`);

        if (showExpired) {
          // Trạng thái "đang bật".
          expect(html).toContain('aria-pressed="true"');
          expect(html).not.toContain('aria-pressed="false"');
          expect(html).toContain('is-on');
        } else {
          // Trạng thái "đang tắt".
          expect(html).toContain('aria-pressed="false"');
          expect(html).not.toContain('aria-pressed="true"');
          expect(html).not.toContain('is-on');
        }
      }),
      { numRuns: 200 },
    );
  });

  it('hai trạng thái BẬT/TẮT cho cùng type luôn khác nhau (biểu diễn phân biệt được)', () => {
    fc.assert(
      fc.property(typeArb, (type) => {
        const on = renderShowExpiredToggle(type, true);
        const off = renderShowExpiredToggle(type, false);
        expect(on).not.toBe(off);
      }),
      { numRuns: 100 },
    );
  });
});
