// ============================================================================
// Feature: auto-update-system — Task 13.2
//   SMOKE TEST cho các RÀNG BUỘC BẢO MẬT của Update_System. Đây là kiểm tra
//   cấu hình/bất biến "một lần" (đọc file + assert), KHÔNG phải property test.
//
//   Kiểm chứng:
//     9.1 — App phân phối KHÔNG chứa GitHub token/secret nhúng trong mã nguồn.
//           Quét các file trong bundle (js/**, DongGoi/electron/**, index.html,
//           quick-add.html, firebase-config.js) tìm token GitHub thật và khối
//           private key. PHÂN BIỆT token thật với REGEX LỌC token trong
//           `js/shared/update-core.js` (mẫu lọc không có phần thân dài).
//     9.2 — Releases_Repository chỉ chứa artifact: workflow CI chỉ upload
//           apk/version.json (Android) và .exe/latest.yml (desktop), KHÔNG đẩy
//           mã nguồn (không `git push`, không upload file mã nguồn) lên repo
//           phát hành.
//     9.6 — Không hồi quy Firestore rules + mã hoá client-side AES-256/PBKDF2:
//           `firestore.rules` và `js/crypto.js` vẫn còn các khai báo then chốt
//           (không bị Update_System xoá/sửa).
//     7.3 — Background_Check KHÔNG chặn khởi động: `scheduleBackgroundCheck`
//           trong `js/desktop-app.js` dùng cơ chế không chặn
//           (requestIdleCallback/setTimeout, fire-and-forget, không await), VÀ
//           đo thời gian: kích hoạt kiểm tra nền (dù runCheck rất chậm) trả về
//           gần như tức thì, không chặn luồng gọi.
//
//   Ghi chú: vitest bật `globals: true` nên describe/it/expect là biến toàn
//   cục, KHÔNG require('vitest').
//
// Validates: Requirements 7.3, 9.1, 9.2, 9.6
// ============================================================================

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const { createBackgroundCheckController } = require('../../js/background-check.js');
const UpdateCore = require('../../js/shared/update-core.js');

// Gốc repository (tests/smoke -> lên 2 cấp).
const REPO_ROOT = path.join(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Tiện ích: liệt kê đệ quy các file mã nguồn trong một thư mục theo phần mở rộng.
// ---------------------------------------------------------------------------
function listFilesRecursive(dir, extensions) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full, extensions));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) out.push(full);
    }
  }
  return out;
}

// Danh sách file thuộc BUNDLE app phân phối (theo package.json > build.files:
// index.html, quick-add.html, firebase-config.js, js/**, DongGoi/electron/**).
function collectDistributedBundleFiles() {
  const files = [];
  files.push(...listFilesRecursive(path.join(REPO_ROOT, 'js'), ['.js']));
  files.push(...listFilesRecursive(path.join(REPO_ROOT, 'DongGoi', 'electron'), ['.js', '.cjs', '.mjs']));
  for (const top of ['index.html', 'quick-add.html', 'firebase-config.js']) {
    const p = path.join(REPO_ROOT, top);
    if (fs.existsSync(p)) files.push(p);
  }
  return files;
}

