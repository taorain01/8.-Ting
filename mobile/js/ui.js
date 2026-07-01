/* Ting! — UI Renderer
   Render các trang: Dashboard, TK Mua, Cá nhân, Cài đặt, Chi tiết */

// ===== TOAST =====
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${type === 'success' ? '✓' : '✕'} ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 2500);
}

// ===== MODAL =====
function openModal(title, bodyHTML) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
}

function renderFavoriteButton(acc) {
    const active = isAccountFavorite(acc);
    const title = active ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích';
    return `<button type="button" class="copy-btn favorite-toggle ${active ? 'active' : ''}" onclick="event.stopPropagation();toggleFavorite('${escapeJsAttr(acc.id)}')" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><svg viewBox="0 0 24 24" fill="${active ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>`;
}

function renderPinButton(acc) {
    const active = isAccountPinned(acc);
    const title = active ? 'Bỏ ghim' : 'Ghim lên đầu';
    return `<button type="button" class="copy-btn pin-toggle ${active ? 'active' : ''}" onclick="event.stopPropagation();togglePinned('${escapeJsAttr(acc.id)}')" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><svg viewBox="0 0 24 24" fill="${active ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 17v5"/><path d="M5 17h14"/><path d="M9 3h6l1 7 3 3v4H5v-4l3-3 1-7Z"/></svg></button>`;
}

function renderPreferenceMarkers(acc) {
    const markers = [];
    if (isAccountPinned(acc)) markers.push('<span class="account-marker marker-pin">Ghim</span>');
    if (isAccountFavorite(acc)) markers.push('<span class="account-marker marker-favorite">Yêu thích</span>');
    return markers.length ? `<div class="account-markers">${markers.join('')}</div>` : '';
}

function getDashboardAccountKey(acc) {
    return acc?.id || `${acc?.name || ''}:${acc?.expiryDate || ''}:${acc?.displayUsername || acc?.username || ''}`;
}

function takeUniqueDashboardAccounts(accounts, shownKeys, limit) {
    const result = [];
    for (const acc of accounts || []) {
        const key = getDashboardAccountKey(acc);
        if (!key || shownKeys.has(key)) continue;
        shownKeys.add(key);
        result.push(acc);
        if (result.length >= limit) break;
    }
    return result;
}

// Trả về tài khoản vừa thêm (còn hiệu lực trong 2 phút) để hiện nổi bật ở đầu Tổng quan
function getJustAddedAccount(accounts = []) {
    const id = window.appState?.justAddedAccountId;
    const at = window.appState?.justAddedAt;
    if (!id || !at) return null;
    if (Date.now() - at > 2 * 60 * 1000) {
        window.appState.justAddedAccountId = null;
        window.appState.justAddedAt = null;
        return null;
    }
    return accounts.find(acc => acc.id === id) || null;
}

function isFreePlanAccount(acc) {
    const values = [
        acc?.planTag,
        acc?.plan,
        ...(Array.isArray(acc?.tags) ? acc.tags : []),
    ];
    return values.some(value => {
        const key = typeof normalizeTagKey === 'function'
            ? normalizeTagKey(value)
            : String(value || '').toLowerCase().trim();
        return key === 'free' || key.includes('free ');
    });
}

function isMutedAccountInQuickFilter(acc) {
    return acc?.status === 'expired' || isFreePlanAccount(acc);
}

function isDashboardSuggestionAccount(acc) {
    return acc?.status !== 'expired';
}

function accountMatchesPlatformQuickFilter(acc, platform) {
    if (!platform) return true;
    return (getResolvedPlatform(acc) || '') === platform;
}

function getQuickPlatformStats(accounts = []) {
    const map = new Map();
    accounts.forEach(acc => {
        if (!isDashboardSuggestionAccount(acc)) return;
        const platform = getResolvedPlatform(acc) || acc?.platform || '';
        if (!platform) return;
        if (!map.has(platform)) map.set(platform, { platform, count: 0, mutedCount: 0 });
        const item = map.get(platform);
        item.count += 1;
        if (isMutedAccountInQuickFilter(acc)) item.mutedCount += 1;
    });
    return [...map.values()].sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return getPlatformLabel(a.platform, []).localeCompare(getPlatformLabel(b.platform, []), 'vi');
    });
}

function getQuickTagStats(accounts = []) {
    const map = new Map();
    accounts.forEach(acc => {
        if (!isDashboardSuggestionAccount(acc)) return;
        (acc?.tags || []).forEach(tag => {
            if (!tag) return;
            const key = typeof normalizeTagKey === 'function' ? normalizeTagKey(tag) : String(tag).toLowerCase();
            if (!map.has(key)) map.set(key, { tag, count: 0 });
            map.get(key).count += 1;
        });
    });
    return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'vi'));
}

function renderQuickAccountIconFilter(accounts = window.appState?.accounts || []) {
    const el = document.getElementById('quick-platform-filter');
    if (!el) return '';
    const eligibleAccounts = (accounts || []).filter(isDashboardSuggestionAccount);
    const stats = getQuickPlatformStats(eligibleAccounts).slice(0, 24);
    const tagStats = getQuickTagStats(eligibleAccounts);
    if (!stats.length && !tagStats.length) {
        el.innerHTML = '';
        el.classList.remove('open');
        return '';
    }

    const active = window.appState.currentPlatformFilter || '';
    const activeTag = window.appState.currentTagFilter || '';
    const activeStat = stats.find(stat => stat.platform === active);
    const activeTagStat = tagStats.find(stat => {
        return typeof normalizeTagKey === 'function'
            ? normalizeTagKey(stat.tag) === normalizeTagKey(activeTag)
            : stat.tag === activeTag;
    });
    const activeLabel = activeStat ? getPlatformLabel(activeStat.platform, []) : '';
    const triggerStyle = activeStat && typeof getPlatformLogoStyle === 'function'
        ? getPlatformLogoStyle(activeStat.platform, activeLabel)
        : '';
    const triggerMark = activeStat && typeof renderPlatformLogoMark === 'function'
        ? renderPlatformLogoMark(activeStat.platform, getPlatformEmoji(activeStat.platform))
        : '';
    const triggerBadge = activeStat ? activeStat.count : activeTagStat ? activeTagStat.count : stats.length + tagStats.length;
    const triggerTitle = activeStat ? `${activeLabel} (${activeStat.count})` : activeTagStat ? `${activeTagStat.tag} (${activeTagStat.count})` : 'Loc nhanh theo dich vu va tag';
    const triggerIcon = activeStat
        ? `<span class="quick-platform-trigger-icon" style="${triggerStyle}">${triggerMark}</span>`
        : activeTagStat
            ? `<span class="quick-platform-trigger-default" aria-hidden="true">#</span>`
        : `<span class="quick-platform-trigger-default" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16l-6 7v5l-4 2v-7L4 5z"/></svg></span>`;

    let html = `<button type="button" class="quick-platform-trigger ${activeStat || activeTagStat ? 'has-active' : ''}" onclick="toggleQuickPlatformFilter(event)" title="${escapeHtml(triggerTitle)}" aria-haspopup="true" aria-expanded="${el.classList.contains('open') ? 'true' : 'false'}">
        ${triggerIcon}
        <span class="quick-platform-trigger-count">${triggerBadge}</span>
    </button>
    <div class="quick-platform-panel" role="menu">
    <button type="button" class="quick-platform-chip ${active || activeTag ? '' : 'active'}" onclick="setGlobalQuickFilter('', '')" title="Tat ca tai khoan" role="menuitem">
        <span class="quick-platform-chip-all">All</span>
        <span class="quick-platform-count">${eligibleAccounts.length}</span>
    </button>`;
    stats.forEach(stat => {
        const label = getPlatformLabel(stat.platform, []);
        const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(stat.platform, label) : '';
        const logoMark = typeof renderPlatformLogoMark === 'function'
            ? renderPlatformLogoMark(stat.platform, getPlatformEmoji(stat.platform))
            : getPlatformEmoji(stat.platform);
        const isActive = active === stat.platform;
        const isMuted = stat.mutedCount > 0 && stat.mutedCount === stat.count;
        html += `<button type="button" class="quick-platform-chip ${isActive ? 'active' : ''} ${isMuted ? 'muted' : ''}" onclick="setGlobalPlatformFilter('${escapeJsAttr(stat.platform)}')" title="${escapeHtml(label)} (${stat.count})" role="menuitem">
            <span class="quick-platform-icon" style="${logoStyle}">${logoMark}</span>
            <span class="quick-platform-count">${stat.count}</span>
        </button>`;
    });
    tagStats.forEach(stat => {
        const isActive = typeof normalizeTagKey === 'function'
            ? normalizeTagKey(activeTag) === normalizeTagKey(stat.tag)
            : activeTag === stat.tag;
        html += `<button type="button" class="quick-platform-chip ${isActive ? 'active' : ''}" onclick="setGlobalTagFilter('${escapeJsAttr(stat.tag)}')" title="${escapeHtml(stat.tag)} (${stat.count})" role="menuitem">
            <span class="quick-platform-chip-all">#</span>
            <span class="quick-platform-count">${stat.count}</span>
        </button>`;
    });
    html += `</div>`;
    el.innerHTML = html;
    return html;
}

function toggleQuickPlatformFilter(event) {
    event?.stopPropagation?.();
    const el = document.getElementById('quick-platform-filter');
    if (!el || !el.innerHTML.trim()) return;
    const nextOpen = !el.classList.contains('open');
    document.querySelectorAll('.quick-platform-filter.open').forEach(item => {
        if (item !== el) item.classList.remove('open');
    });
    el.classList.toggle('open', nextOpen);
    el.querySelector('.quick-platform-trigger')?.setAttribute('aria-expanded', String(nextOpen));
}

function closeQuickPlatformFilter() {
    document.querySelectorAll('.quick-platform-filter.open').forEach(el => {
        el.classList.remove('open');
        el.querySelector('.quick-platform-trigger')?.setAttribute('aria-expanded', 'false');
    });
}

document.addEventListener('click', event => {
    if (!event.target?.closest?.('#quick-platform-filter')) closeQuickPlatformFilter();
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeQuickPlatformFilter();
});

function renderQuickFilterResultHead(platform, accounts) {
    const label = getPlatformLabel(platform, accounts);
    const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platform, label) : '';
    const logoMark = typeof renderPlatformLogoMark === 'function'
        ? renderPlatformLogoMark(platform, getPlatformEmoji(platform))
        : getPlatformEmoji(platform);
    const mutedCount = accounts.filter(isMutedAccountInQuickFilter).length;
    const mutedText = mutedCount ? ` · ${mutedCount} tài khoản hết hạn/free đang mờ` : '';
    return `<div class="quick-filter-result-head anim-fade-in-up">
        <div class="quick-filter-result-title">
            <span class="quick-filter-result-icon" style="${logoStyle}">${logoMark}</span>
            <span>${escapeHtml(label)}<span class="quick-filter-result-meta">${accounts.length} tài khoản${mutedText}</span></span>
        </div>
        <button type="button" class="btn btn-sm btn-outline" onclick="setGlobalPlatformFilter('')">Xoá lọc</button>
    </div>`;
}

function getDashboardPlatformStats(accounts = []) {
    const platformMap = new Map();
    accounts.forEach(acc => {
        const platform = getResolvedPlatform(acc) || acc?.platform || '';
        if (!platform) return;
        platformMap.set(platform, (platformMap.get(platform) || 0) + 1);
    });
    return [...platformMap.entries()].sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return getPlatformLabel(a[0], []).localeCompare(getPlatformLabel(b[0], []), 'vi');
    });
}

function renderDashboardPlatformGrid(accounts = []) {
    if (!accounts.length) return '';

    const platformStats = getDashboardPlatformStats(accounts);
    const platformItems = platformStats.map(([platform, count]) => {
        const label = getPlatformLabel(platform, []);
        const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platform, label) : '';
        const logoMark = typeof renderPlatformLogoMark === 'function'
            ? renderPlatformLogoMark(platform, getPlatformEmoji(platform))
            : getPlatformEmoji(platform);
        return `<button type="button" class="platform-grid-item" onclick="setGlobalPlatformFilter('${escapeJsAttr(platform)}')" title="${escapeHtml(label)} - ${count} tài khoản">
            <span class="platform-grid-icon" style="${logoStyle}">${logoMark}</span>
            <span class="platform-grid-count">${count}</span>
            <span class="platform-grid-label">${escapeHtml(label)}</span>
        </button>`;
    }).join('');

    const addItem = `<button type="button" class="platform-grid-item platform-grid-add" onclick="openAddModal()" title="Thêm tài khoản mới">
        <span class="platform-grid-icon platform-grid-add-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </span>
        <span class="platform-grid-label">Thêm TK</span>
    </button>`;

    return `<div class="dashboard-platform-panel anim-fade-in-up">
        <div class="section-header"><span class="section-title">Nền tảng</span><span class="section-badge">${platformStats.length} dịch vụ</span></div>
        <div class="platform-icon-grid">${platformItems}${addItem}</div>
    </div>`;
}

