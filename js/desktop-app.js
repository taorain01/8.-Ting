/* Ting! — Desktop App Logic
   Router, State, Mock Data Demo, Event Handlers */

// ===== GLOBAL STATE =====
window.appState = {
    currentPage: 'dashboard', previousPage: null, currentFilter: 'all', searchQuery: '',
    isLoggedIn: false, masterUnlocked: false, authMode: 'login', isDemo: false,
    user: { uid: null, name: 'Người dùng', email: '', avatar: null },
    accounts: [],
    expandedGroups: {},
    masterPassword: null,
    masterPasswordMode: 'unlock',
    masterPasswordResolver: null,
    masterSecurity: null,
    activeDecryptedAccount: null,
    revealedSecrets: {},
    revealTimers: {},
    settings: {
        autoStart: true,
        autoLockMinutes: 5,
        clipboardAutoClear: true,
        theme: 'system',
    },
    appVersion: '1.0.0',
    updateStatus: null,
    updateLog: [],
};

// ===== MOCK DATA =====
const MOCK_ACCOUNTS = [
    { id:'m1', name:'Netflix Premium', type:'bought', platform:'netflix', username:'phan***@gmail.com', password:'SecureP@ss1', twoFaCode:'', displayUsername:'ph******@gmail.com', purchaseDate:'2026-04-01', expiryDate:'2026-05-01', expiryType:'fixed', status:'expiring', note:'Gói Family 4 màn hình', notifyDaysBefore:[5,3,1], renewalHistory:[{date:'2026-04-01',days:30}] },
    { id:'m2', name:'ChatGPT Plus', type:'bought', platform:'openai', username:'ai***@gmail.com', password:'GPT#2026!', twoFaCode:'JBSWY3DPEHPK3PXP', displayUsername:'ai******@gmail.com', purchaseDate:'2026-03-15', expiryDate:'2026-04-29', expiryType:'fixed', status:'expiring', note:'GPT-4o unlimited\n[copy] GPT-BACKUP-2026\n[open+copy] https://chatgpt.com | TEAM-2026-GPT', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m2b', name:'ChatGPT Team', type:'bought', platform:'openai', username:'team***@gmail.com', password:'TeamGPT#2026!', twoFaCode:'', displayUsername:'te******@gmail.com', purchaseDate:'2026-04-10', expiryDate:'2026-05-10', expiryType:'fixed', status:'active', note:'Tài khoản thứ hai cùng dịch vụ ChatGPT', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m3', name:'Spotify Premium', type:'bought', platform:'spotify', username:'music***@gmail.com', password:'Sp0tify!23', twoFaCode:'', displayUsername:'mu******@gmail.com', purchaseDate:'2026-01-01', expiryDate:'2026-12-31', expiryType:'fixed', status:'active', note:'Gói Duo', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m4', name:'Canva Pro', type:'bought', platform:'canva', username:'design***@gmail.com', password:'Canvas2026', twoFaCode:'', displayUsername:'de******@gmail.com', purchaseDate:'2026-03-01', expiryDate:'2026-04-15', expiryType:'fixed', status:'expired', note:'Giấy phép team 5 người', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m5', name:'Adobe Creative Cloud', type:'bought', platform:'adobe', username:'creative***@gmail.com', password:'AdobeCC!', twoFaCode:'', displayUsername:'cr******@gmail.com', purchaseDate:'2026-01-15', expiryDate:'2027-01-15', expiryType:'fixed', status:'active', note:'All Apps plan', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m6', name:'YouTube Premium', type:'bought', platform:'youtube', username:'yt***@gmail.com', password:'YTPrem26', twoFaCode:'', displayUsername:'yt******@gmail.com', purchaseDate:'2026-04-01', expiryDate:'2026-07-01', expiryType:'fixed', status:'active', note:'Family 6 members', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'p1', name:'Gmail cá nhân', type:'personal', platform:'google', username:'myreal@gmail.com', password:'MyR3alP@ss!', twoFaCode:'JBSWY3DPEHPK3PXP', displayUsername:'my******@gmail.com', purchaseDate:'2020-01-01', expiryDate:null, expiryType:'lifetime', status:'active', note:'Tài khoản chính', notifyDaysBefore:[], renewalHistory:[] },
    { id:'p2', name:'Ngân hàng VCB', type:'personal', platform:'other', username:'0912345789', password:'VCB@Secure2026', twoFaCode:'', displayUsername:'09******89', purchaseDate:'2022-06-01', expiryDate:null, expiryType:'lifetime', status:'active', note:'Smart OTP trên app', notifyDaysBefore:[], renewalHistory:[] },
    { id:'p3', name:'Facebook cá nhân', type:'personal', platform:'other', username:'fb.username', password:'Fb@2026Secure', twoFaCode:'', displayUsername:'fb******', purchaseDate:'2018-01-01', expiryDate:null, expiryType:'lifetime', status:'active', note:'', notifyDaysBefore:[], renewalHistory:[] },
];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    initUserPreferences();
    setupAuthListener();
    initDesktopIntegrations();
    document.getElementById('auth-password')?.addEventListener('input', e => updatePasswordStrength(e.target.value));
    document.getElementById('auth-confirm-password')?.addEventListener('input', () => updatePasswordStrength(document.getElementById('auth-password')?.value || ''));
    // Ctrl+K → focus search
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey||e.metaKey) && e.key === 'k') { e.preventDefault(); document.getElementById('search-input')?.focus(); }
        if ((e.ctrlKey||e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') { e.preventDefault(); openSpotlight(); }
        if (e.key === 'Enter' && document.getElementById('spotlight-overlay')?.style.display === 'flex') {
            const first = getSpotlightMatches?.(document.getElementById('spotlight-input')?.value || '')?.[0];
            if (first) openSpotlightResult(first.id);
        }
        if (e.key === 'Escape') { closeModal(); closeNotificationPanel?.(); closeSpotlight?.(); }
    });
    document.addEventListener('click', e => {
        const dropdown = document.getElementById('notification-dropdown');
        const button = document.getElementById('btn-notifications');
        if (dropdown && !dropdown.hidden && !dropdown.contains(e.target) && !button?.contains(e.target)) closeNotificationPanel();
    });
    schedulePeriodicCheck?.(() => window.appState.accounts);
});

