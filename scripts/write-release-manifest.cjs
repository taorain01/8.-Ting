/*
 * ============================================================================
 *  write-release-manifest.cjs — Ghi Release_Manifest (`version.json`)
 * ============================================================================
 *
 * Publish_Workflow — Bước phát hành Android (Task 12.2).
 *
 * Trách nhiệm:
 *   1) Tính APK_Checksum (SHA-256) + kích thước file của artifact APK.
 *   2) Dựng Release_Manifest với ĐỦ 7 trường bắt buộc:
 *        latestVersion, versionCode, releaseNotes, apkUrl, apkSize,
 *        apkSha256, minSupportedVersion.
 *   3) Kiểm tra schema bằng `parseReleaseManifest` của Update_Core dùng chung
 *      (một nguồn sự thật cho schema — tránh phân kỳ với app runtime).
 *   4) Ghi `version.json` ra đĩa để Publish_Workflow upload lên
 *      Releases_Repository (ting-releases, công khai).
 *
 * GUARD artifact thiếu (hook cho Task 12.3): nếu file APK không tồn tại,
 *   {@link writeReleaseManifest} NÉM lỗi `MissingArtifactError` và KHÔNG ghi
 *   `version.json`. Người gọi (workflow) phải dừng và báo cáo artifact thiếu.
 *
 * Bảo mật: module này KHÔNG chứa và KHÔNG cần bất kỳ token/secret nào. Token
 *   GitHub chỉ dùng ở bước upload của workflow (biến môi trường GH_TOKEN).
 *
 * Thiết kế để TÁI DÙNG + TEST được (Task 12.4): mọi bước là hàm thuần/độc lập
 *   được export; phần CLI chỉ chạy khi file được gọi trực tiếp (require.main).
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Nguồn sự thật cho schema Release_Manifest (dùng chung với app runtime).
const UpdateCore = require('../js/shared/update-core.js');

// ---- Lỗi chuyên biệt ------------------------------------------------------

/**
 * Lỗi báo hiệu artifact build cần thiết (APK) bị thiếu. Publish_Workflow phải
 * dừng lại mà KHÔNG sửa `version.json` khi gặp lỗi này (Yêu cầu 8.5).
 */
class MissingArtifactError extends Error {
  /** @param {string} message @param {string} [artifactPath] */
  constructor(message, artifactPath) {
    super(message);
    this.name = 'MissingArtifactError';
    this.artifactPath = artifactPath || null;
  }
}

// ---- Tính toàn vẹn artifact (SHA-256 + kích thước) ------------------------

/**
 * Tính SHA-256 (hex, chữ thường) của một file. Đọc theo luồng để an toàn bộ
 * nhớ với APK lớn.
 *
 * @param {string} filePath  Đường dẫn tuyệt đối/tương đối tới file.
 * @returns {Promise<string>} Mã băm SHA-256 dạng hex chữ thường.
 */
function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Lấy kích thước file (byte).
 *
 * @param {string} filePath  Đường dẫn tới file.
 * @returns {number} Kích thước tính bằng byte.
 */
function getFileSize(filePath) {
  return fs.statSync(filePath).size;
}

/**
 * Tính đồng thời SHA-256 + kích thước của artifact APK.
 *
 * @param {string} apkPath  Đường dẫn tới file APK.
 * @returns {Promise<{ apkSize: number, apkSha256: string }>}
 * @throws {MissingArtifactError} Khi file APK không tồn tại.
 */
async function computeApkStats(apkPath) {
  if (!apkPath || !fs.existsSync(apkPath) || !fs.statSync(apkPath).isFile()) {
    throw new MissingArtifactError(
      `Không tìm thấy artifact APK: ${apkPath}. Dừng phát hành, KHÔNG ghi version.json.`,
      apkPath,
    );
  }
  const apkSize = getFileSize(apkPath);
  const apkSha256 = await computeSha256(apkPath);
  return { apkSize, apkSha256 };
}

// ---- Dựng & xác thực Release_Manifest -------------------------------------

