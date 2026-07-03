// Feature: auto-update-system, Property 2: Chuẩn hoá phiên bản không đổi kết quả so sánh
//
// *For any* chuỗi phiên bản `x`, việc thêm tiền tố `"v"` và/hoặc phần metadata build ở đuôi
// (ví dụ `"+build.5"`) không làm thay đổi kết quả so sánh: compareVersions("v" + x + "+build", x) === 0.
//
// Validates: Requirements 2.2

'use strict';

// `describe`/`it` là global (vitest config bật `globals: true`) — không import qua require('vitest').
const fc = require('fast-check');
const VC = require('../../js/shared/version-compare.js');

// Số vòng lặp tối thiểu theo quy ước property-based test của thiết kế.
const NUM_RUNS = 100;

/**
 * Generator sinh chuỗi phiên bản `x` HỢP LỆ — tức luôn có một đoạn số dạng
 * chấm dẫn đầu (sau tiền tố "v"/"V" tuỳ chọn) để `normalizeVersion` latch vào.
 *
 * Đây là miền hợp lệ của Property 2: bất biến "thêm tiền tố v / metadata build
 * không đổi kết quả so sánh" chỉ được phát biểu cho chuỗi phiên bản có đoạn số
 * dẫn đầu. Với chuỗi rác không số, việc nối thêm metadata CHỨA chữ số (vd
 * "-beta.1") sẽ tạo ra một đoạn số mới và đương nhiên đổi kết quả — nằm ngoài
 * phạm vi phát biểu, nên không đưa vào generator.
 *
 * Bao phủ: 1..4 đoạn số (chạm biên cắt major.minor.patch) và mọi biến thể tiền
 * tố "" / "v" / "V".
 */
const versionArb = fc
  .tuple(
    fc.constantFrom('', 'v', 'V'),
    fc.array(fc.nat({ max: 999 }), { minLength: 1, maxLength: 4 })
  )
  .map(([prefix, segments]) => prefix + segments.join('.'));

// Các phần metadata build ở đuôi, GIỮ đa dạng KỂ CẢ loại chứa chữ số
// ("+build.5", "-beta.1", "+abc.123"): với chuỗi phiên bản hợp lệ,
// normalizeVersion phải cắt đúng phần metadata và bất biến vẫn giữ.
const buildMetaArb = fc.constantFrom('+build', '+build.5', '-beta.1', '+abc.123', '');

describe('Property 2: Chuẩn hoá phiên bản không đổi kết quả so sánh', () => {
  it('thêm tiền tố "v" và/hoặc metadata build không đổi kết quả so sánh', () => {
    fc.assert(
      fc.property(versionArb, fc.boolean(), buildMetaArb, (x, addPrefix, buildMeta) => {
        const decorated = (addPrefix ? 'v' : '') + x + buildMeta;
        return VC.compareVersions(decorated, x) === 0;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('trường hợp cụ thể theo phát biểu property: compareVersions("v" + x + "+build", x) === 0', () => {
    fc.assert(
      fc.property(versionArb, (x) => {
        return VC.compareVersions('v' + x + '+build', x) === 0;
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
