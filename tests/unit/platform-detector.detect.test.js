// ============================================================================
// Feature: auto-update-system, Task 4.3: Unit test cho `detectPlatform`.
//   Kiểm tra phát hiện các nền tảng Electron, Android, iOS, web và trường hợp
//   không xác định được (mặc định về 'web') thông qua các object `env` mock.
//
// Ghi chú: vitest bật `globals: true` nên describe/it/expect là biến toàn cục,
//   KHÔNG cần require('vitest').
//
// Validates: Requirements 10.3
// ============================================================================

const { detectPlatform } = require('../../js/shared/platform-detector.js');

// Tạo một mock Capacitor với giá trị getPlatform() cho trước.
function mockCapacitor(platform) {
  return {
    Capacitor: {
      getPlatform: () => platform,
    },
  };
}

describe('detectPlatform: phát hiện nền tảng từ env mock', () => {
  it('trả về "electron" khi electronAPI.isElectron = true', () => {
    const env = { electronAPI: { isElectron: true } };
    expect(detectPlatform(env)).toBe('electron');
  });

  it('electron được ưu tiên hơn Capacitor khi cả hai cùng có mặt', () => {
    const env = {
      electronAPI: { isElectron: true },
      Capacitor: { getPlatform: () => 'android' },
    };
    expect(detectPlatform(env)).toBe('electron');
  });

  it('trả về "android" khi Capacitor.getPlatform() = "android"', () => {
    expect(detectPlatform(mockCapacitor('android'))).toBe('android');
  });

  it('trả về "ios" khi Capacitor.getPlatform() = "ios"', () => {
    expect(detectPlatform(mockCapacitor('ios'))).toBe('ios');
  });

  it('trả về "web" khi Capacitor.getPlatform() = "web"', () => {
    expect(detectPlatform(mockCapacitor('web'))).toBe('web');
  });

  it('trả về "web" khi Capacitor.getPlatform() trả giá trị lạ/không xác định', () => {
    expect(detectPlatform(mockCapacitor('windows'))).toBe('web');
  });

  it('trả về "web" khi electronAPI tồn tại nhưng isElectron falsy', () => {
    const env = { electronAPI: { isElectron: false } };
    expect(detectPlatform(env)).toBe('web');
  });

  it('trả về "web" khi env là object rỗng (không xác định được)', () => {
    expect(detectPlatform({})).toBe('web');
  });

  it('trả về "web" khi env là undefined', () => {
    expect(detectPlatform(undefined)).toBe('web');
  });

  it('trả về "web" khi gọi không truyền tham số', () => {
    expect(detectPlatform()).toBe('web');
  });
});
