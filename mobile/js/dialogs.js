(function (root) {
    'use strict';
    const queue = [];
    let active = null;
    let previousOverflow = '';
    const recentToasts = new Map();
    const ICONS = { info: 'i', success: '✓', warning: '!', danger: '!' };

    function normalizeDialogOptions(options = {}) {
        const variant = ['info', 'success', 'warning', 'danger'].includes(options.variant) ? options.variant : 'info';
        return {
            variant,
            title: String(options.title || (variant === 'danger' ? 'Xác nhận thao tác' : 'Thông báo')),
            message: String(options.message || ''),
            details: String(options.details || ''),
            icon: String(options.icon || ICONS[variant]),
            confirmLabel: String(options.confirmLabel || (variant === 'danger' ? 'Xác nhận' : 'Đồng ý')),
            cancelLabel: String(options.cancelLabel || 'Hủy bỏ'),
            showCancel: options.showCancel !== false,
            dismissible: options.dismissible !== false,
            confirmationText: String(options.confirmationText || ''),
            confirmationLabel: String(options.confirmationLabel || ''),
            input: options.input ? { type: options.input.type === 'password' ? 'password' : 'text', label: String(options.input.label || ''), placeholder: String(options.input.placeholder || ''), value: String(options.input.value || ''), autocomplete: String(options.input.autocomplete || 'off'), maxLength: Number(options.input.maxLength || 0) } : null,
            validate: typeof options.validate === 'function' ? options.validate : null,
        };
    }

    function ensureShell() {
        if (typeof document === 'undefined') return null;
        let overlay = document.getElementById('ting-dialog-overlay');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'ting-dialog-overlay';
        overlay.className = 'ting-dialog-overlay';
        overlay.hidden = true;
        overlay.innerHTML = `<div class="ting-dialog" role="dialog" aria-modal="true" aria-labelledby="ting-dialog-title" aria-describedby="ting-dialog-message"><button type="button" class="ting-dialog-close" aria-label="Đóng">×</button><div class="ting-dialog-icon" aria-hidden="true"></div><div class="ting-dialog-content"><h2 id="ting-dialog-title" class="ting-dialog-title"></h2><p id="ting-dialog-message" class="ting-dialog-message"></p><div class="ting-dialog-details" hidden></div><label class="ting-dialog-field" hidden><span class="ting-dialog-field-label"></span><span class="ting-dialog-input-wrap"><input class="ting-dialog-input" /><button type="button" class="ting-dialog-password-toggle" hidden>Hiện</button></span></label><p class="ting-dialog-error" role="alert" hidden></p></div><div class="ting-dialog-actions"><button type="button" class="btn btn-outline ting-dialog-cancel"></button><button type="button" class="btn ting-dialog-confirm"></button></div></div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('mousedown', event => { overlay._downTarget = event.target; });
        overlay.addEventListener('click', event => { if (event.target === overlay && overlay._downTarget === overlay && active?.options.dismissible) finish(false); });
        overlay.querySelector('.ting-dialog-close').addEventListener('click', () => finish(false));
        overlay.querySelector('.ting-dialog-cancel').addEventListener('click', () => finish(false));
        overlay.querySelector('.ting-dialog-confirm').addEventListener('click', submit);
        overlay.querySelector('.ting-dialog-input').addEventListener('input', updateValidity);
        overlay.querySelector('.ting-dialog-password-toggle').addEventListener('click', togglePassword);
        return overlay;
    }

    function focusable(dialog) { return [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(el => !el.hidden && el.offsetParent !== null); }
    function shouldSubmitOnEnterTarget(target) {
        return Boolean(target?.matches?.('.ting-dialog-input, .ting-dialog-confirm'));
    }
    function onKeydown(event) {
        if (!active) return;
        const dialog = ensureShell().querySelector('.ting-dialog');
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (active.options.dismissible) finish(false);
            return;
        }
        if (event.key === 'Enter') {
            event.stopImmediatePropagation();
            const target = event.target;
            if (shouldSubmitOnEnterTarget(target)) {
                const button = dialog.querySelector('.ting-dialog-confirm');
                if (!button.disabled) { event.preventDefault(); submit(); }
            }
            return;
        }
        if (event.key !== 'Tab') return;
        const items = focusable(dialog); if (!items.length) return;
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    }

    function render() {
        const overlay = ensureShell();
        const { options } = active;
        const dialog = overlay.querySelector('.ting-dialog');
        const input = overlay.querySelector('.ting-dialog-input');
        dialog.className = `ting-dialog ting-dialog-${options.variant}`;
        overlay.querySelector('.ting-dialog-icon').textContent = options.icon;
        overlay.querySelector('.ting-dialog-title').textContent = options.title;
        overlay.querySelector('.ting-dialog-message').textContent = options.message;
        const details = overlay.querySelector('.ting-dialog-details'); details.textContent = options.details; details.hidden = !options.details;
        const error = overlay.querySelector('.ting-dialog-error'); error.hidden = true; error.textContent = '';
        const needsInput = Boolean(options.input || options.confirmationText);
        const field = overlay.querySelector('.ting-dialog-field'); field.hidden = !needsInput;
        if (needsInput) {
            const data = options.input || { type: 'text', label: '', placeholder: '', value: '', autocomplete: 'off', maxLength: 0 };
            input.type = data.type; input.value = data.value; input.placeholder = options.confirmationText || data.placeholder; input.autocomplete = data.autocomplete; input.maxLength = data.maxLength > 0 ? data.maxLength : 524288;
            overlay.querySelector('.ting-dialog-field-label').textContent = options.confirmationLabel || data.label || `Nhập ${options.confirmationText} để tiếp tục`;
            const toggle = overlay.querySelector('.ting-dialog-password-toggle'); toggle.hidden = data.type !== 'password'; toggle.textContent = 'Hiện';
        }
        const cancel = overlay.querySelector('.ting-dialog-cancel'); cancel.textContent = options.cancelLabel; cancel.hidden = !options.showCancel;
        overlay.querySelector('.ting-dialog-close').hidden = !options.dismissible;
        const confirm = overlay.querySelector('.ting-dialog-confirm'); confirm.textContent = options.confirmLabel; confirm.className = `btn ting-dialog-confirm ${options.variant === 'danger' ? 'btn-danger' : 'btn-primary'}`;
        overlay.hidden = false; requestAnimationFrame(() => overlay.classList.add('open'));
        previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; document.addEventListener('keydown', onKeydown);
        updateValidity(); setTimeout(() => (needsInput ? input : confirm).focus(), 0);
    }

    function updateValidity() { if (!active) return; const overlay = ensureShell(); const value = overlay.querySelector('.ting-dialog-input').value.trim(); overlay.querySelector('.ting-dialog-confirm').disabled = Boolean(active.options.confirmationText) && value.toLocaleUpperCase('vi-VN') !== active.options.confirmationText.toLocaleUpperCase('vi-VN'); }
    function submit() { const overlay = ensureShell(); const input = overlay.querySelector('.ting-dialog-input'); const error = overlay.querySelector('.ting-dialog-error'); if (active.options.validate) { const result = active.options.validate(input.value); if (result !== true) { error.textContent = typeof result === 'string' ? result : 'Giá trị chưa hợp lệ'; error.hidden = false; input.focus(); return; } } finish(true, input.value); }
    function togglePassword() { const overlay = ensureShell(); const input = overlay.querySelector('.ting-dialog-input'); const button = overlay.querySelector('.ting-dialog-password-toggle'); input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? 'Hiện' : 'Ẩn'; input.focus(); }
    function finish(confirmed, value = '') { if (!active) return; const overlay = ensureShell(); const current = active; active = null; document.removeEventListener('keydown', onKeydown); overlay.classList.remove('open'); document.body.style.overflow = previousOverflow; setTimeout(() => { if (!active) overlay.hidden = true; }, 180); current.resolve({ confirmed, value: confirmed ? value : null }); current.previousFocus?.focus?.(); next(); }
    function next() { if (active || !queue.length) return; active = queue.shift(); render(); }
    function isOpen() { return Boolean(active); }
    function handleBack() {
        if (!active) return false;
        if (active.options.dismissible) finish(false);
        return true;
    }
    function showAppDialog(options) { if (typeof document === 'undefined') return Promise.resolve({ confirmed: false, value: null }); return new Promise(resolve => { queue.push({ options: normalizeDialogOptions(options), resolve, previousFocus: document.activeElement }); next(); }); }
    async function confirmAction(options) { return (await showAppDialog({ ...options, showCancel: true })).confirmed; }
    async function promptAction(options) { const result = await showAppDialog({ ...options, showCancel: true, input: options?.input || { type: 'text' } }); return result.confirmed ? result.value : null; }

    function showTingToast(message, type = 'success', options = {}) {
        if (typeof document === 'undefined') return null;
        const variant = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
        const text = String(message || ''); const key = `${variant}::${text}`; const now = Date.now();
        for (const [itemKey, time] of recentToasts) if (now - time > 2000) recentToasts.delete(itemKey);
        if (recentToasts.has(key)) return null; recentToasts.set(key, now);
        const container = document.getElementById('toast-container'); if (!container) return null; container.setAttribute('aria-live', 'polite');
        const duration = Math.max(1200, Number(options.duration || (variant === 'error' ? 4500 : 3200)));
        const toast = document.createElement('div'); toast.className = `toast toast-${variant}`; toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
        const icon = document.createElement('span'); icon.className = 'toast-icon'; icon.textContent = variant === 'success' ? '✓' : variant === 'error' ? '×' : variant === 'warning' ? '!' : 'i';
        const body = document.createElement('span'); body.className = 'toast-message'; body.textContent = text;
        const close = document.createElement('button'); close.type = 'button'; close.className = 'toast-close'; close.setAttribute('aria-label', 'Đóng thông báo'); close.textContent = '×';
        const progress = document.createElement('span'); progress.className = 'toast-progress'; progress.style.setProperty('--toast-duration', `${duration}ms`);
        toast.append(icon, body, close, progress); container.appendChild(toast);
        let timer; let started = Date.now(); let remaining = duration;
        const remove = () => { clearTimeout(timer); toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); };
        const start = () => { started = Date.now(); timer = setTimeout(remove, remaining); progress.style.animationPlayState = 'running'; };
        const pause = () => { clearTimeout(timer); remaining = Math.max(0, remaining - (Date.now() - started)); progress.style.animationPlayState = 'paused'; };
        close.addEventListener('click', remove); toast.addEventListener('mouseenter', pause); toast.addEventListener('mouseleave', start); start(); return toast;
    }

    const api = { normalizeDialogOptions, showAppDialog, confirmAction, promptAction, showTingToast, isOpen, handleBack, shouldSubmitOnEnterTarget };
    Object.assign(root, api); root.TingFeedback = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
