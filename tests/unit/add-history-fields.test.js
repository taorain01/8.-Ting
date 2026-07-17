const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

function loadHistoryHelpers(accounts = null) {
  const source = fs.readFileSync(path.join(ROOT, 'js', 'utils.js'), 'utf8');
  const sandbox = {
    window: {
      appState: {
        accounts: accounts || [
          {
            id: 'account-1',
            name: 'Adobe Firefly',
            sellerName: 'Shop with a deliberately long seller name',
            purchasePrice: 45000,
            note: 'Ghi chú rất dài để kiểm tra phần xem trước chỉ hiển thị một dòng trong nút lịch sử.',
            purchaseDate: '2026-07-17',
          },
        ],
      },
    },
    console,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    JSON,
    encodeURIComponent,
    decodeURIComponent,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${source}\n;globalThis.__history = { renderAddHistoryOpenButton, renderAddHistoryFieldButton, renderAddHistoryPopoverContent };`, sandbox);
  return sandbox.__history;
}

describe('Separate add-form history controls', () => {
  it('renders one independent history button for each field', () => {
    const history = loadHistoryHelpers();

    const note = history.renderAddHistoryFieldButton('note');
    const seller = history.renderAddHistoryFieldButton('seller');
    const price = history.renderAddHistoryFieldButton('price');

    expect(note).toContain('add-history-anchor-note');
    expect(note).toContain('add-history-popover-note');
    expect(seller).toContain('add-history-anchor-seller');
    expect(seller).toContain('add-history-popover-seller');
    expect(price).toContain('add-history-anchor-price');
    expect(price).toContain('add-history-popover-price');
    expect(note).not.toContain('add-history-anchor-seller');
    expect(seller).not.toContain('add-history-anchor-price');
  });

  it('shows a one-line note preview and does not render the old combined bundle section', () => {
    const history = loadHistoryHelpers();
    const html = history.renderAddHistoryPopoverContent('note');

    expect(html).toContain('Lịch sử ghi chú');
    expect(html).toContain('add-history-item-note-row');
    expect(html).toContain('add-history-item-note');
    expect(html).not.toContain('Bộ đầy đủ');
    expect(fs.readFileSync(path.join(ROOT, 'css', 'components.css'), 'utf8'))
      .toMatch(/\.add-history-item-note\s*\{[^}]*text-overflow:ellipsis;[^}]*white-space:nowrap;/s);
  });

  it('places the three controls beside the matching fields on desktop and mobile', () => {
    for (const file of ['js/desktop-ui.js', 'mobile/js/ui.js']) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect(source).toContain('renderAddHistoryOpenButton');
      expect(source).toContain("renderHistoryField('note')");
      expect(source).toContain("renderHistoryField('seller')");
      expect(source).toContain("renderHistoryField('price')");
      expect(source.indexOf('${historyButton}')).toBeLessThan(source.indexOf("renderHistoryField('note')"));
    }
  });

  it('restores the combined history button and grouped popup above the field controls', () => {
    const history = loadHistoryHelpers();
    const button = history.renderAddHistoryOpenButton();
    const popover = history.renderAddHistoryPopoverContent('combined');

    expect(button).toContain('add-history-open-btn-combined');
    expect(button).toContain('Lịch sử đã nhập');
    expect(button).toContain('add-history-popover-combined');
    expect(popover).toContain('Bộ đầy đủ');
    expect(popover).toContain('Ghi chú');
    expect(popover).toContain('Người bán');
    expect(popover).toContain('Giá mua');
    expect(popover).toContain('add-history-item-note');
  });

  it('keeps all three buttons visible but disabled when a field has no history', () => {
    const history = loadHistoryHelpers([]);
    for (const kind of ['note', 'seller', 'price']) {
      const html = history.renderAddHistoryFieldButton(kind);
      expect(html).toContain(`add-history-anchor-${kind}`);
      expect(html).toContain('disabled aria-disabled="true"');
      expect(html).toContain('add-history-open-count">0</span>');
    }
  });
});