// ===== DEMO MODE =====
function enterDemoMode() {
    window.appState.isDemo = true;
    window.appState.isLoggedIn = true;
    window.appState.masterUnlocked = false;
    window.appState.masterPassword = null;
    window.appState.activeDecryptedAccount = null;
    window.appState.user = { uid:'demo', name:'Người dùng Demo', email:'demo@ting.app', avatar:null };
    // Cập nhật status dựa trên ngày thực
    window.appState.accounts = MOCK_ACCOUNTS.map(a => ({
        ...a,
        status: getStatusFromExpiry(a.expiryDate, a.expiryType),
    }));
    showAppShell();
    updateHeader();
    navigateTo('dashboard');
    showToast('Chế độ Demo — dữ liệu mẫu', 'success');
}

// ===== NAVIGATION =====
const pageTitles = { dashboard:'Tổng quan', bought:'TK Mua', personal:'Cá nhân', settings:'Cài đặt', detail:'Chi tiết' };

function navigateTo(page) {
    window.appState.previousPage = window.appState.currentPage;
    window.appState.currentPage = page;
    if (page !== 'detail') window.appState.activeDecryptedAccount = null;
    if (page !== window.appState.previousPage) window.appState.expandedGroups = {};
    window.appState.currentFilter = 'all';
    window.appState.searchQuery = '';
    document.getElementById('search-input').value = '';
    // Sidebar active
    document.querySelectorAll('.d-nav-item[data-page]').forEach(i => i.classList.toggle('active', i.dataset.page === page));
    // Page title
    document.getElementById('page-title').textContent = pageTitles[page] || '';
    // Render
    switch (page) {
        case 'dashboard': renderDashboard(); break;
        case 'bought': renderAccountList('bought'); break;
        case 'personal': handlePersonalPage(); break;
        case 'settings': renderSettings(); break;
    }
    document.getElementById('page-content').scrollTop = 0;
}
function goBack() { navigateTo(window.appState.previousPage || 'dashboard'); }

