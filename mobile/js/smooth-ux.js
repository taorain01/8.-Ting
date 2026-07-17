/* Ting! — Smooth UX Layer
   Nâng độ mượt cho cả PC & mobile mà không thêm dependency:
   - Reveal-on-scroll (IntersectionObserver) cho card/section
   - Hiệu ứng chuyển trang mượt khi navigateTo
   - Ripple cho nút bấm
   - Haptics nhẹ (navigator.vibrate) trên thiết bị cảm ứng
   - Header/topbar co lại + đổ bóng khi cuộn
   - content-visibility tự bật khi danh sách dài (giảm khựng)
   Hoạt động cho cả 2 app (desktop & mobile) vì cùng render vào #page-content. */
(function () {
    'use strict';
    if (window.__tingSmoothUX) return;
    window.__tingSmoothUX = true;

    var reducedMotionQuery = null;
    var prefersReduced = false;
    try {
        reducedMotionQuery = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
        prefersReduced = Boolean(reducedMotionQuery?.matches);
    } catch (e) { prefersReduced = false; }

    var supportsIO = typeof window.IntersectionObserver === 'function';
    var canVibrate = 'vibrate' in navigator;
    var isTouch = false;
    try {
        isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    } catch (e) { isTouch = false; }

    // Selector các phần tử được "hé lộ" khi cuộn tới
    var REVEAL_SELECTOR = [
        '.summary-card', '.d-summary-card',
        '.account-group', '.detail-section',
        '.quick-filter-result-head', '.d-alert-banner'
    ].join(',');

    // Ngưỡng số card để bật content-visibility (virtualization-lite)
    var CV_THRESHOLD = 40;
    var CV_KEEP_FIRST = 12;

    // ---------- Reveal on scroll ----------
    var revealObserver = null;
    function createRevealObserver() {
        if (!supportsIO || prefersReduced) return null;
        return new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                var en = entries[i];
                if (en.isIntersecting) {
                    en.target.classList.add('in-view');
                    revealObserver?.unobserve?.(en.target);
                }
            }
        }, { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    }
    revealObserver = createRevealObserver();
    function updateReducedMotion(next) {
        var changed = prefersReduced !== Boolean(next);
        prefersReduced = Boolean(next);
        document.documentElement.classList.toggle('reduced-motion', prefersReduced);
        if (prefersReduced) {
            revealObserver?.disconnect?.();
            revealObserver = null;
        } else if (!revealObserver) {
            revealObserver = createRevealObserver();
        }
        if (changed && prefersReduced) {
            document.querySelectorAll('.reveal-init').forEach(function (el) { el.classList.add('in-view'); });
        }
    }
    if (reducedMotionQuery?.addEventListener) reducedMotionQuery.addEventListener('change', function (event) { updateReducedMotion(event.matches); });
    else if (reducedMotionQuery?.addListener) reducedMotionQuery.addListener(function (event) { updateReducedMotion(event.matches); });
    updateReducedMotion(prefersReduced);

    function markReveal(el, instant) {
        if (!el || el.__revealBound) return;
        el.__revealBound = true;
        if (instant || prefersReduced || !revealObserver) {
            el.classList.add('in-view');
            return;
        }
        el.classList.add('reveal-init');
        // Nếu đã nằm sẵn trong khung nhìn lúc render → IO sẽ hiện ngay
        revealObserver.observe(el);
    }

    function scanReveal(container, instant) {
        var scope = container || document.getElementById('page-content');
        if (!scope) return;
        var nodes = scope.querySelectorAll(REVEAL_SELECTOR);
        var cards = scope.querySelectorAll('.account-card, .d-account-card');
        var useCV = cards.length > CV_THRESHOLD;
        for (var i = 0; i < nodes.length; i++) markReveal(nodes[i], instant);
        if (useCV) {
            for (var j = CV_KEEP_FIRST; j < cards.length; j++) {
                cards[j].classList.add('cv-auto');
            }
        }
    }

    function scanRevealNodes(nodes, instant) {
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (node.nodeType !== 1 || node.matches('.ripple, .toast-progress, .page-enter')) continue;
            var quiet = Boolean(node.closest?.('.search-results-quiet, .group-detail-quiet') || node.matches('.search-results-quiet, .group-detail-quiet'));
            if (node.matches(REVEAL_SELECTOR)) markReveal(node, instant || quiet);
            node.querySelectorAll?.(REVEAL_SELECTOR).forEach(function (el) { markReveal(el, instant || quiet); });
        }
    }

    // Theo dõi #page-content để quét lại sau mỗi lần render.
    // Nếu render dồn dập (vd gõ tìm kiếm) → hiện ngay, không animate để tránh chớp.
    var rescanQueued = false;
    var lastScanAt = 0;
    var BURST_MS = 500;
    var pendingRevealNodes = [];
    function queueRescan(nodes) {
        if (nodes?.length) pendingRevealNodes.push.apply(pendingRevealNodes, nodes);
        if (rescanQueued) return;
        rescanQueued = true;
        requestAnimationFrame(function () {
            rescanQueued = false;
            var now = Date.now();
            var instant = (now - lastScanAt) < BURST_MS;
            lastScanAt = now;
            var nodes = pendingRevealNodes.splice(0);
            if (nodes.length) scanRevealNodes(nodes, instant);
        });
    }

    function observePageContent() {
        var pc = document.getElementById('page-content');
        if (!pc) return;
        try {
            var mo = new MutationObserver(function (records) {
                var added = [];
                records.forEach(function (record) {
                    record.addedNodes.forEach(function (node) {
                        if (node.nodeType === 1 && !node.matches('.ripple, .toast-progress, .page-enter')) added.push(node);
                    });
                });
                if (added.length) queueRescan(added);
            });
            mo.observe(pc, { childList: true, subtree: true });
        } catch (e) { /* ignore */ }
        lastScanAt = Date.now();
        scanReveal(pc, false);
    }

    // ---------- Hiệu ứng chuyển trang ----------
    var pageEnterTimer = null;
    function playPageEnter() {
        if (prefersReduced) return;
        var pc = document.getElementById('page-content');
        if (!pc) return;
        pc.classList.remove('page-enter');
        clearTimeout(pageEnterTimer);
        requestAnimationFrame(function () {
            pc.classList.add('page-enter');
            pageEnterTimer = setTimeout(function () { pc.classList.remove('page-enter'); }, 220);
        });
    }

    function wrapNavigation() {
        if (typeof window.navigateTo === 'function' && !window.navigateTo.__tingWrapped) {
            var orig = window.navigateTo;
            var wrapped = function () {
                var r = orig.apply(this, arguments);
                // Điều hướng là hành động chủ đích → luôn cho phép animate reveal
                lastScanAt = 0;
                playPageEnter();
                return r;
            };
            wrapped.__tingWrapped = true;
            try { window.navigateTo = wrapped; } catch (e) { /* ignore */ }
        }
    }

    // ---------- Ripple cho nút ----------
    var RIPPLE_SELECTOR = '.btn, .copy-btn, .renew-btn, .icon-btn, .fab, .filter-tab, .d-platform-chip, .quick-platform-chip';
    function spawnRipple(e) {
        if (prefersReduced) return;
        var target = e.target && e.target.closest ? e.target.closest(RIPPLE_SELECTOR) : null;
        if (!target) return;
        // Đảm bảo có thể chứa ripple tuyệt đối
        var cs = window.getComputedStyle(target);
        var needsHost = cs.position === 'static' || cs.overflow === 'visible';
        var rect = target.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height);
        var span = document.createElement('span');
        span.className = 'ripple';
        span.style.width = span.style.height = size + 'px';
        var cx = (e.clientX != null ? e.clientX : rect.left + rect.width / 2) - rect.left - size / 2;
        var cy = (e.clientY != null ? e.clientY : rect.top + rect.height / 2) - rect.top - size / 2;
        span.style.left = cx + 'px';
        span.style.top = cy + 'px';
        if (needsHost) target.classList.add('ripple-host');
        target.appendChild(span);
        setTimeout(function () {
            if (span.parentNode) span.parentNode.removeChild(span);
            if (needsHost && !target.querySelector('.ripple')) target.classList.remove('ripple-host');
        }, 620);
    }

    // ---------- Haptics nhẹ ----------
    var HAPTIC_SELECTOR = '.copy-btn, .fab, .nav-item, .d-nav-item, .renew-btn';
    function tinyHaptic(e) {
        if (prefersReduced || !canVibrate || !isTouch) return;
        var t = e.target && e.target.closest ? e.target.closest(HAPTIC_SELECTOR) : null;
        if (!t) return;
        try { navigator.vibrate(9); } catch (err) { /* ignore */ }
    }

    // ---------- Header co lại khi cuộn ----------
    function bindScrollShrink() {
        var content = document.querySelector('.d-content') || document.getElementById('page-content');
        var header = document.querySelector('.d-topbar') || document.querySelector('.app-header');
        if (!header) return;
        var ticking = false;
        function onScroll(scrollTop) {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                header.classList.toggle('is-scrolled', scrollTop > 6);
                ticking = false;
            });
        }
        // Desktop: cuộn trong .d-content; Mobile: cuộn window
        if (content && content.classList.contains('d-content')) {
            content.addEventListener('scroll', function () { onScroll(content.scrollTop); }, { passive: true });
        } else {
            window.addEventListener('scroll', function () {
                onScroll(window.scrollY || window.pageYOffset || 0);
            }, { passive: true });
        }
    }

    // ---------- Vuốt ngang để chuyển tab (màn Nhóm & Cài đặt) ----------
    var SWIPE_MIN_X = 64;
    var SWIPE_MAX_OFF = 0.45;
    var SWIPE_MAX_MS = 600;
    var GROUP_TAB_ORDER = ['board', 'accounts', 'members', 'settings'];
    var SWIPE_IGNORE = [
        'button', 'a', 'input', 'textarea', 'select', '[role="button"]',
        '[data-drag-handle]', '[data-no-swipe]', '.settings-tabbar', '.group-tabs',
        '.horizontal-scroll', '[data-horizontal-scroll]'
    ].join(',');

    function isHorizontalScrollTarget(target) {
        var node = target;
        while (node && node.id !== 'page-content') {
            if (node.scrollWidth > node.clientWidth + 4) {
                var overflowX = window.getComputedStyle(node).overflowX;
                if (overflowX === 'auto' || overflowX === 'scroll') return true;
            }
            node = node.parentElement;
        }
        return false;
    }

    function getSwipeContext(target) {
        var pc = document.getElementById('page-content');
        if (!pc) return null;
        var surface = target?.closest?.('.group-tab-panel, .settings-panel.active');
        if (!surface || !pc.contains(surface)) return null;
        if (pc.querySelector('.group-tabs') && surface.classList.contains('group-tab-panel')) {
            var gCurrent = (window.appState && window.appState.currentGroupTab) || 'board';
            return {
                order: GROUP_TAB_ORDER.slice(),
                current: gCurrent,
                apply: function (next, options) {
                    if (typeof window.setGroupDetailTab === 'function') window.setGroupDetailTab(next, options);
                }
            };
        }
        var tabbar = pc.querySelector('.settings-tabbar');
        if (tabbar && surface.classList.contains('settings-panel')) {
            var order = Array.prototype.map.call(
                tabbar.querySelectorAll('.settings-tab'),
                function (btn) { return btn.dataset.tab; }
            ).filter(Boolean);
            if (!order.length) return null;
            var sCurrent = window._settingsActiveTab && order.indexOf(window._settingsActiveTab) >= 0
                ? window._settingsActiveTab
                : order[0];
            return {
                order: order,
                current: sCurrent,
                apply: function (next, options) {
                    if (typeof window.switchSettingsTab === 'function') window.switchSettingsTab(next, options);
                }
            };
        }
        return null;
    }

    function setupSwipeTabs() {
        if (!isTouch || !window.PointerEvent) return;
        var pc = document.getElementById('page-content');
        if (!pc) return;
        var gesture = null;
        var suppressClickUntil = 0;

        function resetGesture(event) {
            if (gesture && pc.hasPointerCapture?.(gesture.pointerId)) {
                try { pc.releasePointerCapture(gesture.pointerId); } catch (_) { /* noop */ }
            }
            gesture = null;
        }

        pc.addEventListener('pointerdown', function (event) {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            if (window.appState?.groupDesignDrag || window.appState?.groupDesignSaving) return;
            if (event.target?.closest?.(SWIPE_IGNORE) || isHorizontalScrollTarget(event.target)) return;
            var context = getSwipeContext(event.target);
            if (!context) return;
            gesture = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startAt: Date.now(),
                context: context
            };
            try { pc.setPointerCapture(event.pointerId); } catch (_) { /* noop */ }
        });

        pc.addEventListener('pointercancel', resetGesture);
        pc.addEventListener('lostpointercapture', function (event) {
            if (gesture?.pointerId === event.pointerId) gesture = null;
        });
        pc.addEventListener('pointerup', function (event) {
            if (!gesture || gesture.pointerId !== event.pointerId) return;
            var current = gesture;
            resetGesture(event);
            var dx = event.clientX - current.startX;
            var dy = event.clientY - current.startY;
            if (Date.now() - current.startAt > SWIPE_MAX_MS) return;
            if (Math.abs(dx) < SWIPE_MIN_X) return;
            if (Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_OFF) return;
            if (window.appState?.groupDesignDrag || window.appState?.groupDesignSaving) return;
            var ctx = getSwipeContext(event.target) || current.context;
            if (!ctx) return;
            var idx = ctx.order.indexOf(ctx.current);
            if (idx < 0) idx = 0;
            var nextIdx = dx < 0 ? idx + 1 : idx - 1;
            if (nextIdx < 0 || nextIdx >= ctx.order.length) return;
            suppressClickUntil = Date.now() + 360;
            if (!prefersReduced && canVibrate) { try { navigator.vibrate(9); } catch (err) { /* ignore */ } }
            ctx.apply(ctx.order[nextIdx], {
                direction: dx < 0 ? 'left' : 'right',
                fromSwipe: true
            });
        });

        pc.addEventListener('click', function (event) {
            if (Date.now() >= suppressClickUntil) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
    }

    // ---------- Khởi động ----------
    function init() {
        observePageContent();
        wrapNavigation();
        bindScrollShrink();
        setupSwipeTabs();
        document.addEventListener('click', function (e) {
            spawnRipple(e);
            tinyHaptic(e);
        }, true);
        // navigateTo có thể được gán sau khi script này chạy → thử lại vài lần
        var tries = 0;
        var t = setInterval(function () {
            wrapNavigation();
            if ((window.navigateTo && window.navigateTo.__tingWrapped) || ++tries > 20) {
                clearInterval(t);
            }
        }, 200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
