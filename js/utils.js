/* Ting! — Utility Functions */

/**
 * Tính số ngày còn lại từ hôm nay đến ngày hết hạn
 */
function daysUntil(dateStr) {
    if (!dateStr) return Infinity;
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(dateStr); target.setHours(0,0,0,0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Tính ngày hết hạn mới khi gia hạn +N ngày.
 * Gia hạn tính từ mốc MUỘN HƠN giữa hôm nay và ngày hết hạn hiện tại:
 * - TK đã quá hạn (hoặc hết hạn hôm nay): tính từ hôm nay -> hôm nay + N ngày.
 * - TK còn hạn: cộng dồn vào ngày hết hạn hiện tại (không mất ngày còn lại).
 * Trả về chuỗi YYYY-MM-DD theo giờ địa phương.
 */
function getRenewedExpiryDate(currentExpiry, days) {
    const addDays = Number(days) || 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let base = today;
    if (currentExpiry) {
        const cur = new Date(currentExpiry); cur.setHours(0, 0, 0, 0);
        if (!Number.isNaN(cur.getTime()) && cur.getTime() > today.getTime()) base = cur;
    }
    const result = new Date(base.getTime());
    result.setDate(result.getDate() + addDays);
    const y = result.getFullYear();
    const m = String(result.getMonth() + 1).padStart(2, '0');
    const d = String(result.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Format ngày theo kiểu Việt Nam: "26/04/2026"
 */
function formatDateVN(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
}

/**
 * Format ngày ngắn: "26 Th4"
 */
function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day:'numeric', month:'short' });
}

/**
 * Lấy trạng thái từ ngày hết hạn
 */
function getStatusFromExpiry(expiryDate, expiryType) {
    if (expiryType === 'lifetime') return 'active';
    const days = daysUntil(expiryDate);
    if (days < 0) return 'expired';
    if (days <= 5) return 'expiring';
    return 'active';
}

/**
 * Lấy text trạng thái tiếng Việt
 */
function getStatusText(status) {
    const map = { active:'Hoạt động', expiring:'Sắp hết hạn', expired:'Đã hết hạn', renewed:'Đã gia hạn' };
    return map[status] || status;
}

/**
 * Lấy class CSS cho badge trạng thái
 */
function getStatusBadgeClass(status) {
    const map = { active:'badge-active', expiring:'badge-expiring', expired:'badge-expired', renewed:'badge-active' };
    return map[status] || 'badge-active';
}

/**
 * Che username: "rainosb@gmail.com" → "ra******@gmail.com"
 */
function maskUsername(username) {
    const value = String(username || '').trim();
    if (!value) return '******';
    const mask = '******';
    if (value.includes('@')) {
        const [local, ...domainParts] = value.split('@');
        const domain = domainParts.join('@');
        const visible = local.slice(0, Math.min(2, Math.max(1, local.length)));
        return `${visible}${mask}${domain ? '@' + domain : ''}`;
    }
    if (/^\d+$/.test(value)) {
        const start = value.slice(0, Math.min(2, value.length));
        const end = value.length > 4 ? value.slice(-2) : '';
        return `${start}${mask}${end}`;
    }
    const visible = value.slice(0, Math.min(2, Math.max(1, value.length)));
    return `${visible}${mask}`;
}

/**
 * Copy text vào clipboard + hiện toast
 */
async function copyToClipboard(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(`Đã copy ${label || ''}!`, 'success');
        scheduleClipboardClear(text, label);
        return true;
    } catch {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(`Đã copy ${label || ''}!`, 'success');
        scheduleClipboardClear(text, label);
        return true;
    }
}

function scheduleClipboardClear(text, label) {
    const enabled = window.appState?.settings?.clipboardAutoClear ?? true;
    if (!enabled || !navigator.clipboard?.writeText) return;
    const sensitive = /mật khẩu|2fa|mã|tài khoản|ghi chú/i.test(label || '');
    if (!sensitive) return;

    showToast('Clipboard sẽ tự xoá sau 30s', 'success');
    clearTimeout(window.__tingClipboardTimer);
    window.__tingClipboardTimer = setTimeout(async () => {
        try {
            const current = await navigator.clipboard.readText?.();
            if (current === text) {
                await navigator.clipboard.writeText('');
                showToast('Đã xoá clipboard', 'success');
            }
        } catch {
            // Browser có thể chặn đọc clipboard nếu không có gesture.
        }
    }, 30000);
}

