// Feature: auto-update-system, Property 1: Tính đúng đắn và phản đối xứng của Version_Comparator
// ============================================================================
// Property test cho Version_Comparator (`js/shared/version-compare.js`).
//
// Property 1 (design.md → Correctness Properties):
//   *For any* hai chuỗi phiên bản `a` và `b` (bao gồm chuỗi có số đoạn khác
//   nhau và chuỗi không chứa đoạn số hợp lệ), `compareVersions(a, b)` trả về
//   giá trị trong {-1, 0, 1} khớp với so sánh từ điển của các đoạn số đã
//   chuẩn hoá (đoạn thiếu coi là 0, chuỗi không phân tích được coi là
//   "0.0.0"), VÀ luôn thoả compareVersions(a, b) === -compareVersions(b, a).
//
// Validates: Requirements 2.1, 2.3, 2.4, 2.5
// ============================================================================

const fc = require('fast-check');
const VC = require('../../js/shared/version-compare.js');

/**
 * So sánh từ điển ĐỘC LẬP (oracle) trên các đoạn số đã chuẩn hoá.
 * Dùng làm chuẩn tham chiếu để kiểm chứng tính đúng đắn của compareVersions.
 * Đoạn thiếu coi là 0; so sánh tối thiểu 3 đoạn (major.minor.patch).
 */
function expectedCompare(a, b) {
  const segA = VC.normalizeVersion(a).split('.').map((p) => Number.parseInt(p, 10) || 0);
  const segB = VC.normalizeVersion(b).split('.').map((p) => Number.parseInt(p, 10) || 0);
  const length = Math.max(segA.length, segB.length, 3);
  for (let i = 0; i < length; i += 1) {
    const diff = (segA[i] || 0) - (segB[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

// ---- Generators ----

// Chuỗi phiên bản dạng số với SỐ ĐOẠN KHÁC NHAU (1..4 đoạn), có thể kèm
// tiền tố "v"/"V" và metadata build ở đuôi.
const numericVersionArb = fc
  .tuple(
    fc.constantFrom('', 'v', 'V'),
    fc.array(fc.nat({ max: 50 }), { minLength: 1, maxLength: 4 }),
    fc.constantFrom('', '-beta.1', '+build.5', '-rc.2', '+abc'),
  )
  .map(([prefix, segments, suffix]) => prefix + segments.join('.') + suffix);

// Chuỗi rác / không chứa đoạn số phân tích được (coi như "0.0.0").
const garbageVersionArb = fc.constantFrom(
  '',
  '   ',
  'abc',
  'v',
  'version',
  'not.a.version',
  '...',
  'beta',
  'null',
);

// Hỗn hợp: bao phủ cả chuỗi số đoạn khác nhau lẫn chuỗi rác.
const versionArb = fc.oneof(
  { weight: 3, arbitrary: numericVersionArb },
  { weight: 1, arbitrary: garbageVersionArb },
);

describe('Property 1: Tính đúng đắn và phản đối xứng của compareVersions', () => {
  it('trả về giá trị trong {-1, 0, 1} và khớp so sánh từ điển đoạn số đã chuẩn hoá', () => {
    fc.assert(
      fc.property(versionArb, versionArb, (a, b) => {
        const result = VC.compareVersions(a, b);
        expect([-1, 0, 1]).toContain(result);
        expect(result).toBe(expectedCompare(a, b));
      }),
      { numRuns: 300 },
    );
  });

  it('thoả tính phản đối xứng: compareVersions(a, b) === -compareVersions(b, a)', () => {
    fc.assert(
      fc.property(versionArb, versionArb, (a, b) => {
        // Tương đương compareVersions(a, b) === -compareVersions(b, a),
        // viết dưới dạng tổng để tránh nhiễu +0/-0 của Object.is.
        expect(VC.compareVersions(a, b) + VC.compareVersions(b, a)).toBe(0);
      }),
      { numRuns: 300 },
    );
  });
});
