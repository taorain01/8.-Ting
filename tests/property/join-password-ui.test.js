const fc = require('fast-check');
const { loadDesktopApp } = require('../helpers/ui-loader.cjs');

describe('Join_Password điều kiện bật nút hoàn tất Join_Flow', () => {
  const { exports } = loadDesktopApp();
  const isAcceptable = exports.isJoinPasswordInputAcceptable;

  it('helper thuần đã được nạp từ desktop-app.js', () => {
    expect(typeof isAcceptable).toBe('function');
  });

  // **Feature: group-password, Property 12: Điều kiện bật nút hoàn tất Join_Flow theo đầu vào**
  it('bật ⟺ giá trị sau khi trim có độ dài 1..128', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (value) => {
        const trimmed = String(value ?? '').trim();
        const expected = trimmed.length >= 1 && trimmed.length <= 128;
        expect(isAcceptable(value)).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });
});