/**
 * Dựng object Release_Manifest đầy đủ 7 trường và XÁC THỰC schema bằng
 * `parseReleaseManifest` dùng chung.
 *
 * @param {{
 *   latestVersion: string,
 *   versionCode: number,
 *   releaseNotes: string,
 *   apkUrl: string,
 *   apkSize: number,
 *   apkSha256: string,
 *   minSupportedVersion: number,
 * }} fields
 * @returns {import('../js/shared/types.js').ReleaseManifest} Manifest đã chuẩn hoá.
 * @throws {Error} Khi manifest không hợp lệ theo schema dùng chung.
 */
function buildReleaseManifest(fields) {
  const manifest = {
    latestVersion: fields.latestVersion,
    versionCode: fields.versionCode,
    releaseNotes: fields.releaseNotes,
    apkUrl: fields.apkUrl,
    apkSize: fields.apkSize,
    apkSha256: fields.apkSha256,
    minSupportedVersion: fields.minSupportedVersion,
  };

  const result = UpdateCore.parseReleaseManifest(manifest);
  if (!result.ok) {
    throw new Error(`Release_Manifest không hợp lệ: ${result.error}`);
  }
  return result.manifest;
}

/**
 * Quy trình đầy đủ: guard artifact → tính SHA-256/kích thước → dựng manifest →
 * xác thực → ghi `version.json`.
 *
 * @param {{
 *   apkPath: string,
 *   outputPath: string,
 *   latestVersion: string,
 *   versionCode: number,
 *   releaseNotes: string,
 *   apkUrl: string,
 *   minSupportedVersion: number,
 * }} options
 * @returns {Promise<{ manifest: import('../js/shared/types.js').ReleaseManifest, outputPath: string }>}
 * @throws {MissingArtifactError} Khi APK thiếu (không ghi version.json).
 * @throws {Error} Khi manifest không hợp lệ (không ghi version.json).
 */
async function writeReleaseManifest(options) {
  const {
    apkPath,
    outputPath,
    latestVersion,
    versionCode,
    releaseNotes,
    apkUrl,
    minSupportedVersion,
  } = options;

  // 1) GUARD: artifact APK phải tồn tại trước khi làm bất cứ điều gì khác.
  const { apkSize, apkSha256 } = await computeApkStats(apkPath);

  // 2) Dựng + xác thực manifest (ném lỗi trước khi ghi nếu không hợp lệ).
  const manifest = buildReleaseManifest({
    latestVersion,
    versionCode,
    releaseNotes,
    apkUrl,
    apkSize,
    apkSha256,
    minSupportedVersion,
  });

  // 3) Ghi version.json (indent 2, kèm newline cuối file).
  const dir = path.dirname(outputPath);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  return { manifest, outputPath };
}

// ---- Trợ giúp cho CLI -----------------------------------------------------

/**
 * Phân tích tham số dòng lệnh dạng `--key value` / `--key=value`.
 * @param {string[]} argv  process.argv.slice(2)
 * @returns {Record<string, string>}
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq !== -1) {
      args[token.slice(2, eq)] = token.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[token.slice(2)] = next;
        i += 1;
      } else {
        args[token.slice(2)] = 'true';
      }
    }
  }
  return args;
}

/**
 * Đọc versionCode/versionName từ `android/app/build.gradle` làm giá trị mặc
 * định khi CLI không truyền tường minh.
 * @param {string} gradlePath
 * @returns {{ versionCode?: number, versionName?: string }}
 */
function readAndroidVersion(gradlePath) {
  const out = {};
  if (!fs.existsSync(gradlePath)) return out;
  const gradle = fs.readFileSync(gradlePath, 'utf8');
  const codeMatch = gradle.match(/versionCode\s+(\d+)/);
  const nameMatch = gradle.match(/versionName\s+"([^"]+)"/);
  if (codeMatch) out.versionCode = Number(codeMatch[1]);
  if (nameMatch) out.versionName = nameMatch[1];
  return out;
}

/**
 * Dựng URL tải APK trỏ tới asset của một GitHub Release trong Releases_Repository.
 * Ví dụ: https://github.com/taorain01/ting-releases/releases/download/v1.4.0/Ting-1.4.0.apk
 * @param {{ repo: string, tag: string, assetName: string }} opts
 * @returns {string}
 */
