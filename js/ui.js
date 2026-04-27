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

// ===== RENDER: DASHBOARD =====
function renderDashboard() {
    const accounts = window.appState.accounts;
    const total = accounts.length;
    const expiring = accounts.filter(a => a.status === 'expiring').length;
    const expired = accounts.filter(a => a.status === 'expired').length;
    const expiringAccounts = accounts.filter(a => a.status === 'expiring' || a.status === 'expired').slice(0, 5);

    let html = `
        <div class="summary-row anim-stagger">
            <div class="summary-card anim-fade-in-up">
                <div class="summary-icon total">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                </div>
                <div class="summary-number">${total}</div>
                <div class="summary-label">Tổng tài khoản</div>
            </div>
            <div class="summary-card anim-fade-in-up">
                <div class="summary-icon expiring">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                </div>
                <div class="summary-number">${expiring}</div>
                <div class="summary-label">Sắp hết hạn</div>
            </div>
            <div class="summary-card anim-fade-in-up">
                <div class="summary-icon expired">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <div class="summary-number">${expired}</div>
                <div class="summary-label">Đã hết hạn</div>
            </div>
        </div>`;

    // Cảnh báo sắp hết hạn
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

    // Tài khoản gần đây
    const recent = accounts.slice(0, 5);
    if (recent.length > 0) {
        html += `<div class="section-header" style="margin-top:24px"><span class="section-title">Gần đây</span><span class="section-badge">${total} TK</span></div>`;
        html += `<div class="account-list anim-stagger">`;
        recent.forEach(acc => { html += renderAccountCard(acc); });
        html += `</div>`;
    }

    if (total === 0) {
        html += `<div class="empty-state anim-fade-in-up"><div class="empty-state-icon">📋</div><div class="empty-state-title">Chưa có tài khoản nào</div><div class="empty-state-desc">Bấm nút + bên dưới để thêm tài khoản đầu tiên</div></div>`;
    }

    document.getElementById('page-content').innerHTML = html;
}

// ===== RENDER: DANH SÁCH TK =====
function renderAccountList(type) {
    const accounts = window.appState.accounts.filter(a => a.type === type);
    const filter = window.appState.currentFilter || 'all';
    const search = window.appState.searchQuery || '';

    let filtered = accounts;
    if (filter !== 'all') filtered = filtered.filter(a => a.status === filter);
    if (search) filtered = filtered.filter(a => {
        const q = search.toLowerCase();
        const platformLabel = getPlatformLabel(getResolvedPlatform(a), [a]).toLowerCase();
        return (a.name || '').toLowerCase().includes(q)
            || (a.displayUsername || '').toLowerCase().includes(q)
            || platformLabel.includes(q);
    });

    const title = type === 'bought' ? 'Tài khoản mua' : 'Tài khoản cá nhân';
    let html = `
        <div class="section-header"><span class="section-title">${title}</span><span class="section-badge">${filtered.length}</span></div>
        <div class="filter-tabs">
            <button class="filter-tab ${filter==='all'?'active':''}" onclick="setFilter('all')">Tất cả</button>
            <button class="filter-tab ${filter==='active'?'active':''}" onclick="setFilter('active')">Hoạt động</button>
            <button class="filter-tab ${filter==='expiring'?'active':''}" onclick="setFilter('expiring')">Sắp hết</button>
            <button class="filter-tab ${filter==='expired'?'active':''}" onclick="setFilter('expired')">Đã hết</button>
        </div>`;

    if (filtered.length > 0) {
        html += `<div class="account-list anim-stagger">`;
        buildAccountDisplayItems(filtered).forEach(item => {
            html += item.accounts ? renderAccountGroup(item, type === 'personal') : renderAccountCard(item, type === 'personal');
        });
        html += `</div>`;
    } else {
        const emptyIcon = type === 'personal' ? '🔒' : '🛒';
        html += `<div class="empty-state anim-fade-in-up"><div class="empty-state-icon">${emptyIcon}</div><div class="empty-state-title">Không có tài khoản nào</div><div class="empty-state-desc">${filter !== 'all' ? 'Thử đổi bộ lọc khác' : 'Bấm + để thêm mới'}</div></div>`;
    }

    document.getElementById('page-content').innerHTML = html;
}