// ===== HEADER / SIDEBAR =====
function updateHeader() {
    const u = window.appState.user;
    document.getElementById('sidebar-name').textContent = u.name;
    document.getElementById('sidebar-email').textContent = u.email;
    const av = document.getElementById('sidebar-avatar');
    if (u.avatar) { av.innerHTML = `<img src="${u.avatar}" alt="">`; }
    else { av.innerHTML = `<span>${u.name.charAt(0).toUpperCase()}</span>`; }
    // Nav badges
    const bought = window.appState.accounts.filter(a => a.type === 'bought').length;
    const personal = window.appState.accounts.filter(a => a.type === 'personal').length;
    document.getElementById('nav-badge-bought').textContent = bought || '';
    document.getElementById('nav-badge-personal').textContent = personal || '';
    // Notification badge
    const urgent = typeof getNotificationList === 'function'
        ? getNotificationList(window.appState.accounts).length
        : window.appState.accounts.filter(a => a.status === 'expiring' || a.status === 'expired').length;
    const nb = document.getElementById('notification-badge');
    if (urgent > 0) { nb.textContent = urgent; nb.style.display = ''; } else { nb.style.display = 'none'; }
    window.electronAPI?.updateTrayTooltip?.(`Ting! — ${urgent} TK cần chú ý`).catch?.(() => {});
}

// ===== SEARCH & FILTER =====
function handleSearch(v) {
    window.appState.searchQuery = v;
    const p = window.appState.currentPage;
    if (p === 'bought') renderAccountList('bought');
    else if (p === 'personal') renderAccountList('personal');
    else if (p === 'dashboard') renderDashboard();
}
function clearSearch() { document.getElementById('search-input').value = ''; handleSearch(''); }
function setFilter(f) {
    window.appState.currentFilter = f;
    window.appState.expandedGroups = {};
    const p = window.appState.currentPage;
    if (p === 'bought') renderAccountList('bought');
    else if (p === 'personal') renderAccountList('personal');
}

function toggleAccountGroup(groupKey) {
    window.appState.expandedGroups[groupKey] = !window.appState.expandedGroups[groupKey];
    const p = window.appState.currentPage;
    if (p === 'bought') renderAccountList('bought');
    else if (p === 'personal') renderAccountList('personal');
}

// ===== PERSONAL =====
async function handlePersonalPage() {
    if (window.appState.isDemo) {
        renderAccountList('personal');
        return;
    }

    const unlocked = await requireMasterPassword('Để xem tài khoản cá nhân');
    if (unlocked) renderAccountList('personal');
}

function getMasterPasswordDialogEls() {
    const overlay = document.getElementById('master-pw-overlay');
    const input = document.getElementById('master-pw-input');
    const title = overlay.querySelector('.master-pw-title');
    const desc = overlay.querySelector('.master-pw-desc');
    const label = overlay.querySelector('label[for="master-pw-input"]');
    const button = overlay.querySelector('.master-pw-content .btn-primary');
    return { overlay, input, title, desc, label, button };
}

async function showMasterPasswordDialog(reason = 'Để giải mã dữ liệu') {
    const els = getMasterPasswordDialogEls();
    let security = null;
    try {
        security = await getMasterPasswordHash();
    } catch (error) {
        console.error('❌ Lỗi kiểm tra Master Password:', error);
        showToast('Không thể kiểm tra Master Password', 'error');
        finishMasterPasswordDialog(false);
        return;
    }

    const hasMasterPassword = Boolean(security?.masterPasswordHash && security?.masterPasswordSalt);
    window.appState.masterSecurity = security;
    window.appState.masterPasswordMode = hasMasterPassword ? 'unlock' : 'create';

    els.title.textContent = hasMasterPassword ? 'Nhập Master Password' : 'Tạo Master Password';
    els.desc.textContent = hasMasterPassword
        ? reason
        : 'Mật khẩu này dùng để mã hoá dữ liệu. Nếu quên sẽ không giải mã được dữ liệu cũ.';
    els.label.textContent = hasMasterPassword ? 'Master Password' : 'Master Password mới';
    els.button.textContent = hasMasterPassword ? 'Mở khoá' : 'Tạo và mở khoá';
    els.button.disabled = false;
    els.input.value = '';
    els.overlay.style.display = 'flex';
    els.overlay.classList.add('open');
    setTimeout(() => els.input.focus(), 300);
}

