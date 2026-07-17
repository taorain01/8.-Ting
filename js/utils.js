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

const ACCESSIBLE_CLICK_TARGET_SELECTOR = [
    '.d-account-card[onclick]',
    '.account-card[onclick]',
    '.category-card[onclick]',
    '.settings-item[onclick]',
    '.group-card[onclick]',
    '.group-list-card[onclick]',
].join(',');

function enhanceAccessibleClickTargets(root = document) {
    if (!root?.querySelectorAll) return;
    const targets = [];
    if (root.matches?.(ACCESSIBLE_CLICK_TARGET_SELECTOR)) targets.push(root);
    targets.push(...root.querySelectorAll(ACCESSIBLE_CLICK_TARGET_SELECTOR));
    targets.forEach(target => {
        if (!target.hasAttribute('role')) target.setAttribute('role', 'button');
        if (!target.hasAttribute('tabindex')) target.tabIndex = 0;
        if (!target.hasAttribute('aria-label')) {
            const label = String(target.textContent || '').replace(/\s+/g, ' ').trim();
            if (label) target.setAttribute('aria-label', label.slice(0, 180));
        }
    });
}

function initAccessibleClickTargets() {
    if (
        typeof document === 'undefined'
        || typeof document.addEventListener !== 'function'
        || typeof document.querySelectorAll !== 'function'
        || window.__tingAccessibleClickTargetsReady
    ) return;
    window.__tingAccessibleClickTargetsReady = true;
    enhanceAccessibleClickTargets(document);
    document.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const target = event.target?.closest?.(ACCESSIBLE_CLICK_TARGET_SELECTOR);
        if (!target || event.target !== target) return;
        event.preventDefault();
        target.click();
    });
    if (typeof MutationObserver === 'function') {
        const observer = new MutationObserver(records => records.forEach(record => {
            record.addedNodes.forEach(node => {
                if (node?.nodeType === 1) enhanceAccessibleClickTargets(node);
            });
        }));
        observer.observe(document.body, { childList: true, subtree: true });
        window.__tingAccessibleClickTargetsObserver = observer;
    }
}

if (
    typeof window !== 'undefined'
    && typeof document !== 'undefined'
    && typeof document.addEventListener === 'function'
    && typeof document.querySelectorAll === 'function'
) {
    window.enhanceAccessibleClickTargets = enhanceAccessibleClickTargets;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAccessibleClickTargets);
    else initAccessibleClickTargets();
}

/**
 * Lấy ngày hôm nay dạng YYYY-MM-DD
 */
