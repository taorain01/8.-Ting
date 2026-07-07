// ============================================================================
// Property-based test cho lớp render Chế độ sửa nhanh — hàm
// renderQuickEditSection (`js/desktop-ui.js`).
//
// Feature: quick-edit-account-detail, Property 8: Ô 2FA hiển thị Secret TOTP
// gốc — Với mọi tài khoản có ô 2FA là một Secret TOTP hợp lệ, khi vào Chế độ
// sửa nhanh, giá trị nạp vào ô 2FA phải bằng đúng Secret TOTP gốc chứ không
// phải mã 6 số tức thời được sinh từ secret đó.
//
// Validates: Requirements 2.4
// Thư viện: fast-check (>= 100 vòng lặp mỗi property).
//
// Cách tiếp cận:
//   - Nạp `js/crypto.js`, `js/quick-edit-core.js`, `js/desktop-ui.js` vào một
//     sandbox `vm` dùng chung `window` (theo quy ước export qua window của repo),
//     tiêm `crypto` (Web Crypto của Node) để hàm generateTOTP chạy được.
//   - Thiết lập tối thiểu `window.appState.quickEdit.original.twoFaCode` = Secret
//     TOTP gốc rồi gọi `renderQuickEditSection(acc)` (Auth_Method = email).
//   - Trích value của input `#quick-edit-twoFaCode` từ chuỗi HTML render ra.
//   - Đối chiếu: value phải BẰNG ĐÚNG Secret gốc, và phải KHÁC mã 6 số tức thời
//     sinh từ chính secret đó (dùng generateTOTP của js/crypto.js).
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');
const fc = require('fast-check');

const ROOT = path.join(__dirname, '..', '..');
const CRYPTO_SRC = fs.readFileSync(path.join(ROOT, 'js', 'crypto.js'), 'utf8');
const CORE_SRC = fs.readFileSync(path.join(ROOT, 'js', 'quick-edit-core.js'), 'utf8');
const UI_SRC = fs.readFileSync(path.join(ROOT, 'js', 'desktop-ui.js'), 'utf8');

// --- Helpers dùng trong sandbox --------------------------------------------

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
function escapeJsAttr(value) {
  return escapeHtml(String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

// Document tối giản: renderQuickEditSection chỉ dựng chuỗi HTML, không đụng DOM,
// nhưng desktop-ui.js cần một `document` khi nạp.
function makeElement() {
  return {
    value: '', innerHTML: '', textContent: '', disabled: false,
    style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {}, remove() {}, setAttribute() {}, focus() {},
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
}
function makeDocument() {
  return {
    addEventListener() {}, removeEventListener() {},
    getElementById() { return makeElement(); },
    querySelector() { return makeElement(); },
    querySelectorAll() { return []; },
    createElement() { return makeElement(); },
    body: { style: {}, appendChild() {} },
  };
}

// Nạp 3 file nguồn vào một sandbox dùng chung window, export các hàm cần thiết.
function loadSandbox() {
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON,
    Promise, Error, RegExp, parseInt, parseFloat, isNaN, Uint8Array,
    crypto: webcrypto,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    escapeHtml, escapeJsAttr,
    document: makeDocument(),
  };
  sandbox.window = { appState: {} };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  const exportSnippet = `
    ;globalThis.__qe = {
      renderQuickEditSection: typeof renderQuickEditSection === 'function' ? renderQuickEditSection : undefined,
      generateTOTP: typeof generateTOTP === 'function' ? generateTOTP : undefined,
      isLikelyTotpSecret: typeof isLikelyTotpSecret === 'function' ? isLikelyTotpSecret : undefined,
    };
  `;

  vm.createContext(sandbox);
  vm.runInContext(CRYPTO_SRC + '\n' + CORE_SRC + '\n' + UI_SRC + exportSnippet, sandbox);
  return { sandbox, exports: sandbox.__qe };
}

const { sandbox, exports: qe } = loadSandbox();

// Giải HTML entity cơ bản (đủ cho các ký tự escapeHtml sinh ra).
function unescapeHtml(value) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Đọc value của input #quick-edit-twoFaCode từ chuỗi HTML render ra.
// Base32 không chứa ký tự HTML đặc biệt nên trích bằng regex là an toàn.
function readTwoFaInputValue(html) {
  const match = String(html).match(/id="quick-edit-twoFaCode"\s+value="([^"]*)"/);
  if (!match) return null;
  return unescapeHtml(match[1]);
}

// --- Generators -------------------------------------------------------------

// Ký tự Base32 hợp lệ theo RFC 4648: A-Z và 2-7.
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.split('');
const base32CharArb = fc.constantFrom(...BASE32_ALPHABET);

// Secret TOTP hợp lệ: chuỗi Base32 độ dài 16–128 (phủ nhiều độ dài, cả biên).
const secretArb = fc
  .integer({ min: 16, max: 128 })
  .chain((len) => fc.array(base32CharArb, { minLength: len, maxLength: len }))
  .map((chars) => chars.join(''));

// --- Sanity check hạ tầng ---------------------------------------------------

describe('Thiết lập sandbox render Chế độ sửa nhanh', () => {
  it('nạp được renderQuickEditSection và generateTOTP từ mã nguồn thật', () => {
    expect(typeof qe.renderQuickEditSection).toBe('function');
    expect(typeof qe.generateTOTP).toBe('function');
    expect(typeof qe.isLikelyTotpSecret).toBe('function');
  });
});

// --- Property 8 -------------------------------------------------------------

describe('Property 8 — Ô 2FA hiển thị Secret TOTP gốc (Requirements 2.4)', () => {
  it('nạp đúng Secret TOTP gốc vào ô 2FA, không phải mã 6 số tức thời', async () => {
    await fc.assert(
      fc.asyncProperty(secretArb, fc.integer({ min: 0, max: 2_000_000_000 }), async (secret, epochSec) => {
        // Điều kiện đầu vào: secret phải là Secret TOTP hợp lệ theo hệ thống.
        expect(qe.isLikelyTotpSecret(secret)).toBe(true);

        // Thiết lập tối thiểu trạng thái Chế độ sửa nhanh với Secret TOTP gốc.
        sandbox.window.appState.quickEdit = {
          accId: 'acc-1',
          active: true,
          original: {
            username: 'user@example.com',
            password: 'pw',
            twoFaCode: secret,   // Secret TOTP GỐC (không phải mã 6 số)
            sellerName: '',
            note: '',
          },
        };
        // Tài khoản Auth_Method = email để ô nhập được render đầy đủ.
        const acc = { id: 'acc-1', authMethod: 'email' };

        const html = qe.renderQuickEditSection(acc);
        const loadedValue = readTwoFaInputValue(html);

        // (1) Giá trị nạp vào ô 2FA phải BẰNG ĐÚNG Secret TOTP gốc.
        expect(loadedValue).toBe(secret);

        // (2) Giá trị nạp vào KHÔNG được là mã 6 số tức thời sinh từ secret đó.
        const code = await qe.generateTOTP(secret, { timestamp: epochSec * 1000 });
        // generateTOTP trả mã 6 số (hoặc null nếu secret không giải mã được Base32).
        if (code !== null) {
          expect(/^\d{6}$/.test(code)).toBe(true);
          expect(loadedValue).not.toBe(code);
        }
        // Bất biến bổ sung: Secret gốc không bao giờ là một chuỗi 6 chữ số thuần.
        expect(/^\d{6}$/.test(loadedValue)).toBe(false);
      }),
      { numRuns: 120 },
    );
  });
});