async function requireMasterPassword(reason = 'Để giải mã dữ liệu') {
    if (window.appState.isDemo) return true;
    if (window.appState.masterUnlocked && window.appState.masterPassword) return true;

    return new Promise((resolve) => {
        window.appState.masterPasswordResolver = resolve;
        showMasterPasswordDialog(reason);
    });
}

function finishMasterPasswordDialog(success) {
    const els = getMasterPasswordDialogEls();
    if (success) {
        els.overlay.style.display = 'none';
        els.overlay.classList.remove('open');
        els.input.value = '';
    }

    if (window.appState.masterPasswordResolver) {
        window.appState.masterPasswordResolver(success);
        window.appState.masterPasswordResolver = null;
    }
}

function shakeMasterPasswordInput() {
    const inp = document.getElementById('master-pw-input');
    inp.parentElement.classList.add('anim-shake');
    setTimeout(() => inp.parentElement.classList.remove('anim-shake'), 400);
}

async function verifyMasterPassword() {
    const els = getMasterPasswordDialogEls();
    const masterPassword = els.input.value;
    if (!masterPassword) {
        shakeMasterPasswordInput();
        return;
    }

    els.button.disabled = true;
    const originalText = els.button.textContent;
    els.button.textContent = 'Đang kiểm tra...';

    try {
        if (window.appState.masterPasswordMode === 'create') {
            if (masterPassword.length < 6) {
                showToast('Master Password cần ít nhất 6 ký tự', 'error');
                shakeMasterPasswordInput();
                return;
            }

            const salt = generateSalt();
            const hash = await hashMasterPassword(masterPassword, salt);
            const saved = await saveMasterPasswordHash(hash, salt);
            if (!saved) throw new Error('Không lưu được Master Password');

            window.appState.masterUnlocked = true;
            window.appState.masterPassword = masterPassword;
            finishMasterPasswordDialog(true);
            showToast('Đã tạo Master Password', 'success');
            return;
        }

        const security = window.appState.masterSecurity || await getMasterPasswordHash();
        if (!security?.masterPasswordHash || !security?.masterPasswordSalt) {
            window.appState.masterPasswordMode = 'create';
            await showMasterPasswordDialog();
            return;
        }

        const ok = await TingCrypto.verifyMasterPassword(
            masterPassword,
            security.masterPasswordHash,
            security.masterPasswordSalt
        );
        if (!ok) {
            showToast('Master Password không đúng', 'error');
            shakeMasterPasswordInput();
            return;
        }

        window.appState.masterUnlocked = true;
        window.appState.masterPassword = masterPassword;
        finishMasterPasswordDialog(true);
        showToast('Đã mở khoá dữ liệu', 'success');
    } catch (error) {
        console.error('❌ Lỗi Master Password:', error);
        showToast(error.message || 'Không thể mở khoá dữ liệu', 'error');
        shakeMasterPasswordInput();
    } finally {
        els.button.disabled = false;
        els.button.textContent = originalText;
    }
}

// ===== DETAIL & COPY =====
async function getSensitiveAccountData(acc, reason = 'Để giải mã tài khoản') {
    if (!acc) return null;
    if (window.appState.isDemo) {
        return {
            username: acc.username || '',
            password: acc.password || '',
            twoFaCode: acc.twoFaCode || '',
            note: acc.note || '',
            rawInput: acc.rawInput || '',
        };
    }

    if (!acc.encryptedData || !acc.salt || !acc.iv) {
        showToast('Tài khoản này chưa có dữ liệu mã hoá', 'error');
        return null;
    }

    const unlocked = await requireMasterPassword(reason);
    if (!unlocked) return null;

    try {
        return await decryptAccountData(acc, window.appState.masterPassword);
    } catch (error) {
        console.error('❌ Lỗi giải mã tài khoản:', error);
        showToast('Không thể giải mã. Kiểm tra lại Master Password', 'error');
        window.appState.masterUnlocked = false;
        window.appState.masterPassword = null;
        return null;
    }
}

function getRevealKey(id, field) {
    return `${id}:${field}`;
}

function getRevealedSecret(id, field) {
    return window.appState.revealedSecrets?.[getRevealKey(id, field)] || '';
}