function renderAccountGroup(group, isPersonal = false) {
    const accounts = group.accounts;
    const label = getPlatformLabel(group.platform, accounts);
    const emoji = getPlatformEmoji(group.platform);
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
            <div class="account-logo group-logo" style="background:${stringToColor(label)}20;color:${stringToColor(label)}">${emoji}</div>
            <div class="account-group-info">
                <div class="account-group-title">${escapeHtml(label)} <span class="account-group-count">${accounts.length} TK</span></div>
                <div class="account-group-meta">${escapeHtml(summaryParts.join(' • ') || 'Không có trạng thái')}</div>
                <div class="account-group-meta">${escapeHtml(getGroupExpirySummary(accounts))}</div>
            </div>
            <span class="account-badge ${getStatusBadgeClass(status)}">${getStatusText(status)}</span>
            <span class="account-group-chevron ${expanded ? 'open' : ''}">⌄</span>
        </button>
        ${expanded ? `<div class="account-group-children">${accounts.map(acc => renderAccountCard(acc, isPersonal, true)).join('')}</div>` : ''}
    </div>`;
}

// ===== RENDER: CARD TÀI KHOẢN =====
function renderAccountCard(acc, isPersonal = false, isChild = false) {
    const days = daysUntil(acc.expiryDate);
    const daysText = acc.expiryType === 'lifetime' ? 'Vĩnh viễn' : days < 0 ? `Hết ${Math.abs(days)} ngày` : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`;
    const emoji = getPlatformEmoji(getResolvedPlatform(acc) || acc.platform);
    const statusClass = getStatusBadgeClass(acc.status);
    const statusText = getStatusText(acc.status);

    return `
    <div class="account-card ${isChild ? 'account-child-card' : ''} anim-fade-in-up" onclick="showDetail('${acc.id}')">
        <div class="account-card-top">
            <div class="account-logo" style="background:${stringToColor(acc.name)}20;color:${stringToColor(acc.name)}">${emoji}</div>
            <div class="account-info">
                <div class="account-name">${escapeHtml(acc.name)}</div>
                <div class="account-user">${isPersonal ? '••••••••' : escapeHtml(acc.displayUsername || '***')}</div>
            </div>
            <span class="account-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="account-card-bottom">
            <span class="account-days">${acc.expiryType === 'lifetime' ? '♾️ Vĩnh viễn' : daysText}</span>
            <div class="account-actions" onclick="event.stopPropagation()">
                <button class="copy-btn" onclick="copyField('${acc.id}','username')" title="Copy tài khoản">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                </button>
                <button class="copy-btn" onclick="copyField('${acc.id}','password')" title="Copy mật khẩu">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </button>
            </div>
        </div>
        ${isPersonal ? '<span class="lock-icon">🔒</span>' : ''}
    </div>`;
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
            <div class="settings-item" onclick="showToast('Chức năng sẽ có sau khi kết nối Firebase')">
                <div class="settings-item-icon" style="background:var(--danger-bg)">🚪</div>
                <div class="settings-item-content"><div class="settings-item-title" style="color:var(--danger)">Đăng xuất</div></div>
                <svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
            </div>
        </div>
    </div>

    <p style="text-align:center;font-size:12px;color:var(--text-tertiary);margin-top:24px">Ting! v1.0 • Made with 💜</p>`;
}

// ===== RENDER: CHI TIẾT TÀI KHOẢN =====
function renderDetail(accId) {
    const acc = window.appState.accounts.find(a => a.id === accId);
    if (!acc) return;

    const days = daysUntil(acc.expiryDate);
    const emoji = getPlatformEmoji(getResolvedPlatform(acc) || acc.platform);
    const isPersonal = acc.type === 'personal';
    const decrypted = window.appState.activeDecryptedAccount?.id === accId
        ? window.appState.activeDecryptedAccount.data
        : null;
    const usernameText = decrypted?.username || (isPersonal ? '••••••••' : (acc.displayUsername || '***'));
    const noteText = decrypted?.note || '';
    const hasTwoFa = Boolean(decrypted?.twoFaCode);

    let html = `
    <button class="back-btn" onclick="goBack()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>
        Quay lại
    </button>
    <div class="detail-header anim-fade-in-up">
        <div class="detail-logo" style="background:${stringToColor(acc.name)}15;color:${stringToColor(acc.name)}">${emoji}</div>
        <div>
            <div class="detail-name">${escapeHtml(acc.name)}</div>
            <span class="account-badge ${getStatusBadgeClass(acc.status)}">${getStatusText(acc.status)}</span>
        </div>
    </div>

    <div class="detail-section anim-fade-in-up">
        <div class="detail-row">
            <span class="detail-label">Tài khoản</span>
            <span class="detail-value">${escapeHtml(usernameText)}
                <button class="copy-btn" onclick="copyField('${acc.id}','username')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
            </span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Mật khẩu</span>
            <span class="detail-value">••••••••
                <button class="copy-btn" onclick="copyField('${acc.id}','password')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
            </span>
        </div>
        ${hasTwoFa ? `<div class="detail-row"><span class="detail-label">2FA</span><span class="detail-value">••••••<button class="copy-btn" onclick="copyField('${acc.id}','2fa')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></span></div>` : ''}
        ${noteText ? `<div class="detail-row detail-note-row"><span class="detail-label">Ghi chú</span><div class="detail-note-value">${renderSmartNote(noteText)}</div></div>` : ''}
    </div>

    <div class="detail-section anim-fade-in-up">
        <div class="detail-row"><span class="detail-label">Ngày mua</span><span class="detail-value">${formatDateVN(acc.purchaseDate)}</span></div>
        <div class="detail-row"><span class="detail-label">Ngày hết hạn</span><span class="detail-value">${acc.expiryType === 'lifetime' ? '♾️ Vĩnh viễn' : formatDateVN(acc.expiryDate)}</span></div>
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
    </div>` : ''}

    ${acc.renewalHistory && acc.renewalHistory.length > 0 ? `
    <div class="section-header" style="margin-top:20px"><span class="section-title">Lịch sử gia hạn</span></div>
    <div class="detail-section anim-fade-in-up">
        ${acc.renewalHistory.map(r => `<div class="detail-row"><span class="detail-label">${formatDateVN(r.date)}</span><span class="detail-value">+${r.days} ngày</span></div>`).join('')}
    </div>` : ''}

    <div style="display:flex;gap:12px;margin-top:24px">
        <button class="btn btn-outline btn-sm" style="flex:1" onclick="editAccount('${acc.id}')">✏️ Sửa</button>
        <button class="btn btn-danger-outline btn-sm" style="flex:1" onclick="deleteAccount('${acc.id}')">🗑️ Xoá</button>
    </div>`;

    document.getElementById('page-content').innerHTML = html;
}

