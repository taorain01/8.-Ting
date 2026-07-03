// ============================================================================
// Property test cho Update_Core.appendUpdateLogEntry (`js/shared/update-core.js`).
//
// Feature: auto-update-system, Property 8: Nhật ký cập nhật giữ tối đa 10 mục,
// mới nhất ở đầu — với danh sách nhật ký ban đầu và bất kỳ chuỗi mục thêm vào
// nào, sau mỗi lần `appendUpdateLogEntry`, độ dài danh sách luôn <= 10 và phần
// tử ở đầu danh sách chính là mục vừa được thêm gần nhất.
//
// Validates: Requirements 6.5
// ============================================================================

const fc = require('fast-check');
const UpdateCore = require('../../js/shared/update-core.js');

const MAX = UpdateCore.MAX_UPDATE_LOG_ENTRIES; // = 10

/**
 * Generator cho một mục nhật ký (UpdateLogEntry). Dùng object có các trường
 * đại diện + một id duy nhất để dễ khẳng định "phần tử đầu là mục vừa thêm".
 */
const logEntryArb = fc.record({
  id: fc.integer(),
  date: fc.date().map((d) => d.toISOString()),
  kind: fc.constantFrom('up-to-date', 'update-available', 'error', 'offline'),
  message: fc.string(),
});

/**
 * Generator cho danh sách nhật ký ban đầu. `maxLength` = MAX + 5 để BAO PHỦ
 * cả trường hợp danh sách dài hơn 10 mục ngay từ đầu.
 */
const initialLogArb = fc.array(logEntryArb, { minLength: 0, maxLength: MAX + 5 });

/**
 * Generator cho chuỗi mục sẽ được thêm vào lần lượt. `minLength: 1` để luôn có
 * ít nhất một lần append; `maxLength` đủ lớn để vượt ngưỡng 10.
 */
const appendSeqArb = fc.array(logEntryArb, { minLength: 1, maxLength: MAX + 5 });

describe('Update_Core.appendUpdateLogEntry — Property 8', () => {
  it('sau mỗi lần append: độ dài <= 10 và phần tử đầu là mục vừa thêm', () => {
    fc.assert(
      fc.property(initialLogArb, appendSeqArb, (initialLog, entries) => {
        let log = initialLog;
        for (const entry of entries) {
          log = UpdateCore.appendUpdateLogEntry(log, entry);

          // Bất biến 1: không bao giờ vượt quá tối đa 10 mục.
          expect(log.length).toBeLessThanOrEqual(MAX);

          // Bất biến 2: phần tử ở đầu chính là mục vừa thêm gần nhất.
          expect(log[0]).toBe(entry);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('không làm thay đổi (mutate) mảng nhật ký đầu vào', () => {
    fc.assert(
      fc.property(initialLogArb, logEntryArb, (initialLog, entry) => {
        const snapshot = initialLog.slice();
        UpdateCore.appendUpdateLogEntry(initialLog, entry);
        expect(initialLog).toEqual(snapshot);
      }),
      { numRuns: 100 },
    );
  });
});