// ===== RENDER: DASHBOARD =====
function renderDashboard() {
    const accounts = window.appState.accounts;
    const sortedAccounts = sortAccountsByPriority(accounts);
    const suggestionAccounts = sortedAccounts.filter(isDashboardSuggestionAccount);
    const platformFilter = window.appState.currentPlatformFilter || '';
    const total = accounts.length;
    const expiring = accounts.filter(a => a.status === 'expiring').length;
    const expired = accounts.filter(a => a.status === 'expired').length;
    const shownKeys = new Set();
    const expiringAccounts = takeUniqueDashboardAccounts(
        sortAccountsByPriority(accounts.filter(a => a.status === 'expiring' || a.status === 'expired')),
        shownKeys,
        5
    );
    const pinnedAccounts = takeUniqueDashboardAccounts(
        suggestionAccounts.filter(a => isAccountPinned(a)),
        shownKeys,
        5
    );
    const favoriteAccounts = takeUniqueDashboardAccounts(
        suggestionAccounts.filter(a => isAccountFavorite(a)),
        shownKeys,
        5
    );
    const recent = takeUniqueDashboardAccounts(suggestionAccounts, shownKeys, 5);

    const active = total - expiring - expired;
    let html = `
        ${platformFilter ? '' : renderDashboardPlatformGrid(suggestionAccounts)}
        <div class="summary-row-compact anim-stagger">
            <div class="summary-chip total anim-fade-in-up">
                <div class="summary-chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>
                <span class="summary-chip-num">${total}</span>
                <span class="summary-chip-label">Tổng</span>
            </div>
            <div class="summary-chip active-chip anim-fade-in-up">
                <div class="summary-chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                <span class="summary-chip-num">${active}</span>
                <span class="summary-chip-label">Hoạt động</span>
            </div>
            <div class="summary-chip expiring-chip anim-fade-in-up">
                <div class="summary-chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg></div>
                <span class="summary-chip-num">${expiring}</span>
                <span class="summary-chip-label">Sắp hết</span>
            </div>
            <div class="summary-chip expired-chip anim-fade-in-up">
                <div class="summary-chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
                <span class="summary-chip-num">${expired}</span>
                <span class="summary-chip-label">Hết hạn</span>
            </div>
        </div>`;

    if (platformFilter) {
        const matches = sortAccountsByPriority(accounts.filter(acc => isDashboardSuggestionAccount(acc) && accountMatchesPlatformQuickFilter(acc, platformFilter)));
        html += renderQuickFilterResultHead(platformFilter, matches);
        html += matches.length
            ? `<div class="account-list anim-stagger">${matches.map(acc => renderAccountCard(acc, acc.type === 'personal')).join('')}</div>`
            : `<div class="empty-state anim-fade-in-up"><div class="empty-state-icon">🔎</div><div class="empty-state-title">Không có tài khoản nào</div><div class="empty-state-desc">Thử chọn icon dịch vụ khác</div></div>`;
        document.getElementById('page-content').innerHTML = html;
        return;
    }

    const justAdded = typeof getJustAddedAccount === 'function' ? getJustAddedAccount(suggestionAccounts) : null;
    if (justAdded) {
        shownKeys.add(justAdded.id);
        html += `<div class="section-header just-added-header"><span class="section-title">✨ Vừa thêm</span><button type="button" class="just-added-dismiss" onclick="dismissJustAddedAccount()" aria-label="Ẩn">×</button></div>`;
        html += `<div class="account-list anim-stagger just-added-grid">${renderAccountCard(justAdded, justAdded.type === 'personal')}</div>`;
    }

    if (expiringAccounts.length > 0) {
        html += `
        <div class="alert-banner anim-fade-in-up">
            <span class="alert-banner-icon">⚠️</span>
            <span class="alert-banner-text"><strong>${expiringAccounts.length}</strong> tài khoản cần chú ý</span>
        </div>`;

        html += `<div class="section-header"><span class="section-title">Cần chú ý</span></div>`;
        html += `<div class="account-list anim-stagger">`;
        expiringAccounts.forEach(acc => { html += renderAccountCard(acc); });
        html += `</div>`;
    }

    if (pinnedAccounts.length > 0) {
        html += `<div class="section-header" style="margin-top:24px"><span class="section-title">Đã ghim</span><span class="section-badge">${pinnedAccounts.length} TK</span></div>`;
        html += `<div class="account-list anim-stagger">`;
        pinnedAccounts.forEach(acc => { html += renderAccountCard(acc); });
        html += `</div>`;
    }

    if (favoriteAccounts.length > 0) {
        html += `<div class="section-header" style="margin-top:24px"><span class="section-title">Yêu thích</span><span class="section-badge">${favoriteAccounts.length} TK</span></div>`;
        html += `<div class="account-list anim-stagger">`;
        favoriteAccounts.forEach(acc => { html += renderAccountCard(acc); });
        html += `</div>`;
    }

    if (recent.length > 0) {
        html += `<div class="section-header" style="margin-top:24px"><span class="section-title">Gần đây</span><span class="section-badge">${recent.length} TK</span></div>`;
        html += `<div class="account-list anim-stagger">`;
        recent.forEach(acc => { html += renderAccountCard(acc); });
        html += `</div>`;
    }

    if (total === 0) {
        html += `<div class="empty-state anim-fade-in-up"><div class="empty-state-icon">📋</div><div class="empty-state-title">Chưa có tài khoản nào</div><div class="empty-state-desc">Bấm nút + bên dưới để thêm tài khoản đầu tiên</div></div>`;
    }

    document.getElementById('page-content').innerHTML = html;
}

// ===== RENDER: CÀI ĐẶT =====
function renderSettings() {
    document.getElementById('page-content').innerHTML = `
    <div class="section-header"><span class="section-title">Cài đặt</span></div>

    <div class="settings-group">
        <div class="settings-group-title">Bảo mật</div>
        <div class="settings-card">
            <div class="settings-item" onclick="showToast('Chức năng sẽ có sau khi kết nối Firebase')">
                <div class="settings-item-icon" style="background:var(--accent-bg)">🔑</div>
                <div class="settings-item-content"><div class="settings-item-title">Đổi Master Password</div><div class="settings-item-desc">Bảo vệ tài khoản cá nhân</div></div>
                <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
            </div>
        </div>
    </div>

    <div class="settings-group">
        <div class="settings-group-title">Thông báo</div>
        <div class="settings-card">
            <div class="settings-item">
                <div class="settings-item-icon" style="background:var(--warning-bg)">🔔</div>
                <div class="settings-item-content"><div class="settings-item-title">Ngày báo trước</div><div class="settings-item-desc">5, 3, 1 ngày trước hết hạn</div></div>
                <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
            </div>
            <div class="settings-item">
                <div class="settings-item-icon" style="background:var(--success-bg)">📅</div>
                <div class="settings-item-content"><div class="settings-item-title">Gia hạn mặc định</div><div class="settings-item-desc">30 ngày</div></div>
                <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
            </div>
        </div>
    </div>

    <div class="settings-group">
        <div class="settings-group-title">Dữ liệu</div>
        <div class="settings-card">
            <div class="settings-item">
                <div class="settings-item-icon" style="background:#E0F2FE">📤</div>
                <div class="settings-item-content"><div class="settings-item-title">Xuất dữ liệu (JSON)</div><div class="settings-item-desc">Sao lưu tài khoản</div></div>
                <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
            </div>
            <div class="settings-item">
                <div class="settings-item-icon" style="background:#E0F2FE">📥</div>
                <div class="settings-item-content"><div class="settings-item-title">Nhập dữ liệu</div><div class="settings-item-desc">Khôi phục từ file JSON</div></div>
                <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
            </div>
        </div>
    </div>

    <div class="settings-group">
        <div class="settings-group-title">Tài khoản</div>
        <div class="settings-card">
            <div class="settings-item" onclick="signOut()">
                <div class="settings-item-icon" style="background:var(--danger-bg)">🚪</div>
                <div class="settings-item-content"><div class="settings-item-title" style="color:var(--danger)">Đăng xuất</div></div>
                <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
            </div>
        </div>
    </div>

    <p style="text-align:center;font-size:12px;color:var(--text-tertiary);margin-top:24px">Ting! v1.0 • Made with 💜</p>`;
}

// ===== MOBILE DESKTOP-PARITY RENDERERS =====
const AUTH_METHOD_CONFIG = {
    email: {
        label: 'Email',
        sublabel: 'Mật khẩu riêng',
        icon: '<svg class="auth-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 7l9 6 9-6"/></svg>',
    },
    google: {
        label: 'Google',
        sublabel: 'SSO',
        icon: '<span class="auth-icon-letter google">G</span>',
    },
    apple: {
        label: 'Apple',
        sublabel: 'SSO',
        icon: '<span class="auth-icon-letter apple">A</span>',
    },
    github: {
        label: 'GitHub',
        sublabel: 'SSO',
        icon: '<span class="auth-icon-letter github">GH</span>',
    },
    microsoft: {
        label: 'Microsoft',
        sublabel: 'SSO',
        icon: '<span class="auth-icon-letter microsoft">M</span>',
    },
    facebook: {
        label: 'Facebook',
        sublabel: 'SSO',
        icon: '<span class="auth-icon-letter facebook">f</span>',
    },
};
window.AUTH_METHOD_CONFIG = window.AUTH_METHOD_CONFIG || AUTH_METHOD_CONFIG;

function getAuthMethod(accOrMethod) {
    const value = typeof accOrMethod === 'string' ? accOrMethod : accOrMethod?.authMethod;
    const method = String(value || 'email').toLowerCase();
    return window.AUTH_METHOD_CONFIG[method] ? method : 'email';
}

function canShowSecretActions(acc) {
    return Boolean(acc);
}

function accountHasEncryptedOnly(acc) {
    return Boolean(acc?.encryptedData && acc?.salt && acc?.iv && !acc?.username && !acc?.password);
}

function accountNeedsMasterForDisplay(acc) {
    if (!acc) return false;
    const protectBought = Boolean(window.appState?.settings?.protectBoughtAccounts);
    return acc.type === 'personal'
        || acc.protectedByMasterPassword === true
        || (acc.type === 'bought' && protectBought)
        || accountHasEncryptedOnly(acc);
}

function getMaskedAccountUsername(acc) {
    const display = String(acc?.displayUsername || '').trim();
    if (display && display !== '******') return display;
    return maskUsername(acc?.username || acc?.name || '');
}

function getAccountUsernameForDisplay(acc) {
    if (accountNeedsMasterForDisplay(acc)) return getMaskedAccountUsername(acc);
    return String(acc?.username || '').trim()
        || String(acc?.displayUsername || '').trim()
        || getMaskedAccountUsername(acc);
}

function getAccountPasswordForDisplay(acc) {
    if (accountNeedsMasterForDisplay(acc)) return '******';
    return String(acc?.password || '').trim() || '******';
}

function renderEyeButton(accId, field, title = 'Hiện') {
    const acc = window.appState?.accounts?.find(item => item.id === accId);
    if (acc && !accountNeedsMasterForDisplay(acc)) return '';
    return `<button class="copy-btn" onclick="revealField('${escapeJsAttr(accId)}','${escapeJsAttr(field)}')" title="${escapeHtml(title)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg></button>`;
}

function renderCopyButton(accId, field, title = 'Copy') {
    return `<button class="copy-btn" onclick="copyField('${escapeJsAttr(accId)}','${escapeJsAttr(field)}')" title="${escapeHtml(title)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>`;
}

function renderAuthMethodIcon(method) {
    const config = window.AUTH_METHOD_CONFIG[getAuthMethod(method)] || window.AUTH_METHOD_CONFIG.email;
    return `<span class="auth-method-icon">${config.icon}</span>`;
}

function renderAuthMethodBadge(accOrMethod, options = {}) {
    const method = getAuthMethod(accOrMethod);
    if (method === 'email' && !options.includeEmail) return '';
    const config = window.AUTH_METHOD_CONFIG[method] || window.AUTH_METHOD_CONFIG.email;
    const className = options.className ? ` ${escapeHtml(options.className)}` : '';
    return `<span class="auth-method-badge${className}" data-method="${escapeHtml(method)}">${renderAuthMethodIcon(method)}<span>${escapeHtml(config.label)}</span></span>`;
}

function getLinkedAccount(acc) {
    const linkedId = acc?.linkedAccountId;
    if (!linkedId) return { account: null, status: 'deleted' };
    const active = (window.appState?.accounts || []).find(item => item.id === linkedId);
    if (active) return { account: active, status: 'active' };
    const trashed = (window.appState?.trashAccounts || []).find(item => item.id === linkedId);
    if (trashed) return { account: trashed, status: 'trashed' };
    return { account: null, status: 'deleted' };
}

function getLinkedServices(accId) {
    if (!accId) return [];
    return (window.appState?.accounts || []).filter(acc => acc.linkedAccountId === accId);
}

function renderAccountMiniLogo(acc, className = 'linked-service-logo') {
    const platformRef = getResolvedPlatform(acc) || acc?.platform || acc;
    const emoji = getPlatformEmoji(platformRef);
    const logoStyle = typeof getPlatformLogoStyle === 'function'
        ? getPlatformLogoStyle(platformRef, acc?.name || '')
        : `background:${stringToColor(acc?.name || platformRef)}15;color:${stringToColor(acc?.name || platformRef)}`;
    const logoMark = typeof renderPlatformLogoMark === 'function'
        ? renderPlatformLogoMark(platformRef, emoji)
        : emoji;
    return `<span class="${escapeHtml(className)}" style="${logoStyle}">${logoMark}</span>`;
}

function renderLinkedAccountWarning(acc) {
    const method = getAuthMethod(acc);
    if (method === 'email' || !acc?.linkedAccountId) return '';
    const linked = getLinkedAccount(acc);
    if (linked.status === 'active') return '';
    const provider = window.AUTH_METHOD_CONFIG[method]?.label || method;
    const message = linked.status === 'trashed'
        ? `TK gốc ${provider} đang ở thùng rác`
        : `TK gốc ${provider} đã bị xoá`;
    return `<div class="linked-warning" onclick="event.stopPropagation()">
        <span class="linked-warning-icon">!</span>
        <span>${escapeHtml(message)}</span>
    </div>`;
}

function renderAuthMethodInlineSelector(selected = 'email') {
    const current = getAuthMethod(selected);
    return `<div class="auth-method-inline">
        <span class="auth-method-inline-label">Đăng nhập:</span>
        <div class="auth-method-inline-options">
            ${Object.entries(window.AUTH_METHOD_CONFIG).map(([method, config]) => `
                <button type="button" class="auth-method-inline-btn ${method === current ? 'active' : ''}"
                    data-method="${escapeHtml(method)}"
                    onclick="selectAuthMethod('${escapeJsAttr(method)}')"
                    title="${escapeHtml(config.label)} (${escapeHtml(config.sublabel)})">
                    ${renderAuthMethodIcon(method)}
                </button>
            `).join('')}
        </div>
    </div>`;
}

function renderLinkedAccountPicker(authMethod) {
    const method = getAuthMethod(authMethod);
    if (method === 'email') return '';
    const config = window.AUTH_METHOD_CONFIG[method] || window.AUTH_METHOD_CONFIG.email;
    const selectedId = window.appState?.addFormLinkedId || '';
    const options = typeof getLinkedAccountOptions === 'function' ? getLinkedAccountOptions(method) : [];
    if (!options.length) {
        return `<div class="linked-account-picker">
            <div class="linked-account-empty">
                Chưa có TK ${escapeHtml(config.label)} cá nhân phù hợp
                <button type="button" class="btn btn-sm btn-outline" onclick="openLinkedPersonalAccount('${escapeJsAttr(method)}')">Thêm TK ${escapeHtml(config.label)}</button>
            </div>
        </div>`;
    }
    return `<div class="linked-account-picker">
        ${options.map(acc => {
            const selected = selectedId === acc.id;
            return `<label class="linked-account-option ${selected ? 'selected' : ''}" onclick="selectLinkedAccount('${escapeJsAttr(acc.id)}')">
                <input type="radio" name="linked-account-id" value="${escapeHtml(acc.id)}" ${selected ? 'checked' : ''}>
                ${renderAccountMiniLogo(acc, 'linked-service-logo')}
                <span class="linked-option-info">
                    <span class="linked-option-name">${escapeHtml(acc.name)}</span>
                    <span class="linked-option-email">${escapeHtml(getAccountUsernameForDisplay(acc))}</span>
                </span>
            </label>`;
        }).join('')}
    </div>`;
}

function renderPlatformPickerIcon(platform, label) {
    const style = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platform, label) : '';
    const mark = typeof renderPlatformLogoMark === 'function'
        ? renderPlatformLogoMark(platform, getPlatformEmoji(platform))
        : getPlatformEmoji(platform);
    return `<span class="platform-picker-icon" style="${style}">${mark}</span>`;
}

function renderPlatformPickerButton(platform) {
    return `<button type="button" class="platform-picker-item" data-platform="${escapeJsAttr(platform.id)}" onclick="selectPlatformFromPicker('${escapeJsAttr(platform.id)}','${escapeJsAttr(platform.name)}')">
        ${renderPlatformPickerIcon(platform.id, platform.name)}
        <span>${escapeHtml(platform.name)}</span>
    </button>`;
}

function renderTagFilterRow(accounts) {
    const tags = typeof getAllAccountTags === 'function' ? getAllAccountTags(accounts) : [];
    if (!tags.length) return '';
    const active = window.appState.currentTagFilter || '';
    const chips = tags.map(tag => {
        const isActive = typeof normalizeTagKey === 'function'
            ? normalizeTagKey(active) === normalizeTagKey(tag)
            : active === tag;
        return `<button type="button" class="tag-filter-chip ${isActive ? 'active' : ''}" onclick="setTagFilter('${escapeJsAttr(tag)}')">${escapeHtml(tag)}</button>`;
    }).join('');
    return `<div class="tag-filter-row">
        <button type="button" class="tag-filter-chip ${active ? '' : 'active'}" onclick="setTagFilter('')">Tất cả gói</button>
        ${chips}
    </div>`;
}

