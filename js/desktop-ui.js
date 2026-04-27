/* Ting! — Desktop UI Renderer */

// ===== TOAST =====
function showToast(msg, type='success') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `${type==='success'?'✓':'✕'} ${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 2500);
}

// ===== MODAL =====
function openModal(title, html) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('modal-overlay').classList.remove('open');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeJsString(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}

function escapeJsAttr(value) {
    return escapeHtml(escapeJsString(value));
}

function canShowSecretActions(acc) {
    if (!acc || acc.type !== 'personal') return true;
    return Boolean(window.appState?.isDemo || window.appState?.masterUnlocked);
}

function getMaskedAccountUsername(acc) {
    return acc?.displayUsername || maskUsername(acc?.username || '');
}

function renderEyeButton(accId, field, title = 'Hiện') {
    return `<button class="copy-btn" onclick="revealField('${escapeJsAttr(accId)}','${escapeJsAttr(field)}')" title="${escapeHtml(title)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg></button>`;
}

function renderCopyButton(accId, field, title = 'Copy') {
    return `<button class="copy-btn" onclick="copyField('${escapeJsAttr(accId)}','${escapeJsAttr(field)}')" title="${escapeHtml(title)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>`;
}

function slugifyGroup(value) {
    return String(value || 'unknown')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'unknown';
}

function getPlatformLabel(platform, accounts = []) {
    const map = {
        youtube: 'YouTube',
        canva: 'Canva',
        capcut: 'CapCut',
        netflix: 'Netflix',
        spotify: 'Spotify',
        adobe: 'Adobe',
        google: 'Google',
        microsoft: 'Microsoft 365',
        openai: 'ChatGPT / OpenAI',
        midjourney: 'Midjourney',
        github: 'GitHub',
        discord: 'Discord',
        notion: 'Notion',
        figma: 'Figma',
        zoom: 'Zoom',
        apple: 'Apple / iCloud',
        'google-ai': 'Gemini',
        anthropic: 'Claude / Anthropic',
        suno: 'Suno',
    };
    if (platform && map[platform]) return map[platform];
    return accounts[0]?.name || 'Khác';
}

function getAccountGroupKey(acc) {
    const platform = getResolvedPlatform(acc);
    if (platform) return `platform-${slugifyGroup(platform)}`;
    return `service-${slugifyGroup(normalizeServiceName(acc.name))}`;
}

function getWorstGroupStatus(accounts) {
    if (accounts.some(a => a.status === 'expired')) return 'expired';
    if (accounts.some(a => a.status === 'expiring')) return 'expiring';
    return 'active';
}

function getNearestFixedAccount(accounts) {
    return accounts
        .filter(a => a.expiryType !== 'lifetime' && a.expiryDate)
        .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate))[0] || null;
}

function buildAccountDisplayItems(accounts) {
    const groupMap = new Map();
    accounts.forEach((acc, index) => {
        const key = getAccountGroupKey(acc);
        if (!groupMap.has(key)) {
            groupMap.set(key, {
                key,
                platform: getResolvedPlatform(acc),
                firstIndex: index,
                accounts: [],
            });
        }
        groupMap.get(key).accounts.push(acc);
    });

    return [...groupMap.values()]
        .sort((a, b) => a.firstIndex - b.firstIndex)
        .map(group => group.accounts.length > 1 ? group : group.accounts[0]);
}

function parseSmartNote(note) {
    const source = String(note || '').trim();
    const urlRegex = /https?:\/\/[^\s<>"')]+/gi;
    const urls = [...new Set(source.match(urlRegex) || [])];
    const copySegments = [];
    const normalLines = [];

    source.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
            normalLines.push('');
            return;
        }

        const copyMatch = trimmed.match(/^(?:\[copy\]|copy\s*:|copy\s*-\s*)(.+)$/i);
        if (copyMatch) {
            copySegments.push(copyMatch[1].trim());
            return;
        }

        normalLines.push(line);
    });

    const displayText = normalLines.join('\n').trim();
    const textWithoutUrls = displayText.replace(urlRegex, '').replace(/\s+/g, ' ').trim();

    return {
        displayText,
        urls,
        copySegments,
        textWithoutUrls,
        hasCombinedAction: Boolean(textWithoutUrls && urls.length > 0),
    };
}

