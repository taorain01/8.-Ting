/* Ting! expense ledger, currency snapshots, analytics, and account deep links. */
(function (root) {
    'use strict';

    const CURRENCIES = [
        { code: 'VND', label: 'Việt Nam đồng', decimals: 0 },
        { code: 'USD', label: 'Đô la Mỹ', decimals: 2 },
        { code: 'EUR', label: 'Euro', decimals: 2 },
        { code: 'CNY', label: 'Nhân dân tệ', decimals: 2 },
        { code: 'JPY', label: 'Yên Nhật', decimals: 0 },
        { code: 'KRW', label: 'Won Hàn Quốc', decimals: 0 },
        { code: 'THB', label: 'Baht Thái', decimals: 2 },
        { code: 'SGD', label: 'Đô la Singapore', decimals: 2 },
        { code: 'GBP', label: 'Bảng Anh', decimals: 2 },
        { code: 'AUD', label: 'Đô la Úc', decimals: 2 },
    ];
    const CURRENCY_CODES = new Set(CURRENCIES.map(item => item.code));
    const DEFAULT_VIEW = {
        preset: 'month',
        customFrom: '',
        customTo: '',
        groupBy: 'day',
        metric: 'amount',
        breakdown: 'account',
        kind: 'all',
        accountId: '',
        currency: 'all',
        status: 'active',
        selectedBucket: '',
        filtersOpen: false,
    };

    let expensesUnsubscribe = null;
    let backfillRunning = false;

    function state() {
        if (!root.appState) return null;
        if (!Array.isArray(root.appState.expenses)) root.appState.expenses = [];
        root.appState.expenseViewState = { ...DEFAULT_VIEW, ...(root.appState.expenseViewState || {}) };
        return root.appState;
    }

    function localDate(value = new Date()) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseExpenseNumber(value) {
        if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
        let text = String(value ?? '').trim().replace(/\s+/g, '');
        if (!text) return null;
        text = text.replace(/[^\d,.-]/g, '');
        const comma = text.lastIndexOf(',');
        const dot = text.lastIndexOf('.');
        if (comma >= 0 && dot >= 0) {
            const decimal = comma > dot ? ',' : '.';
            const group = decimal === ',' ? /\./g : /,/g;
            text = text.replace(group, '').replace(decimal, '.');
        } else if (comma >= 0) {
            const tail = text.length - comma - 1;
            text = tail > 0 && tail <= 2 ? text.replace(',', '.') : text.replace(/,/g, '');
        } else if (dot >= 0) {
            const tail = text.length - dot - 1;
            if (tail === 3) text = text.replace(/\./g, '');
        }
        const number = Number(text);
        return Number.isFinite(number) && number > 0 ? number : null;
    }

    function normalizeCurrency(value) {
        const code = String(value || 'VND').trim().toUpperCase();
        return CURRENCY_CODES.has(code) ? code : 'VND';
    }

    function normalizeExpenseMoney(input = {}) {
        const currency = normalizeCurrency(input.currency);
        const amount = parseExpenseNumber(input.amount);
        const exchangeRateToVnd = currency === 'VND' ? 1 : parseExpenseNumber(input.exchangeRateToVnd);
        const amountVnd = amount && exchangeRateToVnd ? Math.round(amount * exchangeRateToVnd) : null;
        return {
            amount,
            currency,
            exchangeRateToVnd,
            amountVnd,
            rateDate: String(input.rateDate || input.spentAt || localDate()).slice(0, 10),
            rateSource: currency === 'VND' ? 'fixed-vnd' : 'manual',
        };
    }

    function formatCurrencyAmount(amount, currency = 'VND') {
        const normalized = normalizeCurrency(currency);
        const config = CURRENCIES.find(item => item.code === normalized) || CURRENCIES[0];
        const number = Number(amount || 0);
        if (!Number.isFinite(number)) return '';
        return `${number.toLocaleString('vi-VN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: config.decimals,
        })} ${normalized}`;
    }

    function formatVnd(amount) {
        const number = Math.round(Number(amount || 0));
        return `${number.toLocaleString('vi-VN')} ₫`;
    }

    function initialPurchaseExpenseId(accountId) {
        return `purchase_${String(accountId || '').replace(/[^A-Za-z0-9_-]/g, '_')}`;
    }

    function expenseKindLabel(kind) {
        return ({ purchase: 'Mua tài khoản', renewal: 'Gia hạn', manual: 'Chi phí khác' })[kind] || 'Chi tiêu';
    }

    function normalizeExpense(input = {}, existing = {}) {
        const money = normalizeExpenseMoney({
            amount: input.amount ?? existing.amount,
            currency: input.currency ?? existing.currency,
            exchangeRateToVnd: input.exchangeRateToVnd ?? existing.exchangeRateToVnd,
            rateDate: input.rateDate ?? input.spentAt ?? existing.rateDate ?? existing.spentAt,
        });
        const spentAt = String(input.spentAt || existing.spentAt || localDate()).slice(0, 10);
        const accountId = String(input.accountId ?? existing.accountId ?? '').trim() || null;
        return {
            kind: ['purchase', 'renewal', 'manual'].includes(input.kind) ? input.kind : (existing.kind || 'manual'),
            accountId,
            accountName: String(input.accountName ?? existing.accountName ?? '').trim(),
            platform: String(input.platform ?? existing.platform ?? 'other').trim() || 'other',
            sellerName: String(input.sellerName ?? existing.sellerName ?? '').trim(),
            note: String(input.note ?? existing.note ?? '').trim().slice(0, 1000),
            spentAt,
            spentTime: String(input.spentTime ?? existing.spentTime ?? '').slice(0, 5),
            amount: money.amount,
            currency: money.currency,
            exchangeRateToVnd: money.exchangeRateToVnd,
            amountVnd: money.amountVnd,
            rateDate: money.rateDate || spentAt,
            rateSource: money.rateSource,
            source: String(input.source ?? existing.source ?? 'manual'),
            sourceKey: String(input.sourceKey ?? existing.sourceKey ?? ''),
            isDeleted: input.isDeleted === true,
            deletedAt: input.deletedAt ?? existing.deletedAt ?? null,
        };
    }

    function accountPurchaseMoney(account = {}) {
        return normalizeExpenseMoney({
            amount: account.purchaseAmount ?? account.purchasePrice,
            currency: account.purchaseCurrency || 'VND',
            exchangeRateToVnd: account.purchaseExchangeRateToVnd || 1,
            spentAt: account.purchaseDate,
        });
    }

    function accountPurchaseFields(input = {}) {
        const money = normalizeExpenseMoney({
            amount: input.purchaseAmount ?? input.purchasePrice,
            currency: input.purchaseCurrency || 'VND',
            exchangeRateToVnd: input.purchaseExchangeRateToVnd || 1,
            spentAt: input.purchaseDate,
        });
        return {
            purchaseAmount: money.amount,
            purchaseCurrency: money.currency,
            purchaseExchangeRateToVnd: money.exchangeRateToVnd,
            purchasePrice: money.amountVnd,
        };
    }

    function expenseFromAccount(account = {}) {
        const money = accountPurchaseMoney(account);
        return normalizeExpense({
            kind: 'purchase',
            accountId: account.id,
            accountName: account.name,
            platform: account.platform,
            sellerName: account.sellerName,
            spentAt: account.purchaseDate || localDate(),
            spentTime: account.purchaseTime || '',
            amount: money.amount,
            currency: money.currency,
            exchangeRateToVnd: money.exchangeRateToVnd,
            rateDate: account.purchaseDate || localDate(),
            source: 'account-purchase',
            sourceKey: initialPurchaseExpenseId(account.id),
        });
    }

    function expenseCollection() {
        const authClient = root.auth || (typeof auth !== 'undefined' ? auth : null);
        const firestore = root.db || (typeof db !== 'undefined' ? db : null);
        const userId = authClient?.currentUser?.uid;
        if (!userId || !firestore) return null;
        return firestore.collection('users').doc(userId).collection('expenses');
    }

    async function saveExpense(input, options = {}) {
        const app = state();
        const normalized = normalizeExpense(input, options.existing || {});
        if (!normalized.amount || !normalized.amountVnd) throw new Error('Nhập số tiền và tỷ giá hợp lệ');
        const id = options.id || input.id || `expense_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        if (app?.isDemo) {
            const index = app.expenses.findIndex(item => item.id === id);
            const saved = { ...(index >= 0 ? app.expenses[index] : {}), ...normalized, id, updatedAt: new Date() };
            if (!saved.createdAt) saved.createdAt = new Date();
            if (index >= 0) app.expenses[index] = saved;
            else app.expenses.unshift(saved);
            return saved;
        }
        const collection = expenseCollection();
        if (!collection) throw new Error('Chưa đăng nhập');
        const ref = collection.doc(id);
        const payload = {
            ...normalized,
            updatedAt: root.firebase.firestore.FieldValue.serverTimestamp(),
        };
        if (!options.existing && !input.createdAt) payload.createdAt = root.firebase.firestore.FieldValue.serverTimestamp();
        await ref.set(payload, { merge: true });
        return { ...normalized, id };
    }

    async function syncInitialPurchaseExpenseFromAccount(account = {}) {
        if (!account.id) return null;
        const id = initialPurchaseExpenseId(account.id);
        const app = state();
        const existing = app?.expenses?.find(item => item.id === id);
        const input = expenseFromAccount(account);
        if (existing?.isDeleted) return existing;
        if (!input.amount || !input.amountVnd) {
            if (existing && !existing.isDeleted) await softDeleteExpense(id, { syncAccount: false });
            return null;
        }
        return saveExpense({ ...input, isDeleted: false, deletedAt: null }, { id, existing });
    }

    async function backfillAccountExpenses() {
        const app = state();
        if (!app || app.expensesLoaded !== true || app.accountsLoaded !== true) {
            return { created: 0, skipped: 0, failed: 0, ready: false };
        }
        if (backfillRunning) return { created: 0, skipped: 0, failed: 0, running: true };
        backfillRunning = true;
        const stats = { created: 0, skipped: 0, failed: 0, ready: true };
        try {
            const known = new Set(app.expenses.map(item => item.id));
            const accountsById = new Map();
            [...(app.accounts || []), ...(app.trashAccounts || [])].forEach(account => {
                if (account?.id) accountsById.set(account.id, account);
            });
            for (const account of accountsById.values()) {
                const id = initialPurchaseExpenseId(account.id);
                const money = accountPurchaseMoney(account);
                if (known.has(id) || !money.amount || !money.amountVnd) {
                    stats.skipped += 1;
                    continue;
                }
                try {
                    await syncInitialPurchaseExpenseFromAccount(account);
                    known.add(id);
                    stats.created += 1;
                } catch (error) {
                    stats.failed += 1;
                    console.warn(`Expense backfill failed for account ${account.id}:`, error);
                }
            }
            app.expenseBackfillComplete = stats.failed === 0;
            app.expenseBackfillStats = { ...stats };
            if (stats.failed && !app.expenseBackfillWarningShown) {
                app.expenseBackfillWarningShown = true;
                root.showToast?.(`Chưa đồng bộ được ${stats.failed} khoản chi cũ`, 'warning');
            }
            return stats;
        } catch (error) {
            stats.failed += 1;
            app.expenseBackfillComplete = false;
            app.expenseBackfillStats = { ...stats };
            console.warn('Expense backfill failed:', error);
            return stats;
        } finally {
            backfillRunning = false;
        }
    }

    function mapExpenseDoc(doc) {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null,
            deletedAt: data.deletedAt?.toDate?.() || data.deletedAt || null,
            pendingSync: Boolean(doc.metadata?.hasPendingWrites),
        };
    }

    function loadExpensesRealtime() {
        const app = state();
        const collection = expenseCollection();
        if (!app || !collection) return;
        stopExpensesRealtime();
        expensesUnsubscribe = collection.orderBy('spentAt', 'desc').onSnapshot(
            { includeMetadataChanges: true },
            snapshot => {
                app.expenses = snapshot.docs.map(mapExpenseDoc);
                app.expensesLoaded = true;
                backfillAccountExpenses();
                if (app.currentPage === 'expenses') renderExpensesPage();
                if (app.currentPage === 'dashboard' && typeof root.renderDashboard === 'function') root.renderDashboard();
            },
            error => {
                console.error('Expense realtime error:', error);
                app.expensesLoaded = true;
                if (typeof root.showToast === 'function') root.showToast('Không tải được dữ liệu chi tiêu', 'error');
            }
        );
    }

    function stopExpensesRealtime() {
        if (typeof expensesUnsubscribe === 'function') expensesUnsubscribe();
        expensesUnsubscribe = null;
        const app = state();
        if (app) app.expensesLoaded = false;
    }

    async function softDeleteExpense(id, options = {}) {
        const app = state();
        const item = app?.expenses?.find(expense => expense.id === id);
        if (!item) return false;
        if (app.isDemo) {
            item.isDeleted = true;
            item.deletedAt = new Date();
            return true;
        }
        const collection = expenseCollection();
        if (!collection) return false;
        await collection.doc(id).update({
            isDeleted: true,
            deletedAt: root.firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: root.firebase.firestore.FieldValue.serverTimestamp(),
        });
        return true;
    }

    async function restoreExpense(id) {
        const app = state();
        const item = app?.expenses?.find(expense => expense.id === id);
        if (!item) return false;
        if (app.isDemo) {
            item.isDeleted = false;
            item.deletedAt = null;
            return true;
        }
        const collection = expenseCollection();
        if (!collection) return false;
        await collection.doc(id).update({
            isDeleted: false,
            deletedAt: null,
            updatedAt: root.firebase.firestore.FieldValue.serverTimestamp(),
        });
        return true;
    }

    function addDays(date, days) {
        const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        next.setDate(next.getDate() + days);
        return next;
    }

    function startOfWeek(date) {
        const day = date.getDay() || 7;
        return addDays(date, 1 - day);
    }

    function presetRange(preset, now = new Date(), customFrom = '', customTo = '') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (preset === 'all') return { from: '', to: '' };
        if (preset === 'custom') return { from: customFrom, to: customTo };
        if (preset === 'week') return { from: localDate(startOfWeek(today)), to: localDate(addDays(startOfWeek(today), 6)) };
        if (preset === '7d') return { from: localDate(addDays(today, -6)), to: localDate(today) };
        if (preset === '30d') return { from: localDate(addDays(today, -29)), to: localDate(today) };
        if (preset === '3m') return { from: localDate(new Date(today.getFullYear(), today.getMonth() - 2, 1)), to: localDate(today) };
        if (preset === '6m') return { from: localDate(new Date(today.getFullYear(), today.getMonth() - 5, 1)), to: localDate(today) };
        if (preset === 'year') return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
        return { from: localDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: localDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)) };
    }

    function bucketKey(dateText, groupBy) {
        const date = new Date(`${dateText}T00:00:00`);
        if (Number.isNaN(date.getTime())) return dateText;
        if (groupBy === 'month') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (groupBy === 'week') return localDate(startOfWeek(date));
        return localDate(date);
    }

    function filterExpenses(items, view, now = new Date()) {
        const range = presetRange(view.preset, now, view.customFrom, view.customTo);
        return (Array.isArray(items) ? items : []).filter(item => {
            if (view.status === 'deleted' ? item.isDeleted !== true : item.isDeleted === true) return false;
            if (range.from && item.spentAt < range.from) return false;
            if (range.to && item.spentAt > range.to) return false;
            if (view.kind !== 'all' && item.kind !== view.kind) return false;
            if (view.accountId && item.accountId !== view.accountId) return false;
            if (view.currency !== 'all' && item.currency !== view.currency) return false;
            if (view.selectedBucket && bucketKey(item.spentAt, view.groupBy) !== view.selectedBucket) return false;
            return true;
        });
    }

    function aggregateExpenses(items, groupBy = 'day') {
        const buckets = new Map();
        (items || []).forEach(item => {
            const key = bucketKey(item.spentAt, groupBy);
            const current = buckets.get(key) || { key, amountVnd: 0, count: 0 };
            current.amountVnd += Number(item.amountVnd || 0);
            current.count += 1;
            buckets.set(key, current);
        });
        return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
    }

    function breakdownExpenses(items, mode = 'account') {
        const groups = new Map();
        (items || []).forEach(item => {
            let key = 'other';
            let label = 'Khác';
            if (mode === 'platform') {
                key = item.platform || 'other';
                label = typeof root.getPlatformName === 'function' ? root.getPlatformName(key) : key;
            } else {
                key = item.accountId || `manual:${item.accountName || 'other'}`;
                label = item.accountName || 'Không gắn tài khoản';
            }
            const current = groups.get(key) || { key, label, accountId: mode === 'account' ? item.accountId : null, amountVnd: 0, count: 0 };
            current.amountVnd += Number(item.amountVnd || 0);
            current.count += 1;
            groups.set(key, current);
        });
        return [...groups.values()].sort((a, b) => b.amountVnd - a.amountVnd);
    }

    function safe(value) {
        return typeof root.escapeHtml === 'function'
            ? root.escapeHtml(String(value ?? ''))
            : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    }

    function js(value) {
        return typeof root.escapeJsString === 'function'
            ? root.escapeJsString(String(value ?? ''))
            : String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function renderCurrencyOptions(selected = 'VND', includeAll = false) {
        const options = includeAll ? '<option value="all">Mọi tiền tệ</option>' : '';
        return options + CURRENCIES.map(item => `<option value="${item.code}" ${item.code === selected ? 'selected' : ''}>${item.code} · ${safe(item.label)}</option>`).join('');
    }

    function renderExpenseMoneyFields(values = {}, prefix = 'expense') {
        const money = normalizeExpenseMoney({
            amount: values.amount,
            currency: values.currency || 'VND',
            exchangeRateToVnd: values.exchangeRateToVnd || 1,
            spentAt: values.spentAt,
        });
        const rateHidden = money.currency === 'VND' ? 'hidden' : '';
        return `<div class="expense-money-grid">
            <label class="expense-field"><span>Số tiền gốc</span><input id="${prefix}-amount" class="input" type="number" min="0" step="0.01" value="${money.amount || ''}" oninput="updateExpenseConversionPreview('${prefix}')"></label>
            <label class="expense-field"><span>Tiền tệ</span><select id="${prefix}-currency" class="input" onchange="toggleExpenseRateField('${prefix}');updateExpenseConversionPreview('${prefix}')">${renderCurrencyOptions(money.currency)}</select></label>
            <label id="${prefix}-rate-wrap" class="expense-field expense-rate-field" ${rateHidden}><span>Tỷ giá: 1 ${money.currency} = VND</span><input id="${prefix}-rate" class="input" type="number" min="0" step="0.01" value="${money.currency === 'VND' ? 1 : (money.exchangeRateToVnd || '')}" oninput="updateExpenseConversionPreview('${prefix}')"></label>
        </div><div id="${prefix}-conversion" class="expense-conversion-preview"></div>`;
    }

    function renderAccountPurchaseCurrencyControls(account = {}) {
        const money = accountPurchaseMoney(account);
        const preview = money.amountVnd
            ? `${formatCurrencyAmount(money.amount, money.currency)} = ${formatVnd(money.amountVnd)} · tỷ giá được lưu theo ngày mua`
            : 'Để trống nếu không muốn ghi nhận chi tiêu.';
        return `<div class="expense-money-grid expense-account-money">
            <label class="expense-field"><span>Tiền tệ</span><select id="add-currency" class="input" onchange="toggleAccountPurchaseRate();updateAccountPurchaseConversionPreview()">${renderCurrencyOptions(money.currency)}</select></label>
            <label id="add-exchange-rate-wrap" class="expense-field expense-rate-field" ${money.currency === 'VND' ? 'hidden' : ''}><span>Tỷ giá: 1 ${money.currency} = VND</span><input id="add-exchange-rate" class="input" type="number" min="0" step="0.01" value="${money.currency === 'VND' ? 1 : (money.exchangeRateToVnd || '')}" oninput="updateAccountPurchaseConversionPreview()"></label>
        </div><div id="add-purchase-conversion" class="expense-conversion-preview">${safe(preview)}</div>`;
    }

    function readAccountPurchaseMoneyFields() {
        return normalizeExpenseMoney({
            amount: document.getElementById('add-price')?.value,
            currency: document.getElementById('add-currency')?.value || 'VND',
            exchangeRateToVnd: document.getElementById('add-exchange-rate')?.value || 1,
            spentAt: document.getElementById('add-purchase')?.value || localDate(),
        });
    }

    function toggleAccountPurchaseRate() {
        const currency = normalizeCurrency(document.getElementById('add-currency')?.value);
        const wrap = document.getElementById('add-exchange-rate-wrap');
        const rate = document.getElementById('add-exchange-rate');
        if (wrap) wrap.hidden = currency === 'VND';
        if (rate && currency === 'VND') rate.value = '1';
        const label = wrap?.querySelector('span');
        if (label) label.textContent = `Tỷ giá: 1 ${currency} = VND`;
        const amount = document.getElementById('add-price');
        if (amount) formatAccountPurchaseAmountField(amount);
    }

    function formatAccountPurchaseAmountField(input) {
        if (!input) return;
        const currency = normalizeCurrency(document.getElementById('add-currency')?.value || 'VND');
        if (currency === 'VND' && typeof root.formatPriceField === 'function') root.formatPriceField(input);
        else input.value = String(input.value || '').replace(/[^\d.,]/g, '');
    }

    function updateAccountPurchaseConversionPreview() {
        const money = readAccountPurchaseMoneyFields();
        const target = document.getElementById('add-purchase-conversion');
        if (!target) return money;
        if (!money.amount) target.textContent = 'Để trống nếu không muốn ghi nhận chi tiêu.';
        else if (!money.amountVnd) target.textContent = `Nhập tỷ giá ${money.currency}/VND tại ngày mua.`;
        else target.textContent = `${formatCurrencyAmount(money.amount, money.currency)} = ${formatVnd(money.amountVnd)} · tỷ giá được lưu theo ngày mua`;
        return money;
    }

    function readExpenseMoneyFields(prefix = 'expense') {
        return normalizeExpenseMoney({
            amount: document.getElementById(`${prefix}-amount`)?.value,
            currency: document.getElementById(`${prefix}-currency`)?.value,
            exchangeRateToVnd: document.getElementById(`${prefix}-rate`)?.value,
            spentAt: document.getElementById('expense-spent-at')?.value || localDate(),
        });
    }

    function toggleExpenseRateField(prefix = 'expense') {
        const currency = normalizeCurrency(document.getElementById(`${prefix}-currency`)?.value);
        const wrap = document.getElementById(`${prefix}-rate-wrap`);
        const rate = document.getElementById(`${prefix}-rate`);
        if (wrap) wrap.hidden = currency === 'VND';
        if (rate && currency === 'VND') rate.value = '1';
        const label = wrap?.querySelector('span');
        if (label) label.textContent = `Tỷ giá: 1 ${currency} = VND`;
    }

    function updateExpenseConversionPreview(prefix = 'expense') {
        const money = readExpenseMoneyFields(prefix);
        const target = document.getElementById(`${prefix}-conversion`);
        if (!target) return money;
        if (!money.amount) target.textContent = 'Nhập số tiền để ghi nhận.';
        else if (!money.amountVnd) target.textContent = `Nhập tỷ giá ${money.currency}/VND tại thời điểm chi.`;
        else target.textContent = `${formatCurrencyAmount(money.amount, money.currency)} = ${formatVnd(money.amountVnd)} · tỷ giá được lưu cố định`;
        return money;
    }

    function accountOptions(selectedId = '', emptyLabel = 'Không gắn tài khoản') {
        const accounts = state()?.accounts || [];
        return `<option value="">${safe(emptyLabel)}</option>` + accounts.map(account => (
            `<option value="${safe(account.id)}" ${account.id === selectedId ? 'selected' : ''}>${safe(account.name || account.id)}</option>`
        )).join('');
    }

    function expenseFormHtml(item = {}, context = 'manual') {
        const account = (state()?.accounts || []).find(acc => acc.id === item.accountId);
        const spentAt = item.spentAt || localDate();
        const kind = item.kind || (context === 'renewal' ? 'renewal' : 'manual');
        const lockedPurchase = item.source === 'account-purchase';
        const title = item.id ? 'Lưu thay đổi' : (context === 'renewal' ? 'Gia hạn và ghi chi tiêu' : 'Lưu khoản chi');
        const renewalFields = context === 'renewal'
            ? `<label class="expense-field"><span>Số ngày gia hạn</span><input id="expense-renew-days" class="input" type="number" min="1" max="3650" value="${Number(item.days || 30)}"></label>`
            : '';
        return `<div class="expense-form" data-expense-id="${safe(item.id || '')}" data-context="${safe(context)}">
            <div class="expense-form-grid">
                <label class="expense-field"><span>Loại giao dịch</span><select id="expense-kind" class="input" ${context === 'renewal' || lockedPurchase ? 'disabled' : ''}>
                    <option value="purchase" ${kind === 'purchase' ? 'selected' : ''}>Mua tài khoản</option>
                    <option value="renewal" ${kind === 'renewal' ? 'selected' : ''}>Gia hạn</option>
                    <option value="manual" ${kind === 'manual' ? 'selected' : ''}>Chi phí khác</option>
                </select></label>
                <label class="expense-field"><span>Tài khoản (tùy chọn)</span><select id="expense-account" class="input" onchange="syncExpenseAccountFields()" ${lockedPurchase || context === 'renewal' ? 'disabled' : ''}>${accountOptions(item.accountId || '')}</select></label>
                ${renewalFields}
                <label class="expense-field"><span>Ngày chi</span><input id="expense-spent-at" class="input" type="date" value="${safe(spentAt)}" onchange="updateExpenseConversionPreview('expense')"></label>
                <label class="expense-field"><span>Giờ chi</span><input id="expense-spent-time" class="input" type="time" value="${safe(item.spentTime || '')}"></label>
            </div>
            ${renderExpenseMoneyFields({ amount: item.amount, currency: item.currency, exchangeRateToVnd: item.exchangeRateToVnd, spentAt }, 'expense')}
            <div class="expense-form-grid">
                <label class="expense-field"><span>Người bán / nguồn</span><input id="expense-seller" class="input" maxlength="255" value="${safe(item.sellerName || account?.sellerName || '')}"></label>
                <label class="expense-field expense-field-wide"><span>Ghi chú</span><textarea id="expense-note" class="input" maxlength="1000" rows="3">${safe(item.note || '')}</textarea></label>
            </div>
            <button id="expense-submit" class="btn btn-primary" type="button" onclick="submitExpenseForm()">${title}</button>
        </div>`;
    }

    function openExpenseForm(id = '') {
        const item = state()?.expenses?.find(expense => expense.id === id) || {};
        if (typeof root.openModal !== 'function') return;
        root.openModal(id ? 'Sửa khoản chi' : 'Thêm khoản chi', expenseFormHtml(item, 'manual'));
        toggleExpenseRateField('expense');
        updateExpenseConversionPreview('expense');
    }

    function openRenewExpenseDialog(accountId, days = 30) {
        const account = (state()?.accounts || []).find(item => item.id === accountId);
        if (!account || typeof root.openModal !== 'function') return;
        const item = {
            kind: 'renewal', accountId, accountName: account.name, platform: account.platform,
            sellerName: account.sellerName, spentAt: localDate(), days,
            currency: account.purchaseCurrency || 'VND', exchangeRateToVnd: account.purchaseExchangeRateToVnd || 1,
        };
        root.openModal(`Gia hạn ${account.name}`, expenseFormHtml(item, 'renewal'));
        toggleExpenseRateField('expense');
        updateExpenseConversionPreview('expense');
    }

    function syncExpenseAccountFields() {
        const accountId = document.getElementById('expense-account')?.value;
        const account = (state()?.accounts || []).find(item => item.id === accountId);
        const seller = document.getElementById('expense-seller');
        if (account && seller && !seller.value.trim()) seller.value = account.sellerName || '';
    }

    async function renewWithExpense(accountId, days, expenseInput) {
        const app = state();
        const account = app?.accounts?.find(item => item.id === accountId);
        if (!account) throw new Error('Không tìm thấy tài khoản');
        const newExpiry = root.getRenewedExpiryDate(account.expiryDate, days);
        const expenseId = expenseInput?.amountVnd
            ? `renewal_${String(accountId).replace(/[^A-Za-z0-9_-]/g, '_')}_${Date.now().toString(36)}`
            : null;
        const entry = { date: expenseInput?.spentAt || localDate(), days, expenseId };
        const history = [...(account.renewalHistory || []), entry];
        const update = { expiryDate: newExpiry, renewalHistory: history, status: root.getStatusFromExpiry(newExpiry, account.expiryType) };
        if (app.isDemo) Object.assign(account, update);
        else if (!await root.updateAccountInDB(accountId, update)) throw new Error('Không thể gia hạn tài khoản');
        if (expenseId) {
            await saveExpense({
                ...expenseInput,
                id: expenseId,
                kind: 'renewal',
                accountId,
                accountName: account.name,
                platform: account.platform,
                sellerName: expenseInput.sellerName || account.sellerName || '',
                source: 'account-renewal',
                sourceKey: expenseId,
            }, { id: expenseId });
        }
        if (app.isDemo) {
            root.updateHeader?.();
            root.rerenderCurrentView?.(accountId);
        }
        return { expenseId, newExpiry };
    }

    async function submitExpenseForm() {
        const form = document.querySelector('.expense-form');
        if (!form) return;
        const button = document.getElementById('expense-submit');
        if (button) button.disabled = true;
        try {
            const money = updateExpenseConversionPreview('expense');
            const context = form.dataset.context || 'manual';
            const id = form.dataset.expenseId || '';
            const accountId = document.getElementById('expense-account')?.value || null;
            const account = (state()?.accounts || []).find(item => item.id === accountId);
            const input = normalizeExpense({
                id,
                kind: context === 'renewal' ? 'renewal' : document.getElementById('expense-kind')?.value,
                accountId,
                accountName: account?.name || '',
                platform: account?.platform || 'other',
                sellerName: document.getElementById('expense-seller')?.value,
                note: document.getElementById('expense-note')?.value,
                spentAt: document.getElementById('expense-spent-at')?.value,
                spentTime: document.getElementById('expense-spent-time')?.value,
                ...money,
                source: id ? undefined : 'manual',
            }, id ? state()?.expenses?.find(item => item.id === id) : {});
            if (context === 'renewal') {
                const days = Number(document.getElementById('expense-renew-days')?.value || 0);
                if (!Number.isFinite(days) || days < 1) throw new Error('Số ngày gia hạn không hợp lệ');
                if (!money.amount && document.getElementById('expense-amount')?.value) throw new Error('Số tiền không hợp lệ');
                await renewWithExpense(accountId, days, money.amount ? input : null);
                root.showToast?.(money.amount ? `Đã gia hạn và ghi ${formatVnd(money.amountVnd)}` : `Đã gia hạn +${days} ngày`, 'success');
            } else {
                if (!money.amount || !money.amountVnd) throw new Error('Nhập số tiền và tỷ giá hợp lệ');
                const existing = id ? state()?.expenses?.find(item => item.id === id) : null;
                if (existing?.source === 'account-purchase' && existing.accountId) {
                    const accountUpdate = {
                        purchaseDate: input.spentAt,
                        purchaseTime: input.spentTime || '',
                        purchaseAmount: input.amount,
                        purchaseCurrency: input.currency,
                        purchaseExchangeRateToVnd: input.exchangeRateToVnd,
                        purchasePrice: input.amountVnd,
                    };
                    const linked = (state()?.accounts || []).find(item => item.id === existing.accountId);
                    if (state()?.isDemo) Object.assign(linked || {}, accountUpdate);
                    else if (!await root.updateAccountInDB(existing.accountId, accountUpdate, { skipExpenseSync: true })) throw new Error('Không đồng bộ được tài khoản');
                }
                await saveExpense(input, { id: id || undefined, existing });
                root.showToast?.(id ? 'Đã cập nhật khoản chi' : 'Đã lưu khoản chi', 'success');
            }
            root.closeModal?.();
            if (state()?.currentPage === 'expenses') renderExpensesPage();
            else if (state()?.currentPage === 'dashboard') root.renderDashboard?.();
        } catch (error) {
            console.error('Expense save failed:', error);
            root.showToast?.(error?.message || 'Không lưu được khoản chi', 'error');
        } finally {
            if (button) button.disabled = false;
        }
    }

    async function requestDeleteExpense(id) {
        const ok = typeof root.confirmAction === 'function'
            ? await root.confirmAction({ variant: 'danger', title: 'Xóa khoản chi?', message: 'Khoản chi sẽ chuyển vào mục đã xóa và có thể khôi phục.', confirmLabel: 'Xóa khoản chi' })
            : root.confirm?.('Xóa khoản chi này?');
        if (!ok) return;
        await softDeleteExpense(id);
        root.showToast?.('Đã chuyển khoản chi vào mục đã xóa', 'success');
        renderExpensesPage();
    }

    async function requestRestoreExpense(id) {
        await restoreExpense(id);
        root.showToast?.('Đã khôi phục khoản chi', 'success');
        renderExpensesPage();
    }

    function setExpenseView(key, value) {
        const app = state();
        if (!app) return;
        app.expenseViewState[key] = value;
        if (key !== 'selectedBucket') app.expenseViewState.selectedBucket = '';
        renderExpensesPage();
    }

    function toggleExpenseFilters() {
        const app = state();
        if (!app) return;
        app.expenseViewState.filtersOpen = !app.expenseViewState.filtersOpen;
        renderExpensesPage();
    }

    function expenseFilterSummary(view = DEFAULT_VIEW) {
        const presetLabels = {
            week: 'Tuần này', '7d': '7 ngày', month: 'Tháng này', '30d': '30 ngày',
            '3m': '3 tháng', '6m': '6 tháng', year: 'Năm nay', all: 'Tất cả', custom: 'Tùy chọn',
        };
        const groupLabels = { day: 'Theo ngày', week: 'Theo tuần', month: 'Theo tháng' };
        const metricLabels = { amount: 'Tổng tiền', count: 'Số lần mua' };
        return [
            presetLabels[view.preset] || presetLabels.month,
            groupLabels[view.groupBy] || groupLabels.day,
            metricLabels[view.metric] || metricLabels.amount,
        ].join(' · ');
    }

    function activeExpenseFilterCount(view = DEFAULT_VIEW) {
        return ['preset', 'groupBy', 'metric', 'kind', 'accountId', 'currency', 'status']
            .reduce((count, key) => count + (view[key] !== DEFAULT_VIEW[key] ? 1 : 0), 0);
    }

    function selectExpenseBucket(key) {
        const app = state();
        if (!app) return;
        app.expenseViewState.selectedBucket = app.expenseViewState.selectedBucket === key ? '' : key;
        renderExpensesPage();
    }

    function parseExpenseBucketDate(key, groupBy = 'day') {
        const value = groupBy === 'month' && /^\d{4}-\d{2}$/.test(String(key || ''))
            ? `${key}-01`
            : String(key || '');
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function buildExpenseTimeline(buckets, groupBy = 'day', range = {}) {
        const source = [...(buckets || [])].sort((a, b) => a.key.localeCompare(b.key));
        if (!source.length) return [];
        const firstKey = bucketKey(range.from || source[0].key, groupBy);
        const lastKey = bucketKey(range.to || source[source.length - 1].key, groupBy);
        const firstDate = parseExpenseBucketDate(firstKey, groupBy);
        const lastDate = parseExpenseBucketDate(lastKey, groupBy);
        if (!firstDate || !lastDate || firstDate > lastDate) return source;

        const byKey = new Map(source.map(item => [item.key, item]));
        const timeline = [];
        const cursor = new Date(firstDate);
        for (let index = 0; cursor <= lastDate && index <= 240; index += 1) {
            const key = bucketKey(localDate(cursor), groupBy);
            const item = byKey.get(key);
            timeline.push(item ? { ...item } : { key, amountVnd: 0, count: 0 });
            if (groupBy === 'month') cursor.setMonth(cursor.getMonth() + 1, 1);
            else cursor.setDate(cursor.getDate() + (groupBy === 'week' ? 7 : 1));
        }
        return cursor <= lastDate ? source : timeline;
    }

    function niceExpenseChartScale(maxValue, metric = 'amount') {
        const value = Math.max(0, Number(maxValue || 0));
        if (metric === 'count') {
            const step = Math.max(1, Math.ceil(value / 3));
            const max = Math.max(step, Math.ceil(value / step) * step);
            return { max, step, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step) };
        }
        if (!value) return { max: 1, step: 1, ticks: [0, 1] };
        const roughStep = value / 3;
        const magnitude = 10 ** Math.floor(Math.log10(roughStep));
        const fraction = roughStep / magnitude;
        const factor = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 4 ? 4 : fraction <= 5 ? 5 : 10;
        const step = factor * magnitude;
        const max = Math.ceil(value / step) * step;
        return { max, step, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step) };
    }

    function getExpenseChartViewportWidth() {
        const contentWidth = typeof document !== 'undefined'
            ? Number(document.getElementById('page-content')?.clientWidth || 0)
            : 0;
        const windowWidth = Number(root.innerWidth || 0);
        const compact = windowWidth > 0 && windowWidth <= 600;
        return Math.max(220, (contentWidth || windowWidth || 1040) - (compact ? 60 : 100));
    }

    function buildExpenseAreaChartModel(buckets, metric = 'amount', viewportWidth = 940, visiblePoints = 10) {
        const values = (buckets || []).map(item => metric === 'count' ? item.count : item.amountVnd);
        const scale = niceExpenseChartScale(Math.max(...values, 0), metric);
        const safeVisiblePoints = Math.max(2, Number(visiblePoints || 10));
        const left = 22;
        const right = 22;
        const safeViewportWidth = Math.max(220, Number(viewportWidth || 940));
        const pointSpacing = Math.max(18, (safeViewportWidth - left - right) / (safeVisiblePoints - 1));
        const width = Math.max(safeViewportWidth, left + right + Math.max(1, values.length - 1) * pointSpacing);
        const height = 300;
        const top = 20;
        const baseline = 236;
        const plotWidth = width - left - right;
        const plotHeight = baseline - top;
        const points = values.map((value, index) => ({
            bucket: buckets[index],
            value,
            x: values.length === 1 ? left + plotWidth / 2 : left + index * plotWidth / (values.length - 1),
            y: top + (1 - value / scale.max) * plotHeight,
        }));
        const pointPath = points.map(point => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ');
        return {
            width, height, left, right, top, baseline, plotWidth, plotHeight, points, scale,
            linePath: pointPath ? `M ${pointPath}` : '',
            areaPath: pointPath ? `M ${points[0].x.toFixed(1)} ${baseline} L ${pointPath} L ${points[points.length - 1].x.toFixed(1)} ${baseline} Z` : '',
            labelEvery: 2,
        };
    }

    function formatExpenseBucketLabel(key, groupBy = 'day') {
        if (groupBy === 'month' && /^\d{4}-\d{2}$/.test(String(key || ''))) {
            const [year, month] = String(key).split('-');
            return `Thg ${Number(month)}/${year}`;
        }
        const date = parseExpenseBucketDate(key, groupBy);
        if (!date) return String(key || '');
        const label = `${date.getDate()} thg ${date.getMonth() + 1}`;
        return groupBy === 'week' ? `Từ ${label}` : label;
    }

    function renderExpenseAreaChart(buckets, metric, selectedBucket, groupBy = 'day', today = new Date()) {
        if (!buckets.length) return '<div class="expense-empty-chart">Chưa có dữ liệu trong khoảng đã chọn.</div>';
        const model = buildExpenseAreaChartModel(buckets, metric, getExpenseChartViewportWidth(), 10);
        const todayKey = bucketKey(localDate(today), groupBy);
        const todayIndex = model.points.findIndex(point => point.bucket.key === todayKey);
        const todayPoint = todayIndex >= 0 ? model.points[todayIndex] : null;
        const tickLines = model.scale.ticks.map(value => {
            const y = model.top + (1 - value / model.scale.max) * model.plotHeight;
            return `<g class="expense-area-grid"><line x1="${model.left}" y1="${y}" x2="${model.width - model.right}" y2="${y}"></line></g>`;
        }).join('');
        const yAxisLabels = model.scale.ticks.map(value => {
            const y = model.top + (1 - value / model.scale.max) * model.plotHeight;
            const label = metric === 'count' ? String(value) : compactVnd(value);
            return `<span style="top:${(y / model.height * 100).toFixed(2)}%">${safe(label)}</span>`;
        }).join('');
        const labelIndexes = new Set([0, model.points.length - 1]);
        const labelEvery = groupBy === 'day' ? 2 : 1;
        model.points.forEach((_, index) => { if (index % labelEvery === 0) labelIndexes.add(index); });
        if (todayIndex >= 0) labelIndexes.add(todayIndex);
        const xLabels = [...labelIndexes].sort((a, b) => a - b).map(index => {
            const point = model.points[index];
            const todayClass = point.bucket.key === todayKey ? ' is-today' : '';
            return `<text class="expense-area-x-label${todayClass}" x="${point.x}" y="286" text-anchor="middle">${safe(formatExpenseBucketLabel(point.bucket.key, groupBy))}</text>`;
        }).join('');
        const events = model.points.filter(point => point.bucket.count > 0).map(point => {
            const active = selectedBucket === point.bucket.key;
            const valueLabel = metric === 'count' ? `${point.value} giao dịch` : formatVnd(point.value);
            const key = js(point.bucket.key);
            return `<g class="expense-area-point${active ? ' active' : ''}" data-chart-x="${point.x}" role="button" tabindex="0" onclick="selectExpenseBucket('${key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectExpenseBucket('${key}')}" aria-label="${safe(`${point.bucket.key}: ${valueLabel}`)}">
                <title>${safe(`${point.bucket.key} · ${valueLabel}`)}</title>
                ${active ? `<line class="expense-area-guide" x1="${point.x}" y1="${model.top}" x2="${point.x}" y2="${model.baseline}"></line>` : ''}
                <rect class="expense-area-hit" x="${point.x - 22}" y="${model.top}" width="44" height="${model.baseline - model.top + 28}"></rect>
                <circle cx="${point.x}" cy="${point.y}" r="${active ? 5.5 : 3.5}"></circle>
                <rect class="expense-area-event-box" x="${point.x - 10}" y="${model.baseline + 10}" width="20" height="17" rx="4"></rect>
                <text class="expense-area-event-count" x="${point.x}" y="${model.baseline + 22}" text-anchor="middle">${point.bucket.count > 9 ? '9+' : point.bucket.count}</text>
            </g>`;
        }).join('');
        const activeDays = buckets.filter(item => item.count > 0).length;
        const peak = Math.max(...buckets.map(item => metric === 'count' ? item.count : item.amountVnd), 0);
        return `<div class="expense-area-chart-shell"><div class="expense-area-chart-scroll" data-expense-chart-scroll data-expense-chart-today-x="${todayPoint ? todayPoint.x : ''}" tabindex="0" aria-label="Giữ và kéo ngang để xem các ngày khác"><svg class="expense-area-chart" style="width:${model.width}px" viewBox="0 0 ${model.width} ${model.height}" role="img" aria-label="Biểu đồ đường chi tiêu theo thời gian">
            <defs><linearGradient id="expense-area-fill" x1="0" y1="0" x2="0" y2="1"><stop class="expense-area-stop-start" offset="0%"></stop><stop class="expense-area-stop-end" offset="100%"></stop></linearGradient></defs>
            ${tickLines}
            <path class="expense-area-fill" d="${model.areaPath}"></path>
            <path class="expense-area-line" d="${model.linePath}"></path>
            <line class="expense-area-axis" x1="${model.left}" y1="${model.baseline}" x2="${model.width - model.right}" y2="${model.baseline}"></line>
            ${events}${xLabels}
        </svg></div><div class="expense-area-y-axis" aria-hidden="true">${yAxisLabels}</div></div><div class="expense-area-summary"><span><i></i>Xu hướng theo thời gian</span><span>${activeDays} mốc có giao dịch</span><span>Đỉnh: <strong>${metric === 'count' ? peak : compactVnd(peak)}</strong></span><span class="expense-area-drag-hint">Giữ và kéo để xem ngày khác</span></div>`;
    }

    function initExpenseAreaChartInteractions(container) {
        const scroll = container?.querySelector?.('[data-expense-chart-scroll]');
        if (!scroll || scroll.dataset.dragReady === 'true') return;
        scroll.dataset.dragReady = 'true';
        const activePoint = scroll.querySelector('.expense-area-point.active');
        if (activePoint) {
            const x = Number(activePoint.dataset.chartX || 0);
            scroll.scrollLeft = Math.max(0, x - scroll.clientWidth / 2);
        } else if (String(scroll.dataset.expenseChartTodayX || '') !== '') {
            const todayX = Number(scroll.dataset.expenseChartTodayX);
            const maxScroll = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
            scroll.scrollLeft = Math.max(0, Math.min(maxScroll, todayX - scroll.clientWidth / 2));
        } else {
            scroll.scrollLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
        }

        let pointerId = null;
        let startX = 0;
        let startScrollLeft = 0;
        let moved = false;
        let suppressClickUntil = 0;
        scroll.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            pointerId = event.pointerId;
            startX = event.clientX;
            startScrollLeft = scroll.scrollLeft;
            moved = false;
            scroll.classList.add('is-dragging');
            try { scroll.setPointerCapture(pointerId); } catch (_) { /* noop */ }
        });
        scroll.addEventListener('pointermove', event => {
            if (pointerId !== event.pointerId) return;
            const delta = event.clientX - startX;
            if (Math.abs(delta) > 4) moved = true;
            if (!moved) return;
            scroll.scrollLeft = startScrollLeft - delta;
            event.preventDefault();
        });
        const finishDrag = event => {
            if (pointerId !== event.pointerId) return;
            if (moved) suppressClickUntil = Date.now() + 160;
            try { scroll.releasePointerCapture(pointerId); } catch (_) { /* noop */ }
            pointerId = null;
            scroll.classList.remove('is-dragging');
        };
        scroll.addEventListener('pointerup', finishDrag);
        scroll.addEventListener('pointercancel', finishDrag);
        scroll.addEventListener('click', event => {
            if (Date.now() <= suppressClickUntil) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);
        scroll.addEventListener('keydown', event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            scroll.scrollBy({ left: event.key === 'ArrowLeft' ? -scroll.clientWidth * .7 : scroll.clientWidth * .7, behavior: 'smooth' });
        });
    }

    function renderTrendChart(buckets, metric, selectedBucket, groupBy = 'day') {
        if (!buckets.length) return '<div class="expense-empty-chart">Chưa có dữ liệu trong khoảng đã chọn.</div>';
        const values = buckets.map(item => metric === 'count' ? item.count : item.amountVnd);
        const max = Math.max(...values, 1);
        const width = Math.max(420, buckets.length * 48);
        const height = 190;
        const chartHeight = 112;
        const barWidth = Math.max(16, Math.min(38, width / buckets.length - 14));
        const bars = buckets.map((bucket, index) => {
            const value = metric === 'count' ? bucket.count : bucket.amountVnd;
            const barHeight = Math.max(value ? 4 : 0, Math.round(value / max * chartHeight));
            const x = 28 + index * ((width - 56) / buckets.length) + (((width - 56) / buckets.length) - barWidth) / 2;
            const y = 132 - barHeight;
            const label = formatExpenseBucketLabel(bucket.key, groupBy);
            const valueLabel = metric === 'count' ? String(value) : compactVnd(value);
            return `<g class="expense-chart-bar ${selectedBucket === bucket.key ? 'active' : ''}" onclick="selectExpenseBucket('${js(bucket.key)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectExpenseBucket('${js(bucket.key)}')}" role="button" tabindex="0">
                <title>${safe(bucket.key)} · ${metric === 'count' ? `${value} giao dịch` : formatVnd(value)}</title>
                <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="7"></rect>
                <text x="${x + barWidth / 2}" y="${Math.max(14, y - 7)}" text-anchor="middle" class="expense-chart-value">${safe(valueLabel)}</text>
                <text x="${x + barWidth / 2}" y="166" text-anchor="middle" class="expense-chart-label">${safe(label)}</text>
            </g>`;
        }).join('');
        return `<div class="expense-chart-scroll"><svg class="expense-trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ cột chi tiêu phụ">${bars}</svg></div>`;
    }

    function compactVnd(value) {
        const number = Number(value || 0);
        if (number >= 1e9) return `${(number / 1e9).toFixed(number >= 1e10 ? 0 : 1)}tỷ`;
        if (number >= 1e6) return `${(number / 1e6).toFixed(number >= 1e7 ? 0 : 1)}tr`;
        if (number >= 1e3) return `${Math.round(number / 1e3)}k`;
        return String(Math.round(number));
    }

    function renderBreakdown(items, mode) {
        const groups = breakdownExpenses(items, mode).slice(0, 10);
        if (!groups.length) return '<div class="expense-empty-chart">Chưa có dữ liệu phân bổ.</div>';
        const max = Math.max(...groups.map(item => item.amountVnd), 1);
        return `<div class="expense-breakdown-list">${groups.map(item => {
            const clickable = item.accountId ? `onclick="openExpenseAccount('${js(item.accountId)}')" role="button" tabindex="0"` : '';
            return `<div class="expense-breakdown-row ${item.accountId ? 'clickable' : ''}" ${clickable}>
                <div class="expense-breakdown-head"><span>${safe(item.label)}</span><strong>${formatVnd(item.amountVnd)}</strong></div>
                <div class="expense-breakdown-track"><i style="width:${Math.max(3, item.amountVnd / max * 100)}%"></i></div>
                <small>${item.count} giao dịch</small>
            </div>`;
        }).join('')}</div>`;
    }

    function renderExpenseRows(items, status) {
        if (!items.length) return '<div class="expense-empty-list">Không có giao dịch phù hợp.</div>';
        return `<div class="expense-transaction-list">${items
            .slice()
            .sort((a, b) => `${b.spentAt}${b.spentTime || ''}`.localeCompare(`${a.spentAt}${a.spentTime || ''}`))
            .map(item => {
                const accountButton = item.accountId
                    ? `<button class="expense-account-link" onclick="openExpenseAccount('${js(item.accountId)}')">${safe(item.accountName || 'Mở tài khoản')}</button>`
                    : `<span class="expense-account-muted">${safe(item.accountName || 'Không gắn tài khoản')}</span>`;
                const original = item.currency !== 'VND'
                    ? `<span>${formatCurrencyAmount(item.amount, item.currency)} · 1 ${safe(item.currency)} = ${formatVnd(item.exchangeRateToVnd)}</span>`
                    : '';
                const actions = status === 'deleted'
                    ? `<button class="btn btn-sm btn-outline" onclick="requestRestoreExpense('${js(item.id)}')">Khôi phục</button>`
                    : `<button class="btn btn-sm btn-outline" onclick="openExpenseForm('${js(item.id)}')">Sửa</button><button class="btn btn-sm btn-danger" onclick="requestDeleteExpense('${js(item.id)}')">Xóa</button>`;
                return `<article class="expense-transaction-card ${item.isDeleted ? 'deleted' : ''}">
                    <div class="expense-transaction-main">
                        <div class="expense-kind-icon expense-kind-${safe(item.kind)}">${item.kind === 'renewal' ? '↻' : item.kind === 'purchase' ? '↓' : '•'}</div>
                        <div class="expense-transaction-copy"><div class="expense-transaction-title">${safe(expenseKindLabel(item.kind))} · ${accountButton}</div><div class="expense-transaction-meta">${safe(item.spentAt)}${item.spentTime ? ` · ${safe(item.spentTime)}` : ''}${item.sellerName ? ` · ${safe(item.sellerName)}` : ''}</div>${item.note ? `<div class="expense-transaction-note">${safe(item.note)}</div>` : ''}</div>
                    </div>
                    <div class="expense-transaction-value"><strong>${formatVnd(item.amountVnd)}</strong>${original}${item.pendingSync ? '<em>Đang đồng bộ</em>' : ''}</div>
                    <div class="expense-transaction-actions">${actions}</div>
                </article>`;
            }).join('')}</div>`;
    }

    function renderExpensesPage() {
        const app = state();
        const content = document.getElementById('page-content');
        if (!app || !content) return '';
        const view = app.expenseViewState;
        const allFiltered = filterExpenses(app.expenses, { ...view, selectedBucket: '' });
        const filtered = filterExpenses(app.expenses, view);
        const total = filtered.reduce((sum, item) => sum + Number(item.amountVnd || 0), 0);
        const average = filtered.length ? Math.round(total / filtered.length) : 0;
        const buckets = aggregateExpenses(allFiltered, view.groupBy);
        const accountCount = new Set(filtered.map(item => item.accountId).filter(Boolean)).size;
        const range = presetRange(view.preset, new Date(), view.customFrom, view.customTo);
        const timelineBuckets = buildExpenseTimeline(buckets, view.groupBy, range);
        const chartRangeLabel = range.from && range.to ? `${range.from} → ${range.to}` : `${buckets.length} kỳ dữ liệu`;
        const filterCount = activeExpenseFilterCount(view);
        const filterSummary = expenseFilterSummary(view);
        const custom = view.preset === 'custom'
            ? `<input type="date" class="input" value="${safe(view.customFrom)}" onchange="setExpenseView('customFrom',this.value)"><span>đến</span><input type="date" class="input" value="${safe(view.customTo)}" onchange="setExpenseView('customTo',this.value)">`
            : `<span class="expense-range-caption">${range.from || 'Từ đầu'} → ${range.to || 'Hiện tại'}</span>`;
        content.innerHTML = `<section class="expense-page anim-fade-in-up">
            <header class="expense-page-head">
                <div class="expense-page-heading">
                    <div class="expense-page-title-row">
                        <button type="button" class="expense-back" onclick="goBack()" aria-label="Về Tổng quan" title="Về Tổng quan">←</button>
                        <div><p class="expense-eyebrow">Sổ giao dịch</p><h2>Chi tiêu</h2></div>
                    </div>
                    <p class="expense-page-subtitle">Theo dõi khoản mua và tỷ giá quy đổi.</p>
                </div>
                <button type="button" class="expense-add-btn" onclick="openExpenseForm()"><span aria-hidden="true">+</span> Thêm</button>
            </header>
            <div class="expense-filter-shell">
                <button type="button" class="expense-filter-toggle ${view.filtersOpen ? 'is-open' : ''}" onclick="toggleExpenseFilters()" aria-expanded="${view.filtersOpen ? 'true' : 'false'}" aria-controls="expense-filter-panel">
                    <span class="expense-filter-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M7 12h10M10 18h4"/></svg></span>
                    <span class="expense-filter-copy"><strong>Bộ lọc</strong><small>${safe(filterSummary)}</small></span>
                    ${filterCount ? `<span class="expense-filter-count">${filterCount}</span>` : ''}
                    <span class="expense-filter-chevron" aria-hidden="true">⌄</span>
                </button>
                <div id="expense-filter-panel" class="expense-filter-panel ${view.filtersOpen ? 'is-open' : ''}" ${view.filtersOpen ? '' : 'hidden'}>
                <select class="input" onchange="setExpenseView('preset',this.value)">
                    ${[['week','Tuần này'],['7d','7 ngày'],['month','Tháng này'],['30d','30 ngày'],['3m','3 tháng'],['6m','6 tháng'],['year','Năm nay'],['all','Tất cả'],['custom','Tùy chọn']].map(([value,label]) => `<option value="${value}" ${view.preset === value ? 'selected' : ''}>${label}</option>`).join('')}
                </select>
                <select class="input" onchange="setExpenseView('groupBy',this.value)"><option value="day" ${view.groupBy === 'day' ? 'selected' : ''}>Theo ngày</option><option value="week" ${view.groupBy === 'week' ? 'selected' : ''}>Theo tuần</option><option value="month" ${view.groupBy === 'month' ? 'selected' : ''}>Theo tháng</option></select>
                <select class="input" onchange="setExpenseView('metric',this.value)"><option value="amount" ${view.metric === 'amount' ? 'selected' : ''}>Tổng tiền</option><option value="count" ${view.metric === 'count' ? 'selected' : ''}>Số lần mua</option></select>
                <select class="input" onchange="setExpenseView('kind',this.value)"><option value="all">Mọi loại</option><option value="purchase" ${view.kind === 'purchase' ? 'selected' : ''}>Mua tài khoản</option><option value="renewal" ${view.kind === 'renewal' ? 'selected' : ''}>Gia hạn</option><option value="manual" ${view.kind === 'manual' ? 'selected' : ''}>Chi phí khác</option></select>
                <select class="input" onchange="setExpenseView('accountId',this.value)">${accountOptions(view.accountId, 'Mọi tài khoản')}</select>
                <select class="input" onchange="setExpenseView('currency',this.value)">${renderCurrencyOptions(view.currency, true)}</select>
                <select class="input" onchange="setExpenseView('status',this.value)"><option value="active" ${view.status === 'active' ? 'selected' : ''}>Đang dùng</option><option value="deleted" ${view.status === 'deleted' ? 'selected' : ''}>Đã xóa</option></select>
                <div class="expense-custom-range">${custom}</div>
            </div>
            </div>
            ${view.selectedBucket ? `<button class="expense-bucket-chip" onclick="selectExpenseBucket('${js(view.selectedBucket)}')">Đang xem ${safe(view.selectedBucket)} ×</button>` : ''}
            <div class="expense-kpi-grid"><div><span>Tổng chi</span><strong>${formatVnd(total)}</strong></div><div><span>Giao dịch</span><strong>${filtered.length}</strong></div><div><span>Trung bình</span><strong>${formatVnd(average)}</strong></div><div><span>Tài khoản</span><strong>${accountCount}</strong></div></div>
            <section class="expense-panel expense-primary-chart"><header><div><p>Biểu đồ chính</p><h3>${view.metric === 'count' ? 'Nhịp giao dịch theo thời gian' : 'Dòng chi tiêu theo thời gian'}</h3></div><span class="expense-chart-range">${safe(chartRangeLabel)}</span></header>${renderExpenseAreaChart(timelineBuckets, view.metric, view.selectedBucket, view.groupBy)}</section>
            <div class="expense-analytics-grid"><section class="expense-panel expense-secondary-chart"><header><div><p>Biểu đồ phụ</p><h3>${view.metric === 'count' ? 'So sánh số lần mua' : 'So sánh chi tiêu từng kỳ'}</h3></div></header>${renderTrendChart(buckets, view.metric, view.selectedBucket, view.groupBy)}</section>
                <section class="expense-panel"><header><div><p>Phân bổ</p><h3>Theo ${view.breakdown === 'platform' ? 'nền tảng' : 'tài khoản'}</h3></div><select class="input" onchange="setExpenseView('breakdown',this.value)"><option value="account" ${view.breakdown === 'account' ? 'selected' : ''}>Tài khoản</option><option value="platform" ${view.breakdown === 'platform' ? 'selected' : ''}>Nền tảng</option></select></header>${renderBreakdown(filtered, view.breakdown)}</section></div>
            <section class="expense-panel expense-ledger"><header><div><p>Chi tiết</p><h3>${filtered.length} giao dịch</h3></div></header>${renderExpenseRows(filtered, view.status)}</section>
        </section>`;
        initExpenseAreaChartInteractions(content);
        return content.innerHTML;
    }

    function renderExpenseDashboardCard() {
        const app = state();
        const view = { ...DEFAULT_VIEW, preset: 'month', status: 'active' };
        const items = filterExpenses(app?.expenses || [], view);
        const total = items.reduce((sum, item) => sum + Number(item.amountVnd || 0), 0);
        const accounts = new Set(items.map(item => item.accountId).filter(Boolean)).size;
        return `<button type="button" class="expense-dashboard-card" onclick="navigateTo('expenses')">
            <span class="expense-dashboard-icon">₫</span><span class="expense-dashboard-copy"><small>Chi tiêu tháng này</small><strong>${formatVnd(total)}</strong><em>${items.length} giao dịch · ${accounts} tài khoản</em></span><span class="expense-dashboard-arrow">Xem biểu đồ →</span>
        </button>`;
    }

    async function openExpenseAccount(accountId) {
        const account = (state()?.accounts || []).find(item => item.id === accountId);
        if (!account) {
            root.showToast?.('Tài khoản không còn tồn tại hoặc đang ở thùng rác', 'error');
            return false;
        }
        return root.showDetail?.(accountId);
    }

    function formatAccountPurchaseMoney(account = {}) {
        const money = accountPurchaseMoney(account);
        if (!money.amount) return '';
        if (money.currency === 'VND') return formatVnd(money.amountVnd);
        return `${formatCurrencyAmount(money.amount, money.currency)} · ${formatVnd(money.amountVnd)} @ ${formatVnd(money.exchangeRateToVnd)}/${money.currency}`;
    }

    const api = {
        CURRENCIES,
        DEFAULT_VIEW,
        parseExpenseNumber,
        normalizeCurrency,
        normalizeExpenseMoney,
        normalizeExpense,
        accountPurchaseFields,
        accountPurchaseMoney,
        expenseFromAccount,
        initialPurchaseExpenseId,
        presetRange,
        bucketKey,
        filterExpenses,
        aggregateExpenses,
        buildExpenseTimeline,
        niceExpenseChartScale,
        buildExpenseAreaChartModel,
        renderExpenseAreaChart,
        renderTrendChart,
        initExpenseAreaChartInteractions,
        breakdownExpenses,
        formatCurrencyAmount,
        formatVnd,
        formatAccountPurchaseMoney,
        renderExpenseMoneyFields,
        renderAccountPurchaseCurrencyControls,
        readExpenseMoneyFields,
        readAccountPurchaseMoneyFields,
        toggleExpenseRateField,
        toggleAccountPurchaseRate,
        formatAccountPurchaseAmountField,
        updateExpenseConversionPreview,
        updateAccountPurchaseConversionPreview,
        loadExpensesRealtime,
        stopExpensesRealtime,
        saveExpense,
        syncInitialPurchaseExpenseFromAccount,
        backfillAccountExpenses,
        softDeleteExpense,
        restoreExpense,
        renderExpenseDashboardCard,
        renderExpensesPage,
        openExpenseForm,
        openRenewExpenseDialog,
        submitExpenseForm,
        syncExpenseAccountFields,
        requestDeleteExpense,
        requestRestoreExpense,
        setExpenseView,
        toggleExpenseFilters,
        expenseFilterSummary,
        activeExpenseFilterCount,
        selectExpenseBucket,
        openExpenseAccount,
    };

    Object.assign(root, api);
    root.renewAccount = openRenewExpenseDialog;
    root.TingExpenses = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