// ===== FILTER PANEL & PLATFORM QUICK FILTER =====
function renderFilterPanel(accounts) {
    const filter = window.appState.currentFilter || 'all';
    const tagFilter = window.appState.currentTagFilter || '';
    const tags = typeof getAllAccountTags === 'function' ? getAllAccountTags(accounts) : [];
    let html = `<div class="filter-panel-section">
        <div class="filter-panel-label">Trạng thái</div>
        <div class="filter-chip-row">
            <button class="filter-chip ${filter==='all'?'active':''}" onclick="setFilter('all')">Tất cả</button>
            <button class="filter-chip ${filter==='active'?'active':''}" onclick="setFilter('active')">Hoạt động</button>
            <button class="filter-chip ${filter==='expiring'?'active':''}" onclick="setFilter('expiring')">Sắp hết</button>
            <button class="filter-chip ${filter==='expired'?'active':''}" onclick="setFilter('expired')">Đã hết</button>
            <button class="filter-chip ${filter==='favorite'?'active':''}" onclick="setFilter('favorite')">⭐ Yêu thích</button>
        </div>
    </div>`;
    if (tags.length) {
        html += `<div class="filter-panel-section">
            <div class="filter-panel-label">Gói / Tag</div>
            <div class="filter-chip-row">
                <button class="filter-chip ${tagFilter?'':'active'}" onclick="setTagFilter('')">Tất cả</button>
                ${tags.map(tag => {
                    const isActive = typeof normalizeTagKey === 'function'
                        ? normalizeTagKey(tagFilter) === normalizeTagKey(tag)
                        : tagFilter === tag;
                    return `<button class="filter-chip ${isActive ? 'active' : ''}" onclick="setTagFilter('${escapeJsAttr(tag)}')">${escapeHtml(tag)}</button>`;
                }).join('')}
            </div>
        </div>`;
    }
    return html;
}

function renderPlatformQuickFilter(accounts) {
    const platformMap = new Map();
    accounts.forEach(acc => {
        const key = getResolvedPlatform(acc) || '';
        if (!key) return;
        if (!platformMap.has(key)) platformMap.set(key, 0);
        platformMap.set(key, platformMap.get(key) + 1);
    });
    if (!platformMap.size) return '<div class="platform-filter-empty">Chưa có nền tảng nào</div>';
    const activePlatform = window.appState.currentPlatformFilter || '';
    const sorted = [...platformMap.entries()].sort((a, b) => b[1] - a[1]);
    let html = `<div class="platform-filter-grid">`;
    html += `<button class="platform-filter-item ${!activePlatform ? 'active' : ''}" onclick="setPlatformFilter('')">
        <span class="platform-filter-icon-all">✦</span>
        <span>Tất cả</span>
    </button>`;
    sorted.forEach(([platform, count]) => {
        const isActive = activePlatform === platform;
        const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platform, platform) : '';
        const logoMark = typeof renderPlatformLogoMark === 'function'
            ? renderPlatformLogoMark(platform, getPlatformEmoji(platform))
            : getPlatformEmoji(platform);
        const label = getPlatformLabel(platform, []);
        html += `<button class="platform-filter-item ${isActive ? 'active' : ''}" onclick="setPlatformFilter('${escapeJsAttr(platform)}')">
            <span class="platform-filter-icon" style="${logoStyle}">${logoMark}</span>
            <span class="platform-filter-name">${escapeHtml(label)}</span>
            <span class="platform-filter-count">${count}</span>
        </button>`;
    });
    html += `</div>`;
    return html;
}

function getActiveFilterLabel(filter, tagFilter, platformFilter) {
    const parts = [];
    if (filter === 'active') parts.push('Hoạt động');
    else if (filter === 'expiring') parts.push('Sắp hết');
    else if (filter === 'expired') parts.push('Đã hết');
    else if (filter === 'favorite') parts.push('⭐ Yêu thích');
    if (tagFilter) parts.push(tagFilter);
    if (platformFilter) parts.push(getPlatformLabel(platformFilter, []));
    return parts.length ? `<span class="active-filter-tags">${parts.map(p => `<span class="active-filter-tag">${escapeHtml(p)}</span>`).join('')}</span>` : '';
}

