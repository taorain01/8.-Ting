// Feature: auto-update-system, Property 3: Phân loại trạng thái nhất quán với so sánh phiên bản
// ============================================================================
// Property test cho `classifyUpdateStatus` (`js/shared/version-compare.js`).
//
// Property 3 (design.md → Correctness Properties):
//   *For any* cặp `installed` và `latest` (dạng chuỗi phiên bản HOẶC version
//   code số), `classifyUpdateStatus` trả về `'up-to-date'` khi VÀ CHỈ KHI
//   `compareVersions(installed, latest) >= 0`, và trả về `'update-available'`
//   khi VÀ CHỈ KHI `compareVersions(latest, installed) > 0`.
//
// Validates: Requirements 2.6, 2.7, 4.3, 4.8, 10.2, 10.3
// ============================================================================

const fc = require('fast-check');
const VC = require('../../js/shared/version-compare.js');

// ---- Generators ----

// Chuỗi phiên bản dạng số (desktop): 1..4 đoạn, có thể kèm tiền tố "v"/"V"
// và metadata build ở đuôi. Miền giá trị nhỏ để tăng khả năng trùng/ngang bằng.
const versionStringArb = fc
  .tuple(
    fc.constantFrom('', 'v', 'V'),
    fc.array(fc.nat({ max: 5 }), { minLength: 1, maxLength: 4 }),
    fc.constantFrom('', '-beta.1', '+build.5', '-rc.2'),
  )
  .map(([prefix, segments, suffix]) => prefix + segments.join('.') + suffix);

// Version code dạng số (Android).
const versionCodeArb = fc.nat({ max: 30 });

// Bao phủ CẢ chuỗi phiên bản LẪN version code dạng số.
const versionArb = fc.oneof(
  { weight: 3, arbitrary: versionStringArb },
  { weight: 2, arbitrary: versionCodeArb },
);

describe('Property 3: Phân loại trạng thái nhất quán với so sánh phiên bản', () => {
  it("trả về 'up-to-date' khi và chỉ khi compareVersions(installed, latest) >= 0", () => {
    fc.assert(
      fc.property(versionArb, versionArb, (installed, latest) => {
        const status = VC.classifyUpdateStatus(installed, latest);
        const cmp = VC.compareVersions(installed, latest);

        // Chỉ một trong hai nhãn hợp lệ được trả về.
        expect(['up-to-date', 'update-available']).toContain(status);

        // Tương đương hai chiều (iff): 'up-to-date' ⇔ cmp >= 0.
        expect(status === 'up-to-date').toBe(cmp >= 0);
      }),
      { numRuns: 300 },
    );
  });

  it("trả về 'update-available' khi và chỉ khi compareVersions(latest, installed) > 0", () => {
    fc.assert(
      fc.property(versionArb, versionArb, (installed, latest) => {
        const status = VC.classifyUpdateStatus(installed, latest);
        const cmpReversed = VC.compareVersions(latest, installed);

        // Tương đương hai chiều (iff): 'update-available' ⇔ latest > installed.
        expect(status === 'update-available').toBe(cmpReversed > 0);
      }),
      { numRuns: 300 },
    );
  });

  it('khi hai phiên bản tương đương thì luôn phân loại là up-to-date', () => {
    fc.assert(
      fc.property(versionArb, (version) => {
        // installed === latest ⇒ compareVersions === 0 ⇒ 'up-to-date'.
        expect(VC.classifyUpdateStatus(version, version)).toBe('up-to-date');
      }),
      { numRuns: 300 },
    );
  });
});
