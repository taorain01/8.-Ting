// ============================================================================
// Test BẢO TOÀN (Preservation) — spec bugfix "paste-skip-input-validation".
//
// Property 2: Preservation — Giữ nguyên hành vi cho các đầu vào KHÔNG phải lỗi
// (isBugCondition === false).
//
// Phương pháp observation-first: các assertion dưới đây GHI LẠI hành vi quan sát
// được trên mã CHƯA sửa (`js/utils.js`) cho những đầu vào KHÔNG rơi vào điều kiện
// lỗi. Test này PHẢI PASS trên mã chưa sửa (xác nhận baseline cần bảo toàn), và
// vẫn phải PASS sau khi sửa `handleQuickPasteGuidance` (không gây hồi quy).
//
// Điều kiện lỗi (isBugCondition từ design):
//   pasteHasContent === true
//   AND NOT dateSkipped
//   AND NOT dateGuided
//   AND activeElementId !== 'paste-input'
//
// Các đầu vào KHÔNG phải lỗi được phủ ở đây:
//   - Người dùng còn giữ focus ở `paste-input` (activeElementId === 'paste-input').
//   - Ô `paste-input` trống sau khi trim (pasteHasContent === false).
//
// Các hành vi bảo toàn tương ứng với bugfix.md:
//   3.1 Còn ở `paste-input` + có nội dung  → cuộn/focus tới `add-smart-date`, dateGuided=true.
//   3.3 Ô trống                             → không kích hoạt gợi ý, cờ không đổi.
//   3.2 Chuỗi gợi ý tuần tự                 → date → note → seller → price đúng thứ tự.
//   3.4 Skip qua `add-note`                 → markAddFormDateSkippedIfNeeded đặt dateSkipped=true.
//
// Cách tiếp cận Scoped PBT: dùng DOM mô phỏng có theo dõi `document.activeElement`
// + fake timers; sinh ngẫu nhiên trạng thái { pasteHasContent, dateSkipped,
// dateGuided, activeElementId } và nội dung dán (chuỗi khoảng trắng vs chuỗi có
// ký tự) để phủ logic `trim`.
//
// Validates: Requirements 3.1, 3.2, 3.3, 3.4
// ============================================================================

const fc = require('fast-check');
const { createGuidanceEnv } = require('../helpers/add-form-guidance-dom.cjs');

// Các ô nhập không phải `paste-input` mà focus có thể đang đứng ở đó khi ô dán trống.
const NON_PASTE_IDS = ['add-name', 'add-seller-name', 'add-price', 'add-note'];

// --- Generators -----------------------------------------------------------

/** Nội dung dán KHÔNG rỗng sau khi trim (luôn có ít nhất một ký tự không-khoảng-trắng). */
const contentfulPasteArb = fc
  .tuple(
    fc.string({ maxLength: 6 }),
    fc.constantFrom('a', 'x', '1', '@', 'user@mail.com|pw|2FA', 'Ω', 'tài-khoản'),
    fc.string({ maxLength: 6 }),
  )
  .map(([pre, core, post]) => pre + core + post);

/** Nội dung dán RỖNG sau khi trim (chuỗi rỗng hoặc chỉ gồm khoảng trắng). */
const blankPasteArb = fc.constantFrom('', ' ', '   ', '\t', '\n', '  \t\n ', '\u00a0 ');

/** Nội dung dán bất kỳ (phủ cả hai nhánh của logic trim). */
const anyPasteArb = fc.oneof(contentfulPasteArb, blankPasteArb);

const hasContent = (s) => typeof s === 'string' && s.trim().length > 0;

// --- Helper thiết lập môi trường ------------------------------------------

/** Dựng env sạch và đặt sẵn các cờ guide theo trạng thái sinh ngẫu nhiên. */
function freshEnv({ dateSkipped = false, dateGuided = false } = {}) {
  const env = createGuidanceEnv();
  env.window.resetAddFormGuideState();
  const guide = env.getGuideState();
  guide.dateSkipped = dateSkipped;
  guide.dateGuided = dateGuided;
  return env;
}

// ==========================================================================
// Property 2 — trung tâm: handleQuickPasteGuidance cho đầu vào KHÔNG phải lỗi
// ==========================================================================