function toggleFilterPanel() {
    const panel = document.getElementById('filter-panel');
    const platformPanel = document.getElementById('platform-panel');
    if (!panel) return;
    if (platformPanel) platformPanel.style.display = 'none';
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

function togglePlatformPanel() {
    const panel = document.getElementById('platform-panel');
    const filterPanel = document.getElementById('filter-panel');
    if (!panel) return;
    if (filterPanel) filterPanel.style.display = 'none';
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

function clearAllFilters() {
    window.appState.currentFilter = 'all';
    window.appState.currentTagFilter = '';
    window.appState.currentPlatformFilter = '';
    window.appState.expandedGroups = {};
    const page = window.appState.currentPage;
    if (page === 'bought') renderAccountList('bought');
    else if (page === 'personal') renderAccountList('personal');
    else if (page === 'dashboard') renderDashboard();
    renderQuickAccountIconFilter?.();
}

function renderAccountList(type) {
    const accounts = window.appState.accounts.filter(a => a.type === type);
    const filter = window.appState.currentFilter || 'all';
    const tagFilter = window.appState.currentTagFilter || '';
    const platformFilter = window.appState.currentPlatformFilter || '';
    const search = window.appState.searchQuery || '';
    let filtered = accounts;
    if (filter === 'favorite') filtered = filtered.filter(a => isAccountFavorite(a));
    else if (filter !== 'all') filtered = filtered.filter(a => a.status === filter);
    if (tagFilter && typeof accountMatchesTag === 'function') filtered = filtered.filter(a => accountMatchesTag(a, tagFilter));
    if (platformFilter) filtered = filtered.filter(a => (getResolvedPlatform(a) || '') === platformFilter);
    if (search) filtered = filtered.filter(a => typeof accountMatchesSearch === 'function' ? accountMatchesSearch(a, search) : (a.name || '').toLowerCase().includes(search.toLowerCase()));

    const title = type === 'bought' ? 'Tài khoản mua' : 'Tài khoản cá nhân';
    const hasActiveFilter = filter !== 'all' || tagFilter || platformFilter;
    const filterLabel = getActiveFilterLabel(filter, tagFilter, platformFilter);
    let html = `
        <div class="list-toolbar">
            <div class="list-toolbar-left">
                <span class="section-title">${title}</span>
                <span class="section-badge">${filtered.length}</span>
            </div>
            <div class="list-toolbar-right">
                <button class="toolbar-filter-btn ${hasActiveFilter ? 'has-filter' : ''}" onclick="toggleFilterPanel()" title="Lọc">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                    ${hasActiveFilter ? `<span class="toolbar-filter-dot"></span>` : ''}
                </button>
                <button class="toolbar-platform-btn" onclick="togglePlatformPanel()" title="Lọc nền tảng">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                    ${platformFilter ? `<span class="toolbar-filter-dot"></span>` : ''}
                </button>
            </div>
        </div>
        ${hasActiveFilter ? `<div class="active-filter-bar">${filterLabel}<button class="active-filter-clear" onclick="clearAllFilters()">✕ Xoá lọc</button></div>` : ''}
        <div id="filter-panel" class="filter-panel" style="display:none">${renderFilterPanel(accounts)}</div>
        <div id="platform-panel" class="platform-panel" style="display:none">${renderPlatformQuickFilter(accounts)}</div>`;

    if (filtered.length > 0) {
        html += `<div class="account-list anim-stagger">`;
        buildAccountDisplayItems(filtered).forEach(item => {
            html += item.accounts ? renderAccountGroup(item, type === 'personal') : renderAccountCard(item, type === 'personal');
        });
        html += `</div>`;
    } else {
        const emptyIcon = type === 'personal' ? '🔒' : '🛒';
        html += `<div class="empty-state anim-fade-in-up"><div class="empty-state-icon">${emptyIcon}</div><div class="empty-state-title">Không có tài khoản nào</div><div class="empty-state-desc">${hasActiveFilter ? 'Thử đổi bộ lọc khác' : 'Bấm + để thêm mới'}</div></div>`;
    }
    document.getElementById('page-content').innerHTML = html;
}

function renderAccountGroup(group, isPersonal = false) {
    const accounts = group.accounts;
    const label = getPlatformLabel(group.platform, accounts);
    const emoji = getPlatformEmoji(group.platform);
    const logoStyle = typeof getPlatformLogoStyle === 'function'
        ? getPlatformLogoStyle(group.platform, label)
        : `background:${stringToColor(label)}20;color:${stringToColor(label)}`;
    const logoMark = typeof renderPlatformLogoMark === 'function' ? renderPlatformLogoMark(group.platform, emoji) : emoji;
    const status = getWorstGroupStatus(accounts);
    const expanded = Boolean(window.appState.expandedGroups?.[group.key]);
    const activeCount = accounts.filter(a => a.status === 'active').length;
    const expiringCount = accounts.filter(a => a.status === 'expiring').length;
    const expiredCount = accounts.filter(a => a.status === 'expired').length;
    const summaryParts = [];
    if (activeCount) summaryParts.push(`${activeCount} hoạt động`);
    if (expiringCount) summaryParts.push(`${expiringCount} sắp hết`);
    if (expiredCount) summaryParts.push(`${expiredCount} hết hạn`);
    return `
    <div class="account-group anim-fade-in-up">
        <button class="account-group-header" onclick="toggleAccountGroup('${escapeJsAttr(group.key)}')">
            <div class="account-logo group-logo" style="${logoStyle}">${logoMark}</div>
            <div class="account-group-info">
                <div class="account-group-title">${escapeHtml(label)} <span class="account-group-count">${accounts.length} TK</span></div>
                <div class="account-group-meta">${escapeHtml(summaryParts.join(' · ') || 'Không có trạng thái')}</div>
                <div class="account-group-meta">${escapeHtml(getGroupExpirySummary(accounts))}</div>
            </div>
            <span class="account-badge ${getStatusBadgeClass(status)}">${getStatusText(status)}</span>
            <span class="account-group-chevron ${expanded ? 'open' : ''}">⌄</span>
        </button>
        ${expanded ? `<div class="account-group-children">${accounts.map(acc => renderAccountCard(acc, isPersonal, true)).join('')}</div>` : ''}
    </div>`;
}

function renderAccountCard(acc, isPersonal = false, isChild = false) {
    const days = daysUntil(acc.expiryDate);
    const daysText = acc.expiryType === 'lifetime' ? 'Vĩnh viễn' : days < 0 ? `Hết ${Math.abs(days)} ngày` : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`;
    const platformRef = getResolvedPlatform(acc) || acc.platform || acc;
    const emoji = getPlatformEmoji(platformRef);
    const logoStyle = typeof getPlatformLogoStyle === 'function'
        ? getPlatformLogoStyle(platformRef, acc.name)
        : `background:${stringToColor(acc.name)}20;color:${stringToColor(acc.name)}`;
    const logoMark = typeof renderPlatformLogoMark === 'function' ? renderPlatformLogoMark(platformRef, emoji) : emoji;
    const statusClass = getStatusBadgeClass(acc.status);
    const statusText = getStatusText(acc.status);
    const mutedClass = isMutedAccountInQuickFilter(acc) ? 'is-muted-account' : '';
    const authBadge = renderAuthMethodBadge(acc);
    return `
    <div class="account-card ${isChild ? 'account-child-card' : ''} ${acc.pendingSync ? 'sync-pending' : ''} ${isAccountFavorite(acc) ? 'is-favorite' : ''} ${isAccountPinned(acc) ? 'is-pinned' : ''} ${mutedClass} anim-fade-in-up" onclick="showDetail('${escapeJsAttr(acc.id)}')">
        <div class="account-card-top">
            <div class="account-logo" style="${logoStyle}">${logoMark}</div>
            <div class="account-info">
                <div class="account-name">${escapeHtml(typeof getAccountDisplayName === 'function' ? getAccountDisplayName(acc) : acc.name)}</div>
                <div class="account-user">${escapeHtml(getAccountUsernameForDisplay(acc))}</div>
                ${typeof renderAccountTags === 'function' ? renderAccountTags(acc.tags, { limit: 3, className: 'card-tags' }) : ''}
                ${renderAccountCategoryChips(acc, { limit: 2, className: 'card-categories' })}
                ${authBadge ? `<div class="account-auth-row">${authBadge}</div>` : ''}
                ${renderPreferenceMarkers(acc)}
            </div>
            ${acc.pendingSync ? '<span class="sync-pending-badge">Chờ sync</span>' : ''}
            <span class="account-badge ${statusClass}">${statusText}</span>
        </div>
        ${renderLinkedAccountWarning(acc)}
        <div class="account-card-bottom">
            <span class="account-days">${acc.expiryType === 'lifetime' ? '∞ Vĩnh viễn' : daysText}</span>
            <div class="account-actions" onclick="event.stopPropagation()">
                ${renderPinButton(acc)}
                ${renderFavoriteButton(acc)}
                ${renderCopyButton(acc.id, 'username', 'Copy tài khoản')}
                ${renderCopyButton(acc.id, 'password', 'Copy mật khẩu')}
            </div>
        </div>
        ${accountNeedsMasterForDisplay(acc) ? '<span class="lock-icon">🔒</span>' : ''}
    </div>`;
}

function renderAccountCategoryChips(acc, options = {}) {
    const categories = typeof getSortedCategories === 'function' ? getSortedCategories() : [];
    const ids = typeof getAccountCategoryIds === 'function' ? getAccountCategoryIds(acc) : (acc?.categoryIds || []);
    const values = ids.map(id => categories.find(category => category.id === id)).filter(Boolean);
    if (!values.length) return '';
    const limit = options.limit ?? values.length;
    const visible = values.slice(0, limit);
    const extra = values.length - visible.length;
    return `<div class="account-category-row ${options.className || ''}">
        ${visible.map(category => `<span class="account-category-chip" style="--category-color:${getSafeCategoryColor(category.color)}">${renderCategoryIcon(category, 'mini')} ${escapeHtml(category.name)}</span>`).join('')}
        ${extra > 0 ? `<span class="account-category-chip muted">+${extra}</span>` : ''}
    </div>`;
}

const CATEGORY_SVG_ICONS = {
    folder: '<path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2"/>',
    building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 8h2a2 2 0 0 1 2 2v11"/><path d="M8 7h4M8 11h4M8 15h4M3 21h18"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h3l3 12h10l3-8H6"/>',
};

function getCategoryIconId(icon) {
    return CATEGORY_SVG_ICONS[icon] ? icon : 'folder';
}

function getSafeCategoryColor(color) {
    return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? color : '#6C5CE7';
}

function renderCategoryIconSvg(icon) {
    const path = CATEGORY_SVG_ICONS[getCategoryIconId(icon)] || CATEGORY_SVG_ICONS.folder;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

function selectCategoryIcon(iconId) {
    const input = document.getElementById('category-icon');
    if (input) input.value = getCategoryIconId(iconId);
    document.querySelectorAll('.category-icon-option').forEach(btn => btn.classList.toggle('active', btn.dataset.icon === iconId));
}

function renderCategoryIcon(category, className = '') {
    return `<span class="category-icon ${className}" style="--category-color:${getSafeCategoryColor(category?.color)}">${renderCategoryIconSvg(category?.icon)}</span>`;
}

function renderCategoryPicker(selectedIds = []) {
    const categories = typeof getSortedCategories === 'function' ? getSortedCategories() : [];
    if (!categories.length) return `<div class="category-picker-empty">Chưa có danh mục. Bạn có thể tạo nhanh bên dưới.</div>`;
    const selected = new Set(selectedIds || []);
    return `<div class="category-picker-grid">${categories.map(category => `
        <label class="category-picker-chip ${selected.has(category.id) ? 'active' : ''}">
            <input type="checkbox" name="add-category-id" value="${escapeJsAttr(category.id)}" ${selected.has(category.id) ? 'checked' : ''} onchange="this.closest('.category-picker-chip')?.classList.toggle('active', this.checked)">
            ${renderCategoryIcon(category)}
            <span class="category-picker-name">${escapeHtml(category.name)}</span>
        </label>
    `).join('')}</div>`;
}

function renderCategoriesPage() {
    const query = window.appState.searchQuery || '';
    const categories = typeof getSortedCategories === 'function' ? getSortedCategories() : [];
    const filtered = query
        ? categories.filter(category => (typeof normalizeSearchText === 'function' ? normalizeSearchText(category.name).includes(normalizeSearchText(query)) : category.name.toLowerCase().includes(query.toLowerCase())))
        : categories;
    const content = filtered.length
        ? `<div class="category-grid anim-stagger">${filtered.map(renderCategoryCard).join('')}</div>`
        : `<div class="empty-state anim-fade-in-up"><div class="empty-state-icon">📁</div><div class="empty-state-title">Chưa có danh mục</div><div class="empty-state-desc">Tạo danh mục để gom tài khoản theo công ty, dự án hoặc nhóm.</div></div>`;
    document.getElementById('page-content').innerHTML = `
        <div class="category-page-head anim-fade-in-up">
            <div>
                <div class="section-title">Danh mục</div>
                <div class="category-page-desc">Gom tài khoản theo công ty, dự án, gia đình hoặc nhóm công việc.</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="openCategoryForm()">Thêm</button>
        </div>
        ${content}`;
}

function renderCategoryCard(category) {
    const accounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(category.id) : [];
    const previewLabels = [...new Set(accounts.map(acc => {
        const platform = getResolvedPlatform(acc) || acc.platform || '';
        return platform ? getPlatformLabel(platform, [acc]) : (acc.name || '');
    }).filter(Boolean))];
    const preview = previewLabels.slice(0, 3).map(label => escapeHtml(label)).join(', ');
    return `<div class="category-card anim-fade-in-up" onclick="navigateTo('category:${escapeJsAttr(category.id)}')">
        <div class="category-card-top">
            ${renderCategoryIcon(category, 'large')}
            <div class="category-card-title-wrap">
                <div class="category-card-title">${escapeHtml(category.name)}</div>
                <div class="category-card-meta">${accounts.length} tài khoản</div>
            </div>
        </div>
        <div class="category-card-preview">${preview || 'Chưa gắn tài khoản nào'}</div>
        <div class="category-card-actions" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-outline" onclick="openCategoryForm('${escapeJsAttr(category.id)}')">Sửa</button>
            <button class="btn btn-sm btn-danger-outline" onclick="deleteCategory('${escapeJsAttr(category.id)}')">Xoá</button>
        </div>
    </div>`;
}

function renderCategoryDetail(categoryId) {
    const category = typeof getCategoryById === 'function' ? getCategoryById(categoryId) : null;
    if (!category) { renderCategoriesPage(); return; }
    const search = window.appState.searchQuery || '';
    const filter = window.appState.currentFilter || 'all';
    const tagFilter = window.appState.currentTagFilter || '';
    let accounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(categoryId) : [];
    if (filter === 'favorite') accounts = accounts.filter(acc => isAccountFavorite(acc));
    else if (filter !== 'all') accounts = accounts.filter(acc => acc.status === filter);
    if (tagFilter && typeof accountMatchesTag === 'function') accounts = accounts.filter(acc => accountMatchesTag(acc, tagFilter));
    if (search) accounts = accounts.filter(acc => typeof accountMatchesSearch === 'function' ? accountMatchesSearch(acc, search) : (acc.name || '').toLowerCase().includes(search.toLowerCase()));
    const list = accounts.length
        ? `<div class="account-list anim-stagger">${buildAccountDisplayItems(accounts).map(item => item.accounts ? renderAccountGroup(item) : renderAccountCard(item)).join('')}</div>`
        : `<div class="empty-state anim-fade-in-up"><div class="empty-state-icon">📁</div><div class="empty-state-title">Không có tài khoản trong danh mục</div><div class="empty-state-desc">Gắn tài khoản vào danh mục khi thêm mới hoặc trong trang chi tiết.</div></div>`;
    document.getElementById('page-content').innerHTML = `
        <button class="back-btn" onclick="navigateTo('categories')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg> Danh mục</button>
        <div class="category-detail-head anim-fade-in-up">
            ${renderCategoryIcon(category, 'large')}
            <div>
                <div class="section-title">${escapeHtml(category.name)}</div>
                <div class="category-page-desc">${accounts.length} tài khoản đang hiển thị</div>
            </div>
            <button class="btn btn-sm btn-outline" onclick="openCategoryForm('${escapeJsAttr(category.id)}')">Sửa</button>
        </div>
        <div class="filter-tabs">
            <button class="filter-tab ${filter==='all'?'active':''}" onclick="setFilter('all')">Tất cả</button>
            <button class="filter-tab ${filter==='active'?'active':''}" onclick="setFilter('active')">Hoạt động</button>
            <button class="filter-tab ${filter==='expiring'?'active':''}" onclick="setFilter('expiring')">Sắp hết</button>
            <button class="filter-tab ${filter==='expired'?'active':''}" onclick="setFilter('expired')">Đã hết</button>
            <button class="filter-tab ${filter==='favorite'?'active':''}" onclick="setFilter('favorite')">Yêu thích</button>
        </div>
        ${list}`;
}

function renderCategoryIconOptions(selectedIcon, color) {
    const activeIcon = getCategoryIconId(selectedIcon);
    const labels = { folder: 'Thư mục', building: 'Công ty', briefcase: 'Công việc', users: 'Nhóm', sparkles: 'AI', lock: 'Bảo mật', cart: 'Mua sắm' };
    return `<div class="category-icon-grid" style="--category-color:${getSafeCategoryColor(color)}">
        ${Object.keys(CATEGORY_SVG_ICONS).map(iconId => `
            <button type="button" class="category-icon-option ${iconId === activeIcon ? 'active' : ''}" data-icon="${escapeJsAttr(iconId)}" onclick="selectCategoryIcon('${escapeJsAttr(iconId)}')" title="${escapeHtml(labels[iconId] || iconId)}">
                ${renderCategoryIconSvg(iconId)}
                <span>${escapeHtml(labels[iconId] || iconId)}</span>
            </button>
        `).join('')}
    </div>`;
}

function renderCategoryForm(category = null) {
    const iconId = getCategoryIconId(category?.icon);
    const color = getSafeCategoryColor(category?.color);
    return `<div class="form-section-title">Tên danh mục</div>
    <input type="text" id="category-name" class="input" placeholder="VD: Công ty ShineOn" value="${escapeHtml(category?.name || '')}" style="padding-left:16px">
    <input type="hidden" id="category-icon" value="${escapeHtml(iconId)}">
    <div class="form-section-title">Biểu tượng</div>
    ${renderCategoryIconOptions(iconId, color)}
    <div class="form-section-title">Màu</div>
    <input type="color" id="category-color" class="input category-color-input" value="${color}">
    <button class="btn btn-primary" style="margin-top:18px" onclick="saveCategory('${escapeJsAttr(category?.id || '')}')">Lưu danh mục</button>`;
}

function renderAccountCategoryForm(acc) {
    return `<div class="form-section-title">Danh mục</div>
    ${renderCategoryPicker(typeof getAccountCategoryIds === 'function' ? getAccountCategoryIds(acc) : acc.categoryIds)}
    <button class="btn btn-primary" style="margin-top:18px" onclick="saveAccountCategories('${escapeJsAttr(acc.id)}')">Lưu danh mục</button>`;
}

function getTrashDeletedDate(acc) {
    const value = acc?.deletedAt;
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getTrashDaysLeft(acc) {
    const deletedDate = getTrashDeletedDate(acc);
    if (!deletedDate) return 30;
    const deadline = new Date(deletedDate);
    deadline.setDate(deadline.getDate() + 30);
    const today = new Date();
    today.setHours(0,0,0,0);
    deadline.setHours(0,0,0,0);
    return Math.max(0, Math.ceil((deadline - today) / (1000 * 60 * 60 * 24)));
}

function renderTrashList() {
    const query = window.appState.searchQuery || '';
    const all = window.appState.trashAccounts || [];
    const items = query
        ? all.filter(acc => typeof accountMatchesSearch === 'function' ? accountMatchesSearch(acc, query) : (acc.name || '').toLowerCase().includes(query.toLowerCase()))
        : all;
    const cards = items.length
        ? `<div class="account-list anim-stagger">${items.map(renderTrashCard).join('')}</div>`
        : `<div class="empty-state anim-fade-in-up"><div class="empty-state-icon">🗑️</div><div class="empty-state-title">Thùng rác trống</div><div class="empty-state-desc">Tài khoản xoá mềm sẽ xuất hiện ở đây để khôi phục.</div></div>`;
    document.getElementById('page-content').innerHTML = `
        <div class="trash-page-head anim-fade-in-up">
            <div>
                <div class="section-title">Thùng rác 30 ngày</div>
                <div class="trash-page-desc">Tài khoản đã xoá mềm vẫn nằm ở đây để khôi phục lại khi cần.</div>
            </div>
            <span class="section-badge">${items.length}/${all.length} TK</span>
        </div>
        ${cards}`;
}

function renderTrashCard(acc) {
    const platformRef = getResolvedPlatform(acc) || acc.platform || acc;
    const emoji = getPlatformEmoji(platformRef);
    const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platformRef, acc.name) : `background:${stringToColor(acc.name)}15;color:${stringToColor(acc.name)}`;
    const logoMark = typeof renderPlatformLogoMark === 'function' ? renderPlatformLogoMark(platformRef, emoji) : emoji;
    const deletedDate = getTrashDeletedDate(acc);
    const deletedText = deletedDate ? formatDateVN(deletedDate) : 'Không rõ ngày xoá';
    const daysLeft = getTrashDaysLeft(acc);
    return `<div class="account-card trash-card anim-fade-in-up">
        <div class="account-card-top">
            <div class="account-logo" style="${logoStyle}">${logoMark}</div>
            <div class="account-info">
                <div class="account-name">${escapeHtml(acc.name)}</div>
                <div class="account-user">${escapeHtml(getAccountUsernameForDisplay(acc))}</div>
                ${typeof renderAccountTags === 'function' ? renderAccountTags(acc.tags, { limit: 3, className: 'card-tags' }) : ''}
                ${renderAccountCategoryChips(acc, { limit: 2, className: 'card-categories' })}
            </div>
            <span class="account-badge badge-expired">Đã xoá</span>
        </div>
        <div class="account-card-bottom trash-card-bottom">
            <span class="trash-countdown">Xoá mềm ${escapeHtml(deletedText)} · còn ${daysLeft} ngày giữ</span>
            <div class="account-actions" onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-outline" onclick="restoreAccount('${escapeJsAttr(acc.id)}')">Khôi phục</button>
            </div>
        </div>
    </div>`;
}

function renderDetail(accId) {
    const acc = window.appState.accounts.find(a => a.id === accId);
    if (!acc) return;
    const days = daysUntil(acc.expiryDate);
    const platformRef = getResolvedPlatform(acc) || acc.platform || acc;
    const emoji = getPlatformEmoji(platformRef);
    const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platformRef, acc.name) : `background:${stringToColor(acc.name)}15;color:${stringToColor(acc.name)}`;
    const logoMark = typeof renderPlatformLogoMark === 'function' ? renderPlatformLogoMark(platformRef, emoji) : emoji;
    const decrypted = window.appState.activeDecryptedAccount?.id === accId ? window.appState.activeDecryptedAccount.data : null;
    const needsMaster = accountNeedsMasterForDisplay(acc);
    const revealedUsername = getRevealedSecret?.(accId, 'username');
    const revealedPassword = getRevealedSecret?.(accId, 'password');
    const revealedTwoFa = getRevealedSecret?.(accId, 'twoFaCode');
    const usernameText = revealedUsername || (needsMaster ? getMaskedAccountUsername(acc) : (decrypted?.username || getAccountUsernameForDisplay(acc)));
    const passwordText = getAuthMethod(acc) !== 'email'
        ? getSsoPasswordMessage(acc)
        : (revealedPassword || (needsMaster ? '******' : (decrypted?.password || getAccountPasswordForDisplay(acc))));
    const twoFaText = revealedTwoFa || (needsMaster ? '******' : (decrypted?.twoFaCode || acc.twoFaCode || '******'));
    const noteText = decrypted?.note || acc.note || '';
    const hasTwoFa = Boolean(decrypted?.twoFaCode || acc.twoFaCode);
    const twoFaSecret = decrypted?.twoFaCode || (!needsMaster ? (acc.twoFaCode || '') : (revealedTwoFa || ''));
    const twoFaIsTotp = Boolean(hasTwoFa && twoFaSecret && typeof isLikelyTotpSecret === 'function' && isLikelyTotpSecret(twoFaSecret));
    const authBadge = renderAuthMethodBadge(acc, { includeEmail: true });
    const sellerRow = renderSellerDetailRow(acc);
    document.getElementById('page-content').innerHTML = `
    <button class="back-btn" onclick="goBack()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>
        Quay lại
    </button>
    <div class="detail-header anim-fade-in-up">
        <div class="detail-logo" style="${logoStyle}">${logoMark}</div>
        <div>
            <div class="detail-name">${escapeHtml(acc.name)}</div>
            <span class="account-badge ${getStatusBadgeClass(acc.status)}">${getStatusText(acc.status)}</span>
        </div>
        <div class="detail-pref-actions" onclick="event.stopPropagation()">${renderPinButton(acc)}${renderFavoriteButton(acc)}</div>
    </div>
    <div class="detail-meta-lines">
        ${authBadge ? `<div class="account-auth-row">${authBadge}</div>` : ''}
        ${typeof renderAccountTags === 'function' ? renderAccountTags(acc.tags, { limit: 12, className: 'detail-tags' }) : ''}
        <div class="detail-category-line">
            ${renderAccountCategoryChips(acc, { limit: 8, className: 'detail-categories' }) || '<span class="tag-empty-hint">Chưa gắn danh mục</span>'}
            <button type="button" class="btn btn-sm btn-outline detail-tag-edit" onclick="openAccountCategoryEditor('${escapeJsAttr(acc.id)}')">Sửa danh mục</button>
        </div>
    </div>
    ${renderLinkedAccountWarning(acc)}
    <div class="detail-section anim-fade-in-up">
        <div class="detail-row">
            <span class="detail-label">Tài khoản</span>
            <span class="detail-value secret-value">${escapeHtml(usernameText)} ${renderEyeButton(acc.id, 'username', 'Hiện tài khoản')} ${renderCopyButton(acc.id, 'username', 'Copy tài khoản')}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Mật khẩu</span>
            <span class="detail-value secret-value">${escapeHtml(passwordText)} ${getAuthMethod(acc) === 'email' ? renderEyeButton(acc.id, 'password', 'Hiện mật khẩu') : ''} ${renderCopyButton(acc.id, 'password', 'Copy mật khẩu')}</span>
        </div>
        ${hasTwoFa ? `<div class="detail-row"><span class="detail-label">2FA</span><span class="detail-value secret-value">${escapeHtml(twoFaText)} ${renderEyeButton(acc.id, 'twoFaCode', 'Hiện 2FA')} ${renderCopyButton(acc.id, '2fa', 'Copy 2FA')}</span></div>${renderTwoFaExtra(acc, twoFaSecret, twoFaIsTotp)}` : ''}
        ${noteText ? `<div class="detail-row detail-note-row"><span class="detail-label">Ghi chú</span><div class="detail-note-value">${renderSmartNote(noteText)}</div></div>` : ''}
        ${sellerRow}
    </div>
    <div class="detail-section anim-fade-in-up">
        <div class="detail-row"><span class="detail-label">Ngày mua</span><span class="detail-value">${formatDateVN(acc.purchaseDate)}</span></div>
        ${acc.purchasePrice && typeof formatPriceVN === 'function' ? `<div class="detail-row"><span class="detail-label">Giá mua</span><span class="detail-value detail-price-value">${escapeHtml(formatPriceVN(acc.purchasePrice))}</span></div>` : ''}
        <div class="detail-row"><span class="detail-label">Ngày hết hạn</span><span class="detail-value">${acc.expiryType === 'lifetime' ? '∞ Vĩnh viễn' : formatDateVN(acc.expiryDate)}</span></div>
        ${acc.expiryType !== 'lifetime' ? `<div class="detail-row"><span class="detail-label">Còn lại</span><span class="detail-value" style="color:${days < 0 ? 'var(--danger)' : days <= 5 ? 'var(--warning)' : 'var(--success)'}">${days < 0 ? 'Đã hết ' + Math.abs(days) + ' ngày' : days + ' ngày'}</span></div>` : ''}
    </div>
    ${acc.expiryType !== 'lifetime' ? `
    <div class="section-header" style="margin-top:20px"><span class="section-title">Gia hạn</span></div>
    <div class="renew-options anim-fade-in-up">
        <button class="renew-btn" onclick="renewAccount('${acc.id}',7)">+7 ngày</button>
        <button class="renew-btn" onclick="renewAccount('${acc.id}',15)">+15 ngày</button>
        <button class="renew-btn" onclick="renewAccount('${acc.id}',30)">+30 ngày</button>
        <button class="renew-btn" onclick="renewAccount('${acc.id}',90)">+90 ngày</button>
        <button class="renew-btn" onclick="renewAccount('${acc.id}',365)">+365 ngày</button>
        ${acc.status !== 'expired' ? `<button class="renew-btn renew-btn-expire" onclick="markAccountExpired('${acc.id}')">⏱ Hết hạn ngay</button>` : ''}
    </div>` : ''}
    <div style="display:flex;gap:12px;margin-top:24px">
        <button class="btn btn-outline btn-sm" style="flex:1" onclick="openShareAccountModal('${acc.id}')">Chia sẻ</button>
        <button class="btn btn-outline btn-sm" style="flex:1" onclick="editAccount('${acc.id}')">Sửa</button>
        <button class="btn btn-danger-outline btn-sm" style="flex:1" onclick="deleteAccount('${acc.id}')">Xoá</button>
    </div>`;
    if (twoFaIsTotp && typeof startTotpTicker === 'function') startTotpTicker(twoFaSecret);
    else if (typeof stopTotpTicker === 'function') stopTotpTicker();
}

// Widget t?o m? 2FA tr?c ti?p + link web d? ph?ng
function renderTwoFaExtra(acc, secret, isTotp) {
    if (!secret) return '';
    const safeSecret = escapeJsAttr(secret);
    const copyIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    if (isTotp) {
        return `<div class="totp-widget" id="totp-widget">
            <div class="totp-main">
                <span class="totp-label">M? hi?n t?i</span>
                <span class="totp-code" id="totp-code">------</span>
                <button type="button" class="icon-btn totp-copy" onclick="copyTotpCode()" title="Copy m? 2FA">${copyIcon}</button>
            </div>
            <div class="totp-timer">
                <span class="totp-count" id="totp-count">30s</span>
                <div class="totp-progress"><div class="totp-bar" id="totp-bar"></div></div>
            </div>
            <button type="button" class="totp-web-link" onclick="openWeb2FA('${safeSecret}')" title="Mở trang web 2FA">🌐 Web 2FA</button>
        </div>`;
    }
    return `<div class="detail-row totp-web-row"><span class="detail-label"></span><button type="button" class="btn btn-sm btn-outline" onclick="openWeb2FA('${safeSecret}')">?? T?o m? 2FA tr�n web</button></div>`;
}

// ===== GROUPS =====
function getGroupRoleLabel(group) {
    return group?.role === 'owner' ? 'Chủ nhóm' : 'Thành viên';
}

function getGroupLockLabel(groupId) {
    return isGroupUnlocked?.(groupId) ? 'Mở' : 'Đã khoá';
}

function renderGroupCard(group) {
    const count = window.appState.sharedAccountCounts?.[group.id] ?? group.sharedAccountCount ?? 0;
    const unlocked = Boolean(isGroupUnlocked?.(group.id));
    return `<button class="group-card anim-fade-in-up" onclick="openGroupDetail('${escapeJsAttr(group.id)}')">
        <div class="group-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>
        <div class="group-card-main">
            <div class="group-card-title">${escapeHtml(group.name || 'Nhóm')}</div>
            <div class="group-card-meta">${escapeHtml(getGroupRoleLabel(group))} · ${(group.memberEmails || []).length} thành viên · ${count} TK</div>
        </div>
        <span class="group-lock-badge ${unlocked ? 'unlocked' : ''}">${escapeHtml(getGroupLockLabel(group.id))}</span>
    </button>`;
}

function renderGroupList() {
    const groups = window.appState.groups || [];
    const query = String(window.appState.searchQuery || '').trim().toLowerCase();
    const filtered = query
        ? groups.filter(group => (group.name || '').toLowerCase().includes(query)
            || (group.ownerEmail || '').toLowerCase().includes(query)
            || (group.memberEmails || []).some(email => email.includes(query)))
        : groups;
    document.getElementById('page-content').innerHTML = `
        <div class="group-page-head anim-fade-in-up">
            <div>
                <div class="section-title">Nhóm</div>
                <div class="group-page-desc">${filtered.length} nhóm</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="openCreateGroupModal()">Tạo</button>
        </div>
        ${filtered.length
            ? `<div class="group-grid">${filtered.map(renderGroupCard).join('')}</div>`
            : `<div class="empty-state anim-fade-in-up"><div class="empty-state-icon">👥</div><div class="empty-state-title">Chưa có nhóm</div><div class="empty-state-desc">Tạo nhóm để chia sẻ tài khoản dùng chung.</div></div>`}
    `;
}

function renderGroupMembers(group) {
    const isOwner = group.role === 'owner';
    const ownerEmail = normalizeGroupEmail?.(group.ownerEmail) || group.ownerEmail || '';
    return `<div class="group-panel anim-fade-in-up">
        <div class="group-panel-head"><div class="section-title">Thành viên</div><span class="section-badge">${(group.memberEmails || []).length}</span></div>
        <div class="group-member-list">
            ${(group.memberEmails || []).map(email => {
                const isGroupOwnerEmail = normalizeGroupEmail?.(email) === ownerEmail;
                return `<div class="group-member-row">
                    <span class="group-member-email">${escapeHtml(email)}</span>
                    <span class="group-member-role">${isGroupOwnerEmail ? 'Chủ nhóm' : 'Thành viên'}</span>
                    ${isOwner && !isGroupOwnerEmail ? `<button class="copy-btn" onclick="handleRemoveGroupMember('${escapeJsAttr(group.id)}','${escapeJsAttr(email)}')" title="Xoá"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>` : ''}
                </div>`;
            }).join('')}
        </div>
        ${isOwner ? `<div class="group-member-add"><input type="email" id="group-member-email" class="input" placeholder="email@domain.com"><button class="btn btn-primary btn-sm" onclick="handleAddGroupMember('${escapeJsAttr(group.id)}')">Thêm</button></div>` : ''}
    </div>`;
}

function renderGroupCopyIconSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
}

function renderSharedAccountMeta(account) {
    const platformRef = getResolvedPlatform(account) || account.platform || account;
    const logoStyle = typeof getPlatformLogoStyle === 'function'
        ? getPlatformLogoStyle(platformRef, account.name || account.serviceName || '')
        : `background:${stringToColor(account.name || account.serviceName || 'TK')}20;color:${stringToColor(account.name || account.serviceName || 'TK')}`;
    const logoMark = typeof renderPlatformLogoMark === 'function'
        ? renderPlatformLogoMark(platformRef, getPlatformEmoji(platformRef))
        : getPlatformEmoji(platformRef);
    const expiryText = account.expiryType === 'lifetime' ? 'Vĩnh viễn' : formatDateVN(account.expiryDate);
    return { logoStyle, logoMark, expiryText };
}

function renderSharedSecretRows(group, account, decrypted) {
    const canRemove = group.role === 'owner' || account.sharedByUid === window.appState.user?.uid;
    return `<div class="shared-secret-rows">
        <div class="detail-row"><span class="detail-label">Tài khoản</span><span class="detail-value secret-value">${escapeHtml(decrypted.username || '')} <button class="copy-btn" onclick="copySharedField('${escapeJsAttr(group.id)}','${escapeJsAttr(account.id)}','username')">${renderGroupCopyIconSvg()}</button></span></div>
        <div class="detail-row"><span class="detail-label">Mật khẩu</span><span class="detail-value secret-value">${escapeHtml(decrypted.password || '')} <button class="copy-btn" onclick="copySharedField('${escapeJsAttr(group.id)}','${escapeJsAttr(account.id)}','password')">${renderGroupCopyIconSvg()}</button></span></div>
        ${decrypted.twoFaCode ? `<div class="detail-row"><span class="detail-label">2FA</span><span class="detail-value secret-value">${escapeHtml(decrypted.twoFaCode)} <button class="copy-btn" onclick="copySharedField('${escapeJsAttr(group.id)}','${escapeJsAttr(account.id)}','2fa')">${renderGroupCopyIconSvg()}</button></span></div>` : ''}
        ${decrypted.note ? `<div class="detail-row detail-note-row"><span class="detail-label">Ghi chú</span><div class="detail-note-value">${renderSmartNote(decrypted.note)}</div></div>` : ''}
        ${canRemove ? `<button class="btn btn-sm btn-danger-outline shared-remove-btn" onclick="handleRemoveSharedAccount('${escapeJsAttr(group.id)}','${escapeJsAttr(account.id)}')">Gỡ khỏi nhóm</button>` : ''}
    </div>`;
}

function renderSharedAccountCard(group, account) {
    const meta = renderSharedAccountMeta(account);
    const unlocked = Boolean(isGroupUnlocked?.(group.id));
    const key = `${group.id}:${account.id}`;
    const decrypted = window.appState.decryptedSharedAccounts?.[key];
    if (unlocked && !decrypted) {
        window.appState.decryptingSharedAccounts = window.appState.decryptingSharedAccounts || {};
        if (!window.appState.decryptingSharedAccounts[key]) {
            window.appState.decryptingSharedAccounts[key] = true;
            decryptSharedAccountForDisplay(group.id, account.id).finally(() => {
                delete window.appState.decryptingSharedAccounts[key];
            });
        }
    }
    return `<div class="shared-account-card anim-fade-in-up">
        <div class="shared-account-top">
            <div class="account-logo" style="${meta.logoStyle}">${meta.logoMark}</div>
            <div class="shared-account-info">
                <div class="account-name">${escapeHtml(account.name || account.serviceName || 'Tài khoản')}</div>
                <div class="account-user">${escapeHtml(account.displayUsername || '')}</div>
                <div class="shared-account-meta">${escapeHtml(meta.expiryText || '')}${account.sharedByEmail ? ` · ${escapeHtml(account.sharedByEmail)}` : ''}</div>
            </div>
        </div>
        ${unlocked
            ? (decrypted ? renderSharedSecretRows(group, account, decrypted) : '<div class="shared-locked-note">Đang giải mã...</div>')
            : `<div class="shared-locked-note"><span>Nội dung nhạy cảm đang ẩn</span><button class="btn btn-sm btn-outline" onclick="openUnlockGroupModal('${escapeJsAttr(group.id)}')">Nhập mật khẩu chung để xem</button></div>`}
    </div>`;
}

function renderGroupSharedAccounts(group) {
    const accounts = window.appState.sharedAccounts?.[group.id] || [];
    const unlocked = Boolean(isGroupUnlocked?.(group.id));
    return `<div class="group-panel group-shared-panel anim-fade-in-up">
        <div class="group-panel-head">
            <div class="section-title">Tài khoản chia sẻ</div>
            <div class="group-panel-actions">
                <span class="group-lock-badge ${unlocked ? 'unlocked' : ''}">${escapeHtml(getGroupLockLabel(group.id))}</span>
                ${unlocked ? '' : `<button class="btn btn-sm btn-outline" onclick="openUnlockGroupModal('${escapeJsAttr(group.id)}')">Mở khoá</button>`}
            </div>
        </div>
        ${accounts.length
            ? `<div class="shared-account-list">${accounts.map(account => renderSharedAccountCard(group, account)).join('')}</div>`
            : `<div class="empty-state compact"><div class="empty-state-title">Chưa có tài khoản chia sẻ</div></div>`}
    </div>`;
}

function renderGroupDetail(groupId) {
    const group = getGroupById?.(groupId);
    if (!group) {
        renderGroupList();
        return;
    }
    const isOwner = group.role === 'owner';
    document.getElementById('page-content').innerHTML = `
        <button class="back-btn" onclick="navigateTo('groups')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg> Nhóm</button>
        <div class="group-detail-head anim-fade-in-up">
            <div class="group-detail-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>
            <div class="group-detail-main"><div class="group-detail-title">${escapeHtml(group.name || 'Nhóm')}</div><div class="group-card-meta">${escapeHtml(getGroupRoleLabel(group))} · ${(group.memberEmails || []).length} thành viên</div></div>
        </div>
        ${isOwner ? `<div class="group-detail-actions-inline"><button class="btn btn-sm btn-outline" onclick="handleRenameGroup('${escapeJsAttr(group.id)}')">Đổi tên</button><button class="btn btn-sm btn-danger-outline" onclick="handleDeleteGroup('${escapeJsAttr(group.id)}')">Xoá</button></div>` : ''}
        <div class="group-detail-grid">
            ${renderGroupMembers(group)}
            ${renderGroupSharedAccounts(group)}
        </div>
    `;
}

// ===== GROUPS OVERRIDES: invites + shared edit approvals =====
function renderGroupCard(group) {
    const count = window.appState.sharedAccountCounts?.[group.id] ?? group.sharedAccountCount ?? 0;
    const editCount = window.appState.sharedEditRequestCounts?.[group.id] ?? group.editRequestCount ?? 0;
    const unlocked = Boolean(isGroupUnlocked?.(group.id));
    return `<button class="group-card anim-fade-in-up" onclick="openGroupDetail('${escapeJsAttr(group.id)}')">
        <div class="group-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>
        <div class="group-card-main">
            <div class="group-card-title">${escapeHtml(group.name || 'Nhom')}</div>
            <div class="group-card-meta">${escapeHtml(getGroupRoleLabel(group))} - ${(group.memberEmails || []).length} thanh vien - ${count} TK${editCount ? ` - ${editCount} cho duyet` : ''}</div>
        </div>
        <span class="group-lock-badge ${unlocked ? 'unlocked' : ''}">${escapeHtml(getGroupLockLabel(group.id))}</span>
    </button>`;
}

function renderGroupInviteCard(group) {
    return `<div class="group-card group-invite-card anim-fade-in-up">
        <div class="group-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 12h-6"/><path d="m19 9 3 3-3 3"/><path d="M14 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="7.5" cy="7" r="4"/></svg></div>
        <div class="group-card-main"><div class="group-card-title">${escapeHtml(group.name || 'Nhom')}</div><div class="group-card-meta">Moi boi ${escapeHtml(group.ownerEmail || '')}</div></div>
        <div class="group-invite-actions"><button type="button" class="btn btn-sm btn-primary" onclick="openAcceptGroupInviteModal('${escapeJsAttr(group.id)}')">Nhap MK</button><button type="button" class="btn btn-sm btn-outline" onclick="handleCancelGroupInvite('${escapeJsAttr(group.id)}')">Bo qua</button></div>
    </div>`;
}

function renderGroupInviteSection(invites) {
    if (!invites.length) return '';
    return `<div class="group-invite-section anim-fade-in-up"><div class="section-header"><span class="section-title">Loi moi vao team</span><span class="section-badge">${invites.length}</span></div><div class="group-grid group-invite-grid">${invites.map(renderGroupInviteCard).join('')}</div></div>`;
}

function renderGroupList() {
    const groups = window.appState.groups || [];
    const invites = window.appState.groupInvites || [];
    const query = String(window.appState.searchQuery || '').trim().toLowerCase();
    const filtered = query
        ? groups.filter(group => (group.name || '').toLowerCase().includes(query)
            || (group.ownerEmail || '').toLowerCase().includes(query)
            || (group.memberEmails || []).some(email => email.includes(query)))
        : groups;
    const filteredInvites = query
        ? invites.filter(group => (group.name || '').toLowerCase().includes(query)
            || (group.ownerEmail || '').toLowerCase().includes(query))
        : invites;
    document.getElementById('page-content').innerHTML = `
        <div class="group-page-head anim-fade-in-up">
            <div><div class="section-title">Nhom</div><div class="group-page-desc">${filtered.length} nhom${filteredInvites.length ? ` - ${filteredInvites.length} loi moi` : ''}</div></div>
            <button class="btn btn-primary btn-sm" onclick="openCreateGroupModal()">Tao</button>
        </div>
        ${renderGroupInviteSection(filteredInvites)}
        ${filtered.length ? `<div class="group-grid">${filtered.map(renderGroupCard).join('')}</div>` : `<div class="empty-state anim-fade-in-up"><div class="empty-state-title">Chua co nhom</div><div class="empty-state-desc">Tao nhom de chia se tai khoan dung chung.</div></div>`}
    `;
}

function renderGroupMembers(group) {
    const isOwner = group.role === 'owner';
    const ownerEmail = normalizeGroupEmail?.(group.ownerEmail) || group.ownerEmail || '';
    const pending = group.pendingMemberEmails || [];
    return `<div class="group-panel group-members-panel anim-fade-in-up">
        <div class="group-panel-head"><div class="section-title">Thanh vien</div><span class="section-badge">${(group.memberEmails || []).length}${pending.length ? `+${pending.length}` : ''}</span></div>
        <div class="group-member-list">
            ${(group.memberEmails || []).map(email => {
                const isGroupOwnerEmail = normalizeGroupEmail?.(email) === ownerEmail;
                return `<div class="group-member-row"><span class="group-member-email" title="${escapeHtml(email)}">${escapeHtml(email)}</span><span class="group-member-role">${isGroupOwnerEmail ? 'Chu nhom' : 'Thanh vien'}</span>${isOwner && !isGroupOwnerEmail ? `<button class="copy-btn" onclick="handleRemoveGroupMember('${escapeJsAttr(group.id)}','${escapeJsAttr(email)}')" title="Xoa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>` : ''}</div>`;
            }).join('')}
            ${isOwner && pending.length ? pending.map(email => `<div class="group-member-row pending"><span class="group-member-email" title="${escapeHtml(email)}">${escapeHtml(email)}</span><span class="group-member-role">Dang moi</span><button class="copy-btn" onclick="handleCancelGroupInvite('${escapeJsAttr(group.id)}','${escapeJsAttr(email)}')" title="Huy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>`).join('') : ''}
        </div>
        ${isOwner ? `<div class="group-member-add"><input type="email" id="group-member-email" class="input" placeholder="email@domain.com"><button class="btn btn-primary btn-sm" onclick="handleAddGroupMember('${escapeJsAttr(group.id)}')">Moi</button></div>` : ''}
    </div>`;
}

function renderSharedSecretRows(group, account, decrypted) {
    const canRemove = group.role === 'owner' || account.sharedByUid === window.appState.user?.uid;
    const pendingCount = (getSharedEditRequestsForAccount?.(group.id, account.id) || []).filter(request => request.status === 'pending').length;
    return `<div class="shared-secret-rows">
        <div class="detail-row"><span class="detail-label">Tai khoan</span><span class="detail-value secret-value">${escapeHtml(decrypted.username || '')} <button class="copy-btn" onclick="copySharedField('${escapeJsAttr(group.id)}','${escapeJsAttr(account.id)}','username')">${renderGroupCopyIconSvg()}</button></span></div>
        <div class="detail-row"><span class="detail-label">Mat khau</span><span class="detail-value secret-value">${escapeHtml(decrypted.password || '')} <button class="copy-btn" onclick="copySharedField('${escapeJsAttr(group.id)}','${escapeJsAttr(account.id)}','password')">${renderGroupCopyIconSvg()}</button></span></div>
        ${decrypted.twoFaCode ? `<div class="detail-row"><span class="detail-label">2FA</span><span class="detail-value secret-value">${escapeHtml(decrypted.twoFaCode)} <button class="copy-btn" onclick="copySharedField('${escapeJsAttr(group.id)}','${escapeJsAttr(account.id)}','2fa')">${renderGroupCopyIconSvg()}</button></span></div>` : ''}
        ${decrypted.note ? `<div class="detail-row detail-note-row"><span class="detail-label">Ghi chu</span><div class="detail-note-value">${renderSmartNote(decrypted.note)}</div></div>` : ''}
        <div class="shared-account-actions"><button class="btn btn-sm btn-outline" onclick="openSharedAccountEditModal('${escapeJsAttr(group.id)}','${escapeJsAttr(account.id)}')">Sua${pendingCount ? ` (${pendingCount})` : ''}</button>${canRemove ? `<button class="btn btn-sm btn-danger-outline shared-remove-btn" onclick="handleRemoveSharedAccount('${escapeJsAttr(group.id)}','${escapeJsAttr(account.id)}')">Go</button>` : ''}</div>
    </div>`;
}

function renderSharedEditRequestCard(group, request) {
    const user = window.appState.user || {};
    const currentEmail = typeof normalizeGroupEmail === 'function' ? normalizeGroupEmail(user.email) : String(user.email || '').toLowerCase();
    const reviewerEmail = typeof normalizeGroupEmail === 'function' ? normalizeGroupEmail(request.reviewerEmail) : String(request.reviewerEmail || '').toLowerCase();
    const canReview = request.reviewerUid === user.uid || reviewerEmail === currentEmail;
    const proposedName = request.proposedSafeData?.name || request.accountName || 'Tai khoan';
    return `<div class="shared-edit-request-card"><div class="shared-edit-request-main"><strong>${escapeHtml(proposedName)}</strong><span>${escapeHtml(request.requestedByEmail || '')}</span></div><div class="shared-edit-request-actions">${canReview ? `<button class="btn btn-sm btn-primary" onclick="handleAcceptSharedEditRequest('${escapeJsAttr(group.id)}','${escapeJsAttr(request.id)}')">Accept</button><button class="btn btn-sm btn-outline" onclick="handleRejectSharedEditRequest('${escapeJsAttr(group.id)}','${escapeJsAttr(request.id)}')">Reject</button>` : '<span class="group-lock-badge">Cho duyet</span>'}</div></div>`;
}

function renderSharedEditRequests(group) {
    const user = window.appState.user || {};
    const currentEmail = typeof normalizeGroupEmail === 'function' ? normalizeGroupEmail(user.email) : String(user.email || '').toLowerCase();
    const pending = (window.appState.sharedEditRequests?.[group.id] || []).filter(request => {
        if (request.status !== 'pending') return false;
        const reviewerEmail = typeof normalizeGroupEmail === 'function' ? normalizeGroupEmail(request.reviewerEmail) : String(request.reviewerEmail || '').toLowerCase();
        return request.reviewerUid === user.uid || request.requestedByUid === user.uid || reviewerEmail === currentEmail || group.role === 'owner';
    });
    if (!pending.length) return '';
    return `<div class="shared-edit-requests"><div class="section-header"><span class="section-title">Yeu cau sua dang cho</span><span class="section-badge">${pending.length}</span></div>${pending.map(request => renderSharedEditRequestCard(group, request)).join('')}</div>`;
}

function renderSharedAccountCard(group, account) {
    const meta = renderSharedAccountMeta(account);
    const unlocked = Boolean(isGroupUnlocked?.(group.id));
    const key = `${group.id}:${account.id}`;
    const decrypted = window.appState.decryptedSharedAccounts?.[key];
    const pendingCount = (getSharedEditRequestsForAccount?.(group.id, account.id) || []).filter(request => request.status === 'pending').length;
    if (unlocked && !decrypted) {
        window.appState.decryptingSharedAccounts = window.appState.decryptingSharedAccounts || {};
        if (!window.appState.decryptingSharedAccounts[key]) {
            window.appState.decryptingSharedAccounts[key] = true;
            decryptSharedAccountForDisplay(group.id, account.id).finally(() => {
                delete window.appState.decryptingSharedAccounts[key];
            });
        }
    }
    return `<div class="shared-account-card anim-fade-in-up"><div class="shared-account-top"><div class="account-logo" style="${meta.logoStyle}">${meta.logoMark}</div><div class="shared-account-info"><div class="account-name">${escapeHtml(account.name || account.serviceName || 'Tai khoan')}${pendingCount ? ` <span class="sync-pending-badge">${pendingCount} cho duyet</span>` : ''}</div><div class="account-user">${escapeHtml(account.displayUsername || '')}</div><div class="shared-account-meta">${escapeHtml(meta.expiryText || '')}${account.sharedByEmail ? ` - ${escapeHtml(account.sharedByEmail)}` : ''}</div></div></div>${unlocked ? (decrypted ? renderSharedSecretRows(group, account, decrypted) : '<div class="shared-locked-note">Dang giai ma...</div>') : `<div class="shared-locked-note"><span>Noi dung nhay cam dang an</span><button class="btn btn-sm btn-outline" onclick="openUnlockGroupModal('${escapeJsAttr(group.id)}')">Nhap mat khau nhom</button></div>`}</div>`;
}

function renderGroupSharedAccounts(group) {
    const accounts = window.appState.sharedAccounts?.[group.id] || [];
    const unlocked = Boolean(isGroupUnlocked?.(group.id));
    return `<div class="group-panel group-shared-panel anim-fade-in-up"><div class="group-panel-head"><div class="section-title">Tai khoan chia se</div><div class="group-panel-actions"><span class="group-lock-badge ${unlocked ? 'unlocked' : ''}">${escapeHtml(getGroupLockLabel(group.id))}</span>${unlocked ? '' : `<button class="btn btn-sm btn-outline" onclick="openUnlockGroupModal('${escapeJsAttr(group.id)}')">Mo khoa</button>`}</div></div>${renderSharedEditRequests(group)}${accounts.length ? `<div class="shared-account-list">${accounts.map(account => renderSharedAccountCard(group, account)).join('')}</div>` : `<div class="empty-state compact"><div class="empty-state-title">Chua co tai khoan chia se</div></div>`}</div>`;
}

function renderGroupDetail(groupId) {
    const group = getGroupById?.(groupId);
    if (!group) {
        renderGroupList();
        return;
    }
    const isOwner = group.role === 'owner';
    document.getElementById('page-content').innerHTML = `
        <button class="back-btn" onclick="navigateTo('groups')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg> Nhom</button>
        <div class="group-detail-head anim-fade-in-up"><div class="group-detail-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div><div class="group-detail-main"><div class="group-detail-title">${escapeHtml(group.name || 'Nhom')}</div><div class="group-card-meta">${escapeHtml(getGroupRoleLabel(group))} - ${(group.memberEmails || []).length} thanh vien</div></div></div>
        ${isOwner ? `<div class="group-detail-actions-inline"><button class="btn btn-sm btn-outline" onclick="handleRenameGroup('${escapeJsAttr(group.id)}')">Doi ten</button><button class="btn btn-sm btn-danger-outline" onclick="handleDeleteGroup('${escapeJsAttr(group.id)}')">Xoa</button></div>` : ''}
        <div class="group-detail-grid">${renderGroupMembers(group)}${renderGroupSharedAccounts(group)}</div>
    `;
}

function renderNotifyDaysOptions(days) {
    const value = days.join(',');
    const presets = [
        { value: '1', label: '1 ngày' },
        { value: '3,1', label: '3, 1 ngày' },
        { value: '5,3,1', label: '5, 3, 1 ngày' },
        { value: '7,3,1', label: '7, 3, 1 ngày' },
        { value: '14,7,3,1', label: '14, 7, 3, 1 ngày' },
    ];
    const hasPreset = presets.some(item => item.value === value);
    return `${presets.map(item => `<option value="${item.value}" ${item.value === value ? 'selected' : ''}>${item.label}</option>`).join('')}
        ${hasPreset ? '' : `<option value="${escapeHtml(value)}" selected>${escapeHtml(days.join(', '))} ngày</option>`}`;
}

function renderSettings() {
    const settings = window.appState.settings || {};
    const notificationSettings = typeof getNotificationSettings === 'function'
        ? getNotificationSettings()
        : { enabled: true, nativeEnabled: true, inAppEnabled: true, daysBefore: [5, 3, 1], repeatHours: 24, overdueDays: 3 };
    const trashCount = window.appState.trashAccounts?.length || 0;
    const categoryCount = window.appState.customCategories?.length || 0;
    document.getElementById('page-content').innerHTML = `
    <div class="section-header"><span class="section-title">Cài đặt</span></div>
    <div class="settings-group">
        <div class="settings-group-title">Tổ chức</div>
        <div class="settings-card">
            <div class="settings-item" onclick="navigateTo('categories')"><div class="settings-item-icon" style="background:var(--accent-bg)">📁</div><div class="settings-item-content"><div class="settings-item-title">Danh mục</div><div class="settings-item-desc">${categoryCount} danh mục đang dùng</div></div><span class="section-badge">${categoryCount}</span></div>
            <div class="settings-item" onclick="navigateTo('trash')"><div class="settings-item-icon" style="background:var(--danger-bg)">🗑️</div><div class="settings-item-content"><div class="settings-item-title">Thùng rác</div><div class="settings-item-desc">Khôi phục tài khoản đã xoá mềm</div></div><span class="section-badge">${trashCount}</span></div>
        </div>
    </div>
    <div class="settings-group">
        <div class="settings-group-title">Bảo mật</div>
        <div class="settings-card">
            <div class="settings-item" onclick="handleChangeMasterPassword()"><div class="settings-item-icon" style="background:var(--accent-bg)">🔑</div><div class="settings-item-content"><div class="settings-item-title">Đổi Master PIN</div><div class="settings-item-desc">Xác thực lại tài khoản rồi đặt PIN mới 4 hoặc 6 số</div></div></div>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--accent-bg)">🛒</div><div class="settings-item-content"><div class="settings-item-title">Khoá TK Mua bằng Master Password</div><div class="settings-item-desc">Bật nếu muốn bảo vệ TK Mua như mục Cá nhân</div></div><input class="settings-toggle" type="checkbox" onchange="handleProtectBoughtToggle(this)" ${settings.protectBoughtAccounts ? 'checked' : ''}></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--danger-bg)">🧹</div><div class="settings-item-content"><div class="settings-item-title">Tự xoá clipboard sau 30s</div><div class="settings-item-desc">Áp dụng khi copy mật khẩu, 2FA hoặc mã</div></div><input class="settings-toggle" type="checkbox" onchange="handleClipboardAutoClearToggle(this)" ${settings.clipboardAutoClear ? 'checked' : ''}></label>
        </div>
    </div>
    <div class="settings-group">
        <div class="settings-group-title">Giao diện</div>
        <div class="settings-card">
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--accent-bg)">🌗</div><div class="settings-item-content"><div class="settings-item-title">Theme</div><div class="settings-item-desc">Theo hệ thống, sáng hoặc tối</div></div><select class="settings-select" onchange="handleThemeChange(this.value)"><option value="system" ${settings.theme==='system'?'selected':''}>Hệ thống</option><option value="light" ${settings.theme==='light'?'selected':''}>Sáng</option><option value="dark" ${settings.theme==='dark'?'selected':''}>Tối</option></select></label>
        </div>
    </div>
    <div class="settings-group">
        <div class="settings-group-title">Thông báo</div>
        <div class="settings-card">
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--warning-bg)">🔔</div><div class="settings-item-content"><div class="settings-item-title">Bật nhắc hạn</div><div class="settings-item-desc">Quét tài khoản sắp hoặc đã hết hạn</div></div><input class="settings-toggle" type="checkbox" onchange="handleNotificationsEnabledToggle(this)" ${notificationSettings.enabled ? 'checked' : ''}></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--accent-bg)">📣</div><div class="settings-item-content"><div class="settings-item-title">Thông báo điện thoại</div><div class="settings-item-desc">Đẩy lên thanh thông báo khi tài khoản gần hết hạn</div></div><input class="settings-toggle" type="checkbox" onchange="handleNativeNotificationsToggle(this)" ${notificationSettings.nativeEnabled ? 'checked' : ''}></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--success-bg)">🔔</div><div class="settings-item-content"><div class="settings-item-title">Chuông trong app</div><div class="settings-item-desc">Hiện badge và danh sách khi bấm icon chuông</div></div><input class="settings-toggle" type="checkbox" onchange="handleInAppNotificationsToggle(this)" ${notificationSettings.inAppEnabled ? 'checked' : ''}></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--warning-bg)">📅</div><div class="settings-item-content"><div class="settings-item-title">Nhắc trước</div><div class="settings-item-desc">Áp dụng cho tài khoản mới</div></div><select class="settings-select settings-select-wide" onchange="handleNotifyDaysChange(this.value)">${renderNotifyDaysOptions(notificationSettings.daysBefore)}</select></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--accent-bg)">🔁</div><div class="settings-item-content"><div class="settings-item-title">Lặp lại</div><div class="settings-item-desc">Tối đa 1 lần/ngày để tiết kiệm pin</div></div><select class="settings-select settings-select-wide" onchange="handleNotifyRepeatChange(this.value)"><option value="24" ${notificationSettings.repeatHours===24?'selected':''}>1 lần/ngày (24h)</option></select></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--danger-bg)">⏳</div><div class="settings-item-content"><div class="settings-item-title">Hiện quá hạn trong</div><div class="settings-item-desc">Sau thời gian này tài khoản biến mất khỏi danh sách chuông</div></div><select class="settings-select" onchange="handleNotifyOverdueChange(this.value)"><option value="0" ${notificationSettings.overdueDays===0?'selected':''}>Tắt</option><option value="1" ${notificationSettings.overdueDays===1?'selected':''}>1 ngày</option><option value="2" ${notificationSettings.overdueDays===2?'selected':''}>2 ngày</option><option value="3" ${notificationSettings.overdueDays===3?'selected':''}>3 ngày</option></select></label>
            <div class="settings-item" onclick="showNotifications()"><div class="settings-item-icon" style="background:var(--warning-bg)">🔎</div><div class="settings-item-content"><div class="settings-item-title">Tài khoản cần chú ý</div><div class="settings-item-desc">${notificationSettings.inAppEnabled ? (typeof getNotificationList === 'function' ? getNotificationList(window.appState.accounts).length : 0) : 0} tài khoản sắp hết hạn hoặc quá hạn dưới 3 ngày</div></div></div>
            <div class="settings-item"><div class="settings-item-icon" style="background:var(--success-bg)">✅</div><div class="settings-item-content"><div class="settings-item-title">Gửi thử thông báo</div><div class="settings-item-desc">Kiểm tra quyền thông báo của thiết bị</div></div><button class="btn btn-sm btn-outline settings-inline-btn" onclick="sendTestNotification()">Gửi thử</button></div>
            <div class="settings-item"><div class="settings-item-icon" style="background:var(--accent-bg)">⚙️</div><div class="settings-item-content"><div class="settings-item-title">Cài đặt thông báo điện thoại</div><div class="settings-item-desc">Mở quyền thông báo của Ting! trong Android</div></div><button class="btn btn-sm btn-outline settings-inline-btn" onclick="openNotificationSettingsFromApp()">Mở</button></div>
        </div>
    </div>
    <div class="settings-group">
        <div class="settings-group-title">Tài khoản</div>
        <div class="settings-card">
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--accent-bg)">🪪</div><div class="settings-item-content"><div class="settings-item-title">Ghi nhớ đăng nhập</div><div class="settings-item-desc">Giữ tài khoản Google/Email trên thiết bị này</div></div><select class="settings-select settings-select-wide" onchange="handleRememberSignInChange(this.value)"><option value="forever" ${(typeof getAuthRememberMode === 'function' ? getAuthRememberMode() : 'forever') === 'forever' ? 'selected' : ''}>Vĩnh viễn</option><option value="30d" ${(typeof getAuthRememberMode === 'function' ? getAuthRememberMode() : 'forever') === '30d' ? 'selected' : ''}>30 ngày</option></select></label>
            <div class="settings-item" onclick="signOut()"><div class="settings-item-icon" style="background:var(--danger-bg)">🚪</div><div class="settings-item-content"><div class="settings-item-title" style="color:var(--danger)">Đăng xuất</div></div></div>
        </div>
    </div>
    <p style="text-align:center;font-size:12px;color:var(--text-tertiary);margin-top:24px">Ting! v1.0</p>`;
}

function renderNotificationPanel(items = (typeof getNotificationList === 'function' ? getNotificationList(window.appState.accounts) : [])) {
    const list = items || [];
    const unreadCount = list.filter(item => !item.seen).length;
    const html = `
        <div class="notification-panel-head">
            <strong>Thông báo hết hạn</strong>
            <span>${unreadCount} mới · ${list.length} mục</span>
            <button type="button" class="modal-close mini" onclick="showNotifications()" aria-label="Đóng">×</button>
        </div>
        ${list.length ? `<div class="notification-list">${list.map(item => {
            const days = item.daysLeft;
            const text = days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`;
            const seen = Boolean(item.seen);
            return `<div class="notification-item ${days < 0 ? 'expired' : days <= 3 ? 'urgent' : ''} ${seen ? 'seen' : ''}">
                <div class="notification-icon">${days < 0 ? '!' : '⏰'}</div>
                <div class="notification-info">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(text)} · ${formatDateVN(item.expiryDate)}${seen ? ' · Đã xem' : ''}</span>
                </div>
                <button class="renew-btn" onclick="renewAccount('${escapeJsAttr(item.id)}',30)">+30</button>
            </div>`;
        }).join('')}</div>` : '<div class="notification-empty">Tất cả đều ổn.</div>'}`;
    const panel = document.getElementById('notification-dropdown');
    if (panel) panel.innerHTML = html;
    return html;
}

