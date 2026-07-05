/* Ting! — Desktop App Logic
   Router, State, Mock Data Demo, Event Handlers */

// ===== GLOBAL STATE =====
window.appState = {
    currentPage: 'dashboard', previousPage: null, currentFilter: 'all', currentTagFilter: '', currentPlatformFilter: '', searchQuery: '',
    isLoggedIn: false, masterUnlocked: false, authMode: 'login', isDemo: false,
    user: { uid: null, name: 'Người dùng', email: '', avatar: null },
    accounts: [],
    trashAccounts: [],
    customCategories: [],
    groups: [],
    groupInvites: [],
    sharedAccounts: {},
    sharedAccountCounts: {},
    sharedEditRequests: {},
    sharedEditRequestCounts: {},
    decryptedSharedAccounts: {},
    groupUnlocked: {},
    currentGroupId: null,
    currentGroupTab: 'board',
    isOnline: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    firestoreFromCache: false,
    pendingSyncCount: 0,
    expandedGroups: {},
    addFormTags: [],
    addFormAutoTags: [],
    addFormPlatform: null,
    addFormAutoPlatform: null,
    addFormDetectedServices: { platforms: [], tags: [] },
    addFormAuthMethod: 'email',
    addFormLinkedId: null,
    masterPassword: null,
    masterPasswordMode: 'unlock',
    masterPinLength: 4,
    masterPinLengthLocked: false,
    masterPasswordResolver: null,
    masterPinEntryResolver: null,
    masterChangeInProgress: false,
    masterSecurity: null,
    activeDecryptedAccount: null,
    revealedSecrets: {},
    revealTimers: {},
    settings: {
        autoStart: true,
        autoLockMinutes: 5,
        clipboardAutoClear: true,
        protectBoughtAccounts: false,
        theme: 'system',
        notificationsEnabled: true,
        nativeNotificationsEnabled: true,
        inAppNotificationsEnabled: true,
        notifyDaysBefore: [5, 3, 1],
        notifyRepeatHours: 24,
        notifyOverdueDays: 3,
        shortcuts: { openApp: 'Control+Shift+T', quickAdd: 'Control+Shift+S' },
    },
    appVersion: '1.4.1',
    updateStatus: null,
    updateLog: [],
};

const DEFAULT_DEMO_CATEGORIES = [
    { id:'shineon', name:'Công Ty ShineOn', icon:'🏢', color:'#6C5CE7', order:0 },
    { id:'ai-tools', name:'AI Tools', icon:'✨', color:'#10B981', order:1 },
];

// ===== MOCK DATA =====
const MOCK_ACCOUNTS = [
    { id:'m1', name:'Netflix Premium', type:'bought', platform:'netflix', username:'phan***@gmail.com', password:'SecureP@ss1', twoFaCode:'', displayUsername:'ph******@gmail.com', purchaseDate:'2026-04-01', expiryDate:'2026-05-01', expiryType:'fixed', status:'expiring', tags:['Premium','Family'], note:'Gói Family 4 màn hình', notifyDaysBefore:[5,3,1], renewalHistory:[{date:'2026-04-01',days:30}] },
    { id:'m2', name:'ChatGPT Plus', type:'bought', platform:'openai', username:'ai***@gmail.com', password:'GPT#2026!', twoFaCode:'JBSWY3DPEHPK3PXP', displayUsername:'ai******@gmail.com', purchaseDate:'2026-03-15', expiryDate:'2026-04-29', expiryType:'fixed', status:'expiring', tags:['Plus','AI'], categoryIds:['ai-tools'], isFavorite:true, isPinned:true, favoriteAt:'2026-04-26T09:00:00.000Z', pinnedAt:'2026-04-27T09:00:00.000Z', note:'GPT-4o unlimited\n[copy] GPT-BACKUP-2026\n[open+copy] https://chatgpt.com | TEAM-2026-GPT', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m2b', name:'ChatGPT Team', type:'bought', platform:'openai', username:'team***@gmail.com', password:'TeamGPT#2026!', twoFaCode:'', displayUsername:'te******@gmail.com', purchaseDate:'2026-04-10', expiryDate:'2026-05-10', expiryType:'fixed', status:'active', tags:['Team','AI'], categoryIds:['shineon','ai-tools'], note:'Tài khoản thứ hai cùng dịch vụ ChatGPT', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m3', name:'Spotify Premium', type:'bought', platform:'spotify', username:'music***@gmail.com', password:'Sp0tify!23', twoFaCode:'', displayUsername:'mu******@gmail.com', purchaseDate:'2026-01-01', expiryDate:'2026-12-31', expiryType:'fixed', status:'active', tags:['Premium','Duo'], note:'Gói Duo', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m4', name:'Canva Pro', type:'bought', platform:'canva', username:'design***@gmail.com', password:'Canvas2026', twoFaCode:'', displayUsername:'de******@gmail.com', purchaseDate:'2026-03-01', expiryDate:'2026-04-15', expiryType:'fixed', status:'expired', tags:['Pro','Team'], categoryIds:['shineon'], note:'Giấy phép team 5 người', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m5', name:'Adobe Creative Cloud', type:'bought', platform:'adobe', username:'creative***@gmail.com', password:'AdobeCC!', twoFaCode:'', displayUsername:'cr******@gmail.com', purchaseDate:'2026-01-15', expiryDate:'2027-01-15', expiryType:'fixed', status:'active', tags:['All Apps','Yearly'], note:'All Apps plan', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m6', name:'YouTube Premium', type:'bought', platform:'youtube', username:'yt***@gmail.com', password:'YTPrem26', twoFaCode:'', displayUsername:'yt******@gmail.com', purchaseDate:'2026-04-01', expiryDate:'2026-07-01', expiryType:'fixed', status:'active', tags:['Premium Family','Family'], note:'Family 6 members', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m7', name:'Veo 3', type:'bought', platform:'google-veo', username:'myreal@gmail.com', password:'', twoFaCode:'', displayUsername:'my******@gmail.com', purchaseDate:'2026-04-20', expiryDate:'2026-05-20', expiryType:'fixed', status:'active', tags:['AI','Google'], categoryIds:['ai-tools'], note:'Đăng nhập bằng Gmail cá nhân', authMethod:'google', linkedAccountId:'p1', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m8', name:'Claude Pro', type:'bought', platform:'claude', username:'myreal@gmail.com', password:'', twoFaCode:'', displayUsername:'my******@gmail.com', purchaseDate:'2026-04-18', expiryDate:'2026-05-18', expiryType:'fixed', status:'active', tags:['Pro','AI'], categoryIds:['ai-tools'], note:'SSO Google qua Gmail cá nhân', authMethod:'google', linkedAccountId:'p1', notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'m9', name:'Cursor Pro', type:'bought', platform:'cursor', username:'', password:'', twoFaCode:'', displayUsername:'', purchaseDate:'2026-04-22', expiryDate:'2026-06-22', expiryType:'fixed', status:'active', tags:['Pro','AI'], categoryIds:['ai-tools'], note:'Chưa chọn TK GitHub gốc', authMethod:'github', linkedAccountId:null, notifyDaysBefore:[5,3,1], renewalHistory:[] },
    { id:'p1', name:'Gmail cá nhân', type:'personal', platform:'google', username:'myreal@gmail.com', password:'MyR3alP@ss!', twoFaCode:'JBSWY3DPEHPK3PXP', displayUsername:'my******@gmail.com', purchaseDate:'2020-01-01', expiryDate:null, expiryType:'lifetime', status:'active', tags:['Personal','Google Account'], isFavorite:true, favoriteAt:'2026-04-25T09:00:00.000Z', note:'Tài khoản chính', notifyDaysBefore:[], renewalHistory:[] },
    { id:'p2', name:'Ngân hàng VCB', type:'personal', platform:'other', username:'0912345789', password:'VCB@Secure2026', twoFaCode:'', displayUsername:'09******89', purchaseDate:'2022-06-01', expiryDate:null, expiryType:'lifetime', status:'active', note:'Smart OTP trên app', notifyDaysBefore:[], renewalHistory:[] },
    { id:'p3', name:'Facebook cá nhân', type:'personal', platform:'other', username:'fb.username', password:'Fb@2026Secure', twoFaCode:'', displayUsername:'fb******', purchaseDate:'2018-01-01', expiryDate:null, expiryType:'lifetime', status:'active', note:'', notifyDaysBefore:[], renewalHistory:[] },
];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    initUserPreferences();
    setupAuthListener();
    initConnectivityStatus();
    initDesktopIntegrations();
    initSmartNavigationInputs();
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
        if (e.key === 'Escape') { cancelMasterPasswordDialog?.(); closeModal(); closeNotificationPanel?.(); closeSpotlight?.(); }
    });
    document.addEventListener('click', e => {
        const dropdown = document.getElementById('notification-dropdown');
        const button = document.getElementById('btn-notifications');
        if (dropdown && !dropdown.hidden && !dropdown.contains(e.target) && !button?.contains(e.target)) closeNotificationPanel();
    });
    schedulePeriodicCheck?.(() => window.appState.accounts);
    // Background_Check lúc khởi động — không chặn UI (Yêu cầu 7.2, 7.3).
    scheduleBackgroundCheck?.();
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
    window.appState.trashAccounts = [];
    window.appState.customCategories = DEFAULT_DEMO_CATEGORIES.map(category => ({ ...category }));
    window.appState.groups = [];
    window.appState.groupInvites = [];
    window.appState.sharedAccounts = {};
    window.appState.sharedAccountCounts = {};
    window.appState.sharedEditRequests = {};
    window.appState.sharedEditRequestCounts = {};
    window.appState.decryptedSharedAccounts = {};
    window.appState.groupUnlocked = {};
    window.appState.currentGroupId = null;
    window.appState.currentGroupTab = 'board';
    showAppShell();
    if (typeof hideSplash === 'function') hideSplash();
    updateHeader();
    checkExpiryAndNotify?.(window.appState.accounts);
    navigateTo('dashboard');
    showToast('Chế độ Demo — dữ liệu mẫu', 'success');
}

// ===== NAVIGATION =====
const pageTitles = { dashboard:'Tổng quan', bought:'TK Mua', personal:'Cá nhân', groups:'Nhóm', 'group-detail':'Chi tiết nhóm', categories:'Danh mục', trash:'Thùng rác', settings:'Cài đặt', detail:'Chi tiết' };

const NAV_STACK_LIMIT = 80;

function getNavContentElement() {
    return document.getElementById('page-content');
}

function cloneNavExpandedGroups(value = window.appState.expandedGroups) {
    return { ...(value && typeof value === 'object' ? value : {}) };
}

function createNavEntry() {
    const page = window.appState.currentPage;
    if (!page) return null;
    const content = getNavContentElement();
    return {
        page,
        accountId: page === 'detail' ? (window.appState.currentDetailId || null) : null,
        groupId: page === 'group-detail' ? (window.appState.currentGroupId || null) : null,
        currentFilter: window.appState.currentFilter || 'all',
        currentTagFilter: window.appState.currentTagFilter || '',
        currentPlatformFilter: window.appState.currentPlatformFilter || '',
        searchQuery: window.appState.searchQuery || '',
        expandedGroups: cloneNavExpandedGroups(),
        scrollTop: content ? content.scrollTop : 0,
        windowScrollY: window.scrollY || window.pageYOffset || 0,
    };
}

function sameNavRoute(a, b) {
    return Boolean(a && b
        && a.page === b.page
        && (a.accountId || null) === (b.accountId || null)
        && (a.groupId || null) === (b.groupId || null));
}

function pushNavEntry(stackName, entry) {
    if (!entry?.page) return;
    if (!Array.isArray(window.appState[stackName])) window.appState[stackName] = [];
    const stack = window.appState[stackName];
    const top = stack[stack.length - 1];
    if (sameNavRoute(top, entry)) stack[stack.length - 1] = entry;
    else stack.push(entry);
    if (stack.length > NAV_STACK_LIMIT) stack.splice(0, stack.length - NAV_STACK_LIMIT);
}

function applyNavEntryState(entry) {
    if (!entry) return;
    window.appState.currentFilter = entry.currentFilter || 'all';
    window.appState.currentTagFilter = entry.currentTagFilter || '';
    window.appState.currentPlatformFilter = entry.currentPlatformFilter || '';
    window.appState.searchQuery = entry.searchQuery || '';
    window.appState.expandedGroups = cloneNavExpandedGroups(entry.expandedGroups);
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = window.appState.searchQuery;
}

function resetNavScroll() {
    const content = getNavContentElement();
    if (content) content.scrollTop = 0;
    window.scrollTo?.(0, 0);
}

function restoreNavScroll(entry) {
    const restore = () => {
        const content = getNavContentElement();
        if (content) content.scrollTop = Math.max(0, Number(entry?.scrollTop || 0));
        window.scrollTo?.(0, Math.max(0, Number(entry?.windowScrollY || 0)));
    };
    requestAnimationFrame(() => {
        restore();
        requestAnimationFrame(restore);
    });
    setTimeout(restore, 80);
}

function recordNavHistory(entry = createNavEntry()) {
    pushNavEntry('navStack', entry);
    window.appState.navForwardStack = [];
}

function navigateTo(page, isBack = false) {
    const isRestoring = isBack === true;
    if (!isRestoring && page !== window.appState.currentPage) recordNavHistory();
    window.appState.previousPage = window.appState.currentPage;
    window.appState.currentPage = page;
    if (page !== 'detail') window.appState.activeDecryptedAccount = null;
    if (page !== 'detail') window.appState.currentDetailId = null;
    if (!isRestoring) {
        if (page !== window.appState.previousPage) window.appState.expandedGroups = {};
        window.appState.currentFilter = 'all';
        window.appState.currentTagFilter = '';
        window.appState.currentPlatformFilter = '';
        window.appState.searchQuery = '';
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
    }
    // Sidebar active
    document.querySelectorAll('.d-nav-item[data-page]').forEach(i => {
        i.classList.toggle('active', i.dataset.page === page
            || (page === 'group-detail' && i.dataset.page === 'groups')
            || (page.startsWith('category:') && i.dataset.page === 'categories'));
    });
    // Page title
    const categoryId = page.startsWith('category:') ? page.slice('category:'.length) : '';
    const category = categoryId ? getCategoryById(categoryId) : null;
    document.getElementById('page-title').textContent = category?.name || pageTitles[page] || '';
    // Render
    switch (page) {
        case 'dashboard': renderDashboard(); break;
        case 'bought': renderAccountList('bought'); break;
        case 'personal': handlePersonalPage(); break;
        case 'groups': renderGroupList(); break;
        case 'categories': renderCategoriesPage(); break;
        case 'trash': renderTrashList(); break;
        case 'settings': renderSettings(); break;
        default:
            if (page.startsWith('category:')) renderCategoryDetail(categoryId);
            break;
    }
    renderQuickAccountIconFilter?.();
    if (!isRestoring) resetNavScroll();
}
async function restoreNavEntry(entry) {
    if (!entry?.page) return false;
    applyNavEntryState(entry);
    if (entry.page === 'detail' && entry.accountId) {
        const ok = await showDetail(entry.accountId, true);
        if (ok === false) return false;
    } else if (entry.page === 'group-detail' && entry.groupId) {
        const ok = openGroupDetail(entry.groupId, true);
        if (ok === false) return false;
    } else {
        navigateTo(entry.page, true);
    }
    restoreNavScroll(entry);
    return true;
}

async function handleBackIntent() {
    const stack = Array.isArray(window.appState.navStack) ? window.appState.navStack : [];
    const entry = stack[stack.length - 1];
    if (!entry?.page) {
        if (window.appState.currentPage !== 'dashboard') {
            applyNavEntryState({ currentFilter: 'all', currentTagFilter: '', currentPlatformFilter: '', searchQuery: '', expandedGroups: {} });
            navigateTo('dashboard', true);
            resetNavScroll();
            return true;
        }
        return false;
    }
    const current = createNavEntry();
    const restored = await restoreNavEntry(entry);
    if (restored === false) return false;
    stack.pop();
    pushNavEntry('navForwardStack', current);
    return true;
}

async function handleForwardIntent() {
    const stack = Array.isArray(window.appState.navForwardStack) ? window.appState.navForwardStack : [];
    const entry = stack[stack.length - 1];
    if (!entry?.page) return false;
    const current = createNavEntry();
    const restored = await restoreNavEntry(entry);
    if (restored === false) return false;
    stack.pop();
    pushNavEntry('navStack', current);
    return true;
}

function goBack() {
    return handleBackIntent();
}

function goForward() {
    return handleForwardIntent();
}

function initSmartNavigationInputs() {
    if (window.appState.smartNavigationInputsReady) return;
    window.appState.smartNavigationInputsReady = true;
    let lastMouseNavAt = 0;
    let lastMouseNavButton = null;
    let lastNavIntentAt = 0;
    let lastNavIntent = '';
    const runNavigationIntent = intent => {
        const now = Date.now();
        if (lastNavIntent === intent && now - lastNavIntentAt < 250) return;
        lastNavIntentAt = now;
        lastNavIntent = intent;
        if (intent === 'forward') handleForwardIntent();
        else handleBackIntent();
    };
    const handleMouseNav = event => {
        if (event.button !== 3 && event.button !== 4) return;
        const now = Date.now();
        if (lastMouseNavButton === event.button && now - lastMouseNavAt < 250) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        lastMouseNavAt = now;
        lastMouseNavButton = event.button;
        event.preventDefault();
        event.stopPropagation();
        runNavigationIntent(event.button === 3 ? 'back' : 'forward');
    };
    document.addEventListener('mouseup', handleMouseNav, true);
    document.addEventListener('auxclick', handleMouseNav, true);
    window.electronAPI?.onNavigationIntent?.(intent => runNavigationIntent(intent === 'forward' ? 'forward' : 'back'));
}

// ===== HEADER / SIDEBAR =====
function formatSidebarVersion(version) {
    const raw = String(version || '1.4.1').trim().replace(/^v/i, '');
    return raw ? `v${raw}` : 'v1.4.1';
}

function updateSidebarVersion() {
    const el = document.getElementById('sidebar-version');
    if (!el) return;
    const label = formatSidebarVersion(window.appState.appVersion);
    el.textContent = label;
    el.title = `Ting! ${label}`;
}

function updateHeader() {
    const u = window.appState.user;
    document.getElementById('sidebar-name').textContent = u.name;
    document.getElementById('sidebar-email').textContent = u.email;
    const av = document.getElementById('sidebar-avatar');
    if (u.avatar) { av.innerHTML = `<img src="${u.avatar}" alt="">`; }
    else { av.innerHTML = `<span>${u.name.charAt(0).toUpperCase()}</span>`; }
    updateSidebarVersion();
    // Nav badges
    const bought = window.appState.accounts.filter(a => a.type === 'bought').length;
    const personal = window.appState.accounts.filter(a => a.type === 'personal').length;
    const categories = window.appState.customCategories?.length || 0;
    const trash = window.appState.trashAccounts?.length || 0;
    const groupInvites = window.appState.groupInvites?.length || 0;
    const pendingGroupEdits = Object.values(window.appState.sharedEditRequests || {})
        .flat()
        .filter(request => request.status === 'pending'
            && (request.reviewerUid === window.appState.user?.uid
                || normalizeGroupEmail?.(request.reviewerEmail) === normalizeGroupEmail?.(window.appState.user?.email))).length;
    const groups = (window.appState.groups?.length || 0) + groupInvites + pendingGroupEdits;
    document.getElementById('nav-badge-bought').textContent = bought || '';
    document.getElementById('nav-badge-personal').textContent = personal || '';
    const categoriesBadge = document.getElementById('nav-badge-categories');
    if (categoriesBadge) categoriesBadge.textContent = categories || '';
    const trashBadge = document.getElementById('nav-badge-trash');
    if (trashBadge) trashBadge.textContent = trash || '';
    const groupsBadge = document.getElementById('nav-badge-groups');
    if (groupsBadge) groupsBadge.textContent = groups || '';
    // Notification badge
    const notificationSettings = typeof getNotificationSettings === 'function' ? getNotificationSettings() : { inAppEnabled: true };
    const urgent = notificationSettings.inAppEnabled
        ? (typeof getUnreadNotificationList === 'function'
            ? getUnreadNotificationList(window.appState.accounts).length
            : window.appState.accounts.filter(a => a.status === 'expiring' || a.status === 'expired').length)
        : 0;
    const nb = document.getElementById('notification-badge');
    if (urgent > 0) { nb.textContent = urgent; nb.style.display = ''; } else { nb.style.display = 'none'; }
    window.electronAPI?.updateTrayTooltip?.(`Ting! — ${urgent} TK cần chú ý`).catch?.(() => {});
    renderQuickAccountIconFilter?.();
}

// ===== SEARCH & FILTER =====
function handleSearch(v) {
    window.appState.searchQuery = String(v || '');
    const hasSearch = window.appState.searchQuery.trim().length > 0;
    const p = window.appState.currentPage;
    if (p === 'bought') renderAccountList('bought');
    else if (p === 'personal') renderAccountList('personal');
    else if (p === 'groups') renderGroupList();
    else if (p === 'group-detail') renderGroupDetail(window.appState.currentGroupId);
    else if (p === 'trash') renderTrashList();
    else if (p === 'categories') renderCategoriesPage();
    else if (p.startsWith('category:')) renderCategoryDetail(p.slice('category:'.length));
    else if (hasSearch && typeof renderSearchResults === 'function') renderSearchResults(window.appState.searchQuery);
    else if (p === 'dashboard') renderDashboard();
    else if (p === 'settings') renderSettings();
}
function clearSearch() { document.getElementById('search-input').value = ''; handleSearch(''); }
function setFilter(f) {
    window.appState.currentFilter = f;
    window.appState.expandedGroups = {};
    const p = window.appState.currentPage;
    if (p === 'bought') renderAccountList('bought');
    else if (p === 'personal') renderAccountList('personal');
    else if (p.startsWith('category:')) renderCategoryDetail(p.slice('category:'.length));
}

function setTagFilter(tag) {
    window.appState.currentTagFilter = String(tag || '');
    window.appState.expandedGroups = {};
    const p = window.appState.currentPage;
    if (p === 'bought') renderAccountList('bought');
    else if (p === 'personal') renderAccountList('personal');
    else if (p.startsWith('category:')) renderCategoryDetail(p.slice('category:'.length));
    renderQuickAccountIconFilter?.();
}

function setPlatformFilter(platform) {
    window.appState.currentPlatformFilter = String(platform || '');
    window.appState.expandedGroups = {};
    const p = window.appState.currentPage;
    if (p === 'bought') renderAccountList('bought');
    else if (p === 'personal') renderAccountList('personal');
    else if (p === 'dashboard') renderDashboard();
    renderQuickAccountIconFilter?.();
}

function setGlobalPlatformFilter(platform) {
    closeQuickPlatformFilter?.();
    const incoming = String(platform || '');
    const next = incoming && window.appState.currentPlatformFilter === incoming ? '' : incoming;
    if (window.appState.currentPage !== 'dashboard') navigateTo('dashboard');
    window.appState.currentFilter = 'all';
    window.appState.currentTagFilter = '';
    window.appState.currentPlatformFilter = next;
    window.appState.searchQuery = '';
    window.appState.expandedGroups = {};
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    renderDashboard();
    renderQuickAccountIconFilter?.();
    document.getElementById('page-content')?.scrollTo?.({ top: 0, behavior: 'smooth' });
}

function setGlobalTagFilter(tag) {
    closeQuickPlatformFilter?.();
    const incoming = String(tag || '');
    const next = incoming && window.appState.currentTagFilter === incoming ? '' : incoming;
    window.appState.currentTagFilter = next;
    window.appState.currentPlatformFilter = '';
    window.appState.expandedGroups = {};
    const p = window.appState.currentPage;
    if (p === 'bought') renderAccountList('bought');
    else if (p === 'personal') renderAccountList('personal');
    else if (p.startsWith('category:')) renderCategoryDetail(p.slice('category:'.length));
    else {
        navigateTo('bought');
    }
    renderQuickAccountIconFilter?.();
}

function setGlobalQuickFilter(platform, tag) {
    closeQuickPlatformFilter?.();
    window.appState.currentPlatformFilter = String(platform || '');
    window.appState.currentTagFilter = String(tag || '');
    window.appState.expandedGroups = {};
    const p = window.appState.currentPage;
    if (p === 'bought') renderAccountList('bought');
    else if (p === 'personal') renderAccountList('personal');
    else if (p.startsWith('category:')) renderCategoryDetail(p.slice('category:'.length));
    else renderDashboard();
    renderQuickAccountIconFilter?.();
}

function clearAllFilters() {
    window.appState.currentFilter = 'all';
    window.appState.currentTagFilter = '';
    window.appState.currentPlatformFilter = '';
    window.appState.expandedGroups = {};
    const p = window.appState.currentPage;
    if (p === 'bought') renderAccountList('bought');
    else if (p === 'personal') renderAccountList('personal');
    else if (p === 'dashboard') renderDashboard();
    renderQuickAccountIconFilter?.();
}

function toggleAccountGroup(groupKey) {
    window.appState.expandedGroups[groupKey] = !window.appState.expandedGroups[groupKey];
    const p = window.appState.currentPage;
    if (p === 'bought') renderAccountList('bought');
    else if (p === 'personal') renderAccountList('personal');
    else if (p.startsWith('category:')) renderCategoryDetail(p.slice('category:'.length));
}

// ===== PERSONAL =====
async function handlePersonalPage() {
    if (window.appState.cloudPermissionDenied) {
        showToast('Firestore chưa cấp quyền Cloud. Cần deploy rules trước khi dùng dữ liệu cá nhân.', 'error');
        navigateTo('dashboard');
        return;
    }

    renderAccountList('personal');
}

// ===== CONNECTIVITY / OFFLINE SYNC =====
function initConnectivityStatus() {
    window.appState.isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    renderOfflineBanner();

    window.addEventListener('online', () => {
        window.appState.isOnline = true;
        renderOfflineBanner();
        showToast('Đã có mạng lại. Firestore sẽ tự động đồng bộ dữ liệu.', 'success');
    });

    window.addEventListener('offline', () => {
        window.appState.isOnline = false;
        renderOfflineBanner();
        showToast('Đang offline. Dữ liệu mới sẽ được xếp hàng đồng bộ.', 'error');
    });
}