function clearRevealedSecrets() {
    Object.values(window.appState.revealTimers || {}).forEach(timer => clearTimeout(timer));
    window.appState.revealedSecrets = {};
    window.appState.revealTimers = {};
}

function rerenderCurrentView(accountId) {
    const page = window.appState.currentPage;
    if (page === 'detail' && accountId) renderDetail(accountId);
    else if (page === 'dashboard') renderDashboard();
    else if (page === 'bought') renderAccountList('bought');
    else if (page === 'personal') renderAccountList('personal');
}

async function revealField(id, field) {
    const acc = window.appState.accounts.find(a => a.id === id);
    if (!acc) return;
    const cached = window.appState.activeDecryptedAccount?.id === id
        ? window.appState.activeDecryptedAccount.data
        : null;
    const decrypted = cached || await getSensitiveAccountData(acc, 'Để hiện thông tin tài khoản');
    if (!decrypted?.[field]) return;

    const key = getRevealKey(id, field);
    window.appState.revealedSecrets[key] = decrypted[field];
    clearTimeout(window.appState.revealTimers[key]);
    window.appState.revealTimers[key] = setTimeout(() => {
        delete window.appState.revealedSecrets[key];
        delete window.appState.revealTimers[key];
        rerenderCurrentView(id);
    }, 5000);
    rerenderCurrentView(id);
}

function lockMasterPassword(reason = 'Đã tự khoá Master Password') {
    const detailId = window.appState.activeDecryptedAccount?.id;
    window.appState.masterUnlocked = false;
    window.appState.masterPassword = null;
    window.appState.activeDecryptedAccount = null;
    clearRevealedSecrets();
    if (window.appState.currentPage === 'personal') navigateTo('dashboard');
    else rerenderCurrentView(detailId);
    showToast(reason, 'success');
}

async function showDetail(id) {
    window.appState.previousPage = window.appState.currentPage;
    window.appState.currentPage = 'detail';
    document.getElementById('page-title').textContent = 'Chi tiết';
    window.appState.activeDecryptedAccount = null;
    clearRevealedSecrets();

    const acc = window.appState.accounts.find(a => a.id === id);
    const decrypted = await getSensitiveAccountData(acc, 'Để xem chi tiết tài khoản');
    if (decrypted) window.appState.activeDecryptedAccount = { id, data: decrypted };
    renderDetail(id);
}

async function copyField(id, field) {
    const acc = window.appState.accounts.find(a => a.id === id);
    if (!acc) return;
    const decrypted = await getSensitiveAccountData(acc, 'Để copy thông tin tài khoản');
    if (!decrypted) return;

    let v = '', l = '';
    switch (field) { case 'username': v = decrypted.username; l = 'tài khoản'; break; case 'password': v = decrypted.password; l = 'mật khẩu'; break; case '2fa': v = decrypted.twoFaCode; l = '2FA'; break; }
    if (v) await copyToClipboard(v, l);
}

function openExternalLink(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
}

async function copyNoteSegment(text) {
    if (!text) return;
    await copyToClipboard(text, 'ghi chú');
}

async function copyNoteTextAndOpen(text, url) {
    if (url) openExternalLink(url);
    if (text) await copyToClipboard(text, 'mã');
}

