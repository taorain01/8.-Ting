const expenses = require('../../js/expenses.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('Expense ledger primitives', () => {
  it('keeps monthly view as default and collapses filters behind one button', () => {
    expect(expenses.DEFAULT_VIEW).toMatchObject({ preset: 'month', filtersOpen: false });
    expect(expenses.expenseFilterSummary(expenses.DEFAULT_VIEW)).toBe('Tháng này · Theo ngày · Tổng tiền');
    expect(expenses.activeExpenseFilterCount(expenses.DEFAULT_VIEW)).toBe(0);
    expect(expenses.activeExpenseFilterCount({
      ...expenses.DEFAULT_VIEW,
      preset: 'year',
      kind: 'purchase',
      currency: 'USD',
    })).toBe(3);
    expect(read('js/expenses.js')).toContain('class="expense-filter-toggle');
    expect(read('js/expenses.js')).toContain("accountOptions(view.accountId, 'Mọi tài khoản')");
  });

  it('opens the filter panel without changing the monthly selection', () => {
    const content = { innerHTML: '' };
    global.appState = { expenses: [], accounts: [], expenseViewState: null };
    global.document = { getElementById: id => id === 'page-content' ? content : null };

    expenses.renderExpensesPage();
    expect(content.innerHTML).toContain('aria-expanded="false"');
    expect(content.innerHTML).toContain('id="expense-filter-panel" class="expense-filter-panel " hidden');
    expect(content.innerHTML).toContain('class="expense-add-btn"');
    expect(content.innerHTML).toContain('>Chi tiêu</h2>');
    expect(content.innerHTML).toContain('class="expense-panel expense-primary-chart"');
    expect(content.innerHTML).toContain('class="expense-panel expense-secondary-chart"');
    expect(content.innerHTML.indexOf('expense-primary-chart')).toBeLessThan(content.innerHTML.indexOf('expense-secondary-chart'));
    expect(content.innerHTML).not.toContain('Thêm khoản chi</button>');
    expect(global.appState.expenseViewState.preset).toBe('month');

    expenses.toggleExpenseFilters();
    expect(content.innerHTML).toContain('aria-expanded="true"');
    expect(content.innerHTML).toContain('class="expense-filter-panel is-open"');
    expect(global.appState.expenseViewState.preset).toBe('month');

    delete global.document;
    delete global.appState;
  });

  it('stores original amount, currency, rate snapshot and rounded VND total', () => {
    expect(expenses.normalizeExpenseMoney({
      amount: '10.50',
      currency: 'USD',
      exchangeRateToVnd: '25,500',
      spentAt: '2026-07-17',
    })).toMatchObject({
      amount: 10.5,
      currency: 'USD',
      exchangeRateToVnd: 25500,
      amountVnd: 267750,
      rateDate: '2026-07-17',
      rateSource: 'manual',
    });
  });

  it('writes an account purchase through the initialized Firestore clients', async () => {
    const writes = [];
    const collection = {
      doc: id => ({
        set: async (payload, options) => writes.push({ id, payload, options }),
      }),
    };
    global.auth = { currentUser: { uid: 'user-1' } };
    global.db = {
      collection: name => ({
        doc: userId => ({
          collection: child => {
            expect([name, userId, child]).toEqual(['users', 'user-1', 'expenses']);
            return collection;
          },
        }),
      }),
    };
    global.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'server-time' } } };
    global.appState = { expenses: [], isDemo: false };

    await expenses.syncInitialPurchaseExpenseFromAccount({
      id: 'account-1',
      name: 'Adobe Firefly',
      platform: 'adobe',
      purchaseDate: '2026-07-17',
      purchasePrice: 45000,
    });

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      id: 'purchase_account-1',
      payload: { accountId: 'account-1', amount: 45000, amountVnd: 45000, spentAt: '2026-07-17' },
      options: { merge: true },
    });
    expect(read('firebase-config.js')).toContain('window.auth = auth');
    expect(read('firebase-config.js')).toContain('window.db = db');

    delete global.auth;
    delete global.db;
    delete global.firebase;
    delete global.appState;
  });

  it('backfills priced active and trashed accounts idempotently', async () => {
    const writes = [];
    global.auth = { currentUser: { uid: 'user-1' } };
    global.db = {
      collection: () => ({
        doc: () => ({
          collection: () => ({
            doc: id => ({
              set: async payload => writes.push({ id, payload }),
            }),
          }),
        }),
      }),
    };
    global.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'server-time' } } };
    global.appState = {
      expenses: [{ id: 'purchase_known' }],
      accountsLoaded: true,
      expensesLoaded: true,
      accounts: [
        { id: 'known', purchasePrice: 10000, purchaseDate: '2026-07-01' },
        { id: 'new', purchasePrice: 45000, purchaseDate: '2026-07-17' },
        { id: 'no-price', purchaseDate: '2026-07-17' },
      ],
      trashAccounts: [{ id: 'trashed', purchasePrice: 12000, purchaseDate: '2026-06-01' }],
    };

    const stats = await expenses.backfillAccountExpenses();

    expect(stats).toMatchObject({ created: 2, skipped: 2, failed: 0, ready: true });
    expect(writes.map(item => item.id)).toEqual(['purchase_new', 'purchase_trashed']);
    expect(global.appState.expenseBackfillComplete).toBe(true);

    delete global.auth;
    delete global.db;
    delete global.firebase;
    delete global.appState;
  });

  it('continues backfill when one account write fails', async () => {
    const attempts = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.auth = { currentUser: { uid: 'user-1' } };
    global.db = {
      collection: () => ({
        doc: () => ({
          collection: () => ({
            doc: id => ({
              set: async () => {
                attempts.push(id);
                if (id === 'purchase_bad') throw new Error('network');
              },
            }),
          }),
        }),
      }),
    };
    global.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'server-time' } } };
    global.appState = {
      expenses: [],
      accountsLoaded: true,
      expensesLoaded: true,
      accounts: [
        { id: 'bad', purchasePrice: 10000, purchaseDate: '2026-07-01' },
        { id: 'good', purchasePrice: 20000, purchaseDate: '2026-07-02' },
      ],
      trashAccounts: [],
    };

    const stats = await expenses.backfillAccountExpenses();

    expect(attempts).toEqual(['purchase_bad', 'purchase_good']);
    expect(stats).toMatchObject({ created: 1, failed: 1 });
    expect(global.appState.expenseBackfillComplete).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();

    delete global.auth;
    delete global.db;
    delete global.firebase;
    delete global.appState;
  });

  it('keeps VND fixed at one and converts legacy account price fields', () => {
    expect(expenses.accountPurchaseFields({
      purchaseAmount: 12,
      purchaseCurrency: 'EUR',
      purchaseExchangeRateToVnd: 28000,
      purchaseDate: '2026-07-17',
    })).toEqual({
      purchaseAmount: 12,
      purchaseCurrency: 'EUR',
      purchaseExchangeRateToVnd: 28000,
      purchasePrice: 336000,
    });
    expect(expenses.accountPurchaseMoney({ purchasePrice: 50000 })).toMatchObject({
      amount: 50000,
      currency: 'VND',
      exchangeRateToVnd: 1,
      amountVnd: 50000,
    });
  });

  it('returns calendar ranges and groups transactions by selected bucket', () => {
    const now = new Date(2026, 6, 17);
    expect(expenses.presetRange('week', now)).toEqual({ from: '2026-07-13', to: '2026-07-19' });
    expect(expenses.aggregateExpenses([
      { spentAt: '2026-07-01', amountVnd: 100, isDeleted: false },
      { spentAt: '2026-07-02', amountVnd: 250, isDeleted: false },
      { spentAt: '2026-08-01', amountVnd: 900, isDeleted: false },
    ], 'month')).toEqual([
      { key: '2026-07', amountVnd: 350, count: 2 },
      { key: '2026-08', amountVnd: 900, count: 1 },
    ]);
  });

  it('builds the primary area timeline with zero gaps, a right-axis scale and transaction markers', () => {
    const buckets = [
      { key: '2026-07-01', amountVnd: 100000, count: 1 },
      { key: '2026-07-03', amountVnd: 300000, count: 2 },
    ];
    const timeline = expenses.buildExpenseTimeline(buckets, 'day', { from: '2026-07-01', to: '2026-07-03' });
    expect(timeline).toEqual([
      buckets[0],
      { key: '2026-07-02', amountVnd: 0, count: 0 },
      buckets[1],
    ]);

    const model = expenses.buildExpenseAreaChartModel(timeline, 'amount');
    expect(model.points).toHaveLength(3);
    expect(model.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    expect(model.areaPath).toContain(' Z');
    expect(model.linePath).not.toContain('NaN');
    expect(model.scale.ticks[0]).toBe(0);

    const html = expenses.renderExpenseAreaChart(timeline, 'amount', '2026-07-03', 'day');
    expect(html).toContain('class="expense-area-chart"');
    expect(html).toContain('id="expense-area-fill"');
    expect(html).toContain('class="expense-area-line"');
    expect(html).toContain('data-expense-chart-scroll');
    expect(html).toContain('class="expense-area-y-axis"');
    expect(html).toContain('Giữ và kéo để xem ngày khác');
    expect(html).toContain('class="expense-area-point active"');
    expect(html.match(/expense-area-event-box/g)).toHaveLength(2);

    const monthTimeline = Array.from({ length: 31 }, (_, index) => ({
      key: `2026-07-${String(index + 1).padStart(2, '0')}`,
      amountVnd: 0,
      count: 0,
    }));
    const todayHtml = expenses.renderExpenseAreaChart(monthTimeline, 'amount', '', 'day', new Date(2026, 6, 18));
    expect(todayHtml).toMatch(/data-expense-chart-today-x="[\d.]+"/);
    expect(todayHtml).toContain('class="expense-area-x-label is-today"');
    expect(todayHtml).toContain('18 thg 7');
  });

  it('sizes the chart to ten visible days and supports mouse/touch drag scrolling', () => {
    const buckets = Array.from({ length: 31 }, (_, index) => ({
      key: `2026-07-${String(index + 1).padStart(2, '0')}`,
      amountVnd: index * 1000,
      count: index % 3 === 0 ? 1 : 0,
    }));
    const model = expenses.buildExpenseAreaChartModel(buckets, 'amount', 900, 10);
    expect(model.width).toBeGreaterThan(2700);
    expect(model.points[9].x - model.points[0].x).toBeCloseTo(856, 0);
    const compactModel = expenses.buildExpenseAreaChartModel(buckets, 'amount', 220, 10);
    expect(compactModel.points[9].x - compactModel.points[0].x).toBeCloseTo(176, 0);

    const listeners = {};
    const classes = new Set();
    const scroll = {
      dataset: {}, scrollLeft: 0, scrollWidth: 2800, clientWidth: 900,
      classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
      querySelector: () => null,
      addEventListener: (type, handler) => { listeners[type] = handler; },
    };
    expenses.initExpenseAreaChartInteractions({ querySelector: () => scroll });
    expect(scroll.scrollLeft).toBe(1900);

    const todayScroll = {
      dataset: { expenseChartTodayX: '1400' }, scrollLeft: 0, scrollWidth: 2800, clientWidth: 900,
      classList: { add() {}, remove() {} },
      querySelector: () => null,
      addEventListener() {},
    };
    expenses.initExpenseAreaChartInteractions({ querySelector: () => todayScroll });
    expect(todayScroll.scrollLeft).toBe(950);

    listeners.pointerdown({ pointerType: 'mouse', button: 0, pointerId: 7, clientX: 500 });
    let prevented = false;
    listeners.pointermove({ pointerId: 7, clientX: 380, preventDefault: () => { prevented = true; } });
    expect(scroll.scrollLeft).toBe(2020);
    expect(prevented).toBe(true);
    expect(classes.has('is-dragging')).toBe(true);
    listeners.pointerup({ pointerId: 7 });
    expect(classes.has('is-dragging')).toBe(false);
  });

  it('filters deleted records and supports an account-specific view', () => {
    const items = [
      { id: 'a', accountId: 'acc-1', spentAt: '2026-07-10', kind: 'purchase', currency: 'VND', amountVnd: 100, isDeleted: false },
      { id: 'b', accountId: 'acc-2', spentAt: '2026-07-10', kind: 'renewal', currency: 'USD', amountVnd: 200, isDeleted: false },
      { id: 'c', accountId: 'acc-1', spentAt: '2026-07-10', kind: 'manual', currency: 'VND', amountVnd: 300, isDeleted: true },
    ];
    expect(expenses.filterExpenses(items, {
      ...expenses.DEFAULT_VIEW,
      preset: 'all',
      accountId: 'acc-1',
    })).toHaveLength(1);
    expect(expenses.filterExpenses(items, {
      ...expenses.DEFAULT_VIEW,
      preset: 'all',
      status: 'deleted',
    })).toHaveLength(1);
  });

  it('loads the expense runtime after each platform app and preserves expense navigation state', () => {
    const desktopHtml = read('index.html');
    const mobileHtml = read('mobile/index.html');
    expect(desktopHtml.indexOf('js/expenses.js')).toBeGreaterThan(desktopHtml.indexOf('js/desktop-app.js'));
    expect(mobileHtml.indexOf('js/expenses.js')).toBeGreaterThan(mobileHtml.indexOf('js/app.js'));
    expect(read('js/desktop-app.js')).toContain('expenseViewState: { ...(window.appState.expenseViewState || {}) }');
    expect(read('mobile/js/app.js')).toContain('expenseViewState: { ...(window.appState.expenseViewState || {}) }');
    expect(read('js/auth.js')).toContain('loadExpensesRealtime?.()');
    expect(read('js/db.js')).toContain('syncInitialPurchaseExpenseFromAccount');
  });
});
