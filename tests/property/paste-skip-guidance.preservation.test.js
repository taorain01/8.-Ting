// ============================================================================
// Test HÀNH VI (Preservation) — sau khi GỠ auto-cuộn theo yêu cầu người dùng.
//
// Bối cảnh: toàn bộ auto-cuộn tới field chưa nhập trong form Thêm/Sửa tài khoản
// đã bị gỡ. Các hàm dẫn dắt sau đây giờ là NO-OP (không cuộn, không đổi focus):
//   - handleQuickPasteGuidance  (trước: cuộn tới add-smart-date sau khi dán)
//   - guideAddFormFromNote      (trước: cuộn tới add-seller-name)
//   - guideAddFormFromSeller    (trước: cuộn tới add-price)
//   - guideAddFormFromPlatform  (trước: cuộn tới paste-input / add-name)
// Wizard chỉ chuyển tab (skip trang) và cuộn lên đầu mỗi lần — xử lý ở `goAddTab`.
//
// Các hành vi VẪN được bảo toàn (không liên quan auto-cuộn):
//   - guideAddFormFromDate      → vẫn đánh dấu dateTouched + thử auto-chuyển Tab 3.
//   - markAddFormDateSkippedIfNeeded → vẫn đặt dateSkipped khi chưa touched.
// ============================================================================

const fc = require('fast-check');
const { createGuidanceEnv } = require('../helpers/add-form-guidance-dom.cjs');

// Các ô nhập không phải `paste-input` mà focus có thể đang đứng ở đó.
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
// handleQuickPasteGuidance giờ là NO-OP: dù còn ở paste-input hay đã rời đi,
// focus giữ nguyên và cờ guide không đổi.
// ==========================================================================

describe('handleQuickPasteGuidance — no-op, giữ nguyên focus và cờ', () => {
  it('còn ở `paste-input`: KHÔNG cuộn đi đâu, focus và cờ giữ nguyên', () => {
    fc.assert(
      fc.property(anyPasteArb, fc.boolean(), fc.boolean(), (pasteContent, dateSkipped, dateGuided) => {
        const env = freshEnv({ dateSkipped, dateGuided });

        env.elements['paste-input'].value = pasteContent;
        env.setActiveElement('paste-input');

        env.window.handleQuickPasteGuidance();
        env.runAllTimers();

        const active = env.getActiveElement();
        const guide = env.getGuideState();

        // Hàm là no-op: focus vẫn ở ô dán, cờ không đổi.
        expect(active ? active.id : null).toBe('paste-input');
        expect(guide.dateGuided).toBe(dateGuided);
        expect(guide.dateSkipped).toBe(dateSkipped);
      }),
      { numRuns: 120 },
    );
  });

  it('ô trống hoặc đã rời ô dán: KHÔNG kích hoạt gì, focus và cờ giữ nguyên', () => {
    fc.assert(
      fc.property(
        anyPasteArb,
        fc.constantFrom('paste-input', ...NON_PASTE_IDS),
        fc.boolean(),
        fc.boolean(),
        (pasteContent, activeId, dateSkipped, dateGuided) => {
          const env = freshEnv({ dateSkipped, dateGuided });

          env.elements['paste-input'].value = pasteContent;
          env.setActiveElement(activeId);

          env.window.handleQuickPasteGuidance();
          env.runAllTimers();

          const active = env.getActiveElement();
          const guide = env.getGuideState();

          // Không gợi ý: focus giữ nguyên nơi người dùng đang đứng, cờ không đổi.
          expect(active ? active.id : null).toBe(activeId);
          expect(guide.dateGuided).toBe(dateGuided);
          expect(guide.dateSkipped).toBe(dateSkipped);
        },
      ),
      { numRuns: 120 },
    );
  });
});

// ==========================================================================
// Chuỗi gợi ý cũ (note → seller → price) đã bị GỠ: các hàm giờ là no-op,
// KHÔNG chuyển focus giữa các field nữa. guideAddFormFromDate vẫn đánh dấu
// dateTouched (để phục vụ auto-chuyển tab).
// ==========================================================================

describe('Chuỗi dẫn dắt trong Tab 3 đã gỡ (guideAddFormFromNote/Seller là no-op)', () => {
  it('guideAddFormFromDate chỉ đánh dấu dateTouched; guideAddFormFromNote/FromSeller KHÔNG chuyển focus', () => {
    fc.assert(
      fc.property(contentfulPasteArb, contentfulPasteArb, (noteText, sellerText) => {
        const env = createGuidanceEnv();
        env.window.resetAddFormGuideState();

        env.elements['add-note'].value = noteText;
        env.elements['add-seller-name'].value = sellerText;

        // Đặt focus ở một ô trung tính để quan sát: no-op không được kéo focus đi.
        env.elements['add-note'].focus();

        // Bước 1: rời ô "Thời hạn" → chỉ đánh dấu dateTouched (không cuộn).
        env.window.guideAddFormFromDate();
        env.runAllTimers();
        expect(env.getGuideState().dateTouched).toBe(true);

        // Bước 2: guideAddFormFromNote là no-op → focus KHÔNG nhảy sang add-seller-name.
        env.window.guideAddFormFromNote();
        env.runAllTimers();
        const afterNote = env.getActiveElement();
        expect(afterNote ? afterNote.id : null).toBe('add-note');

        // Bước 3: guideAddFormFromSeller là no-op → focus KHÔNG nhảy sang add-price.
        env.window.guideAddFormFromSeller();
        env.runAllTimers();
        const afterSeller = env.getActiveElement();
        expect(afterSeller ? afterSeller.id : null).toBe('add-note');
      }),
      { numRuns: 60 },
    );
  });
});

// ==========================================================================
// markAddFormDateSkippedIfNeeded — KHÔNG đổi (không liên quan auto-cuộn).
// ==========================================================================

describe('Preservation — ghi nhận skip qua `add-note`', () => {
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