// ===== ADD ACCOUNT =====
function openAddModal() {
    const type = window.appState.currentPage === 'personal' ? 'personal' : 'bought';
    openModal(type === 'personal' ? 'Thêm TK cá nhân' : 'Thêm TK mua', renderAddForm(type));
}
function previewParse() {
    const raw = document.getElementById('paste-input').value;
    const r = parseAccountInput(raw);
    const el = document.getElementById('parse-preview');
    if (!r || (!r.username && !r.password)) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="parse-preview"><div class="parse-preview-item"><span class="parse-preview-label">Tài khoản</span><span class="parse-preview-value">${r.username || '—'}</span></div><div class="parse-preview-item"><span class="parse-preview-label">Mật khẩu</span><span class="parse-preview-value">${r.password || '—'}</span></div>${r.twoFaCode ? `<div class="parse-preview-item"><span class="parse-preview-label">2FA</span><span class="parse-preview-value">${r.twoFaCode}</span></div>` : ''}</div>`;
}
function autoDetectPlatform() {
    const n = document.getElementById('add-name').value;
    const p = detectPlatform(n);
    document.getElementById('platform-detect').innerHTML = p ? `${getPlatformEmoji(p)} Nhận diện: <strong>${p}</strong>` : '';
}
async function saveNewAccount(type) {
    const raw = document.getElementById('paste-input').value;
    const parsed = parseAccountInput(raw) || {};
    const name = document.getElementById('add-name').value.trim();
    if (!name) { showToast('Nhập tên dịch vụ', 'error'); return; }
    const isL = document.getElementById('add-lifetime').checked;
    const pDate = document.getElementById('add-purchase').value || todayStr();
    const eDate = isL ? null : document.getElementById('add-expiry').value;
    const note = document.getElementById('add-note').value.trim();
    const sensitiveData = {
        username: parsed.username || '',
        password: parsed.password || '',
        twoFaCode: parsed.twoFaCode || '',
        note,
        rawInput: raw || '',
    };
    const baseData = {
        name,
        type,
        platform: detectPlatform(name),
        displayUsername: maskUsername(parsed.username),
        purchaseDate: pDate,
        expiryDate: eDate || null,
        expiryType: isL ? 'lifetime' : 'fixed',
        status: getStatusFromExpiry(eDate, isL ? 'lifetime' : 'fixed'),
        notifyDaysBefore: [5, 3, 1],
        lastNotifiedDate: null,
        renewalHistory: [],
    };

    if (window.appState.isDemo) {
        const data = { ...baseData, ...sensitiveData };
        data.id = 'demo_' + Date.now();
        window.appState.accounts.unshift(data);
        updateHeader();
        closeModal();
        showToast(`Đã thêm "${name}"`, 'success');
        navigateTo(window.appState.currentPage);
    } else {
        const unlocked = await requireMasterPassword('Để mã hoá tài khoản trước khi lưu');
        if (!unlocked) return;

        try {
            const encryptedPayload = await encryptAccountData(sensitiveData, window.appState.masterPassword);
            const id = await addAccountToDB({ ...baseData, ...encryptedPayload });
            if (id) { closeModal(); showToast(`Đã thêm "${name}"`, 'success'); }
        } catch (error) {
            console.error('❌ Lỗi mã hoá/lưu tài khoản:', error);
            showToast(error.message || 'Không thể mã hoá tài khoản', 'error');
        }
    }
}

// ===== RENEW & DELETE =====
async function renewAccount(id, days) {
    if (window.appState.isDemo) {
        const acc = window.appState.accounts.find(a => a.id === id);
        if (acc) {
            const base = acc.expiryDate ? new Date(acc.expiryDate) : new Date();
            base.setDate(base.getDate() + days);
            acc.expiryDate = base.toISOString().split('T')[0];
            acc.status = getStatusFromExpiry(acc.expiryDate, acc.expiryType);
            acc.renewalHistory = [...(acc.renewalHistory || []), { date: todayStr(), days }];
            updateHeader();
            showToast(`Đã gia hạn +${days} ngày ✨`, 'success');
            if (window.appState.currentPage === 'detail') renderDetail(id);
            else rerenderCurrentView(id);
            if (!document.getElementById('notification-dropdown')?.hidden) renderNotificationPanel?.();
        }
    } else {
        if (await renewAccountInDB(id, days)) {
            showToast(`Đã gia hạn +${days} ngày ✨`, 'success');
            if (!document.getElementById('notification-dropdown')?.hidden) renderNotificationPanel?.();
            setTimeout(() => {
                if (window.appState.currentPage === 'detail') renderDetail(id);
            }, 500);
        }
    }
}
async function deleteAccount(id) {
    if (!confirm('Xoá tài khoản này?')) return;
    if (window.appState.isDemo) {
        window.appState.accounts = window.appState.accounts.filter(a => a.id !== id);
        updateHeader();
        showToast('Đã xoá', 'success');
        goBack();
    } else {
        if (await deleteAccountFromDB(id)) { showToast('Đã xoá', 'success'); goBack(); }
    }
}
function editAccount() { showToast('Chức năng sửa sẽ bổ sung sau', 'success'); }

// ===== PREFERENCES / DESKTOP INTEGRATION =====
function readLocalSetting(key, fallback) {
    try {
        const raw = localStorage.getItem(`ting.${key}`);
        return raw === null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeLocalSetting(key, value) {
    try { localStorage.setItem(`ting.${key}`, JSON.stringify(value)); } catch {}
}

function initUserPreferences() {
    window.appState.settings.clipboardAutoClear = readLocalSetting('clipboardAutoClear', true);
    window.appState.settings.theme = readLocalSetting('theme', 'system');
    applyThemePreference(window.appState.settings.theme);
    window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => {
        if (window.appState.settings.theme === 'system') applyThemePreference('system');
    });
}

async function initDesktopIntegrations() {
    const api = window.electronAPI;
    if (!api?.isElectron) return;

    try {
        const [autoStart, autoLockMinutes, version, updateLog] = await Promise.all([
            api.getAutoStart?.(),
            api.getAutoLockMinutes?.(),
            api.getAppVersion?.(),
            api.getUpdateLog?.(),
        ]);
        if (typeof autoStart === 'boolean') window.appState.settings.autoStart = autoStart;
        if (typeof autoLockMinutes === 'number') window.appState.settings.autoLockMinutes = autoLockMinutes;
        if (version) window.appState.appVersion = version;
        if (Array.isArray(updateLog)) window.appState.updateLog = updateLog;
    } catch (error) {
        console.warn('Không đọc được setting Electron:', error);
    }

    api.onAutoLock?.(() => lockMasterPassword('Đã tự khoá do không hoạt động'));
    api.onShowNotifications?.(() => {
        renderNotificationPanel?.();
        document.getElementById('notification-dropdown')?.removeAttribute('hidden');
    });
    api.onUpdateEvent?.(event => {
        window.appState.updateStatus = event;
        if (Array.isArray(event?.log)) window.appState.updateLog = event.log;
        if (window.appState.currentPage === 'settings') renderSettings();
        if (event?.message) showToast(event.message, event.type === 'error' ? 'error' : 'success');
    });
}

function applyThemePreference(preference = 'system') {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    const theme = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
}

function handleThemeChange(value) {
    window.appState.settings.theme = value;
    writeLocalSetting('theme', value);
    applyThemePreference(value);
    renderSettings();
}

async function handleAutoStartToggle(input) {
    const enabled = Boolean(input.checked);
    window.appState.settings.autoStart = enabled;
    try {
        await window.electronAPI?.setAutoStart?.(enabled);
        showToast(enabled ? 'Đã bật tự khởi động' : 'Đã tắt tự khởi động', 'success');
    } catch {
        showToast('Không thể đổi tự khởi động', 'error');
    }
    renderSettings();
}

async function handleAutoLockChange(value) {
    const minutes = Number(value);
    window.appState.settings.autoLockMinutes = minutes;
    try {
        await window.electronAPI?.setAutoLockMinutes?.(minutes);
        showToast(minutes ? `Tự khoá sau ${minutes} phút` : 'Đã tắt tự khoá', 'success');
    } catch {
        showToast('Không thể đổi tự khoá', 'error');
    }
    renderSettings();
}

function handleClipboardAutoClearToggle(input) {
    const enabled = Boolean(input.checked);
    window.appState.settings.clipboardAutoClear = enabled;
    writeLocalSetting('clipboardAutoClear', enabled);
    showToast(enabled ? 'Đã bật tự xoá clipboard' : 'Đã tắt tự xoá clipboard', 'success');
    renderSettings();
}

async function checkForUpdates() {
    if (!window.electronAPI?.checkForUpdates) {
        showToast('Cập nhật chỉ khả dụng trên bản desktop', 'error');
        return;
    }
    window.appState.updateStatus = { status: 'checking', message: 'Đang kiểm tra cập nhật...' };
    renderSettings();
    try {
        await window.electronAPI.checkForUpdates();
    } catch (error) {
        window.appState.updateStatus = { status: 'error', message: error.message || 'Không thể kiểm tra cập nhật', type: 'error' };
        renderSettings();
    }
}

function installDownloadedUpdate() {
    window.electronAPI?.quitAndInstall?.();
}

// ===== AUTH =====
async function handleGoogleLogin() {
    const b = document.getElementById('btn-google-login'); b.disabled = true; b.innerHTML = '<span class="btn-icon">⏳</span> Đang đăng nhập...';
    await signInWithGoogle();
    b.disabled = false; b.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Đăng nhập với Google`;
}
async function handleEmailAuth(e) {
    e.preventDefault();
    const em = document.getElementById('auth-email').value.trim();
    const pw = document.getElementById('auth-password').value;
    const btn = document.getElementById('btn-email-login');
    btn.disabled = true;
    try {
        if (window.appState.authMode === 'register') {
            const confirm = document.getElementById('auth-confirm-password')?.value || '';
            const validation = validateRegistrationPassword(pw, confirm);
            if (!validation.ok) {
                showToast(validation.message, 'error');
                updatePasswordStrength(pw);
                return;
            }
            await registerWithEmail(em, pw);
        } else {
            await signInWithEmail(em, pw);
        }
    } finally {
        btn.disabled = false;
    }
}
function toggleAuthMode(e) {
    e?.preventDefault();
    const b = document.getElementById('btn-email-login');
    const t = document.getElementById('auth-toggle-text');
    const l = document.getElementById('auth-toggle-link');
    const h = document.getElementById('auth-card-title');
    const strength = document.getElementById('pw-strength-wrap');
    const confirmGroup = document.getElementById('confirm-pw-group');
    const confirmInput = document.getElementById('auth-confirm-password');
    const passwordInput = document.getElementById('auth-password');
    const isRegister = window.appState.authMode === 'login';

    window.appState.authMode = isRegister ? 'register' : 'login';
    b.textContent = isRegister ? 'Đăng ký' : 'Đăng nhập';
    t.textContent = isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?';
    l.textContent = isRegister ? 'Đăng nhập' : 'Đăng ký ngay';
    h.textContent = isRegister ? 'Đăng ký' : 'Đăng nhập';
    strength.hidden = !isRegister;
    confirmGroup.hidden = !isRegister;
    confirmInput.required = isRegister;
    if (!isRegister) {
        confirmInput.value = '';
        passwordInput.removeAttribute('maxlength');
        updatePasswordStrength('');
    } else {
        passwordInput.maxLength = 20;
        updatePasswordStrength(passwordInput.value);
    }
}

