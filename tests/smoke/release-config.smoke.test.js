// ============================================================================
// Feature: auto-update-system, Task 13.1: Smoke test cho artifact phát hành
//   và cấu hình Android.
//
//   Đây là smoke test cấu hình (chạy một lần): đọc trực tiếp các file cấu hình
//   dự án bằng `fs` và xác nhận chúng khai báo đúng những gì Publish_Workflow
//   và APK_Installer cần để phát hành + cài đặt hoạt động.
//
//   Phạm vi kiểm tra:
//   - Workflow desktop `.github/workflows/publish-desktop.yml` publish `.exe`
//     + `latest.yml` qua electron-builder `--publish always`.        (3.1, 8.1)
//   - Workflow Android `.github/workflows/publish-android.yml` build APK, ghi
//     `version.json`, upload lên Releases_Repository.                (8.2)
//   - `android/app/src/main/AndroidManifest.xml` khai báo quyền
//     `REQUEST_INSTALL_PACKAGES`                                     (5.1)
//     và FileProvider `${applicationId}.fileprovider` + file_paths.  (5.2)
//
//   Ghi chú: vitest bật `globals: true` nên describe/it/expect là biến toàn
//   cục, KHÔNG cần require('vitest').
//
// Validates: Requirements 3.1, 5.1, 5.2, 8.1, 8.2
// ============================================================================

const fs = require('fs');
const path = require('path');

// Thư mục gốc workspace: file test nằm ở tests/smoke/ → lùi 2 cấp.
const ROOT = path.resolve(__dirname, '..', '..');

// Đọc file text theo đường dẫn tương đối so với gốc workspace.
function readRepoFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

describe('Smoke: Publish_Workflow desktop phát hành .exe + latest.yml (3.1, 8.1)', () => {
  const rel = '.github/workflows/publish-desktop.yml';

  it('file workflow desktop tồn tại', () => {
    expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
  });

  it('gọi electron-builder với --publish always (upload artifact khi build)', () => {
    const yml = readRepoFile(rel);
    // Script publish:win trong package.json chạy electron-builder --publish always.
    expect(yml).toContain('npm run publish:win');
  });

  it('lưu/tham chiếu cả .exe và latest.yml làm artifact phát hành', () => {
    const yml = readRepoFile(rel);
    expect(yml).toContain('.exe');
    expect(yml).toContain('latest.yml');
  });

  it('package.json định nghĩa script publish:win chạy electron-builder --publish always', () => {
    const pkg = JSON.parse(readRepoFile('package.json'));
    expect(pkg.scripts).toHaveProperty('publish:win');
    expect(pkg.scripts['publish:win']).toContain('electron-builder');
    expect(pkg.scripts['publish:win']).toContain('--publish always');
  });

  it('package.json cấu hình publish provider github cho nguồn phát hành desktop', () => {
    const pkg = JSON.parse(readRepoFile('package.json'));
    const publish = pkg.build && pkg.build.publish;
    expect(Array.isArray(publish)).toBe(true);
    expect(publish.some((p) => p && p.provider === 'github')).toBe(true);
  });
});

describe('Smoke: Publish_Workflow Android phát hành APK + version.json (8.2)', () => {
  const rel = '.github/workflows/publish-android.yml';

  it('file workflow Android tồn tại', () => {
    expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
  });

  it('build APK qua script android:build:debug', () => {
    const yml = readRepoFile(rel);
    expect(yml).toContain('android:build:debug');
  });

  it('ghi Release_Manifest version.json', () => {
    const yml = readRepoFile(rel);
    expect(yml).toContain('version.json');
    expect(yml).toContain('write-release-manifest.cjs');
  });

  it('upload APK + version.json lên Releases_Repository', () => {
    const yml = readRepoFile(rel);
    // Releases_Repository công khai chứa APK + version.json.
    expect(yml).toContain('taorain01/ting-releases');
    expect(yml).toContain('gh release upload');
    expect(yml).toMatch(/\.apk|apkPath/);
  });
});

describe('Smoke: AndroidManifest khai báo quyền cài đặt và FileProvider (5.1, 5.2)', () => {
  const rel = 'android/app/src/main/AndroidManifest.xml';
  let manifest;

  it('file AndroidManifest.xml tồn tại', () => {
    const exists = fs.existsSync(path.join(ROOT, rel));
    expect(exists).toBe(true);
    manifest = readRepoFile(rel);
  });

  it('khai báo quyền REQUEST_INSTALL_PACKAGES (5.1)', () => {
    manifest = manifest || readRepoFile(rel);
    expect(manifest).toContain('android.permission.REQUEST_INSTALL_PACKAGES');
  });

  it('khai báo FileProvider với authorities ${applicationId}.fileprovider (5.2)', () => {
    manifest = manifest || readRepoFile(rel);
    expect(manifest).toContain('androidx.core.content.FileProvider');
    expect(manifest).toContain('${applicationId}.fileprovider');
    expect(manifest).toContain('android:grantUriPermissions="true"');
  });

  it('FileProvider tham chiếu tài nguyên file_paths (5.2)', () => {
    manifest = manifest || readRepoFile(rel);
    expect(manifest).toContain('@xml/file_paths');
  });

  it('file_paths.xml tồn tại trong res/xml (5.2)', () => {
    const fpRel = 'android/app/src/main/res/xml/file_paths.xml';
    expect(fs.existsSync(path.join(ROOT, fpRel))).toBe(true);
  });
});
