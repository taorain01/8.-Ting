const expenses = require('../../js/expenses.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('Expense ledger primitives', () => {
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