function validateRegistrationPassword(password, confirmPassword) {
    if (password.length < 6 || password.length > 20) return { ok: false, message: 'Mật khẩu cần 6-20 ký tự' };
    if (!/[A-Z]/.test(password)) return { ok: false, message: 'Mật khẩu cần ít nhất 1 chữ hoa' };
    if (!/[^A-Za-z0-9]/.test(password)) return { ok: false, message: 'Mật khẩu cần ít nhất 1 ký tự đặc biệt' };
    if (password !== confirmPassword) return { ok: false, message: 'Mật khẩu nhập lại chưa khớp' };
    return { ok: true };
}

function getPasswordStrength(password = '') {
    let score = 0;
    if (password.length >= 6 && password.length <= 20) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (/\d/.test(password) && /[a-z]/.test(password) && password.length >= 10) score++;
    return Math.min(score, 4);
}

function updatePasswordStrength(value = '') {
    const wrap = document.getElementById('pw-strength-wrap');
    if (!wrap) return;
    const score = getPasswordStrength(value);
    const labels = ['', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'];
    const states = ['', 'weak', 'medium', 'strong', 'very-strong'];
    const label = document.getElementById('pw-strength-label');
    const requirement = document.getElementById('pw-requirement');
    wrap.dataset.strength = states[score] || '';
    wrap.querySelectorAll('.pw-strength-segment').forEach((segment, index) => {
        segment.classList.toggle('active', index < score);
    });
    if (label) label.textContent = score ? labels[score] : 'Độ mạnh mật khẩu';
    if (requirement) {
        const valid = validateRegistrationPassword(value, document.getElementById('auth-confirm-password')?.value || value).ok;
        requirement.classList.toggle('met', valid);
    }
}

function togglePasswordVisibility(button) {
    const input = button.closest('.input-group')?.querySelector('input');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

async function showNotifications() {
    await requestNotificationPermission?.();
    toggleNotificationPanel?.();
}
