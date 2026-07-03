// Feature: auto-update-system, Property 4: Khoảng cách phiên bản không âm và bằng 0 khi tương đương
// ============================================================================
// Property test cho `versionDistance` (`js/shared/version-compare.js`).
//
// Property 4 (design.md → Correctness Properties):
//   *For any* cặp `installed` và `latest`, `versionDistance(installed, latest)`
//   là số nguyên không âm, và bằng `0` khi và chỉ khi hai phiên bản được coi là
//   tương đương theo tiêu chí tương ứng (đoạn số với desktop, version code với
//   Android) — tức `compareVersions(installed, latest) === 0`.
//
// Validates: Requirements 7.9
// ============================================================================

const fc = require('fast-check');
const VC = require('../../js/shared/version-compare.js');

// ---- Generators ----

// Chế độ desktop: chuỗi phiên bản (1..4 đoạn), có thể kèm tiền tố "v"/"V" và
// metadata build ở đuôi, cùng một ít chuỗi rác (coi như "0.0.0").
const numericVersionStringArb = fc
  .tuple(
    fc.constantFrom('', 'v', 'V'),
    fc.array(fc.nat({ max: 50 }), { minLength: 1, maxLength: 4 }),
    fc.constantFrom('', '-beta.1', '+build.5', '-rc.2'),
  )
  .map(([prefix, segments, suffix]) => prefix + segments.join('.') + suffix);

const garbageVersionArb = fc.constantFrom('', '   ', 'abc', 'v', 'version', '...');

const versionStringArb = fc.oneof(
  { weight: 4, arbitrary: numericVersionStringArb },
  { weight: 1, arbitrary: garbageVersionArb },
);

// Chế độ Android: version code dạng số nguyên không âm.
const versionCodeArb = fc.nat({ max: 1_000_000 });

// Hỗn hợp bao phủ cả hai chế độ (chuỗi desktop lẫn version code số).
const versionInputArb = fc.oneof(
  { weight: 3, arbitrary: versionStringArb },
  { weight: 2, arbitrary: versionCodeArb },
);

describe('Property 4: Khoảng cách phiên bản không âm và bằng 0 khi tương đương', () => {
  it('luôn trả về số nguyên không âm với đầu vào bất kỳ (cả chuỗi lẫn version code)', () => {
    fc.assert(
      fc.property(versionInputArb, versionInputArb, (installed, latest) => {
        const d = VC.versionDistance(installed, latest);
        expect(Number.isInteger(d)).toBe(true);
        expect(d).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 300 },
    );
  });

  it('bằng 0 khi và chỉ khi compareVersions === 0 (chế độ desktop — chuỗi)', () => {
    fc.assert(
      fc.property(versionStringArb, versionStringArb, (installed, latest) => {
        const isZero = VC.versionDistance(installed, latest) === 0;
        const equivalent = VC.compareVersions(installed, latest) === 0;
        expect(isZero).toBe(equivalent);
      }),
      { numRuns: 300 },
    );
  });

  it('bằng 0 khi và chỉ khi compareVersions === 0 (chế độ Android — version code số)', () => {
    fc.assert(
      fc.property(versionCodeArb, versionCodeArb, (installed, latest) => {
        const isZero = VC.versionDistance(installed, latest) === 0;
        const equivalent = VC.compareVersions(installed, latest) === 0;
        expect(isZero).toBe(equivalent);
      }),
      { numRuns: 300 },
    );
  });

  it('bằng 0 khi so với chính nó (tính phản xạ) và đối xứng distance(a,b) === distance(b,a)', () => {
    fc.assert(
      fc.property(versionInputArb, versionInputArb, (installed, latest) => {
        expect(VC.versionDistance(installed, installed)).toBe(0);
        expect(VC.versionDistance(latest, latest)).toBe(0);
        expect(VC.versionDistance(installed, latest)).toBe(
          VC.versionDistance(latest, installed),
        );
      }),
      { numRuns: 300 },
    );
  });
});