function formatTotpCode(code) {
    return String(code || '').replace(/(\d{3})(\d{3})/, '$1 $2');
}

async function refreshRegisteredTotpWidgets() {
    const widgets = document.querySelectorAll('[data-totp-key]');
    if (!widgets.length) {
        if (window.tingTotpWidgetInterval) {
            clearInterval(window.tingTotpWidgetInterval);
            window.tingTotpWidgetInterval = null;
        }
        return;
    }

    const secrets = window.tingTotpWidgetSecrets || {};
    for (const widget of widgets) {
        const secret = secrets[widget.dataset.totpKey];
        const codeEl = widget.querySelector('.totp-code');
        const countEl = widget.querySelector('.totp-count');
        const barEl = widget.querySelector('.totp-bar');
        if (!secret || typeof generateTOTP !== 'function') {
            if (codeEl) codeEl.textContent = '------';
            continue;
        }

        const code = await generateTOTP(secret);
        if (codeEl) codeEl.textContent = code ? formatTotpCode(code) : '------';
        const remain = typeof totpTimeRemaining === 'function' ? totpTimeRemaining(30) : 30;
        if (countEl) countEl.textContent = `${remain}s`;
        if (barEl) barEl.style.width = `${Math.round((remain / 30) * 100)}%`;
    }
}

function registerTotpWidget(key, secret) {
    if (!key || !secret) return;
    window.tingTotpWidgetSecrets = window.tingTotpWidgetSecrets || {};
    window.tingTotpWidgetSecrets[key] = secret;
    setTimeout(refreshRegisteredTotpWidgets, 0);
    if (!window.tingTotpWidgetInterval) {
        window.tingTotpWidgetInterval = setInterval(refreshRegisteredTotpWidgets, 1000);
    }
}

async function copyRegisteredTotpCode(key) {
    const secret = window.tingTotpWidgetSecrets?.[key];
    if (!secret || typeof generateTOTP !== 'function') return;
    const code = await generateTOTP(secret);
    if (code) await copyToClipboard(code, 'mã 2FA');
}

function renderRegisteredTotpWidget(key, secret) {
    if (!key || !secret) return '';
    registerTotpWidget(key, secret);
    const safeKey = escapeJsAttr(key);
    const copyIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    return `<div class="totp-widget shared-totp-widget" data-totp-key="${escapeHtml(key)}">
        <div class="totp-main">
            <span class="totp-label">Mã hiện tại</span>
            <span class="totp-code">------</span>
            <button type="button" class="icon-btn totp-copy" onclick="copyRegisteredTotpCode('${safeKey}')" title="Copy mã 2FA">${copyIcon}</button>
        </div>
        <div class="totp-timer">
            <span class="totp-count">30s</span>
            <div class="totp-progress"><div class="totp-bar"></div></div>
        </div>
        <button type="button" class="totp-web-link" onclick="openWeb2FA('${escapeJsAttr(secret)}')" title="Mở trang web 2FA dự phòng">🌐 Web 2FA</button>
    </div>`;
}

/**
 * Tạo ID ngắn ngẫu nhiên
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

/**
 * Debounce function
 */
function debounce(fn, ms = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

/**
 * Lấy ngày hôm nay dạng YYYY-MM-DD
 */
function todayStr() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Lấy lời chào theo giờ
 */
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
}

/**
 * Tạo màu nền từ chuỗi (cho avatar fallback)
 */