describe('Preservation — handleQuickPasteGuidance với đầu vào KHÔNG phải lỗi', () => {
  // 3.1: Người dùng còn giữ focus ở `paste-input` (activeElementId === 'paste-input').
  // Đây luôn là NOT bug (bất kể nội dung/cờ) vì activeElement vẫn là ô dán.
  it('3.1 — còn ở `paste-input`: chỉ gợi ý tới `add-smart-date` khi có nội dung và chưa skip/guided; ngược lại giữ nguyên', () => {
    fc.assert(
      fc.property(anyPasteArb, fc.boolean(), fc.boolean(), (pasteContent, dateSkipped, dateGuided) => {
        const env = freshEnv({ dateSkipped, dateGuided });

        env.elements['paste-input'].value = pasteContent;
        env.setActiveElement('paste-input');

        env.window.handleQuickPasteGuidance();
        // Người dùng KHÔNG chuyển đi đâu — vẫn ở ô dán.
        env.runAllTimers();

        const active = env.getActiveElement();
        const guide = env.getGuideState();
        const shouldGuide = hasContent(pasteContent) && !dateSkipped && !dateGuided;

        if (shouldGuide) {
          // Hành vi bảo toàn: cuộn/focus tới `add-smart-date`, đánh dấu dateGuided.
          expect(active ? active.id : null).toBe('add-smart-date');
          expect(guide.dateGuided).toBe(true);
        } else {
          // Không đủ điều kiện gợi ý (ô trống, hoặc đã skip/guided): return sớm,
          // giữ nguyên focus ở `paste-input` và không đổi cờ.
          expect(active ? active.id : null).toBe('paste-input');
          expect(guide.dateGuided).toBe(dateGuided);
        }
        // dateSkipped không bị hàm này thay đổi trong nhánh "còn ở paste-input".
        expect(guide.dateSkipped).toBe(dateSkipped);
      }),
      { numRuns: 120 },
    );
  });

  // 3.3: Ô `paste-input` trống sau khi trim → NOT bug bất kể focus ở đâu.
  it('3.3 — ô trống: KHÔNG kích hoạt gợi ý nào, focus và cờ giữ nguyên', () => {
    fc.assert(
      fc.property(
        blankPasteArb,
        fc.constantFrom('paste-input', ...NON_PASTE_IDS),
        fc.boolean(),
        fc.boolean(),
        (blankContent, activeId, dateSkipped, dateGuided) => {
          const env = freshEnv({ dateSkipped, dateGuided });

          env.elements['paste-input'].value = blankContent;
          env.setActiveElement(activeId);

          env.window.handleQuickPasteGuidance();
          env.runAllTimers();

          const active = env.getActiveElement();
          const guide = env.getGuideState();

          // Không gợi ý: focus giữ nguyên nơi người dùng đang đứng.
          expect(active ? active.id : null).toBe(activeId);
          // Cờ không đổi.
          expect(guide.dateGuided).toBe(dateGuided);
          expect(guide.dateSkipped).toBe(dateSkipped);
        },
      ),
      { numRuns: 120 },
    );
  });
});

// ==========================================================================
// 3.2 — Chuỗi gợi ý tuần tự: date → note → seller → price
// ==========================================================================

describe('Preservation — chuỗi gợi ý tuần tự (3.2)', () => {
  it('guideAddFormFromDate → guideAddFormFromNote → guideAddFormFromSeller chuyển ô đúng thứ tự', () => {
    fc.assert(
      fc.property(contentfulPasteArb, contentfulPasteArb, (noteText, sellerText) => {
        const env = createGuidanceEnv();
        env.window.resetAddFormGuideState();

        // Các ô sau cần có nội dung thì gợi ý mới đi tiếp (theo logic hiện có).
        env.elements['add-note'].value = noteText;
        env.elements['add-seller-name'].value = sellerText;

        // Bước 1: từ ô "Thời hạn" → gợi ý sang ô ghi chú `add-note`.
        env.window.guideAddFormFromDate();
        env.runAllTimers();
        const afterDate = env.getActiveElement();
        expect(afterDate ? afterDate.id : null).toBe('add-note');
        const guide1 = env.getGuideState();
        expect(guide1.dateTouched).toBe(true);
        expect(guide1.noteGuided).toBe(true);

        // Bước 2: từ ô ghi chú → gợi ý sang ô người bán `add-seller-name`.
        env.window.guideAddFormFromNote();
        env.runAllTimers();
        const afterNote = env.getActiveElement();
        expect(afterNote ? afterNote.id : null).toBe('add-seller-name');
        expect(env.getGuideState().sellerGuided).toBe(true);

        // Bước 3: từ ô người bán → gợi ý sang ô giá `add-price`.
        env.window.guideAddFormFromSeller();
        env.runAllTimers();
        const afterSeller = env.getActiveElement();
        expect(afterSeller ? afterSeller.id : null).toBe('add-price');
      }),
      { numRuns: 60 },
    );
  });
});

// ==========================================================================
// 3.4 — Skip qua `add-note`: markAddFormDateSkippedIfNeeded
// ==========================================================================

describe('Preservation — ghi nhận skip qua `add-note` (3.4)', () => {
  it('markAddFormDateSkippedIfNeeded đặt dateSkipped=true khi chưa touched, giữ nguyên khi đã touched', () => {
    fc.assert(
      fc.property(fc.boolean(), (dateTouched) => {
        const env = createGuidanceEnv();
        env.window.resetAddFormGuideState();
        const guide = env.getGuideState();
        guide.dateTouched = dateTouched;

        // Mô phỏng người dùng focus vào ô ghi chú để bỏ qua bước chọn thời hạn.
        env.elements['add-note'].focus();
        env.window.markAddFormDateSkippedIfNeeded();

        // Hành vi hiện có: chỉ đặt dateSkipped=true khi trước đó chưa "touched".
        expect(env.getGuideState().dateSkipped).toBe(!dateTouched);
      }),
      { numRuns: 40 },
    );
  });
});
