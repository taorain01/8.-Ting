const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const GROUPS = fs.readFileSync(path.join(ROOT, 'js', 'groups.js'), 'utf8');

function loadGroupBatch({ demo = false, commit = true } = {}) {
  const calls = { updates: [], commits: 0, notifications: 0 };
  const accountDocs = new Map();
  const group = {
    id: 'g1', role: 'owner', ownerUid: 'owner-1', ownerEmail: 'owner@example.com',
    memberEmails: ['owner@example.com'], accountManagerEmails: [],
  };
  const accounts = [
    { id: 'a1', groupCategoryId: 'one', groupSortOrder: 100 },
    { id: 'a2', groupCategoryId: 'one', groupSortOrder: 200 },
  ];
  const state = {
    isDemo: demo,
    user: { uid: 'owner-1', email: 'owner@example.com' },
    groups: [group],
    sharedAccounts: { g1: accounts },
  };
  const batch = {
    update(ref, patch) { calls.updates.push({ ref, patch }); },
    commit() { calls.commits += 1; return commit ? Promise.resolve() : Promise.reject(new Error('commit failed')); },
  };
  const groupRef = {
    collection: () => ({ doc: id => ({ path: `groups/g1/sharedAccounts/${id}` }) }),
    update: () => Promise.resolve(),
  };
  const sandbox = {
    console, Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON, Promise, Error, RegExp,
    setTimeout: () => { calls.notifications += 1; return 1; }, clearTimeout: () => {},
    auth: { currentUser: { uid: 'owner-1', email: 'owner@example.com', emailVerified: true } },
    db: { collection: () => ({ doc: () => groupRef }) },
    firebase: { firestore: { FieldValue: { serverTimestamp: () => 'server-time' } } },
  };
  const win = { appState: state };
  sandbox.window = win;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${GROUPS}\n;globalThis.__batch = updateSharedAccountGroupMetaBatch;`, sandbox);
  return { batch, calls, sandbox, state, group, accounts, groupRef };
}

describe('Shared account group metadata batch', () => {
  it('writes all positions in one atomic Firestore batch', async () => {
    const ctx = loadGroupBatch({ demo: false });
    ctx.sandbox.db.batch = () => ctx.batch;
    await ctx.sandbox.__batch('g1', [
      { id: 'a1', groupCategoryId: 'two', groupSortOrder: 1000 },
      { id: 'a2', groupCategoryId: null, groupSortOrder: 2000 },
    ]);
    expect(ctx.calls.commits).toBe(1);
    expect(ctx.calls.updates).toHaveLength(3);
  });

  it('validates the full list before issuing a commit', async () => {
    const ctx = loadGroupBatch({ demo: false });
    ctx.sandbox.db.batch = () => ctx.batch;
    await expect(ctx.sandbox.__batch('g1', [
      { id: 'a1', groupCategoryId: 'two', groupSortOrder: 1000 },
      { id: 'missing', groupCategoryId: 'two', groupSortOrder: 2000 },
    ])).rejects.toThrow();
    expect(ctx.calls.commits).toBe(0);
    expect(ctx.calls.updates).toHaveLength(0);
  });

  it('rejects more than 500 account writes before creating a batch', async () => {
    const ctx = loadGroupBatch({ demo: false });
    ctx.sandbox.db.batch = () => ctx.batch;
    const updates = Array.from({ length: 501 }, (_, index) => ({
      id: `a${index}`,
      groupCategoryId: null,
      groupSortOrder: index,
    }));
    await expect(ctx.sandbox.__batch('g1', updates)).rejects.toThrow(/500/);
    expect(ctx.calls.commits).toBe(0);
    expect(ctx.calls.updates).toHaveLength(0);
  });

  it('updates demo state without touching Firestore', async () => {
    const ctx = loadGroupBatch({ demo: true });
    await ctx.sandbox.__batch('g1', [{ id: 'a1', groupCategoryId: 'two', groupSortOrder: 1000 }]);
    expect(ctx.accounts[0].groupCategoryId).toBe('two');
    expect(ctx.calls.commits).toBe(0);
    expect(ctx.calls.notifications).toBe(1);
  });
});