function setSyncMetadata(meta = {}) {
    if (typeof meta.fromCache === 'boolean') window.appState.firestoreFromCache = meta.fromCache;
    if (typeof meta.pendingWrites === 'number') window.appState.pendingSyncCount = meta.pendingWrites;
    renderOfflineBanner();
}

function renderOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;

    const isOnline = window.appState.isOnline !== false;
    const fromCache = Boolean(window.appState.firestoreFromCache);
    const pending = Number(window.appState.pendingSyncCount || 0);
    const shouldShow = !isOnline || fromCache || pending > 0;
    banner.hidden = !shouldShow;
    if (!shouldShow) return;

    const title = document.getElementById('offline-banner-title');
    const desc = document.getElementById('offline-banner-desc');
    const meta = document.getElementById('offline-banner-meta');
    banner.classList.toggle('is-offline', !isOnline);
    banner.classList.toggle('is-cache', isOnline && fromCache);
    banner.classList.toggle('is-pending', pending > 0);

    if (!isOnline) {
        if (title) title.textContent = 'Đang offline';
        if (desc) desc.textContent = 'Bạn vẫn xem được dữ liệu cache. Thay đổi mới sẽ đồng bộ khi có mạng.';
    } else if (pending > 0) {
        if (title) title.textContent = 'Đang chờ đồng bộ';
        if (desc) desc.textContent = 'Firestore đã lưu cục bộ và sẽ đẩy lên Cloud trong giây lát.';
    } else {
        if (title) title.textContent = 'Đang đọc từ cache';
        if (desc) desc.textContent = 'Dữ liệu tạm thời lấy từ bộ nhớ cục bộ trong khi kết nối Cloud cập nhật.';
    }
    if (meta) meta.textContent = pending > 0 ? `${pending} thay đổi` : 'Firestore cache';
}

function getSortedCategories() {
    return [...(window.appState.customCategories || [])]
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function getCategoryById(id) {
    return getSortedCategories().find(category => category.id === id) || null;
}

function getAccountCategoryIds(acc) {
    return Array.isArray(acc?.categoryIds) ? acc.categoryIds.filter(Boolean) : [];
}

function getAccountsForCategory(categoryId) {
    return (window.appState.accounts || []).filter(acc => getAccountCategoryIds(acc).includes(categoryId));
}

function slugifyCategoryName(name) {
    const slug = String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || `category-${Date.now().toString(36)}`;
}

function createCategoryId(name) {
    const base = slugifyCategoryName(name);
    const used = new Set(getSortedCategories().map(category => category.id));
    if (!used.has(base)) return base;
    let index = 2;
    while (used.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
}

async function persistCategories(categories) {
    const ordered = categories.map((category, index) => ({ ...category, order: index }));
    window.appState.customCategories = ordered;
    updateHeader();
    if (window.appState.isDemo) return true;
    return saveUserCategories(ordered);
}

function openCategoryForm(categoryId = '') {
    const category = categoryId ? getCategoryById(categoryId) : null;
    if (typeof renderCategoryForm !== 'function') return;
    openModal(category ? 'Sửa danh mục' : 'Thêm danh mục', renderCategoryForm(category));
}

async function saveCategory(categoryId = '') {
    const name = document.getElementById('category-name')?.value.trim();
    const iconSvg = typeof getCategoryIconId === 'function'
        ? getCategoryIconId(document.getElementById('category-icon')?.value.trim())
        : 'folder';
    const icon = document.getElementById('category-icon')?.value.trim() || '📁';
    const color = document.getElementById('category-color')?.value || '#6C5CE7';
    if (!name) { showToast('Nhập tên danh mục', 'error'); return; }

    const categories = getSortedCategories();
    const exists = categoryId ? getCategoryById(categoryId) : null;
    const nextCategory = {
        id: exists?.id || createCategoryId(name),
        name,
        icon: iconSvg,
        color,
        order: exists?.order ?? categories.length,
    };
    const next = exists
        ? categories.map(category => category.id === categoryId ? nextCategory : category)
        : [...categories, nextCategory];
    const ok = await persistCategories(next);
    if (ok) {
        closeModal();
        showToast(exists ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục', 'success');
        rerenderCurrentView();
    }
}

async function deleteCategory(categoryId) {
    const category = getCategoryById(categoryId);
    if (!category) return;
    const count = getAccountsForCategory(categoryId).length;
    if (!confirm(`Xoá danh mục "${category.name}"? ${count ? 'Tài khoản sẽ được gỡ khỏi danh mục này.' : ''}`)) return;

    const categories = getSortedCategories().filter(item => item.id !== categoryId);
    const ok = await persistCategories(categories);
    if (!ok) return;

    const affected = (window.appState.accounts || []).filter(acc => getAccountCategoryIds(acc).includes(categoryId));
    if (window.appState.isDemo) {
        affected.forEach(acc => {
            acc.categoryIds = getAccountCategoryIds(acc).filter(id => id !== categoryId);
        });
    } else {
        await Promise.all(affected.map(acc => updateAccountInDB(acc.id, {
            categoryIds: getAccountCategoryIds(acc).filter(id => id !== categoryId),
        })));
    }
    showToast('Đã xoá danh mục', 'success');
    navigateTo('categories');
}

function getSelectedCategoryIdsFromForm() {
    return [...document.querySelectorAll('[name="add-category-id"]:checked')]
        .map(input => input.value)
        .filter(Boolean);
}

function openAccountCategoryEditor(id) {
    const acc = window.appState.accounts.find(item => item.id === id);
    if (!acc || typeof renderAccountCategoryForm !== 'function') return;
    openModal('Sửa danh mục tài khoản', renderAccountCategoryForm(acc));
}

async function saveAccountCategories(id) {
    const acc = window.appState.accounts.find(item => item.id === id);
    if (!acc) return;
    const categoryIds = getSelectedCategoryIdsFromForm();
    if (window.appState.isDemo) {
        acc.categoryIds = categoryIds;
        closeModal();
        showToast('Đã cập nhật danh mục', 'success');
        rerenderCurrentView(id);
        return;
    }
    if (await updateAccountInDB(id, { categoryIds })) {
        closeModal();
        showToast('Đã cập nhật danh mục', 'success');
        setTimeout(() => rerenderCurrentView(id), 300);
    }
}

function getMasterPasswordDialogEls() {
    const overlay = document.getElementById('master-pw-overlay');
    const input = document.getElementById('master-pw-input');
    const title = overlay.querySelector('.master-pw-title');
    const desc = overlay.querySelector('.master-pw-desc');
    const button = document.getElementById('master-pw-submit');
    const lengthToggle = document.getElementById('master-pw-length-toggle');
    const lengthButtons = overlay.querySelectorAll('.master-pin-toggle-btn');
    const slots = document.getElementById('master-pin-slots');
    const pinWrap = overlay.querySelector('.master-pin-wrap');
    const hint = document.getElementById('master-pw-hint');
    return { overlay, input, title, desc, button, lengthToggle, lengthButtons, slots, pinWrap, hint };
}

function getMasterPinLength() {
    return Number(window.appState.masterPinLength || 4) === 6 ? 6 : 4;
}

function getPreferredMasterPinLength() {
    const saved = Number(readLocalSetting('masterPinLength', 4));
    return saved === 4 ? 4 : 6;
}

const MASTER_MAX_FAILED_ATTEMPTS = 5;
const MASTER_LOCK_MINUTES = [5, 10, 30];

function getMasterLockState() {
    const state = readLocalSetting('masterLockout', {}) || {};
    return {
        failedAttempts: Math.max(0, Number(state.failedAttempts) || 0),
        lockUntil: Math.max(0, Number(state.lockUntil) || 0),
        lockLevel: Math.max(0, Number(state.lockLevel) || 0),
    };
}

function writeMasterLockState(state) {
    writeLocalSetting('masterLockout', state);
}

function clearMasterLockState() {
    writeMasterLockState({ failedAttempts: 0, lockUntil: 0, lockLevel: 0 });
}

function getMasterLockRemainingMs() {
    const state = getMasterLockState();
    if (!state.lockUntil) return 0;

    const remaining = state.lockUntil - Date.now();
    if (remaining <= 0) {
        writeMasterLockState({ ...state, lockUntil: 0 });
        return 0;
    }
    return remaining;
}

function formatMasterLockTime(ms) {
    const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes && seconds) return `${minutes} phút ${seconds} giây`;
    if (minutes) return `${minutes} phút`;
    return `${seconds} giây`;
}

function applyMasterLockStateToUi(els = getMasterPasswordDialogEls()) {
    if (window.appState.masterLockTimer) {
        clearTimeout(window.appState.masterLockTimer);
        window.appState.masterLockTimer = null;
    }

    const remaining = window.appState.masterPasswordMode === 'unlock' ? getMasterLockRemainingMs() : 0;
    const locked = remaining > 0;
    if (els.input) els.input.disabled = locked || Boolean(window.appState.masterVerifyInProgress);
    els.pinWrap?.classList.toggle('locked', locked);

    if (locked) {
        if (els.hint) els.hint.textContent = `Khoá tạm thời. Thử lại sau ${formatMasterLockTime(remaining)}`;
        if (els.overlay?.classList.contains('open')) {
            window.appState.masterLockTimer = setTimeout(() => {
                applyMasterLockStateToUi();
                if (!getMasterLockRemainingMs()) {
                    renderMasterPinSlots();
                    setTimeout(() => focusMasterPinInput(), 30);
                }
            }, 1000);
        }
    }
    return locked;
}

function registerMasterPasswordFailure() {
    const state = getMasterLockState();
    const failedAttempts = state.failedAttempts + 1;
    if (failedAttempts >= MASTER_MAX_FAILED_ATTEMPTS) {
        const level = Math.min(state.lockLevel, MASTER_LOCK_MINUTES.length - 1);
        const minutes = MASTER_LOCK_MINUTES[level];
        writeMasterLockState({
            failedAttempts: 0,
            lockUntil: Date.now() + minutes * 60 * 1000,
            lockLevel: Math.min(level + 1, MASTER_LOCK_MINUTES.length - 1),
        });
        return { locked: true, minutes };
    }

    writeMasterLockState({ ...state, failedAttempts, lockUntil: 0 });
    return { locked: false, remainingAttempts: MASTER_MAX_FAILED_ATTEMPTS - failedAttempts };
}

function focusMasterPinInput() {
    document.getElementById('master-pw-input')?.focus();
}

function getMasterPinValue() {
    return document.getElementById('master-pw-input')?.value || '';
}

function isMasterPasswordPinMode() {
    return window.appState.masterPasswordInputMode === 'pin';
}

function setMasterPasswordInputMode(mode, els = getMasterPasswordDialogEls()) {
    const pinMode = mode === 'pin';
    window.appState.masterPasswordInputMode = pinMode ? 'pin' : 'password';
    els.pinWrap?.classList.toggle('master-pin-mode', pinMode);
    els.pinWrap?.classList.toggle('master-password-mode', !pinMode);
    if (els.input) {
        els.input.type = 'password';
        els.input.autocomplete = (window.appState.masterPasswordMode === 'create' || window.appState.masterPasswordMode === 'change-new')
            ? 'new-password'
            : 'current-password';
        if (pinMode) {
            els.input.maxLength = String(getMasterPinLength());
            els.input.setAttribute('inputmode', 'numeric');
            els.input.setAttribute('pattern', '[0-9]*');
        } else {
            els.input.removeAttribute('maxlength');
            els.input.setAttribute('inputmode', 'text');
            els.input.removeAttribute('pattern');
        }
    }
    if (els.lengthToggle) els.lengthToggle.hidden = !pinMode || Boolean(window.appState.masterPinLengthLocked);
    if (els.button) els.button.hidden = pinMode;
}

function renderMasterPinSlots() {
    const els = getMasterPasswordDialogEls();
    if (!els.slots || !els.input) return;
    if (!isMasterPasswordPinMode()) {
        setMasterPasswordInputMode('password', els);
        els.slots.innerHTML = '';
        els.slots.style.removeProperty('--pin-length');
        els.pinWrap?.classList.remove('ready');
        if (els.hint) {
            els.hint.textContent = window.appState.masterPasswordMode === 'create'
                ? 'Dùng chữ, số hoặc ký tự đặc biệt. Tối thiểu 6 ký tự.'
                : 'Nhập Master PIN của bạn.';
        }
        applyMasterLockStateToUi(els);
        return els.input.value || '';
    }

    setMasterPasswordInputMode('pin', els);
    const length = getMasterPinLength();
    const value = (els.input.value || '').replace(/\D/g, '').slice(0, length);
    if (els.input.value !== value) els.input.value = value;
    els.input.maxLength = String(length);
    els.input.setAttribute('inputmode', 'numeric');
    els.slots.style.setProperty('--pin-length', length);
    els.pinWrap?.classList.toggle('ready', value.length === length);
    els.slots.innerHTML = Array.from({ length }, (_, index) => {
        const filled = index < value.length;
        const current = index === value.length || (value.length === length && index === length - 1);
        return `<span class="master-pin-slot ${filled ? 'filled' : ''} ${current ? 'current' : ''}">${filled ? '•' : ''}</span>`;
    }).join('');
    if (els.hint) {
        const modeText = window.appState.masterPasswordMode === 'create' ? 'Tạo mã khoá' : 'Nhập mã khoá';
        els.hint.textContent = `${modeText} ${length} ký tự`;
    }
    applyMasterLockStateToUi(els);
    return value;
}

function setMasterPinLength(length, options = {}) {
    const nextLength = Number(length) === 4 ? 4 : 6;
    const { persist = true, focus = true, force = false } = options;
    if (!force && window.appState.masterPinLengthLocked && nextLength !== getMasterPinLength()) return;

    window.appState.masterPinLength = nextLength;
    if (persist) writeLocalSetting('masterPinLength', nextLength);

    const els = getMasterPasswordDialogEls();
    els.lengthButtons.forEach(button => {
        button.classList.toggle('active', Number(button.dataset.pinLength) === nextLength);
    });
    renderMasterPinSlots();
    if (focus) focusMasterPinInput();
}

function handleMasterPinInput() {
    const value = renderMasterPinSlots();
    if (!isMasterPasswordPinMode()) return;
    const length = getMasterPinLength();
    if (value.length !== length || window.appState.masterVerifyInProgress || getMasterLockRemainingMs()) return;

    clearTimeout(window.appState.masterAutoSubmitTimer);
    window.appState.masterAutoSubmitTimer = setTimeout(() => {
        if (getMasterPinValue().length === getMasterPinLength() && !window.appState.masterVerifyInProgress && !getMasterLockRemainingMs()) {
            verifyMasterPassword();
        }
    }, 80);
}

function handleMasterPinKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        verifyMasterPassword();
    }
}

async function showMasterPasswordDialog(reason = 'Để giải mã dữ liệu') {
    const els = getMasterPasswordDialogEls();
    if (window.appState.cloudPermissionDenied) {
        showToast('Firestore chưa cấp quyền Cloud. Chưa thể kiểm tra Master Password.', 'error');
        finishMasterPasswordDialog(false);
        return;
    }

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
    const savedPinLength = Number(security?.masterPasswordLength);
    const hasSavedPinLength = savedPinLength === 4 || savedPinLength === 6;
    const usePinMode = true;
    const activePinLength = hasSavedPinLength ? savedPinLength : getPreferredMasterPinLength();
    window.appState.masterSecurity = security;
    window.appState.masterPasswordMode = hasMasterPassword ? 'unlock' : 'create';
    window.appState.masterPinLengthLocked = hasMasterPassword && hasSavedPinLength;

    els.title.textContent = hasMasterPassword ? 'Nhập Master PIN' : 'Tạo Master PIN';
    els.desc.textContent = hasMasterPassword
        ? reason
        : 'Mã này dùng để mã hoá dữ liệu cá nhân. Chỉ dùng 4 hoặc 6 số.';
    els.button.textContent = hasMasterPassword ? 'Mở khoá' : 'Tạo và mở khoá';
    els.button.disabled = false;
    els.input.value = '';
    els.input.disabled = false;
    window.appState.masterVerifyInProgress = false;
    if (usePinMode) {
        setMasterPasswordInputMode('pin', els);
        setMasterPinLength(activePinLength, {
            persist: !hasSavedPinLength,
            focus: false,
            force: true,
        });
    } else {
        setMasterPasswordInputMode('password', els);
        renderMasterPinSlots();
    }
    els.overlay.style.display = 'flex';
    els.overlay.classList.add('open');
    renderMasterPinSlots();
    if (!applyMasterLockStateToUi(els)) {
        setTimeout(() => els.input.focus(), 300);
    }
}

async function requireMasterPassword(reason = 'Để giải mã dữ liệu') {
    if (window.appState.isDemo) return true;
    if (window.appState.masterUnlocked && window.appState.masterPassword) return true;

    return new Promise((resolve) => {
        window.appState.masterPasswordResolver = resolve;
        showMasterPasswordDialog(reason);
    });
}

function finishMasterPasswordDialog(success, value = null) {
    const els = getMasterPasswordDialogEls();
    els.overlay.style.display = 'none';
    els.overlay.classList.remove('open');
    els.input.value = '';
    els.input.disabled = false;
    window.appState.masterPinLengthLocked = false;
    window.appState.masterVerifyInProgress = false;
    clearTimeout(window.appState.masterAutoSubmitTimer);
    clearTimeout(window.appState.masterLockTimer);
    renderMasterPinSlots();

    if (window.appState.masterPinEntryResolver) {
        window.appState.masterPinEntryResolver(success ? value : null);
        window.appState.masterPinEntryResolver = null;
    }

    if (window.appState.masterPasswordResolver) {
        window.appState.masterPasswordResolver(success);
        window.appState.masterPasswordResolver = null;
    }
}

function cancelMasterPasswordDialog() {
    const overlay = document.getElementById('master-pw-overlay');
    if (!overlay || overlay.style.display === 'none') return;
    finishMasterPasswordDialog(false);
}

function shakeMasterPasswordInput() {
    const wrap = document.querySelector('#master-pw-overlay .master-pin-wrap');
    wrap?.classList.add('anim-shake');
    setTimeout(() => wrap?.classList.remove('anim-shake'), 400);
}

function clearMasterPasswordInput() {
    const els = getMasterPasswordDialogEls();
    if (els.input) {
        els.input.value = '';
        els.input.disabled = Boolean(getMasterLockRemainingMs());
    }
    renderMasterPinSlots();
    if (!getMasterLockRemainingMs()) setTimeout(() => els.input?.focus(), 30);
}

async function verifyMasterPassword() {
    if (window.appState.masterVerifyInProgress) return;
    const els = getMasterPasswordDialogEls();
    const pinMode = isMasterPasswordPinMode();
    const requiredLength = pinMode ? getMasterPinLength() : 0;
    const masterPassword = getMasterPinValue();
    const lockRemaining = window.appState.masterPasswordMode === 'unlock' ? getMasterLockRemainingMs() : 0;
    if (lockRemaining) {
        showToast(`Master Password đang bị khoá. Thử lại sau ${formatMasterLockTime(lockRemaining)}`, 'error');
        clearMasterPasswordInput();
        applyMasterLockStateToUi(els);
        return;
    }
    if (!masterPassword) {
        shakeMasterPasswordInput();
        return;
    }
    if (pinMode && masterPassword.length !== requiredLength) {
        showToast(`Master PIN cần đúng ${requiredLength} số`, 'error');
        shakeMasterPasswordInput();
        clearMasterPasswordInput();
        return;
    }

    window.appState.masterVerifyInProgress = true;
    els.input.disabled = true;
    els.button.disabled = true;
    const originalText = els.button.textContent;
    els.button.textContent = 'Đang kiểm tra...';

    try {
        if (window.appState.masterPasswordMode === 'change-new') {
            if (!pinMode || !/^\d{4}$|^\d{6}$/.test(masterPassword)) {
                showToast('Master PIN cần đúng 4 hoặc 6 số', 'error');
                shakeMasterPasswordInput();
                clearMasterPasswordInput();
                return;
            }
            window.appState.masterPinLength = requiredLength;
            writeLocalSetting('masterPinLength', requiredLength);
            finishMasterPasswordDialog(true, masterPassword);
            return;
        }

        if (window.appState.masterPasswordMode === 'create') {
            if (!pinMode && masterPassword.length < 6) {
                showToast('Master Password cần ít nhất 6 ký tự', 'error');
                shakeMasterPasswordInput();
                clearMasterPasswordInput();
                return;
            }
            const salt = generateSalt();
            const hash = await hashMasterPassword(masterPassword, salt);
            const saved = await saveMasterPasswordHash(hash, salt, requiredLength);
            if (!saved) throw new Error('Không lưu được Master Password');

            window.appState.masterUnlocked = true;
            window.appState.masterPassword = masterPassword;
            if (pinMode) {
                window.appState.masterPinLength = requiredLength;
                writeLocalSetting('masterPinLength', requiredLength);
            }
            clearMasterLockState();
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
            const failure = registerMasterPasswordFailure();
            if (failure.locked) {
                showToast(`Sai quá ${MASTER_MAX_FAILED_ATTEMPTS} lần. Khoá ${failure.minutes} phút.`, 'error');
            } else {
                showToast(`Master Password không đúng. Còn ${failure.remainingAttempts} lần thử.`, 'error');
            }
            shakeMasterPasswordInput();
            clearMasterPasswordInput();
            applyMasterLockStateToUi(els);
            return;
        }

        window.appState.masterUnlocked = true;
        window.appState.masterPassword = masterPassword;
        clearMasterLockState();
        finishMasterPasswordDialog(true);
        showToast('Đã mở khoá dữ liệu', 'success');
    } catch (error) {
        console.error('❌ Lỗi Master Password:', error);
        showToast(error.message || 'Không thể mở khoá dữ liệu', 'error');
        shakeMasterPasswordInput();
        clearMasterPasswordInput();
    } finally {
        window.appState.masterVerifyInProgress = false;
        els.input.disabled = false;
        els.button.disabled = false;
        els.button.textContent = originalText;
        applyMasterLockStateToUi(els);
    }
}

function isValidMasterPinValue(value) {
    return /^\d{4}$|^\d{6}$/.test(String(value || ''));
}

async function ensureEmailVerifiedForMasterPasswordChange() {
    const user = auth?.currentUser;
    if (!user) {
        showToast('Bạn cần đăng nhập để đổi Master PIN', 'error');
        return false;
    }

    if (typeof requireFreshSensitiveActionAuth === 'function') {
        return requireFreshSensitiveActionAuth('đổi/reset Master PIN');
    }

    showToast('Không có bước xác thực lại tài khoản', 'error');
    return false;
}

function promptNewMasterPin() {
    const els = getMasterPasswordDialogEls();
    return new Promise(resolve => {
        window.appState.masterPinEntryResolver = resolve;
        window.appState.masterPasswordMode = 'change-new';
        window.appState.masterPinLengthLocked = false;
        window.appState.masterVerifyInProgress = false;
        if (els.title) els.title.textContent = 'Đổi Master PIN';
        if (els.desc) els.desc.textContent = 'Chọn mã mới gồm 4 hoặc 6 số.';
        if (els.button) {
            els.button.textContent = 'Đổi mã';
            els.button.disabled = false;
        }
        if (els.input) {
            els.input.value = '';
            els.input.disabled = false;
        }
        setMasterPasswordInputMode('pin', els);
        setMasterPinLength(getPreferredMasterPinLength(), { persist: true, focus: false, force: true });
        if (els.overlay) {
            els.overlay.style.display = 'flex';
            els.overlay.classList.add('open');
        }
        renderMasterPinSlots();
        setTimeout(() => els.input?.focus(), 200);
    });
}

function getEncryptedAccountsForMasterRekey() {
    return [
        ...(window.appState.accounts || []),
        ...(window.appState.trashAccounts || []),
    ].filter(acc => acc?.id && acc.encryptedData && acc.salt && acc.iv);
}

async function reencryptAccountsForMasterChange(oldMasterPassword, newMasterPassword) {
    const encryptedAccounts = getEncryptedAccountsForMasterRekey();
    for (const acc of encryptedAccounts) {
        const plain = await decryptAccountData(acc, oldMasterPassword);
        const encryptedPayload = await encryptAccountData(plain, newMasterPassword);
        const ok = await updateAccountInDB(acc.id, encryptedPayload);
        if (!ok) throw new Error(`Không cập nhật được tài khoản ${acc.name || acc.id}`);
        Object.assign(acc, encryptedPayload);
    }
    return encryptedAccounts.length;
}

async function handleChangeMasterPassword() {
    if (window.appState.masterChangeInProgress) return;
    if (window.appState.isDemo) {
        showToast('Demo không đổi Master PIN', 'error');
        return;
    }

    window.appState.masterChangeInProgress = true;
    try {
        const verified = await ensureEmailVerifiedForMasterPasswordChange();
        if (!verified) return;

        const security = await getMasterPasswordHash();
        const hasMasterPassword = Boolean(security?.masterPasswordHash && security?.masterPasswordSalt);
        let oldMasterPassword = null;

        if (hasMasterPassword) {
            window.appState.masterSecurity = security;
            const unlocked = await requireMasterPassword('Nhập Master PIN hiện tại để đổi mã');
            if (!unlocked) return;
            oldMasterPassword = window.appState.masterPassword;
        }

        const newMasterPassword = await promptNewMasterPin();
        if (!newMasterPassword) return;
        if (!isValidMasterPinValue(newMasterPassword)) {
            showToast('Master PIN cần đúng 4 hoặc 6 số', 'error');
            return;
        }
        if (oldMasterPassword && newMasterPassword === oldMasterPassword) {
            showToast('Mã mới phải khác mã hiện tại', 'error');
            return;
        }

        const rekeyedCount = oldMasterPassword
            ? await reencryptAccountsForMasterChange(oldMasterPassword, newMasterPassword)
            : 0;
        const salt = generateSalt();
        const hash = await hashMasterPassword(newMasterPassword, salt);
        const saved = await saveMasterPasswordHash(hash, salt, newMasterPassword.length);
        if (!saved) throw new Error('Không lưu được Master PIN mới');

        window.appState.masterUnlocked = true;
        window.appState.masterPassword = newMasterPassword;
        window.appState.masterPinLength = newMasterPassword.length;
        writeLocalSetting('masterPinLength', newMasterPassword.length);
        window.appState.masterSecurity = { masterPasswordHash: hash, masterPasswordSalt: salt, masterPasswordLength: newMasterPassword.length };
        window.appState.activeDecryptedAccount = null;
        clearRevealedSecrets?.();
        clearMasterLockState();
        showToast(rekeyedCount ? `Đã đổi Master PIN và mã hoá lại ${rekeyedCount} tài khoản` : 'Đã đổi Master PIN', 'success');
    } catch (error) {
        console.error('Đổi Master PIN lỗi:', error);
        showToast(error.message || 'Không thể đổi Master PIN', 'error');
    } finally {
        window.appState.masterChangeInProgress = false;
    }
}

