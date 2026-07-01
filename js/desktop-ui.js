/* Ting! — Desktop UI Renderer */

// ===== TOAST =====
function showToast(msg, type='success') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = `${type === 'success' ? '✓' : '✕'} ${msg}`;
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
    return `<button class="copy-btn" onclick="revealField('${escapeJsAttr(accId)}','${escapeJsAttr(field)}')" title="${escapeHtml(title)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg></button>`;
}

function renderCopyButton(accId, field, title = 'Copy') {
    return `<button class="copy-btn" onclick="copyField('${escapeJsAttr(accId)}','${escapeJsAttr(field)}')" title="${escapeHtml(title)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>`;
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

function slugifyGroup(value) {
    return String(value || 'unknown')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'unknown';
}

function getPlatformLabel(platform, accounts = []) {
    if (platform && typeof getPlatformIconConfig === 'function') {
        const icon = getPlatformIconConfig(platform);
        if (icon?.label) return icon.label;
    }
    const map = {
        youtube: 'YouTube',
        canva: 'Canva',
        capcut: 'CapCut',
        netflix: 'Netflix',
        spotify: 'Spotify',
        disneyplus: 'Disney+',
        primevideo: 'Prime Video',
        hulu: 'Hulu',
        appletv: 'Apple TV',
        tiktok: 'TikTok',
        instagram: 'Instagram',
        facebook: 'Facebook',
        x: 'X',
        telegram: 'Telegram',
        whatsapp: 'WhatsApp',
        adobe: 'Adobe',
        gmail: 'Gmail',
        googledrive: 'Google Drive',
        google: 'Google',
        'google-account': 'Google Account',
        'gemini-pro': 'Gemini Pro',
        'google-veo': 'Veo 3',
        'google-antigravity': 'Antigravity',
        microsoft: 'Microsoft 365',
        office365: 'Microsoft 365',
        openai: 'ChatGPT / OpenAI',
        midjourney: 'Midjourney',
        claude: 'Claude',
        perplexity: 'Perplexity',
        cursor: 'Cursor',
        replit: 'Replit',
        huggingface: 'Hugging Face',
        deepseek: 'DeepSeek',
        mistralai: 'Mistral AI',
        elevenlabs: 'ElevenLabs',
        replicate: 'Replicate',
        poe: 'Poe',
        deepl: 'DeepL',
        grammarly: 'Grammarly',
        zapier: 'Zapier',
        make: 'Make',
        n8n: 'n8n',
        '1password': '1Password',
        lastpass: 'LastPass',
        proton: 'Proton',
        protonmail: 'Proton Mail',
        firebase: 'Firebase',
        googlecloud: 'Google Cloud',
        supabase: 'Supabase',
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
    sortAccountsByPriority(accounts).forEach((acc, index) => {
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

const AUTH_METHOD_CONFIG = {
    email: {
        label: 'Email',
        sublabel: 'riêng',
        icon: '<svg class="auth-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 6 10-6"/></svg>',
    },
    google: {
        label: 'Google',
        sublabel: 'SSO',
        icon: '<svg class="auth-google-g" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.72.12-1.43.34-2.09V7.07H2.18A10.95 10.95 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>',
    },
    facebook: {
        label: 'Facebook',
        sublabel: 'SSO',
        icon: '<svg class="auth-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.025 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.414c0-3.026 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.263h3.328l-.532 3.49h-2.796v8.437C19.612 23.093 24 18.098 24 12.073z"/></svg>',
    },
    github: {
        label: 'GitHub',
        sublabel: 'SSO',
        icon: '<svg class="auth-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
    },
    apple: {
        label: 'Apple',
        sublabel: 'SSO',
        icon: '<svg class="auth-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>',
    },
    microsoft: {
        label: 'Microsoft',
        sublabel: 'SSO',
        icon: '<svg class="auth-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><rect fill="#F25022" x="1" y="1" width="10.5" height="10.5"/><rect fill="#7FBA00" x="12.5" y="1" width="10.5" height="10.5"/><rect fill="#00A4EF" x="1" y="12.5" width="10.5" height="10.5"/><rect fill="#FFB900" x="12.5" y="12.5" width="10.5" height="10.5"/></svg>',
    },
};

window.AUTH_METHOD_CONFIG = AUTH_METHOD_CONFIG;

function getAuthMethod(accOrMethod) {
    const value = typeof accOrMethod === 'string'
        ? accOrMethod
        : accOrMethod?.authMethod;
    const method = String(value || 'email').toLowerCase();
    return AUTH_METHOD_CONFIG[method] ? method : 'email';
}

function renderAuthMethodIcon(method) {
    const config = AUTH_METHOD_CONFIG[getAuthMethod(method)] || AUTH_METHOD_CONFIG.email;
    return `<span class="auth-method-icon">${config.icon}</span>`;
}

function renderAuthMethodBadge(accOrMethod, options = {}) {
    const method = getAuthMethod(accOrMethod);
    if (method === 'email' && !options.includeEmail) return '';
    const config = AUTH_METHOD_CONFIG[method] || AUTH_METHOD_CONFIG.email;
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

function getLinkedAccountEmailText(acc) {
    return getAccountUsernameForDisplay(acc) || acc?.displayUsername || acc?.username || '';
}

function renderLinkedAccountWarning(acc) {
    const method = getAuthMethod(acc);
    if (method === 'email' || !acc?.linkedAccountId) return '';
    const linked = getLinkedAccount(acc);
    if (linked.status === 'active') return '';
    const provider = AUTH_METHOD_CONFIG[method]?.label || method;
    const linkedName = linked.account?.name || `TK ${provider}`;
    const message = linked.status === 'trashed'
        ? `TK gốc "${linkedName}" đã bị xoá (đang ở thùng rác)`
        : `TK gốc "${linkedName}" đã bị xoá`;
    const viewButton = linked.account
        ? `<button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation();showDetail('${escapeJsAttr(linked.account.id)}')">Xem</button>`
        : '';
    return `<div class="linked-warning" onclick="event.stopPropagation()">
        <span class="linked-warning-icon">⚠</span>
        <span class="linked-warning-text">${escapeHtml(message)}</span>
        <span class="linked-warning-actions">
            ${viewButton}
            <button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation();changeLinkedAccount('${escapeJsAttr(acc.id)}')">Đổi</button>
            <button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation();unlinkAccount('${escapeJsAttr(acc.id)}')">Gỡ link</button>
        </span>
    </div>`;
}

function renderAuthMethodSelector(selected = 'email') {
    const current = getAuthMethod(selected);
    return `<div class="auth-method-selector">
        ${Object.entries(AUTH_METHOD_CONFIG).map(([method, config]) => `
            <button type="button" class="auth-method-btn ${method === current ? 'active' : ''}" data-method="${escapeHtml(method)}" onclick="selectAuthMethod('${escapeJsAttr(method)}')">
                ${renderAuthMethodIcon(method)}
                <span>${escapeHtml(config.label)}</span>
                <span class="auth-method-sublabel">(${escapeHtml(config.sublabel)})</span>
            </button>
        `).join('')}
    </div>`;
}

function renderAuthMethodInlineSelector(selected = 'email') {
    const current = getAuthMethod(selected);
    return `<div class="auth-method-inline">
        <span class="auth-method-inline-label">Đăng nhập:</span>
        <div class="auth-method-inline-options">
            ${Object.entries(AUTH_METHOD_CONFIG).map(([method, config]) => `
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
    const config = AUTH_METHOD_CONFIG[method] || AUTH_METHOD_CONFIG.email;
    const selectedId = window.appState?.addFormLinkedId || '';
    const options = typeof getLinkedAccountOptions === 'function' ? getLinkedAccountOptions(method) : [];

    if (!options.length) {
        return `<div class="linked-account-picker">
            <div class="linked-account-empty">
                <span class="linked-account-empty-icon">⚠</span>
                Chưa có TK ${escapeHtml(config.label)} cá nhân phù hợp
                <button type="button" class="btn btn-sm btn-outline" onclick="openLinkedPersonalAccount('${escapeJsAttr(method)}')">Thêm TK ${escapeHtml(config.label)} ngay</button>
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
                    <span class="linked-option-email">${escapeHtml(getLinkedAccountEmailText(acc))}</span>
                </span>
            </label>`;
        }).join('')}
    </div>`;
}

function renderLinkedServicesSection(accId) {
    const services = getLinkedServices(accId);
    if (!services.length) return '';
    return `<div class="detail-section linked-services-section anim-fade-in-up">
        <div class="linked-services-title">Dịch vụ đăng nhập bằng TK này (${services.length})</div>
        ${services.map(acc => {
            const days = daysUntil(acc.expiryDate);
            const daysText = acc.expiryType === 'lifetime'
                ? 'Vĩnh viễn'
                : days < 0 ? `Hết ${Math.abs(days)} ngày` : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`;
            const tags = Array.isArray(acc.tags) && acc.tags.length ? acc.tags.slice(0, 2).join(', ') : getPlatformLabel(getResolvedPlatform(acc) || acc.platform, [acc]);
            return `<button type="button" class="linked-service-item" onclick="showDetail('${escapeJsAttr(acc.id)}')">
                ${renderAccountMiniLogo(acc, 'linked-service-logo')}
                <span class="linked-service-info">
                    <span class="linked-service-name">${escapeHtml(acc.name)}</span>
                    <span class="linked-service-meta">${escapeHtml(tags)} · ${escapeHtml(daysText)}</span>
                </span>
                <svg class="linked-service-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
            </button>`;
        }).join('')}
    </div>`;
}

function renderDetailAuthSection(acc) {
    const method = getAuthMethod(acc);
    const config = AUTH_METHOD_CONFIG[method] || AUTH_METHOD_CONFIG.email;
    const badge = renderAuthMethodBadge(method, { includeEmail: true, className: 'auth-method-badge-lg' });
    let linkedHtml = '';
    let hint = 'Dùng tài khoản và mật khẩu riêng cho dịch vụ này.';

    if (method !== 'email') {
        const linked = getLinkedAccount(acc);
        hint = acc.linkedAccountId
            ? `Mật khẩu nằm trong TK ${config.label} gốc. Khi cần copy mật khẩu, hãy mở TK gốc.`
            : `Chưa chọn TK ${config.label} gốc cho dịch vụ này.`;
        if (linked.status === 'active' && linked.account) {
            linkedHtml = `<button type="button" class="detail-linked-card" onclick="showDetail('${escapeJsAttr(linked.account.id)}')">
                ${renderAccountMiniLogo(linked.account, 'detail-linked-card-logo')}
                <span class="detail-linked-card-info">
                    <span class="detail-linked-card-name">${escapeHtml(linked.account.name)}</span>
                    <span class="detail-linked-card-email">${escapeHtml(getLinkedAccountEmailText(linked.account))}</span>
                </span>
                <svg class="detail-linked-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
            </button>`;
        } else if (acc.linkedAccountId) {
            linkedHtml = renderLinkedAccountWarning(acc);
        }
    }

    return `<div class="detail-section detail-auth-section anim-fade-in-up">
        <div class="detail-auth-row"><span>Đăng nhập bằng:</span>${badge}</div>
        ${linkedHtml}
        <div class="detail-auth-hint"><span>ⓘ</span><span>${escapeHtml(hint)}</span></div>
    </div>`;
}

function renderSsoPasswordDetail(acc) {
    const method = getAuthMethod(acc);
    if (method === 'email') return '';
    const config = AUTH_METHOD_CONFIG[method] || AUTH_METHOD_CONFIG.email;
    const linked = getLinkedAccount(acc);
    const linkedButton = linked.status === 'active' && linked.account
        ? `<button type="button" class="btn btn-sm btn-outline" onclick="showDetail('${escapeJsAttr(linked.account.id)}')">Xem TK gốc</button>`
        : '';
    return `<span class="sso-password-chip">🔗 Dùng MK ${escapeHtml(config.label)}</span>${linkedButton}`;
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

function accountMatchesPlatformQuickFilter(acc, platform) {
    if (!platform) return true;
    return (getResolvedPlatform(acc) || '') === platform;
}

function getQuickPlatformStats(accounts = []) {
    const map = new Map();
    accounts.forEach(acc => {
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
    const stats = getQuickPlatformStats(accounts).slice(0, 24);
    const tagStats = getQuickTagStats(accounts);
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
        <span class="quick-platform-count">${accounts.length}</span>
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

// ===== DASHBOARD =====
function renderDashboard() {
    const accs = window.appState.accounts;
    const sortedAccs = sortAccountsByPriority(accs);
    const platformFilter = window.appState.currentPlatformFilter || '';
    const total = accs.length;
    const bought = accs.filter(a=>a.type==='bought').length;
    const expiring = accs.filter(a=>a.status==='expiring').length;
    const expired = accs.filter(a=>a.status==='expired').length;
    const shownKeys = new Set();
    const alerts = takeUniqueDashboardAccounts(
        sortAccountsByPriority(accs.filter(a=>a.status==='expiring'||a.status==='expired')),
        shownKeys,
        6
    );
    const pinned = takeUniqueDashboardAccounts(
        sortedAccs.filter(a => isAccountPinned(a)),
        shownKeys,
        6
    );
    const favorites = takeUniqueDashboardAccounts(
        sortedAccs.filter(a => isAccountFavorite(a)),
        shownKeys,
        6
    );
    const recent = takeUniqueDashboardAccounts(sortedAccs, shownKeys, 8);

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

    if (platformFilter) {
        const matches = sortAccountsByPriority(accs.filter(acc => accountMatchesPlatformQuickFilter(acc, platformFilter)));
        h += renderQuickFilterResultHead(platformFilter, matches);
        h += matches.length
            ? `<div class="d-account-stack anim-stagger">${matches.map(acc => renderDesktopCard(acc, acc.type === 'personal')).join('')}</div>`
            : `<div class="d-empty-state anim-fade-in-up"><div class="d-empty-state-icon">🔎</div><div class="d-empty-state-title">Không có tài khoản nào</div><div class="d-empty-state-desc">Thử chọn icon dịch vụ khác</div></div>`;
        document.getElementById('page-content').innerHTML = h;
        return;
    }

    if (total > 0) h += renderDashboardInsights(accs);

    const justAdded = getJustAddedAccount(accs);
    if (justAdded) {
        shownKeys.add(justAdded.id);
        h += `<div class="section-header just-added-header" style="margin-top:20px">
            <span class="section-title">✨ Vừa thêm</span>
            <button type="button" class="just-added-dismiss" onclick="dismissJustAddedAccount()" aria-label="Ẩn">×</button>
        </div>`;
        h += `<div class="d-account-grid anim-stagger just-added-grid">${renderDesktopCard(justAdded, justAdded.type === 'personal')}</div>`;
    }

    if (alerts.length > 0) {
        h += `<div class="d-alert-banner anim-fade-in-up"><span style="font-size:22px">⚠️</span><span style="flex:1"><strong>${alerts.length}</strong> tài khoản cần chú ý</span></div>`;
        h += `<div class="section-header"><span class="section-title">Cần chú ý</span></div>`;
        h += `<div class="d-account-grid anim-stagger">${alerts.map(a=>renderDesktopCard(a)).join('')}</div>`;
    }

    if (pinned.length > 0) {
        h += `<div class="section-header" style="margin-top:20px"><span class="section-title">Đã ghim</span><span class="section-badge">${pinned.length} TK</span></div>`;
        h += `<div class="d-account-grid anim-stagger">${pinned.map(a=>renderDesktopCard(a)).join('')}</div>`;
    }

    if (favorites.length > 0) {
        h += `<div class="section-header" style="margin-top:20px"><span class="section-title">Yêu thích</span><span class="section-badge">${favorites.length} TK</span></div>`;
        h += `<div class="d-account-grid anim-stagger">${favorites.map(a=>renderDesktopCard(a)).join('')}</div>`;
    }

    if (recent.length > 0) {
        h += `<div class="section-header" style="margin-top:20px"><span class="section-title">Gần đây</span><span class="section-badge">${recent.length} TK</span></div>`;
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

    // Build platform stats for icon grid
    const platformMap = new Map();
    accounts.forEach(acc => {
        const platform = getResolvedPlatform(acc) || acc.platform || '';
        if (!platform) return;
        if (!platformMap.has(platform)) platformMap.set(platform, 0);
        platformMap.set(platform, platformMap.get(platform) + 1);
    });
    const platformStats = [...platformMap.entries()]
        .sort((a, b) => b[1] - a[1]);

    // Build platform icon items
    let platformGridHtml = '';
    platformStats.forEach(([platform, count]) => {
        const label = getPlatformLabel(platform, []);
        const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platform, label) : '';
        const logoMark = typeof renderPlatformLogoMark === 'function'
            ? renderPlatformLogoMark(platform, getPlatformEmoji(platform))
            : getPlatformEmoji(platform);
        platformGridHtml += `<button type="button" class="platform-grid-item" onclick="setGlobalPlatformFilter('${escapeJsAttr(platform)}')" title="${escapeHtml(label)} — ${count} tài khoản">
            <span class="platform-grid-icon" style="${logoStyle}">${logoMark}</span>
            <span class="platform-grid-count">${count}</span>
            <span class="platform-grid-label">${escapeHtml(label)}</span>
        </button>`;
    });

    // Add quick-add button
    platformGridHtml += `<button type="button" class="platform-grid-item platform-grid-add" onclick="openAddModal()" title="Thêm tài khoản mới">
        <span class="platform-grid-icon platform-grid-add-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </span>
        <span class="platform-grid-label">Thêm TK</span>
    </button>`;

    return `<div class="dashboard-insights anim-fade-in-up">
        <div class="dashboard-chart-panel">
            <div class="section-header"><span class="section-title">Nền tảng</span><span class="section-badge">${platformStats.length} dịch vụ</span></div>
            <div class="platform-icon-grid">${platformGridHtml}</div>
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
    // No longer using canvas chart — platform grid is rendered inline
}

function getSafeCategoryColor(color) {
    return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? color : '#6C5CE7';
}

const CATEGORY_SVG_ICONS = {
    folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"/></svg>',
    building: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4.8A1.8 1.8 0 0 1 6.8 3h10.4A1.8 1.8 0 0 1 19 4.8V21"/><path d="M3 21h18M9 21v-4h6v4M9 7h.01M15 7h.01M9 11h.01M15 11h.01"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"/><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 12h18M10 12v2h4v-2"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.6 5.1L19 10l-5.4 1.9L12 17l-1.6-5.1L5 10l5.4-1.9L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15ZM5 3l.7 1.8L7.5 5.5l-1.8.7L5 8l-.7-1.8-1.8-.7 1.8-.7L5 3Z"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 18H7a4 4 0 1 1 .7-7.94A5.5 5.5 0 0 1 18.2 12H19a3 3 0 0 1-1.5 6Z"/></svg>',
    code: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/></svg>',
    game: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10h.01M11 10h.01M9 8v4M16 9h.01M18 12h.01"/><path d="M6.5 7h11A4.5 4.5 0 0 1 22 11.5v3A3.5 3.5 0 0 1 18.5 18c-1.4 0-2.2-1-3-2h-7c-.8 1-1.6 2-3 2A3.5 3.5 0 0 1 2 14.5v-3A4.5 4.5 0 0 1 6.5 7Z"/></svg>',
    music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="14" height="12" rx="3"/><path d="m17 10 4-2v8l-4-2"/></svg>',
    cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2A2 2 0 0 0 9.1 17H18a2 2 0 0 0 1.9-1.4L22 8H6"/><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2"/></svg>',
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h16"/><rect x="7" y="11" width="3" height="5" rx="1"/><rect x="12" y="7" width="3" height="9" rx="1"/><rect x="17" y="9" width="3" height="7" rx="1"/></svg>',
};

const CATEGORY_ICON_ALIASES = {
    '📁': 'folder',
    '🏢': 'building',
    '💼': 'briefcase',
    '👥': 'users',
    '✨': 'sparkles',
    '☁️': 'cloud',
    '🎮': 'game',
    '🎵': 'music',
    '🎬': 'video',
    '🛒': 'cart',
    '🔒': 'lock',
};

function getCategoryIconId(icon) {
    const value = String(icon || '').trim();
    if (CATEGORY_SVG_ICONS[value]) return value;
    return CATEGORY_ICON_ALIASES[value] || 'folder';
}

function renderCategoryIconSvg(icon) {
    return CATEGORY_SVG_ICONS[getCategoryIconId(icon)] || CATEGORY_SVG_ICONS.folder;
}

function selectCategoryIcon(iconId) {
    const nextIcon = getCategoryIconId(iconId);
    const input = document.getElementById('category-icon');
    if (input) input.value = nextIcon;
    document.querySelectorAll('.category-icon-option').forEach(button => {
        button.classList.toggle('active', button.dataset.icon === nextIcon);
    });
}

function renderCategoryIcon(category, className = '') {
    const color = getSafeCategoryColor(category?.color);
    return `<span class="category-icon ${className}" style="--category-color:${color}">${escapeHtml(category?.icon || '📁')}</span>`;
}

function renderCategoryIcon(category, className = '') {
    const color = getSafeCategoryColor(category?.color);
    return `<span class="category-icon ${className}" style="--category-color:${color}">${renderCategoryIconSvg(category?.icon)}</span>`;
}

function renderCategoryPicker(selectedIds = []) {
    const categories = typeof getSortedCategories === 'function' ? getSortedCategories() : [];
    if (!categories.length) {
        return `<div class="category-picker-empty">Chưa có danh mục. Bạn có thể tạo ở tab Danh mục.</div>`;
    }
    const selected = new Set(selectedIds || []);
    return `<div class="category-picker-grid">${categories.map(category => `
        <label class="category-picker-chip ${selected.has(category.id) ? 'active' : ''}">
            <input type="checkbox" name="add-category-id" value="${escapeJsAttr(category.id)}" ${selected.has(category.id) ? 'checked' : ''} onchange="this.closest('.category-picker-chip')?.classList.toggle('active', this.checked)">
            ${renderCategoryIcon(category)}
            <span class="category-picker-name">${escapeHtml(category.name)}</span>
        </label>
    `).join('')}</div>`;
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
        ${visible.map(category => `<span class="account-category-chip" style="--category-color:${getSafeCategoryColor(category.color)}">${escapeHtml(category.icon || '📁')} ${escapeHtml(category.name)}</span>`).join('')}
        ${extra > 0 ? `<span class="account-category-chip muted">+${extra}</span>` : ''}
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

function renderCategoriesPage() {
    const query = window.appState.searchQuery || '';
    const categories = typeof getSortedCategories === 'function' ? getSortedCategories() : [];
    const filtered = query
        ? categories.filter(category => normalizeSearchText?.(category.name).includes(normalizeSearchText(query)))
        : categories;

    const content = filtered.length ? `
        <div class="category-grid anim-stagger">
            ${filtered.map(renderCategoryCard).join('')}
        </div>`
        : `<div class="d-empty-state anim-fade-in-up"><div class="d-empty-state-icon">📁</div><div class="d-empty-state-title">Chưa có danh mục</div><div class="d-empty-state-desc">Tạo danh mục như Công Ty ShineOn để gom nhiều tài khoản khác nền tảng.</div></div>`;

    document.getElementById('page-content').innerHTML = `
        <div class="category-page-head anim-fade-in-up">
            <div>
                <div class="section-title">Danh mục</div>
                <div class="category-page-desc">Gom tài khoản theo công ty, dự án, gia đình hoặc nhóm công việc.</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="openCategoryForm()">Thêm danh mục</button>
        </div>
        ${content}
    `;
}

function renderCategoryCard(category) {
    const accounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(category.id) : [];
    const previewLabels = [...new Set(accounts.map(acc => {
        const platform = getResolvedPlatform(acc) || acc.platform || '';
        return platform ? getPlatformLabel(platform, [acc]) : (acc.name || '');
    }).filter(Boolean))];
    const preview = previewLabels.slice(0, 4).map(label => escapeHtml(label)).join(', ');
    return `
    <div class="category-card anim-fade-in-up" onclick="navigateTo('category:${escapeJsAttr(category.id)}')">
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
    if (!category) {
        renderCategoriesPage();
        return;
    }
    const search = window.appState.searchQuery || '';
    const filter = window.appState.currentFilter || 'all';
    const tagFilter = window.appState.currentTagFilter || '';
    let accounts = typeof getAccountsForCategory === 'function' ? getAccountsForCategory(categoryId) : [];
    if (filter === 'favorite') accounts = accounts.filter(acc => isAccountFavorite(acc));
    else if (filter !== 'all') accounts = accounts.filter(acc => acc.status === filter);
    if (tagFilter && typeof accountMatchesTag === 'function') accounts = accounts.filter(acc => accountMatchesTag(acc, tagFilter));
    if (search) accounts = accounts.filter(acc => typeof accountMatchesSearch === 'function' ? accountMatchesSearch(acc, search) : (acc.name || '').toLowerCase().includes(search.toLowerCase()));

    const displayItems = buildAccountDisplayItems(accounts);
    const list = accounts.length
        ? `<div class="d-account-stack anim-stagger">${displayItems.map(item => Array.isArray(item.accounts)
            ? renderAccountGroup(item, false)
            : renderDesktopCard(item, item.type === 'personal')).join('')}</div>`
        : `<div class="d-empty-state anim-fade-in-up"><div class="d-empty-state-icon">📁</div><div class="d-empty-state-title">Không có tài khoản trong danh mục</div><div class="d-empty-state-desc">Gắn tài khoản vào danh mục này khi thêm mới hoặc trong trang chi tiết tài khoản.</div></div>`;

    document.getElementById('page-content').innerHTML = `
        <button class="back-btn" onclick="navigateTo('categories')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="15,18 9,12 15,6"/></svg> Danh mục</button>
        <div class="category-detail-head anim-fade-in-up">
            ${renderCategoryIcon(category, 'large')}
            <div>
                <div class="section-title">${escapeHtml(category.name)}</div>
                <div class="category-page-desc">${accounts.length} tài khoản đang hiển thị</div>
            </div>
            <button class="btn btn-sm btn-outline" onclick="openCategoryForm('${escapeJsAttr(category.id)}')">Sửa</button>
        </div>
        <div class="d-filter-row">
            <div class="d-filter-tabs">
                <button class="filter-tab ${filter==='all'?'active':''}" onclick="setFilter('all')">Tất cả</button>
                <button class="filter-tab ${filter==='active'?'active':''}" onclick="setFilter('active')">Hoạt động</button>
                <button class="filter-tab ${filter==='expiring'?'active':''}" onclick="setFilter('expiring')">Sắp hết</button>
                <button class="filter-tab ${filter==='expired'?'active':''}" onclick="setFilter('expired')">Đã hết</button>
                <button class="filter-tab ${filter==='favorite'?'active':''}" onclick="setFilter('favorite')">Yêu thích</button>
            </div>
        </div>
        ${list}
    `;
}

function renderCategoryForm(category = null) {
    return `
    <div class="form-section-title">Tên danh mục</div>
    <input type="text" id="category-name" class="input" placeholder="VD: Công Ty ShineOn" value="${escapeHtml(category?.name || '')}">
    <div class="quick-date-grid" style="margin-top:14px">
        <div class="quick-date-field">
            <label>Biểu tượng</label>
            <input type="text" id="category-icon" class="input" maxlength="3" value="${escapeHtml(category?.icon || '📁')}">
        </div>
        <div class="quick-date-field">
            <label>Màu</label>
            <input type="color" id="category-color" class="input category-color-input" value="${getSafeCategoryColor(category?.color)}">
        </div>
    </div>
    <button class="btn btn-primary" style="margin-top:18px" onclick="saveCategory('${escapeJsAttr(category?.id || '')}')">Lưu danh mục</button>`;
}

function renderCategoryIconOptions(selectedIcon, color) {
    const activeIcon = getCategoryIconId(selectedIcon);
    const labels = {
        folder: 'Thu muc',
        building: 'Cong ty',
        briefcase: 'Cong viec',
        users: 'Nhom',
        sparkles: 'AI',
        cloud: 'Cloud',
        code: 'Code',
        game: 'Game',
        music: 'Nhac',
        video: 'Video',
        cart: 'Mua sam',
        lock: 'Bao mat',
        chart: 'Bao cao',
    };
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
    return `
    <div class="form-section-title">Ten danh muc</div>
    <input type="text" id="category-name" class="input" placeholder="VD: Cong Ty ShineOn" value="${escapeHtml(category?.name || '')}">
    <input type="hidden" id="category-icon" value="${escapeHtml(iconId)}">
    <div class="quick-date-grid" style="margin-top:14px">
        <div class="quick-date-field">
            <label>Bieu tuong SVG</label>
            ${renderCategoryIconOptions(iconId, color)}
        </div>
        <div class="quick-date-field">
            <label>Mau</label>
            <input type="color" id="category-color" class="input category-color-input" value="${color}">
        </div>
    </div>
    <button class="btn btn-primary" style="margin-top:18px" onclick="saveCategory('${escapeJsAttr(category?.id || '')}')">Luu danh muc</button>`;
}

function renderAccountCategoryForm(acc) {
    return `
    <div class="form-section-title">Danh mục</div>
    ${renderCategoryPicker(typeof getAccountCategoryIds === 'function' ? getAccountCategoryIds(acc) : acc.categoryIds)}
    <button class="btn btn-primary" style="margin-top:18px" onclick="saveAccountCategories('${escapeJsAttr(acc.id)}')">Lưu danh mục</button>`;
}

// ===== ACCOUNT LIST =====
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
        <span class="platform-filter-name">Tất cả</span>
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

function renderAccountList(type) {
    const accs = window.appState.accounts.filter(a=>a.type===type);
    const filter = window.appState.currentFilter || 'all';
    const tagFilter = window.appState.currentTagFilter || '';
    const platformFilter = window.appState.currentPlatformFilter || '';
    const search = window.appState.searchQuery || '';
    let filtered = accs;
    if (filter === 'favorite') filtered = filtered.filter(a=>isAccountFavorite(a));
    else if (filter!=='all') filtered = filtered.filter(a=>a.status===filter);
    if (tagFilter && typeof accountMatchesTag === 'function') filtered = filtered.filter(a=>accountMatchesTag(a, tagFilter));
    if (platformFilter) filtered = filtered.filter(a => (getResolvedPlatform(a) || '') === platformFilter);
    if (search) filtered = filtered.filter(a=>{
        if (typeof accountMatchesSearch === 'function') return accountMatchesSearch(a, search);
        const q = search.toLowerCase();
        const platformLabel = getPlatformLabel(getResolvedPlatform(a), [a]).toLowerCase();
        return (a.name || '').toLowerCase().includes(q)
            || (a.displayUsername || '').toLowerCase().includes(q)
            || platformLabel.includes(q);
    });

    const title = type==='bought' ? 'Tài khoản mua' : 'Tài khoản cá nhân';
    const hasActiveFilter = filter !== 'all' || tagFilter || platformFilter;
    const filterLabel = getActiveFilterLabel(filter, tagFilter, platformFilter);
    let h = `<div class="list-toolbar">
        <div class="list-toolbar-left">
            <span class="section-title">${escapeHtml(title)}</span>
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
    <div id="filter-panel" class="filter-panel" style="display:none">${renderFilterPanel(accs)}</div>
    <div id="platform-panel" class="platform-panel" style="display:none">${renderPlatformQuickFilter(accs)}</div>`;

    if (filtered.length > 0) {
        const displayItems = buildAccountDisplayItems(filtered);
        h += `<div class="d-account-stack anim-stagger">${displayItems.map(item => Array.isArray(item.accounts)
            ? renderAccountGroup(item, type === 'personal')
            : renderDesktopCard(item, type === 'personal')).join('')}</div>`;
    } else {
        h += `<div class="d-empty-state anim-fade-in-up"><div class="d-empty-state-icon">${type==='personal'?'🔒':'🛒'}</div><div class="d-empty-state-title">Không có tài khoản nào</div><div class="d-empty-state-desc">${hasActiveFilter?'Thử đổi bộ lọc hoặc xoá lọc':'Bấm "Thêm TK" để thêm mới'}</div></div>`;
    }
    document.getElementById('page-content').innerHTML = h;
}

function renderSearchResults(query) {
    const q = String(query || '').trim();
    const accounts = window.appState.accounts || [];
    const matches = q
        ? accounts.filter(acc => typeof accountMatchesSearch === 'function'
            ? accountMatchesSearch(acc, q)
            : (acc.name || '').toLowerCase().includes(q.toLowerCase()))
        : [];
    const sortedMatches = sortAccountsByPriority(matches);

    const resultHtml = matches.length
        ? `<div class="d-account-stack anim-stagger">${sortedMatches.map(acc => renderDesktopCard(acc, acc.type === 'personal')).join('')}</div>`
        : `<div class="d-empty-state anim-fade-in-up"><div class="d-empty-state-icon">🔎</div><div class="d-empty-state-title">Không tìm thấy tài khoản</div><div class="d-empty-state-desc">Thử gõ tên dịch vụ, email, nền tảng, gói cước hoặc trạng thái khác</div></div>`;

    document.getElementById('page-content').innerHTML = `
        <div class="section-header search-results-header">
            <span class="section-title">Kết quả tìm kiếm</span>
            <span class="section-badge">${matches.length} TK</span>
        </div>
        ${resultHtml}
    `;
}

function getTrashDeletedDate(acc) {
    const raw = acc?.deletedAt;
    if (!raw) return null;
    if (raw instanceof Date) return raw;
    if (raw?.toDate) return raw.toDate();
    const date = new Date(raw);
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
        ? all.filter(acc => typeof accountMatchesSearch === 'function'
            ? accountMatchesSearch(acc, query)
            : (acc.name || '').toLowerCase().includes(query.toLowerCase()))
        : all;

    const cards = items.length
        ? `<div class="d-account-stack anim-stagger">${items.map(renderTrashCard).join('')}</div>`
        : `<div class="d-empty-state anim-fade-in-up"><div class="d-empty-state-icon">🗑️</div><div class="d-empty-state-title">Thùng rác trống</div><div class="d-empty-state-desc">Tài khoản xoá mềm sẽ xuất hiện ở đây để khôi phục.</div></div>`;

    document.getElementById('page-content').innerHTML = `
        <div class="trash-page-head anim-fade-in-up">
            <div>
                <div class="section-title">Thùng rác 30 ngày</div>
                <div class="trash-page-desc">Tài khoản đã xoá mềm vẫn nằm ở đây để bạn khôi phục lại khi cần.</div>
            </div>
            <span class="section-badge">${items.length}/${all.length} TK</span>
        </div>
        ${cards}
    `;
}

function renderTrashCard(acc) {
    const platformRef = getResolvedPlatform(acc) || acc.platform || acc;
    const emoji = getPlatformEmoji(platformRef);
    const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platformRef, acc.name) : `background:${stringToColor(acc.name)}15;color:${stringToColor(acc.name)}`;
    const logoMark = typeof renderPlatformLogoMark === 'function' ? renderPlatformLogoMark(platformRef, emoji) : emoji;
    const deletedDate = getTrashDeletedDate(acc);
    const deletedText = deletedDate ? formatDateVN(deletedDate) : 'Không rõ ngày xoá';
    const daysLeft = getTrashDaysLeft(acc);
    const authBadge = renderAuthMethodBadge(acc);

    return `
    <div class="d-account-card trash-card anim-fade-in-up">
        <div class="d-account-card-top">
            <div class="account-logo" style="${logoStyle}">${logoMark}</div>
            <div class="account-info">
                <div class="account-name">${escapeHtml(typeof getAccountDisplayName === 'function' ? getAccountDisplayName(acc) : acc.name)}</div>
                <div class="account-user">${escapeHtml(getAccountUsernameForDisplay(acc))}</div>
                ${typeof renderAccountTags === 'function' ? renderAccountTags(acc.tags, { limit: 3, className: 'card-tags' }) : ''}
                ${renderAccountCategoryChips(acc, { limit: 2, className: 'card-categories' })}
                ${authBadge ? `<div class="account-auth-row">${authBadge}</div>` : ''}
            </div>
            <span class="account-badge badge-expired">Đã xoá</span>
        </div>
        <div class="d-account-card-bottom trash-card-bottom">
            <span class="trash-countdown">Xoá mềm ${escapeHtml(deletedText)} · còn ${daysLeft} ngày giữ</span>
            <div class="account-actions" onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-outline" onclick="restoreAccount('${escapeJsAttr(acc.id)}')">Khôi phục</button>
            </div>
        </div>
    </div>`;
}

function renderAccountGroup(group, isPersonal=false) {
    const accounts = group.accounts;
    const label = getPlatformLabel(group.platform, accounts);
    const emoji = getPlatformEmoji(group.platform);
    const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(group.platform, label) : `background:${stringToColor(label)}15;color:${stringToColor(label)}`;
    const logoMark = typeof renderPlatformLogoMark === 'function' ? renderPlatformLogoMark(group.platform, emoji) : emoji;
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
            <div class="account-logo group-logo" style="${logoStyle}">${logoMark}</div>
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
    const secretCard = accountNeedsMasterForDisplay(acc);
    const canCopy = canShowSecretActions(acc);
    const revealedUsername = getRevealedSecret?.(acc.id, 'username');
    const revealedPassword = getRevealedSecret?.(acc.id, 'password');
    const usernameText = revealedUsername || getAccountUsernameForDisplay(acc);
    const passwordText = revealedPassword || getAccountPasswordForDisplay(acc);
    const days = daysUntil(acc.expiryDate);
    const daysText = acc.expiryType==='lifetime' ? '♾️ Vĩnh viễn' : days<0 ? `Hết ${Math.abs(days)} ngày` : days===0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`;
    const platformRef = getResolvedPlatform(acc) || acc.platform || acc;
    const emoji = getPlatformEmoji(platformRef);
    const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platformRef, acc.name) : `background:${stringToColor(acc.name)}15;color:${stringToColor(acc.name)}`;
    const logoMark = typeof renderPlatformLogoMark === 'function' ? renderPlatformLogoMark(platformRef, emoji) : emoji;
    const syncBadge = acc.pendingSync ? '<span class="sync-pending-badge">Cho sync</span>' : '';
    const authBadge = renderAuthMethodBadge(acc);
    const mutedClass = isMutedAccountInQuickFilter(acc) ? 'is-muted-account' : '';
    const preferenceActions = `${renderPinButton(acc)}${renderFavoriteButton(acc)}`;
    const accountActions = secretCard
        ? `${preferenceActions}${renderEyeButton(acc.id, 'username', 'Hiện tài khoản')}${canCopy ? renderCopyButton(acc.id, 'username', 'Copy tài khoản') : ''}${renderEyeButton(acc.id, 'password', 'Hiện mật khẩu')}${canCopy ? renderCopyButton(acc.id, 'password', 'Copy mật khẩu') : ''}`
        : `${preferenceActions}${renderCopyButton(acc.id, 'username', 'Copy tài khoản')}${renderCopyButton(acc.id, 'password', 'Copy mật khẩu')}`;
    return `
    <div class="d-account-card ${isChild ? 'account-child-card' : ''} ${acc.pendingSync ? 'sync-pending' : ''} ${isAccountFavorite(acc) ? 'is-favorite' : ''} ${isAccountPinned(acc) ? 'is-pinned' : ''} ${mutedClass} anim-fade-in-up" onclick="showDetail('${acc.id}')">
        <div class="d-account-card-top">
            <div class="account-logo" style="${logoStyle}">${logoMark}</div>
            <div class="account-info">
                <div class="account-name">${escapeHtml(typeof getAccountDisplayName === 'function' ? getAccountDisplayName(acc) : acc.name)}</div>
                <div class="account-user">${escapeHtml(usernameText)}</div>
                ${typeof renderAccountTags === 'function' ? renderAccountTags(acc.tags, { limit: 3, className: 'card-tags' }) : ''}
                ${renderAccountCategoryChips(acc, { limit: 2, className: 'card-categories' })}
                ${authBadge ? `<div class="account-auth-row">${authBadge}</div>` : ''}
                ${renderPreferenceMarkers(acc)}
                ${secretCard ? `<div class="account-secret-line"><span>Mật khẩu</span><strong>${escapeHtml(passwordText)}</strong></div>` : ''}
            </div>
            ${syncBadge}
            <span class="account-badge ${getStatusBadgeClass(acc.status)}">${getStatusText(acc.status)}</span>
        </div>
        ${renderLinkedAccountWarning(acc)}
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
    const platformRef = getResolvedPlatform(acc) || acc.platform || acc;
    const emoji = getPlatformEmoji(platformRef);
    const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platformRef, acc.name) : `background:${stringToColor(acc.name)}15;color:${stringToColor(acc.name)}`;
    const logoMark = typeof renderPlatformLogoMark === 'function' ? renderPlatformLogoMark(platformRef, emoji) : emoji;
    const decrypted = window.appState.activeDecryptedAccount?.id === accId
        ? window.appState.activeDecryptedAccount.data
        : null;
    const canCopy = canShowSecretActions(acc);
    const revealedUsername = getRevealedSecret?.(accId, 'username');
    const revealedPassword = getRevealedSecret?.(accId, 'password');
    const revealedTwoFa = getRevealedSecret?.(accId, 'twoFaCode');
    const needsMaster = accountNeedsMasterForDisplay(acc);
    const usernameText = revealedUsername || decrypted?.username || getAccountUsernameForDisplay(acc);
    const passwordText = revealedPassword || decrypted?.password || getAccountPasswordForDisplay(acc);
    const twoFaText = revealedTwoFa || decrypted?.twoFaCode || (needsMaster ? '******' : (acc.twoFaCode || '******'));
    const noteText = decrypted?.note || acc.note || '';
    const hasTwoFa = Boolean(decrypted?.twoFaCode || (!needsMaster && acc.twoFaCode) || (needsMaster && acc.twoFaCode));
    const twoFaSecret = decrypted?.twoFaCode || (!needsMaster ? (acc.twoFaCode || '') : (revealedTwoFa || ''));
    const twoFaIsTotp = Boolean(hasTwoFa && twoFaSecret && typeof isLikelyTotpSecret === 'function' && isLikelyTotpSecret(twoFaSecret));
    const usernameEye = needsMaster ? renderEyeButton(acc.id, 'username', 'Hiện tài khoản') : '';
    const passwordEye = needsMaster ? renderEyeButton(acc.id, 'password', 'Hiện mật khẩu') : '';
    const twoFaEye = needsMaster ? renderEyeButton(acc.id, 'twoFaCode', 'Hiện 2FA') : '';

    const sellerRow = renderSellerDetailRow(acc);
    let h = `
    <button class="back-btn" onclick="goBack()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="15,18 9,12 15,6"/></svg> Quay lại</button>
    <div class="d-detail-layout">
        <div class="d-detail-full">
            <div class="detail-header anim-fade-in-up">
                <div class="detail-logo" style="${logoStyle};width:64px;height:64px;font-size:28px">${logoMark}</div>
                <div><div class="detail-name">${acc.name}</div><span class="account-badge ${getStatusBadgeClass(acc.status)}">${getStatusText(acc.status)}</span></div>
                <div class="detail-pref-actions" onclick="event.stopPropagation()">${renderPinButton(acc)}${renderFavoriteButton(acc)}</div>
            </div>
            <div class="detail-tag-line">
                ${typeof renderAccountTags === 'function' ? renderAccountTags(acc.tags, { limit: 20, className: 'detail-tags' }) : ''}
                <button type="button" class="btn btn-sm btn-outline detail-tag-edit" onclick="openTagEditor('${escapeJsAttr(acc.id)}')">Sửa tags</button>
            </div>
            <div class="detail-category-line">
                ${renderAccountCategoryChips(acc, { limit: 10, className: 'detail-categories' }) || '<span class="tag-empty-hint">Chưa gắn danh mục</span>'}
                <button type="button" class="btn btn-sm btn-outline detail-tag-edit" onclick="openAccountCategoryEditor('${escapeJsAttr(acc.id)}')">Sửa danh mục</button>
            </div>
        </div>
        ${renderDetailAuthSection(acc)}
        <div class="detail-section anim-fade-in-up">
            <div class="detail-row"><span class="detail-label">Tài khoản</span><span class="detail-value secret-value">${escapeHtml(usernameText)} ${renderEyeButton(acc.id, 'username', 'Hiện tài khoản')} ${canCopy ? renderCopyButton(acc.id, 'username', 'Copy tài khoản') : ''}</span></div>
            <div class="detail-row"><span class="detail-label">Mật khẩu</span><span class="detail-value secret-value">${getAuthMethod(acc) === 'email' ? `${escapeHtml(passwordText)} ${renderEyeButton(acc.id, 'password', 'Hiện mật khẩu')} ${canCopy ? renderCopyButton(acc.id, 'password', 'Copy mật khẩu') : ''}` : renderSsoPasswordDetail(acc)}</span></div>
            ${hasTwoFa?`<div class="detail-row"><span class="detail-label">2FA</span><span class="detail-value secret-value">${escapeHtml(twoFaText)} ${renderEyeButton(acc.id, 'twoFaCode', 'Hiện 2FA')} ${canCopy ? renderCopyButton(acc.id, '2fa', 'Copy 2FA') : ''}</span></div>${renderTwoFaExtra(acc, twoFaSecret, twoFaIsTotp)}`:''}
            ${noteText?`<div class="detail-row detail-note-row"><span class="detail-label">Ghi chú</span><div class="detail-note-value">${renderSmartNote(noteText)}</div></div>`:''}
            ${sellerRow}
        </div>
        <div class="detail-section anim-fade-in-up">
            <div class="detail-row"><span class="detail-label">Ngày mua</span><span class="detail-value">${formatDateVN(acc.purchaseDate)}</span></div>
            ${acc.purchasePrice && typeof formatPriceVN === 'function' ? `<div class="detail-row"><span class="detail-label">Giá mua</span><span class="detail-value detail-price-value">${escapeHtml(formatPriceVN(acc.purchasePrice))}</span></div>` : ''}
            <div class="detail-row"><span class="detail-label">Hết hạn</span><span class="detail-value">${acc.expiryType==='lifetime'?'♾️ Vĩnh viễn':formatDateVN(acc.expiryDate)}</span></div>
            ${acc.expiryType!=='lifetime'?`<div class="detail-row"><span class="detail-label">Còn lại</span><span class="detail-value" style="color:${days<0?'var(--danger)':days<=5?'var(--warning)':'var(--success)'}">${days<0?'Đã hết '+Math.abs(days)+' ngày':days+' ngày'}</span></div>`:''}
            ${acc.expiryType!=='lifetime'?`<div style="margin-top:12px"><div style="font-size:13px;font-weight:600;margin-bottom:8px">Gia hạn nhanh</div><div class="renew-options"><button class="renew-btn" onclick="renewAccount('${acc.id}',7)">+7 ngày</button><button class="renew-btn" onclick="renewAccount('${acc.id}',15)">+15</button><button class="renew-btn" onclick="renewAccount('${acc.id}',30)">+30</button><button class="renew-btn" onclick="renewAccount('${acc.id}',90)">+90</button><button class="renew-btn" onclick="renewAccount('${acc.id}',365)">+365</button>${acc.status!=='expired'?`<button class="renew-btn renew-btn-expire" onclick="markAccountExpired('${acc.id}')" title="Đặt hết hạn ngay hôm nay">⏱️ Hết hạn ngay</button>`:''}</div></div>`:''}
        </div>
        ${renderLinkedServicesSection(acc.id)}
        <div class="d-detail-full" style="display:flex;gap:12px;margin-top:8px">
            <button class="btn btn-outline btn-sm" onclick="editAccount('${acc.id}')">✏️ Sửa</button>
            <button class="btn btn-danger-outline btn-sm" onclick="deleteAccount('${acc.id}')">🗑️ Xoá</button>
        </div>
    </div>`;
    document.getElementById('page-content').innerHTML = h;
    if (twoFaIsTotp && typeof startTotpTicker === 'function') startTotpTicker(twoFaSecret);
    else if (typeof stopTotpTicker === 'function') stopTotpTicker();
}

// Widget tạo mã 2FA trực tiếp + link web dự phòng
function renderTwoFaExtra(acc, secret, isTotp) {
    if (!secret) return '';
    const safeSecret = escapeJsAttr(secret);
    const copyIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    if (isTotp) {
        return `<div class="totp-widget" id="totp-widget">
            <div class="totp-main">
                <span class="totp-label">Mã hiện tại</span>
                <span class="totp-code" id="totp-code">------</span>
                <button type="button" class="icon-btn totp-copy" onclick="copyTotpCode()" title="Copy mã 2FA">${copyIcon}</button>
            </div>
            <div class="totp-timer">
                <span class="totp-count" id="totp-count">30s</span>
                <div class="totp-progress"><div class="totp-bar" id="totp-bar"></div></div>
            </div>
            <button type="button" class="totp-web-link" onclick="openWeb2FA('${safeSecret}')" title="Mở trang web 2FA dự phòng">🌐 Web 2FA</button>
        </div>`;
    }
    return `<div class="detail-row totp-web-row"><span class="detail-label"></span><button type="button" class="btn btn-sm btn-outline" onclick="openWeb2FA('${safeSecret}')">🌐 Tạo mã 2FA trên web</button></div>`;
}

function renderTagEditorForm(acc) {
    return `
    <input type="hidden" id="add-name" value="${escapeHtml(acc?.name || '')}">
    <div class="form-section-title">Gói cước / Tags</div>
    <div id="tag-suggestions" class="tag-suggestion-grid"></div>
    <div id="selected-tags" class="selected-tags"></div>
    <div class="tag-custom-row">
        <input type="text" id="add-tag-input" class="input" placeholder="Thêm tag riêng..." onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomTagFromInput()}">
        <button type="button" class="quick-chip primary" onclick="addCustomTagFromInput()">Thêm</button>
    </div>
    <button class="btn btn-primary" style="margin-top:18px" onclick="saveAccountTags('${escapeJsAttr(acc.id)}')">Lưu tags</button>`;
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
            <span>${escapeHtml(item.version || 'unknown')}${item.status ? ` · ${escapeHtml(item.status)}` : ''}</span>
            <small>${escapeHtml(item.date || '')}</small>
        </div>`).join('')}</div>`;
}

function renderNotifyDaysOptions(days) {
    const value = days.join(',');
    const presets = [
        { value: '1', label: '1 ngày' },
        { value: '3,1', label: '3, 1 ngày' },
        { value: '5,3,1', label: '5, 3, 1 ngày' },
        { value: '7,3,1', label: '7, 3, 1 ngày' },
        { value: '14,7,3,1', label: '14, 7, 3, 1 ngày' },
        { value: '30,14,7,3,1', label: '30, 14, 7, 3, 1 ngày' },
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
    const isElectron = Boolean(window.electronAPI?.isElectron);
    const autoLock = Number(settings.autoLockMinutes ?? 5);
    const updateReady = window.appState.updateStatus?.status === 'downloaded';
    const updateChecking = window.appState.updateStatus?.status === 'checking';
    document.getElementById('page-content').innerHTML = `
    <div class="d-settings-layout">
        <div class="settings-group"><div class="settings-group-title">Bảo mật</div><div class="settings-card">
            <div class="settings-item" onclick="handleChangeMasterPassword()"><div class="settings-item-icon" style="background:var(--accent-bg)">🔑</div><div class="settings-item-content"><div class="settings-item-title">Đổi Master PIN</div><div class="settings-item-desc">Xác thực lại tài khoản rồi đặt PIN mới 4 hoặc 6 số</div></div><svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg></div>
            <label class="settings-item settings-control ${isElectron ? '' : 'disabled'}"><div class="settings-item-icon" style="background:var(--warning-bg)">🔒</div><div class="settings-item-content"><div class="settings-item-title">Tự khoá sau</div><div class="settings-item-desc">${isElectron ? 'Khoá Master Password khi máy không hoạt động' : 'Chỉ khả dụng trên bản desktop'}</div></div><select class="settings-select" onchange="handleAutoLockChange(this.value)" ${isElectron ? '' : 'disabled'}><option value="1" ${autoLock===1?'selected':''}>1 phút</option><option value="5" ${autoLock===5?'selected':''}>5 phút</option><option value="15" ${autoLock===15?'selected':''}>15 phút</option><option value="30" ${autoLock===30?'selected':''}>30 phút</option><option value="0" ${autoLock===0?'selected':''}>Tắt</option></select></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--accent-bg)">🛒</div><div class="settings-item-content"><div class="settings-item-title">Khoá TK Mua bằng Master Password</div><div class="settings-item-desc">Tắt để xem/copy TK Mua nhanh, bật nếu muốn bảo vệ như mục Cá nhân</div></div><input class="settings-toggle" type="checkbox" onchange="handleProtectBoughtToggle(this)" ${settings.protectBoughtAccounts ? 'checked' : ''}></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--danger-bg)">🧹</div><div class="settings-item-content"><div class="settings-item-title">Tự xoá clipboard sau 30s</div><div class="settings-item-desc">Áp dụng khi copy mật khẩu, 2FA hoặc mã</div></div><input class="settings-toggle" type="checkbox" onchange="handleClipboardAutoClearToggle(this)" ${settings.clipboardAutoClear ? 'checked' : ''}></label>
        </div></div>
        <div class="settings-group"><div class="settings-group-title">Desktop</div><div class="settings-card">
            <label class="settings-item settings-control ${isElectron ? '' : 'disabled'}"><div class="settings-item-icon" style="background:var(--success-bg)">🚀</div><div class="settings-item-content"><div class="settings-item-title">Tự khởi động cùng Windows</div><div class="settings-item-desc">${isElectron ? 'Mở Ting! khi đăng nhập Windows' : 'Chỉ khả dụng trên bản desktop'}</div></div><input class="settings-toggle" type="checkbox" onchange="handleAutoStartToggle(this)" ${settings.autoStart ? 'checked' : ''} ${isElectron ? '' : 'disabled'}></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--accent-bg)">🌗</div><div class="settings-item-content"><div class="settings-item-title">Giao diện</div><div class="settings-item-desc">Theo hệ thống, sáng hoặc tối</div></div><select class="settings-select" onchange="handleThemeChange(this.value)"><option value="system" ${settings.theme==='system'?'selected':''}>Hệ thống</option><option value="light" ${settings.theme==='light'?'selected':''}>Sáng</option><option value="dark" ${settings.theme==='dark'?'selected':''}>Tối</option></select></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--accent-bg)">🪪</div><div class="settings-item-content"><div class="settings-item-title">Ghi nhớ đăng nhập</div><div class="settings-item-desc">Giữ phiên Google/Email trên thiết bị này</div></div><select class="settings-select" onchange="handleRememberSignInChange(this.value)"><option value="forever" ${(typeof getAuthRememberMode === 'function' ? getAuthRememberMode() : 'forever') === 'forever' ? 'selected' : ''}>Vĩnh viễn</option><option value="30d" ${(typeof getAuthRememberMode === 'function' ? getAuthRememberMode() : 'forever') === '30d' ? 'selected' : ''}>30 ngày</option></select></label>
            <div class="settings-item settings-shortcut-section ${isElectron ? '' : 'disabled'}"><div class="settings-item-icon" style="background:var(--accent-bg)">⌨️</div><div class="settings-item-content"><div class="settings-item-title">Phím tắt</div><div class="settings-item-desc">${isElectron ? 'Bấm vào phím tắt để đổi. Nhấn Escape để hủy.' : 'Chỉ khả dụng trên bản desktop'}</div>${isElectron ? `<div class="shortcut-editor-grid">
                <div class="shortcut-row"><span class="shortcut-label">Mở Ting!</span><button type="button" class="shortcut-record-btn" id="shortcut-btn-openApp" onclick="startRecordingShortcut('openApp')" onkeydown="handleShortcutKeydown(event)" tabindex="0"><span class="shortcut-key-display">${typeof formatAcceleratorDisplay === 'function' ? formatAcceleratorDisplay(settings.shortcuts?.openApp || '') : (settings.shortcuts?.openApp || 'Ctrl + Shift + T')}</span></button>${settings.shortcuts?.openApp ? `<button type="button" class="shortcut-clear-btn" onclick="clearShortcut('openApp')" title="Xóa phím tắt">✕</button>` : ''}</div>
                <div class="shortcut-row"><span class="shortcut-label">Thêm nhanh</span><button type="button" class="shortcut-record-btn" id="shortcut-btn-quickAdd" onclick="startRecordingShortcut('quickAdd')" onkeydown="handleShortcutKeydown(event)" tabindex="0"><span class="shortcut-key-display">${typeof formatAcceleratorDisplay === 'function' ? formatAcceleratorDisplay(settings.shortcuts?.quickAdd || '') : (settings.shortcuts?.quickAdd || 'Ctrl + Shift + S')}</span></button>${settings.shortcuts?.quickAdd ? `<button type="button" class="shortcut-clear-btn" onclick="clearShortcut('quickAdd')" title="Xóa phím tắt">✕</button>` : ''}</div>
            </div><button type="button" class="btn btn-sm btn-outline settings-shortcut-reset" onclick="resetShortcuts()">Khôi phục mặc định</button>` : ''}</div></div>
        </div></div>
        <div class="settings-group"><div class="settings-group-title">Thông báo</div><div class="settings-card">
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--warning-bg)">🔔</div><div class="settings-item-content"><div class="settings-item-title">Bật nhắc hạn</div><div class="settings-item-desc">Quét tài khoản sắp hoặc đã hết hạn</div></div><input class="settings-toggle" type="checkbox" onchange="handleNotificationsEnabledToggle(this)" ${notificationSettings.enabled ? 'checked' : ''}></label>
            <label class="settings-item settings-control ${isElectron ? '' : 'disabled'}"><div class="settings-item-icon" style="background:var(--accent-bg)">🪟</div><div class="settings-item-content"><div class="settings-item-title">Toast Windows</div><div class="settings-item-desc">${isElectron ? 'Hiện thông báo hệ thống Windows' : 'Trình duyệt sẽ dùng quyền Notification nếu có'}</div></div><input class="settings-toggle" type="checkbox" onchange="handleNativeNotificationsToggle(this)" ${notificationSettings.nativeEnabled ? 'checked' : ''}></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--success-bg)">🔔</div><div class="settings-item-content"><div class="settings-item-title">Chuông trong app</div><div class="settings-item-desc">Hiện badge và danh sách khi bấm icon chuông</div></div><input class="settings-toggle" type="checkbox" onchange="handleInAppNotificationsToggle(this)" ${notificationSettings.inAppEnabled ? 'checked' : ''}></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--warning-bg)">📅</div><div class="settings-item-content"><div class="settings-item-title">Nhắc trước</div><div class="settings-item-desc">Áp dụng cho tài khoản mới và bộ lọc nhắc hạn</div></div><select class="settings-select settings-select-wide" onchange="handleNotifyDaysChange(this.value)">${renderNotifyDaysOptions(notificationSettings.daysBefore)}</select></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--accent-bg)">🔁</div><div class="settings-item-content"><div class="settings-item-title">Lặp lại</div><div class="settings-item-desc">Tối đa 1 lần/ngày cho thông báo hệ thống</div></div><select class="settings-select settings-select-wide" onchange="handleNotifyRepeatChange(this.value)"><option value="24" ${notificationSettings.repeatHours===24?'selected':''}>1 lần/ngày (24h)</option></select></label>
            <label class="settings-item settings-control"><div class="settings-item-icon" style="background:var(--danger-bg)">⏳</div><div class="settings-item-content"><div class="settings-item-title">Hiện quá hạn trong</div><div class="settings-item-desc">Sau thời gian này tài khoản biến mất khỏi danh sách chuông</div></div><select class="settings-select" onchange="handleNotifyOverdueChange(this.value)"><option value="0" ${notificationSettings.overdueDays===0?'selected':''}>Tắt</option><option value="1" ${notificationSettings.overdueDays===1?'selected':''}>1 ngày</option><option value="2" ${notificationSettings.overdueDays===2?'selected':''}>2 ngày</option><option value="3" ${notificationSettings.overdueDays===3?'selected':''}>3 ngày</option></select></label>
            <div class="settings-item" onclick="showNotifications()"><div class="settings-item-icon" style="background:var(--warning-bg)">🔎</div><div class="settings-item-content"><div class="settings-item-title">Tài khoản cần chú ý</div><div class="settings-item-desc">${notificationSettings.inAppEnabled ? (getNotificationList?.(window.appState.accounts).length || 0) : 0} tài khoản sắp hết hạn hoặc quá hạn dưới 3 ngày</div></div><svg class="settings-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg></div>
            <div class="settings-item"><div class="settings-item-icon" style="background:var(--success-bg)">✅</div><div class="settings-item-content"><div class="settings-item-title">Gửi thử thông báo</div><div class="settings-item-desc">Kiểm tra quyền thông báo của Windows/trình duyệt</div></div><button class="btn btn-sm btn-outline settings-inline-btn" onclick="sendTestNotification()">Gửi thử</button></div>
            <div class="settings-item"><div class="settings-item-icon" style="background:var(--accent-bg)">⚙️</div><div class="settings-item-content"><div class="settings-item-title">Cài đặt thông báo Windows</div><div class="settings-item-desc">Bật banner, âm thanh và tắt Không làm phiền</div></div><button class="btn btn-sm btn-outline settings-inline-btn" onclick="openNotificationSettingsFromApp()">Mở</button></div>
            <div class="settings-item"><div class="settings-item-icon" style="background:var(--success-bg)">📅</div><div class="settings-item-content"><div class="settings-item-title">Gia hạn mặc định</div><div class="settings-item-desc">30 ngày</div></div></div>
        </div></div>
        <div class="settings-group"><div class="settings-group-title">Phiên bản</div><div class="settings-card">
            <div class="settings-item"><div class="settings-item-icon" style="background:#E0F2FE">⬆️</div><div class="settings-item-content"><div class="settings-item-title">Ting! v${escapeHtml(window.appState.appVersion || '1.0.0')}</div>${renderUpdateStatus()}</div><button class="btn btn-sm btn-outline settings-inline-btn" onclick="checkForUpdates()" ${isElectron && !updateChecking ? '' : 'disabled'}>${updateChecking ? 'Đang kiểm tra' : 'Kiểm tra'}</button></div>
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
function renderEditForm(acc, decrypted = {}) {
    return renderAddForm(acc.type || 'bought', { ...acc, ...decrypted, id: acc.id });
}

function renderNotificationPanel(items = getNotificationList(window.appState.accounts)) {
    const panel = document.getElementById('notification-dropdown');
    if (!panel) return;
    const list = items || [];
    panel.innerHTML = `
        <div class="notification-panel-head">
            <strong>Thông báo hết hạn</strong>
            <span>${list.filter(item => !item.seen).length} mới · ${list.length} mục</span>
        </div>
        ${list.length ? `<div class="notification-list">${list.map(item => {
            const days = item.daysLeft;
            const text = days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`;
            const seen = Boolean(item.seen);
            return `<div class="notification-item ${days < 0 ? 'expired' : days <= 3 ? 'urgent' : ''} ${seen ? 'seen' : ''}">
                <div class="notification-icon">${days < 0 ? '⛔' : '⏰'}</div>
                <div class="notification-info">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(text)} • ${formatDateVN(item.expiryDate)}${seen ? ' • Đã xem' : ''}</span>
                </div>
                <button class="renew-btn" onclick="renewAccount('${escapeJsAttr(item.id)}',30)">Gia hạn</button>
            </div>`;
        }).join('')}</div>` : '<div class="notification-empty">🎉 Tất cả đều ổn!</div>'}
    `;
}

function renderNotificationPanelPremium(items = getNotificationList(window.appState.accounts)) {
    const panel = document.getElementById('notification-dropdown');
    if (!panel) return '';
    const list = items || [];
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
        return `<div class="notification-item ${statusClass} ${seen ? 'seen' : ''}" style="--stagger:${index}" tabindex="0" title="${escapeHtml(text)}">
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
    panel.innerHTML = `
        <div class="notification-panel-head">
            <strong>Tài khoản cần chú ý</strong>
            <span class="notification-count-badge">${list.filter(item => !item.seen).length} mới - ${list.length} mục</span>
        </div>
        ${list.length ? `<div class="notification-list">${list.map(itemHtml).join('')}</div>` : '<div class="notification-empty"><div class="notification-empty-icon">*</div><strong>Tất cả đều ổn</strong><span>Không có tài khoản sắp hết hạn.</span></div>'}
    `;
    return panel.innerHTML;
}

renderNotificationPanel = renderNotificationPanelPremium;

function toggleNotificationPanel() {
    const panel = document.getElementById('notification-dropdown');
    if (!panel) return;
    if (!panel.hidden) {
        closeNotificationPanel();
        return;
    }
    if (typeof getNotificationList === 'function' && typeof markNotificationsAsSeen === 'function') {
        markNotificationsAsSeen(getNotificationList(window.appState.accounts || []));
    }
    renderNotificationPanel();
    updateHeader?.();
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
            if (typeof accountMatchesSearch === 'function') return accountMatchesSearch(acc, q);
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
    box.innerHTML = matches.length ? matches.map((acc, index) => {
        const platformRef = getResolvedPlatform(acc) || acc.platform || acc;
        const emoji = getPlatformEmoji(platformRef);
        const logoStyle = typeof getPlatformLogoStyle === 'function' ? getPlatformLogoStyle(platformRef, acc.name) : `background:${stringToColor(acc.name)}15;color:${stringToColor(acc.name)}`;
        const logoMark = typeof renderPlatformLogoMark === 'function' ? renderPlatformLogoMark(platformRef, emoji) : emoji;
        return `
        <button class="spotlight-result ${index === 0 ? 'active' : ''}" onclick="openSpotlightResult('${escapeJsAttr(acc.id)}')">
            <span class="spotlight-logo" style="${logoStyle}">${logoMark}</span>
            <span class="spotlight-info"><strong>${escapeHtml(acc.name)}</strong><small>${escapeHtml(getMaskedAccountUsername(acc))}</small></span>
            <span class="account-badge ${getStatusBadgeClass(acc.status)}">${getStatusText(acc.status)}</span>
        </button>
    `;
    }).join('') : '<div class="spotlight-empty">Không tìm thấy tài khoản</div>';
}

function openSpotlightResult(id) {
    const overlay = document.getElementById('spotlight-overlay');
    if (overlay) overlay.style.display = 'none';
    showDetail(id);
}

function getQuickPlatformChip(id, name) {
    if (typeof renderQuickPlatformChip === 'function') return renderQuickPlatformChip(id, name);
    return `<img src="assets/icons/platforms/${id}.png" class="quick-select-icon" alt="" onerror="this.style.display='none'"> <span>${escapeHtml(name)}</span>`;
}

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
        ? `<a href="#" class="seller-source-name seller-source-link" title="${escapeHtml(sellerLink)}" onclick="event.preventDefault();openExternalLink('${escapeJsAttr(sellerLink)}')">${escapeHtml(displayName)}<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:4px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>`
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

// Handler cho Quick Select
window.selectQuickPlatform = function(name) {
    const input = document.getElementById('add-name');
    if (input) {
        input.value = name;
        if (typeof detectPlatform === 'function') window.appState.addFormPlatform = detectPlatform(name);
        if (typeof autoDetectPlatform === 'function') autoDetectPlatform();
    }
};

// ===== ADD FORM =====
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
    const smartDateValue = isEdit ? (isLifetime ? 'Vinh vien' : 'Tuy chinh') : '30 ngay';
    const saveButton = isEdit
        ? `<button class="btn btn-primary" style="margin-top:24px" onclick="saveEditedAccount('${escapeJsString(editData.id)}')">Luu thay doi</button>`
        : `<button class="btn btn-primary" style="margin-top:24px" onclick="saveNewAccount('${type}')">Luu tai khoan</button>`;
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
    <button class="btn btn-primary" style="margin-top:24px" onclick="saveNewAccount('${type}')">💾 Lưu tài khoản</button>`;
}
