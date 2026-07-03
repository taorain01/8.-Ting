// ============================================================================
// Feature: auto-update-system, Property 13: Năng lực cập nhật theo nền tảng —
//   For any nền tảng `platform` trong {'electron','android','ios','web'},
//   `updateCapability(platform)` trả về canCheck = true khi và chỉ khi platform
//   là 'electron' hoặc 'android'; với 'ios' và 'web', canCheck = false và
//   disabledMessage là một chuỗi tiếng Việt không rỗng phù hợp nền tảng
//   (iOS: "Cập nhật qua App Store").
//
// Validates: Requirements 1.2, 1.3, 1.4, 10.2, 10.3
// ============================================================================

const fc = require('fast-check');
const { updateCapability } = require('../../js/shared/platform-detector.js');

// Không gian nền tảng được đặc tả trong Property 13.
const PLATFORMS = ['electron', 'android', 'ios', 'web'];

// Nền tảng cho phép kiểm tra/cập nhật trong app.
const CAN_CHECK_PLATFORMS = new Set(['electron', 'android']);

// Kiểm tra "chuỗi tiếng Việt không rỗng": có ký tự và chứa dấu tiếng Việt.
const VIETNAMESE_PATTERN =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

describe('Property 13: Năng lực cập nhật theo nền tảng (updateCapability)', () => {
  it('canCheck = true khi và chỉ khi platform là electron hoặc android', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PLATFORMS), (platform) => {
        const capability = updateCapability(platform);
        const expectedCanCheck = CAN_CHECK_PLATFORMS.has(platform);

        // Tương đương logic hai chiều (iff).
        expect(capability.canCheck).toBe(expectedCanCheck);

        if (expectedCanCheck) {
          // electron/android: bật hành động, không có thông báo vô hiệu hoá.
          expect(capability.disabledMessage).toBeNull();
        } else {
          // ios/web: vô hiệu hoá kèm chuỗi tiếng Việt không rỗng.
          expect(typeof capability.disabledMessage).toBe('string');
          expect(capability.disabledMessage.trim().length).toBeGreaterThan(0);
          expect(VIETNAMESE_PATTERN.test(capability.disabledMessage)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('iOS hiển thị đúng thông báo "Cập nhật qua App Store"', () => {
    fc.assert(
      fc.property(fc.constant('ios'), (platform) => {
        const capability = updateCapability(platform);
        expect(capability.canCheck).toBe(false);
        expect(capability.disabledMessage).toBe('Cập nhật qua App Store');
      }),
      { numRuns: 100 },
    );
  });

  it('web bị vô hiệu hoá với thông báo tiếng Việt khác thông báo iOS', () => {
    fc.assert(
      fc.property(fc.constant('web'), (platform) => {
        const capability = updateCapability(platform);
        expect(capability.canCheck).toBe(false);
        expect(typeof capability.disabledMessage).toBe('string');
        expect(capability.disabledMessage.trim().length).toBeGreaterThan(0);
        // Thông báo web phải phù hợp nền tảng, không dùng thông báo App Store của iOS.
        expect(capability.disabledMessage).not.toBe('Cập nhật qua App Store');
      }),
      { numRuns: 100 },
    );
  });
});
