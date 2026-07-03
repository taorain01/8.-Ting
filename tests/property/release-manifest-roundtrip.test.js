// ============================================================================
// Property test cho Update_Core.parseReleaseManifest (`js/shared/update-core.js`).
//
// Feature: auto-update-system, Property 9: Round-trip và kiểm tra schema của
// Release_Manifest — với bất kỳ ReleaseManifest hợp lệ được sinh ngẫu nhiên,
// parseReleaseManifest(serialize(manifest)) trả về ok = true và bảo toàn toàn
// bộ trường (latestVersion, versionCode, releaseNotes, apkUrl, apkSize,
// apkSha256, minSupportedVersion); ngược lại, với bất kỳ đối tượng thiếu MỘT
// trường bắt buộc nào, parseReleaseManifest trả về ok = false.
//
// Validates: Requirements 4.2, 8.3, 8.4
// ============================================================================

const fc = require('fast-check');
const UpdateCore = require('../../js/shared/update-core.js');

// --- Generators nền -------------------------------------------------------

/** Danh sách 7 trường bắt buộc của Release_Manifest (giữ đúng thứ tự schema). */
const REQUIRED_KEYS = [
  'latestVersion',
  'versionCode',
  'releaseNotes',
  'apkUrl',
  'apkSize',
  'apkSha256',
  'minSupportedVersion',
];

/**
 * Sinh một ReleaseManifest HỢP LỆ với đúng kiểu cho từng trường:
 *   - latestVersion:       string
 *   - versionCode:         number (nguyên hữu hạn)
 *   - releaseNotes:        string
 *   - apkUrl:              string
 *   - apkSize:             number (nguyên hữu hạn)
 *   - apkSha256:           string
 *   - minSupportedVersion: number (nguyên hữu hạn)
 */
const validManifestArb = fc.record({
  latestVersion: fc.string(),
  versionCode: fc.integer({ min: 0, max: 1_000_000 }),
  releaseNotes: fc.string(),
  apkUrl: fc.string(),
  apkSize: fc.integer({ min: 0, max: 5_000_000_000 }),
  apkSha256: fc.hexaString({ minLength: 64, maxLength: 64 }),
  minSupportedVersion: fc.integer({ min: 0, max: 1_000_000 }),
});

// --- Property 9a: round-trip bảo toàn toàn bộ 7 trường -------------------

describe('Update_Core.parseReleaseManifest — Property 9', () => {
  it('ReleaseManifest hợp lệ ⇒ ok=true và BẢO TOÀN cả 7 trường (round-trip)', () => {
    fc.assert(
      fc.property(validManifestArb, (manifest) => {
        const result = UpdateCore.parseReleaseManifest(JSON.stringify(manifest));

        expect(result.ok).toBe(true);
        expect(result.manifest).toBeDefined();

        // Bảo toàn giá trị (và kiểu) của TẤT CẢ trường bắt buộc.
        for (const key of REQUIRED_KEYS) {
          expect(result.manifest[key]).toBe(manifest[key]);
        }

        // Manifest chuẩn hoá chỉ gồm đúng 7 trường bắt buộc.
        expect(Object.keys(result.manifest).sort()).toEqual([...REQUIRED_KEYS].sort());
      }),
      { numRuns: 100 },
    );
  });

  it('chấp nhận cả object đã phân tích sẵn (không chỉ chuỗi JSON) ⇒ ok=true', () => {
    fc.assert(
      fc.property(validManifestArb, (manifest) => {
        const result = UpdateCore.parseReleaseManifest(manifest);
        expect(result.ok).toBe(true);
        for (const key of REQUIRED_KEYS) {
          expect(result.manifest[key]).toBe(manifest[key]);
        }
      }),
      { numRuns: 100 },
    );
  });

  // --- Property 9b: thiếu MỘT trường bắt buộc ⇒ ok=false -----------------

  it('thiếu bất kỳ MỘT trường bắt buộc nào ⇒ ok=false', () => {
    // Sinh manifest hợp lệ kèm chỉ số của trường sẽ bị xoá.
    const missingFieldArb = validManifestArb.chain((manifest) =>
      fc.integer({ min: 0, max: REQUIRED_KEYS.length - 1 }).map((idx) => ({
        manifest,
        keyToRemove: REQUIRED_KEYS[idx],
      })),
    );

    fc.assert(
      fc.property(missingFieldArb, ({ manifest, keyToRemove }) => {
        const variant = { ...manifest };
        delete variant[keyToRemove];

        const result = UpdateCore.parseReleaseManifest(JSON.stringify(variant));
        expect(result.ok).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
