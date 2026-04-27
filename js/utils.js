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
    return `service-${slugifyGroup(normalizeServiceName(acc?.name))}`;
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
    const pattern = /\[copy\]([\s\S]*?)\[\/copy\]|https?:\/\/[^\s<>"')]+/gi;
    let html = '';
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(line)) !== null) {
        html += escapeHtml(line.slice(lastIndex, match.index));
        if (match[1] !== undefined) html += renderCopyNoteToken(match[1].trim(), 'Copy');
        else html += renderLinkNoteToken(match[0]);
        lastIndex = pattern.lastIndex;
    }

    html += escapeHtml(line.slice(lastIndex));
    return html;
}

function renderSmartNote(note) {
    const source = String(note || '').trim();
    if (!source) return '';

    const lines = source.split(/\r?\n/);
    const rows = lines.map(line => {
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
