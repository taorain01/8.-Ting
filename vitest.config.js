// Cấu hình test runner cho Update_System.
// - environment 'node': tầng logic thuần `js/shared/*` không phụ thuộc DOM.
// - globals bật để test đọc dễ hơn (nhưng test hiện tại vẫn import tường minh).
// - include: gom property test và unit test theo quy ước đặt tên `.test.js`.
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{js,mjs,cjs}'],
  },
});
