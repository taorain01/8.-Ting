/* Ting! — Main App Logic
   Router, State, Event Handlers — Kết nối Firebase Auth + Firestore */

// ===== GLOBAL STATE =====
window.appState = {
    currentPage: 'dashboard',
    previousPage: null,
    currentFilter: 'all',
    searchQuery: '',
    isLoggedIn: false,
    masterUnlocked: false,
    authMode: 'login', // 'login' hoặc 'register'
    isDemo: false,
    user: { uid: null, name: 'Người dùng', email: '', avatar: null },
    accounts: [],
    expandedGroups: {},
    masterPassword: null,
    masterPasswordMode: 'unlock',
    masterPasswordResolver: null,
    masterSecurity: null,
    activeDecryptedAccount: null,
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    // Lắng nghe trạng thái đăng nhập Firebase
    setupAuthListener();
});

// ===== NAVIGATION / ROUTER =====
function navigateTo(page) {
    window.appState.previousPage = window.appState.currentPage;
    window.appState.currentPage = page;
    if (page !== 'detail') window.appState.activeDecryptedAccount = null;
    if (page !== window.appState.previousPage) window.appState.expandedGroups = {};
    window.appState.currentFilter = 'all';
    window.appState.searchQuery = '';

    // Cập nhật bottom nav active
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // FAB: ẩn ở settings & detail
    const fab = document.getElementById('fab-add');
    fab.style.display = (page === 'settings' || page === 'detail') ? 'none' : '';

    // Render page
    switch (page) {
        case 'dashboard': renderDashboard(); break;
        case 'bought': renderAccountList('bought'); break;
        case 'personal': handlePersonalPage(); break;
        case 'settings': renderSettings(); break;
    }

    // Scroll lên đầu
    document.getElementById('page-content').scrollTop = 0;
    window.scrollTo(0, 0);
}

function goBack() {
    navigateTo(window.appState.previousPage || 'dashboard');
}

