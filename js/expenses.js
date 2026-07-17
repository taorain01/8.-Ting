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
        const userId = root.auth?.currentUser?.uid;
        if (!userId || !root.db) return null;
        return root.db.collection('users').doc(userId).collection('expenses');
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
        if (!app || backfillRunning || app.expensesLoaded !== true || app.accountsLoaded !== true) return;
        backfillRunning = true;
        try {
            const known = new Set(app.expenses.map(item => item.id));
            for (const account of app.accounts || []) {
                const id = initialPurchaseExpenseId(account.id);
                const money = accountPurchaseMoney(account);
                if (!known.has(id) && money.amount && money.amountVnd) {
                    await syncInitialPurchaseExpenseFromAccount(account);
                    known.add(id);
                }
            }
            app.expenseBackfillComplete = true;
        } catch (error) {
            console.warn('Expense backfill failed:', error);
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

    function accountOptions(selectedId = '') {
        const accounts = state()?.accounts || [];
        return `<option value="">Không gắn tài khoản</option>` + accounts.map(account => (
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

    function selectExpenseBucket(key) {
        const app = state();
        if (!app) return;
        app.expenseViewState.selectedBucket = app.expenseViewState.selectedBucket === key ? '' : key;
        renderExpensesPage();
    }

    function renderTrendChart(buckets, metric, selectedBucket) {
        if (!buckets.length) return '<div class="expense-empty-chart">Chưa có dữ liệu trong khoảng đã chọn.</div>';
        const values = buckets.map(item => metric === 'count' ? item.count : item.amountVnd);
        const max = Math.max(...values, 1);
        const width = Math.max(520, buckets.length * 58);
        const height = 230;
        const chartHeight = 160;
        const barWidth = Math.max(16, Math.min(38, width / buckets.length - 14));
        const bars = buckets.map((bucket, index) => {
            const value = metric === 'count' ? bucket.count : bucket.amountVnd;
            const barHeight = Math.max(value ? 4 : 0, Math.round(value / max * chartHeight));
            const x = 28 + index * ((width - 56) / buckets.length) + (((width - 56) / buckets.length) - barWidth) / 2;
            const y = 178 - barHeight;
            const label = bucket.key.length === 10 ? bucket.key.slice(5) : bucket.key;
            const valueLabel = metric === 'count' ? String(value) : compactVnd(value);
            return `<g class="expense-chart-bar ${selectedBucket === bucket.key ? 'active' : ''}" onclick="selectExpenseBucket('${js(bucket.key)}')" role="button" tabindex="0">
                <title>${safe(bucket.key)} · ${metric === 'count' ? `${value} giao dịch` : formatVnd(value)}</title>
                <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="7"></rect>
                <text x="${x + barWidth / 2}" y="${Math.max(14, y - 7)}" text-anchor="middle" class="expense-chart-value">${safe(valueLabel)}</text>
                <text x="${x + barWidth / 2}" y="205" text-anchor="middle" class="expense-chart-label">${safe(label)}</text>
            </g>`;
        }).join('');
        return `<div class="expense-chart-scroll"><svg class="expense-trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ chi tiêu">${bars}</svg></div>`;
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
        const custom = view.preset === 'custom'
            ? `<input type="date" class="input" value="${safe(view.customFrom)}" onchange="setExpenseView('customFrom',this.value)"><span>đến</span><input type="date" class="input" value="${safe(view.customTo)}" onchange="setExpenseView('customTo',this.value)">`
            : `<span class="expense-range-caption">${range.from || 'Từ đầu'} → ${range.to || 'Hiện tại'}</span>`;
        content.innerHTML = `<section class="expense-page anim-fade-in-up">
            <header class="expense-page-head"><div><button class="expense-back" onclick="goBack()">← Tổng quan</button><p class="expense-eyebrow">Sổ giao dịch</p><h2>Chi tiêu tài khoản</h2><p>Lưu số tiền gốc và tỷ giá tại đúng thời điểm chi.</p></div><button class="btn btn-primary" onclick="openExpenseForm()">+ Thêm khoản chi</button></header>
            <div class="expense-filter-panel">
                <select class="input" onchange="setExpenseView('preset',this.value)">
                    ${[['week','Tuần này'],['7d','7 ngày'],['month','Tháng này'],['30d','30 ngày'],['3m','3 tháng'],['6m','6 tháng'],['year','Năm nay'],['all','Tất cả'],['custom','Tùy chọn']].map(([value,label]) => `<option value="${value}" ${view.preset === value ? 'selected' : ''}>${label}</option>`).join('')}
                </select>
                <select class="input" onchange="setExpenseView('groupBy',this.value)"><option value="day" ${view.groupBy === 'day' ? 'selected' : ''}>Theo ngày</option><option value="week" ${view.groupBy === 'week' ? 'selected' : ''}>Theo tuần</option><option value="month" ${view.groupBy === 'month' ? 'selected' : ''}>Theo tháng</option></select>
                <select class="input" onchange="setExpenseView('metric',this.value)"><option value="amount" ${view.metric === 'amount' ? 'selected' : ''}>Tổng tiền</option><option value="count" ${view.metric === 'count' ? 'selected' : ''}>Số lần mua</option></select>
                <select class="input" onchange="setExpenseView('kind',this.value)"><option value="all">Mọi loại</option><option value="purchase" ${view.kind === 'purchase' ? 'selected' : ''}>Mua tài khoản</option><option value="renewal" ${view.kind === 'renewal' ? 'selected' : ''}>Gia hạn</option><option value="manual" ${view.kind === 'manual' ? 'selected' : ''}>Chi phí khác</option></select>
                <select class="input" onchange="setExpenseView('accountId',this.value)">${accountOptions(view.accountId)}</select>
                <select class="input" onchange="setExpenseView('currency',this.value)">${renderCurrencyOptions(view.currency, true)}</select>
                <select class="input" onchange="setExpenseView('status',this.value)"><option value="active" ${view.status === 'active' ? 'selected' : ''}>Đang dùng</option><option value="deleted" ${view.status === 'deleted' ? 'selected' : ''}>Đã xóa</option></select>
                <div class="expense-custom-range">${custom}</div>
            </div>
            ${view.selectedBucket ? `<button class="expense-bucket-chip" onclick="selectExpenseBucket('${js(view.selectedBucket)}')">Đang xem ${safe(view.selectedBucket)} ×</button>` : ''}
            <div class="expense-kpi-grid"><div><span>Tổng chi</span><strong>${formatVnd(total)}</strong></div><div><span>Giao dịch</span><strong>${filtered.length}</strong></div><div><span>Trung bình</span><strong>${formatVnd(average)}</strong></div><div><span>Tài khoản</span><strong>${accountCount}</strong></div></div>
            <div class="expense-analytics-grid"><section class="expense-panel expense-panel-wide"><header><div><p>Xu hướng</p><h3>${view.metric === 'count' ? 'Số lần mua' : 'Chi tiêu quy đổi VND'}</h3></div></header>${renderTrendChart(buckets, view.metric, view.selectedBucket)}</section>
                <section class="expense-panel"><header><div><p>Phân bổ</p><h3>Theo ${view.breakdown === 'platform' ? 'nền tảng' : 'tài khoản'}</h3></div><select class="input" onchange="setExpenseView('breakdown',this.value)"><option value="account" ${view.breakdown === 'account' ? 'selected' : ''}>Tài khoản</option><option value="platform" ${view.breakdown === 'platform' ? 'selected' : ''}>Nền tảng</option></select></header>${renderBreakdown(filtered, view.breakdown)}</section></div>
            <section class="expense-panel expense-ledger"><header><div><p>Chi tiết</p><h3>${filtered.length} giao dịch</h3></div></header>${renderExpenseRows(filtered, view.status)}</section>
        </section>`;
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
        selectExpenseBucket,
        openExpenseAccount,
    };

    Object.assign(root, api);
    root.renewAccount = openRenewExpenseDialog;
    root.TingExpenses = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
