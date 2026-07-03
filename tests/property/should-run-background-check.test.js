// ============================================================================
// Property test cho Update_Core.shouldRunBackgroundCheck (`js/shared/update-core.js`).
//
// Feature: auto-update-system, Property 6: Kiểm soát tần suất Background_Check
// trong 24 giờ — với bất kỳ `lastCheckAt` (epoch ms hoặc `null`), `now`, và cờ
// `enabled`, `shouldRunBackgroundCheck` trả về `true` KHI VÀ CHỈ KHI
// `enabled === true` VÀ (`lastCheckAt === null` HOẶC `now - lastCheckAt >= 24 giờ`);
// mọi trường hợp `enabled === false` luôn trả về `false`.
//
// Validates: Requirements 7.4, 7.5
// ============================================================================

const fc = require('fast-check');
const UpdateCore = require('../../js/shared/update-core.js');

// Khoảng cách tối thiểu giữa hai lần Background_Check: 24 giờ (ms).
const DAY_MS = UpdateCore.BACKGROUND_CHECK_INTERVAL_MS;

// --- Generators nền -------------------------------------------------------

/** Mốc thời điểm hiện tại (epoch ms) hợp lệ, bao phủ dải rộng nhưng an toàn. */
const nowArb = fc.integer({ min: 0, max: 4_000_000_000_000 });

/** Mốc kiểm tra gần nhất: hoặc `null`, hoặc một epoch ms hữu hạn. */
const lastCheckArb = fc.oneof(
  fc.constant(null),
  fc.integer({ min: 0, max: 4_000_000_000_000 }),
);

describe('Update_Core.shouldRunBackgroundCheck — Property 6', () => {
  it('enabled === false ⇒ luôn trả về false (bất kể lastCheckAt/now)', () => {
    fc.assert(
      fc.property(lastCheckArb, nowArb, (lastCheckAt, now) => {
        expect(UpdateCore.shouldRunBackgroundCheck(lastCheckAt, now, false)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('enabled === true VÀ lastCheckAt === null ⇒ luôn trả về true', () => {
    fc.assert(
      fc.property(nowArb, (now) => {
        expect(UpdateCore.shouldRunBackgroundCheck(null, now, true)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('tương đương logic đầy đủ: true ⇔ enabled && (lastCheckAt===null || now-lastCheckAt>=24h)', () => {
    fc.assert(
      fc.property(lastCheckArb, nowArb, fc.boolean(), (lastCheckAt, now, enabled) => {
        const expected =
          enabled === true &&
          (lastCheckAt === null || now - lastCheckAt >= DAY_MS);
        expect(UpdateCore.shouldRunBackgroundCheck(lastCheckAt, now, enabled)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('mốc quanh ngưỡng 24h (dưới/đúng/trên) khi enabled === true', () => {
    // offset là khoảng cách so với ngưỡng 24h: âm=chưa đủ, 0=đúng ngưỡng, dương=vượt.
    const offsetArb = fc.integer({ min: -1_000_000, max: 1_000_000 });

    fc.assert(
      fc.property(
        // Giữ lastCheckAt đủ lớn để now không âm ở nhánh "dưới ngưỡng".
        fc.integer({ min: DAY_MS, max: 2_000_000_000_000 }),
        offsetArb,
        (lastCheckAt, offset) => {
          const now = lastCheckAt + DAY_MS + offset;
          const result = UpdateCore.shouldRunBackgroundCheck(lastCheckAt, now, true);
          // >= 24h ⇒ true; < 24h ⇒ false. offset >= 0 nghĩa là đủ hoặc vượt ngưỡng.
          expect(result).toBe(offset >= 0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