function renderSmartNote(note) {
    const source = String(note || '').trim();
    if (!source) return '';

    const rows = source.split(/\r?\n/).map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '<div class="smart-note-line">&nbsp;</div>';

        const comboMatch = trimmed.match(/^\[(?:open\+copy|copy\+open|link\+copy|copy\+link|combo)\]\s*(.+)$/i);
        if (comboMatch) {
            const action = parseCombinedNoteAction(comboMatch[1]);
            if (action) return `<div class="smart-note-line">${renderCombinedNoteToken(action)}</div>`;
        }

        const copyMatch = trimmed.match(/^(?:\[(?:copy|code)\]|copy\s*:|code\s*:|copy\s*-\s*)(.+)$/i);
        if (copyMatch) return `<div class="smart-note-line">${renderCopyNoteToken(copyMatch[1].trim(), 'Copy')}</div>`;

        return `<div class="smart-note-line">${renderInlineNoteSegments(line)}</div>`;
    }).join('');

    return `<div class="smart-note">${rows}</div>`;
}

// ===== DASHBOARD =====
function renderDashboard() {
    const accs = window.appState.accounts;
    const total = accs.length;
    const bought = accs.filter(a=>a.type==='bought').length;
    const expiring = accs.filter(a=>a.status==='expiring').length;
    const expired = accs.filter(a=>a.status==='expired').length;
    const alerts = accs.filter(a=>a.status==='expiring'||a.status==='expired').slice(0,6);

    let h = `<div class="d-summary-row anim-stagger">
        <div class="d-summary-card anim-fade-in-up">
            <div class="summary-icon total" style="display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>
            <div class="d-summary-info"><div class="d-summary-number">${total}</div><div class="d-summary-label">Tổng tài khoản</div></div>
        </div>
        <div class="d-summary-card anim-fade-in-up">
            <div class="summary-icon total" style="display:flex;align-items:center;justify-content:center;background:rgba(108,92,231,0.1);color:#6C5CE7"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg></div>
            <div class="d-summary-info"><div class="d-summary-number">${bought}</div><div class="d-summary-label">TK Mua</div></div>
        </div>
        <div class="d-summary-card anim-fade-in-up">
            <div class="summary-icon expiring" style="display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg></div>
            <div class="d-summary-info"><div class="d-summary-number">${expiring}</div><div class="d-summary-label">Sắp hết hạn</div></div>
        </div>
        <div class="d-summary-card anim-fade-in-up">
            <div class="summary-icon expired" style="display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
            <div class="d-summary-info"><div class="d-summary-number">${expired}</div><div class="d-summary-label">Đã hết hạn</div></div>
        </div>
    </div>`;

    if (total > 0) h += renderDashboardInsights(accs);

    if (alerts.length > 0) {
        h += `<div class="d-alert-banner anim-fade-in-up"><span style="font-size:22px">⚠️</span><span style="flex:1"><strong>${alerts.length}</strong> tài khoản cần chú ý</span></div>`;
        h += `<div class="section-header"><span class="section-title">Cần chú ý</span></div>`;
        h += `<div class="d-account-grid anim-stagger">${alerts.map(a=>renderDesktopCard(a)).join('')}</div>`;
    }

    const recent = accs.slice(0,8);
    if (recent.length > 0 && alerts.length === 0) {
        h += `<div class="section-header" style="margin-top:20px"><span class="section-title">Gần đây</span><span class="section-badge">${total} TK</span></div>`;
        h += `<div class="d-account-grid anim-stagger">${recent.map(a=>renderDesktopCard(a)).join('')}</div>`;
    } else if (total === 0) {
        h += `<div class="d-empty-state anim-fade-in-up"><div class="d-empty-state-icon">📋</div><div class="d-empty-state-title">Chưa có tài khoản nào</div><div class="d-empty-state-desc">Bấm "Thêm TK" ở góc trên phải để bắt đầu</div></div>`;
    }
    document.getElementById('page-content').innerHTML = h;
    drawDashboardChart(accs);
}

function renderDashboardInsights(accounts) {
    const upcoming = accounts
        .filter(a => a.expiryType !== 'lifetime' && a.expiryDate)
        .map(a => ({ ...a, daysLeft: daysUntil(a.expiryDate) }))
        .filter(a => a.daysLeft >= 0 && a.daysLeft <= 30)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 6);

    return `<div class="dashboard-insights anim-fade-in-up">
        <div class="dashboard-chart-panel">
            <div class="section-header"><span class="section-title">Phân bố nền tảng</span></div>
            <canvas id="platform-chart" width="240" height="240" aria-label="Biểu đồ tài khoản theo nền tảng"></canvas>
            <div id="platform-chart-legend" class="chart-legend"></div>
        </div>
        <div class="dashboard-timeline-panel">
            <div class="section-header"><span class="section-title">30 ngày tới</span><span class="section-badge">${upcoming.length} TK</span></div>
            ${upcoming.length ? `<div class="expiry-timeline">${upcoming.map(acc => `
                <button class="timeline-item" onclick="showDetail('${escapeJsAttr(acc.id)}')">
                    <span class="timeline-dot ${acc.daysLeft <= 3 ? 'danger' : acc.daysLeft <= 7 ? 'warning' : ''}"></span>
                    <span class="timeline-main"><strong>${escapeHtml(acc.name)}</strong><small>${formatDateVN(acc.expiryDate)}</small></span>
                    <span class="timeline-days">${acc.daysLeft === 0 ? 'Hôm nay' : `${acc.daysLeft} ngày`}</span>
                </button>`).join('')}</div>` : '<div class="dashboard-empty-mini">Không có tài khoản hết hạn trong 30 ngày tới</div>'}
        </div>
    </div>`;
}

