// ============================================================================
// Property test cho Update_Core.isAllowedReleaseUrl (`js/shared/update-core.js`).
//
// Feature: auto-update-system, Property 12: Chỉ chấp nhận URL phát hành từ
// origin tin cậy qua HTTPS — với bất kỳ chuỗi URL, `isAllowedReleaseUrl(url)`
// trả về `true` KHI VÀ CHỈ KHI scheme là `https` VÀ host thuộc allowlist
// (`raw.githubusercontent.com` và miền tải asset của GitHub / mọi subdomain
// `*.githubusercontent.com`); mọi scheme khác `https` hoặc host ngoài allowlist
// đều cho `false`.
//
// Validates: Requirements 9.3, 9.4
// ============================================================================

const fc = require('fast-check');
const UpdateCore = require('../../js/shared/update-core.js');

const ALLOWED_RELEASE_HOSTS = UpdateCore.ALLOWED_RELEASE_HOSTS;
const GITHUBUSERCONTENT_SUFFIX = '.githubusercontent.com';

// --- Oracle độc lập -------------------------------------------------------

/**
 * Cài đặt tham chiếu ("oracle") độc lập với module để kiểm tra tương đương
 * logic: true iff scheme https VÀ (host thuộc allowlist HOẶC là subdomain
 * `*.githubusercontent.com`). Dùng chính `URL` như module để phản ánh đúng
 * quy tắc phân tích/chuẩn hoá host của môi trường.
 */
function oracleIsAllowed(url) {
  if (typeof url !== 'string' || url === '') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = String(parsed.hostname || '').toLowerCase();
  if (host === '') return false;
  if (ALLOWED_RELEASE_HOSTS.indexOf(host) !== -1) return true;
  if (host.endsWith(GITHUBUSERCONTENT_SUFFIX)) return true;
  return false;
}

// --- Generators nền -------------------------------------------------------

/** Nhãn subdomain hợp lệ (chữ thường + số), độ dài 1..15. */
const labelArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 1,
    maxLength: 15,
  })
  .filter((s) => s.length > 0);

/** Đường dẫn tuỳ ý sau host (có thể rỗng). */
const pathArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789/-_.'.split('')), {
    maxLength: 20,
  })
  .map((p) => (p === '' ? '' : '/' + p));

/** Host thuộc allowlist tường minh. */
const allowedHostArb = fc.constantFrom(...ALLOWED_RELEASE_HOSTS);

/** Subdomain `*.githubusercontent.com` (một hoặc nhiều nhãn). */
const githubUserContentSubdomainArb = fc
  .array(labelArb, { minLength: 1, maxLength: 3 })
  .map((labels) => labels.join('.') + GITHUBUSERCONTENT_SUFFIX);

/** Host KHÔNG thuộc allowlist và KHÔNG phải subdomain githubusercontent.com. */
const disallowedHostArb = fc
  .constantFrom(
    'example.com',
    'evil.com',
    'github.com.attacker.net',
    'githubusercontent.com.evil.com',
    'raw.githubusercontent.com.evil.com',
    'notgithubusercontent.com',
    'github.io',
    'gitlab.com',
    'localhost',
    '127.0.0.1',
    'objects.github.com',
  )
  .filter(
    (h) =>
      ALLOWED_RELEASE_HOSTS.indexOf(h) === -1 && !h.endsWith(GITHUBUSERCONTENT_SUFFIX),
  );

/** Scheme khác https. */
const nonHttpsSchemeArb = fc.constantFrom('http', 'ftp', 'file', 'ws', 'javascript');

// --- Property 12 ----------------------------------------------------------

describe('Update_Core.isAllowedReleaseUrl — Property 12', () => {
  it('URL https + host allowlist tường minh ⇒ true', () => {
    fc.assert(
      fc.property(allowedHostArb, pathArb, (host, path) => {
        const url = 'https://' + host + path;
        expect(UpdateCore.isAllowedReleaseUrl(url)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('URL https + subdomain *.githubusercontent.com ⇒ true', () => {
    fc.assert(
      fc.property(githubUserContentSubdomainArb, pathArb, (host, path) => {
        const url = 'https://' + host + path;
        expect(UpdateCore.isAllowedReleaseUrl(url)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('sai scheme (khác https) trên host hợp lệ ⇒ false', () => {
    fc.assert(
      fc.property(
        nonHttpsSchemeArb,
        fc.oneof(allowedHostArb, githubUserContentSubdomainArb),
        pathArb,
        (scheme, host, path) => {
          const url = scheme + '://' + host + path;
          expect(UpdateCore.isAllowedReleaseUrl(url)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('host ngoài allowlist (kể cả https) ⇒ false', () => {
    fc.assert(
      fc.property(disallowedHostArb, pathArb, (host, path) => {
        const url = 'https://' + host + path;
        expect(UpdateCore.isAllowedReleaseUrl(url)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('chuỗi rác không parse được ⇒ false', () => {
    // Chuỗi không có scheme hợp lệ / không phải URL tuyệt đối.
    const garbageArb = fc
      .string({ maxLength: 30 })
      .filter((s) => {
        try {
          // Loại các chuỗi tình cờ là URL tuyệt đối hợp lệ để đảm bảo "rác".
          // eslint-disable-next-line no-new
          new URL(s);
          return false;
        } catch (err) {
          return true;
        }
      });
    fc.assert(
      fc.property(garbageArb, (s) => {
        expect(UpdateCore.isAllowedReleaseUrl(s)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('không phân biệt hoa/thường ở host ⇒ giữ nguyên kết quả true', () => {
    fc.assert(
      fc.property(
        fc.oneof(allowedHostArb, githubUserContentSubdomainArb),
        pathArb,
        (host, path) => {
          const url = 'https://' + host.toUpperCase() + path;
          expect(UpdateCore.isAllowedReleaseUrl(url)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('tương đương logic với oracle độc lập trên miền hỗn hợp', () => {
    // Sinh URL đa dạng: scheme https/khác https, các loại host khác nhau.
    const schemeArb = fc.oneof(fc.constant('https'), nonHttpsSchemeArb);
    const hostArb = fc.oneof(
      allowedHostArb,
      githubUserContentSubdomainArb,
      disallowedHostArb,
    );
    fc.assert(
      fc.property(schemeArb, hostArb, pathArb, (scheme, host, path) => {
        const url = scheme + '://' + host + path;
        expect(UpdateCore.isAllowedReleaseUrl(url)).toBe(oracleIsAllowed(url));
      }),
      { numRuns: 100 },
    );
  });

  it('đầu vào không phải chuỗi hoặc rỗng ⇒ false', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, 123, {}, [], '', true),
        (val) => {
          expect(UpdateCore.isAllowedReleaseUrl(val)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
