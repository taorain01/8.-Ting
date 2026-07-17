// ============================================================================
// Feature: auto-update-system, Task 12.4: Unit test cho guard thiếu artifact
//   của Publish_Workflow (`scripts/write-release-manifest.cjs`).
//
//   Kiểm chứng Yêu cầu 8.5: nếu artifact build cần thiết (APK) bị thiếu khi
//   Publish_Workflow chạy, quy trình PHẢI dừng lại mà KHÔNG sửa Release_Manifest
//   (`version.json`) và báo cáo artifact bị thiếu (ném MissingArtifactError).
//
// Ghi chú: vitest bật `globals: true` nên describe/it/expect/beforeEach/afterEach
//   là biến toàn cục, KHÔNG cần require('vitest').
//
// Validates: Requirements 8.5
// ============================================================================

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const {
  MissingArtifactError,
  computeApkStats,
  writeReleaseManifest,
} = require('../../scripts/write-release-manifest.cjs');

// Thư mục tạm riêng cho mỗi test, dọn sạch sau khi chạy.
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-guard-'));
});

afterEach(() => {
  // Dọn dẹp toàn bộ file/thư mục tạm đã tạo trong test.
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// Tạo một file APK giả (nội dung tuỳ ý) trong thư mục tạm và trả về đường dẫn.
function createFakeApk(contents) {
  const apkPath = path.join(tmpDir, 'Ting-test.apk');
  fs.writeFileSync(apkPath, contents);
  return apkPath;
}

// Bộ tham số hợp lệ dùng chung (không gồm apkPath/outputPath).
function validFields() {
  return {
    latestVersion: '1.4.0',
    versionCode: 1400,
    releaseNotes: 'Ting! phiên bản 1.4.0',
    apkUrl: 'https://github.com/taorain01/ting-releases/releases/download/v1.4.0/Ting-1.4.0.apk',
    minSupportedVersion: 1,
  };
}

describe('computeApkStats: guard artifact thiếu (Yêu cầu 8.5)', () => {
  it('ném MissingArtifactError khi apkPath không tồn tại', async () => {
    const apkPath = path.join(tmpDir, 'khong-ton-tai.apk');
    await expect(computeApkStats(apkPath)).rejects.toBeInstanceOf(MissingArtifactError);
  });

  it('ném MissingArtifactError khi apkPath rỗng/không hợp lệ', async () => {
    await expect(computeApkStats('')).rejects.toBeInstanceOf(MissingArtifactError);
    await expect(computeApkStats(undefined)).rejects.toBeInstanceOf(MissingArtifactError);
  });

  it('ném MissingArtifactError khi apkPath là thư mục (không phải file)', async () => {
    await expect(computeApkStats(tmpDir)).rejects.toBeInstanceOf(MissingArtifactError);
  });

  it('lỗi ném ra mang theo artifactPath để báo cáo', async () => {
    const apkPath = path.join(tmpDir, 'thieu.apk');
    await expect(computeApkStats(apkPath)).rejects.toMatchObject({
      name: 'MissingArtifactError',
      artifactPath: apkPath,
    });
  });

  it('tính đúng apkSize + apkSha256 khi APK tồn tại', async () => {
    const contents = Buffer.from('noi-dung-apk-gia-de-tinh-bam');
    const apkPath = createFakeApk(contents);

    const { apkSize, apkSha256 } = await computeApkStats(apkPath);

    const expectedSha = crypto.createHash('sha256').update(contents).digest('hex');
    expect(apkSize).toBe(contents.length);
    expect(apkSha256).toBe(expectedSha);
  });
});

describe('writeReleaseManifest: dừng và KHÔNG ghi version.json khi thiếu artifact (Yêu cầu 8.5)', () => {
  it('ném MissingArtifactError và KHÔNG tạo version.json khi APK thiếu', async () => {
    const apkPath = path.join(tmpDir, 'khong-ton-tai.apk');
    const outputPath = path.join(tmpDir, 'version.json');

    await expect(
      writeReleaseManifest({ apkPath, outputPath, ...validFields() }),
    ).rejects.toBeInstanceOf(MissingArtifactError);

    // Guard: file version.json KHÔNG được tạo ra.
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('KHÔNG sửa version.json cũ đã tồn tại khi thiếu artifact', async () => {
    const outputPath = path.join(tmpDir, 'version.json');
    const previous = JSON.stringify({ latestVersion: '1.0.0', versionCode: 1000 }, null, 2) + '\n';
    fs.writeFileSync(outputPath, previous, 'utf8');

    const apkPath = path.join(tmpDir, 'khong-ton-tai.apk');

    await expect(
      writeReleaseManifest({ apkPath, outputPath, ...validFields() }),
    ).rejects.toBeInstanceOf(MissingArtifactError);

    // Nội dung version.json cũ phải nguyên vẹn (không bị sửa).
    expect(fs.readFileSync(outputPath, 'utf8')).toBe(previous);
  });
});

describe('writeReleaseManifest: ghi version.json đủ 7 trường khi có APK + đủ tham số (Yêu cầu 8.5)', () => {
  it('ghi version.json với đủ 7 trường và giá trị đúng', async () => {
    const contents = Buffer.from('apk-gia-hop-le-de-ghi-manifest');
    const apkPath = createFakeApk(contents);
    const outputPath = path.join(tmpDir, 'out', 'version.json');
    const fields = validFields();

    const { manifest } = await writeReleaseManifest({ apkPath, outputPath, ...fields });

    // File phải được tạo.
    expect(fs.existsSync(outputPath)).toBe(true);

    const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Đủ 7 trường bắt buộc, không thừa không thiếu.
    expect(Object.keys(written).sort()).toEqual(
      [
        'apkSha256',
        'apkSize',
        'apkUrl',
        'latestVersion',
        'minSupportedVersion',
        'releaseNotes',
        'versionCode',
      ].sort(),
    );

    // Giá trị đúng.
    const expectedSha = crypto.createHash('sha256').update(contents).digest('hex');
    expect(written.latestVersion).toBe(fields.latestVersion);
    expect(written.versionCode).toBe(fields.versionCode);
    expect(written.releaseNotes).toBe(fields.releaseNotes);
    expect(written.apkUrl).toBe(fields.apkUrl);
    expect(written.apkSize).toBe(contents.length);
    expect(written.apkSha256).toBe(expectedSha);
    expect(written.minSupportedVersion).toBe(fields.minSupportedVersion);

    // Manifest trả về khớp với nội dung đã ghi.
    expect(manifest).toMatchObject(written);
  });
});

describe('Android build runner portability', () => {
  it('invokes gradlew through bash on non-Windows runners', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'build-android-debug.cjs'), 'utf8');
    expect(source).toContain("run('bash', ['./gradlew', 'assembleDebug']");
  });
});