async function handleResetMasterPassword() {
    if (window.appState.masterChangeInProgress) return;
    if (window.appState.isDemo) {
        showToast('Demo không reset Master PIN', 'error');
        return;
    }
    const okToReset = confirm('Reset Master PIN sẽ xoá khoá hiện tại. Dữ liệu đã mã hoá bằng mã cũ có thể cần mã cũ để giải mã lại. Tiếp tục?');
    if (!okToReset) return;

    window.appState.masterChangeInProgress = true;
    try {
        const verified = await ensureEmailVerifiedForMasterPasswordChange();
        if (!verified) return;

        const newMasterPassword = await promptNewMasterPin();
        if (!newMasterPassword) return;
        if (!isValidMasterPinValue(newMasterPassword)) {
            showToast('Master PIN cần đúng 4 hoặc 6 số', 'error');
            return;
        }

        if (typeof deleteMasterPasswordHash === 'function') {
            const deleted = await deleteMasterPasswordHash();
            if (!deleted) throw new Error('Không xoá được Master PIN cũ');
        }
        const salt = generateSalt();
        const hash = await hashMasterPassword(newMasterPassword, salt);
        const saved = await saveMasterPasswordHash(hash, salt, newMasterPassword.length);
        if (!saved) throw new Error('Không lưu được Master PIN mới');

        window.appState.masterUnlocked = true;
        window.appState.masterPassword = newMasterPassword;
        window.appState.masterPinLength = newMasterPassword.length;
        writeLocalSetting('masterPinLength', newMasterPassword.length);
        window.appState.masterSecurity = { masterPasswordHash: hash, masterPasswordSalt: salt, masterPasswordLength: newMasterPassword.length };
        window.appState.activeDecryptedAccount = null;
        clearRevealedSecrets?.();
        clearMasterLockState();
        showToast('Đã reset và tạo Master PIN mới', 'success');
    } catch (error) {
        console.error('Reset Master PIN lỗi:', error);
        showToast(error.message || 'Không thể reset Master PIN', 'error');
    } finally {
        window.appState.masterChangeInProgress = false;
    }
}

// ===== DETAIL & COPY =====
async function getSensitiveAccountData(acc, reason = 'Để giải mã tài khoản') {
    if (!acc) return null;
    const cached = window.appState.activeDecryptedAccount?.id === acc.id
        ? window.appState.activeDecryptedAccount.data
        : null;
    if (cached) return cached;

    const plainData = {
        username: acc.username || '',
        password: acc.password || '',
        twoFaCode: acc.twoFaCode || '',
        note: acc.note || '',
        rawInput: acc.rawInput || '',
    };
    const hasPlainData = Boolean(plainData.username || plainData.password || plainData.twoFaCode || plainData.note || plainData.rawInput);
    const isSsoAccount = (typeof getAuthMethod === 'function' ? getAuthMethod(acc) : acc.authMethod) !== 'email';
    const isPersonal = acc.type === 'personal';
    const protectBought = Boolean(window.appState.settings?.protectBoughtAccounts);
    const requiresMaster = isPersonal || acc.protectedByMasterPassword === true || (acc.type === 'bought' && protectBought);

    if (window.appState.isDemo) return plainData;

    const hasEncryptedPayload = Boolean(acc.encryptedData && acc.salt && acc.iv);
    if (isSsoAccount && !hasEncryptedPayload) {
        window.appState.activeDecryptedAccount = { id: acc.id, data: plainData };
        return plainData;
    }
    if (!requiresMaster && hasPlainData) {
        window.appState.activeDecryptedAccount = { id: acc.id, data: plainData };
        return plainData;
    }

    if (!hasEncryptedPayload && !hasPlainData) {
        window.appState.activeDecryptedAccount = { id: acc.id, data: plainData };
        return plainData;
    }

    if (!hasEncryptedPayload) {
        if (requiresMaster) {
            const unlocked = await requireMasterPassword(reason);
            if (!unlocked) return null;
        }
        if (hasPlainData) {
            window.appState.activeDecryptedAccount = { id: acc.id, data: plainData };
            return plainData;
        }
    }

    if (!requiresMaster && acc.type === 'bought') {
        showToast('TK Mua cũ đang mã hoá. Nhập Master Password một lần để chuyển sang xem nhanh.', 'success');
    }

    const unlocked = await requireMasterPassword(reason);
    if (!unlocked) return null;

    try {
        const decrypted = await decryptAccountData(acc, window.appState.masterPassword);
        window.appState.activeDecryptedAccount = { id: acc.id, data: decrypted };
        if (!requiresMaster && acc.type === 'bought') {
            updateAccountInDB?.(acc.id, {
                ...decrypted,
                protectedByMasterPassword: false,
            }).catch?.(() => {});
        }
        return decrypted;
    } catch (error) {
        console.error('❌ Lỗi giải mã tài khoản:', error);
        showToast('Không thể giải mã. Kiểm tra lại Master Password', 'error');
        window.appState.masterUnlocked = false;
        window.appState.masterPassword = null;
        window.appState.activeDecryptedAccount = null;
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
    else if (page === 'groups') renderGroupList();
    else if (page === 'group-detail') renderGroupDetail(window.appState.currentGroupId);
    else if (page === 'trash') renderTrashList();
    else if (page === 'categories') renderCategoriesPage();
    else if (page.startsWith('category:')) renderCategoryDetail(page.slice('category:'.length));
}

async function updateAccountPreference(id, patch, successMessage) {
    const acc = window.appState.accounts.find(item => item.id === id);
    if (!acc) return;

    if (window.appState.isDemo) {
        Object.assign(acc, patch);
        showToast(successMessage, 'success');
        rerenderCurrentView(id);
        return;
    }

    const ok = await updateAccountInDB(id, patch);
    if (ok) {
        Object.assign(acc, patch);
        showToast(successMessage, 'success');
        rerenderCurrentView(id);
    }
}

async function toggleFavorite(id) {
    const acc = window.appState.accounts.find(item => item.id === id);
    if (!acc) return;
    const next = !isAccountFavorite(acc);
    await updateAccountPreference(id, {
        isFavorite: next,
        favoriteAt: next ? new Date().toISOString() : null,
    }, next ? 'Đã thêm vào yêu thích' : 'Đã bỏ yêu thích');
}

async function togglePinned(id) {
    const acc = window.appState.accounts.find(item => item.id === id);
    if (!acc) return;
    const next = !isAccountPinned(acc);
    await updateAccountPreference(id, {
        isPinned: next,
        pinnedAt: next ? new Date().toISOString() : null,
    }, next ? 'Đã ghim lên đầu' : 'Đã bỏ ghim');
}

async function revealField(id, field) {
    const acc = window.appState.accounts.find(a => a.id === id);
    if (!acc) return;
    if (field === 'password' && (typeof getAuthMethod === 'function' ? getAuthMethod(acc) : acc.authMethod) !== 'email') {
        const key = getRevealKey(id, field);
        window.appState.revealedSecrets[key] = `🔗 MK nằm ở TK: ${getSsoPasswordMessage(acc)}`;
        clearTimeout(window.appState.revealTimers[key]);
        window.appState.revealTimers[key] = setTimeout(() => {
            delete window.appState.revealedSecrets[key];
            delete window.appState.revealTimers[key];
            rerenderCurrentView(id);
        }, 5000);
        showToast(getSsoPasswordMessage(acc), 'error');
        rerenderCurrentView(id);
        return;
    }
    const cached = window.appState.activeDecryptedAccount?.id === id
        ? window.appState.activeDecryptedAccount.data
        : null;
    const decrypted = cached || await getSensitiveAccountData(acc, 'Để hiện thông tin tài khoản');
    if (!decrypted?.[field]) {
        const fieldLabel = field === 'password' ? 'mật khẩu' : field === 'twoFaCode' ? '2FA' : 'tài khoản';
        showToast(`Chưa lưu ${fieldLabel} cho tài khoản này`, 'error');
        return;
    }

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
    rerenderCurrentView(detailId);
    showToast(reason, 'success');
}

async function showDetail(id, isBack = false) {
    const acc = window.appState.accounts.find(a => a.id === id);
    if (!acc) return false;
    const decrypted = await getSensitiveAccountData(acc, 'Để xem chi tiết tài khoản');
    if (!decrypted) return false;

    if (!isBack) recordNavHistory();
    window.appState.previousPage = window.appState.currentPage;
    window.appState.currentPage = 'detail';
    window.appState.currentDetailId = id;
    document.getElementById('page-title').textContent = 'Chi tiết';
    clearRevealedSecrets();
    window.appState.activeDecryptedAccount = { id, data: decrypted };
    renderDetail(id);
    if (!isBack) resetNavScroll();
    return true;
}

async function copyField(id, field) {
    const acc = window.appState.accounts.find(a => a.id === id);
    if (!acc) return;
    if (field === 'password' && (typeof getAuthMethod === 'function' ? getAuthMethod(acc) : acc.authMethod) !== 'email') {
        showToast(getSsoPasswordMessage(acc), 'error');
        return;
    }
    const decrypted = await getSensitiveAccountData(acc, 'Để copy thông tin tài khoản');
    if (!decrypted) return;

    let v = '', l = '';
    switch (field) { case 'username': v = decrypted.username; l = 'tài khoản'; break; case 'password': v = decrypted.password; l = 'mật khẩu'; break; case '2fa': v = decrypted.twoFaCode; l = '2FA'; break; }
    if (!v) {
        showToast(`Chưa lưu ${l || 'dữ liệu'} cho tài khoản này`, 'error');
        return;
    }
    if (v) await copyToClipboard(v, l);
}

// ===== GROUPS =====
function openCreateGroupModal() {
    openModal('Tạo nhóm', `
        <div class="form-section-title">Tên nhóm</div>
        <input type="text" id="group-name" class="input" placeholder="VD: Team AI" style="padding-left:16px">
        <div class="form-section-title">Mật khẩu chung (tuỳ chọn)</div>
        <input type="password" id="group-password" class="input" placeholder="Để trống nếu không cần mật khẩu" style="padding-left:16px">
        <div class="form-section-title">Nhập lại mật khẩu chung</div>
        <input type="password" id="group-password-confirm" class="input" placeholder="Nhập lại mật khẩu (nếu có)" style="padding-left:16px" onkeydown="if(event.key==='Enter'){event.preventDefault();submitCreateGroup()}">
        <div class="form-modal-note">Không đặt mật khẩu: thành viên xem tài khoản chia sẻ ngay. Bạn có thể đặt/đổi trong tab <b>Cài đặt</b> của nhóm bất cứ lúc nào.</div>
        <button class="btn btn-primary" style="margin-top:18px" onclick="submitCreateGroup()">Tạo nhóm</button>
    `);
    setTimeout(() => document.getElementById('group-name')?.focus(), 50);
}

async function submitCreateGroup() {
    const name = document.getElementById('group-name')?.value || '';
    const password = document.getElementById('group-password')?.value || '';
    const confirmPassword = document.getElementById('group-password-confirm')?.value || '';
    if (password !== confirmPassword) {
        showToast('Mật khẩu nhập lại chưa khớp', 'error');
        return;
    }
    try {
        const groupId = await createGroup(name, password);
        closeModal();
        showToast('Đã tạo nhóm', 'success');
        openGroupDetail(groupId);
    } catch (error) {
        console.error('Create group error:', error);
        showToast(error.message || 'Không tạo được nhóm', 'error');
    }
}

function openGroupDetail(groupId, isBack = false) {
    const group = getGroupById?.(groupId);
    if (!group) {
        showToast('Không tìm thấy nhóm', 'error');
        return false;
    }
    if (!isBack) recordNavHistory();
    window.appState.previousPage = window.appState.currentPage;
    if (window.appState.currentGroupId !== groupId) window.appState.currentGroupTab = 'board';
    window.appState.currentPage = 'group-detail';
    window.appState.currentGroupId = groupId;
    window.appState.currentGroupTab = window.appState.currentGroupTab || 'board';
    document.querySelectorAll('.d-nav-item[data-page]').forEach(item => {
        item.classList.toggle('active', item.dataset.page === 'groups');
    });
    document.getElementById('page-title').textContent = group.name || 'Chi tiết nhóm';
    loadSharedAccountsRealtime?.(groupId);
    loadSharedEditRequestsRealtime?.(groupId);
    renderGroupDetail(groupId);
    if (groupHasSharedPassword?.(group) && !isGroupUnlocked?.(groupId)) {
        setTimeout(() => openUnlockGroupModal(groupId), 120);
    }
    if (!isBack) resetNavScroll();
    return true;
}

function openUnlockGroupModal(groupId) {
    const group = getGroupById?.(groupId);
    if (!group) return;
    openModal('Mở khoá nhóm', `
        <div class="group-unlock-title">${escapeHtml(group.name || '')}</div>
        <div class="form-section-title">Mật khẩu chung</div>
        <input type="password" id="group-unlock-password" class="input" placeholder="Nhập mật khẩu chung" style="padding-left:16px" onkeydown="if(event.key==='Enter'){event.preventDefault();submitUnlockGroup('${escapeJsAttr(groupId)}')}">
        <button class="btn btn-primary" style="margin-top:18px" onclick="submitUnlockGroup('${escapeJsAttr(groupId)}')">Mở khoá</button>
    `);
    setTimeout(() => document.getElementById('group-unlock-password')?.focus(), 50);
}

async function submitUnlockGroup(groupId) {
    const password = document.getElementById('group-unlock-password')?.value || '';
    const ok = await unlockGroupWithPassword(groupId, password);
    if (ok) closeModal();
}

async function unlockGroupWithPassword(groupId, password) {
    const group = getGroupById?.(groupId);
    if (!group) return false;
    if (!password) {
        showToast('Nhập mật khẩu chung', 'error');
        return false;
    }
    try {
        const ok = await verifyGroupPassword(group, password);
        if (!ok) {
            showToast('Mật khẩu chung không đúng', 'error');
            return false;
        }
        setGroupUnlocked(groupId, password);
        window.appState.decryptedSharedAccounts = Object.fromEntries(
            Object.entries(window.appState.decryptedSharedAccounts || {}).filter(([key]) => !key.startsWith(`${groupId}:`))
        );
        showToast('Đã mở khoá nhóm', 'success');
        if (window.appState.currentPage === 'group-detail') renderGroupDetail(groupId);
        return true;
    } catch (error) {
        console.error('Unlock group error:', error);
        showToast(error.message || 'Không mở khoá được nhóm', 'error');
        return false;
    }
}

async function handleAddGroupMember(groupId) {
    const input = document.getElementById('group-member-email');
    const email = input?.value || '';
    try {
        await addGroupMember(groupId, email);
        if (input) input.value = '';
        showToast('Đã gửi lời mời', 'success');
    } catch (error) {
        showToast(error.message || 'Không thêm được thành viên', 'error');
    }
}

function openAcceptGroupInviteModal(groupId) {
    const invite = getGroupInviteById?.(groupId);
    if (!invite) return;
    if (!groupHasSharedPassword?.(invite)) {
        submitAcceptGroupInvite(groupId);
        return;
    }
    openModal('Chấp nhận lời mời', `
        <div class="group-unlock-title">${escapeHtml(invite.name || '')}</div>
        <div class="form-section-title">Mật khẩu chung</div>
        <input type="password" id="group-invite-password" class="input" placeholder="Nhập mật khẩu nhóm" style="padding-left:16px" onkeydown="if(event.key==='Enter'){event.preventDefault();submitAcceptGroupInvite('${escapeJsAttr(groupId)}')}">
        <button class="btn btn-primary" style="margin-top:18px" onclick="submitAcceptGroupInvite('${escapeJsAttr(groupId)}')">Chấp nhận</button>
    `);
    setTimeout(() => document.getElementById('group-invite-password')?.focus(), 50);
}

async function submitAcceptGroupInvite(groupId) {
    const password = document.getElementById('group-invite-password')?.value || '';
    try {
        await acceptGroupInvite(groupId, password);
        closeModal();
        showToast('Đã tham gia nhóm', 'success');
        openGroupDetail(groupId);
    } catch (error) {
        showToast(error.message || 'Không thể tham gia nhóm', 'error');
    }
}

async function handleCancelGroupInvite(groupId, email = '') {
    if (!confirm('Huỷ lời mời này?')) return;
    try {
        await cancelGroupInvite(groupId, email);
        showToast('Đã huỷ lời mời', 'success');
    } catch (error) {
        showToast(error.message || 'Không huỷ được lời mời', 'error');
    }
}

async function handleRemoveGroupMember(groupId, email) {
    if (!confirm(`Xoá ${email} khỏi nhóm?`)) return;
    try {
        await removeGroupMember(groupId, email);
        showToast('Đã xoá thành viên', 'success');
    } catch (error) {
        showToast(error.message || 'Không xoá được thành viên', 'error');
    }
}

async function handleRenameGroup(groupId) {
    const group = getGroupById?.(groupId);
    if (!group) return;
    const name = prompt('Tên nhóm mới:', group.name || '');
    if (name === null) return;
    try {
        await renameGroup(groupId, name);
        showToast('Đã đổi tên nhóm', 'success');
    } catch (error) {
        showToast(error.message || 'Không đổi tên được nhóm', 'error');
    }
}

async function handleDeleteGroup(groupId) {
    const group = getGroupById?.(groupId);
    if (!group) return;
    if (!confirm(`Xoá nhóm "${group.name}"?`)) return;
    try {
        await deleteGroup(groupId);
        showToast('Đã xoá nhóm', 'success');
        navigateTo('groups');
    } catch (error) {
        showToast(error.message || 'Không xoá được nhóm', 'error');
    }
}

function setGroupDetailTab(tab = 'board') {
    const allowed = new Set(['board', 'accounts', 'members', 'settings']);
    window.appState.currentGroupTab = allowed.has(tab) ? tab : 'board';
    renderGroupDetail(window.appState.currentGroupId);
}

function openGroupPasswordModal(groupId) {
    const group = getGroupById?.(groupId);
    if (!group || group.role !== 'owner') return;
    const has = groupHasSharedPassword?.(group);
    openModal(has ? 'Đổi mật khẩu chung' : 'Đặt mật khẩu chung', `
        <div class="form-section-title">Mật khẩu chung mới</div>
        <input type="password" id="group-new-password" class="input" placeholder="Tối thiểu 6 ký tự" style="padding-left:16px">
        <div class="form-section-title">Nhập lại mật khẩu</div>
        <input type="password" id="group-new-password-confirm" class="input" placeholder="Nhập lại mật khẩu" style="padding-left:16px" onkeydown="if(event.key==='Enter'){event.preventDefault();submitGroupPassword('${escapeJsAttr(groupId)}')}">
        <div class="form-modal-note">Sau khi ${has ? 'đổi' : 'đặt'} mật khẩu, thành viên sẽ phải nhập mật khẩu này để xem tài khoản chia sẻ.</div>
        <button class="btn btn-primary" style="margin-top:18px" onclick="submitGroupPassword('${escapeJsAttr(groupId)}')">${has ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}</button>
    `);
    setTimeout(() => document.getElementById('group-new-password')?.focus(), 50);
}

async function submitGroupPassword(groupId) {
    const pw = document.getElementById('group-new-password')?.value || '';
    const confirmPw = document.getElementById('group-new-password-confirm')?.value || '';
    if (!pw) { showToast('Nhập mật khẩu mới', 'error'); return; }
    if (pw !== confirmPw) { showToast('Mật khẩu nhập lại chưa khớp', 'error'); return; }
    try {
        await changeGroupSharedPassword(groupId, pw);
        closeModal();
        showToast('Đã cập nhật mật khẩu chung', 'success');
        renderGroupDetail(groupId);
    } catch (error) {
        console.error('Change group password error:', error);
        showToast(error.message || 'Không đổi được mật khẩu', 'error');
    }
}

async function handleRemoveGroupPassword(groupId) {
    const group = getGroupById?.(groupId);
    if (!group) return;
    if (!confirm('Gỡ mật khẩu chung? Thành viên sẽ xem tài khoản chia sẻ mà không cần nhập mật khẩu.')) return;
    try {
        await changeGroupSharedPassword(groupId, '');
        showToast('Đã gỡ mật khẩu chung', 'success');
        renderGroupDetail(groupId);
    } catch (error) {
        console.error('Remove group password error:', error);
        showToast(error.message || 'Không gỡ được mật khẩu', 'error');
    }
}

function normalizeGroupCategoryIdForUi(value) {
    return String(value || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'danh-muc';
}

function createUniqueGroupCategoryId(name, categories = []) {
    const used = new Set((categories || []).map(category => category.id));
    const base = normalizeGroupCategoryIdForUi(name);
    let id = base;
    let index = 2;
    while (used.has(id)) {
        id = `${base}-${index}`;
        index += 1;
    }
    return id;
}

function openGroupCategoryModal(groupId, categoryId = '') {
    const group = getGroupById?.(groupId);
    if (!group || group.role !== 'owner') return;
    const categories = getGroupAccountCategories?.(group) || [];
    const category = categories.find(item => item.id === categoryId) || null;
    openModal(category ? 'Sửa danh mục nhóm' : 'Thêm danh mục nhóm', `
        <div class="form-section-title">Tên danh mục</div>
        <input type="text" id="group-category-name" class="input" value="${escapeHtml(category?.name || '')}" placeholder="VD: AI, Giải trí, Team YouTube" style="padding-left:16px">
        <div class="form-section-title">Icon</div>
        <input type="text" id="group-category-icon" class="input" value="${escapeHtml(category?.icon || 'folder')}" placeholder="folder, star, work..." style="padding-left:16px">
        <div class="form-section-title">Màu</div>
        <input type="color" id="group-category-color" class="input" value="${escapeHtml(category?.color || '#6C5CE7')}" style="height:44px;padding:8px 16px">
        <div class="form-section-title">Ghi chú danh mục</div>
        <textarea id="group-category-note" class="textarea-paste" style="min-height:96px" placeholder="Ghi chú dùng chung cho danh mục này">${escapeHtml(category?.note || '')}</textarea>
        <button class="btn btn-primary" style="margin-top:18px" onclick="submitGroupCategory('${escapeJsAttr(groupId)}','${escapeJsAttr(categoryId)}')">${category ? 'Lưu danh mục' : 'Thêm danh mục'}</button>
    `);
    setTimeout(() => document.getElementById('group-category-name')?.focus(), 50);
}

async function submitGroupCategory(groupId, categoryId = '') {
    const group = getGroupById?.(groupId);
    if (!group) return;
    const categories = getGroupAccountCategories?.(group) || [];
    const existing = categories.find(item => item.id === categoryId) || null;
    const name = String(document.getElementById('group-category-name')?.value || '').trim();
    if (!name) {
        showToast('Nhập tên danh mục', 'error');
        return;
    }
    const nextCategory = {
        id: existing?.id || createUniqueGroupCategoryId(name, categories),
        name,
        note: String(document.getElementById('group-category-note')?.value || '').trim(),
        icon: String(document.getElementById('group-category-icon')?.value || 'folder').trim() || 'folder',
        color: String(document.getElementById('group-category-color')?.value || '#6C5CE7').trim() || '#6C5CE7',
        order: existing?.order ?? categories.length,
    };
    const next = existing
        ? categories.map(item => item.id === existing.id ? nextCategory : item)
        : [...categories, nextCategory];
    try {
        await updateGroupAccountCategories(groupId, next);
        closeModal();
        showToast(existing ? 'Đã cập nhật danh mục nhóm' : 'Đã thêm danh mục nhóm', 'success');
    } catch (error) {
        showToast(error.message || 'Không lưu được danh mục nhóm', 'error');
    }
}

async function handleMoveGroupCategory(groupId, categoryId, direction) {
    const group = getGroupById?.(groupId);
    if (!group) return;
    const categories = getGroupAccountCategories?.(group) || [];
    const index = categories.findIndex(item => item.id === categoryId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= categories.length) return;
    const next = [...categories];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    try {
        await updateGroupAccountCategories(groupId, next.map((item, order) => ({ ...item, order })));
        showToast('Đã sắp xếp danh mục', 'success');
    } catch (error) {
        showToast(error.message || 'Không sắp xếp được danh mục', 'error');
    }
}

async function handleDeleteGroupCategory(groupId, categoryId) {
    const group = getGroupById?.(groupId);
    if (!group || group.role !== 'owner') return;
    const categories = getGroupAccountCategories?.(group) || [];
    const category = categories.find(item => item.id === categoryId);
    if (!category) return;
    const affected = (window.appState.sharedAccounts?.[groupId] || []).filter(account => account.groupCategoryId === categoryId);
    if (!confirm(`Xoá danh mục "${category.name}"?${affected.length ? ` ${affected.length} tài khoản sẽ về Chưa phân loại.` : ''}`)) return;
    try {
        await updateGroupAccountCategories(groupId, categories.filter(item => item.id !== categoryId).map((item, order) => ({ ...item, order })));
        await Promise.all(affected.map(account => updateSharedAccountGroupMeta(groupId, account.id, { groupCategoryId: null })));
        showToast('Đã xoá danh mục nhóm', 'success');
    } catch (error) {
        showToast(error.message || 'Không xoá được danh mục nhóm', 'error');
    }
}

function canManageSharedAccountForUi(group, account) {
    if (typeof canManageSharedAccount === 'function') return canManageSharedAccount(group, account);
    return group?.role === 'owner' || (account?.sharedByUid && account.sharedByUid === window.appState.user?.uid);
}

async function handleSetSharedAccountCategory(groupId, accountId, categoryId = '') {
    try {
        await updateSharedAccountGroupMeta(groupId, accountId, { groupCategoryId: categoryId || null });
        showToast('Đã chuyển danh mục tài khoản', 'success');
    } catch (error) {
        showToast(error.message || 'Không chuyển được danh mục', 'error');
    }
}

/* ---- Custom category dropdown (thay cho <select> native để tránh giật & đẹp hơn) ---- */
let _activeCatMenu = null;

function _catMenuOutsideHandler(event) {
    if (!_activeCatMenu) return;
    if (_activeCatMenu.menu.contains(event.target) || _activeCatMenu.trigger.contains(event.target)) return;
    closeCategoryDropdown();
}

function _catMenuKeyHandler(event) {
    if (event.key === 'Escape') closeCategoryDropdown();
}

function closeCategoryDropdown() {
    if (!_activeCatMenu) return;
    const { menu, trigger } = _activeCatMenu;
    _activeCatMenu = null;
    trigger?.classList.remove('open');
    menu.classList.remove('open');
    document.removeEventListener('mousedown', _catMenuOutsideHandler, true);
    document.removeEventListener('keydown', _catMenuKeyHandler, true);
    window.removeEventListener('scroll', closeCategoryDropdown, true);
    window.removeEventListener('resize', closeCategoryDropdown, true);
    setTimeout(() => menu.remove(), 120);
}

function _positionCatMenu(menu, trigger) {
    const rect = trigger.getBoundingClientRect();
    menu.style.minWidth = `${Math.max(rect.width, 180)}px`;
    const menuRect = menu.getBoundingClientRect();
    const gap = 6;
    let top = rect.bottom + gap;
    if (top + menuRect.height > window.innerHeight - 8) {
        const above = rect.top - menuRect.height - gap;
        top = above >= 8 ? above : Math.max(8, window.innerHeight - 8 - menuRect.height);
    }
    let left = rect.left;
    if (left + menuRect.width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - 8 - menuRect.width);
    }
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
}

function openCategoryDropdown(trigger, groupId, accountId) {
    if (_activeCatMenu && _activeCatMenu.trigger === trigger) {
        closeCategoryDropdown();
        return;
    }
    closeCategoryDropdown();
    const group = getGroupById?.(groupId);
    if (!group) return;
    const account = (window.appState.sharedAccounts?.[groupId] || []).find(item => item.id === accountId);
    const currentId = account?.groupCategoryId || '';
    const categories = getGroupAccountCategories?.(group) || [];
    const options = [{ id: '', name: 'Chưa phân loại', color: '#9CA3AF' }, ...categories];

    const menu = document.createElement('div');
    menu.className = 'cat-menu';
    menu.innerHTML = options.map(option => {
        const id = option.id || '';
        const active = (id === (currentId || ''));
        return `<button type="button" class="cat-menu-option${active ? ' is-active' : ''}" data-id="${escapeHtml(id)}">
            <span class="cat-menu-dot" style="background:${escapeHtml(option.color || '#9CA3AF')}"></span>
            <span class="cat-menu-name">${escapeHtml(option.name)}</span>
            <svg class="cat-menu-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="15" height="15"><polyline points="20,6 9,17 4,12"/></svg>
        </button>`;
    }).join('');
    document.body.appendChild(menu);

    menu.querySelectorAll('.cat-menu-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id') || '';
            closeCategoryDropdown();
            if ((id || '') !== (currentId || '')) handleSetSharedAccountCategory(groupId, accountId, id);
        });
    });

    _positionCatMenu(menu, trigger);
    trigger.classList.add('open');
    requestAnimationFrame(() => menu.classList.add('open'));
    _activeCatMenu = { menu, trigger };
    setTimeout(() => {
        document.addEventListener('mousedown', _catMenuOutsideHandler, true);
        document.addEventListener('keydown', _catMenuKeyHandler, true);
        window.addEventListener('scroll', closeCategoryDropdown, true);
        window.addEventListener('resize', closeCategoryDropdown, true);
    }, 0);
}