function renderNotificationPanelPremium(items = (typeof getNotificationList === 'function' ? getNotificationList(window.appState.accounts) : [])) {
    const list = items || [];
    const unreadCount = list.filter(item => !item.seen).length;
    const itemHtml = (item, index) => {
        const days = item.daysLeft;
        const text = days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`;
        const statusClass = days < 0 ? 'expired' : days <= 3 ? 'urgent' : 'soon';
        const seen = Boolean(item.seen);
        const platform = typeof getResolvedPlatform === 'function' ? getResolvedPlatform(item) : item.platform;
        const label = typeof getPlatformLabel === 'function' ? getPlatformLabel(platform, [item]) : item.name;
        const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platform, label) : '';
        const logoMark = typeof renderPlatformLogoMark === 'function'
            ? renderPlatformLogoMark(platform, getPlatformEmoji?.(platform) || '')
            : (getPlatformEmoji?.(platform) || '');
        const progress = days < 0 ? 100 : Math.max(8, Math.min(100, Math.round(((item.notifyWindow - days) / Math.max(1, item.notifyWindow || 1)) * 100)));
        return `<div class="notification-item ${statusClass} ${seen ? 'seen' : ''}" style="--stagger:${index}">
            <div class="notification-icon" style="${logoStyle}">${logoMark || (days < 0 ? '!' : '*')}</div>
            <div class="notification-info">
                <div class="notification-title-row">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span class="notification-status">${escapeHtml(text)}</span>
                </div>
                <span>${formatDateVN(item.expiryDate)}${seen ? ' - Đã xem' : ''}</span>
                <div class="notification-progress"><i style="width:${progress}%"></i></div>
            </div>
            <div class="notification-actions">
                <button class="renew-btn" onclick="renewAccount('${escapeJsAttr(item.id)}',30)">+30</button>
                <button class="renew-btn alt" onclick="renewAccount('${escapeJsAttr(item.id)}',90)">+90</button>
                <button class="renew-btn ghost" onclick="showDetail('${escapeJsAttr(item.id)}')">Xem</button>
            </div>
        </div>`;
    };
    const html = `
        <div class="notification-panel-head">
            <strong>Tài khoản cần chú ý</strong>
            <span class="notification-count-badge">${unreadCount} mới - ${list.length} mục</span>
            <button type="button" class="modal-close mini" onclick="showNotifications()" aria-label="Đóng">×</button>
        </div>
        ${list.length ? `<div class="notification-list">${list.map(itemHtml).join('')}</div>` : '<div class="notification-empty"><div class="notification-empty-icon">*</div><strong>Tất cả đều ổn</strong><span>Không có tài khoản sắp hết hạn.</span></div>'}`;
    const panel = document.getElementById('notification-dropdown');
    if (panel) panel.innerHTML = html;
    return html;
}

renderNotificationPanel = renderNotificationPanelPremium;

// ===== MOBILE ADD FORM PARITY HELPERS =====
function getAddFormPlatformOptions() {
    return [
        { name: 'Netflix', id: 'netflix' },
        { name: 'Spotify', id: 'spotify' },
        { name: 'Canva', id: 'canva' },
        { name: 'YouTube', id: 'youtube' },
        { name: 'ChatGPT', id: 'openai' },
        { name: 'Gemini', id: 'google-ai' },
        { name: 'Veo 3', id: 'google-veo' },
        { name: 'Antigravity', id: 'google-antigravity' },
        { name: 'Claude', id: 'claude' },
        { name: 'Suno', id: 'suno' },
        { name: 'Adobe', id: 'adobe' },
        { name: 'Figma', id: 'figma' },
        { name: 'Notion', id: 'notion' },
        { name: 'GitHub', id: 'github' },
        { name: 'Microsoft 365', id: 'office365' },
        { name: 'Apple', id: 'apple' },
        { name: 'Zoom', id: 'zoom' },
        { name: 'Discord', id: 'discord' },
        { name: 'Midjourney', id: 'midjourney' },
        { name: 'Perplexity', id: 'perplexity' },
        { name: 'DeepSeek', id: 'deepseek' },
        { name: 'Kiro', id: 'kiro' },
        { name: 'Grok', id: 'grok' },
        { name: 'Cursor', id: 'cursor' },
        { name: 'Google Drive', id: 'googledrive' },
        { name: 'Google Account', id: 'google-account' },
        { name: 'VNeID', id: 'vneid' },
        { name: 'MoMo', id: 'momo' },
        { name: 'ZaloPay', id: 'zalopay' },
        { name: 'Shopee', id: 'shopee' },
        { name: 'Vietcombank', id: 'vietcombank' },
        { name: 'FPT Play', id: 'fptplay' },
        { name: 'Others', id: 'other' },
    ];
}

function renderHintButton(text) {
    return `<button type="button" class="hint-btn" data-hint="${escapeHtml(text)}" aria-label="Gợi ý">
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <circle cx="8" cy="8" r="7"/><path d="M8 7v4"/><circle cx="8" cy="5" r="0.5" fill="currentColor"/>
        </svg>
    </button>`;
}

function renderPlatformPickerIcon(platform, label) {
    const style = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platform, label) : '';
    const mark = typeof renderPlatformLogoMark === 'function' ? renderPlatformLogoMark(platform, getPlatformEmoji(platform)) : getPlatformEmoji(platform);
    return `<span class="platform-picker-icon" style="${style}">${mark}</span>`;
}

function renderPlatformPickerButton(platform) {
    return `<button type="button" class="platform-picker-item" data-platform="${escapeJsAttr(platform.id)}" onclick="selectPlatformFromPicker('${escapeJsAttr(platform.id)}','${escapeJsAttr(platform.name)}')">
        ${renderPlatformPickerIcon(platform.id, platform.name)}
        <span>${escapeHtml(platform.name)}</span>
    </button>`;
}

function getSellerPlatformOptions() {
    return [
        { name: 'Facebook', id: 'facebook' },
        { name: 'Zalo', id: 'zalo' },
        { name: 'Telegram', id: 'telegram' },
        { name: 'Discord', id: 'discord' },
        { name: 'Web', id: 'other' },
    ];
}

function getSellerPlatformLabel(platform) {
    const options = getSellerPlatformOptions();
    const match = options.find(item => item.id === platform);
    const config = typeof getPlatformIconConfig === 'function' ? getPlatformIconConfig(platform) : null;
    return match?.name || config?.label || 'Web';
}

function renderSellerPlatformPicker(selected = 'other', sellerLink = '') {
    const active = selected || 'other';
    const options = getSellerPlatformOptions();
    return `<input type="hidden" id="add-seller-platform" value="${escapeHtml(active)}">
    <input type="hidden" id="add-seller-link" value="${escapeHtml(sellerLink || '')}">
    <div class="seller-source-grid platform-picker-grid">
        ${options.map(option => `<button type="button" class="platform-picker-item ${active === option.id ? 'active' : ''}" data-seller-platform="${escapeJsAttr(option.id)}" onclick="selectSellerPlatform('${escapeJsAttr(option.id)}')">
            ${renderPlatformPickerIcon(option.id, option.name)}
            <span>${escapeHtml(option.name)}</span>
        </button>`).join('')}
    </div>
    <div id="seller-link-hint" class="seller-link-hint"${sellerLink ? '' : ' hidden'}>${sellerLink ? renderSellerLinkHint(sellerLink) : ''}</div>`;
}

function renderSellerLinkHint(url) {
    if (!url) return '';
    const safe = escapeHtml(url);
    return `<span class="seller-link-chip" title="${safe}">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19"/></svg>
        <span class="seller-link-chip-text">${safe}</span>
    </span>`;
}

function selectSellerPlatform(platform) {
    const value = platform || 'other';
    const input = document.getElementById('add-seller-platform');
    if (input) input.value = value;
    document.querySelectorAll('[data-seller-platform]').forEach(button => {
        button.classList.toggle('active', button.dataset.sellerPlatform === value);
    });
}

function renderSellerDetailRow(acc) {
    const sellerName = String(acc?.sellerName || '').trim();
    const sellerLink = String(acc?.sellerLink || '').trim();
    if (!sellerName && !sellerLink) return '';
    const platform = acc.sellerPlatform || 'other';
    const label = getSellerPlatformLabel(platform);
    const style = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platform, label) : '';
    const mark = typeof renderPlatformLogoMark === 'function'
        ? renderPlatformLogoMark(platform, getPlatformEmoji(platform))
        : getPlatformEmoji(platform);
    const displayName = sellerName || sellerLink;
    const nameHtml = sellerLink
        ? `<a href="#" class="seller-source-name seller-source-link" title="${escapeHtml(sellerLink)}" onclick="event.preventDefault();openExternalLink('${escapeJsAttr(sellerLink)}')">${escapeHtml(displayName)}</a>`
        : `<span class="seller-source-name">${escapeHtml(displayName)}</span>`;
    return `<div class="detail-row">
        <span class="detail-label">Ng&#432;&#7901;i b&#225;n</span>
        <span class="detail-value seller-info-value"><span class="seller-source-icon" style="${style}" title="${escapeHtml(label)}">${mark}</span>${nameHtml}</span>
    </div>`;
}

function renderPlatformPlanHeader(platformId) {
    const label = platformId && typeof getPlatformPickerLabel === 'function'
        ? getPlatformPickerLabel(platformId)
        : '';
    return `<div class="platform-plan-current" id="platform-plan-current">
        ${platformId ? `${renderPlatformPickerIcon(platformId, label)}<strong>${escapeHtml(label)}</strong>` : ''}
    </div>`;
}

function renderPlatformSection(platforms) {
    const activePlatform = window.appState?.addFormPlatform || '';
    const gridHidden = activePlatform ? 'hidden' : '';
    const panelHidden = activePlatform ? '' : 'hidden';
    return `<div id="platform-section" class="platform-section">
        <div id="platform-section-grid" class="platform-section-grid ${activePlatform ? 'slide-out-left' : ''}" ${gridHidden}>
            <div class="platform-picker-section-title">Chọn nền tảng & gói cước</div>
            <div class="platform-picker-grid">
                ${platforms.map(renderPlatformPickerButton).join('')}
            </div>
        </div>
        <div id="platform-plan-panel-inline" class="platform-plan-panel-inline ${activePlatform ? 'slide-in-right' : ''}" ${panelHidden}>
            <div class="platform-plan-header">
                <button type="button" class="platform-plan-back" onclick="backToPlatformGrid()" aria-label="Quay lại chọn nền tảng">
                    <span aria-hidden="true">←</span>
                    <span>Quay lại</span>
                </button>
                ${renderPlatformPlanHeader(activePlatform)}
            </div>
            <div class="platform-plan-title-row">
                <div class="platform-picker-section-title" id="platform-plan-title">Gói cước</div>
                <button type="button" class="plan-edit-toggle-btn" id="plan-edit-toggle-btn" onclick="togglePlanEditMode()" aria-label="Chỉnh sửa gói cước" title="Chỉnh sửa gói cước">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        <path d="m15 5 4 4"/>
                    </svg>
                </button>
            </div>
            <div id="tag-suggestions" class="platform-plan-grid"></div>
            <div class="tag-custom-row platform-tag-custom-row">
                <input type="text" id="add-tag-input" class="input" placeholder="Tùy chỉnh gói cước..." onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomTagFromInput()}">
                <button type="button" class="platform-tag-add-btn" onclick="addCustomTagFromInput()" aria-label="Thêm tag">+</button>
            </div>
        </div>
    </div>`;
}

function renderCollapsibleSection(id, icon, title, contentHtml) {
    const safeId = escapeJsAttr(id);
    return `<div class="add-form-collapse" data-section="${safeId}">
        <button type="button" class="collapse-toggle" id="add-section-${safeId}-toggle" aria-expanded="false" onclick="toggleAddSection('${safeId}')">
            <span class="collapse-chevron" aria-hidden="true">▸</span>
            <span class="collapse-icon" aria-hidden="true">${escapeHtml(icon)}</span>
            <span class="collapse-title">${escapeHtml(title)}</span>
        </button>
        <div class="collapse-body" id="add-section-${safeId}">
            ${contentHtml}
        </div>
    </div>`;
}

function renderServiceDetectionChips(suggestions = {}) {
    const platforms = Array.isArray(suggestions.platforms) ? suggestions.platforms : [];
    const tags = Array.isArray(suggestions.tags) ? suggestions.tags : [];
    if (!platforms.length && !tags.length) return '';

    const platformHtml = platforms.map((item, index) => {
        const label = item.label || (typeof getPlatformPickerLabel === 'function' ? getPlatformPickerLabel(item.id, item.id) : item.id);
        const active = window.appState?.addFormPlatform === item.id || (!window.appState?.addFormPlatform && index === 0);
        return `<button type="button" class="service-detect-chip ${active ? 'active' : ''}" onclick="selectDetectedPlatform('${escapeJsAttr(item.id)}')">
            ${renderPlatformPickerIcon(item.id, label)}
            <span>${escapeHtml(label)}</span>
            <strong>${active ? '✓' : '○'}</strong>
        </button>`;
    }).join('');

    const tagHtml = tags.map(tag => {
        const active = typeof isAddTagSelected === 'function' ? isAddTagSelected(tag) : true;
        const tone = typeof getTagToneClass === 'function' ? getTagToneClass(tag) : 'tag-default';
        return `<button type="button" class="service-detect-chip service-detect-tag ${tone} ${active ? 'active' : ''}" onclick="toggleAddTag('${escapeJsAttr(tag)}')">
            <span>${escapeHtml(tag)}</span>
            <strong>${active ? '✓' : '○'}</strong>
        </button>`;
    }).join('');

    return `<div class="service-detect-row">
        ${platforms.length ? `<div class="service-detect-group"><span class="service-detect-label">Nhận diện:</span>${platformHtml}</div>` : ''}
        ${tags.length ? `<div class="service-detect-group"><span class="service-detect-label">Gói:</span>${tagHtml}</div>` : ''}
    </div>`;
}

function renderNoteToolbarIcon(type) {
    if (type === 'copy') {
        return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>`;
    }
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/>
    </svg>`;
}

function renderAddForm(type, editData = null) {
    const isEdit = Boolean(editData?.id);
    const defaultCategoryIds = window.appState.currentPage?.startsWith('category:')
        ? [window.appState.currentPage.slice('category:'.length)]
        : [];
    const selectedCategoryIds = isEdit
        ? (Array.isArray(editData.categoryIds) ? editData.categoryIds : [])
        : defaultCategoryIds;
    const platforms = getAddFormPlatformOptions();
    const today = todayStr();
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    const defaultExpiryValue = [
        defaultExpiry.getFullYear(),
        String(defaultExpiry.getMonth() + 1).padStart(2, '0'),
        String(defaultExpiry.getDate()).padStart(2, '0'),
    ].join('-');
    const authMethod = getAuthMethod(window.appState.addFormAuthMethod || 'email');
    const authMethodLabel = window.AUTH_METHOD_CONFIG?.[authMethod]?.label || 'Email';
    const purchaseValue = editData?.purchaseDate || today;
    const expiryValue = editData?.expiryDate || defaultExpiryValue;
    const isLifetime = editData?.expiryType === 'lifetime';
    const rawValue = editData?.rawInput || [editData?.username, editData?.password, editData?.twoFaCode].filter(Boolean).join('|');
    const saveButton = isEdit
        ? `<button class="btn btn-primary" style="margin-top:24px" onclick="saveEditedAccount('${escapeJsString(editData.id)}')">Lưu thay đổi</button>`
        : `<button class="btn btn-primary" style="margin-top:24px" onclick="saveNewAccount('${type}')">Lưu tài khoản</button>`;
    const categoryContent = `
        ${renderCategoryPicker(selectedCategoryIds)}
        <div class="inline-category-create">
            <button type="button" class="inline-create-toggle" onclick="toggleInlineCategoryCreate()">+ Tạo mới</button>
            <div id="inline-category-create-box" class="inline-category-create-box" hidden>
                <input type="text" id="inline-category-name" class="input" placeholder="Tên danh mục" onkeydown="if(event.key==='Enter'){event.preventDefault();createInlineCategoryFromAddForm()}">
                <button type="button" class="quick-chip primary" onclick="createInlineCategoryFromAddForm()">Tạo</button>
            </div>
        </div>`;
    return `
    ${renderAuthMethodInlineSelector(authMethod)}
    <div id="add-auth-linked-wrap" class="add-auth-linked-wrap" ${authMethod === 'email' ? 'hidden' : ''}>
        <div id="linked-account-picker-wrap">${renderLinkedAccountPicker(authMethod)}</div>
        <div class="auth-method-note"><span>ⓘ</span><span>Dịch vụ SSO dùng mật khẩu từ TK gốc. Ting! sẽ lưu link tới TK gốc thay vì lưu mật khẩu riêng.</span></div>
    </div>

    <div id="add-credential-block" class="add-credential-block" ${authMethod === 'email' ? '' : 'hidden'}>
        <div class="form-section-title">Dán thông tin tài khoản</div>
        <textarea class="textarea-paste" id="paste-input" placeholder="user@email.com|password123|2FA_CODE" oninput="previewParse()">${escapeHtml(rawValue)}</textarea>
        <div id="parse-preview"></div>
        <div id="service-detect-suggestions"></div>
    </div>

    <div class="form-section-title">Tên dịch vụ ${renderHintButton('Tên sẽ được tự điền khi ô paste nhận diện được nền tảng.')}</div>
    <div class="service-name-picker">
        <div class="input-group service-name-input-group">
            <input type="text" id="add-name" class="input" placeholder=" " style="padding-left:16px" value="${escapeHtml(editData?.name || '')}" oninput="autoDetectPlatform();this.dataset.autoFilled='false'">
            <label for="add-name" class="input-label" style="left:16px">VD: ChatGPT, Canva...</label>
        </div>
        <div id="platform-detect" class="service-tag-inline"></div>
        <div id="selected-tags" class="selected-tags service-selected-tags" hidden></div>
    </div>

    ${renderPlatformSection(platforms)}

    <div class="form-section-title">Thời hạn ${renderHintButton('Nhập linh hoạt: 30 = +30 ngày, 28/04 30 = mua 28/04 +30 ngày, 28/04 > 28/05 = khoảng ngày.')}</div>
    <input type="text" id="add-smart-date" class="input smart-date-input" value="30 ngày" placeholder="30 ngày, 28/04 30, 28/04 > 28/05" oninput="applySmartDateInput(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();applySmartDateInput(this.value)}">
    <input type="hidden" id="add-purchase" value="${escapeHtml(purchaseValue)}">
    <input type="hidden" id="add-expiry" value="${escapeHtml(expiryValue)}">
    <div id="add-expiry-hint" class="quick-date-hint smart-date-preview"></div>
    <div class="smart-date-options">
        <label class="quick-lifetime"><input type="checkbox" id="add-date-custom" onchange="toggleSmartDateDetails(this)"> Tùy chỉnh chi tiết</label>
        <label class="quick-lifetime"><input type="checkbox" id="add-lifetime" onchange="handleAddLifetimeToggle(this)"> Vĩnh viễn</label>
    </div>
    <div id="smart-date-details" class="smart-date-details" ${isEdit ? '' : 'hidden'}>
        <div class="quick-date-grid">
            <div class="quick-date-field">
                <label>Ngày mua</label>
                <input type="date" id="add-purchase-detail" class="input" value="${escapeHtml(purchaseValue)}" onchange="setAddPurchaseDate(this.value)">
            </div>
            <div class="quick-date-field">
                <label>Ngày hết hạn</label>
                <input type="date" id="add-expiry-detail" class="input" value="${defaultExpiryValue}" onchange="setExpiryDate(inputValueToDate(this.value), 'tùy chỉnh')">
            </div>
        </div>
    </div>

    <div class="form-section-title">Ghi chú ${renderHintButton('Quét text rồi bấm Copy hoặc Code để đánh dấu. Link http/https sẽ tự nhận diện khi lưu.')}</div>
    <div class="note-input-wrap">
        <div class="note-toolbar">
            <button type="button" class="note-toolbar-btn" onclick="wrapNoteSelection('copy')">${renderNoteToolbarIcon('copy')} Copy</button>
            <span class="note-toolbar-separator"></span>
            <button type="button" class="note-toolbar-btn" onclick="wrapNoteSelection('code')">${renderNoteToolbarIcon('code')} Code</button>
        </div>
        <textarea class="textarea-paste" id="add-note" placeholder="Ghi chú thông minh...