// ===== RENDER: FORM THÊM TÀI KHOẢN =====
function renderAddForm(type) {
    return `
    <div class="form-section-title">Dán thông tin tài khoản</div>
    <textarea class="textarea-paste" id="paste-input" placeholder="Dán vào đây: user@email.com|password123|2FA_CODE" oninput="previewParse()"></textarea>
    <div id="parse-preview"></div>

    <div class="form-section-title">Tên dịch vụ</div>
    <div class="input-group" style="margin-bottom:8px">
        <input type="text" id="add-name" class="input" placeholder=" " style="padding-left:16px" oninput="autoDetectPlatform()">
        <label for="add-name" class="input-label" style="left:16px">VD: Netflix, Canva...</label>
    </div>
    <div id="platform-detect" style="font-size:13px;color:var(--text-secondary);margin-bottom:16px"></div>

    <div class="form-section-title">Thời hạn</div>
    <div style="display:flex;gap:12px;margin-bottom:16px">
        <div style="flex:1">
            <label style="font-size:12px;color:var(--text-secondary)">Ngày mua</label>
            <input type="date" id="add-purchase" class="input" style="padding:12px;margin-top:4px" value="${todayStr()}">
        </div>
        <div style="flex:1">
            <label style="font-size:12px;color:var(--text-secondary)">Ngày hết hạn</label>
            <input type="date" id="add-expiry" class="input" style="padding:12px;margin-top:4px">
        </div>
    </div>
    <label style="display:flex;align-items:center;gap:8px;font-size:14px;margin-bottom:16px;cursor:pointer">
        <input type="checkbox" id="add-lifetime" onchange="document.getElementById('add-expiry').disabled=this.checked"> Vĩnh viễn (không hết hạn)
    </label>

    <div class="form-section-title">Ghi chú</div>
    <textarea class="textarea-paste" id="add-note" placeholder="Ghi chú thông minh. VD:
[copy] BACKUP-ABC-123
https://example.com
[open+copy] https://example.com | BACKUP-ABC-123
Hoặc inline: mã [copy]ABC-123[/copy]" style="min-height:110px"></textarea>

    <button class="btn btn-primary" style="margin-top:24px" onclick="saveNewAccount('${type}')">
        💾 Lưu tài khoản
    </button>`;
}