// ---------------------------------------------------------------------------
// Mẫu phát hiện SECRET THẬT (không phải mẫu lọc).
//   - Token GitHub cổ điển: ghp_/gho_/ghs_/ghu_/ghr_ + thân >= 20 ký tự.
//   - Fine-grained PAT: github_pat_ + thân dài.
//   - Khối PEM private key.
// KHÔNG quét Firebase Web apiKey ("AIza...") vì đó là ĐỊNH DANH client CÔNG KHAI,
// không phải secret (Requirement 9.1 chỉ nói về token/API key/secret dùng để
// LẤY BẢN CẬP NHẬT).
// ---------------------------------------------------------------------------
const REAL_SECRET_PATTERNS = [
  { name: 'GitHub token cổ điển (ghp_/gho_/ghs_/ghu_/ghr_)', re: /gh[posur]_[A-Za-z0-9]{20,}/ },
  { name: 'GitHub fine-grained PAT (github_pat_)', re: /github_pat_[A-Za-z0-9_]{20,}/ },
  { name: 'Khối PEM private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

describe('Bảo mật 9.1 — App phân phối không chứa token/secret nhúng', () => {
  const bundleFiles = collectDistributedBundleFiles();

  it('tìm thấy ít nhất một file bundle để quét (bảo vệ khỏi false negative)', () => {
    expect(bundleFiles.length).toBeGreaterThan(0);
  });

  it('bộ phát hiện phân biệt được TOKEN THẬT với MẪU LỌC token', () => {
    // Mẫu lọc trong update-core.js: `gh[opsu]_[A-Za-z0-9_]+` (không có thân thật).
    const filterPatternLiteral = 'gh[opsu]_[A-Za-z0-9_]+';
    const realTokenExample = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';

    const tokenRe = REAL_SECRET_PATTERNS[0].re;
    // Mẫu lọc KHÔNG bị coi là token thật (tránh báo nhầm).
    expect(tokenRe.test(filterPatternLiteral)).toBe(false);
    // Token thật vẫn bị bắt.
    expect(tokenRe.test(realTokenExample)).toBe(true);
  });

  it('không file bundle nào chứa GitHub token/secret thật', () => {
    /** @type {string[]} */
    const violations = [];
    for (const file of bundleFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const { name, re } of REAL_SECRET_PATTERNS) {
        const match = content.match(re);
        if (match) {
          const rel = path.relative(REPO_ROOT, file);
          violations.push(`${rel}: ${name} → "${match[0].slice(0, 12)}..."`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('update-core.js vẫn giữ REGEX LỌC token để làm sạch thông báo lỗi (6.6)', () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, 'js', 'shared', 'update-core.js'), 'utf8');
    // Có mẫu lọc token GitHub (đây là mẫu, không phải token thật).
    expect(src).toMatch(/gh\[opsu\]_\[A-Za-z0-9_\]\+/);
    // Nhưng bản thân file lọc này KHÔNG chứa token thật.
    expect(REAL_SECRET_PATTERNS[0].re.test(src)).toBe(false);
  });
});

describe('Bảo mật 9.2 — Releases_Repository chỉ chứa artifact (không mã nguồn)', () => {
  const androidWfPath = path.join(REPO_ROOT, '.github', 'workflows', 'publish-android.yml');
  const desktopWfPath = path.join(REPO_ROOT, '.github', 'workflows', 'publish-desktop.yml');

  it('tồn tại workflow phát hành Android và desktop', () => {
    expect(fs.existsSync(androidWfPath)).toBe(true);
    expect(fs.existsSync(desktopWfPath)).toBe(true);
  });

  it('workflow Android chỉ upload apk + version.json lên Releases_Repository', () => {
    const wf = fs.readFileSync(androidWfPath, 'utf8');
    // Trỏ tới Releases_Repository công khai.
    expect(wf).toMatch(/RELEASES_REPO:\s*taorain01\/ting-releases/);
    // Upload artifact qua `gh release upload`, gồm APK + version.json.
    expect(wf).toMatch(/gh release upload/);
    expect(wf).toMatch(/version\.json/);
    expect(wf).toMatch(/\.apk|apkPath|assetName/);
    // KHÔNG đẩy mã nguồn lên repo phát hành: không có `git push`.
    expect(wf).not.toMatch(/git\s+push/);
    // KHÔNG upload file mã nguồn (.js/.ts/.java) hay thư mục mã nguồn lên release.
    expect(wf).not.toMatch(/gh release upload[^\n]*\.(js|ts|java|cjs)/);
  });

  it('workflow desktop chỉ phát hành .exe + latest.yml (không mã nguồn)', () => {
    const wf = fs.readFileSync(desktopWfPath, 'utf8');
    // Dùng electron-builder publish (publish:win) — chỉ đẩy installer + latest.yml.
    expect(wf).toMatch(/publish:win/);
    // Artifact chẩn đoán chỉ liệt kê .exe + latest.yml.
    expect(wf).toMatch(/\.exe/);
    expect(wf).toMatch(/latest\.yml/);
    // KHÔNG đẩy mã nguồn.
    expect(wf).not.toMatch(/git\s+push/);
  });
});

describe('Bảo mật 9.6 — Không hồi quy Firestore rules & mã hoá AES-256/PBKDF2', () => {
  it('firestore.rules còn tồn tại và giữ các khai báo bảo mật then chốt', () => {
    const rulesPath = path.join(REPO_ROOT, 'firestore.rules');
    expect(fs.existsSync(rulesPath)).toBe(true);
    const rules = fs.readFileSync(rulesPath, 'utf8');
    expect(rules).toMatch(/service\s+cloud\.firestore/);
    // Chỉ chủ đã xác thực email mới đọc/ghi dữ liệu người dùng.
    expect(rules).toMatch(/function\s+isVerifiedOwner/);
    expect(rules).toMatch(/allow read, write:\s*if isVerifiedOwner\(userId\)/);
    expect(rules).toMatch(/email_verified\s*==\s*true/);
  });

  it('js/crypto.js còn giữ mã hoá client-side AES-256-GCM + PBKDF2', () => {
    const cryptoPath = path.join(REPO_ROOT, 'js', 'crypto.js');
    expect(fs.existsSync(cryptoPath)).toBe(true);
    const src = fs.readFileSync(cryptoPath, 'utf8');
    // Thuật toán mã hoá AES-GCM (256-bit) không bị đổi/xoá.
    expect(src).toMatch(/AES-GCM/);
    // Dẫn xuất khoá bằng PBKDF2 với số vòng lặp mạnh.
    expect(src).toMatch(/PBKDF2/);
    expect(src).toMatch(/deriveKey/);
    expect(src).toMatch(/TING_CRYPTO_ITERATIONS\s*=\s*600000/);
  });
});

describe('Bảo mật 7.3 — Background_Check không chặn khởi động', () => {
  const appPath = path.join(REPO_ROOT, 'js', 'desktop-app.js');
  const appSrc = fs.readFileSync(appPath, 'utf8');

  it('scheduleBackgroundCheck dùng cơ chế không chặn (requestIdleCallback/setTimeout)', () => {
    // Lấy thân hàm scheduleBackgroundCheck để kiểm tra cơ chế lên lịch.
    const idx = appSrc.indexOf('function scheduleBackgroundCheck');
    expect(idx).toBeGreaterThan(-1);
    const body = appSrc.slice(idx, idx + 800);
    // Trì hoãn qua requestIdleCallback (ưu tiên) hoặc setTimeout — không chạy đồng bộ.
    expect(body).toMatch(/requestIdleCallback/);
    expect(body).toMatch(/setTimeout/);
    // Fire-and-forget: gọi runAtStartup không await, nuốt lỗi an toàn.
    expect(body).toMatch(/Promise\.resolve\(\s*controller\.runAtStartup\(\)\s*\)\.catch/);
    expect(body).not.toMatch(/await\s+controller\.runAtStartup/);
  });

  it('luồng khởi động gọi scheduleBackgroundCheck mà KHÔNG await (7.2, 7.3)', () => {
    // Điểm gọi lúc khởi động: `scheduleBackgroundCheck?.();` (không await).
    expect(appSrc).toMatch(/scheduleBackgroundCheck\?\.\(\);/);
    expect(appSrc).not.toMatch(/await\s+scheduleBackgroundCheck/);
  });

  it('kích hoạt kiểm tra nền trả về tức thì dù runCheck rất chậm (không chặn)', async () => {
    // Storage trong bộ nhớ (mô phỏng localStorage Android/web).
    const mem = new Map();
    const storage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
    };

    // runCheck CỐ TÌNH CHẬM (300ms) để mô phỏng I/O mạng khi kiểm tra cập nhật.
    const SLOW_MS = 300;
    let checkResolvedAt = null;
    const controller = createBackgroundCheckController({
      updateCore: UpdateCore,
      storage,
      now: () => Date.now(),
      runCheck: () => new Promise((resolve) => {
        setTimeout(() => {
          checkResolvedAt = performance.now();
          resolve({ status: 'up-to-date', info: null });
        }, SLOW_MS);
      }),
    });

    // Mô phỏng chính xác cách desktop-app.js kích hoạt: fire-and-forget, KHÔNG await.
    let backgroundDone = false;
    const t0 = performance.now();
    const pending = Promise.resolve(controller.runAtStartup())
      .then(() => { backgroundDone = true; })
      .catch(() => {});
    const elapsedToInvoke = performance.now() - t0;

    // Lời gọi kích hoạt trả về gần như tức thì — KHÔNG chặn luồng gọi bởi runCheck.
    expect(elapsedToInvoke).toBeLessThan(SLOW_MS / 2);
    // Tại thời điểm này, kiểm tra nền CHƯA hoàn tất (đang chạy nền).
    expect(backgroundDone).toBe(false);

    // Cuối cùng kiểm tra nền vẫn hoàn tất (chỉ là không chặn khởi động).
    await pending;
    expect(backgroundDone).toBe(true);
    expect(checkResolvedAt).not.toBeNull();
  });
});
