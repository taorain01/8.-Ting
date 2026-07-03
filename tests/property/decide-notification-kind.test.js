// ============================================================================
// Property test cho Update_Core.decideNotificationKind (`js/shared/update-core.js`).
//
// Feature: auto-update-system, Property 5: Ngưỡng thông báo Background_Check
// theo khoảng cách — với bất kỳ khoảng cách phiên bản `d > 0`,
// `decideNotificationKind(d)` trả về `'toast'` KHI VÀ CHỈ KHI `d <= 3`, và trả
// về `'dialog'` KHI VÀ CHỈ KHI `d > 3`.
//
// Validates: Requirements 7.7, 7.8
// ============================================================================

const fc = require('fast-check');
const UpdateCore = require('../../js/shared/update-core.js');

// Ngưỡng toast/dialog theo thiết kế: distance <= 3 => 'toast', > 3 => 'dialog'.
const TOAST_MAX_DISTANCE = 3;

// --- Generators nền -------------------------------------------------------

/** Khoảng cách "nhỏ": 1..3 — phải cho 'toast'. */
const smallDistanceArb = fc.integer({ min: 1, max: TOAST_MAX_DISTANCE });

/** Khoảng cách "lớn": > 3 — phải cho 'dialog'. */
const largeDistanceArb = fc.integer({ min: TOAST_MAX_DISTANCE + 1, max: 1_000_000 });

/** Bao phủ toàn dải d > 0 (cả nhỏ lẫn lớn) trong một generator. */
const positiveDistanceArb = fc.oneof(smallDistanceArb, largeDistanceArb);

// --- Property 5: ngưỡng toast/dialog theo khoảng cách --------------------

describe('Update_Core.decideNotificationKind — Property 5', () => {
  it("d nhỏ (1..3) ⇒ 'toast'", () => {
    fc.assert(
      fc.property(smallDistanceArb, (d) => {
        expect(UpdateCore.decideNotificationKind(d)).toBe('toast');
      }),
      { numRuns: 100 },
    );
  });

  it("d lớn (> 3) ⇒ 'dialog'", () => {
    fc.assert(
      fc.property(largeDistanceArb, (d) => {
        expect(UpdateCore.decideNotificationKind(d)).toBe('dialog');
      }),
      { numRuns: 100 },
    );
  });

  it("iff: với d > 0, trả 'toast' KHI VÀ CHỈ KHI d <= 3, ngược lại 'dialog'", () => {
    fc.assert(
      fc.property(positiveDistanceArb, (d) => {
        const kind = UpdateCore.decideNotificationKind(d);
        const expected = d <= TOAST_MAX_DISTANCE ? 'toast' : 'dialog';
        expect(kind).toBe(expected);
        // Không bao giờ trả về giá trị ngoài tập {'toast','dialog'}.
        expect(kind === 'toast' || kind === 'dialog').toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