function drawDashboardChart(accounts) {
    const canvas = document.getElementById('platform-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = 84;
    const thickness = 34;
    const counts = accounts.reduce((map, acc) => {
        const label = getPlatformLabel(getResolvedPlatform(acc) || acc.platform, [acc]);
        map.set(label, (map.get(label) || 0) + 1);
        return map;
    }, new Map());
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    const palette = ['#6C5CE7', '#10B981', '#F59E0B', '#EF4444', '#2563EB', '#DB2777', '#64748B'];
    ctx.clearRect(0, 0, size, size);
    if (!total) return;

    let start = -Math.PI / 2;
    entries.forEach(([label, count], index) => {
        const angle = (count / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(center, center, radius, start, start + angle);
        ctx.lineWidth = thickness;
        ctx.strokeStyle = palette[index % palette.length];
        ctx.lineCap = 'round';
        ctx.stroke();
        start += angle;
    });

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#1A1A2E';
    ctx.font = '700 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(accounts.length), center, center - 8);
    ctx.font = '500 12px Inter, sans-serif';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#6B7280';
    ctx.fillText('tài khoản', center, center + 18);

    const legend = document.getElementById('platform-chart-legend');
    if (legend) {
        legend.innerHTML = entries.map(([label, count], index) => `
            <span class="chart-legend-item"><i style="background:${palette[index % palette.length]}"></i>${escapeHtml(label)} (${count})</span>
        `).join('');
    }
}

// ===== ACCOUNT LIST =====
function renderAccountList(type) {
    const accs = window.appState.accounts.filter(a=>a.type===type);
    const filter = window.appState.currentFilter || 'all';
    const search = window.appState.searchQuery || '';
    let filtered = accs;
    if (filter!=='all') filtered = filtered.filter(a=>a.status===filter);
    if (search) filtered = filtered.filter(a=>{
        const q = search.toLowerCase();
        const platformLabel = getPlatformLabel(getResolvedPlatform(a), [a]).toLowerCase();
        return (a.name || '').toLowerCase().includes(q)
            || (a.displayUsername || '').toLowerCase().includes(q)
            || platformLabel.includes(q);
    });

    const title = type==='bought' ? 'Tài khoản mua' : 'Tài khoản cá nhân';
    let h = `<div class="d-filter-row">
        <div class="d-filter-tabs">
            <button class="filter-tab ${filter==='all'?'active':''}" onclick="setFilter('all')">Tất cả (${accs.length})</button>
            <button class="filter-tab ${filter==='active'?'active':''}" onclick="setFilter('active')">Hoạt động</button>
            <button class="filter-tab ${filter==='expiring'?'active':''}" onclick="setFilter('expiring')">Sắp hết</button>
            <button class="filter-tab ${filter==='expired'?'active':''}" onclick="setFilter('expired')">Đã hết</button>
        </div>
    </div>`;

    if (filtered.length > 0) {
        const displayItems = buildAccountDisplayItems(filtered);
        h += `<div class="d-account-stack anim-stagger">${displayItems.map(item => Array.isArray(item.accounts)
            ? renderAccountGroup(item, type === 'personal')
            : renderDesktopCard(item, type === 'personal')).join('')}</div>`;
    } else {
        h += `<div class="d-empty-state anim-fade-in-up"><div class="d-empty-state-icon">${type==='personal'?'🔒':'🛒'}</div><div class="d-empty-state-title">Không có tài khoản nào</div><div class="d-empty-state-desc">${filter!=='all'?'Thử đổi bộ lọc':'Bấm "Thêm TK" để thêm mới'}</div></div>`;
    }
    document.getElementById('page-content').innerHTML = h;
}

function renderAccountGroup(group, isPersonal=false) {
    const accounts = group.accounts;
    const label = getPlatformLabel(group.platform, accounts);
    const emoji = getPlatformEmoji(group.platform);
    const status = getWorstGroupStatus(accounts);
    const expiredCount = accounts.filter(a => a.status === 'expired').length;
    const expiringCount = accounts.filter(a => a.status === 'expiring').length;
    const activeCount = accounts.filter(a => a.status === 'active').length;
    const expanded = Boolean(window.appState.expandedGroups[group.key]);
    const summaryParts = [];
    if (activeCount) summaryParts.push(`${activeCount} hoạt động`);
    if (expiringCount) summaryParts.push(`${expiringCount} sắp hết`);
    if (expiredCount) summaryParts.push(`${expiredCount} hết hạn`);
    const expirySummary = getGroupExpirySummary(accounts);
    const dateChips = renderGroupDateChips(accounts);

    return `
    <div class="account-group anim-fade-in-up">
        <button class="account-group-header" onclick="toggleAccountGroup('${escapeJsAttr(group.key)}')">
            <div class="account-logo group-logo" style="background:${stringToColor(label)}15;color:${stringToColor(label)}">${emoji}</div>
            <div class="account-group-info">
                <div class="account-group-title">${escapeHtml(label)} <span class="account-group-count">${accounts.length} TK</span></div>
                <div class="account-group-meta">${escapeHtml(summaryParts.join(' • ') || 'Không có trạng thái')} • ${escapeHtml(expirySummary)}</div>
                ${dateChips}
            </div>
            <span class="account-badge ${getStatusBadgeClass(status)}">${getStatusText(status)}</span>
            <span class="account-group-chevron ${expanded ? 'open' : ''}">⌄</span>
        </button>
        ${expanded ? `<div class="account-group-children">${accounts.map(a => renderDesktopCard(a, isPersonal, true)).join('')}</div>` : ''}
    </div>`;
}

function renderGroupDateChips(accounts) {
    const fixed = accounts.filter(a => a.expiryType !== 'lifetime' && a.expiryDate);
    const lifetimeCount = accounts.length - fixed.length;
    const dateCounts = fixed.reduce((map, acc) => {
        map.set(acc.expiryDate, (map.get(acc.expiryDate) || 0) + 1);
        return map;
    }, new Map());

    const chips = [...dateCounts.entries()]
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .slice(0, 4)
        .map(([date, count]) => {
            const status = getStatusFromExpiry(date, 'fixed');
            return `<span class="account-group-date-chip ${getStatusBadgeClass(status)}">${formatDateVN(date)}${count > 1 ? ` ×${count}` : ''}</span>`;
        });

    if (dateCounts.size > 4) chips.push(`<span class="account-group-date-chip">+${dateCounts.size - 4} ngày</span>`);
    if (lifetimeCount) chips.push(`<span class="account-group-date-chip badge-active">Vĩnh viễn ×${lifetimeCount}</span>`);
    return chips.length ? `<div class="account-group-dates">${chips.join('')}</div>` : '';
}

// ===== DESKTOP CARD =====
function renderDesktopCard(acc, isPersonal=false, isChild=false) {
    const secretCard = isPersonal || acc.type === 'personal';
    const canCopy = canShowSecretActions(acc);
    const revealedUsername = getRevealedSecret?.(acc.id, 'username');
    const revealedPassword = getRevealedSecret?.(acc.id, 'password');
    const usernameText = revealedUsername || getMaskedAccountUsername(acc);
    const passwordText = revealedPassword || '******';
    const days = daysUntil(acc.expiryDate);
    const daysText = acc.expiryType==='lifetime' ? '♾️ Vĩnh viễn' : days<0 ? `Hết ${Math.abs(days)} ngày` : days===0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`;
    const emoji = getPlatformEmoji(getResolvedPlatform(acc) || acc.platform);
    const accountActions = secretCard
        ? `${renderEyeButton(acc.id, 'username', 'Hiện tài khoản')}${canCopy ? renderCopyButton(acc.id, 'username', 'Copy tài khoản') : ''}${renderEyeButton(acc.id, 'password', 'Hiện mật khẩu')}${canCopy ? renderCopyButton(acc.id, 'password', 'Copy mật khẩu') : ''}`
        : `${renderCopyButton(acc.id, 'username', 'Copy tài khoản')}${renderCopyButton(acc.id, 'password', 'Copy mật khẩu')}`;
    return `
    <div class="d-account-card ${isChild ? 'account-child-card' : ''} anim-fade-in-up" onclick="showDetail('${acc.id}')">
        <div class="d-account-card-top">
            <div class="account-logo" style="background:${stringToColor(acc.name)}15;color:${stringToColor(acc.name)}">${emoji}</div>
            <div class="account-info">
                <div class="account-name">${escapeHtml(acc.name)}</div>
                <div class="account-user">${escapeHtml(usernameText)}</div>
                ${secretCard ? `<div class="account-secret-line"><span>Mật khẩu</span><strong>${escapeHtml(passwordText)}</strong></div>` : ''}
            </div>
            <span class="account-badge ${getStatusBadgeClass(acc.status)}">${getStatusText(acc.status)}</span>
        </div>
        <div class="d-account-card-bottom">
            <span class="account-days">${daysText}</span>
            <div class="account-actions" onclick="event.stopPropagation()">
                ${accountActions}
            </div>
        </div>
        ${secretCard?'<span class="lock-icon">🔒</span>':''}
    </div>`;
}

// ===== DETAIL =====
function renderDetail(accId) {
    const acc = window.appState.accounts.find(a=>a.id===accId);
    if (!acc) return;
    const days = daysUntil(acc.expiryDate);
    const emoji = getPlatformEmoji(getResolvedPlatform(acc) || acc.platform);
    const isP = acc.type==='personal';
    const decrypted = window.appState.activeDecryptedAccount?.id === accId
        ? window.appState.activeDecryptedAccount.data
        : null;
    const canCopy = canShowSecretActions(acc);
    const revealedUsername = getRevealedSecret?.(accId, 'username');
    const revealedPassword = getRevealedSecret?.(accId, 'password');
    const revealedTwoFa = getRevealedSecret?.(accId, 'twoFaCode');
    const usernameText = revealedUsername || getMaskedAccountUsername(acc);
    const passwordText = revealedPassword || '******';
    const twoFaText = revealedTwoFa || '******';
    const noteText = decrypted?.note || '';
    const hasTwoFa = Boolean(decrypted?.twoFaCode);

    let h = `
    <button class="back-btn" onclick="goBack()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="15,18 9,12 15,6"/></svg> Quay lại</button>
    <div class="d-detail-layout">
        <div class="d-detail-full">
            <div class="detail-header anim-fade-in-up">
                <div class="detail-logo" style="background:${stringToColor(acc.name)}15;color:${stringToColor(acc.name)};width:64px;height:64px;font-size:28px">${emoji}</div>
                <div><div class="detail-name">${acc.name}</div><span class="account-badge ${getStatusBadgeClass(acc.status)}">${getStatusText(acc.status)}</span></div>
            </div>
        </div>
        <div class="detail-section anim-fade-in-up">
            <div class="detail-row"><span class="detail-label">Tài khoản</span><span class="detail-value secret-value">${escapeHtml(usernameText)} ${renderEyeButton(acc.id, 'username', 'Hiện tài khoản')} ${canCopy ? renderCopyButton(acc.id, 'username', 'Copy tài khoản') : ''}</span></div>
            <div class="detail-row"><span class="detail-label">Mật khẩu</span><span class="detail-value secret-value">${escapeHtml(passwordText)} ${renderEyeButton(acc.id, 'password', 'Hiện mật khẩu')} ${canCopy ? renderCopyButton(acc.id, 'password', 'Copy mật khẩu') : ''}</span></div>
            ${hasTwoFa?`<div class="detail-row"><span class="detail-label">2FA</span><span class="detail-value secret-value">${escapeHtml(twoFaText)} ${renderEyeButton(acc.id, 'twoFaCode', 'Hiện 2FA')} ${canCopy ? renderCopyButton(acc.id, '2fa', 'Copy 2FA') : ''}</span></div>`:''}
            ${noteText?`<div class="detail-row detail-note-row"><span class="detail-label">Ghi chú</span><div class="detail-note-value">${renderSmartNote(noteText)}</div></div>`:''}
        </div>
        <div class="detail-section anim-fade-in-up">
            <div class="detail-row"><span class="detail-label">Ngày mua</span><span class="detail-value">${formatDateVN(acc.purchaseDate)}</span></div>
            <div class="detail-row"><span class="detail-label">Hết hạn</span><span class="detail-value">${acc.expiryType==='lifetime'?'♾️ Vĩnh viễn':formatDateVN(acc.expiryDate)}</span></div>
            ${acc.expiryType!=='lifetime'?`<div class="detail-row"><span class="detail-label">Còn lại</span><span class="detail-value" style="color:${days<0?'var(--danger)':days<=5?'var(--warning)':'var(--success)'}">${days<0?'Đã hết '+Math.abs(days)+' ngày':days+' ngày'}</span></div>`:''}
            ${acc.expiryType!=='lifetime'?`<div style="margin-top:12px"><div style="font-size:13px;font-weight:600;margin-bottom:8px">Gia hạn nhanh</div><div class="renew-options"><button class="renew-btn" onclick="renewAccount('${acc.id}',7)">+7 ngày</button><button class="renew-btn" onclick="renewAccount('${acc.id}',15)">+15</button><button class="renew-btn" onclick="renewAccount('${acc.id}',30)">+30</button><button class="renew-btn" onclick="renewAccount('${acc.id}',90)">+90</button><button class="renew-btn" onclick="renewAccount('${acc.id}',365)">+365</button></div></div>`:''}
        </div>
        <div class="d-detail-full" style="display:flex;gap:12px;margin-top:8px">
            <button class="btn btn-outline btn-sm" onclick="editAccount('${acc.id}')">✏️ Sửa</button>
            <button class="btn btn-danger-outline btn-sm" onclick="deleteAccount('${acc.id}')">🗑️ Xoá</button>
        </div>
    </div>`;
    document.getElementById('page-content').innerHTML = h;
}

// ===== SETTINGS =====
function renderUpdateStatus() {
    const status = window.appState.updateStatus;
    if (!status) return '<div class="settings-item-desc">Chưa kiểm tra trong phiên này</div>';
    return `<div class="settings-item-desc">${escapeHtml(status.message || status.status || 'Đang chờ')}</div>`;
}

function renderUpdateLog() {
    const log = window.appState.updateLog || [];
    if (!log.length) return '<div class="settings-empty-log">Chưa có lịch sử cập nhật</div>';
    return `<div class="settings-update-log">${log.slice(0, 5).map(item => `
        <div class="settings-update-log-row">
            <span>${escapeHtml(item.version || 'unknown')}</span>
            <small>${escapeHtml(item.date || '')}</small>
        </div>`).join('')}</div>`;
}

function renderSettings() {
    const settings = window.appState.settings || {};
    const isElectron = Boolean(window.electronAPI?.isElectron);
    const autoLock = Number(settings.autoLockMinutes ?? 5);
    const updateReady = window.appState.updateStatus?.status === 'downloaded';
    document.getElementById('page-content').innerHTML = `
    <div class="d-settings-layout">
        <div class="settings-group"><div class="settings-group-title">Bảo mật</div><div class="settings-card">
            <div class="settings-item" onclick="showToast('Sẽ có sau khi kết nối Firebase')"><div class="settings-item-icon" style="background:var(--accent-bg)">🔑</div><div class="settings-item-content"><div class="settings-item-title">Đổi Master Password</div><div class="settings-item-desc">Bảo vệ tài khoản cá nhân</div></div><svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg></div>
            <label class="settings-item settings-control ${isElectron ? '' : 'disabled'}"><div class="settings-item-icon" style="background:var(--warning-bg)">🔒</div><div class="settings-item-content"><div class="settings-item-title">Tự khoá sau</div><div class="settings-item-desc">${isElectron ? 'Khoá Master Password khi máy không hoạt động' : 'Chỉ khả dụng trên bản desktop'}</div></div><select class="settings-select" onchange="handleAutoLockChange(this.value)" ${isElectron ? '' : 'disabled'}><option value="1" ${autoLock===1?'selected':''}>1 phút</option><option value="5" ${autoLock===5?'selected':''}>5 phút</option><option value="15" ${autoLock===15?'selected':''}>15 phút</option><option value="30" ${autoLock===30?'selected':''}>30 phút</option><option value="0" ${autoLock===0?'selected':''}>Tắt</option></select></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--danger-bg)">🧹</div><div class="settings-item-content"><div class="settings-item-title">Tự xoá clipboard sau 30s</div><div class="settings-item-desc">Áp dụng khi copy mật khẩu, 2FA hoặc mã</div></div><input class="settings-toggle" type="checkbox" onchange="handleClipboardAutoClearToggle(this)" ${settings.clipboardAutoClear ? 'checked' : ''}></label>
        </div></div>
        <div class="settings-group"><div class="settings-group-title">Desktop</div><div class="settings-card">
            <label class="settings-item settings-control ${isElectron ? '' : 'disabled'}"><div class="settings-item-icon" style="background:var(--success-bg)">🚀</div><div class="settings-item-content"><div class="settings-item-title">Tự khởi động cùng Windows</div><div class="settings-item-desc">${isElectron ? 'Mở Ting! khi đăng nhập Windows' : 'Chỉ khả dụng trên bản desktop'}</div></div><input class="settings-toggle" type="checkbox" onchange="handleAutoStartToggle(this)" ${settings.autoStart ? 'checked' : ''} ${isElectron ? '' : 'disabled'}></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--accent-bg)">🌗</div><div class="settings-item-content"><div class="settings-item-title">Giao diện</div><div class="settings-item-desc">Theo hệ thống, sáng hoặc tối</div></div><select class="settings-select" onchange="handleThemeChange(this.value)"><option value="system" ${settings.theme==='system'?'selected':''}>Hệ thống</option><option value="light" ${settings.theme==='light'?'selected':''}>Sáng</option><option value="dark" ${settings.theme==='dark'?'selected':''}>Tối</option></select></label>
        </div></div>
        <div class="settings-group"><div class="settings-group-title">Thông báo</div><div class="settings-card">
            <div class="settings-item" onclick="showNotifications()"><div class="settings-item-icon" style="background:var(--warning-bg)">🔔</div><div class="settings-item-content"><div class="settings-item-title">Tài khoản cần chú ý</div><div class="settings-item-desc">${getNotificationList?.(window.appState.accounts).length || 0} tài khoản sắp hoặc đã hết hạn</div></div><svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg></div>
            <div class="settings-item"><div class="settings-item-icon" style="background:var(--success-bg)">📅</div><div class="settings-item-content"><div class="settings-item-title">Gia hạn mặc định</div><div class="settings-item-desc">30 ngày</div></div></div>
        </div></div>
        <div class="settings-group"><div class="settings-group-title">Phiên bản</div><div class="settings-card">
            <div class="settings-item"><div class="settings-item-icon" style="background:#E0F2FE">⬆️</div><div class="settings-item-content"><div class="settings-item-title">Ting! v${escapeHtml(window.appState.appVersion || '1.0.0')}</div>${renderUpdateStatus()}</div><button class="btn btn-sm btn-outline settings-inline-btn" onclick="checkForUpdates()" ${isElectron ? '' : 'disabled'}>Kiểm tra</button></div>
            ${updateReady ? `<div class="settings-item"><div class="settings-item-icon" style="background:var(--success-bg)">✅</div><div class="settings-item-content"><div class="settings-item-title">Bản cập nhật đã sẵn sàng</div><div class="settings-item-desc">Khởi động lại để cài đặt</div></div><button class="btn btn-sm btn-primary settings-inline-btn" onclick="installDownloadedUpdate()">Cài đặt</button></div>` : ''}
            <div class="settings-log-wrap">${renderUpdateLog()}</div>
        </div></div>
        <div class="settings-group"><div class="settings-group-title">Dữ liệu</div><div class="settings-card">
            <div class="settings-item"><div class="settings-item-icon" style="background:#E0F2FE">📤</div><div class="settings-item-content"><div class="settings-item-title">Xuất dữ liệu (JSON)</div><div class="settings-item-desc">Sao lưu mã hoá</div></div><svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg></div>
            <div class="settings-item"><div class="settings-item-icon" style="background:#E0F2FE">📥</div><div class="settings-item-content"><div class="settings-item-title">Nhập dữ liệu</div><div class="settings-item-desc">Khôi phục từ JSON</div></div><svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg></div>
        </div></div>
    </div>`;
}

// ===== NOTIFICATIONS =====
function renderNotificationPanel(items = getNotificationList(window.appState.accounts)) {
    const panel = document.getElementById('notification-dropdown');
    if (!panel) return;
    const list = items || [];
    panel.innerHTML = `
        <div class="notification-panel-head">
            <strong>Thông báo hết hạn</strong>
            <span>${list.length} mục</span>
        </div>
        ${list.length ? `<div class="notification-list">${list.map(item => {
            const days = item.daysLeft;
            const text = days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`;
            return `<div class="notification-item ${days < 0 ? 'expired' : days <= 3 ? 'urgent' : ''}">
                <div class="notification-icon">${days < 0 ? '⛔' : '⏰'}</div>
                <div class="notification-info">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(text)} • ${formatDateVN(item.expiryDate)}</span>
                </div>
                <button class="renew-btn" onclick="renewAccount('${escapeJsAttr(item.id)}',30)">Gia hạn</button>
            </div>`;
        }).join('')}</div>` : '<div class="notification-empty">🎉 Tất cả đều ổn!</div>'}
    `;
}