async function handleMoveSharedAccount(groupId, accountId, direction, categoryId = '') {
    const accounts = (window.appState.sharedAccounts?.[groupId] || [])
        .filter(account => (account.groupCategoryId || '') === (categoryId || ''));
    const sorted = typeof sortSharedAccountsForGroup === 'function' ? sortSharedAccountsForGroup(accounts) : accounts;
    const index = sorted.findIndex(account => account.id === accountId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return;
    const ordered = [...sorted];
    [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
    try {
        await Promise.all(ordered.map((account, order) => (
            updateSharedAccountGroupMeta(groupId, account.id, { groupSortOrder: (order + 1) * 1000 })
        )));
        showToast('Đã sắp xếp tài khoản', 'success');
    } catch (error) {
        showToast(error.message || 'Không sắp xếp được tài khoản', 'error');
    }
}

function openSharedAccountGroupNoteModal(groupId, accountId) {
    const group = getGroupById?.(groupId);
    const account = getSharedAccountById(groupId, accountId);
    if (!group || !account || !canManageSharedAccountForUi(group, account)) return;
    openModal('Ghi chú trong nhóm', `
        <div class="form-section-title">${escapeHtml(account.name || account.serviceName || 'Tài khoản')}</div>
        <textarea id="shared-account-group-note" class="textarea-paste" style="min-height:120px" placeholder="Ghi chú riêng cho nhóm này">${escapeHtml(account.groupNote || '')}</textarea>
        <button class="btn btn-primary" style="margin-top:18px" onclick="submitSharedAccountGroupNote('${escapeJsAttr(groupId)}','${escapeJsAttr(accountId)}')">Lưu ghi chú</button>
    `);
}

async function submitSharedAccountGroupNote(groupId, accountId) {
    const note = String(document.getElementById('shared-account-group-note')?.value || '').trim();
    try {
        await updateSharedAccountGroupMeta(groupId, accountId, { groupNote: note });
        closeModal();
        showToast('Đã lưu ghi chú nhóm', 'success');
    } catch (error) {
        showToast(error.message || 'Không lưu được ghi chú nhóm', 'error');
    }
}

async function handleToggleGroupAccountManager(groupId, email, checked) {
    try {
        await setGroupAccountManager(groupId, email, checked);
        showToast(checked ? 'Đã cấp quyền quản lý tài khoản' : 'Đã gỡ quyền quản lý tài khoản', 'success');
    } catch (error) {
        showToast(error.message || 'Không cập nhật được quyền quản lý', 'error');
        renderGroupDetail(groupId);
    }
}

function getSharedAccountById(groupId, accountId) {
    return (window.appState.sharedAccounts?.[groupId] || []).find(account => account.id === accountId) || null;
}

function getSharedAccountCacheKey(groupId, accountId) {
    return `${groupId}:${accountId}`;
}

async function decryptSharedAccountForDisplay(groupId, accountId) {
    const key = getSharedAccountCacheKey(groupId, accountId);
    if (window.appState.decryptedSharedAccounts?.[key]) return window.appState.decryptedSharedAccounts[key];
    const password = getUnlockedGroupPassword?.(groupId);
    const account = getSharedAccountById(groupId, accountId);
    if (!password || !account) return null;
    try {
        const decrypted = await decryptSharedAccount(account, password);
        window.appState.decryptedSharedAccounts[key] = decrypted;
        if (window.appState.currentPage === 'group-detail' && window.appState.currentGroupId === groupId) {
            renderGroupDetail(groupId);
        }
        return decrypted;
    } catch (error) {
        console.error('Decrypt shared account error:', error);
        showToast('Không giải mã được tài khoản chia sẻ', 'error');
        return null;
    }
}

async function copySharedField(groupId, accountId, field) {
    const decrypted = await decryptSharedAccountForDisplay(groupId, accountId);
    if (!decrypted) return;
    let value = '';
    let label = '';
    if (field === 'username') { value = decrypted.username; label = 'tài khoản'; }
    else if (field === 'password') { value = decrypted.password; label = 'mật khẩu'; }
    else if (field === '2fa' || field === 'twoFaCode') { value = decrypted.twoFaCode; label = '2FA'; }
    if (!value) {
        showToast(`Chưa lưu ${label || 'dữ liệu'} cho tài khoản này`, 'error');
        return;
    }
    await copyToClipboard(value, label);
}

async function handleRemoveSharedAccount(groupId, accountId) {
    const group = getGroupById?.(groupId);
    const account = getSharedAccountById(groupId, accountId);
    if (!canManageSharedAccountForUi(group, account)) {
        showToast('Không có quyền gỡ tài khoản này', 'error');
        return;
    }
    if (!confirm('Gỡ tài khoản này khỏi nhóm?')) return;
    try {
        await removeSharedAccount(groupId, accountId);
        delete window.appState.decryptedSharedAccounts?.[getSharedAccountCacheKey(groupId, accountId)];
        showToast('Đã gỡ tài khoản khỏi nhóm', 'success');
    } catch (error) {
        showToast(error.message || 'Không gỡ được tài khoản', 'error');
    }
}

function canDirectEditSharedAccount(group, account) {
    return group?.role === 'owner' || (account?.sharedByUid && account.sharedByUid === window.appState.user?.uid);
}

function renderSharedAccountEditForm(group, account, decrypted) {
    const today = todayStr();
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    const defaultExpiryValue = dateToInputValue(defaultExpiry);
    const purchaseValue = account.purchaseDate || today;
    const expiryValue = account.expiryDate || defaultExpiryValue;
    const isLifetime = account.expiryType === 'lifetime';
    const rawValue = [decrypted?.username, decrypted?.password, decrypted?.twoFaCode].filter(Boolean).join('|');
    const direct = canDirectEditSharedAccount(group, account);
    return `
        <div class="form-section-title">Dán thông tin tài khoản</div>
        <textarea class="textarea-paste" id="paste-input" placeholder="user@email.com|password123|2FA_CODE" oninput="previewParse()">${escapeHtml(rawValue)}</textarea>
        <div id="parse-preview"></div>

        <div class="form-section-title">Tên dịch vụ</div>
        <input type="text" id="add-name" class="input" value="${escapeHtml(account.name || account.serviceName || '')}" style="padding-left:16px">

        <div class="form-section-title">Thời hạn</div>
        <input type="text" id="add-smart-date" class="input smart-date-input" value="${isLifetime ? 'Vĩnh viễn' : '30 ngày'}" placeholder="30 ngày, 28/04 30, 28/04 > 28/05" oninput="applySmartDateInput(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();applySmartDateInput(this.value)}">
        <input type="hidden" id="add-purchase" value="${escapeHtml(purchaseValue)}">
        <input type="hidden" id="add-expiry" value="${escapeHtml(expiryValue)}">
        <div id="add-expiry-hint" class="quick-date-hint smart-date-preview"></div>
        <div class="smart-date-options">
            <label class="quick-lifetime"><input type="checkbox" id="add-date-custom" onchange="toggleSmartDateDetails(this)" checked> Tuỳ chỉnh chi tiết</label>
            <label class="quick-lifetime"><input type="checkbox" id="add-lifetime" onchange="handleAddLifetimeToggle(this)" ${isLifetime ? 'checked' : ''}> Vĩnh viễn</label>
        </div>
        <div id="smart-date-details" class="smart-date-details">
            <div class="quick-date-grid">
                <div class="quick-date-field">
                    <label>Ngày mua</label>
                    <input type="date" id="add-purchase-detail" class="input" value="${escapeHtml(purchaseValue)}" onchange="setAddPurchaseDate(this.value)">
                </div>
                <div class="quick-date-field">
                    <label>Ngày hết hạn</label>
                    <input type="date" id="add-expiry-detail" class="input" value="${escapeHtml(expiryValue)}" onchange="setExpiryDate(inputValueToDate(this.value), 'tuỳ chỉnh')">
                </div>
            </div>
        </div>

        <div class="form-section-title">Ghi chú</div>
        <textarea class="textarea-paste" id="add-note" style="min-height:100px">${escapeHtml(decrypted?.note || '')}</textarea>
        <button class="btn btn-primary" style="margin-top:18px" onclick="submitSharedAccountEdit('${escapeJsAttr(group.id)}','${escapeJsAttr(account.id)}')">${direct ? 'Lưu thay đổi' : 'Gửi yêu cầu duyệt'}</button>
    `;
}

function finishSharedAccountEditForm(account) {
    const lifetime = account.expiryType === 'lifetime';
    const lifetimeInput = document.getElementById('add-lifetime');
    const smart = document.getElementById('add-smart-date');
    const expiryDetail = document.getElementById('add-expiry-detail');
    if (lifetimeInput) lifetimeInput.checked = lifetime;
    if (smart) smart.disabled = lifetime;
    if (expiryDetail) expiryDetail.disabled = lifetime;
    updateAddExpiryHint?.('edit');
    previewParse?.();
}

async function openSharedAccountEditModal(groupId, accountId) {
    const group = getGroupById?.(groupId);
    const account = getSharedAccountById(groupId, accountId);
    if (!group || !account) return;
    if (!isGroupUnlocked?.(groupId)) {
        openUnlockGroupModal(groupId);
        showToast('Mở khoá nhóm trước khi sửa tài khoản', 'error');
        return;
    }
    const decrypted = await decryptSharedAccountForDisplay(groupId, accountId);
    if (!decrypted) return;
    openModal('Sửa tài khoản chia sẻ', renderSharedAccountEditForm(group, account, decrypted));
    finishSharedAccountEditForm(account);
}

function collectSharedAccountEditInput(groupId, accountId) {
    const account = getSharedAccountById(groupId, accountId);
    const decrypted = window.appState.decryptedSharedAccounts?.[getSharedAccountCacheKey(groupId, accountId)] || {};
    const raw = document.getElementById('paste-input')?.value || '';
    const parsed = parseAccountInput(raw) || {};
    const rawName = document.getElementById('add-name')?.value?.trim() || '';
    const smartName = parseSmartName(rawName);
    const name = smartName.name || rawName;
    if (!name) return { ok: false, message: 'Nhập tên dịch vụ' };
    const isLifetime = document.getElementById('add-lifetime')?.checked === true;
    const purchaseDate = document.getElementById('add-purchase')?.value || account?.purchaseDate || todayStr();
    const expiryDate = isLifetime ? null : (document.getElementById('add-expiry')?.value || account?.expiryDate || '');
    if (!isLifetime && !expiryDate) return { ok: false, message: 'Chọn ngày hết hạn hoặc bật Vĩnh viễn' };
    const username = parsed.username || decrypted.username || '';
    const password = parsed.password || decrypted.password || '';
    const twoFaCode = parsed.twoFaCode || decrypted.twoFaCode || '';
    const note = autoTagNoteLinks(String(document.getElementById('add-note')?.value || '').trim());
    const platform = smartName.platform || account?.platform || detectPlatform(name);
    const tags = typeof normalizeTags === 'function'
        ? normalizeTags([...(Array.isArray(account?.tags) ? account.tags : []), ...(smartName.tags || [])])
        : [...(Array.isArray(account?.tags) ? account.tags : []), ...(smartName.tags || [])];
    return {
        ok: true,
        account: {
            ...account,
            name,
            serviceName: name,
            platform,
            purchaseDate,
            expiryDate,
            expiryType: isLifetime ? 'lifetime' : 'fixed',
            status: getStatusFromExpiry(expiryDate, isLifetime ? 'lifetime' : 'fixed'),
            displayUsername: maskUsername(username),
            tags,
            planTag: tags[0] || account?.planTag || null,
            username,
            password,
            twoFaCode,
            note,
        },
    };
}

async function submitSharedAccountEdit(groupId, accountId) {
    const group = getGroupById?.(groupId);
    const account = getSharedAccountById(groupId, accountId);
    if (!group || !account) return;
    const built = collectSharedAccountEditInput(groupId, accountId);
    if (!built.ok) {
        showToast(built.message, 'error');
        return;
    }
    const sharedPassword = getUnlockedGroupPassword?.(groupId) || '';
    if (!sharedPassword) {
        openUnlockGroupModal(groupId);
        return;
    }
    try {
        if (canDirectEditSharedAccount(group, account)) {
            await updateSharedAccountInGroup(groupId, accountId, built.account, sharedPassword);
            delete window.appState.decryptedSharedAccounts?.[getSharedAccountCacheKey(groupId, accountId)];
            showToast('Đã lưu tài khoản chia sẻ', 'success');
        } else {
            await createSharedEditRequest(groupId, accountId, built.account, sharedPassword);
            showToast('Đã gửi yêu cầu sửa, chờ người chia sẻ duyệt', 'success');
        }
        closeModal();
        renderGroupDetail(groupId);
    } catch (error) {
        showToast(error.message || 'Không lưu được thay đổi', 'error');
    }
}

async function handleAcceptSharedEditRequest(groupId, requestId) {
    const request = getSharedEditRequestById?.(groupId, requestId);
    if (!request || !confirm('Duyệt thay đổi này?')) return;
    try {
        await acceptSharedEditRequest(groupId, requestId);
        if (request.accountId) delete window.appState.decryptedSharedAccounts?.[getSharedAccountCacheKey(groupId, request.accountId)];
        showToast('Đã duyệt thay đổi', 'success');
    } catch (error) {
        showToast(error.message || 'Không duyệt được yêu cầu', 'error');
    }
}

async function handleRejectSharedEditRequest(groupId, requestId) {
    if (!confirm('Từ chối yêu cầu sửa này?')) return;
    try {
        await rejectSharedEditRequest(groupId, requestId);
        showToast('Đã từ chối yêu cầu', 'success');
    } catch (error) {
        showToast(error.message || 'Không từ chối được yêu cầu', 'error');
    }
}

function renderShareAccountModal(accId) {
    const groups = window.appState.groups || [];
    if (!groups.length) {
        return `<div class="empty-state compact"><div class="empty-state-title">Chưa có nhóm</div></div>`;
    }
    const options = groups.map(group => {
        const lockedText = isGroupUnlocked?.(group.id) ? 'đã mở' : 'cần mật khẩu';
        return `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)} - ${lockedText}</option>`;
    }).join('');
    const firstGroup = groups[0];
    const passwordHidden = isGroupUnlocked?.(firstGroup.id) ? 'hidden' : '';
    return `
        <div class="form-section-title">Nhóm đích</div>
        <select id="share-group-id" class="input" onchange="updateShareGroupPasswordVisibility()" style="padding-left:16px">${options}</select>
        <div id="share-group-password-wrap" ${passwordHidden}>
            <div class="form-section-title">Mật khẩu chung</div>
            <input type="password" id="share-group-password" class="input" placeholder="Nhập mật khẩu chung của nhóm" style="padding-left:16px">
        </div>
        <button class="btn btn-primary" style="margin-top:18px" onclick="submitShareAccountToGroup('${escapeJsAttr(accId)}')">Chia sẻ</button>
    `;
}

function openShareAccountModal(accId) {
    const groups = window.appState.groups || [];
    if (!groups.length) {
        showToast('Bạn chưa có nhóm nào', 'error');
        return;
    }
    openModal('Chia sẻ lên nhóm', renderShareAccountModal(accId));
}

function updateShareGroupPasswordVisibility() {
    const groupId = document.getElementById('share-group-id')?.value || '';
    const wrap = document.getElementById('share-group-password-wrap');
    if (wrap) wrap.hidden = Boolean(isGroupUnlocked?.(groupId));
}

async function submitShareAccountToGroup(accId) {
    const groupId = document.getElementById('share-group-id')?.value || '';
    const group = getGroupById?.(groupId);
    const acc = window.appState.accounts.find(account => account.id === accId);
    if (!group || !acc) return;

    let sharedPassword = getUnlockedGroupPassword?.(groupId) || '';
    if (!sharedPassword) {
        const passwordInput = document.getElementById('share-group-password')?.value || '';
        const unlocked = await unlockGroupWithPassword(groupId, passwordInput);
        if (!unlocked) return;
        sharedPassword = getUnlockedGroupPassword?.(groupId) || '';
    }

    const sensitive = await getSensitiveAccountData(acc, 'Để chia sẻ tài khoản lên nhóm');
    if (!sensitive) return;
    try {
        await shareAccountToGroup(groupId, { ...acc, ...sensitive, id: acc.id }, sharedPassword);
        closeModal();
        showToast('Đã chia sẻ tài khoản lên nhóm', 'success');
    } catch (error) {
        console.error('Share account to group error:', error);
        showToast(error.message || 'Không chia sẻ được tài khoản', 'error');
    }
}

function openExternalLink(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// ===== TOTP LIVE WIDGET (2FA) =====
function stopTotpTicker() {
    if (window.tingTotpInterval) {
        clearInterval(window.tingTotpInterval);
        window.tingTotpInterval = null;
    }
    window.tingTotpSecret = null;
}

async function refreshTotpWidget() {
    const codeEl = document.getElementById('totp-code');
    const secret = window.tingTotpSecret;
    if (!codeEl || !secret) { stopTotpTicker(); return; }
    if (typeof generateTOTP !== 'function') return;
    const code = await generateTOTP(secret);
    if (!code) { codeEl.textContent = '------'; return; }
    codeEl.textContent = code.replace(/(\d{3})(\d{3})/, '$1 $2');
    const remain = typeof totpTimeRemaining === 'function' ? totpTimeRemaining(30) : 30;
    const countEl = document.getElementById('totp-count');
    const barEl = document.getElementById('totp-bar');
    if (countEl) countEl.textContent = `${remain}s`;
    if (barEl) barEl.style.width = `${Math.round((remain / 30) * 100)}%`;
}

function startTotpTicker(secret) {
    stopTotpTicker();
    if (!secret) return;
    window.tingTotpSecret = secret;
    refreshTotpWidget();
    window.tingTotpInterval = setInterval(refreshTotpWidget, 1000);
}

async function copyTotpCode() {
    const secret = window.tingTotpSecret;
    if (!secret || typeof generateTOTP !== 'function') return;
    const code = await generateTOTP(secret);
    if (code) await copyToClipboard(code, 'mã 2FA');
}

async function openWeb2FA(secret) {
    if (secret) {
        try { await copyToClipboard(secret, 'key 2FA'); } catch (_) {}
        showToast('Đã copy key 2FA, dán vào trang web để lấy mã', 'success');
    }
    openExternalLink('https://2fa.live/');
}

if (typeof window !== 'undefined') {
    window.startTotpTicker = startTotpTicker;
    window.stopTotpTicker = stopTotpTicker;
    window.copyTotpCode = copyTotpCode;
    window.openWeb2FA = openWeb2FA;
}

async function copyNoteSegment(text) {
    if (!text) return;
    await copyToClipboard(text, 'ghi chú');
}

async function copyNoteTextAndOpen(text, url) {
    if (url) openExternalLink(url);
    if (text) await copyToClipboard(text, 'mã');
}

const AUTH_METHOD_PLATFORM_ALIASES = {
    google: ['google', 'google-account', 'gmail', 'googledrive', 'google-ai', 'gemini-pro'],
    apple: ['apple', 'icloud'],
    microsoft: ['microsoft', 'office365'],
    github: ['github'],
    facebook: ['facebook'],
};

function getAuthMethodLabel(method) {
    const key = typeof getAuthMethod === 'function' ? getAuthMethod(method) : String(method || 'email');
    return window.AUTH_METHOD_CONFIG?.[key]?.label || key;
}

function getAuthProviderPlatform(method) {
    const key = typeof getAuthMethod === 'function' ? getAuthMethod(method) : String(method || 'email');
    return {
        google: 'google',
        apple: 'apple',
        microsoft: 'microsoft',
        github: 'github',
        facebook: 'facebook',
    }[key] || null;
}

function accountMatchesAuthMethod(acc, method) {
    const key = typeof getAuthMethod === 'function' ? getAuthMethod(method) : String(method || 'email');
    const aliases = AUTH_METHOD_PLATFORM_ALIASES[key] || [key];
    const platform = String(getResolvedPlatform(acc) || acc?.platform || '').toLowerCase();
    if (aliases.includes(platform)) return true;
    const name = String(acc?.name || '').toLowerCase();
    return aliases.some(alias => name.includes(alias.replace(/-/g, ' ')) || name.includes(alias));
}

function getLinkedAccountOptions(method) {
    const key = typeof getAuthMethod === 'function' ? getAuthMethod(method) : String(method || 'email');
    if (key === 'email') return [];
    return (window.appState.accounts || [])
        .filter(acc => acc.type === 'personal' && accountMatchesAuthMethod(acc, key));
}

function updateAddAuthMethodUI() {
    const method = typeof getAuthMethod === 'function'
        ? getAuthMethod(window.appState.addFormAuthMethod || 'email')
        : (window.appState.addFormAuthMethod || 'email');
    // Hỗ trợ cả grid selector cũ lẫn inline selector mới
    document.querySelectorAll('.auth-method-btn, .auth-method-inline-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.method === method);
    });

    const credentialBlock = document.getElementById('add-credential-block');
    const linkedWrap = document.getElementById('add-auth-linked-wrap');
    const pickerWrap = document.getElementById('linked-account-picker-wrap');
    if (credentialBlock) credentialBlock.hidden = method !== 'email';
    if (linkedWrap) linkedWrap.hidden = method === 'email';
    if (pickerWrap && typeof renderLinkedAccountPicker === 'function') {
        pickerWrap.innerHTML = renderLinkedAccountPicker(method);
    }
    if (method !== 'email') {
        const preview = document.getElementById('parse-preview');
        if (preview) preview.innerHTML = '';
        const detect = document.getElementById('service-detect-suggestions');
        if (detect) detect.innerHTML = '';
    }
}

function selectAuthMethod(method) {
    const next = typeof getAuthMethod === 'function' ? getAuthMethod(method) : String(method || 'email');
    window.appState.addFormAuthMethod = next;
    window.appState.addFormLinkedId = null;
    const paste = document.getElementById('paste-input');
    if (next !== 'email' && paste) paste.value = '';
    updateAddAuthMethodUI();
}

function getLinkedAccountUsernameForSave(acc) {
    return String(acc?.username || acc?.displayUsername || '').trim();
}

function selectLinkedAccount(id) {
    const method = typeof getAuthMethod === 'function'
        ? getAuthMethod(window.appState.addFormAuthMethod || 'email')
        : (window.appState.addFormAuthMethod || 'email');
    const acc = getLinkedAccountOptions(method).find(item => item.id === id);
    if (!acc) return;
    window.appState.addFormLinkedId = id;

    const username = getLinkedAccountUsernameForSave(acc);
    const paste = document.getElementById('paste-input');
    if (paste) paste.value = username;
    const preview = document.getElementById('parse-preview');
    if (preview) preview.innerHTML = '';
    updateAddAuthMethodUI();
}

function openLinkedPersonalAccount(method) {
    const key = typeof getAuthMethod === 'function' ? getAuthMethod(method) : String(method || 'email');
    const label = getAuthMethodLabel(key);
    closeModal();
    if (window.appState.currentPage !== 'personal') navigateTo('personal');
    setTimeout(() => {
        openAddModal();
        window.appState.addFormPlatform = getAuthProviderPlatform(key);
        const input = document.getElementById('add-name');
        if (input) input.value = `${label} cá nhân`;
        updateAddTagSuggestions?.();
        renderSelectedAddTags?.();
        updatePlatformPickerState?.();
    }, 0);
}

function getSsoPasswordMessage(acc) {
    const method = typeof getAuthMethod === 'function' ? getAuthMethod(acc) : (acc?.authMethod || 'email');
    const label = getAuthMethodLabel(method);
    const linked = typeof getLinkedAccount === 'function' ? getLinkedAccount(acc) : { account: null, status: 'deleted' };
    if (linked.status === 'active' && linked.account) return `Mật khẩu nằm ở TK ${label} gốc: ${linked.account.name}`;
    if (acc?.linkedAccountId) return `TK ${label} gốc không còn khả dụng`;
    return `Dịch vụ này dùng đăng nhập ${label}, chưa chọn TK gốc`;
}

function renderChangeLinkedAccountModal(acc) {
    const method = typeof getAuthMethod === 'function' ? getAuthMethod(acc) : (acc?.authMethod || 'email');
    const options = getLinkedAccountOptions(method);
    const label = getAuthMethodLabel(method);
    if (!options.length) {
        return `<div class="linked-account-picker">
            <div class="linked-account-empty">
                <span class="linked-account-empty-icon">⚠</span>
                Chưa có TK ${escapeHtml(label)} cá nhân phù hợp
                <button type="button" class="btn btn-sm btn-outline" onclick="openLinkedPersonalAccount('${escapeJsAttr(method)}')">Thêm TK ${escapeHtml(label)} ngay</button>
            </div>
        </div>`;
    }
    return `<div class="linked-account-picker">
        ${options.map(option => {
            const selected = acc.linkedAccountId === option.id;
            return `<label class="linked-account-option ${selected ? 'selected' : ''}" onclick="setLinkedAccountForExisting('${escapeJsAttr(acc.id)}','${escapeJsAttr(option.id)}')">
                <input type="radio" name="change-linked-account-id" ${selected ? 'checked' : ''}>
                ${renderAccountMiniLogo(option, 'linked-service-logo')}
                <span class="linked-option-info">
                    <span class="linked-option-name">${escapeHtml(option.name)}</span>
                    <span class="linked-option-email">${escapeHtml(getAccountUsernameForDisplay(option))}</span>
                </span>
            </label>`;
        }).join('')}
    </div>`;
}

function changeLinkedAccount(accId) {
    const acc = (window.appState.accounts || []).find(item => item.id === accId);
    if (!acc) return;
    if ((typeof getAuthMethod === 'function' ? getAuthMethod(acc) : acc.authMethod) === 'email') {
        showToast('Tài khoản này đang dùng email riêng', 'error');
        return;
    }
    openModal('Đổi TK gốc', renderChangeLinkedAccountModal(acc));
}

async function setLinkedAccountForExisting(accId, linkedId) {
    const acc = (window.appState.accounts || []).find(item => item.id === accId);
    const linked = (window.appState.accounts || []).find(item => item.id === linkedId);
    if (!acc || !linked) return;
    const update = {
        linkedAccountId: linkedId,
        displayUsername: maskUsername(getLinkedAccountUsernameForSave(linked)),
    };

    if (window.appState.isDemo) {
        Object.assign(acc, update, { username: getLinkedAccountUsernameForSave(linked) });
        closeModal();
        showToast('Đã đổi TK gốc', 'success');
        rerenderCurrentView(accId);
        return;
    }

    if (await updateAccountInDB(accId, update)) {
        closeModal();
        showToast('Đã đổi TK gốc', 'success');
    }
}

async function unlinkAccount(accId) {
    const acc = (window.appState.accounts || []).find(item => item.id === accId);
    if (!acc) return;
    if (!confirm('Gỡ liên kết TK gốc cho tài khoản này?')) return;

    if (window.appState.isDemo) {
        acc.linkedAccountId = null;
        showToast('Đã gỡ liên kết TK gốc', 'success');
        rerenderCurrentView(accId);
        return;
    }

    if (await updateAccountInDB(accId, { linkedAccountId: null })) {
        showToast('Đã gỡ liên kết TK gốc', 'success');
    }
}

// ===== ADD ACCOUNT =====
function openAddModal() {
    const type = window.appState.currentPage === 'personal' ? 'personal' : 'bought';
    window.appState.editingAccount = null;
    window.appState.addFormTags = [];
    window.appState.addFormAutoTags = [];
    window.appState.addFormPlatform = null;
    window.appState.addFormAutoPlatform = null;
    window.appState.addFormDetectedServices = { platforms: [], tags: [] };
    window.appState.addFormAuthMethod = 'email';
    window.appState.addFormLinkedId = null;
    resetAddFormGuideState?.();
    openModal(type === 'personal' ? 'Thêm TK cá nhân' : 'Thêm TK mua', renderAddForm(type));
    initAddTagPicker();
    updateAddExpiryHint();
    updateAddAuthMethodUI();
    window.setTimeout(() => guideAddFormTo?.('platform-section', { focus: false, block: 'start' }), 30);
}

const PASTE_PLATFORM_ALIASES = {
    chatgpt: 'openai',
    gpt: 'openai',
    openai: 'openai',
    gmail: 'gmail',
    googlemail: 'gmail',
    googledrive: 'googledrive',
    gdrive: 'googledrive',
    googleaccount: 'google-account',
    accgoogle: 'google-account',
    taikhoangoogle: 'google-account',
    googlecanhan: 'google-account',
    googleone: 'google',
    gemini: 'google-ai',
    geminipro: 'gemini-pro',
    geminiadvanced: 'gemini-pro',
    veo: 'google-veo',
    veo3: 'google-veo',
    antigravity: 'google-antigravity',
    office: 'office365',
    office365: 'office365',
    microsoft365: 'office365',
    ms365: 'office365',
    outlook: 'microsoft',
    hotmail: 'microsoft',
    live: 'microsoft',
    icloud: 'apple',
    protonmail: 'protonmail',
    proton: 'proton',
    discordnitro: 'discord',
    nitro: 'discord',
};

function normalizePasteValue(value) {
    const normalized = typeof normalizeQuickText === 'function'
        ? normalizeQuickText(value)
        : String(value || '').toLowerCase().trim();
    return normalized
        .replace(/&/g, 'and')
        .replace(/\+/g, 'plus')
        .replace(/[^a-z0-9]+/g, '');
}

function getPastePlatformCatalog() {
    const catalog = new Map();
    const add = (key, platformId) => {
        const cleanKey = normalizePasteValue(key);
        const cleanPlatform = String(platformId || '').trim();
        if (!cleanKey || !cleanPlatform || cleanPlatform === 'other') return;
        catalog.set(cleanKey, cleanPlatform);
    };

    Object.keys(window.TING_PLATFORM_ICONS || {}).forEach(platformId => {
        add(platformId, platformId);
        add(platformId.replace(/-/g, ''), platformId);
        const config = typeof getPlatformIconConfig === 'function' ? getPlatformIconConfig(platformId) : null;
        if (config?.label) add(config.label, platformId);
    });
    Object.keys(window.PLATFORM_PLAN_TAGS || {}).forEach(platformId => {
        add(platformId, platformId);
        add(platformId.replace(/-/g, ''), platformId);
    });
    if (typeof getAddFormPlatformOptions === 'function') {
        getAddFormPlatformOptions().forEach(item => {
            add(item.id, item.id);
            add(item.name, item.id);
        });
    }
    Object.entries(PASTE_PLATFORM_ALIASES).forEach(([alias, platformId]) => add(alias, platformId));
    return catalog;
}

function getPasteSourceRank(source) {
    return { account: 5, password: 4, text: 3, token: 3, domain: 1 }[source] || 2;
}

function getPastePlatformConfidence(source, mode, matchedLength = 0) {
    const sourceBase = { account: 90, password: 88, text: 84, token: 84, domain: 58 }[source] || 78;
    const modeBoost = { direct: 8, detect: 4, substring: 0 }[mode] || 0;
    return sourceBase + modeBoost + Math.min(Number(matchedLength) || 0, 14) / 2;
}

function findPlatformMatchInToken(value, source = 'text') {
    const token = normalizePasteValue(value);
    if (!token || token.length < 2) return null;
    const catalog = getPastePlatformCatalog();
    const direct = catalog.get(token);
    if (direct) {
        return { id: direct, token, matchedKey: token, source, confidence: getPastePlatformConfidence(source, 'direct', token.length) };
    }

    const detected = typeof detectPlatform === 'function' ? detectPlatform(String(value || '')) : null;
    if (detected && detected !== 'other') {
        const detectedKey = normalizePasteValue(detected);
        return { id: detected, token, matchedKey: detectedKey, source, confidence: getPastePlatformConfidence(source, 'detect', detectedKey.length) };
    }

    let best = null;
    catalog.forEach((platformId, key) => {
        if (key.length < 3 || !token.includes(key)) return;
        if (!best || key.length > best.matchedKey.length) {
            best = { id: platformId, token, matchedKey: key, source, confidence: getPastePlatformConfidence(source, 'substring', key.length) };
        }
    });
    return best;
}

function addPlatformDetection(map, match, index) {
    if (!match?.id || match.id === 'other') return;
    const label = getPlatformPickerLabel(match.id, match.id);
    const current = map.get(match.id);
    const next = { ...match, label, index };
    if (!current || next.confidence > current.confidence || (next.confidence === current.confidence && getPasteSourceRank(next.source) > getPasteSourceRank(current.source))) {
        map.set(match.id, next);
    }
}

function extractPasteTokens(rawText) {
    const raw = String(rawText || '');
    const tokens = [];
    const pushToken = (value, source = 'text') => {
        const clean = String(value || '').trim();
        if (normalizePasteValue(clean).length >= 2) tokens.push({ value: clean, source });
    };

    const emailRegex = /([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi;
    raw.replace(emailRegex, (_, user, domain) => {
        pushToken(user, 'account');
        pushToken(domain.split('.')[0], 'domain');
        pushToken(domain, 'domain');
        return '';
    });

    const withoutDomains = raw.replace(emailRegex, '$1 ');
    withoutDomains.split(/[\r\n\t\s|]+/).forEach(chunk => pushToken(chunk, 'text'));
    withoutDomains.split(/[|@_\-.\s:;,<>()[\]{}"']+/).forEach(part => pushToken(part, 'text'));
    return tokens;
}

function getPastePlanTagCandidates(platformIds = []) {
    const values = [];
    platformIds.forEach(platformId => {
        if (window.PLATFORM_PLAN_TAGS?.[platformId]) values.push(...window.PLATFORM_PLAN_TAGS[platformId]);
    });
    Object.values(window.PLATFORM_PLAN_TAGS || {}).forEach(tags => values.push(...tags));
    values.push(...(window.COMMON_PLAN_TAGS || []));
    const unique = typeof normalizeTags === 'function' ? normalizeTags(values) : [...new Set(values.filter(Boolean))];
    return unique
        .map(label => ({ label, key: normalizePasteValue(label) }))
        .filter(item => item.key.length >= 2)
        .sort((a, b) => b.key.length - a.key.length);
}

function addTagDetection(map, tag, confidence = 70) {
    const key = typeof normalizeTagKey === 'function' ? normalizeTagKey(tag) : String(tag || '').toLowerCase();
    const compact = normalizePasteValue(tag);
    if (!key || !compact) return;
    for (const [existingKey, existing] of map.entries()) {
        const existingCompact = normalizePasteValue(existing.label);
        if (existingCompact !== compact && existingCompact.includes(compact)) return;
        if (existingCompact !== compact && compact.includes(existingCompact)) map.delete(existingKey);
    }
    const current = map.get(key);
    if (!current || confidence > current.confidence) map.set(key, { label: tag, confidence });
}

function detectPlanTagsFromTokens(tokens, platformIds) {
    const tagMap = new Map();
    const candidates = getPastePlanTagCandidates(platformIds);
    tokens.forEach(({ value, source }) => {
        const token = normalizePasteValue(value);
        if (!token) return;
        candidates.forEach(candidate => {
            const direct = token === candidate.key;
            const embedded = candidate.key.length >= 4 && token.includes(candidate.key);
            if (!direct && !embedded) return;
            addTagDetection(tagMap, candidate.label, (direct ? 88 : 74) + getPasteSourceRank(source));
        });
    });
    return [...tagMap.values()]
        .sort((a, b) => b.confidence - a.confidence)
        .map(item => item.label);
}

function detectServicesFromPaste(rawText) {
    const raw = String(rawText || '').trim();
    if (!raw) return { platforms: [], tags: [] };

    const tokens = extractPasteTokens(raw);
    const platformMap = new Map();
    tokens.forEach((token, index) => {
        addPlatformDetection(platformMap, findPlatformMatchInToken(token.value, token.source), index);
    });

    const platforms = [...platformMap.values()]
        .sort((a, b) => b.confidence - a.confidence || getPasteSourceRank(b.source) - getPasteSourceRank(a.source) || a.index - b.index)
        .slice(0, 4);
    const tags = detectPlanTagsFromTokens(tokens, platforms.map(item => item.id)).slice(0, 6);
    return { platforms, tags };
}

function syncDetectedServicesFromPaste(rawText) {
    const detection = detectServicesFromPaste(rawText);
    window.appState.addFormDetectedServices = detection;

    const bestPlatform = detection.platforms[0];
    const nameInput = document.getElementById('add-name');
    const currentPlatform = window.appState.addFormPlatform || null;
    const autoPlatform = window.appState.addFormAutoPlatform || null;
    const canApplyAutoPlatform = !currentPlatform || currentPlatform === autoPlatform;
    if (bestPlatform && canApplyAutoPlatform) {
        window.appState.addFormPlatform = bestPlatform.id;
        window.appState.addFormAutoPlatform = bestPlatform.id;
        if (nameInput && (!nameInput.value.trim() || nameInput.dataset.autoFilled === 'true')) {
            nameInput.value = getPlatformPickerLabel(bestPlatform.id, bestPlatform.label);
            nameInput.dataset.autoFilled = 'true';
        }
    } else if (!String(rawText || '').trim() && window.appState.addFormAutoPlatform) {
        if (window.appState.addFormPlatform === window.appState.addFormAutoPlatform) window.appState.addFormPlatform = null;
        window.appState.addFormAutoPlatform = null;
    }

    const previousAutoKeys = new Set((window.appState.addFormAutoTags || []).map(tag => normalizeQuickText(tag)));
    const manualTags = getAddTags().filter(tag => !previousAutoKeys.has(normalizeQuickText(tag)));
    setAddTags([...manualTags, ...detection.tags]);
    window.appState.addFormAutoTags = detection.tags;

    updatePlatformPickerState();
    updateAddTagSuggestions();
    const suggestionBox = document.getElementById('service-detect-suggestions');
    if (suggestionBox) suggestionBox.innerHTML = typeof renderServiceDetectionChips === 'function'
        ? renderServiceDetectionChips(detection)
        : '';
}

function previewParse() {
    const raw = document.getElementById('paste-input')?.value || '';
    const r = parseAccountInput(raw);
    const el = document.getElementById('parse-preview');
    syncDetectedServicesFromPaste(raw);
    syncSellerFromPaste(raw);
    if (!el) return;
    if (!r || (!r.username && !r.password)) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="parse-preview"><div class="parse-preview-item"><span class="parse-preview-label">Tài khoản</span><span class="parse-preview-value">${r.username || '—'}</span></div><div class="parse-preview-item"><span class="parse-preview-label">Mật khẩu</span><span class="parse-preview-value">${r.password || '—'}</span></div>${r.twoFaCode ? `<div class="parse-preview-item"><span class="parse-preview-label">2FA</span><span class="parse-preview-value">${r.twoFaCode}</span></div>` : ''}</div>`;
}

// Tự nhận diện người bán / nguồn từ link dán vào ô "Dán thông tin tài khoản"
function syncSellerFromPaste(rawText) {
    if (typeof detectSellerFromText !== 'function') return;
    const seller = detectSellerFromText(rawText);
    const nameInput = document.getElementById('add-seller-name');
    const linkInput = document.getElementById('add-seller-link');
    const hint = document.getElementById('seller-link-hint');
    if (!nameInput) return;

    if (!seller) {
        // Nếu trước đó tự điền mà giờ link bị xoá thì dọn lại
        if (window.appState.addFormSellerAutoFilled && nameInput.dataset.sellerAuto === 'true') {
            nameInput.value = '';
            nameInput.dataset.sellerAuto = 'false';
            if (linkInput) linkInput.value = '';
            if (hint) { hint.hidden = true; hint.innerHTML = ''; }
            window.appState.addFormSellerAutoFilled = false;
            if (typeof selectSellerPlatform === 'function') selectSellerPlatform('other');
        }
        return;
    }

    // Chỉ ghi đè khi ô trống hoặc do tự điền trước đó (không phá dữ liệu người dùng gõ tay)
    const canFillName = !nameInput.value.trim() || nameInput.dataset.sellerAuto === 'true';
    if (canFillName) {
        nameInput.value = seller.name;
        nameInput.dataset.sellerAuto = 'true';
    }
    if (typeof selectSellerPlatform === 'function') selectSellerPlatform(seller.platform, { syncLink: false });
    if (linkInput) linkInput.value = seller.url;
    if (typeof updateSellerLinkHint === 'function') {
        updateSellerLinkHint(seller.url);
    } else if (hint && typeof renderSellerLinkHint === 'function') {
        hint.innerHTML = renderSellerLinkHint(seller.url);
        hint.hidden = false;
    }
    window.appState.addFormSellerAutoFilled = true;
}

function getPlatformPickerLabel(platform, fallback = '') {
    const options = typeof getAddFormPlatformOptions === 'function' ? getAddFormPlatformOptions() : [];
    const found = options.find(item => item.id === platform);
    const icon = typeof getPlatformIconConfig === 'function' ? getPlatformIconConfig(platform) : null;
    return found?.name || icon?.label || fallback || platform || '';
}

function getCurrentAddPlatform() {
    const name = document.getElementById('add-name')?.value || '';
    return window.appState.addFormPlatform || detectPlatform(name);
}

function getSmartNamePlanTags(platform, input) {
    const direct = platform && window.PLATFORM_PLAN_TAGS?.[platform] ? window.PLATFORM_PLAN_TAGS[platform] : [];
    if (direct.length) return direct;
    if (typeof getSuggestedTagsForPlatform === 'function') return getSuggestedTagsForPlatform(platform || { name: input }, input).slice(0, 24);
    return [];
}

function findSmartTagSpan(words, tagWords, usedIndexes) {
    for (let start = 0; start <= words.length - tagWords.length; start += 1) {
        const indexes = [];
        let matched = true;
        for (let offset = 0; offset < tagWords.length; offset += 1) {
            const index = start + offset;
            const word = words[index];
            const tagWord = tagWords[offset];
            if (usedIndexes.has(index) || !word || !tagWord) {
                matched = false;
                break;
            }
            const fuzzy = word.length >= 3 && tagWord.startsWith(word);
            if (word !== tagWord && !fuzzy) {
                matched = false;
                break;
            }
            indexes.push(index);
        }
        if (matched) return indexes;
    }
    return null;
}

function canonicalizePlatformName(name, platform) {
    const raw = String(name || '').trim();
    if (!raw || !platform) return raw;
    const canonical = typeof getPlatformPickerLabel === 'function' ? getPlatformPickerLabel(platform, '') : '';
    if (!canonical) return raw;
    // Chỉ chuẩn hoá khi tên còn lại là 1 từ và chính là nền tảng đã nhận diện (tránh phá tên tùy chỉnh nhiều từ)
    if (raw.split(/\s+/).filter(Boolean).length !== 1) return raw;
    const norm = typeof normalizePasteValue === 'function' ? normalizePasteValue(raw) : raw.toLowerCase();
    const normCanonical = typeof normalizePasteValue === 'function' ? normalizePasteValue(canonical) : canonical.toLowerCase();
    if (norm === normCanonical) return canonical;
    if (typeof detectPlatform === 'function' && detectPlatform(raw) === platform) return canonical;
    return raw;
}

function parseSmartName(input) {
    const raw = String(input || '').trim();
    if (!raw) return { name: '', tags: [], platform: null };
    const platform = detectPlatform(raw);
    const candidates = getSmartNamePlanTags(platform, raw)
        .map(tag => ({ label: tag, words: normalizeQuickText(tag).split(/\s+/).filter(Boolean) }))
        .filter(item => item.words.length)
        .sort((a, b) => b.words.length - a.words.length || normalizeQuickText(b.label).length - normalizeQuickText(a.label).length);
    const originalWords = raw.split(/\s+/);
    const normalizedWords = originalWords.map(normalizeQuickText);
    const usedIndexes = new Set();
    const tagMatches = [];

    candidates.forEach(candidate => {
        const indexes = findSmartTagSpan(normalizedWords, candidate.words, usedIndexes);
        if (!indexes) return;
        indexes.forEach(index => usedIndexes.add(index));
        tagMatches.push({ label: candidate.label, index: indexes[0] });
    });

    const name = originalWords.filter((_, index) => !usedIndexes.has(index)).join(' ').trim();
    const tags = tagMatches
        .sort((a, b) => a.index - b.index)
        .map(item => item.label);
    const finalName = canonicalizePlatformName(name || getPlatformPickerLabel(platform, raw), platform);
    return {
        name: finalName,
        tags: typeof normalizeTags === 'function' ? normalizeTags(tags) : tags,
        platform,
    };
}

function autoDetectPlatform() {
    const input = document.getElementById('add-name');
    const n = input?.value || '';
    const smart = parseSmartName(n);
    if (smart.platform) window.appState.addFormPlatform = smart.platform;
    if (smart.tags.length) {
        const previousAutoKeys = new Set((window.appState.addFormAutoTags || []).map(tag => normalizeQuickText(tag)));
        const manualTags = getAddTags().filter(tag => !previousAutoKeys.has(normalizeQuickText(tag)));
        setAddTags([...manualTags, ...smart.tags]);
        window.appState.addFormAutoTags = smart.tags;
        if (input && smart.name && smart.name !== n.trim()) {
            input.value = smart.name;
            input.setSelectionRange?.(input.value.length, input.value.length);
        }
    }
    renderSelectedAddTags();
    updatePlatformPickerState();
    updateAddTagSuggestions();
}

function getAddTags() {
    const tags = window.appState.addFormTags || [];
    return typeof normalizeTags === 'function' ? normalizeTags(tags) : tags.filter(Boolean);
}

function setAddTags(tags) {
    window.appState.addFormTags = typeof normalizeTags === 'function' ? normalizeTags(tags) : tags.filter(Boolean);
}

function isAddTagSelected(tag) {
    const key = typeof normalizeTagKey === 'function' ? normalizeTagKey(tag) : String(tag || '').toLowerCase();
    return getAddTags().some(value => {
        const valueKey = typeof normalizeTagKey === 'function' ? normalizeTagKey(value) : String(value || '').toLowerCase();
        return valueKey === key;
    });
}

function renderSelectedAddTags() {
    const inline = document.getElementById('platform-detect');
    const tags = getAddTags();
    const platform = getCurrentAddPlatform();
    const label = platform ? getPlatformPickerLabel(platform) : '';
    if (inline) {
        const platformHtml = platform
            ? `<span class="service-inline-platform">${renderPlatformPickerIcon(platform, label)}<strong>${escapeHtml(label)}</strong></span>`
            : '';
        const tagHtml = tags.length
            ? (typeof renderAccountTags === 'function'
                ? renderAccountTags(tags, { removable: true, className: 'selected-tags-list inline-selected-tags' })
                : tags.map(tag => `<span class="account-tag-chip">${escapeHtml(tag)}<button type="button" class="tag-remove" onclick="removeAddTag('${escapeJsAttr(tag)}')">x</button></span>`).join(''))
            : '';
        inline.innerHTML = platformHtml || tagHtml
            ? `${platformHtml}${platformHtml && tagHtml ? '<span class="service-inline-dot">·</span>' : ''}${tagHtml}`
            : '';
    }

    const box = document.getElementById('selected-tags');
    if (box) box.hidden = true;
}

function refreshServiceDetectionChips() {
    const suggestionBox = document.getElementById('service-detect-suggestions');
    if (!suggestionBox || typeof renderServiceDetectionChips !== 'function') return;
    suggestionBox.innerHTML = renderServiceDetectionChips(window.appState.addFormDetectedServices || { platforms: [], tags: [] });
}

function updateAddTagSuggestions() {
    const box = document.getElementById('tag-suggestions');
    if (!box) {
        renderSelectedAddTags();
        refreshServiceDetectionChips();
        return;
    }
    const name = document.getElementById('add-name')?.value || '';
    const selectedPlatform = window.appState.addFormPlatform || '';
    const platform = selectedPlatform || getCurrentAddPlatform();
    const title = document.getElementById('platform-plan-title');
    const isEditMode = window.appState.planEditMode || false;
    if (title) title.textContent = platform
        ? `Gói cước ${getPlatformPickerLabel(platform)}${isEditMode ? ' — Chỉnh sửa' : ''}`
        : (isEditMode ? 'Gói cước — Chỉnh sửa' : 'Gói cước gợi ý');
    const directPlanTags = selectedPlatform && window.PLATFORM_PLAN_TAGS?.[selectedPlatform]
        ? window.PLATFORM_PLAN_TAGS[selectedPlatform]
        : [];
    const suggestions = directPlanTags.length
        ? directPlanTags
        : (typeof getSuggestedTagsForPlatform === 'function'
            ? getSuggestedTagsForPlatform(platform || { name }, name).slice(0, 18)
            : ['Premium', 'Pro', 'Plus', 'Family', 'Team', 'Lifetime']);

    // Chế độ chỉnh sửa: hiện nút xoá (×) và bấm đúp để đổi tên
    if (isEditMode && selectedPlatform) {
        box.innerHTML = suggestions.map(tag => {
            const tone = typeof getTagToneClass === 'function' ? getTagToneClass(tag) : 'tag-default';
            return `<span class="account-tag-chip platform-plan-chip plan-edit-chip ${tone}">
                <span class="plan-edit-chip-label" ondblclick="renamePlanTag('${escapeJsAttr(selectedPlatform)}','${escapeJsAttr(tag)}')" title="Bấm đúp để đổi tên">${escapeHtml(tag)}</span>
                <button type="button" class="plan-edit-delete-btn" onclick="deletePlanTag('${escapeJsAttr(selectedPlatform)}','${escapeJsAttr(tag)}')" aria-label="Xoá ${escapeHtml(tag)}" title="Xoá gói cước này">×</button>
            </span>`;
        }).join('');
    } else {
        box.innerHTML = suggestions.map(tag => {
            const active = isAddTagSelected(tag);
            const tone = typeof getTagToneClass === 'function' ? getTagToneClass(tag) : 'tag-default';
            return `<button type="button" class="account-tag-chip platform-plan-chip ${tone} ${active ? 'active' : ''}" onclick="toggleAddTag('${escapeJsAttr(tag)}')">${escapeHtml(tag)}</button>`;
        }).join('');
    }

    // Cập nhật trạng thái nút bút
    const editBtn = document.getElementById('plan-edit-toggle-btn');
    if (editBtn) editBtn.classList.toggle('active', isEditMode);

    renderSelectedAddTags();
    refreshServiceDetectionChips();
}

function initAddTagPicker() {
    setAddTags([]);
    window.appState.addFormAutoTags = [];
    updateAddTagSuggestions();
    renderSelectedAddTags();
}

function toggleAddTag(tag) {
    const tags = getAddTags();
    if (isAddTagSelected(tag)) {
        setAddTags(tags.filter(value => {
            const left = typeof normalizeTagKey === 'function' ? normalizeTagKey(value) : String(value || '').toLowerCase();
            const right = typeof normalizeTagKey === 'function' ? normalizeTagKey(tag) : String(tag || '').toLowerCase();
            return left !== right;
        }));
    } else {
        setAddTags([...tags, tag]);
    }
    updateAddTagSuggestions();
}

function removeAddTag(tag) {
    const target = typeof normalizeTagKey === 'function' ? normalizeTagKey(tag) : String(tag || '').toLowerCase();
    setAddTags(getAddTags().filter(value => {
        const key = typeof normalizeTagKey === 'function' ? normalizeTagKey(value) : String(value || '').toLowerCase();
        return key !== target;
    }));
    window.appState.addFormAutoTags = (window.appState.addFormAutoTags || []).filter(value => {
        const key = typeof normalizeTagKey === 'function' ? normalizeTagKey(value) : String(value || '').toLowerCase();
        return key !== target;
    });
    updateAddTagSuggestions();
}

function addCustomTagFromInput() {
    const input = document.getElementById('add-tag-input');
    const tag = input?.value?.trim();
    if (!tag) return;
    if (!isAddTagSelected(tag)) setAddTags([...getAddTags(), tag]);
    if (input) input.value = '';
    updateAddTagSuggestions();
}

// === CHỈNH SỬA GÓI CƯỚC (CATALOG) ===

function togglePlanEditMode() {
    window.appState.planEditMode = !window.appState.planEditMode;
    updateAddTagSuggestions();
}

function deletePlanTag(platformId, tag) {
    if (!platformId || !tag) return;
    const tags = window.PLATFORM_PLAN_TAGS?.[platformId];
    if (!Array.isArray(tags)) return;
    const key = typeof normalizeTagKey === 'function' ? normalizeTagKey(tag) : tag.toLowerCase();
    const filtered = tags.filter(t => {
        const tKey = typeof normalizeTagKey === 'function' ? normalizeTagKey(t) : t.toLowerCase();
        return tKey !== key;
    });
    window.PLATFORM_PLAN_TAGS[platformId] = filtered;
    // Xoá tag này khỏi addFormTags nếu đang chọn
    if (isAddTagSelected(tag)) removeAddTag(tag);
    updateAddTagSuggestions();
    showToast(`Đã xoá "${tag}"`, 'success');
}

function renamePlanTag(platformId, oldTag) {
    if (!platformId || !oldTag) return;
    const tags = window.PLATFORM_PLAN_TAGS?.[platformId];
    if (!Array.isArray(tags)) return;
    const newTag = prompt(`Đổi tên gói cước "${oldTag}" thành:`, oldTag);
    if (!newTag || newTag.trim() === oldTag) return;
    const trimmed = newTag.trim();
    const oldKey = typeof normalizeTagKey === 'function' ? normalizeTagKey(oldTag) : oldTag.toLowerCase();
    window.PLATFORM_PLAN_TAGS[platformId] = tags.map(t => {
        const tKey = typeof normalizeTagKey === 'function' ? normalizeTagKey(t) : t.toLowerCase();
        return tKey === oldKey ? trimmed : t;
    });
    // Cập nhật addFormTags nếu tag cũ đang được chọn
    const currentTags = getAddTags();
    const wasSelected = currentTags.some(t => {
        const tKey = typeof normalizeTagKey === 'function' ? normalizeTagKey(t) : t.toLowerCase();
        return tKey === oldKey;
    });
    if (wasSelected) {
        setAddTags(currentTags.map(t => {
            const tKey = typeof normalizeTagKey === 'function' ? normalizeTagKey(t) : t.toLowerCase();
            return tKey === oldKey ? trimmed : t;
        }));
    }
    updateAddTagSuggestions();
    showToast(`Đã đổi "${oldTag}" → "${trimmed}"`, 'success');
}

function updatePlatformPlanHeader(platform) {
    const current = document.getElementById('platform-plan-current');
    const title = document.getElementById('platform-plan-title');
    const label = platform ? getPlatformPickerLabel(platform) : '';
    if (current) {
        current.innerHTML = platform
            ? `${renderPlatformPickerIcon(platform, label)}<strong>${escapeHtml(label)}</strong>`
            : '';
    }
    if (title) title.textContent = platform ? `Gói cước ${label}` : 'Gói cước';
}

function updatePlatformSectionState(animate = false) {
    const platform = window.appState.addFormPlatform || '';
    const grid = document.getElementById('platform-section-grid');
    const panel = document.getElementById('platform-plan-panel-inline');
    updatePlatformPlanHeader(platform);
    if (!grid || !panel) return;

    if (platform) {
        panel.hidden = false;
        if (animate) {
            grid.classList.add('slide-out-left');
            requestAnimationFrame(() => panel.classList.add('slide-in-right'));
            window.setTimeout(() => {
                if (window.appState.addFormPlatform) grid.hidden = true;
            }, 260);
        } else {
            grid.hidden = true;
            grid.classList.add('slide-out-left');
            panel.classList.add('slide-in-right');
        }
        return;
    }

    grid.hidden = false;
    grid.classList.remove('slide-out-left');
    if (animate) {
        panel.classList.remove('slide-in-right');
        window.setTimeout(() => {
            if (!window.appState.addFormPlatform) panel.hidden = true;
        }, 260);
    } else {
        panel.hidden = true;
        panel.classList.remove('slide-in-right');
    }
}

function updatePlatformPickerState(animate = false) {
    const platform = getCurrentAddPlatform();
    document.querySelectorAll('.platform-picker-item').forEach(button => {
        button.classList.toggle('active', button.dataset.platform === platform);
    });
    updatePlatformSectionState(animate);
}

function togglePlatformPicker(event) {
    event?.stopPropagation?.();
    const popover = document.getElementById('platform-picker-popover');
    const toggle = document.querySelector('.platform-picker-toggle');
    if (!popover) return;
    const nextOpen = popover.hidden;
    popover.hidden = !nextOpen;
    popover.classList.toggle('open', nextOpen);
    toggle?.classList.toggle('active', nextOpen);
    if (nextOpen) {
        updateAddTagSuggestions();
        updatePlatformPickerState();
        setTimeout(() => document.addEventListener('click', closePlatformPicker, { once: true }), 0);
    }
}

function closePlatformPicker() {
    const popover = document.getElementById('platform-picker-popover');
    const toggle = document.querySelector('.platform-picker-toggle');
    if (!popover) return;
    popover.hidden = true;
    popover.classList.remove('open');
    toggle?.classList.remove('active');
}

function showPlatformPlanPanel(platformId) {
    if (!platformId || platformId === 'other') {
        backToPlatformGrid();
        return;
    }
    window.appState.addFormPlatform = platformId;
    updatePlatformPickerState(true);
    updateAddTagSuggestions();
    renderSelectedAddTags();
}

function backToPlatformGrid() {
    window.appState.addFormPlatform = null;
    window.appState.addFormAutoPlatform = null;
    window.appState.planEditMode = false;
    updatePlatformPickerState(true);
    updateAddTagSuggestions();
    renderSelectedAddTags();
}

function selectDetectedPlatform(platformId) {
    if (!platformId) return;
    const detection = window.appState.addFormDetectedServices || { platforms: [] };
    const found = (detection.platforms || []).find(item => item.id === platformId);
    const label = getPlatformPickerLabel(platformId, found?.label || platformId);
    const input = document.getElementById('add-name');
    if (input) {
        input.value = label;
        input.dataset.autoFilled = 'true';
    }
    window.appState.addFormAutoPlatform = null;
    showPlatformPlanPanel(platformId);
    refreshServiceDetectionChips();
    guideAddFormFromPlatform?.(platformId);
}

function selectPlatformFromPicker(platform, name) {
    const input = document.getElementById('add-name');
    window.appState.addFormAutoPlatform = null;
    if (platform === 'other') {
        window.appState.addFormPlatform = null;
        updatePlatformPickerState();
        updateAddTagSuggestions();
        renderSelectedAddTags();
        guideAddFormFromPlatform?.('other');
        return;
    }
    if (input) {
        input.value = name;
        input.dataset.autoFilled = 'true';
    }
    showPlatformPlanPanel(platform);
    guideAddFormFromPlatform?.(platform);
}

function toggleAddSection(sectionId) {
    const body = document.getElementById(`add-section-${sectionId}`);
    const toggle = document.getElementById(`add-section-${sectionId}-toggle`);
    if (!body || !toggle) return;
    const open = !body.classList.contains('open');
    body.classList.toggle('open', open);
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function toggleInlineCategoryCreate() {
    const box = document.getElementById('inline-category-create-box');
    if (!box) return;
    box.hidden = !box.hidden;
    if (!box.hidden) document.getElementById('inline-category-name')?.focus();
}

async function createInlineCategoryFromAddForm() {
    const input = document.getElementById('inline-category-name');
    const name = input?.value.trim();
    if (!name) return;
    const categories = getSortedCategories();
    const category = {
        id: createCategoryId(name),
        name,
        icon: 'folder',
        color: '#6C5CE7',
        order: categories.length,
    };
    const ok = await persistCategories([...categories, category]);
    if (!ok) return;

    const chip = `<label class="category-picker-chip active">
        <input type="checkbox" name="add-category-id" value="${escapeJsAttr(category.id)}" checked onchange="this.closest('.category-picker-chip')?.classList.toggle('active', this.checked)">
        ${renderCategoryIcon(category)}
        <span class="category-picker-name">${escapeHtml(category.name)}</span>
    </label>`;
    const grid = document.querySelector('.category-picker-grid');
    const empty = document.querySelector('.category-picker-empty');
    if (grid) grid.insertAdjacentHTML('beforeend', chip);
    else if (empty) empty.outerHTML = `<div class="category-picker-grid">${chip}</div>`;
    if (input) input.value = '';
    const box = document.getElementById('inline-category-create-box');
    if (box) box.hidden = true;
    showToast('Đã tạo danh mục', 'success');
}

function wrapNoteSelection(type) {
    const textarea = document.getElementById('add-note');
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = textarea.value.slice(start, end);
    const tag = type === 'copy' ? 'copy' : 'code';
    const openTag = `[${tag}]`;
    const closeTag = `[/${tag}]`;
    const wrapped = `${openTag}${selected}${closeTag}`;
    textarea.setRangeText(wrapped, start, end, selected ? 'end' : 'select');
    textarea.focus();
    if (!selected) {
        const caret = start + openTag.length;
        textarea.setSelectionRange(caret, caret);
    }
}

function autoTagNoteLinks(noteText) {
    let blockTag = null;
    return String(noteText || '').split(/\r?\n/).map(line => {
        const trimmed = line.trim();
        if (blockTag) {
            const closePattern = blockTag === 'copy' ? /\[\/copy\]|\[copy\]/i : /\[\/code\]|\[code\]/i;
            if (closePattern.test(line)) blockTag = null;
            return line;
        }
        const blockStart = trimmed.match(/^\[(copy|code)\]/i);
        if (blockStart) {
            const tag = blockStart[1].toLowerCase();
            const rest = trimmed.slice(blockStart[0].length);
            const sameLineClose = tag === 'copy' ? /\[\/copy\]|\[copy\]/i.test(rest) : /\[\/code\]|\[code\]/i.test(rest);
            if (!sameLineClose) blockTag = tag;
            return line;
        }
        if (/^\s*\[(?:open|open\+copy|copy\+open|link|combo)\]/i.test(line)) return line;
        return line.replace(/https?:\/\/[^\s<>"')]+/gi, (url, offset, source) => {
            const before = source.slice(Math.max(0, offset - 16), offset);
            if (/\[(?:open|link)\]\s*$/i.test(before)) return url;
            return `[open] ${url}`;
        });
    }).join('\n');
}

function openTagEditor(id) {
    const acc = window.appState.accounts.find(item => item.id === id);
    if (!acc || typeof renderTagEditorForm !== 'function') return;
    setAddTags(acc.tags || []);
    openModal('Sửa tags', renderTagEditorForm(acc));
    updateAddTagSuggestions();
}

async function saveAccountTags(id) {
    const acc = window.appState.accounts.find(item => item.id === id);
    if (!acc) return;
    const tags = getAddTags();
    const patch = { tags, planTag: tags[0] || null };

    if (window.appState.isDemo) {
        Object.assign(acc, patch);
        closeModal();
        showToast('Đã cập nhật tags', 'success');
        rerenderCurrentView(id);
        return;
    }

    const ok = await updateAccountInDB(id, patch);
    if (ok) {
        closeModal();
        showToast('Đã cập nhật tags', 'success');
        setTimeout(() => rerenderCurrentView(id), 300);
    }
}

function padDatePart(value) {
    return String(value).padStart(2, '0');
}

function dateToInputValue(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function inputValueToDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
}

function addDateSmart(baseDate, { days = 0, months = 0, years = 0 } = {}) {
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    if (years) date.setFullYear(date.getFullYear() + years);
    if (months) date.setMonth(date.getMonth() + months);
    if (days) date.setDate(date.getDate() + days);
    return date;
}

function normalizeQuickText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function parseQuickDate(value, baseDate = new Date()) {
    const raw = String(value || '').trim();
    const text = normalizeQuickText(raw);
    if (!text) return null;
    if (['hom nay', 'today', 'now'].includes(text)) return addDateSmart(baseDate, { days: 0 });
    if (['hom qua', 'yesterday'].includes(text)) return addDateSmart(baseDate, { days: -1 });
    if (['mai', 'ngay mai', 'tomorrow'].includes(text)) return addDateSmart(baseDate, { days: 1 });
    if (/^[+-]\d+$/.test(text)) return addDateSmart(baseDate, { days: Number(text) });

    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

    const slash = raw.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
    if (slash) {
        const year = slash[3]
            ? (Number(slash[3]) < 100 ? 2000 + Number(slash[3]) : Number(slash[3]))
            : baseDate.getFullYear();
        return new Date(year, Number(slash[2]) - 1, Number(slash[1]));
    }

    const compact = raw.match(/^(\d{2})(\d{2})(\d{2}|\d{4})?$/);
    if (compact) {
        const year = compact[3]
            ? (Number(compact[3]) < 100 ? 2000 + Number(compact[3]) : Number(compact[3]))
            : baseDate.getFullYear();
        return new Date(year, Number(compact[2]) - 1, Number(compact[1]));
    }
    return null;
}

function parseQuickDuration(value, purchaseDate) {
    const raw = String(value || '').trim();
    const text = normalizeQuickText(raw);
    if (!text || !purchaseDate) return null;

    const directDate = parseQuickDate(raw, purchaseDate);
    if (directDate && /[\/.-]/.test(raw)) return { date: directDate, label: 'ngày tự chọn' };

    const numberOnly = text.match(/^(\d+)$/);
    if (numberOnly) {
        const days = Number(numberOnly[1]);
        return { date: addDateSmart(purchaseDate, { days }), label: `${days} ngày` };
    }

    const match = text.match(/^(\d+)\s*(d|day|days|ngay|w|week|weeks|tuan|m|month|months|thang|y|year|years|nam)$/);
    if (match) {
        const amount = Number(match[1]);
        const unit = match[2];
        if (['d', 'day', 'days', 'ngay'].includes(unit)) return { date: addDateSmart(purchaseDate, { days: amount }), label: `${amount} ngày` };
        if (['w', 'week', 'weeks', 'tuan'].includes(unit)) return { date: addDateSmart(purchaseDate, { days: amount * 7 }), label: `${amount} tuần` };
        if (['m', 'month', 'months', 'thang'].includes(unit)) return { date: addDateSmart(purchaseDate, { months: amount }), label: `${amount} tháng` };
        if (['y', 'year', 'years', 'nam'].includes(unit)) return { date: addDateSmart(purchaseDate, { years: amount }), label: `${amount} năm` };
    }

    if (['thang sau', '1 thang'].includes(text)) return { date: addDateSmart(purchaseDate, { months: 1 }), label: '1 tháng' };
    if (['nam sau', '1 nam'].includes(text)) return { date: addDateSmart(purchaseDate, { years: 1 }), label: '1 năm' };
    return null;
}

function parseSmartDateRange(input) {
    const raw = String(input || '').trim();
    const today = inputValueToDate(todayStr()) || new Date();
    if (!raw) return { purchaseDate: today, expiryDate: null, label: '' };

    const normalized = normalizeQuickText(raw).replace(/[,]+/g, ' ').replace(/\s+/g, ' ').trim();
    const monthText = normalized.match(/^(\d{1,2})\s*thang\s*(\d{1,2})(?:\s+(\d+)\s*(ngay|thang|nam|day|days|month|months|year|years))?$/);
    if (monthText) {
        const purchaseDate = new Date(today.getFullYear(), Number(monthText[2]) - 1, Number(monthText[1]));
        const durationText = monthText[3] ? `${monthText[3]} ${monthText[4]}` : '30';
        const duration = parseQuickDuration(durationText, purchaseDate);
        return { purchaseDate, expiryDate: duration?.date || null, label: duration?.label || '30 ngày' };
    }

    if (raw.includes('>')) {
        const [left, right] = raw.split('>').map(part => part.trim());
        const rightDate = parseQuickDate(right, today);
        const leftDate = /^\d+$/.test(left) ? today : (parseQuickDate(left, today) || today);
        if (rightDate) {
            const days = Math.round((rightDate - leftDate) / (1000 * 60 * 60 * 24));
            return { purchaseDate: leftDate, expiryDate: rightDate, label: `${days} ngày` };
        }
    }

    const dateAtStart = raw.match(/^(\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|\d{2}\d{2}(?:\d{2,4})?)\s+(.+)$/);
    if (dateAtStart) {
        const purchaseDate = parseQuickDate(dateAtStart[1], today);
        if (purchaseDate) {
            const rest = dateAtStart[2].trim();
            const explicitExpiry = parseQuickDate(rest, purchaseDate);
            if (explicitExpiry && /[\/.-]/.test(rest)) {
                const days = Math.round((explicitExpiry - purchaseDate) / (1000 * 60 * 60 * 24));
                return { purchaseDate, expiryDate: explicitExpiry, label: `${days} ngày` };
            }
            const duration = parseQuickDuration(rest, purchaseDate);
            if (duration?.date) return { purchaseDate, expiryDate: duration.date, label: duration.label };
        }
    }

    const numberThenDate = raw.match(/^(\d+)\s+(\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)$/);
    if (numberThenDate) {
        const expiryDate = parseQuickDate(numberThenDate[2], today);
        if (expiryDate) {
            const days = Math.round((expiryDate - today) / (1000 * 60 * 60 * 24));
            return { purchaseDate: today, expiryDate, label: `${days} ngày` };
        }
    }

    const onlyDate = parseQuickDate(raw, today);
    if (onlyDate && /[\/.-]/.test(raw)) {
        const duration = parseQuickDuration('30', onlyDate);
        return { purchaseDate: onlyDate, expiryDate: duration?.date || null, label: '30 ngày' };
    }

    const duration = parseQuickDuration(raw, today);
    if (duration?.date) return { purchaseDate: today, expiryDate: duration.date, label: duration.label };

    return { purchaseDate: today, expiryDate: null, label: '' };
}

function applySmartDateInput(value) {
    const lifetime = document.getElementById('add-lifetime');
    if (lifetime?.checked) {
        lifetime.checked = false;
        handleAddLifetimeToggle(lifetime);
    }
    const result = parseSmartDateRange(value);
    const purchase = document.getElementById('add-purchase');
    const expiry = document.getElementById('add-expiry');
    const purchaseDetail = document.getElementById('add-purchase-detail');
    const expiryDetail = document.getElementById('add-expiry-detail');
    if (purchase && result.purchaseDate) purchase.value = dateToInputValue(result.purchaseDate);
    if (expiry) expiry.value = result.expiryDate ? dateToInputValue(result.expiryDate) : '';
    if (purchaseDetail && result.purchaseDate) purchaseDetail.value = dateToInputValue(result.purchaseDate);
    if (expiryDetail) expiryDetail.value = result.expiryDate ? dateToInputValue(result.expiryDate) : '';
    updateAddExpiryHint(result.label);
}

function toggleSmartDateDetails(input) {
    const lifetime = document.getElementById('add-lifetime');
    if (lifetime?.checked) {
        input.checked = false;
        return;
    }
    const box = document.getElementById('smart-date-details');
    if (box) box.hidden = !input.checked;
}

function getAddPurchaseDate() {
    return inputValueToDate(document.getElementById('add-purchase')?.value) || inputValueToDate(todayStr());
}

function setAddPurchaseDate(value) {
    const date = value instanceof Date ? value : parseQuickDate(value, new Date());
    if (!date || Number.isNaN(date.getTime())) {
        showToast('Không đọc được ngày mua', 'error');
        return;
    }
    const dateValue = dateToInputValue(date);
    const purchase = document.getElementById('add-purchase');
    const purchaseDetail = document.getElementById('add-purchase-detail');
    if (purchase) purchase.value = dateValue;
    if (purchaseDetail) purchaseDetail.value = dateValue;
    const quick = document.getElementById('add-purchase-quick');
    if (quick) quick.value = '';
    recalculateExpiryFromQuickInput();
    updateAddExpiryHint();
}

function applyPurchaseQuickInput(value) {
    if (!String(value || '').trim()) return;
    setAddPurchaseDate(value);
}

function setExpiryDate(date, label = '') {
    if (!date || Number.isNaN(date.getTime())) return;
    const lifetime = document.getElementById('add-lifetime');
    if (lifetime?.checked) {
        lifetime.checked = false;
        handleAddLifetimeToggle(lifetime);
    }
    const expiry = document.getElementById('add-expiry');
    const expiryDetail = document.getElementById('add-expiry-detail');
    if (lifetime) lifetime.checked = false;
    const dateValue = dateToInputValue(date);
    if (expiry) {
        expiry.disabled = false;
        expiry.value = dateValue;
    }
    if (expiryDetail) expiryDetail.value = dateValue;
    updateAddExpiryHint(label);
}

function setExpiryDuration(value) {
    const purchaseDate = getAddPurchaseDate();
    const result = parseQuickDuration(String(value), purchaseDate);
    if (!result?.date) {
        showToast('Nhập số ngày hoặc ngày hết hạn, ví dụ 30 hoặc 27/05/2026', 'error');
        return;
    }
    const quick = document.getElementById('add-duration-quick');
    if (quick) quick.value = String(value);
    setExpiryDate(result.date, result.label);
}

function applyExpiryQuickInput(value) {
    if (!String(value || '').trim()) return;
    setExpiryDuration(value);
}

function recalculateExpiryFromQuickInput() {
    const quick = document.getElementById('add-duration-quick');
    if (!quick?.value.trim()) return;
    const result = parseQuickDuration(quick.value, getAddPurchaseDate());
    if (result?.date) setExpiryDate(result.date, result.label);
}

function handleAddLifetimeToggle(input) {
    const expiry = document.getElementById('add-expiry');
    const expiryDetail = document.getElementById('add-expiry-detail');
    const smart = document.getElementById('add-smart-date');
    const quick = document.getElementById('add-duration-quick');
    const custom = document.getElementById('add-date-custom');
    const details = document.getElementById('smart-date-details');
    if (expiry) expiry.disabled = Boolean(input.checked);
    if (expiryDetail) expiryDetail.disabled = Boolean(input.checked);
    if (smart) smart.disabled = Boolean(input.checked);
    if (quick) quick.disabled = Boolean(input.checked);
    if (custom) {
        custom.disabled = Boolean(input.checked);
        if (input.checked) custom.checked = false;
    }
    if (details && input.checked) details.hidden = true;
    updateAddExpiryHint();
}

function updateAddExpiryHint(label = '') {
    const hint = document.getElementById('add-expiry-hint');
    if (!hint) return;
    const lifetime = document.getElementById('add-lifetime')?.checked;
    if (lifetime) {
        hint.innerHTML = '<span class="smart-date-check">✓</span><span>Tài khoản vĩnh viễn, không cần ngày hết hạn.</span>';
        hint.classList.remove('warning');
        return;
    }

    const purchaseDate = getAddPurchaseDate();
    const expiryDate = inputValueToDate(document.getElementById('add-expiry')?.value);
    if (!expiryDate) {
        hint.textContent = 'Nhập số ngày hoặc khoảng ngày để hệ thống tự tính.';
        hint.classList.remove('warning');
        return;
    }

    const days = Math.round((expiryDate - purchaseDate) / (1000 * 60 * 60 * 24));
    hint.innerHTML = days < 0
        ? `<span class="smart-date-check">!</span><span>Ngày hết hạn đang trước ngày mua ${Math.abs(days)} ngày.</span>`
        : `<span class="smart-date-check">✓</span><span>Mua: ${formatDateVN(dateToInputValue(purchaseDate))} — Hết hạn: ${formatDateVN(dateToInputValue(expiryDate))} (${label || `${days} ngày`})</span>`;
    hint.classList.toggle('warning', days < 0);
}

function splitQuickTags(value) {
    return String(value || '')
        .split(/[,\n;]/)
        .map(tag => tag.trim())
        .filter(Boolean);
}

function normalizeSaveDate(value, fallback = todayStr()) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return value;
    const parsed = parseQuickDate(value, new Date());
    return parsed ? dateToInputValue(parsed) : fallback;
}

function inferTagsFromName(name, platform) {
    if (typeof getSuggestedTagsForPlatform !== 'function') return [];
    const normalizedName = normalizeQuickText(name);
    return getSuggestedTagsForPlatform(platform || { name }, name)
        .filter(tag => normalizedName.includes(normalizeQuickText(tag)))
        .slice(0, 4);
}

function buildAccountSaveInput(input = {}) {
    const raw = String(input.rawInput || input.raw || '');
    const parsed = input.parsed || parseAccountInput(raw) || {};
    const smartName = parseSmartName(input.name || '');
    const name = String(smartName.name || input.name || '').trim();
    const type = input.type === 'personal' ? 'personal' : 'bought';
    const authMethod = typeof getAuthMethod === 'function' ? getAuthMethod(input.authMethod || 'email') : (input.authMethod || 'email');
    const linkedAccountId = authMethod === 'email' ? null : (input.linkedAccountId || null);
    if (!name) return { ok: false, message: 'Nhập tên dịch vụ' };

    const isL = input.isLifetime === true || input.expiryType === 'lifetime';
    const purchaseDate = normalizeSaveDate(input.purchaseDate || todayStr(), todayStr());
    const hasExpiryQuick = input.expiryQuick !== undefined || input.duration !== undefined || input.expiryDays !== undefined;
    const quickExpiry = input.expiryQuick ?? input.duration ?? input.expiryDays;
    let expiryDate = isL ? null : normalizeSaveDate(input.expiryDate || '', '');
    if (!isL && !expiryDate && hasExpiryQuick) {
        const baseDate = inputValueToDate(purchaseDate) || new Date();
        const result = parseQuickDuration(String(quickExpiry || ''), baseDate);
        expiryDate = result?.date ? dateToInputValue(result.date) : '';
    }
    if (!isL && !expiryDate) return { ok: false, message: 'Chọn ngày hết hạn hoặc bật Vĩnh viễn' };

    const platform = input.platform || smartName.platform || detectPlatform(name);
    const explicitTags = [
        ...(Array.isArray(input.tags) ? input.tags : []),
        ...splitQuickTags(input.tagsText),
        ...smartName.tags,
    ];
    const tags = typeof normalizeTags === 'function'
        ? normalizeTags(explicitTags.length ? explicitTags : inferTagsFromName(name, platform))
        : (explicitTags.length ? explicitTags : inferTagsFromName(name, platform));
    const categoryIds = Array.isArray(input.categoryIds) ? input.categoryIds.filter(Boolean) : [];
    const notificationSettings = typeof getNotificationSettings === 'function' ? getNotificationSettings() : { daysBefore: [5, 3, 1] };
    const note = autoTagNoteLinks(String(input.note || '').trim());
    const sensitiveData = {
        username: authMethod === 'email' ? (parsed.username || input.username || '') : (input.username || ''),
        password: authMethod === 'email' ? (parsed.password || input.password || '') : '',
        twoFaCode: authMethod === 'email' ? (parsed.twoFaCode || input.twoFaCode || '') : '',
        note,
        rawInput: authMethod === 'email' ? raw : '',
    };
    const protectedByMasterPassword = input.protectedByMasterPassword !== undefined
        ? Boolean(input.protectedByMasterPassword)
        : type === 'personal' || Boolean(window.appState.settings?.protectBoughtAccounts);
    const sellerName = String(input.sellerName || '').trim();
    const sellerPlatform = input.sellerPlatform || 'other';
    const sellerLink = typeof resolveSellerLinkInput === 'function'
        ? resolveSellerLinkInput(sellerName, sellerPlatform, input.sellerLink)
        : (sellerName ? String(input.sellerLink || '').trim() : '');

    return {
        ok: true,
        name,
        sensitiveData,
        baseData: {
            name,
            type,
            platform,
            sellerName,
            sellerPlatform,
            sellerLink,
            purchasePrice: (typeof parsePriceValue === 'function' ? parsePriceValue(input.purchasePrice) : (input.purchasePrice || null)) ?? null,
            displayUsername: maskUsername(sensitiveData.username),
            purchaseDate,
            expiryDate: expiryDate || null,
            expiryType: isL ? 'lifetime' : 'fixed',
            status: getStatusFromExpiry(expiryDate, isL ? 'lifetime' : 'fixed'),
            tags,
            planTag: tags[0] || null,
            categoryIds,
            protectedByMasterPassword,
            authMethod,
            linkedAccountId,
            isFavorite: Boolean(input.isFavorite),
            isPinned: Boolean(input.isPinned),
            favoriteAt: input.isFavorite ? (input.favoriteAt || new Date().toISOString()) : null,
            pinnedAt: input.isPinned ? (input.pinnedAt || new Date().toISOString()) : null,
            notifyDaysBefore: input.notifyDaysBefore || notificationSettings.daysBefore,
            lastNotifiedDate: input.lastNotifiedDate || null,
            renewalHistory: Array.isArray(input.renewalHistory) ? input.renewalHistory : [],
        },
    };
}

async function persistNewAccount(input = {}, options = {}) {
    const built = buildAccountSaveInput(input);
    if (!built.ok) {
        if (options.toast !== false) showToast(built.message, 'error');
        return built;
    }

    const { name, baseData, sensitiveData } = built;
    const successMessage = window.appState.isOnline === false
        ? `Đã lưu "${name}" cục bộ, sẽ đồng bộ khi có mạng`
        : `Đã thêm "${name}"`;

    if (window.appState.isDemo) {
        const data = { ...baseData, ...sensitiveData, id: `demo_${Date.now()}` };
        window.appState.accounts.unshift(data);
        updateHeader();
        if (options.closeModal) closeModal();
        if (options.navigateAfter) navigateTo(window.appState.currentPage);
        else rerenderCurrentView?.(data.id);
        if (options.toast !== false) showToast(successMessage, 'success');
        return { ok: true, id: data.id, name, message: successMessage };
    }

    try {
        let payload = { ...baseData, ...sensitiveData };
        if (baseData.protectedByMasterPassword) {
            const unlocked = await requireMasterPassword(options.masterReason || 'Để mã hóa tài khoản trước khi lưu');
            if (!unlocked) return { ok: false, message: 'Đã hủy Master Password' };
            const encryptedPayload = await encryptAccountData(sensitiveData, window.appState.masterPassword);
            payload = { ...baseData, ...encryptedPayload };
        }
        const id = await addAccountToDB(payload);
        if (!id) return { ok: false, message: 'Không thể lưu tài khoản' };
        if (options.closeModal) closeModal();
        if (options.toast !== false) showToast(successMessage, 'success');
        return { ok: true, id, name, message: successMessage };
    } catch (error) {
        console.error('Quick/add save error:', error);
        const message = error.message || 'Không thể mã hóa/lưu tài khoản';
        if (options.toast !== false) showToast(message, 'error');
        return { ok: false, message };
    }
}

async function saveNewAccount(type) {
    if (window.appState.editingAccount?.id) {
        await saveEditedAccount(window.appState.editingAccount.id);
        return;
    }
    const raw = document.getElementById('paste-input').value;
    const parsed = parseAccountInput(raw) || {};
    const authMethod = typeof getAuthMethod === 'function'
        ? getAuthMethod(window.appState.addFormAuthMethod || 'email')
        : (window.appState.addFormAuthMethod || 'email');
    const linkedAccountId = authMethod === 'email' ? null : (window.appState.addFormLinkedId || null);
    const linkedAccount = linkedAccountId
        ? (window.appState.accounts || []).find(acc => acc.id === linkedAccountId)
        : null;
    const linkedOptions = authMethod === 'email' ? [] : getLinkedAccountOptions(authMethod);
    if (authMethod !== 'email' && linkedOptions.length > 0 && !linkedAccountId) {
        showToast(`Chọn TK ${getAuthMethodLabel(authMethod)} gốc`, 'error');
        return;
    }
    const rawName = document.getElementById('add-name').value.trim();
    const smartName = parseSmartName(rawName);
    const name = smartName.name || rawName;
    if (!name) { showToast('Nhập tên dịch vụ', 'error'); return; }
    const isL = document.getElementById('add-lifetime').checked;
    const pDate = document.getElementById('add-purchase').value || todayStr();
    const eDate = isL ? null : document.getElementById('add-expiry').value;
    if (!isL && !eDate) { showToast('Chọn ngày hết hạn hoặc bật Vĩnh viễn', 'error'); return; }
    const note = autoTagNoteLinks(document.getElementById('add-note').value.trim());
    const sellerName = document.getElementById('add-seller-name')?.value.trim() || '';
    const sellerPlatform = document.getElementById('add-seller-platform')?.value || 'other';
    const rawSellerLink = document.getElementById('add-seller-link')?.value.trim() || '';
    const sellerLink = typeof resolveSellerLinkInput === 'function'
        ? resolveSellerLinkInput(sellerName, sellerPlatform, rawSellerLink)
        : (sellerName ? rawSellerLink : '');
    const purchasePrice = typeof parsePriceValue === 'function' ? parsePriceValue(document.getElementById('add-price')?.value) : null;
    const tags = typeof normalizeTags === 'function' ? normalizeTags([...getAddTags(), ...smartName.tags]) : [...getAddTags(), ...smartName.tags];
    const categoryIds = getSelectedCategoryIdsFromForm();
    const notificationSettings = typeof getNotificationSettings === 'function' ? getNotificationSettings() : { daysBefore: [5, 3, 1] };
    const ssoUsername = linkedAccount ? getLinkedAccountUsernameForSave(linkedAccount) : '';
    const sensitiveData = {
        username: authMethod === 'email' ? (parsed.username || '') : ssoUsername,
        password: authMethod === 'email' ? (parsed.password || '') : '',
        twoFaCode: authMethod === 'email' ? (parsed.twoFaCode || '') : '',
        note,
        rawInput: authMethod === 'email' ? (raw || '') : '',
    };
    const baseData = {
        name,
        type,
        platform: getCurrentAddPlatform() || smartName.platform || detectPlatform(name),
        sellerName,
        sellerPlatform: sellerPlatform || 'other',
        sellerLink,
        purchasePrice: purchasePrice ?? null,
        displayUsername: maskUsername(sensitiveData.username),
        purchaseDate: pDate,
        expiryDate: eDate || null,
        expiryType: isL ? 'lifetime' : 'fixed',
        status: getStatusFromExpiry(eDate, isL ? 'lifetime' : 'fixed'),
        tags,
        planTag: tags[0] || null,
        categoryIds,
        protectedByMasterPassword: type === 'personal' || Boolean(window.appState.settings?.protectBoughtAccounts),
        authMethod,
        linkedAccountId,
        isFavorite: false,
        isPinned: false,
        favoriteAt: null,
        pinnedAt: null,
        notifyDaysBefore: notificationSettings.daysBefore,
        lastNotifiedDate: null,
        renewalHistory: [],
    };

    if (window.appState.isDemo) {
        const data = { ...baseData, ...sensitiveData };
        data.id = 'demo_' + Date.now();
        window.appState.accounts.unshift(data);
        markAccountAsJustAdded(data.id);
        updateHeader();
        closeModal();
        showToast(`Đã thêm "${name}"`, 'success');
        navigateTo(window.appState.currentPage);
    } else {
        try {
            let payload = { ...baseData, ...sensitiveData };
            if (baseData.protectedByMasterPassword) {
                const unlocked = await requireMasterPassword('Để mã hoá tài khoản trước khi lưu');
                if (!unlocked) return;
                const encryptedPayload = await encryptAccountData(sensitiveData, window.appState.masterPassword);
                payload = { ...baseData, ...encryptedPayload };
            }
            const id = await addAccountToDB(payload);
            if (id) { markAccountAsJustAdded(id); closeModal(); showToast(`Đã thêm "${name}"`, 'success'); }
        } catch (error) {
            console.error('❌ Lỗi mã hoá/lưu tài khoản:', error);
            showToast(error.message || 'Không thể mã hoá tài khoản', 'error');
        }
    }
}

// Ghi nhớ tài khoản vừa thêm để hiện nổi bật ở đầu Tổng quan
function markAccountAsJustAdded(id) {
    if (!id) return;
    window.appState.justAddedAccountId = id;
    window.appState.justAddedAt = Date.now();
}
if (typeof window !== 'undefined') window.markAccountAsJustAdded = markAccountAsJustAdded;

function dismissJustAddedAccount() {
    window.appState.justAddedAccountId = null;
    window.appState.justAddedAt = null;
    if (window.appState.currentPage === 'dashboard') renderDashboard();
}
if (typeof window !== 'undefined') window.dismissJustAddedAccount = dismissJustAddedAccount;

// ===== RENEW & DELETE =====
async function renewAccount(id, days) {
    if (window.appState.isDemo) {
        const acc = window.appState.accounts.find(a => a.id === id);
        if (acc) {
            acc.expiryDate = getRenewedExpiryDate(acc.expiryDate, days);
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
    return moveAccountToTrash(id);
}

// Đánh dấu tài khoản hết hạn ngay lập tức (đặt hạn về hôm qua)
async function markAccountExpired(id) {
    const acc = (window.appState.accounts || []).find(a => a.id === id);
    if (!acc) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expiryDate = typeof dateToInputValue === 'function'
        ? dateToInputValue(yesterday)
        : yesterday.toISOString().split('T')[0];
    const update = { expiryDate, expiryType: 'fixed', status: 'expired' };

    if (window.appState.isDemo) {
        Object.assign(acc, update);
        updateHeader();
        showToast('Đã đánh dấu hết hạn', 'success');
        if (window.appState.currentPage === 'detail') renderDetail(id);
        else rerenderCurrentView(id);
        if (!document.getElementById('notification-dropdown')?.hidden) renderNotificationPanel?.();
        return;
    }
    if (await updateAccountInDB(id, update)) {
        Object.assign(acc, update);
        showToast('Đã đánh dấu hết hạn', 'success');
        if (!document.getElementById('notification-dropdown')?.hidden) renderNotificationPanel?.();
        if (window.appState.currentPage === 'detail') renderDetail(id);
        else rerenderCurrentView(id);
    }
}
if (typeof window !== 'undefined') window.markAccountExpired = markAccountExpired;

function initEditFormState(acc, decrypted = {}) {
    window.appState.editingAccount = { id: acc.id };
    window.appState.addFormTags = Array.isArray(acc.tags) ? [...acc.tags] : [];
    window.appState.addFormAutoTags = [];
    window.appState.addFormPlatform = acc.platform || null;
    window.appState.addFormAutoPlatform = null;
    window.appState.addFormDetectedServices = { platforms: [], tags: [] };
    window.appState.addFormAuthMethod = typeof getAuthMethod === 'function' ? getAuthMethod(acc.authMethod || 'email') : (acc.authMethod || 'email');
    window.appState.addFormLinkedId = acc.linkedAccountId || null;
    window.appState.planEditMode = false;
    return { ...acc, ...decrypted, id: acc.id };
}

function finishEditFormInit(acc) {
    const lifetime = acc.expiryType === 'lifetime';
    const custom = document.getElementById('add-date-custom');
    const lifetimeInput = document.getElementById('add-lifetime');
    const detail = document.getElementById('smart-date-details');
    const purchaseDetail = document.getElementById('add-purchase-detail');
    const expiryDetail = document.getElementById('add-expiry-detail');
    if (custom) custom.checked = true;
    if (detail) detail.hidden = false;
    if (lifetimeInput) lifetimeInput.checked = lifetime;
    if (purchaseDetail && acc.purchaseDate) purchaseDetail.value = acc.purchaseDate;
    if (expiryDetail) {
        if (acc.expiryDate) expiryDetail.value = acc.expiryDate;
        expiryDetail.disabled = lifetime;
    }
    if (lifetimeInput) handleAddLifetimeToggle(lifetimeInput);
    updateAddTagSuggestions?.();
    renderSelectedAddTags?.();
    updatePlatformPickerState?.();
    updateAddExpiryHint?.('edit');
    updateAddAuthMethodUI?.();
    previewParse?.();
}

async function editAccount(accId) {
    const acc = (window.appState.accounts || []).find(item => item.id === accId);
    if (!acc) return;
    const decrypted = await getSensitiveAccountData(acc, 'Mở khóa để sửa tài khoản');
    if (decrypted === null) return;
    const editData = initEditFormState(acc, decrypted || {});
    const html = typeof renderEditForm === 'function'
        ? renderEditForm(acc, decrypted || {})
        : renderAddForm(acc.type || 'bought', editData);
    openModal('Sửa tài khoản', html);
    finishEditFormInit(editData);
}

function collectEditedAccountInput(acc) {
    const raw = document.getElementById('paste-input')?.value || '';
    const parsed = parseAccountInput(raw) || {};
    const authMethod = typeof getAuthMethod === 'function'
        ? getAuthMethod(window.appState.addFormAuthMethod || acc.authMethod || 'email')
        : (window.appState.addFormAuthMethod || acc.authMethod || 'email');
    const linkedAccountId = authMethod === 'email' ? null : (window.appState.addFormLinkedId || null);
    const linkedAccount = linkedAccountId
        ? (window.appState.accounts || []).find(item => item.id === linkedAccountId)
        : null;
    const linkedOptions = authMethod === 'email' ? [] : getLinkedAccountOptions(authMethod);
    if (authMethod !== 'email' && linkedOptions.length > 0 && !linkedAccountId) {
        return { ok: false, message: `Chọn TK ${getAuthMethodLabel(authMethod)} gốc` };
    }
    const ssoUsername = linkedAccount ? getLinkedAccountUsernameForSave(linkedAccount) : (acc.username || acc.displayUsername || '');
    return buildAccountSaveInput({
        rawInput: raw,
        parsed,
        name: document.getElementById('add-name')?.value?.trim() || '',
        type: acc.type,
        platform: getCurrentAddPlatform() || acc.platform,
        purchaseDate: document.getElementById('add-purchase')?.value || acc.purchaseDate || todayStr(),
        expiryDate: document.getElementById('add-lifetime')?.checked ? null : (document.getElementById('add-expiry')?.value || acc.expiryDate || ''),
        expiryType: document.getElementById('add-lifetime')?.checked ? 'lifetime' : 'fixed',
        note: document.getElementById('add-note')?.value || '',
        sellerName: document.getElementById('add-seller-name')?.value || '',
        sellerPlatform: document.getElementById('add-seller-platform')?.value || 'other',
        sellerLink: document.getElementById('add-seller-link')?.value || '',
        purchasePrice: document.getElementById('add-price')?.value || '',
        tags: getAddTags(),
        categoryIds: getSelectedCategoryIdsFromForm(),
        protectedByMasterPassword: acc.protectedByMasterPassword === true || acc.type === 'personal',
        authMethod,
        linkedAccountId,
        username: authMethod === 'email' ? (parsed.username || '') : ssoUsername,
        password: authMethod === 'email' ? (parsed.password || '') : '',
        twoFaCode: authMethod === 'email' ? (parsed.twoFaCode || '') : '',
        isFavorite: acc.isFavorite,
        isPinned: acc.isPinned,
        favoriteAt: acc.favoriteAt,
        pinnedAt: acc.pinnedAt,
        notifyDaysBefore: acc.notifyDaysBefore,
        lastNotifiedDate: acc.lastNotifiedDate,
        renewalHistory: acc.renewalHistory,
    });
}

async function saveEditedAccount(accId) {
    const acc = (window.appState.accounts || []).find(item => item.id === accId);
    if (!acc) return;
    const built = collectEditedAccountInput(acc);
    if (!built.ok) {
        showToast(built.message, 'error');
        return;
    }
    const { name, baseData, sensitiveData } = built;
    try {
        let payload = { ...baseData, ...sensitiveData };
        if (baseData.protectedByMasterPassword) {
            const unlocked = await requireMasterPassword('Mã hóa lại tài khoản trước khi lưu');
            if (!unlocked) return;
            const encryptedPayload = await encryptAccountData(sensitiveData, window.appState.masterPassword);
            payload = { ...baseData, ...encryptedPayload };
        }
        if (window.appState.isDemo) {
            Object.assign(acc, payload);
            window.appState.activeDecryptedAccount = { id: accId, data: { ...sensitiveData } };
            updateHeader();
            closeModal();
            window.appState.editingAccount = null;
            showToast(`Đã lưu "${name}"`, 'success');
            renderDetail(accId);
            return;
        }
        if (await updateAccountInDB(accId, payload)) {
            closeModal();
            window.appState.editingAccount = null;
            showToast(`Đã lưu "${name}"`, 'success');
            Object.assign(acc, payload);
            window.appState.activeDecryptedAccount = { id: accId, data: { ...sensitiveData } };
            renderDetail(accId);
        }
    } catch (error) {
        console.error('Edit account error:', error);
        showToast(error.message || 'Không thể lưu thay đổi', 'error');
    }
}

async function moveAccountToTrash(id) {
    const acc = window.appState.accounts.find(a => a.id === id);
    const linkedServices = typeof getLinkedServices === 'function' ? getLinkedServices(id) : [];
    const linkedWarning = linkedServices.length
        ? `\n\nCó ${linkedServices.length} dịch vụ đang đăng nhập bằng TK này: ${linkedServices.slice(0, 3).map(item => item.name).join(', ')}${linkedServices.length > 3 ? '...' : ''}. Sau khi xoá, các dịch vụ đó sẽ hiện cảnh báo TK gốc.`
        : '';
    if (!confirm(`Chuyển tài khoản này vào thùng rác? Bạn có thể khôi phục lại sau.${linkedWarning}`)) return;

    if (window.appState.isDemo) {
        if (!acc) return;
        window.appState.accounts = window.appState.accounts.filter(a => a.id !== id);
        window.appState.trashAccounts.unshift({
            ...acc,
            isDeleted: true,
            deletedAt: new Date(),
        });
        updateHeader();
        showToast('Đã chuyển vào thùng rác', 'success');
        goBack();
        return;
    } else {
        if (await deleteAccountFromDB(id)) { showToast('Đã chuyển vào thùng rác', 'success'); goBack(); }
    }
}

async function restoreAccount(id) {
    const acc = window.appState.trashAccounts.find(a => a.id === id);
    if (!acc) return;

    if (window.appState.isDemo) {
        window.appState.trashAccounts = window.appState.trashAccounts.filter(a => a.id !== id);
        window.appState.accounts.unshift({
            ...acc,
            isDeleted: false,
            deletedAt: null,
            status: getStatusFromExpiry(acc.expiryDate, acc.expiryType),
        });
        updateHeader();
        showToast('Đã khôi phục tài khoản', 'success');
        renderTrashList();
        return;
    }

    if (await restoreAccountFromDB(id)) {
        showToast('Đã khôi phục tài khoản', 'success');
    }
}

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

function getStoredNotificationSettings() {
    const fallback = typeof getNotificationSettings === 'function'
        ? getNotificationSettings()
        : {
            enabled: true,
            nativeEnabled: true,
            inAppEnabled: true,
            daysBefore: [5, 3, 1],
            repeatHours: 24,
            overdueDays: 3,
        };
    return {
        enabled: readLocalSetting('notificationsEnabled', fallback.enabled),
        nativeEnabled: readLocalSetting('nativeNotificationsEnabled', fallback.nativeEnabled),
        inAppEnabled: readLocalSetting('inAppNotificationsEnabled', fallback.inAppEnabled),
        daysBefore: typeof normalizeNotifyDays === 'function'
            ? normalizeNotifyDays(readLocalSetting('notifyDaysBefore', fallback.daysBefore))
            : readLocalSetting('notifyDaysBefore', fallback.daysBefore),
        repeatHours: Number(readLocalSetting('notifyRepeatHours', fallback.repeatHours)) || fallback.repeatHours,
        overdueDays: Number(readLocalSetting('notifyOverdueDays', fallback.overdueDays)) || 0,
    };
}

function applyNotificationSettings(settings = {}) {
    const daysBefore = typeof normalizeNotifyDays === 'function'
        ? normalizeNotifyDays(settings.daysBefore ?? settings.notifyDaysBefore ?? settings.defaultNotifyDays)
        : (settings.daysBefore ?? settings.notifyDaysBefore ?? settings.defaultNotifyDays ?? [5, 3, 1]);
    window.appState.settings.notificationsEnabled = settings.enabled ?? settings.notificationsEnabled ?? true;
    window.appState.settings.nativeNotificationsEnabled = settings.nativeEnabled ?? settings.nativeNotificationsEnabled ?? true;
    window.appState.settings.inAppNotificationsEnabled = settings.inAppEnabled ?? settings.inAppNotificationsEnabled ?? true;
    window.appState.settings.notifyDaysBefore = daysBefore;
    window.appState.settings.notifyRepeatHours = Math.max(24, Number(settings.repeatHours ?? settings.notifyRepeatHours ?? 24) || 24);
    window.appState.settings.notifyOverdueDays = Math.min(3, Math.max(0, Number(settings.overdueDays ?? settings.notifyOverdueDays ?? 3) || 0));
}

function writeNotificationSettingsLocal() {
    const settings = getNotificationSettings();
    writeLocalSetting('notificationsEnabled', settings.enabled);
    writeLocalSetting('nativeNotificationsEnabled', settings.nativeEnabled);
    writeLocalSetting('inAppNotificationsEnabled', settings.inAppEnabled);
    writeLocalSetting('notifyDaysBefore', settings.daysBefore);
    writeLocalSetting('notifyRepeatHours', settings.repeatHours);
    writeLocalSetting('notifyOverdueDays', settings.overdueDays);
}

async function persistNotificationSettings() {
    const settings = getNotificationSettings();
    writeNotificationSettingsLocal();
    updateHeader();
    if (!window.appState.isDemo && window.appState.isLoggedIn && typeof updateUserSettings === 'function') {
        await updateUserSettings({
            notificationSettings: settings,
            defaultNotifyDays: settings.daysBefore,
        });
    }
}

async function loadCloudUserSettings() {
    if (window.appState.isDemo || !window.appState.isLoggedIn || typeof getUserSettings !== 'function') return;
    const cloud = await getUserSettings();
    if (!cloud) return;
    applyNotificationSettings(cloud.notificationSettings || {
        daysBefore: cloud.defaultNotifyDays,
        repeatHours: cloud.notifyRepeatHours,
        overdueDays: cloud.notifyOverdueDays,
        enabled: cloud.notificationsEnabled,
        nativeEnabled: cloud.nativeNotificationsEnabled,
        inAppEnabled: cloud.inAppNotificationsEnabled,
    });
    writeNotificationSettingsLocal();
    updateHeader();
}

function initUserPreferences() {
    window.appState.settings.clipboardAutoClear = readLocalSetting('clipboardAutoClear', true);
    window.appState.settings.protectBoughtAccounts = readLocalSetting('protectBoughtAccounts', false);
    window.appState.settings.theme = readLocalSetting('theme', 'system');
    applyNotificationSettings(getStoredNotificationSettings());
    applyThemePreference(window.appState.settings.theme);
    window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => {
        if (window.appState.settings.theme === 'system') applyThemePreference('system');
    });
}

async function initDesktopIntegrations() {
    const api = window.electronAPI;
    if (!api?.isElectron) return;

    try {
        const [autoStart, autoLockMinutes, version, updateLog, shortcuts] = await Promise.all([
            api.getAutoStart?.(),
            api.getAutoLockMinutes?.(),
            api.getAppVersion?.(),
            api.getUpdateLog?.(),
            api.getShortcuts?.(),
        ]);
        if (typeof autoStart === 'boolean') window.appState.settings.autoStart = autoStart;
        if (typeof autoLockMinutes === 'number') window.appState.settings.autoLockMinutes = autoLockMinutes;
        if (version) {
            window.appState.appVersion = version;
            updateSidebarVersion();
        }
        if (Array.isArray(updateLog)) window.appState.updateLog = updateLog;
        if (shortcuts && typeof shortcuts === 'object') window.appState.settings.shortcuts = shortcuts;
    } catch (error) {
        console.warn('Không đọc được setting Electron:', error);
    }

    api.onAutoLock?.(() => lockMasterPassword('Đã tự khoá do không hoạt động'));
    api.onShowNotifications?.(() => {
        const settings = typeof getNotificationSettings === 'function' ? getNotificationSettings() : { enabled: true, inAppEnabled: true };
        if (!settings.enabled || !settings.inAppEnabled) return;
        renderNotificationPanel?.();
        document.getElementById('notification-dropdown')?.removeAttribute('hidden');
    });
    api.onQuickAddRequest?.(handleQuickAddRequest);
    api.onQuickAddContextRequest?.(handleQuickAddContextRequest);
    api.onUpdateEvent?.(event => {
        window.appState.updateStatus = event;
        if (Array.isArray(event?.log)) window.appState.updateLog = event.log;
        if (window.appState.currentPage === 'settings') renderSettings();
        // Background_Check trên desktop (event-driven): khi lần kiểm tra NỀN phát
        // hiện bản mới, để controller quyết định toast/dialog theo khoảng cách
        // (Yêu cầu 7.6/7.7/7.8). Kiểm tra thủ công không đi qua đường này.
        if (desktopBackgroundCheckPending && (event?.status === 'available' || event?.status === 'update-available')) {
            desktopBackgroundCheckPending = false;
            const controller = typeof getBackgroundCheckController === 'function' ? getBackgroundCheckController() : null;
            if (controller && event?.info) {
                controller.notifyUpdateAvailable(event.info);
                return;
            }
        }
        if (desktopBackgroundCheckPending && (event?.status === 'not-available' || event?.status === 'error')) {
            desktopBackgroundCheckPending = false;
        }
        if (event?.message) showToast(event.message, event.type === 'error' ? 'error' : 'success');
    });
}

function buildQuickAddContext() {
    const authMethods = Object.entries(window.AUTH_METHOD_CONFIG || { email: { label: 'Email', sublabel: 'Mật khẩu' } })
        .map(([id, config]) => ({ id, label: config.label || id, sublabel: config.sublabel || '' }));
    const categories = typeof getSortedCategories === 'function'
        ? getSortedCategories().map(category => ({
            id: category.id,
            name: category.name,
            color: category.color || '#6C5CE7',
            icon: category.icon || 'folder',
        }))
        : [];
    const linkedAccounts = authMethods
        .filter(method => method.id !== 'email')
        .flatMap(method => (typeof getLinkedAccountOptions === 'function' ? getLinkedAccountOptions(method.id) : [])
            .map(acc => ({
                id: acc.id,
                method: method.id,
                name: acc.name || '',
                platform: acc.platform || '',
                username: typeof getLinkedAccountUsernameForSave === 'function'
                    ? getLinkedAccountUsernameForSave(acc)
                    : (acc.displayUsername || acc.username || ''),
                displayUsername: acc.displayUsername || acc.username || '',
            })));
    return { ok: true, authMethods, categories, linkedAccounts };
}

function handleQuickAddContextRequest(event = {}) {
    window.electronAPI?.sendQuickAddContextResult?.({
        requestId: event.requestId,
        ...buildQuickAddContext(),
    });
}

async function handleQuickAddRequest(event = {}) {
    const requestId = event.requestId;
    const payload = event.payload || {};
    const sendResult = result => {
        window.electronAPI?.sendQuickAddResult?.({ requestId, ...result });
    };

    if (!window.appState.isLoggedIn) {
        sendResult({ ok: false, message: 'Hay dang nhap Ting! truoc.' });
        return;
    }

    const authMethod = typeof getAuthMethod === 'function' ? getAuthMethod(payload.authMethod || 'email') : (payload.authMethod || 'email');
    let linkedAccountId = null;
    let linkedUsername = '';
    if (authMethod !== 'email') {
        const linkedOptions = typeof getLinkedAccountOptions === 'function' ? getLinkedAccountOptions(authMethod) : [];
        const linked = linkedOptions.find(acc => acc.id === payload.linkedAccountId) || null;
        if (linkedOptions.length && !linked) {
            sendResult({ ok: false, message: `Chon TK ${getAuthMethodLabel(authMethod)} goc truoc.` });
            return;
        }
        linkedAccountId = linked?.id || null;
        linkedUsername = linked
            ? (typeof getLinkedAccountUsernameForSave === 'function' ? getLinkedAccountUsernameForSave(linked) : (linked.displayUsername || linked.username || ''))
            : String(payload.username || '');
    }

    const result = await persistNewAccount({
        type: payload.type === 'personal' ? 'personal' : 'bought',
        name: payload.name,
        rawInput: payload.rawInput,
        isLifetime: Boolean(payload.isLifetime),
        purchaseDate: payload.purchaseDate || todayStr(),
        expiryDate: payload.expiryDate || '',
        expiryQuick: payload.expiryQuick || '30',
        platform: payload.platform,
        categoryIds: Array.isArray(payload.categoryIds) ? payload.categoryIds : [],
        authMethod,
        linkedAccountId,
        username: linkedUsername,
        tagsText: payload.tagsText,
        note: payload.note,
    }, {
        closeModal: false,
        navigateAfter: false,
        masterReason: 'De ma hoa tai khoan tu Quick Add',
    });

    if (result.ok) {
        updateHeader();
        if (window.appState.currentPage === 'dashboard') renderDashboard();
        else rerenderCurrentView?.(result.id);
    }
    sendResult(result);
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

// ===== SHORTCUT HANDLERS =====
// Chuyển đổi tên phím từ KeyboardEvent sang format Electron Accelerator
function keyEventToAccelerator(event) {
    const parts = [];
    if (event.ctrlKey) parts.push('Control');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Super');
    // Bỏ qua nếu chỉ có modifier
    const key = event.key;
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return '';
    // Map key name sang Electron accelerator format
    const keyMap = {
        'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
        'Escape': 'Escape', 'Enter': 'Return', 'Backspace': 'Backspace', 'Delete': 'Delete',
        'Tab': 'Tab', ' ': 'Space', 'Insert': 'Insert', 'Home': 'Home', 'End': 'End',
        'PageUp': 'PageUp', 'PageDown': 'PageDown',
    };
    const mapped = keyMap[key] || (key.length === 1 ? key.toUpperCase() : key);
    // F1-F24
    if (/^F\d{1,2}$/.test(mapped)) parts.push(mapped);
    else parts.push(mapped);
    if (parts.length < 2) return ''; // Cần ít nhất 1 modifier + 1 phím
    return parts.join('+');
}

// Hiển thị phím tắt dạng đọc được cho UI
function formatAcceleratorDisplay(accelerator) {
    if (!accelerator) return 'Chưa đặt';
    return accelerator
        .replace(/Control/g, 'Ctrl')
        .replace(/Super/g, 'Win')
        .replace(/\+/g, ' + ');
}

// Bắt đầu ghi phím tắt
function startRecordingShortcut(action) {
    window.appState._recordingShortcut = action;
    const btn = document.getElementById(`shortcut-btn-${action}`);
    if (btn) {
        btn.classList.add('recording');
        btn.querySelector('.shortcut-key-display').textContent = 'Nhấn tổ hợp phím...';
    }
    // Focus vào nút để nhận keydown
    btn?.focus();
}

function stopRecordingShortcut() {
    const action = window.appState._recordingShortcut;
    window.appState._recordingShortcut = null;
    if (action) {
        const btn = document.getElementById(`shortcut-btn-${action}`);
        btn?.classList.remove('recording');
        // Render lại giá trị cũ
        const current = window.appState.settings.shortcuts?.[action] || '';
        const display = btn?.querySelector('.shortcut-key-display');
        if (display) display.textContent = formatAcceleratorDisplay(current);
    }
}

function handleShortcutKeydown(event) {
    const action = window.appState._recordingShortcut;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    // Escape → hủy
    if (event.key === 'Escape') {
        stopRecordingShortcut();
        return;
    }
    const accelerator = keyEventToAccelerator(event);
    if (!accelerator) return; // Chỉ modifier, chờ tiếp
    // Lưu phím tắt
    saveRecordedShortcut(action, accelerator);
}

async function saveRecordedShortcut(action, accelerator) {
    window.appState._recordingShortcut = null;
    const btn = document.getElementById(`shortcut-btn-${action}`);
    btn?.classList.remove('recording');

    try {
        const result = await window.electronAPI?.setShortcut?.(action, accelerator);
        if (result?.ok) {
            window.appState.settings.shortcuts = result.shortcuts;
            showToast(`Đã đổi phím tắt: ${formatAcceleratorDisplay(accelerator)}`, 'success');
        } else {
            showToast(result?.message || 'Không thể đặt phím tắt', 'error');
        }
    } catch {
        showToast('Lỗi khi đổi phím tắt', 'error');
    }
    renderSettings();
}

async function resetShortcuts() {
    try {
        const result = await window.electronAPI?.resetShortcuts?.();
        if (result?.ok) {
            window.appState.settings.shortcuts = result.shortcuts;
            showToast('Đã khôi phục phím tắt mặc định', 'success');
        }
    } catch {
        showToast('Lỗi khi reset phím tắt', 'error');
    }
    renderSettings();
}

async function clearShortcut(action) {
    try {
        const result = await window.electronAPI?.setShortcut?.(action, '');
        if (result?.ok) {
            window.appState.settings.shortcuts = result.shortcuts;
            showToast('Đã xóa phím tắt', 'success');
        }
    } catch {
        showToast('Lỗi khi xóa phím tắt', 'error');
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

function handleProtectBoughtToggle(input) {
    const enabled = Boolean(input.checked);
    window.appState.settings.protectBoughtAccounts = enabled;
    writeLocalSetting('protectBoughtAccounts', enabled);
    window.appState.activeDecryptedAccount = null;
    clearRevealedSecrets();
    showToast(enabled ? 'TK Mua sẽ yêu cầu Master Password' : 'TK Mua sẽ xem/copy nhanh', 'success');
    renderSettings();
}

async function handleNotificationsEnabledToggle(input) {
    window.appState.settings.notificationsEnabled = Boolean(input.checked);
    await persistNotificationSettings();
    showToast(input.checked ? 'Đã bật nhắc hạn' : 'Đã tắt nhắc hạn', 'success');
    renderSettings();
}

async function handleNativeNotificationsToggle(input) {
    window.appState.settings.nativeNotificationsEnabled = Boolean(input.checked);
    await persistNotificationSettings();
    showToast(input.checked ? 'Đã bật toast Windows' : 'Đã tắt toast Windows', 'success');
    renderSettings();
}

async function handleInAppNotificationsToggle(input) {
    window.appState.settings.inAppNotificationsEnabled = Boolean(input.checked);
    await persistNotificationSettings();
    showToast(input.checked ? 'Đã bật chuông trong app' : 'Đã tắt chuông trong app', 'success');
    renderSettings();
}

async function handleNotifyDaysChange(value) {
    const days = normalizeNotifyDays(value);
    window.appState.settings.notifyDaysBefore = days;
    await persistNotificationSettings();
    showToast(`Sẽ nhắc trước ${days.join(', ')} ngày`, 'success');
    renderSettings();
}

async function handleNotifyRepeatChange(value) {
    const hours = Math.max(24, Number(value) || 24);
    window.appState.settings.notifyRepeatHours = hours;
    await persistNotificationSettings();
    showToast('Sẽ nhắc tối đa mỗi ngày một lần', 'success');
    renderSettings();
}

async function handleNotifyOverdueChange(value) {
    const days = Math.min(3, Math.max(0, Number(value) || 0));
    window.appState.settings.notifyOverdueDays = days;
    await persistNotificationSettings();
    showToast(days ? `Sẽ hiện tài khoản quá hạn trong ${days} ngày` : 'Đã ẩn tài khoản quá hạn khỏi chuông', 'success');
    renderSettings();
}

async function sendTestNotification() {
    const permission = await requestNotificationPermission?.();
    if (permission === 'denied' || permission === 'unsupported') {
        showToast('Thiết bị chưa cho phép thông báo', 'error');
        return;
    }
    const ok = await sendNativeNotification?.(
        'Ting! test thông báo',
        'Nếu bạn thấy dòng này, thông báo Windows đang hoạt động.'
    );
    showToast(ok ? 'Đã gửi thử thông báo' : 'Không gửi được thông báo', ok ? 'success' : 'error');
}

async function openNotificationSettingsFromApp() {
    const opened = await openNativeNotificationSettings?.();
    showToast(opened ? 'Đã mở cài đặt thông báo Windows' : 'Không mở được cài đặt thông báo', opened ? 'success' : 'error');
}

async function checkForUpdates() {
    const platform = typeof getUpdatePlatform === 'function'
        ? getUpdatePlatform()
        : (window.electronAPI?.isElectron ? 'electron' : 'web');

    // Desktop (Electron): định tuyến qua IPC tới Desktop_Updater.
    if (platform === 'electron') {
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
        return;
    }

    // Android: định tuyến tới Mobile_Updater trong webview.
    if (platform === 'android') {
        const updater = window.TingMobileUpdater;
        if (!updater?.checkForUpdate) {
            showToast('Không thể kiểm tra cập nhật trên thiết bị này', 'error');
            return;
        }
        window.appState.updateStatus = { status: 'checking', message: 'Đang kiểm tra cập nhật...' };
        renderSettings();
        try {
            const result = await updater.checkForUpdate();
            window.appState.updateStatus = result;
            const log = updater.readUpdateLog?.();
            if (Array.isArray(log)) window.appState.updateLog = log;
            renderSettings();
            if (result?.message) {
                const isError = result.status === 'error' || result.status === 'offline';
                showToast(result.message, isError ? 'error' : 'success');
            }
        } catch (error) {
            window.appState.updateStatus = { status: 'error', message: error.message || 'Không thể kiểm tra cập nhật', type: 'error' };
            renderSettings();
        }
        return;
    }

    // iOS / web / nền tảng không xác định: suy giảm nhẹ nhàng, không phát sinh lỗi.
    const cap = typeof getUpdateCapability === 'function' ? getUpdateCapability(platform) : null;
    showToast(cap?.disabledMessage || 'Không hỗ trợ tự cập nhật trên nền tảng này', 'error');
}

// Định tuyến hành động "Cập nhật" theo nền tảng.
async function startUpdateDownload() {
    const platform = typeof getUpdatePlatform === 'function'
        ? getUpdatePlatform()
        : (window.electronAPI?.isElectron ? 'electron' : 'web');

    if (platform === 'electron') {
        if (!window.electronAPI?.downloadUpdate && !window.electronAPI?.checkForUpdates) {
            showToast('Chức năng tải bản cập nhật chưa sẵn sàng', 'error');
            return;
        }
        window.appState.updateStatus = {
            ...(window.appState.updateStatus || {}),
            status: 'downloading',
            message: 'Đang tải bản cập nhật...',
            progress: { percent: 0 },
        };
        renderSettings();
        try {
            if (window.electronAPI?.downloadUpdate) {
                await window.electronAPI.downloadUpdate();
            } else {
                await window.electronAPI.checkForUpdates();
            }
        } catch (error) {
            window.appState.updateStatus = { status: 'error', message: error.message || 'Tải bản cập nhật thất bại', type: 'error' };
            renderSettings();
        }
        return;
    }

    const updater = window.TingMobileUpdater;
    const info = window.appState.updateStatus?.info || null;
    if (!updater?.downloadAndInstall) {
        showToast('Chức năng tải bản cập nhật chưa sẵn sàng', 'error');
        return;
    }
    const setDownloading = percent => {
        window.appState.updateStatus = {
            ...(window.appState.updateStatus || {}),
            status: 'downloading',
            message: 'Đang tải bản cập nhật...',
            progress: { percent: Number.isFinite(percent) ? percent : 0 },
        };
        if (window.appState.currentPage === 'settings') renderSettings();
    };
    setDownloading(0);
    try {
        updater.onProgress?.(percent => setDownloading(Number(percent)));
        await updater.downloadAndInstall(info);
    } catch (error) {
        window.appState.updateStatus = { status: 'error', message: error.message || 'Tải bản cập nhật thất bại', type: 'error' };
        renderSettings();
    }
}

function installDownloadedUpdate() {
    window.electronAPI?.quitAndInstall?.();
}

// ===== BACKGROUND_CHECK (Update_System — Yêu cầu 7.1–7.9) =====

// Cờ đánh dấu một Background_Check trên desktop đang chờ kết quả (electron-updater
// phát sự kiện bất đồng bộ qua update-event thay vì trả về trực tiếp). Dùng để chỉ
// phát thông báo toast/dialog cho lần kiểm tra NỀN, không phải kiểm tra thủ công.
let desktopBackgroundCheckPending = false;

// Instance điều phối Background_Check (tạo một lần, bơm phụ thuộc thật theo nền tảng).
let backgroundCheckController = null;

// Định tuyến kiểm tra cập nhật NỀN theo nền tảng cho Background_Check_Controller.
// - Android: gọi Mobile_Updater.checkForUpdate({background:true}) và TRẢ VỀ kết quả
//   để controller quyết định toast/dialog.
// - Desktop: kích hoạt electron-updater (event-driven); đánh dấu cờ để onUpdateEvent
//   phát thông báo khi nhận 'available'. Không trả về kết quả trạng thái.
async function runPlatformBackgroundCheck() {
    const platform = typeof getUpdatePlatform === 'function'
        ? getUpdatePlatform()
        : (window.electronAPI?.isElectron ? 'electron' : 'web');

    if (platform === 'android') {
        const updater = window.TingMobileUpdater;
        if (!updater?.checkForUpdate) return { status: 'error', message: 'no-updater', info: null };
        const result = await updater.checkForUpdate({ background: true });
        // Đồng bộ nhật ký vào UI nếu đang xem Cài đặt.
        const log = updater.readUpdateLog?.();
        if (Array.isArray(log)) window.appState.updateLog = log;
        if (result) window.appState.updateStatus = result;
        if (window.appState.currentPage === 'settings') renderSettings();
        return result;
    }

    if (platform === 'electron' && window.electronAPI?.checkForUpdates) {
        desktopBackgroundCheckPending = true;
        try {
            await window.electronAPI.checkForUpdates();
        } catch (error) {
            desktopBackgroundCheckPending = false;
        }
        // Kết quả (available/not-available) tới qua update-event.
        return null;
    }

    // iOS / web / không xác định: không có đường cập nhật trong app.
    return { status: 'up-to-date', message: '', info: null };
}

// Tạo/lấy Background_Check_Controller mặc định với phụ thuộc thật:
// - State: desktop dùng electron-store qua IPC; Android/web dùng localStorage.
// - runCheck: định tuyến theo nền tảng; notify: hiển thị toast/dialog qua Update_UI.
function getBackgroundCheckController() {
    if (backgroundCheckController) return backgroundCheckController;
    const factory = window.TingBackgroundCheckFactory;
    if (!factory?.createBackgroundCheckController) return null;

    const isElectron = Boolean(window.electronAPI?.isElectron);
    const overrides = {
        runCheck: () => runPlatformBackgroundCheck(),
        notify: payload => {
            if (typeof showUpdateNotification === 'function') showUpdateNotification(payload);
        },
    };

    // Desktop: đọc/ghi BackgroundCheckState qua electron-store (IPC).
    if (isElectron && window.electronAPI?.getBackgroundCheckState) {
        overrides.readState = () => window.electronAPI.getBackgroundCheckState();
        overrides.writeState = patch => window.electronAPI.setBackgroundCheckState?.(patch);
    }
    // Android/web: mặc định dùng localStorage (không cần override).

    try {
        backgroundCheckController = factory.createBackgroundCheckController(overrides);
    } catch (error) {
        console.warn('Không khởi tạo được Background_Check:', error);
        backgroundCheckController = null;
    }
    return backgroundCheckController;
}

// Chạy Background_Check lúc khởi động — KHÔNG chặn trình tự khởi động (Yêu cầu 7.3):
// gọi mà không await, và trì hoãn nhẹ để nhường luồng khởi động chính.
function scheduleBackgroundCheck() {
    const start = () => {
        const controller = getBackgroundCheckController();
        if (!controller) return;
        // Không await: chạy nền, mọi lỗi được nuốt an toàn.
        Promise.resolve(controller.runAtStartup()).catch(() => {});
    };
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(start, { timeout: 3000 });
    } else {
        setTimeout(start, 1200);
    }
}

// Hành động "Cập nhật ngay" từ dialog Background_Check: đóng dialog rồi định tuyến
// theo nền tảng (Android tải + cài; desktop mở Cài đặt để theo dõi/cài đặt).
function triggerUpdateActionFromDialog() {
    closeModal?.();
    const platform = typeof getUpdatePlatform === 'function'
        ? getUpdatePlatform()
        : (window.electronAPI?.isElectron ? 'electron' : 'web');
    if (platform === 'android') {
        startUpdateDownload?.();
        return;
    }
    // Desktop: bản tải tự chạy khi phát hiện bản mới; đưa người dùng tới Cài đặt.
    if (typeof navigateTo === 'function') navigateTo('settings');
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
    clearAuthNotice?.();
    const b = document.getElementById('btn-email-login');
    const t = document.getElementById('auth-toggle-text');
    const l = document.getElementById('auth-toggle-link');
    const h = document.getElementById('auth-card-title');
    const strength = document.getElementById('pw-strength-wrap');
    const confirmGroup = document.getElementById('confirm-pw-group');
    const confirmInput = document.getElementById('auth-confirm-password');
    const passwordInput = document.getElementById('auth-password');
    const googleBtn = document.getElementById('btn-google-login');
    const authDivider = document.querySelector('.d-auth-card .auth-divider');
    const isRegister = window.appState.authMode === 'login';

    window.appState.authMode = isRegister ? 'register' : 'login';
    b.textContent = isRegister ? 'Đăng ký' : 'Đăng nhập';
    t.textContent = isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?';
    l.textContent = isRegister ? 'Đăng nhập' : 'Đăng ký ngay';
    h.textContent = isRegister ? 'Đăng ký' : 'Đăng nhập';
    strength.hidden = !isRegister;
    confirmGroup.hidden = !isRegister;
    confirmInput.required = isRegister;
    // Ẩn nút Google + divider khi đăng ký (chỉ dùng email/password)
    if (googleBtn) googleBtn.style.display = isRegister ? 'none' : '';
    if (authDivider) authDivider.style.display = isRegister ? 'none' : '';
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
    const settings = typeof getNotificationSettings === 'function' ? getNotificationSettings() : { enabled: true, inAppEnabled: true };
    if (!settings.enabled || !settings.inAppEnabled) {
        showToast('Chuông trong app đang tắt trong Cài đặt', 'error');
        return;
    }
    await requestNotificationPermission?.();
    toggleNotificationPanel?.();
}
