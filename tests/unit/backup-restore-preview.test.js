const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'backup.js'), 'utf8');

function loadBackup(appState) {
  const sandbox = {
    console, Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON, Promise, Error,
    Blob: function Blob() {}, URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    setTimeout: fn => fn(),
    document: {
      querySelector: () => null,
      getElementById: () => null,
      createElement: () => ({ click() {}, files: [], style: {} }),
      body: { appendChild() {}, removeChild() {} },
    },
  };
  sandbox.window = { appState };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'backup.js' });
  return { api: sandbox.window.TingBackup, sandbox };
}

function sampleBackup() {
  return {
    accounts: [
      { id: 'new-active', name: 'Active', type: 'bought', platform: 'netflix', username: 'a', categoryIds: ['cat'] },
    ],
    trashAccounts: [
      { id: 'new-trash', name: 'Trash', type: 'bought', platform: 'spotify', username: 'b', categoryIds: ['cat'] },
    ],
    customCategories: [{ id: 'cat', name: 'Backup category', order: 0 }],
  };
}

describe('Backup restore preview and merge', () => {
  it('previews active, trash and category data while reporting conflicts', () => {
    const state = {
      accounts: [{ id: 'existing', name: 'Existing', type: 'bought', platform: 'netflix', username: 'x' }],
      trashAccounts: [], customCategories: [{ id: 'cat', name: 'Current category', order: 0 }],
    };
    const { api } = loadBackup(state);
    const preview = api.createBackupRestorePreview(sampleBackup(), state);
    expect(preview.counts).toEqual({ active: 1, trash: 1, categories: 1 });
    expect(preview.conflicts.join(' ')).toContain('đổi ID');
  });

  it('restores active/trash accounts and remaps a conflicting category ID in demo mode', async () => {
    const state = {
      isDemo: true, accounts: [], trashAccounts: [],
      customCategories: [{ id: 'cat', name: 'Current category', order: 0 }],
    };
    const { api } = loadBackup(state);
    const parsed = { data: sampleBackup() };
    const result = await api.applyBackupRestore({ parsed, includeActive: true, includeTrash: true, includeCategories: true });
    expect(result.restored).toBe(2);
    expect(result.categoriesAdded).toBe(1);
    expect(state.accounts).toHaveLength(1);
    expect(state.trashAccounts).toHaveLength(1);
    expect(state.trashAccounts[0].isDeleted).toBe(true);
    expect(state.accounts[0].categoryIds[0]).toMatch(/^cat-restored/);
  });

  it('does not overwrite an existing account with the same ID', async () => {
    const state = {
      isDemo: true,
      accounts: [{ id: 'new-active', name: 'Keep me', type: 'bought', platform: 'netflix', username: 'old' }],
      trashAccounts: [], customCategories: [],
    };
    const { api } = loadBackup(state);
    const result = await api.applyBackupRestore({ parsed: { data: sampleBackup() }, includeTrash: false, includeCategories: false });
    expect(result.restored).toBe(0);
    expect(state.accounts).toHaveLength(1);
    expect(state.accounts[0].name).toBe('Keep me');
  });

  it('reports a mid-restore write failure without corrupting the remaining payloads', async () => {
    const state = { isDemo: false, accounts: [], trashAccounts: [], customCategories: [] };
    const { api, sandbox } = loadBackup(state);
    const written = [];
    sandbox.saveUserCategories = async () => true;
    sandbox.addAccountToDB = async account => {
      written.push(account);
      if (written.length === 1) throw new Error('network interruption');
      return `restored-${written.length}`;
    };

    const result = await api.applyBackupRestore({
      parsed: { data: sampleBackup() },
      includeActive: true,
      includeTrash: true,
      includeCategories: false,
    });

    expect(result).toMatchObject({ attempted: 2, restored: 1, failed: 1 });
    expect(written).toHaveLength(2);
    expect(written[0].id).toBeUndefined();
    expect(written[0].isDeleted).toBe(false);
    expect(written[1].isDeleted).toBe(true);
    expect(state.accounts).toEqual([]);
    expect(state.trashAccounts).toEqual([]);
  });
});