function toggleNotificationPanel() {
    const panel = document.getElementById('notification-dropdown');
    if (!panel) return;
    if (!panel.hidden) {
        closeNotificationPanel();
        return;
    }
    renderNotificationPanel();
    panel.hidden = false;
    panel.classList.add('open');
}

function closeNotificationPanel() {
    const panel = document.getElementById('notification-dropdown');
    if (!panel) return;
    panel.hidden = true;
    panel.classList.remove('open');
}

// ===== SPOTLIGHT =====
function getSpotlightMatches(query = '') {
    const q = query.trim().toLowerCase();
    const accounts = window.appState.accounts || [];
    return accounts
        .filter(acc => {
            if (!q) return true;
            const platformLabel = getPlatformLabel(getResolvedPlatform(acc) || acc.platform, [acc]).toLowerCase();
            return (acc.name || '').toLowerCase().includes(q)
                || (acc.displayUsername || '').toLowerCase().includes(q)
                || platformLabel.includes(q);
        })
        .slice(0, 8);
}

function openSpotlight() {
    if (!window.appState?.isLoggedIn) return;
    const overlay = document.getElementById('spotlight-overlay');
    const input = document.getElementById('spotlight-input');
    if (!overlay || !input) return;
    overlay.style.display = 'flex';
    input.value = '';
    renderSpotlightResults('');
    setTimeout(() => input.focus(), 30);
}

