// ============================================================================
// Property test cho Update_Core.verifyArtifactIntegrity (`js/shared/update-core.js`).
//
// Feature: auto-update-system, Property 10: Xác minh tính toàn vẹn artifact
// chính xác — với bất kỳ cặp giá trị `actual` và `expected` gồm `size` và
// `sha256`, `verifyArtifactIntegrity(actual, expected)` trả về `true` KHI VÀ
// CHỈ KHI cả `size` lẫn `sha256` khớp nhau; mọi khác biệt ở bất kỳ trường nào
// đều cho `false`. So sánh `sha256` không phân biệt hoa/thường (và bỏ khoảng
// trắng đầu/cuối).
//
// Validates: Requirements 6.4, 9.4
// ============================================================================

const fc = require('fast-check');
const UpdateCore = require('../../js/shared/update-core.js');

// --- Generators nền -------------------------------------------------------

/** Kích thước file hợp lệ (byte), bao phủ cả file nhỏ lẫn artifact lớn. */
const sizeArb = fc.integer({ min: 0, max: 5_000_000_000 });

/** Mã băm sha256 dạng hex 64 ký tự (chữ thường) — độ dài thực tế của SHA-256. */
const hashArb = fc.hexaString({ minLength: 64, maxLength: 64 });

/**
 * Sinh một BIẾN THỂ tương đương của cùng một mã băm: đổi ngẫu nhiên hoa/thường
 * và thêm khoảng trắng đầu/cuối. `verifyArtifactIntegrity` phải coi các biến thể
 * này là KHỚP (không phân biệt hoa/thường + trim).
 */
const equivalentHashArb = (hash) =>
  fc
    .tuple(
      fc.boolean(), // có viết hoa toàn bộ không
      fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { maxLength: 3 }), // đệm trái
      fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { maxLength: 3 }), // đệm phải
    )
    .map(([upper, left, right]) => {
      const core = upper ? hash.toUpperCase() : hash;
      return left + core + right;
    });

// --- Property 10: iff cả size lẫn sha256 khớp ----------------------------

describe('Update_Core.verifyArtifactIntegrity — Property 10', () => {
  it('KHỚP HOÀN TOÀN (kể cả khác hoa/thường và khoảng trắng) ⇒ true', () => {
    // Sinh cặp (hash gốc, biến thể tương đương của chính nó) trong cùng một
    // generator để tránh lồng fc.assert.
    const matchingPairArb = hashArb.chain((hash) =>
      equivalentHashArb(hash).map((expectedHash) => ({ hash, expectedHash })),
    );

    fc.assert(
      fc.property(sizeArb, matchingPairArb, (size, { hash, expectedHash }) => {
        const actual = { size, sha256: hash };
        const expected = { size, sha256: expectedHash };
        expect(UpdateCore.verifyArtifactIntegrity(actual, expected)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('LỆCH size (sha256 khớp) ⇒ false', () => {
    fc.assert(
      fc.property(
        sizeArb,
        fc.integer({ min: 1, max: 1_000_000 }),
        hashArb,
        (size, delta, hash) => {
          const actual = { size, sha256: hash };
          const expected = { size: size + delta, sha256: hash.toUpperCase() };
          expect(UpdateCore.verifyArtifactIntegrity(actual, expected)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('LỆCH sha256 (size khớp) ⇒ false', () => {
    fc.assert(
      fc.property(
        sizeArb,
        hashArb,
        hashArb,
        (size, hashA, hashB) => {
          fc.pre(hashA.toLowerCase() !== hashB.toLowerCase());
          const actual = { size, sha256: hashA };
          const expected = { size, sha256: hashB };
          expect(UpdateCore.verifyArtifactIntegrity(actual, expected)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('LỆCH CẢ HAI trường ⇒ false', () => {
    fc.assert(
      fc.property(
        sizeArb,
        fc.integer({ min: 1, max: 1_000_000 }),
        hashArb,
        hashArb,
        (size, delta, hashA, hashB) => {
          fc.pre(hashA.toLowerCase() !== hashB.toLowerCase());
          const actual = { size, sha256: hashA };
          const expected = { size: size + delta, sha256: hashB };
          expect(UpdateCore.verifyArtifactIntegrity(actual, expected)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('tương đương logic: true KHI VÀ CHỈ KHI size khớp VÀ sha256 (chuẩn hoá) khớp', () => {
    fc.assert(
      fc.property(sizeArb, sizeArb, hashArb, hashArb, (sizeA, sizeB, hashA, hashB) => {
        const actual = { size: sizeA, sha256: hashA };
        const expected = { size: sizeB, sha256: hashB };

        const expectedResult =
          sizeA === sizeB && hashA.trim().toLowerCase() === hashB.trim().toLowerCase();

        expect(UpdateCore.verifyArtifactIntegrity(actual, expected)).toBe(expectedResult);
      }),
      { numRuns: 100 },
    );
  });
});
