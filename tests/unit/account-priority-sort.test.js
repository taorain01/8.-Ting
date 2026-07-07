const fs = require('fs');
const path = require('path');
const vm = require('vm');

const UTILS_PATH = path.join(__dirname, '..', '..', 'js', 'utils.js');
const UTILS_SRC = fs.readFileSync(UTILS_PATH, 'utf8');

const EXPORT_SNIPPET = `
;globalThis.__tingUtilsExports = {
  sortAccountsByPriority,
  isAccountExpiredForSort,
};
`;

function loadUtils() {
  const sandbox = {
    console,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    JSON,
    encodeURIComponent,
    decodeURIComponent,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UTILS_SRC + EXPORT_SNIPPET, sandbox, { filename: 'utils.js' });
  return sandbox.__tingUtilsExports;
}

describe('sortAccountsByPriority', () => {
  const { sortAccountsByPriority, isAccountExpiredForSort } = loadUtils();

  it('puts expired accounts after accounts that are still valid', () => {
    const sorted = sortAccountsByPriority([
      {
        id: 'expired-pinned',
        status: 'expired',
        expiryDate: '2000-01-01',
        isPinned: true,
        pinnedAt: '2099-01-01T00:00:00.000Z',
      },
      { id: 'active-plain', status: 'active', expiryDate: '2099-01-01' },
      { id: 'expiring-valid', status: 'expiring', expiryDate: '2099-01-02' },
      { id: 'lifetime', status: 'active', expiryType: 'lifetime' },
    ]);

    expect(sorted.map((acc) => acc.id)).toEqual([
      'active-plain',
      'expiring-valid',
      'lifetime',
      'expired-pinned',
    ]);
  });

  it('keeps pinned and favorite priority inside valid and expired buckets', () => {
    const sorted = sortAccountsByPriority([
      { id: 'plain-active', status: 'active', expiryDate: '2099-01-01' },
      { id: 'favorite-expired', status: 'expired', expiryDate: '2000-01-01', isFavorite: true },
      { id: 'favorite-active', status: 'active', expiryDate: '2099-01-01', isFavorite: true },
      { id: 'plain-expired', status: 'expired', expiryDate: '2000-01-01' },
      { id: 'pinned-expired', status: 'expired', expiryDate: '2000-01-01', isPinned: true },
      { id: 'pinned-active', status: 'active', expiryDate: '2099-01-01', isPinned: true },
    ]);

    expect(sorted.map((acc) => acc.id)).toEqual([
      'pinned-active',
      'favorite-active',
      'plain-active',
      'pinned-expired',
      'favorite-expired',
      'plain-expired',
    ]);
  });

  it('treats stale past expiry dates as expired for sorting', () => {
    expect(isAccountExpiredForSort({ status: 'active', expiryDate: '2000-01-01' })).toBe(true);
    expect(isAccountExpiredForSort({ status: 'active', expiryDate: '2099-01-01' })).toBe(false);
    expect(isAccountExpiredForSort({ status: 'active', expiryType: 'lifetime' })).toBe(false);
  });
});