function closeSpotlight(event) {
    if (event && event.target !== event.currentTarget) return;
    const overlay = document.getElementById('spotlight-overlay');
    if (overlay) overlay.style.display = 'none';
}

function renderSpotlightResults(query) {
    const box = document.getElementById('spotlight-results');
    if (!box) return;
    const matches = getSpotlightMatches(query);
    box.innerHTML = matches.length ? matches.map((acc, index) => `
        <button class="spotlight-result ${index === 0 ? 'active' : ''}" onclick="openSpotlightResult('${escapeJsAttr(acc.id)}')">
            <span class="spotlight-logo" style="background:${stringToColor(acc.name)}15;color:${stringToColor(acc.name)}">${getPlatformEmoji(getResolvedPlatform(acc) || acc.platform)}</span>
            <span class="spotlight-info"><strong>${escapeHtml(acc.name)}</strong><small>${escapeHtml(getMaskedAccountUsername(acc))}</small></span>
            <span class="account-badge ${getStatusBadgeClass(acc.status)}">${getStatusText(acc.status)}</span>
        </button>
    `).join('') : '<div class="spotlight-empty">Không tìm thấy tài khoản</div>';
}

function openSpotlightResult(id) {
    const overlay = document.getElementById('spotlight-overlay');
    if (overlay) overlay.style.display = 'none';
    showDetail(id);
}