function formatLocalDateInput(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function todayStr() {
    return formatLocalDateInput(new Date());
}

/**
 * Lấy giờ địa phương dạng HH:mm để lưu cùng ngày mua.
 * Không dùng toISOString() vì ngày/giờ mua là dữ liệu theo múi giờ người dùng.
 */
function normalizeTimeInput(value, fallback = '') {
    const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return fallback;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return fallback;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatLocalTimeInput(value = new Date()) {
    const supplied = normalizeTimeInput(value, '');
    if (supplied) return supplied;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatTimeVN(value) {
    return normalizeTimeInput(value, '') || '—';
}

// Existing records may not have purchaseTime. createdAt is the closest safe
// fallback and is intentionally only used when the explicit field is absent.
function getAccountPurchaseTime(account = {}) {
    const explicit = normalizeTimeInput(account.purchaseTime, '');
    if (explicit) return explicit;
    const createdAt = account.createdAt?.toDate?.() || account.createdAt;
    return createdAt ? formatLocalTimeInput(createdAt) : '';
}

function handleAccessibleTabKeydown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tablist = event.currentTarget?.matches?.('[role="tablist"]')
        ? event.currentTarget
        : event.target?.closest?.('[role="tablist"]');
    if (!tablist) return;
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]')).filter(tab => !tab.disabled);
    if (!tabs.length) return;
    const current = event.target?.closest?.('[role="tab"]');
    const currentIndex = Math.max(0, tabs.indexOf(current));
    let nextIndex = currentIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else if (event.key === 'ArrowLeft') nextIndex = Math.max(0, currentIndex - 1);
    else if (event.key === 'ArrowRight') nextIndex = Math.min(tabs.length - 1, currentIndex + 1);
    event.preventDefault();
    event.stopPropagation();
    const next = tabs[nextIndex];
    const nextTabId = next.dataset.tab || next.id;
    next.focus({ preventScroll: true });
    next.click();
    requestAnimationFrame(() => {
        const renderedTabs = Array.from(document.querySelectorAll('[role="tab"]'));
        const rendered = renderedTabs.find(tab => (tab.dataset.tab || tab.id) === nextTabId) || next;
        rendered.focus?.({ preventScroll: true });
        rendered.scrollIntoView?.({
            behavior: document.documentElement.classList.contains('reduced-motion') ? 'auto' : 'smooth',
            block: 'nearest',
            inline: 'center',
        });
    });
}

if (typeof window !== 'undefined') {
    window.formatLocalDateInput = formatLocalDateInput;
    window.normalizeTimeInput = normalizeTimeInput;
    window.formatLocalTimeInput = formatLocalTimeInput;
    window.formatTimeVN = formatTimeVN;
    window.getAccountPurchaseTime = getAccountPurchaseTime;
    window.handleAccessibleTabKeydown = handleAccessibleTabKeydown;
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

const TING_RELEASE_HISTORY = Object.freeze([
    {
        version: '1.7.3', date: '18/07/2026', title: 'Ổn định giao diện Nhóm và biểu đồ Chi tiêu',
        changes: [
            'Thiết kế lại tab Nhóm và điều phối dữ liệu realtime để chuyển tab chỉ vẽ một lần, không còn nháy hoặc tải lặp.',
            'Thêm biểu đồ dòng Chi tiêu chính với khung 10 ngày, kéo ngang bằng chuột hoặc cảm ứng và mặc định đặt ngày hôm nay ở giữa.',
            'Loại bỏ đợt animation thứ hai khi chuyển trang từ sidebar trên PC và mobile.',
            'Cải thiện lịch sử nhập riêng và bao gồm các sửa lỗi đồng bộ Chi tiêu với Firestore của bản phát triển 1.7.2.',
        ],
    },
    {
        version: '1.7.2', date: '17/07/2026', title: 'Đồng bộ Chi tiêu với Firestore',
        changes: [
            'Sửa kết nối auth/db dùng chung để ghi và đọc sổ giao dịch trên PC và mobile.',
            'Tự backfill các khoản mua cũ có giá vào dữ liệu Chi tiêu mà không tạo bản ghi trùng.',
            'Thu gọn bộ lọc và phần đầu trang Chi tiêu.',
            'Giữ lịch sử gộp ở đầu form và thêm ba nút riêng cho Ghi chú, Người bán, Giá với bản xem trước ghi chú một dòng.',
        ],
    },
    {
        version: '1.7.1', date: '17/07/2026', title: 'Chi tiêu và quy đổi theo giao dịch',
        changes: [
            'Thêm khu Chi tiêu trên dashboard, tự ghi nhận tiền mua tài khoản và hỗ trợ khoản chi thủ công.',
            'Bổ sung biểu đồ, thống kê theo tài khoản hoặc nền tảng cùng nhiều bộ lọc thời gian.',
            'Lưu loại tiền, tỷ giá và giá trị quy đổi VND tại đúng thời điểm giao dịch.',
            'Mở tài khoản từ khoản chi rồi quay lại đúng vị trí, đồng thời đưa dữ liệu chi tiêu vào backup/restore.',
        ],
    },
    {
        version: '1.7.0', date: '17/07/2026', title: 'Ổn định PC/mobile và lịch sử phiên bản',
        changes: [
            'Thêm bảng lịch sử phiên bản: chọn một phiên bản để xem riêng phần thay đổi của phiên bản đó.',
            'Nâng cấp backup/restore có xem trước, chọn dữ liệu, merge và xử lý conflict.',
            'Cải thiện dialog, search/filter, vuốt tab, kéo thả nhóm, animation và accessibility trên PC/mobile.',
            'Bổ sung giờ mua, ngày theo múi giờ địa phương, lịch sử dữ liệu đã nhập và các lớp bảo vệ XSS/CSP/Android backup.',
        ],
    },
    {
        version: '1.6.0', date: '15/07/2026', title: 'Smart Paste và form thêm tài khoản',
        changes: [
            'Nhận diện tài khoản, mật khẩu, 2FA, nền tảng, thời hạn, người bán và giá từ nội dung dán.',
            'Form thêm tài khoản dạng wizard có hướng dẫn, lịch sử nhập và tag gói cước tùy chỉnh.',
            'Cải thiện tạo nhanh danh mục và form thêm/sửa trên PC lẫn mobile.',
        ],
    },
    {
        version: '1.5.1', date: '13/07/2026', title: 'Chi tiết card và đồng bộ chia sẻ',
        changes: [
            'Xem thông tin chi tiết ngay trên card tài khoản.',
            'Cải thiện bộ lọc nhanh và tiêu đề kết quả theo nền tảng.',
            'Đồng bộ an toàn hơn giữa tài khoản gốc và tài khoản chia sẻ.',
        ],
    },
    {
        version: '1.5.0', date: '08/07/2026', title: 'Thiết kế lại Nhóm',
        changes: [
            'Thiết kế lại Board, danh mục, tài khoản, thành viên và cài đặt nhóm.',
            'Thêm chế độ chỉnh sửa, sắp xếp danh mục và di chuyển tài khoản.',
            'Bổ sung vai trò quản lý và luồng duyệt yêu cầu chỉnh sửa.',
        ],
    },
    {
        version: '1.4.3', date: '07/07/2026', title: 'Sửa nhanh và quản lý hết hạn',
        changes: [
            'Sửa nhanh tài khoản ngay tại màn hình chi tiết.',
            'Thêm mật khẩu vào nhóm độc lập với mật khẩu giải mã dữ liệu chia sẻ.',
            'Ẩn/hiện tài khoản hết hạn và nhóm thùng rác rõ ràng hơn.',
        ],
    },
    {
        version: '1.4.2', date: '05/07/2026', title: 'Điều hướng tài khoản nhóm',
        changes: [
            'Bấm tài khoản trên Board để chuyển tới đúng card trong tab Tài khoản.',
            'Cải thiện release notes, trạng thái tải và dọn APK cập nhật cũ.',
        ],
    },
    {
        version: '1.4.1', date: '05/07/2026', title: 'Trung tâm cập nhật mới',
        changes: [
            'Thiết kế lại khu Cập nhật với trạng thái, lịch sử và thanh tiến trình.',
            'Hiển thị phiên bản cạnh logo sidebar desktop và cải thiện installer Windows.',
        ],
    },
    {
        version: '1.4.0', date: '05/07/2026', title: 'Thiết kế Nhóm trên mobile',
        changes: [
            'Tạo danh mục nhóm tùy chỉnh với icon, màu và ghi chú.',
            'Kéo thả để sắp xếp và chuyển tài khoản giữa các danh mục.',
        ],
    },
    {
        version: '1.3.9', date: '05/07/2026', title: 'Cài đặt và mật khẩu nhóm',
        changes: [
            'Cho phép tạo và tham gia nhóm không cần mật khẩu chung.',
            'Thêm tab Cài đặt nhóm để đặt, đổi hoặc gỡ mật khẩu chung.',
        ],
    },
    {
        version: '1.3.8', date: '04/07/2026', title: 'Sinh trắc học và backup',
        changes: [
            'Mở khóa bằng vân tay hoặc khuôn mặt.',
            'Xuất/nhập file backup mã hóa và thêm hiệu ứng mượt cho PC/mobile.',
        ],
    },
    {
        version: '1.3.7', date: '03/07/2026', title: 'Hotfix cập nhật Android',
        changes: ['Sửa tải APK khi thiếu expectedSize và tiếp tục xác minh bằng SHA-256.'],
    },
    {
        version: '1.3.6', date: '03/07/2026', title: 'Quick Add và danh mục nhóm',
        changes: [
            'Thêm cửa sổ Quick Add cho Electron.',
            'Bổ sung danh mục, quyền quản lý và thứ tự tài khoản chia sẻ trong nhóm.',
        ],
    },
    {
        version: '1.3.5', date: '03/07/2026', title: 'Hotfix installer',
        changes: ['Sửa installer Windows và luồng tải/mở bản cập nhật Android.'],
    },
    {
        version: '1.3.4', date: '03/07/2026', title: 'Đồng bộ phát hành',
        changes: ['Đồng bộ version desktop/Android và kiểm tra pipeline phát hành.'],
    },
    {
        version: '1.3.2', date: '03/07/2026', title: 'Ổn định updater Android',
        changes: ['Hoàn thiện phần native tải/cài APK và thông báo hết hạn nền.'],
    },
    {
        version: '1.3.1', date: '03/07/2026', title: 'Hướng dẫn thêm tài khoản',
        changes: ['Thêm luồng hướng dẫn nhập nền tảng, dữ liệu đăng nhập và thời hạn.'],
    },
    {
        version: '1.3.0', date: '03/07/2026', title: 'Cập nhật đa nền tảng',
        changes: [
            'Thêm cập nhật trong ứng dụng cho Electron và Android.',
            'Thêm workflow phát hành tự động và Nhóm chia sẻ tài khoản.',
        ],
    },
    {
        version: '1.0.0', date: '27/04/2026', title: 'Phiên bản đầu tiên',
        changes: ['Khởi tạo Ting! với quản lý tài khoản, mã hóa dữ liệu và giao diện PC/mobile.'],
    },
]);

function getTingReleaseHistory() {
    return TING_RELEASE_HISTORY.map(item => ({ ...item, changes: [...item.changes] }));
}

function getSelectedTingReleaseVersion() {
    const selected = String(window.__tingSelectedReleaseVersion || '');
    return TING_RELEASE_HISTORY.some(item => item.version === selected)
        ? selected
        : TING_RELEASE_HISTORY[0].version;
}

function renderTingReleaseDetail(release) {
    if (!release) return '';
    return `<div class="release-history-detail-head">
        <div>
            <span class="release-history-eyebrow">Phiên bản ${escapeHtml(release.version)}</span>
            <h4>${escapeHtml(release.title)}</h4>
        </div>
        <time datetime="${escapeHtml(release.date.split('/').reverse().join('-'))}">${escapeHtml(release.date)}</time>
    </div>
    <ul class="release-history-changes">${release.changes.map(change => `<li>${escapeHtml(change)}</li>`).join('')}</ul>`;
}

function renderTingReleaseHistory() {
    const selected = getSelectedTingReleaseVersion();
    const release = TING_RELEASE_HISTORY.find(item => item.version === selected) || TING_RELEASE_HISTORY[0];
    return `<section class="release-history" data-release-history aria-labelledby="release-history-title">
        <div class="release-history-heading">
            <div>
                <span class="release-history-kicker">Có gì mới?</span>
                <h3 id="release-history-title">Lịch sử phiên bản</h3>
            </div>
            <span class="release-history-count">${TING_RELEASE_HISTORY.length} bản</span>
        </div>
        <div class="release-history-layout">
            <div class="release-history-tabs" role="tablist" aria-label="Chọn phiên bản" onkeydown="handleAccessibleTabKeydown(event)">
                ${TING_RELEASE_HISTORY.map((item, index) => {
                    const active = item.version === release.version;
                    return `<button type="button" id="release-tab-${escapeHtml(item.version.replace(/\./g, '-'))}" class="release-history-tab${active ? ' active' : ''}" data-tab="${escapeHtml(item.version)}" data-release-version="${escapeHtml(item.version)}" role="tab" aria-selected="${active}" aria-controls="release-history-detail" tabindex="${active ? '0' : '-1'}" onclick="selectTingReleaseVersion('${escapeJsAttr(item.version)}')">
                        <span class="release-history-tab-version">v${escapeHtml(item.version)}</span>
                        <span class="release-history-tab-date">${escapeHtml(item.date)}</span>
                        ${index === 0 ? '<span class="release-history-new">Mới</span>' : ''}
                    </button>`;
                }).join('')}
            </div>
            <div id="release-history-detail" class="release-history-detail" data-release-detail role="tabpanel" aria-live="polite" aria-labelledby="release-tab-${escapeHtml(release.version.replace(/\./g, '-'))}">
                ${renderTingReleaseDetail(release)}
            </div>
        </div>
    </section>`;
}

function selectTingReleaseVersion(version) {
    const release = TING_RELEASE_HISTORY.find(item => item.version === String(version || ''));
    if (!release) return false;
    window.__tingSelectedReleaseVersion = release.version;
    const root = document.querySelector?.('[data-release-history]');
    if (!root) return true;
    root.querySelectorAll?.('[data-release-version]').forEach(button => {
        const active = button.dataset.releaseVersion === release.version;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
        button.setAttribute('tabindex', active ? '0' : '-1');
    });
    const detail = root.querySelector?.('[data-release-detail]');
    if (detail) {
        detail.innerHTML = renderTingReleaseDetail(release);
        detail.setAttribute('aria-labelledby', `release-tab-${release.version.replace(/\./g, '-')}`);
        detail.classList.remove('release-history-detail-enter');
        const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout;
        schedule(() => detail.classList.add('release-history-detail-enter'), 0);
        root.querySelector?.(`[data-release-version="${escapeJsAttr(release.version)}"]`)?.scrollIntoView?.({
            behavior: document.documentElement?.classList?.contains('reduced-motion') ? 'auto' : 'smooth',
            block: 'nearest', inline: 'center',
        });
    }
    return true;
}

if (typeof window !== 'undefined') {
    window.getTingReleaseHistory = getTingReleaseHistory;
    window.renderTingReleaseHistory = renderTingReleaseHistory;
    window.selectTingReleaseVersion = selectTingReleaseVersion;
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

function isAccountExpiredForSort(acc) {
    if (!acc) return false;
    if (acc.status === 'expired') return true;
    if (acc.expiryType === 'lifetime') return false;
    if (!acc.expiryDate) return false;
    return daysUntil(acc.expiryDate) < 0;
}

function sortAccountsByPriority(accounts = []) {
    return [...(accounts || [])]
        .map((acc, index) => ({ acc, index }))
        .sort((a, b) => {
            const expiredDiff = Number(isAccountExpiredForSort(a.acc)) - Number(isAccountExpiredForSort(b.acc));
            if (expiredDiff) return expiredDiff;

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

// ─────────────────────────────────────────────────────────────────────────────
// Lớp logic thuần cho tính năng "expired-toggle-trash-grouping":
// bật/tắt hiển thị tài khoản hết hạn + đếm ngược thời hạn giữ trong thùng rác.
// Tất cả là hàm thuần: làm việc trên bản sao mảng, KHÔNG mutate đầu vào,
// KHÔNG chạm DOM. Khai báo ở phạm vi module nên tự động là hàm global lúc chạy
// (giống buildAccountDisplayItems / sortAccountsByPriority) và test nạp được qua sandbox.
//
// Ghi chú tái dùng: buildAccountDisplayItems ở trên dùng chung nguyên trạng cho
// cả màn hình danh sách lẫn thùng rác — cùng khoá nhóm (getAccountGroupKey) và
// cùng quy tắc sắp xếp (sortAccountsByPriority), không cần thay đổi gì thêm.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Xác định một tài khoản có phải tài khoản đã hết hạn hay không.
 * Nguồn chân lý: getStatusFromExpiry trả về 'expired' (số ngày còn lại < 0).
 * Tài khoản có expiryType = 'lifetime' luôn được coi là còn hạn (trả về false).
 */
function isExpiredAccount(acc) {
    if (!acc) return false;
    if (acc.expiryType === 'lifetime') return false;
    return getStatusFromExpiry(acc.expiryDate, acc.expiryType) === 'expired';
}

/**
 * Lọc tập tài khoản hiển thị theo trạng thái nút "Hiển thị tài khoản hết hạn".
 *  - showExpired = false: loại bỏ mọi tài khoản hết hạn, giữ đủ tài khoản còn hạn.
 *  - showExpired = true : giữ nguyên toàn bộ tài khoản.
 * Trả về mảng mới (bản sao), không mutate mảng đầu vào.
 */
function filterAccountsByExpiredToggle(accounts, showExpired) {
    const list = Array.isArray(accounts) ? accounts : [];
    if (showExpired) return [...list];
    return list.filter(acc => !isExpiredAccount(acc));
}

/**
 * Sắp xếp: toàn bộ tài khoản còn hạn đứng trước, hết hạn đứng sau.
 * Ổn định (stable): giữ nguyên thứ tự tương đối ban đầu trong từng phân nhóm
 * (thứ tự giữa các tài khoản còn hạn không đổi và giữa các tài khoản hết hạn không đổi).
 * Không thêm/bớt phần tử, trả về mảng mới, không mutate đầu vào.
 */
function partitionActiveThenExpired(accounts) {
    const list = Array.isArray(accounts) ? accounts : [];
    const active = [];
    const expired = [];
    list.forEach(acc => {
        if (isExpiredAccount(acc)) expired.push(acc);
        else active.push(acc);
    });
    return [...active, ...expired];
}

/**
 * Tính số lượng hiển thị của một nhóm nền tảng theo trạng thái toggle.
 *  - showExpired = false: chỉ đếm tài khoản còn hạn (bỏ mọi tài khoản hết hạn).
 *  - showExpired = true : đếm tổng (còn hạn + hết hạn) trong nhóm.
 */
function countGroupVisible(accounts, showExpired) {
    const list = Array.isArray(accounts) ? accounts : [];
    if (showExpired) return list.length;
    return list.filter(acc => !isExpiredAccount(acc)).length;
}

/**
 * Định dạng chuỗi đếm ngược thời hạn giữ (Dem_Nguoc_Giu) trong thùng rác.
 * Dùng getTrashDaysLeft(acc) — hàm này luôn trả số nguyên >= 0 (đã kẹp Math.max(0, ...)):
 *  - daysLeft >= 1: trả "còn X ngày giữ".
 *  - daysLeft = 0 : trả trạng thái hết hạn giữ, không bao giờ hiển thị số âm.
 */
function formatTrashCountdown(acc) {
    const daysLeft = getTrashDaysLeft(acc);
    return daysLeft >= 1 ? `còn ${daysLeft} ngày giữ` : 'hết hạn giữ';
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
        element.scrollIntoView({ behavior: document.documentElement.classList.contains('reduced-motion') ? 'auto' : (options.behavior || 'smooth'), block, inline: 'nearest' });
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
    guide.pasteGuided = true;
    // Đã bỏ auto-cuộn tới ô dán / tên dịch vụ (theo yêu cầu). Wizard chỉ
    // chuyển tab (skip trang) và cuộn lên đầu mỗi lần, không cuộn tới field.
}

function handleQuickPasteGuidance() {
    // Đã bỏ auto-cuộn tới ô "Thời hạn" sau khi dán (theo yêu cầu).
}

function guideAddFormFromDate() {
    markAddFormDateTouched();
    // Wizard: rời ô Thời hạn → thử auto-chuyển sang Tab 3 (skip trang).
    // Không cuộn tới field; goAddTab tự cuộn lên đầu tab mới.
    if (typeof maybeAutoAdvanceToStep3 === 'function') maybeAutoAdvanceToStep3();
}

function guideAddFormFromNote() {
    // Đã bỏ auto-cuộn tới ô "Người bán" (theo yêu cầu).
}

function guideAddFormFromSeller() {
    // Đã bỏ auto-cuộn tới ô "Giá mua" (theo yêu cầu).
}

// ===== WIZARD 3 TAB (Thêm/Sửa TK) =====
const ADD_WIZARD_TOTAL_TABS = 3;
const ADD_WIZARD_STEP_LABELS = ['Nền tảng', 'Thông tin', 'Bổ sung'];

function renderAddWizardSteps() {
    const steps = ADD_WIZARD_STEP_LABELS.map((label, index) => {
        const tab = index + 1;
        return `<button type="button" class="add-wizard-step" data-step="${tab}" onclick="goAddTab(${tab}, { manual: true, fromStepper: true })">
            <span class="add-wizard-step-num">${tab}</span>
            <span class="add-wizard-step-label">${label}</span>
        </button>`;
    }).join('<span class="add-wizard-step-sep" aria-hidden="true">›</span>');
    return `<div class="add-wizard-steps" id="add-wizard-steps">${steps}</div>`;
}

function updateAddWizardSteps() {
    const current = window.appState?.addFormTab || 1;
    document.querySelectorAll('#add-wizard-steps .add-wizard-step').forEach(btn => {
        const tab = Number(btn.dataset.step);
        btn.classList.toggle('active', tab === current);
        btn.classList.toggle('done', tab < current);
        btn.classList.remove('disabled');
        btn.disabled = false;
    });
}

function goAddTab(tab, opts = {}) {
    const g = window.appState;
    if (!g) return;
    tab = Math.min(Math.max(1, tab | 0), ADD_WIZARD_TOTAL_TABS);
    const prev = g.addFormTab || 1;
    // R6.4 LUẬT HỦY: user chủ động quay lại tab NHỎ HƠN → tắt mọi auto-chuyển phần còn lại của phiên
    if (opts.manual && tab < prev) {
        g.addFormAutoNavDisabled = true;
    }
    g.addFormTab = tab;
    g.addFormMaxTabReached = Math.max(g.addFormMaxTabReached || 1, tab);
    document.querySelectorAll('.add-wizard-panel').forEach(panel => {
        panel.hidden = Number(panel.dataset.tab) !== tab;
    });
    updateAddWizardSteps();
    // Chỉ cuộn lên đầu tab mới (skip trang), KHÔNG cuộn tới field chưa nhập.
    // Vùng cuộn thật của modal (index.html: #modal-body). KHÔNG có #modal-content.
    const modalBody = document.getElementById('modal-body');
    if (modalBody) modalBody.scrollTop = 0;
    // Đề phòng trường hợp cửa sổ chính cũng cuộn (mobile), đưa về đầu wizard.
    const wizard = document.getElementById('add-wizard');
    if (wizard && typeof wizard.scrollIntoView === 'function') {
        wizard.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
}

function skipPlatformStep() {
    goAddTab(2, { manual: true });
}

// Nút nền tảng cũ gọi selectPlatformFromPicker(platform, NAME) — 2 tham số (id + name),
// KHÔNG phải selectAddPlatform(id). Hàm này bọc lại, giữ đúng chữ ký + name.
function selectPlatformThenAdvance(platform, name) {
    if (typeof selectPlatformFromPicker === 'function') selectPlatformFromPicker(platform, name);
    if (platform === 'other') return;                       // 'other' = bỏ chọn, không auto sang tab 2
    if (window.appState?.addFormAutoNavDisabled) return;    // R6.4
    goAddTab(2);                                            // R2.2 — auto (KHÔNG manual)
}

function maybeAutoAdvanceToStep3() {
    const g = window.appState;
    if (!g) return;
    if (g.addFormAutoNavDisabled) return;      // R6.4: user đã hủy auto-nav
    if (g.addFormAutoAdvancedToStep3) return;  // R6.2: chỉ 1 lần/phiên
    const name = document.getElementById('add-name')?.value.trim();
    const hasName = !!name || !!g.addFormPlatform;
    const lifetime = document.getElementById('add-lifetime')?.checked;
    const expiry = document.getElementById('add-expiry')?.value;
    const hasExpiry = !!lifetime || !!expiry;
    if (hasName && hasExpiry) {
        g.addFormAutoAdvancedToStep3 = true;
        goAddTab(3);                            // auto — KHÔNG manual
    }
}

const ADD_QUICK_FORM_TEMPLATE = 'note:\ngia:\nshop:\nngay:\ngoi:\n\ntai_khoan|mat_khau|2fa';
const ADD_QUICK_FORM_HISTORY_KEY = 'ting.addQuickFormHistory.v1';
const ADD_QUICK_FORM_HISTORY_MAX_AGE = 90 * 24 * 60 * 60 * 1000;
const ADD_QUICK_FORM_HISTORY_LIMIT = 20;

function getAddQuickFormPlatform() {
    const selected = window.appState?.addFormPlatform;
    const name = document.getElementById('add-name')?.value || '';
    return selected || (typeof detectPlatform === 'function' ? detectPlatform(name) : '') || 'other';
}

function loadAddQuickFormHistory(now = Date.now()) {
    let items = [];
    try {
        const parsed = JSON.parse(localStorage.getItem(ADD_QUICK_FORM_HISTORY_KEY) || '[]');
        if (Array.isArray(parsed)) items = parsed;
    } catch {}
    const fresh = items
        .filter(item => item && now - Number(item.lastUsedAt || item.createdAt || 0) <= ADD_QUICK_FORM_HISTORY_MAX_AGE)
        .sort((a, b) => Number(b.lastUsedAt || 0) - Number(a.lastUsedAt || 0))
        .slice(0, ADD_QUICK_FORM_HISTORY_LIMIT);
    if (fresh.length !== items.length) {
        try { localStorage.setItem(ADD_QUICK_FORM_HISTORY_KEY, JSON.stringify(fresh)); } catch {}
    }
    return fresh;
}

function getAddQuickFormSnapshot() {
    const tags = typeof getAddTags === 'function' ? getAddTags() : [];
    return {
        platform: getAddQuickFormPlatform(),
        note: document.getElementById('add-note')?.value.trim() || '',
        price: document.getElementById('add-price')?.value.trim() || '',
        shop: document.getElementById('add-seller-name')?.value.trim() || '',
        sellerPlatform: document.getElementById('add-seller-platform')?.value || 'other',
        sellerLink: document.getElementById('add-seller-link')?.value.trim() || '',
        date: document.getElementById('add-smart-date')?.value.trim() || '',
        plan: tags[0] || '',
    };
}

function getAddQuickFormHistoryKey(item) {
    return JSON.stringify([
        item.platform || 'other', item.note || '', item.price || '', item.shop || '',
        item.sellerPlatform || 'other', item.sellerLink || '', item.date || '', item.plan || '',
    ]).toLowerCase();
}

function recordAddQuickFormHistory() {
    const item = getAddQuickFormSnapshot();
    if (![item.note, item.price, item.shop, item.date, item.plan].some(Boolean)) return;
    const now = Date.now();
    const key = getAddQuickFormHistoryKey(item);
    const history = loadAddQuickFormHistory(now);
    const previous = history.find(entry => getAddQuickFormHistoryKey(entry) === key);
    const next = {
        ...item,
        createdAt: Number(previous?.createdAt || now),
        lastUsedAt: now,
    };
    const saved = [next, ...history.filter(entry => getAddQuickFormHistoryKey(entry) !== key)]
        .slice(0, ADD_QUICK_FORM_HISTORY_LIMIT);
    try { localStorage.setItem(ADD_QUICK_FORM_HISTORY_KEY, JSON.stringify(saved)); } catch {}
}

function getFilteredAddQuickFormHistory() {
    const platform = getAddQuickFormPlatform();
    const history = loadAddQuickFormHistory();
    if (!platform || platform === 'other') return history.slice(0, 8);
    return history.filter(item => item.platform === platform).slice(0, 8);
}

function getAddQuickFormHistoryLabel(item) {
    return item.plan || item.shop || item.note || item.date || 'Form gần đây';
}

function renderAddQuickFormPopover() {
    const items = getFilteredAddQuickFormHistory();
    const history = items.length
        ? items.map((item, index) => `<button type="button" class="quick-form-history-item" onclick="applyAddQuickFormHistory(${index})"><strong>${escapeHtml(getAddQuickFormHistoryLabel(item))}</strong><span>${escapeHtml([item.shop, item.price, item.date].filter(Boolean).join(' · ') || 'Thông tin đã dùng')}</span></button>`).join('')
        : '<div class="quick-form-history-empty">Chưa có lịch sử cho nền tảng này</div>';
    return `<div class="quick-form-popover-section"><div class="quick-form-popover-title">Form mẫu</div><button type="button" class="quick-form-template-card" onclick="insertAddQuickFormTemplate()"><code>note · gia · shop · ngay · goi</code><span>Chèn form trống để điền nhanh</span></button></div><div class="quick-form-popover-section"><div class="quick-form-popover-title">Lịch sử gần đây</div><div class="quick-form-history-list">${history}</div></div>`;
}

function closeAddQuickFormPopover() {
    const popover = document.getElementById('add-quick-form-popover');
    if (popover) popover.hidden = true;
    document.removeEventListener('keydown', handleAddQuickFormEscape);
}

function handleAddQuickFormEscape(event) {
    if (event.key === 'Escape') closeAddQuickFormPopover();
}

function toggleAddQuickFormPopover(event) {
    event?.stopPropagation?.();
    const popover = document.getElementById('add-quick-form-popover');
    if (!popover) return;
    const opening = popover.hidden;
    popover.hidden = !opening;
    if (!opening) return;
    popover.innerHTML = renderAddQuickFormPopover();
    document.addEventListener('keydown', handleAddQuickFormEscape);
    setTimeout(() => document.addEventListener('click', closeAddQuickFormPopover, { once: true }), 0);
}

function insertAddQuickFormTemplate() {
    const input = document.getElementById('paste-input');
    if (!input) return;
    const current = input.value.trim();
    input.value = current && !/^(note|gia|shop|ngay|goi)\s*:/im.test(current)
        ? `${ADD_QUICK_FORM_TEMPLATE.replace('tai_khoan|mat_khau|2fa', current)}`
        : ADD_QUICK_FORM_TEMPLATE;
    closeAddQuickFormPopover();
    input.focus();
    previewParse?.();
}

function applyAddQuickFormData(item = {}) {
    const note = document.getElementById('add-note');
    const price = document.getElementById('add-price');
    const seller = document.getElementById('add-seller-name');
    if (note && item.note !== undefined) note.value = item.note || '';
    if (price && item.price !== undefined) {
        price.value = item.price || '';
        if (typeof formatPriceField === 'function') formatPriceField(price);
    }
    if (seller && item.shop !== undefined) seller.value = item.shop || '';
    if (typeof selectSellerPlatform === 'function' && item.sellerPlatform) selectSellerPlatform(item.sellerPlatform, { syncLink: false });
    const sellerLink = document.getElementById('add-seller-link');
    if (sellerLink && item.sellerLink !== undefined) sellerLink.value = item.sellerLink || '';
    if (item.date && typeof applySmartDateInput === 'function') {
        const smartDate = document.getElementById('add-smart-date');
        if (smartDate) smartDate.value = item.date;
        applySmartDateInput(item.date);
    }
    if (item.plan && typeof setAddTags === 'function') setAddTags([item.plan]);
    if (typeof renderSelectedAddTags === 'function') renderSelectedAddTags();
    if (typeof updateAddTagSuggestions === 'function') updateAddTagSuggestions();
}

function applyAddQuickFormHistory(index) {
    const item = getFilteredAddQuickFormHistory()[Number(index)];
    if (!item) return;
    applyAddQuickFormData(item);
    item.lastUsedAt = Date.now();
    const history = loadAddQuickFormHistory();
    const key = getAddQuickFormHistoryKey(item);
    const saved = [item, ...history.filter(entry => getAddQuickFormHistoryKey(entry) !== key)];
    try { localStorage.setItem(ADD_QUICK_FORM_HISTORY_KEY, JSON.stringify(saved)); } catch {}
    closeAddQuickFormPopover();
}

function copyPasteSelectionToNote() {
    const input = document.getElementById('paste-input');
    const note = document.getElementById('add-note');
    if (!input || !note) return;
    const selected = input.value.slice(input.selectionStart || 0, input.selectionEnd || 0).trim();
    const content = selected || input.value.trim();
    if (!content) return;
    const tagged = `[copy]${content}[/copy]`;
    note.value = note.value.trim() ? `${note.value.trim()}\n${tagged}` : tagged;
    if (typeof showToast === 'function') showToast('Đã đưa nội dung vào ghi chú', 'success');
}

function applySmartPasteMetadata(parsed) {
    if (!parsed) return;
    applyAddQuickFormData({
        note: parsed.note || undefined,
        price: parsed.price != null ? String(parsed.price) : undefined,
        shop: parsed.seller?.name || undefined,
        sellerPlatform: parsed.seller?.platform,
        sellerLink: parsed.seller?.url,
        date: parsed.duration?.text,
        plan: parsed.plan || undefined,
    });
    const nameInput = document.getElementById('add-name');
    if (nameInput && parsed.name && (!nameInput.value.trim() || nameInput.dataset.autoFilled === 'true')) {
        nameInput.value = parsed.name;
        nameInput.dataset.autoFilled = 'true';
    }
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

// ===== LỊCH SỬ RIÊNG CHO GHI CHÚ / NGƯỜI BÁN / GIÁ =====

function formatAddHistoryPriceLabel(value) {
    const formatted = typeof formatPriceInput === 'function'
        ? formatPriceInput(value)
        : String(value || '');
    return formatted ? `${formatted} ₫` : '';
}

const ADD_HISTORY_FIELD_CONFIG = Object.freeze({
    note: { key: 'notes', title: 'Lịch sử ghi chú' },
    seller: { key: 'sellers', title: 'Lịch sử người bán' },
    price: { key: 'prices', title: 'Lịch sử giá mua' },
});

function getAddHistoryFieldItems(kind, editingId = '') {
    const config = ADD_HISTORY_FIELD_CONFIG[kind];
    if (!config) return [];
    const history = buildAddFormHistorySuggestions(editingId);
    return history[config.key] || [];
}

function renderAddHistoryFieldButton(kind, editingId = '') {
    const config = ADD_HISTORY_FIELD_CONFIG[kind];
    const items = getAddHistoryFieldItems(kind, editingId);
    if (!config) return '';
    const disabled = items.length ? '' : ' disabled aria-disabled="true" title="Chưa có lịch sử"';
    const action = items.length ? `onclick="toggleAddHistoryPopover(event,'${escapeJsAttr(kind)}')"` : '';
    return `<div class="add-history-anchor add-history-anchor-${escapeHtml(kind)}">
        <button type="button" class="add-history-open-btn" ${action}${disabled} aria-label="${escapeHtml(config.title)}">
            <span class="add-history-open-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg></span>
            <span class="add-history-open-tx">Lịch sử</span>
            <span class="add-history-open-count">${items.length}</span>
        </button>
        <div id="add-history-popover-${escapeHtml(kind)}" class="add-history-popover" data-kind="${escapeHtml(kind)}" data-editing-id="${escapeHtml(editingId || '')}" hidden onclick="event.stopPropagation()"></div>
    </div>`;
}

function renderAddHistoryOpenButton(editingId = '') {
    const history = buildAddFormHistorySuggestions(editingId);
    const total = history.notes.length + history.sellers.length
        + history.prices.length + history.bundles.length;
    const disabled = total ? '' : ' disabled aria-disabled="true" title="Chưa có lịch sử"';
    const action = total ? 'onclick="toggleAddHistoryPopover(event,\'combined\')"' : '';
    return `<div class="add-history-combined-row">
        <div class="add-history-anchor add-history-anchor-combined">
            <button type="button" class="add-history-open-btn add-history-open-btn-combined" ${action}${disabled} aria-label="Lịch sử đã nhập">
                <span class="add-history-open-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg></span>
                <span class="add-history-open-tx">Lịch sử đã nhập</span>
                <span class="add-history-open-count">${total}</span>
                <span class="add-history-open-caret" aria-hidden="true">▾</span>
            </button>
            <div id="add-history-popover-combined" class="add-history-popover add-history-popover-combined" data-kind="combined" data-editing-id="${escapeHtml(editingId || '')}" hidden onclick="event.stopPropagation()"></div>
        </div>
    </div>`;
}

function renderAddHistorySectionWrap(kind, title, itemsHtml) {
    if (!itemsHtml) return '';
    return `<div class="add-history-section add-history-section-${escapeHtml(kind)}">
        <div class="add-history-section-title">${escapeHtml(title)}</div>
        <div class="add-history-section-items">${itemsHtml}</div>
    </div>`;
}

function renderAddHistoryPopoverContent(kind, editingId = '') {
    const history = buildAddFormHistorySuggestions(editingId);
    if (kind === 'combined') {
        const sections = [];
        if (history.bundles.length) {
            const items = history.bundles.map(item => {
                const payload = escapeJsAttr(encodeAddHistoryPayload(item));
                const priceLabel = formatAddHistoryPriceLabel(item.purchasePrice);
                const meta = [item.sellerName, priceLabel].filter(Boolean).join(' · ');
                return `<button type="button" class="add-history-item add-history-item-bundle" onclick="applyAddHistoryBundle('${payload}');closeAddHistoryPopover()">
                    <span class="add-history-item-note">${escapeHtml(getAddHistoryPreview(item.note))}</span>
                    ${meta ? `<span class="add-history-item-meta">${escapeHtml(meta)}</span>` : ''}
                </button>`;
            }).join('');
            sections.push(renderAddHistorySectionWrap('bundle', 'Bộ đầy đủ · ghi chú + người bán + giá', items));
        }
        if (history.notes.length) {
            const items = history.notes.map(item => {
                const payload = escapeJsAttr(encodeAddHistoryPayload(item.value));
                return `<button type="button" class="add-history-item add-history-item-note-row" onclick="applyAddHistoryNote('${payload}');closeAddHistoryPopover()"><span class="add-history-item-note">${escapeHtml(item.label)}</span></button>`;
            }).join('');
            sections.push(renderAddHistorySectionWrap('note', 'Ghi chú', items));
        }
        if (history.sellers.length) {
            const items = history.sellers.map(item => {
                const name = escapeJsAttr(encodeAddHistoryPayload(item.name));
                const platform = escapeJsAttr(item.platform || 'other');
                const link = escapeJsAttr(encodeAddHistoryPayload(item.link || ''));
                return `<button type="button" class="add-history-item add-history-item-seller" onclick="applyAddHistorySeller('${name}','${platform}','${link}');closeAddHistoryPopover()"><span class="add-history-item-main">${escapeHtml(item.name)}</span></button>`;
            }).join('');
            sections.push(renderAddHistorySectionWrap('seller', 'Người bán', items));
        }
        if (history.prices.length) {
            const items = history.prices.map(item => {
                const payload = escapeJsAttr(encodeAddHistoryPayload(String(item.value)));
                return `<button type="button" class="add-history-item add-history-item-price" onclick="applyAddHistoryPrice('${payload}');closeAddHistoryPopover()">${escapeHtml(formatAddHistoryPriceLabel(item.value) || item.label)}</button>`;
            }).join('');
            sections.push(renderAddHistorySectionWrap('price', 'Giá mua', items));
        }
        const body = sections.join('') || '<div class="add-history-empty">Chưa có lịch sử nào để chọn</div>';
        return `<div class="add-history-popover-head">
            <span class="add-history-popover-title">Lịch sử đã nhập</span>
            <button type="button" class="add-history-popover-close" onclick="closeAddHistoryPopover()" aria-label="Đóng">✕</button>
        </div><div class="add-history-popover-body">${body}</div>`;
    }

    const config = ADD_HISTORY_FIELD_CONFIG[kind];
    if (!config) return '';
    let items = '';

    if (kind === 'note') {
        items = history.notes.map(item => {
            const payload = escapeJsAttr(encodeAddHistoryPayload(item.value));
            return `<button type="button" class="add-history-item add-history-item-note-row" onclick="applyAddHistoryNote('${payload}');closeAddHistoryPopover()" title="${escapeHtml(item.label)}"><span class="add-history-item-note">${escapeHtml(item.label)}</span></button>`;
        }).join('');
    } else if (kind === 'seller') {
        items = history.sellers.map(item => {
            const name = escapeJsAttr(encodeAddHistoryPayload(item.name));
            const platform = escapeJsAttr(item.platform || 'other');
            const link = escapeJsAttr(encodeAddHistoryPayload(item.link || ''));
            const sub = item.link ? `<span class="add-history-item-sub">${escapeHtml(item.link)}</span>` : '';
            return `<button type="button" class="add-history-item add-history-item-seller" onclick="applyAddHistorySeller('${name}','${platform}','${link}');closeAddHistoryPopover()">
                <span class="add-history-item-main">${escapeHtml(item.name)}</span>${sub}
            </button>`;
        }).join('');
    } else if (kind === 'price') {
        items = history.prices.map(item => {
            const payload = escapeJsAttr(encodeAddHistoryPayload(String(item.value)));
            return `<button type="button" class="add-history-item add-history-item-price" onclick="applyAddHistoryPrice('${payload}');closeAddHistoryPopover()">${escapeHtml(formatAddHistoryPriceLabel(item.value) || item.label)}</button>`;
        }).join('');
    }

    const body = items
        ? `<div class="add-history-section add-history-section-${escapeHtml(kind)}"><div class="add-history-section-items">${items}</div></div>`
        : '<div class="add-history-empty">Chưa có lịch sử nào để chọn</div>';
    return `<div class="add-history-popover-head">
        <span class="add-history-popover-title">${escapeHtml(config.title)}</span>
        <button type="button" class="add-history-popover-close" onclick="closeAddHistoryPopover()" aria-label="Đóng">✕</button>
    </div>
    <div class="add-history-popover-body">${body}</div>`;
}

function closeAddHistoryPopover() {
    document.querySelectorAll?.('.add-history-popover').forEach(popover => { popover.hidden = true; });
    if (typeof document !== 'undefined') document.removeEventListener('keydown', handleAddHistoryEscape);
}

function handleAddHistoryEscape(event) {
    if (event.key === 'Escape') closeAddHistoryPopover();
}

function toggleAddHistoryPopover(event, kind = '') {
    event?.stopPropagation?.();
    const anchor = event?.currentTarget?.closest?.('.add-history-anchor');
    const popover = anchor?.querySelector?.('.add-history-popover');
    if (!popover) return;
    const opening = popover.hidden;
    closeAddHistoryPopover();
    if (!opening) {
        return;
    }
    popover.hidden = false;
    popover.innerHTML = renderAddHistoryPopoverContent(kind || popover.dataset.kind, popover.dataset.editingId || '');
    positionAddHistoryPopover(popover);
    document.addEventListener('keydown', handleAddHistoryEscape);
    setTimeout(() => document.addEventListener('click', closeAddHistoryPopover, { once: true }), 0);
}

// Lật popover lên trên khi khoảng trống bên dưới nút không đủ nhưng bên trên
// rộng hơn — để luôn nhìn đầy đủ nội dung, không bị tràn/cắt đáy màn hình.
function positionAddHistoryPopover(popover) {
    if (!popover || typeof popover.getBoundingClientRect !== 'function') return;
    const anchor = popover.parentElement;
    if (!anchor?.getBoundingClientRect) return;
    const rect = anchor.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement?.clientHeight || 0;
    const spaceBelow = viewport - rect.bottom;
    const spaceAbove = rect.top;
    const needed = popover.offsetHeight || 320;
    popover.classList.toggle('flip-up', spaceBelow < needed + 16 && spaceAbove > spaceBelow);
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

// ─────────────────────────────────────────────────────────────────────────────
// Lớp logic thuần cho tính năng "group-tab-edit-mode":
// quyết định trạng thái Edit_Mode/View_Mode và việc hiển thị các Edit_Control
// trong Group_Tab. Tất cả là HÀM THUẦN: không chạm DOM, không mutate đầu vào,
// chỉ nhận/trả về giá trị nguyên thủy hoặc object nhỏ mới — thuận lợi cho
// property-based testing (giống pattern của khối expired-toggle ở trên).
//
// Trạng thái Edit_Mode được lưu dạng { groupId, active } trong window.appState.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quyết định Group_Tab của groupId hiện tại có đang ở Edit_Mode hay không.
 * Chỉ là Edit_Mode khi VÀ CHỈ KHI: người dùng có quyền thiết kế (canDesign),
 * cờ active đang bật, VÀ trạng thái đang neo đúng groupId đang xem.
 * Nhờ ràng buộc groupId, mở nhóm khác sẽ tự về View_Mode (an toàn kép).
 */
function resolveGroupEditMode(editState, groupId, canDesign) {
    return Boolean(canDesign)
        && Boolean(editState)
        && editState.active === true
        && editState.groupId === groupId;
}

/**
 * Nút bút chì (Edit_Toggle_Button) chỉ hiển thị với người có Design_Permission
 * (hiện tại tương ứng vai trò chủ nhóm: group.role === 'owner').
 */
function shouldShowEditToggleButton(group) {
    return Boolean(group) && group.role === 'owner';
}

/**
 * Edit_Control cấu trúc danh mục (mũi tên sắp xếp danh mục, sửa, xóa, thêm danh mục)
 * hiển thị khi VÀ CHỈ KHI đang Edit_Mode VÀ người dùng có quyền thiết kế nhóm.
 */
function isCategoryEditControlVisible(editMode, canDesign) {
    return Boolean(editMode) && Boolean(canDesign);
}

/**
 * Edit_Control của một tài khoản (mũi tên sắp xếp tài khoản, dropdown đổi danh mục)
 * hiển thị khi VÀ CHỈ KHI đang Edit_Mode VÀ người dùng được phép quản lý tài khoản đó.
 */
function isAccountEditControlVisible(editMode, canManage) {
    return Boolean(editMode) && Boolean(canManage);
}

/**
 * Bấm Edit_Toggle_Button: đảo cờ active và neo trạng thái vào groupId hiện tại.
 * Nếu trạng thái đang thuộc nhóm khác (hoặc chưa active), coi như đang tắt rồi
 * bật cho nhóm hiện tại. Trả về object mới, KHÔNG mutate editState đầu vào.
 */
function nextGroupEditState(editState, groupId) {
    const sameGroupActive = Boolean(editState)
        && editState.groupId === groupId
        && editState.active === true;
    return { groupId, active: !sameGroupActive };
}

/**
 * Trạng thái View_Mode chuẩn (dùng khi reset lúc chuyển tab con hoặc đổi nhóm).
 */
function resetGroupEditState() {
    return { groupId: null, active: false };
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
    window.renderAddWizardSteps = renderAddWizardSteps;
    window.updateAddWizardSteps = updateAddWizardSteps;
    window.goAddTab = goAddTab;
    window.skipPlatformStep = skipPlatformStep;
    window.selectPlatformThenAdvance = selectPlatformThenAdvance;
    window.maybeAutoAdvanceToStep3 = maybeAutoAdvanceToStep3;
    window.ADD_QUICK_FORM_TEMPLATE = ADD_QUICK_FORM_TEMPLATE;
    window.loadAddQuickFormHistory = loadAddQuickFormHistory;
    window.recordAddQuickFormHistory = recordAddQuickFormHistory;
    window.renderAddQuickFormPopover = renderAddQuickFormPopover;
    window.toggleAddQuickFormPopover = toggleAddQuickFormPopover;
    window.closeAddQuickFormPopover = closeAddQuickFormPopover;
    window.insertAddQuickFormTemplate = insertAddQuickFormTemplate;
    window.applyAddQuickFormHistory = applyAddQuickFormHistory;
    window.copyPasteSelectionToNote = copyPasteSelectionToNote;
    window.applySmartPasteMetadata = applySmartPasteMetadata;
    window.buildAddFormHistorySuggestions = buildAddFormHistorySuggestions;
    window.getAddHistoryFieldItems = getAddHistoryFieldItems;
    window.applyAddHistoryNote = applyAddHistoryNote;
    window.applyAddHistorySeller = applyAddHistorySeller;
    window.applyAddHistoryPrice = applyAddHistoryPrice;
    window.applyAddHistoryBundle = applyAddHistoryBundle;
    window.renderAddHistoryOpenButton = renderAddHistoryOpenButton;
    window.renderAddHistoryFieldButton = renderAddHistoryFieldButton;
    window.renderAddHistoryPopoverContent = renderAddHistoryPopoverContent;
    window.toggleAddHistoryPopover = toggleAddHistoryPopover;
    window.closeAddHistoryPopover = closeAddHistoryPopover;
    window.parsePriceValue = parsePriceValue;
    window.formatPriceInput = formatPriceInput;
    window.formatPriceVN = formatPriceVN;
    window.formatPriceField = formatPriceField;
}