function buildApkUrl(opts) {
  const { repo, tag, assetName } = opts;
  return `https://github.com/${repo}/releases/download/${tag}/${assetName}`;
}

/**
 * Điểm vào CLI: đọc tham số, dựng manifest, ghi version.json.
 * @param {string[]} argv  process.argv.slice(2)
 * @returns {Promise<void>}
 */
async function main(argv) {
  const args = parseArgs(argv);
  const root = path.resolve(__dirname, '..');

  const gradleDefaults = readAndroidVersion(path.join(root, 'android', 'app', 'build.gradle'));

  const apkPath = path.resolve(root, args.apk || path.join('output', 'Ting-debug.apk'));
  const outputPath = path.resolve(root, args.out || path.join('output', 'version.json'));

  const latestVersion = args['version'] || gradleDefaults.versionName;
  const versionCode = args['version-code'] !== undefined
    ? Number(args['version-code'])
    : gradleDefaults.versionCode;
  const minSupportedVersion = args['min-supported'] !== undefined
    ? Number(args['min-supported'])
    : 1;

  const releasesRepo = args['releases-repo'] || 'taorain01/ting-releases';
  const tag = args['tag'] || (latestVersion ? `v${latestVersion}` : '');
  const assetName = args['asset-name'] || (latestVersion ? `Ting-${latestVersion}.apk` : 'Ting.apk');
  const apkUrl = args['apk-url'] || buildApkUrl({ repo: releasesRepo, tag, assetName });

  // release notes: ưu tiên --notes-file, rồi --notes, cuối cùng là mặc định.
  let releaseNotes = args['notes'];
  if (args['notes-file'] && fs.existsSync(path.resolve(root, args['notes-file']))) {
    releaseNotes = fs.readFileSync(path.resolve(root, args['notes-file']), 'utf8').trim();
  }
  if (!releaseNotes) {
    releaseNotes = `Ting! phiên bản ${latestVersion || ''}`.trim();
  }

  if (!latestVersion || !Number.isFinite(versionCode)) {
    console.error(
      'Thiếu latestVersion/versionCode. Truyền --version và --version-code, ' +
      'hoặc đảm bảo android/app/build.gradle có versionName/versionCode.',
    );
    process.exit(1);
    return;
  }

  try {
    const { manifest } = await writeReleaseManifest({
      apkPath,
      outputPath,
      latestVersion,
      versionCode,
      releaseNotes,
      apkUrl,
      minSupportedVersion,
    });
    console.log(`Đã ghi Release_Manifest: ${outputPath}`);
    console.log(`  latestVersion       = ${manifest.latestVersion}`);
    console.log(`  versionCode         = ${manifest.versionCode}`);
    console.log(`  apkUrl              = ${manifest.apkUrl}`);
    console.log(`  apkSize             = ${manifest.apkSize} byte`);
    console.log(`  apkSha256           = ${manifest.apkSha256}`);
    console.log(`  minSupportedVersion = ${manifest.minSupportedVersion}`);
  } catch (err) {
    if (err instanceof MissingArtifactError) {
      // GUARD (Task 12.3 hook): dừng, KHÔNG ghi version.json, báo cáo rõ ràng.
      console.error(`[ARTIFACT THIẾU] ${err.message}`);
      process.exit(2);
      return;
    }
    console.error(`Lỗi khi ghi Release_Manifest: ${err && err.message ? err.message : err}`);
    process.exit(1);
  }
}

// ---- Xuất API (để tái dùng + test — Task 12.4) ----------------------------

module.exports = {
  MissingArtifactError,
  computeSha256,
  getFileSize,
  computeApkStats,
  buildReleaseManifest,
  writeReleaseManifest,
  parseArgs,
  readAndroidVersion,
  buildApkUrl,
  main,
};

// Chỉ chạy CLI khi được gọi trực tiếp (không chạy khi require trong test).
if (require.main === module) {
  main(process.argv.slice(2));
}