function stringToColor(str) {
    const colors = ['#6C5CE7','#00B894','#E17055','#0984E3','#D63031','#E84393','#00CEC9','#FDCB6E','#636E72','#2D3436'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
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

function slugifyGroup(value) {
    return String(value || 'unknown')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'unknown';
}

function getResolvedPlatform(accOrPlatform) {
    const rawPlatform = typeof accOrPlatform === 'string' ? accOrPlatform : accOrPlatform?.platform;
    if (rawPlatform && rawPlatform !== 'other') return rawPlatform;
    const name = typeof accOrPlatform === 'string' ? '' : accOrPlatform?.name;
    return typeof detectPlatform === 'function' ? detectPlatform(name) : null;
}

function normalizeServiceName(name) {
    return String(name || 'unknown')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(premium|plus|pro|team|family|business|personal|account|tai khoan|tk|goi|plan)\b/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim() || 'unknown';
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9@._+-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function accountMatchesSearch(acc, query) {
    const q = normalizeSearchText(query);
    if (!q) return true;

    const platform = getResolvedPlatform(acc) || acc?.platform || '';
    const categoryNames = Array.isArray(acc?.categoryIds) && window.appState?.customCategories
        ? acc.categoryIds
            .map(id => window.appState.customCategories.find(category => category.id === id)?.name)
            .filter(Boolean)
            .join(' ')
        : '';
    const fields = [
        acc?.name,
        acc?.username,
        acc?.displayUsername,
        acc?.note,
        acc?.planTag,
        Array.isArray(acc?.tags) ? acc.tags.join(' ') : '',
        categoryNames,
        acc?.type,
        acc?.status,
        platform,
        getPlatformLabel(platform, [acc]),
        getStatusText(acc?.status),
    ];
    const haystack = normalizeSearchText(fields.filter(Boolean).join(' '));
    return q.split(' ').every(part => haystack.includes(part));
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
    return `service-${slugifyGroup(normalizeServiceName(acc?.name))}`;
}

function getAccountDisplayName(acc) {
    const rawName = String(acc?.name || '').trim();
    const platform = getResolvedPlatform(acc) || acc?.platform;
    const platformLabel = platform ? getPlatformLabel(platform, [acc]) : '';
    if (!rawName) return platformLabel || '';
    if (!platformLabel) return rawName;

    const normalize = value => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '');
    const rawKey = normalize(rawName);
    const labelKey = normalize(platformLabel);
    const platformKey = normalize(platform);

    if (rawKey === labelKey || rawKey === platformKey || labelKey.includes(rawKey)) {
        return platformLabel;
    }
    return rawName;
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

function getAccountTimeValue(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function isAccountFavorite(acc) {
    return acc?.isFavorite === true;
}

function isAccountPinned(acc) {
    return acc?.isPinned === true || Boolean(acc?.pinnedAt && acc?.isPinned !== false);
}

function sortAccountsByPriority(accounts = []) {
    return [...(accounts || [])]
        .map((acc, index) => ({ acc, index }))
        .sort((a, b) => {
            const pinnedDiff = Number(isAccountPinned(b.acc)) - Number(isAccountPinned(a.acc));
            if (pinnedDiff) return pinnedDiff;

            if (isAccountPinned(a.acc) && isAccountPinned(b.acc)) {
                const pinnedTimeDiff = getAccountTimeValue(b.acc.pinnedAt) - getAccountTimeValue(a.acc.pinnedAt);
                if (pinnedTimeDiff) return pinnedTimeDiff;
            }

            const favoriteDiff = Number(isAccountFavorite(b.acc)) - Number(isAccountFavorite(a.acc));
            if (favoriteDiff) return favoriteDiff;

            if (isAccountFavorite(a.acc) && isAccountFavorite(b.acc)) {
                const favoriteTimeDiff = getAccountTimeValue(b.acc.favoriteAt || b.acc.favoritedAt)
                    - getAccountTimeValue(a.acc.favoriteAt || a.acc.favoritedAt);
                if (favoriteTimeDiff) return favoriteTimeDiff;
            }

            return a.index - b.index;
        })
        .map(item => item.acc);
}

function formatDaysCompact(days) {
    if (days === Infinity) return 'không giới hạn';
    if (days < 0) return `quá ${Math.abs(days)} ngày`;
    if (days === 0) return 'hôm nay';
    return `còn ${days} ngày`;
}

function getGroupExpirySummary(accounts) {
    const fixed = accounts.filter(a => a.expiryType !== 'lifetime' && a.expiryDate);
    const lifetimeCount = accounts.length - fixed.length;
    if (fixed.length === 0) return lifetimeCount ? `${lifetimeCount} vĩnh viễn` : 'Chưa có ngày hạn';

    const dateCounts = fixed.reduce((map, acc) => {
        map.set(acc.expiryDate, (map.get(acc.expiryDate) || 0) + 1);
        return map;
    }, new Map());
    const sortedDates = [...dateCounts.keys()].sort();
    const nearest = getNearestFixedAccount(accounts);
    const lifetimeSuffix = lifetimeCount ? `, ${lifetimeCount} vĩnh viễn` : '';

    if (sortedDates.length === 1) {
        const days = daysUntil(sortedDates[0]);
        return `Cùng hạn ${formatDateVN(sortedDates[0])} (${formatDaysCompact(days)})${lifetimeSuffix}`;
    }

    const nearestDays = nearest ? daysUntil(nearest.expiryDate) : Infinity;
    return `${sortedDates.length} ngày hạn khác nhau, gần nhất ${formatDateVN(nearest?.expiryDate)} (${formatDaysCompact(nearestDays)})${lifetimeSuffix}`;
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

function parseCombinedNoteAction(raw) {
    const value = String(raw || '').trim();
    const urlMatch = value.match(/https?:\/\/[^\s<>"')]+/i);
    if (!urlMatch) return null;
    const url = urlMatch[0];
    const code = value
        .replace(url, ' ')
        .replace(/^[\s|:=>-]+|[\s|:=>-]+$/g, '')
        .trim();
    return code ? { url, code } : null;
}

function renderCopyNoteToken(text, label = 'Copy') {
    const safe = escapeHtml(text);
    return `<button class="smart-note-token note-copy-token" onclick="copyNoteSegment('${escapeJsAttr(text)}')" title="Copy">${label}: <code>${safe}</code></button>`;
}

function renderLinkNoteToken(url) {
    const safeUrl = escapeHtml(url);
    return `<a class="smart-note-token note-link-token" href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="${safeUrl}">${safeUrl}</a>`;
}

function renderCombinedNoteToken(action) {
    return `<button class="smart-note-token note-combo-token" onclick="copyNoteTextAndOpen('${escapeJsAttr(action.code)}','${escapeJsAttr(action.url)}')" title="Copy và mở link"><code>${escapeHtml(action.code)}</code> + mở link</button>`;
}

function renderInlineNoteSegments(line) {
    const pattern = /\[(?:open|link)\]\s*(https?:\/\/[^\s<>"')]+)|\[copy\]([\s\S]*?)\[\/copy\]|https?:\/\/[^\s<>"')]+/gi;
    let html = '';
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(line)) !== null) {
        html += escapeHtml(line.slice(lastIndex, match.index));
        if (match[1] !== undefined) html += renderLinkNoteToken(match[1]);
        else if (match[2] !== undefined) html += renderCopyNoteToken(match[2].trim(), 'Copy');
        else html += renderLinkNoteToken(match[0]);
        lastIndex = pattern.lastIndex;
    }

    html += escapeHtml(line.slice(lastIndex));
    return html;
}

function findNoteBlockClose(line, tag) {
    const closePattern = tag === 'copy' ? /\[\/copy\]|\[copy\]/i : /\[\/code\]|\[code\]/i;
    const match = closePattern.exec(line);
    return match ? { index: match.index, length: match[0].length } : null;
}

function collectNoteBlock(lines, startIndex, tag, firstContent) {
    const parts = [];
    const sameLineClose = findNoteBlockClose(firstContent, tag);
    if (sameLineClose) {
        parts.push(firstContent.slice(0, sameLineClose.index));
        return { text: parts.join('\n').trim(), nextIndex: startIndex };
    }

    parts.push(firstContent);
    for (let index = startIndex + 1; index < lines.length; index += 1) {
        const close = findNoteBlockClose(lines[index], tag);
        if (close) {
            parts.push(lines[index].slice(0, close.index));
            return { text: parts.join('\n').trim(), nextIndex: index };
        }
        parts.push(lines[index]);
    }

    return { text: parts.join('\n').trim(), nextIndex: lines.length - 1 };
}

function renderSmartNote(note) {
    const source = String(note || '').trim();
    if (!source) return '';

    const lines = source.split(/\r?\n/);
    const rows = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const trimmed = line.trim();
        if (!trimmed) {
            rows.push('<div class="smart-note-line">&nbsp;</div>');
            continue;
        }

        const comboMatch = trimmed.match(/^\[(?:open\+copy|copy\+open|link\+copy|copy\+link|combo)\]\s*(.+)$/i);
        if (comboMatch) {
            const action = parseCombinedNoteAction(comboMatch[1]);
            if (action) {
                rows.push(`<div class="smart-note-line">${renderCombinedNoteToken(action)}</div>`);
                continue;
            }
        }

        const blockMatch = trimmed.match(/^\[(copy|code)\]\s*([\s\S]*)$/i);
        if (blockMatch) {
            const tag = blockMatch[1].toLowerCase();
            const block = collectNoteBlock(lines, index, tag, blockMatch[2] || '');
            rows.push(`<div class="smart-note-line">${renderCopyNoteToken(block.text, tag === 'code' ? 'Code' : 'Copy')}</div>`);
            index = block.nextIndex;
            continue;
        }

        const copyMatch = trimmed.match(/^(?:copy\s*:|code\s*:|copy\s*-\s*)(.+)$/i);
        if (copyMatch) {
            const label = /^code\s*:/i.test(trimmed) ? 'Code' : 'Copy';
            rows.push(`<div class="smart-note-line">${renderCopyNoteToken(copyMatch[1].trim(), label)}</div>`);
            continue;
        }

        rows.push(`<div class="smart-note-line">${renderInlineNoteSegments(line)}</div>`);
    }

    return `<div class="smart-note">${rows.join('')}</div>`;
}

function getAddHistoryTime(value) {
    if (!value) return 0;
    if (typeof value.toDate === 'function') return value.toDate().getTime() || 0;
    if (value instanceof Date) return value.getTime() || 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function getAddHistoryReadableNote(acc) {
    const active = window.appState?.activeDecryptedAccount;
    const cached = active?.id === acc?.id ? active.data : null;
    return String(cached?.note || acc?.note || '').trim();
}

function normalizeAddHistoryKey(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getAddHistoryPreview(value, max = 42) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

const ADD_PLATFORM_USAGE_STORAGE_KEY = 'ting.addFormPlatformUsage.v1';

function getAddPlatformUsageStore() {
    if (typeof localStorage === 'undefined') return {};
    try {
        const parsed = JSON.parse(localStorage.getItem(ADD_PLATFORM_USAGE_STORAGE_KEY) || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.entries(parsed).reduce((store, [platform, usage]) => {
            const count = Number(usage?.count) || 0;
            const lastSelectedAt = Number(usage?.lastSelectedAt) || 0;
            if (platform && (count > 0 || lastSelectedAt > 0)) {
                store[platform] = {
                    count: Math.max(0, count),
                    lastSelectedAt: Math.max(0, lastSelectedAt),
                };
            }
            return store;
        }, {});
    } catch {
        return {};
    }
}

function saveAddPlatformUsageStore(store) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(ADD_PLATFORM_USAGE_STORAGE_KEY, JSON.stringify(store || {}));
    } catch {
        // Storage can be blocked or full; sorting simply falls back next time.
    }
}

function recordAddPlatformSelection(platformId, timestamp = Date.now()) {
    const platform = String(platformId || '').trim();
    if (!platform) return;
    const store = getAddPlatformUsageStore();
    const current = store[platform] || { count: 0, lastSelectedAt: 0 };
    store[platform] = {
        count: (Number(current.count) || 0) + 1,
        lastSelectedAt: Number(timestamp) || Date.now(),
    };
    saveAddPlatformUsageStore(store);
}

function sortAddPlatformsByUsage(platforms = []) {
    const store = getAddPlatformUsageStore();
    return [...(platforms || [])]
        .map((platform, index) => ({ platform, index, usage: store[platform?.id] || {} }))
        .sort((a, b) => {
            const bLast = Number(b.usage.lastSelectedAt) || 0;
            const aLast = Number(a.usage.lastSelectedAt) || 0;
            if (bLast !== aLast) return bLast - aLast;
            const bCount = Number(b.usage.count) || 0;
            const aCount = Number(a.usage.count) || 0;
            if (bCount !== aCount) return bCount - aCount;
            return a.index - b.index;
        })
        .map(item => item.platform);
}

function getAddFormGuideState() {
    if (!window.appState) return {};
    if (!window.appState.addFormGuide) resetAddFormGuideState();
    return window.appState.addFormGuide;
}

function resetAddFormGuideState() {
    if (!window.appState) return;
    window.appState.addFormGuide = {
        pasteGuided: false,
        dateTouched: false,
        dateSkipped: false,
        dateGuided: false,
        noteGuided: false,
        sellerGuided: false,
    };
}

function isAddFormGuideTargetAvailable(element) {
    if (!element || element.disabled || element.hidden || element.closest('[hidden]')) return false;
    if (typeof getComputedStyle !== 'function') return true;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
}

function guideAddFormTo(target, options = {}) {
    const element = typeof target === 'string'
        ? document.getElementById(target.replace(/^#/, ''))
        : target;
    if (!isAddFormGuideTargetAvailable(element)) return false;
    const focus = options.focus !== false && typeof element.focus === 'function';
    const block = options.block || 'center';
    const delay = Number.isFinite(options.delay) ? options.delay : 80;

    const scrollTarget = () => {
        element.scrollIntoView({ behavior: options.behavior || 'smooth', block, inline: 'nearest' });
    };
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(scrollTarget);
    } else {
        scrollTarget();
    }
    if (focus) {
        window.setTimeout(() => {
            element.focus({ preventScroll: true });
            const value = typeof element.value === 'string' ? element.value : '';
            if (options.caretEnd !== false && typeof element.setSelectionRange === 'function') {
                element.setSelectionRange(value.length, value.length);
            }
        }, delay);
    }
    return true;
}

function guideAddFormToFirstAvailable(targets = [], options = {}) {
    return targets.some(target => guideAddFormTo(target, options));
}

function markAddFormDateTouched() {
    const guide = getAddFormGuideState();
    guide.dateTouched = true;
}

function markAddFormDateSkippedIfNeeded() {
    const guide = getAddFormGuideState();
    if (!guide.dateTouched) guide.dateSkipped = true;
}

function guideAddFormFromPlatform(platformId) {
    if (platformId && platformId !== 'other') recordAddPlatformSelection(platformId);
    const guide = getAddFormGuideState();
    if (platformId === 'other') {
        guideAddFormTo('add-name');
        return;
    }
    guide.pasteGuided = true;
    if (!guideAddFormTo('paste-input')) {
        guideAddFormTo('add-smart-date');
    }
}

function handleQuickPasteGuidance() {
    window.setTimeout(() => {
        const paste = document.getElementById('paste-input');
        const guide = getAddFormGuideState();
        if (!paste?.value.trim() || guide.dateSkipped || guide.dateGuided) return;
        guide.dateGuided = true;
        guideAddFormTo('add-smart-date');
    }, 0);
}

function guideAddFormFromDate() {
    const guide = getAddFormGuideState();
    markAddFormDateTouched();
    if (guide.noteGuided) return;
    guide.noteGuided = true;
    guideAddFormTo('add-note');
}

function guideAddFormFromNote() {
    const textarea = document.getElementById('add-note');
    const guide = getAddFormGuideState();
    if (guide.sellerGuided || !textarea?.value.trim()) return;
    guide.sellerGuided = true;
    guideAddFormTo('add-seller-name');
}

function guideAddFormFromSeller() {
    const seller = document.getElementById('add-seller-name');
    if (!seller?.value.trim()) return;
    guideAddFormTo('add-price');
}

function buildAddFormHistorySuggestions(editingId = '') {
    const accounts = [...(window.appState?.accounts || [])]
        .filter(acc => acc && acc.id !== editingId)
        .sort((a, b) => {
            const bTime = getAddHistoryTime(b.updatedAt) || getAddHistoryTime(b.createdAt) || getAddHistoryTime(b.purchaseDate);
            const aTime = getAddHistoryTime(a.updatedAt) || getAddHistoryTime(a.createdAt) || getAddHistoryTime(a.purchaseDate);
            return bTime - aTime;
        });

    const notes = [];
    const sellers = [];
    const prices = [];
    const bundles = [];
    const noteKeys = new Set();
    const sellerKeys = new Set();
    const priceKeys = new Set();
    const bundleKeys = new Set();

    accounts.forEach(acc => {
        const note = getAddHistoryReadableNote(acc);
        const sellerName = String(acc.sellerName || '').trim();
        const sellerLink = String(acc.sellerLink || '').trim();
        const sellerPlatform = acc.sellerPlatform || 'other';
        const sellerDisplay = sellerName || sellerLink;
        const price = typeof parsePriceValue === 'function' ? parsePriceValue(acc.purchasePrice) : acc.purchasePrice;

        if (note && notes.length < 6) {
            const key = normalizeAddHistoryKey(note);
            if (!noteKeys.has(key)) {
                noteKeys.add(key);
                notes.push({ value: note, label: getAddHistoryPreview(note) });
            }
        }

        if (sellerDisplay && sellers.length < 6) {
            const key = normalizeAddHistoryKey(`${sellerPlatform}|${sellerName}|${sellerLink}`);
            if (!sellerKeys.has(key)) {
                sellerKeys.add(key);
                sellers.push({
                    name: sellerName || sellerLink,
                    platform: sellerPlatform,
                    link: sellerLink,
                    label: getAddHistoryPreview(sellerDisplay, 28),
                });
            }
        }

        if (price && prices.length < 6) {
            const key = String(price);
            if (!priceKeys.has(key)) {
                priceKeys.add(key);
                prices.push({
                    value: price,
                    label: typeof formatPriceInput === 'function' ? formatPriceInput(price) : String(price),
                });
            }
        }

        if (note && sellerDisplay && price && bundles.length < 5) {
            const key = normalizeAddHistoryKey(`${note}|${sellerPlatform}|${sellerName}|${sellerLink}|${price}`);
            if (!bundleKeys.has(key)) {
                bundleKeys.add(key);
                bundles.push({
                    note,
                    sellerName: sellerName || sellerLink,
                    sellerPlatform,
                    sellerLink,
                    purchasePrice: price,
                    label: getAddHistoryPreview(acc.name || acc.serviceName || sellerDisplay, 30),
                });
            }
        }
    });

    return { notes, sellers, prices, bundles };
}

function encodeAddHistoryPayload(value) {
    return encodeURIComponent(typeof value === 'string' ? value : JSON.stringify(value || {}));
}

function decodeAddHistoryPayload(value) {
    try {
        return decodeURIComponent(String(value || ''));
    } catch {
        return String(value || '');
    }
}

function renderAddHistoryChip(label, onclick, title = '') {
    const safeLabel = escapeHtml(label);
    const safeTitle = escapeHtml(title || label);
    return `<button type="button" class="add-history-chip" onclick="${onclick}" title="${safeTitle}">${safeLabel}</button>`;
}

function renderAddHistoryRow(kind, label, chips) {
    if (!chips.length) return '';
    return `<div class="add-history-row add-history-${kind}"><span class="add-history-title">${escapeHtml(label)}</span>${chips.join('')}</div>`;
}

function renderAddFormHistorySuggestions(editingId = '') {
    const history = buildAddFormHistorySuggestions(editingId);
    return {
        note: renderAddHistoryRow('note', 'Gần đây', history.notes.map(item => {
            const payload = escapeJsAttr(encodeAddHistoryPayload(item.value));
            return renderAddHistoryChip(item.label, `applyAddHistoryNote('${payload}')`, item.value);
        })),
        seller: renderAddHistoryRow('seller', 'Gần đây', history.sellers.map(item => {
            const name = escapeJsAttr(encodeAddHistoryPayload(item.name));
            const platform = escapeJsAttr(item.platform || 'other');
            const link = escapeJsAttr(encodeAddHistoryPayload(item.link || ''));
            return renderAddHistoryChip(item.label, `applyAddHistorySeller('${name}','${platform}','${link}')`, item.name || item.link);
        })),
        price: renderAddHistoryRow('price', 'Gần đây', history.prices.map(item => {
            const payload = escapeJsAttr(encodeAddHistoryPayload(String(item.value)));
            return renderAddHistoryChip(item.label, `applyAddHistoryPrice('${payload}')`, item.label);
        })),
        bundle: renderAddHistoryRow('bundle', 'Bộ 3 gần đây', history.bundles.map(item => {
            const payload = escapeJsAttr(encodeAddHistoryPayload(item));
            return renderAddHistoryChip(item.label, `applyAddHistoryBundle('${payload}')`, `${item.label}: ${getAddHistoryPreview(item.note, 32)}`);
        })),
    };
}

function applyAddHistoryNote(encodedNote) {
    const textarea = document.getElementById('add-note');
    if (!textarea) return;
    textarea.value = decodeAddHistoryPayload(encodedNote);
    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange?.(end, end);
}

function applyAddHistorySeller(encodedName, platform = 'other', encodedLink = '') {
    const nameInput = document.getElementById('add-seller-name');
    const platformInput = document.getElementById('add-seller-platform');
    const linkInput = document.getElementById('add-seller-link');
    const sellerName = decodeAddHistoryPayload(encodedName);
    const sellerPlatform = platform || 'other';
    const savedLink = decodeAddHistoryPayload(encodedLink);

    if (nameInput) {
        nameInput.value = sellerName;
        nameInput.dataset.sellerAuto = 'false';
    }
    if (typeof selectSellerPlatform === 'function') {
        selectSellerPlatform(sellerPlatform, { syncLink: false });
    } else {
        if (platformInput) platformInput.value = sellerPlatform;
        document.querySelectorAll('[data-seller-platform]').forEach(button => {
            button.classList.toggle('active', button.dataset.sellerPlatform === sellerPlatform);
        });
    }

    const resolvedLink = savedLink || (sellerName && typeof normalizeSellerLink === 'function'
        ? normalizeSellerLink(sellerName, sellerPlatform)
        : '');
    if (platformInput) platformInput.value = sellerPlatform;
    if (linkInput) linkInput.value = resolvedLink;
    if (typeof updateSellerLinkHint === 'function') updateSellerLinkHint(resolvedLink);
    nameInput?.focus();
}

function applyAddHistoryPrice(encodedPrice) {
    const input = document.getElementById('add-price');
    if (!input) return;
    const price = decodeAddHistoryPayload(encodedPrice);
    input.value = typeof formatPriceInput === 'function' ? formatPriceInput(price) : price;
    if (typeof formatPriceField === 'function') formatPriceField(input);
    input.focus();
}

function applyAddHistoryBundle(encodedBundle) {
    let bundle = {};
    try {
        bundle = JSON.parse(decodeAddHistoryPayload(encodedBundle));
    } catch {
        bundle = {};
    }
    if (bundle.note) applyAddHistoryNote(encodeAddHistoryPayload(bundle.note));
    applyAddHistorySeller(
        encodeAddHistoryPayload(bundle.sellerName || ''),
        bundle.sellerPlatform || 'other',
        encodeAddHistoryPayload(bundle.sellerLink || '')
    );
    if (bundle.purchasePrice) applyAddHistoryPrice(encodeAddHistoryPayload(String(bundle.purchasePrice)));
}


// ===== GIÁ MUA / TIỀN TỆ =====
function parsePriceValue(value) {
    if (value === null || value === undefined) return null;
    const digits = String(value).replace(/[^\d]/g, '');
    if (!digits) return null;
    const num = Number(digits);
    return Number.isFinite(num) && num > 0 ? num : null;
}

function formatPriceInput(value) {
    const num = parsePriceValue(value);
    if (num === null) return '';
    return num.toLocaleString('vi-VN');
}

function formatPriceVN(value) {
    const num = parsePriceValue(value);
    if (num === null) return '';
    return `${num.toLocaleString('vi-VN')} ₫`;
}

// Định dạng trực tiếp trong ô input khi người dùng gõ
function formatPriceField(input) {
    if (!input) return;
    const raw = String(input.value || '');
    const digits = raw.replace(/[^\d]/g, '');
    input.value = digits ? Number(digits).toLocaleString('vi-VN') : '';
}

if (typeof window !== 'undefined') {
    window.getAddPlatformUsageStore = getAddPlatformUsageStore;
    window.recordAddPlatformSelection = recordAddPlatformSelection;
    window.sortAddPlatformsByUsage = sortAddPlatformsByUsage;
    window.resetAddFormGuideState = resetAddFormGuideState;
    window.guideAddFormTo = guideAddFormTo;
    window.guideAddFormToFirstAvailable = guideAddFormToFirstAvailable;
    window.markAddFormDateTouched = markAddFormDateTouched;
    window.markAddFormDateSkippedIfNeeded = markAddFormDateSkippedIfNeeded;
    window.guideAddFormFromPlatform = guideAddFormFromPlatform;
    window.handleQuickPasteGuidance = handleQuickPasteGuidance;
    window.guideAddFormFromDate = guideAddFormFromDate;
    window.guideAddFormFromNote = guideAddFormFromNote;
    window.guideAddFormFromSeller = guideAddFormFromSeller;
    window.buildAddFormHistorySuggestions = buildAddFormHistorySuggestions;
    window.renderAddFormHistorySuggestions = renderAddFormHistorySuggestions;
    window.applyAddHistoryNote = applyAddHistoryNote;
    window.applyAddHistorySeller = applyAddHistorySeller;
    window.applyAddHistoryPrice = applyAddHistoryPrice;
    window.applyAddHistoryBundle = applyAddHistoryBundle;
    window.parsePriceValue = parsePriceValue;
    window.formatPriceInput = formatPriceInput;
    window.formatPriceVN = formatPriceVN;
    window.formatPriceField = formatPriceField;
}
