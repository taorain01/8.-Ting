// ============================================================================
// Test HÀNH VI — `handleQuickPasteGuidance` sau khi GỠ auto-cuộn.
//
// Bối cảnh: theo yêu cầu người dùng, toàn bộ auto-cuộn tới field chưa nhập đã bị
// gỡ bỏ. `handleQuickPasteGuidance` giờ là NO-OP: nó KHÔNG còn ép focus/cuộn về
// `add-smart-date`, cũng KHÔNG thay đổi cờ guide. Wizard chỉ chuyển tab và cuộn
// lên đầu mỗi lần (xử lý ở `goAddTab`), không dẫn dắt giữa các field.
//
// Test này xác nhận: dù người dùng dán nội dung rồi rời ô dán sang ô khác, focus
// vẫn giữ NGUYÊN ở ô người dùng chọn và không có tác dụng phụ nào lên cờ guide.
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
 * gọi, rồi người dùng lập tức chuyển focus sang `targetId`, sau đó timer chạy.
 * Trả về trạng thái quan sát được sau khi mọi timer đã chạy.
 */
function runPasteThenSwitchFocus(pasteContent, targetId) {
  const env = createGuidanceEnv();

  // Bắt đầu ở trạng thái sạch (dateSkipped=false, dateGuided=false).
  env.window.resetAddFormGuideState();

  // Người dùng dán nội dung trong khi đang ở ô dán nhanh.
  env.elements['paste-input'].value = pasteContent;
  env.setActiveElement('paste-input');

  // Sự kiện onpaste kích hoạt guidance (giờ là no-op).
  env.window.handleQuickPasteGuidance();

  // Người dùng chủ động chuyển focus sang ô khác NGAY sau khi dán.
  env.elements[targetId].focus();

  // Cho toàn bộ timer chạy (nếu có).
  env.runAllTimers();

  const active = env.getActiveElement();
  const guide = env.getGuideState();
  return {
    activeElementId: active ? active.id : null,
    dateSkipped: guide.dateSkipped,
    dateGuided: guide.dateGuided,
  };
}

// --- Property: no-op sau khi gỡ auto-cuộn --------------------------------

describe('handleQuickPasteGuidance — no-op sau khi gỡ auto-cuộn', () => {
  it('KHI người dùng dán rồi rời ô dán sang ô khác THÌ focus giữ nguyên và cờ guide KHÔNG đổi (dateSkipped=false, dateGuided=false)', () => {
    fc.assert(
      fc.property(nonEmptyPasteArb, otherTargetArb, (pasteContent, targetId) => {
        const result = runPasteThenSwitchFocus(pasteContent, targetId);

        // Không ép focus/cuộn về 'add-smart-date'; giữ ở ô người dùng đã chọn.
        expect(result.activeElementId).toBe(targetId);
        // Hàm giờ là no-op: không đụng vào cờ guide.
        expect(result.dateSkipped).toBe(false);
        expect(result.dateGuided).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