// ===== ADD FORM =====
function renderAddForm(type) {
    return `
    <div class="form-section-title">Dán thông tin tài khoản</div>
    <textarea class="textarea-paste" id="paste-input" placeholder="user@email.com|password123|2FA_CODE" oninput="previewParse()"></textarea>
    <div id="parse-preview"></div>
    <div class="form-section-title">Tên dịch vụ</div>
    <div class="input-group" style="margin-bottom:8px"><input type="text" id="add-name" class="input" placeholder=" " style="padding-left:16px" oninput="autoDetectPlatform()"><label for="add-name" class="input-label" style="left:16px">VD: Netflix, Canva...</label></div>
    <div id="platform-detect" style="font-size:13px;color:var(--text-secondary);margin-bottom:16px"></div>
    <div class="form-section-title">Thời hạn</div>
    <div style="display:flex;gap:12px;margin-bottom:16px">
        <div style="flex:1"><label style="font-size:12px;color:var(--text-secondary)">Ngày mua</label><input type="date" id="add-purchase" class="input" style="padding:12px;margin-top:4px" value="${todayStr()}"></div>
        <div style="flex:1"><label style="font-size:12px;color:var(--text-secondary)">Ngày hết hạn</label><input type="date" id="add-expiry" class="input" style="padding:12px;margin-top:4px"></div>
    </div>
    <label style="display:flex;align-items:center;gap:8px;font-size:14px;margin-bottom:16px;cursor:pointer"><input type="checkbox" id="add-lifetime" onchange="document.getElementById('add-expiry').disabled=this.checked"> Vĩnh viễn</label>
    <div class="form-section-title">Ghi chú</div>
    <textarea class="textarea-paste" id="add-note" placeholder="Ghi chú thông minh. VD:
[copy] BACKUP-ABC-123
https://example.com
[open+copy] https://example.com | BACKUP-ABC-123
Hoặc inline: mã [copy]ABC-123[/copy]" style="min-height:110px"></textarea>
    <button class="btn btn-primary" style="margin-top:24px" onclick="saveNewAccount('${type}')">💾 Lưu tài khoản</button>`;
}