[copy]BACKUP-ABC-123[/copy]
https://example.com" style="min-height:110px">${escapeHtml(editData?.note || '')}</textarea>
    </div>

    <div class="form-section-title">Ngu&#7891;n g&#7889;c / Ng&#432;&#7901;i b&#225;n <span class="optional-label">(T&#249;y ch&#7885;n)</span></div>
    <div class="input-group" style="margin-bottom:8px">
        <input type="text" id="add-seller-name" class="input" placeholder=" " style="padding-left:16px" value="${escapeHtml(editData?.sellerName || '')}">
        <label for="add-seller-name" class="input-label" style="left:16px">T&#234;n ng&#432;&#7901;i b&#225;n</label>
    </div>
    ${renderSellerPlatformPicker(editData?.sellerPlatform || 'other', editData?.sellerLink || '')}

    <div class="form-section-title">Giá mua <span class="optional-label">(Tùy chọn)</span></div>
    <div class="input-group price-input-group" style="margin-bottom:8px">
        <input type="text" id="add-price" class="input" inputmode="numeric" autocomplete="off" placeholder=" " style="padding-left:16px" value="${editData?.purchasePrice ? formatPriceInput(editData.purchasePrice) : ''}" oninput="formatPriceField(this)">
        <label for="add-price" class="input-label" style="left:16px">VD: 50.000 (để trống nếu không nhập)</label>
        <span class="price-suffix" aria-hidden="true">₫</span>
    </div>

    <div class="form-section-title add-advanced-title">Tùy chọn nâng cao</div>
    ${renderCollapsibleSection('category', '📁', `Danh mục (${defaultCategoryIds.length})`, categoryContent)}
    ${saveButton}`;
}
