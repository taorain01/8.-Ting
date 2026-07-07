// ============================================================================
// Test KHÁM PHÁ Bug Condition — spec bugfix "paste-skip-input-validation".
//
// Property 1: Bug Condition — Bỏ qua gợi ý khi người dùng đã rời ô dán.
//
// Đây là test khám phá của bugfix workflow: nó mã hóa HÀNH VI MONG MUỐN và
// BẮT BUỘC THẤT BẠI trên mã CHƯA sửa (thất bại là bằng chứng lỗi tồn tại).
// Sau khi sửa `handleQuickPasteGuidance`, chính test này phải PASS.
//
// Điều kiện lỗi (isBugCondition từ design):
//   pasteHasContent === true
//   AND NOT dateSkipped
//   AND NOT dateGuided
//   AND activeElementId !== 'paste-input'   (người dùng đã rời ô dán)
//
// Cách tiếp cận Scoped PBT: dựng DOM mô phỏng có theo dõi `document.activeElement`
// + fake timers; sinh ngẫu nhiên `activeElementId` thuộc tập ô đích không phải
// `paste-input` (`add-name`, `add-seller-name`, `add-price`) kết hợp nội dung dán
// không rỗng.
//
// Validates: Requirements 2.1, 2.2, 2.3
// ============================================================================

const fc = require('fast-check');
const { createGuidanceEnv } = require('../helpers/add-form-guidance-dom.cjs');

// Các ô đích mà người dùng có thể chủ động chuyển focus sang (khác `paste-input`).
const OTHER_TARGET_IDS = ['add-name', 'add-seller-name', 'add-price'];

// --- Generators -----------------------------------------------------------

/** Ô người dùng chủ động chuyển focus sang sau khi dán (không phải paste-input). */
const otherTargetArb = fc.constantFrom(...OTHER_TARGET_IDS);

/**
 * Nội dung dán KHÔNG rỗng sau khi trim: luôn có ít nhất một ký tự không-khoảng-trắng.
 * Ghép padding tùy ý (có thể là khoảng trắng) quanh một lõi không-khoảng-trắng.
 */
const nonEmptyPasteArb = fc
  .tuple(
    fc.string({ maxLength: 8 }),
    fc.constantFrom('a', 'x', '1', '@', 'user@mail.com|pw|2FA', 'Ω', 'tài-khoản'),
    fc.string({ maxLength: 8 }),
  )
  .map(([pre, core, post]) => pre + core + post);

// --- Kịch bản dùng chung --------------------------------------------------

/**
 * Mô phỏng: người dùng dán vào `paste-input` (đang giữ focus), guidance được
 * lên lịch, rồi người dùng lập tức chuyển focus sang `targetId`, sau đó timer chạy.
 * Trả về trạng thái quan sát được sau khi mọi timer đã chạy.
 */
function runPasteThenSwitchFocus(pasteContent, targetId) {
  const env = createGuidanceEnv();

  // Bắt đầu ở trạng thái sạch (dateSkipped=false, dateGuided=false).
  env.window.resetAddFormGuideState();

  // Người dùng dán nội dung trong khi đang ở ô dán nhanh.
  env.elements['paste-input'].value = pasteContent;
  env.setActiveElement('paste-input');

  // Sự kiện onpaste kích hoạt guidance (lên lịch setTimeout).
  env.window.handleQuickPasteGuidance();

  // Người dùng chủ động chuyển focus sang ô khác NGAY sau khi dán.
  env.elements[targetId].focus();

  // Cho toàn bộ timer chạy (guidance callback + focus trễ 80ms nếu có).
  env.runAllTimers();

  const active = env.getActiveElement();
  const guide = env.getGuideState();
  return {
    activeElementId: active ? active.id : null,
    dateSkipped: guide.dateSkipped,
    dateGuided: guide.dateGuided,
  };
}

// --- Property 1: Bug Condition -------------------------------------------

describe('handleQuickPasteGuidance — Property 1: Bug Condition (khám phá)', () => {
  it('KHI người dùng dán rồi rời ô dán sang ô khác THÌ focus PHẢI giữ nguyên (không bị kéo về add-smart-date), dateSkipped=true, dateGuided=false', () => {
    fc.assert(
      fc.property(nonEmptyPasteArb, otherTargetArb, (pasteContent, targetId) => {
        const result = runPasteThenSwitchFocus(pasteContent, targetId);

        // 2.1 + 2.3: KHÔNG được ép focus/cuộn về 'add-smart-date';
        // focus phải giữ ở ô người dùng đã chủ động chọn.
        expect(result.activeElementId).toBe(targetId);
        // 2.2: coi việc rời ô dán là hành động skip.
        expect(result.dateSkipped).toBe(true);
        // Không đánh dấu đã guided (vì gợi ý đã bị bỏ qua).
        expect(result.dateGuided).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