// ===== HEADER =====
function updateHeader() {
    const user = window.appState.user;
    document.getElementById('header-greeting').textContent = getGreeting();
    document.getElementById('header-name').textContent = user.name;

    // Avatar: ảnh Google hoặc chữ cái đầu
    const avatarEl = document.getElementById('header-avatar');
    if (user.avatar) {
        avatarEl.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="">`;
    } else {
        const initial = user.name.charAt(0).toUpperCase();
        avatarEl.innerHTML = `<span>${initial}</span>`;
    }

    // Badge thông báo
    const urgentCount = window.appState.accounts.filter(a => a.status === 'expiring' || a.status === 'expired').length;
    const badge = document.getElementById('notification-badge');
    if (urgentCount > 0) {
        badge.textContent = urgentCount;
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

// ===== SEARCH =====
function toggleSearch() {
    const bar = document.getElementById('search-bar');
    bar.classList.toggle('hidden');
    if (!bar.classList.contains('hidden')) {
        document.getElementById('search-input').focus();
    }
}
function handleSearch(value) {
    window.appState.searchQuery = String(value || '');
    const hasSearch = window.appState.searchQuery.trim().length > 0;
    const page = window.appState.currentPage;
    if (page === 'bought') renderAccountList('bought');
    else if (page === 'personal') renderAccountList('personal');
    else if (hasSearch && typeof renderSearchResults === 'function') renderSearchResults(window.appState.searchQuery);
    else if (page === 'dashboard') renderDashboard();
}
function clearSearch() {
    document.getElementById('search-input').value = '';
    handleSearch('');
}

// ===== FILTER =====
function setFilter(filter) {
    window.appState.currentFilter = filter;
    window.appState.expandedGroups = {};
    const page = window.appState.currentPage;
    if (page === 'bought') renderAccountList('bought');
    else if (page === 'personal') renderAccountList('personal');
}

function toggleAccountGroup(groupKey) {
    window.appState.expandedGroups[groupKey] = !window.appState.expandedGroups[groupKey];
    const page = window.appState.currentPage;
    if (page === 'bought') renderAccountList('bought');
    else if (page === 'personal') renderAccountList('personal');
}

// ===== PERSONAL PAGE (Master Password) =====
async function handlePersonalPage() {
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
    const input = document.getElementById('master-pw-input');
    input.parentElement.classList.add('anim-shake');
    setTimeout(() => input.parentElement.classList.remove('anim-shake'), 400);
}

function clearMasterPasswordInput() {
    const input = document.getElementById('master-pw-input');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 30);
    }
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
                clearMasterPasswordInput();
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
            clearMasterPasswordInput();
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
        clearMasterPasswordInput();
    } finally {
        els.button.disabled = false;
        els.button.textContent = originalText;
    }
}

// ===== ACCOUNT DETAIL =====
async function getSensitiveAccountData(acc, reason = 'Để giải mã tài khoản') {
    if (!acc) return null;
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

async function showDetail(accId) {
    window.appState.previousPage = window.appState.currentPage;
    window.appState.currentPage = 'detail';
    document.getElementById('fab-add').style.display = 'none';
    window.appState.activeDecryptedAccount = null;

    const acc = window.appState.accounts.find(a => a.id === accId);
    const decrypted = await getSensitiveAccountData(acc, 'Để xem chi tiết tài khoản');
    if (decrypted) window.appState.activeDecryptedAccount = { id: accId, data: decrypted };
    renderDetail(accId);
}

// ===== COPY FIELD =====
async function copyField(accId, field) {
    const acc = window.appState.accounts.find(a => a.id === accId);
    if (!acc) return;
    const decrypted = await getSensitiveAccountData(acc, 'Để copy thông tin tài khoản');
    if (!decrypted) return;

    let value = '', label = '';
    switch (field) {
        case 'username': value = decrypted.username; label = 'tài khoản'; break;
        case 'password': value = decrypted.password; label = 'mật khẩu'; break;
        case '2fa': value = decrypted.twoFaCode; label = '2FA'; break;
    }
    if (value) copyToClipboard(value, label);
}

function openExternalLink(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
}

async function copyNoteSegment(text) {
    if (!text) return;
    await copyToClipboard(text, 'mã');
}

async function copyNoteTextAndOpen(text, url) {
    if (url) openExternalLink(url);
    if (text) await copyToClipboard(text, 'mã');
}

// ===== ADD ACCOUNT =====
function openAddModal() {
    const type = window.appState.currentPage === 'personal' ? 'personal' : 'bought';
    const title = type === 'personal' ? 'Thêm TK cá nhân' : 'Thêm TK mua';
    openModal(title, renderAddForm(type));
}

function previewParse() {
    const raw = document.getElementById('paste-input').value;
    const result = parseAccountInput(raw);
    const el = document.getElementById('parse-preview');
    if (!result || (!result.username && !result.password)) { el.innerHTML = ''; return; }
    el.innerHTML = `
        <div class="parse-preview">
            <div class="parse-preview-item"><span class="parse-preview-label">Tài khoản</span><span class="parse-preview-value">${result.username || '—'}</span></div>
            <div class="parse-preview-item"><span class="parse-preview-label">Mật khẩu</span><span class="parse-preview-value">${result.password || '—'}</span></div>
            ${result.twoFaCode ? `<div class="parse-preview-item"><span class="parse-preview-label">2FA</span><span class="parse-preview-value">${result.twoFaCode}</span></div>` : ''}
        </div>`;
}

function autoDetectPlatform() {
    const name = document.getElementById('add-name').value;
    const platform = detectPlatform(name);
    const el = document.getElementById('platform-detect');
    if (platform) {
        el.innerHTML = typeof renderPlatformDetect === 'function'
            ? renderPlatformDetect(platform)
            : `${getPlatformEmoji(platform)} Nhận diện: <strong>${platform}</strong>`;
    } else { el.innerHTML = ''; }
}

async function saveNewAccount(type) {
    const raw = document.getElementById('paste-input').value;
    const parsed = parseAccountInput(raw) || {};
    const name = document.getElementById('add-name').value.trim();
    if (!name) { showToast('Vui lòng nhập tên dịch vụ', 'error'); return; }

    const isLifetime = document.getElementById('add-lifetime').checked;
    const purchaseDate = document.getElementById('add-purchase').value || todayStr();
    const expiryDate = isLifetime ? null : document.getElementById('add-expiry').value;
    const note = document.getElementById('add-note').value.trim();

    const sensitiveData = {
        username: parsed.username || '',
        password: parsed.password || '',
        twoFaCode: parsed.twoFaCode || '',
        note,
        rawInput: raw || '',
    };

    const accountData = {
        name,
        type,
        platform: detectPlatform(name),
        displayUsername: maskUsername(parsed.username),
        purchaseDate,
        expiryDate: expiryDate || null,
        expiryType: isLifetime ? 'lifetime' : 'fixed',
        status: getStatusFromExpiry(expiryDate, isLifetime ? 'lifetime' : 'fixed'),
        notifyDaysBefore: [5, 3, 1],
        lastNotifiedDate: null,
        renewalHistory: [],
    };

    const unlocked = await requireMasterPassword('Để mã hoá tài khoản trước khi lưu');
    if (!unlocked) return;

    try {
        const encryptedPayload = await encryptAccountData(sensitiveData, window.appState.masterPassword);
        const docId = await addAccountToDB({ ...accountData, ...encryptedPayload });
        if (docId) {
            closeModal();
            showToast(`Đã thêm "${name}"`, 'success');
            // Realtime listener sẽ tự cập nhật UI
        }
    } catch (error) {
        console.error('❌ Lỗi mã hoá/lưu tài khoản:', error);
        showToast(error.message || 'Không thể mã hoá tài khoản', 'error');
    }
}

// ===== RENEW =====
async function renewAccount(accId, days) {
    const success = await renewAccountInDB(accId, days);
    if (success) {
        showToast(`Đã gia hạn +${days} ngày ✨`, 'success');
        // Realtime listener sẽ tự cập nhật, nhưng render lại detail ngay
        setTimeout(() => {
            const acc = window.appState.accounts.find(a => a.id === accId);
            if (acc) renderDetail(accId);
        }, 500);
    }
}

// ===== DELETE =====
async function deleteAccount(accId) {
    if (!confirm('Bạn chắc chắn muốn xoá tài khoản này?')) return;
    const success = await deleteAccountFromDB(accId);
    if (success) {
        showToast('Đã xoá tài khoản', 'success');
        goBack();
    }
}

// ===== EDIT (placeholder) =====
function editAccount(accId) { showToast('Chức năng sửa sẽ bổ sung sau', 'success'); }

// ===== AUTH HANDLERS =====
async function handleGoogleLogin() {
    const btn = document.getElementById('btn-google-login');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Đang đăng nhập...';
    await signInWithGoogle();
    btn.disabled = false;
    btn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Đăng nhập với Google`;
}

async function handleEmailAuth(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('btn-email-login');
    btn.disabled = true;

    if (window.appState.authMode === 'register') {
        await registerWithEmail(email, password);
    } else {
        await signInWithEmail(email, password);
    }
    btn.disabled = false;
}

function toggleAuthMode(e) {
    e.preventDefault();
    clearAuthNotice?.();
    const btn = document.getElementById('btn-email-login');
    const text = document.getElementById('auth-toggle-text');
    const link = document.getElementById('auth-toggle-link');

    if (window.appState.authMode === 'login') {
        window.appState.authMode = 'register';
        btn.textContent = 'Đăng ký';
        text.textContent = 'Đã có tài khoản?';
        link.textContent = 'Đăng nhập';
    } else {
        window.appState.authMode = 'login';
        btn.textContent = 'Đăng nhập';
        text.textContent = 'Chưa có tài khoản?';
        link.textContent = 'Đăng ký ngay';
    }
}

function togglePasswordVisibility(btn) {
    const input = btn.previousElementSibling;
    input.type = input.type === 'password' ? 'text' : 'password';
}

// ===== NOTIFICATIONS PANEL (placeholder) =====
function showNotifications() {
    showToast('Chức năng thông báo sẽ bổ sung sau', 'success');
}
