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

    var prefersReduced = false;
    try {
        prefersReduced = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { prefersReduced = false; }

    var supportsIO = typeof window.IntersectionObserver === 'function';
    var canVibrate = 'vibrate' in navigator;
    var isTouch = false;
    try {
        isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    } catch (e) { isTouch = false; }

    // Selector các phần tử được "hé lộ" khi cuộn tới
    var REVEAL_SELECTOR = [
        '.account-card', '.d-account-card',
        '.summary-card', '.d-summary-card',
        '.account-group', '.detail-section',
        '.quick-filter-result-head', '.d-alert-banner'
    ].join(',');

    // Ngưỡng số card để bật content-visibility (virtualization-lite)
    var CV_THRESHOLD = 40;
    var CV_KEEP_FIRST = 12;

    // ---------- Reveal on scroll ----------
    var revealObserver = null;
    if (supportsIO && !prefersReduced) {
        revealObserver = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                var en = entries[i];
                if (en.isIntersecting) {
                    en.target.classList.add('in-view');
                    revealObserver.unobserve(en.target);
                }
            }
        }, { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    }

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

    // Theo dõi #page-content để quét lại sau mỗi lần render.
    // Nếu render dồn dập (vd gõ tìm kiếm) → hiện ngay, không animate để tránh chớp.
    var rescanQueued = false;
    var lastScanAt = 0;
    var BURST_MS = 500;
    function queueRescan() {
        if (rescanQueued) return;
        rescanQueued = true;
        requestAnimationFrame(function () {
            rescanQueued = false;
            var now = Date.now();
            var instant = (now - lastScanAt) < BURST_MS;
            lastScanAt = now;
            scanReveal(null, instant);
        });
    }

    function observePageContent() {
        var pc = document.getElementById('page-content');
        if (!pc) return;
        try {
            var mo = new MutationObserver(function () { queueRescan(); });
            mo.observe(pc, { childList: true, subtree: true });
        } catch (e) { /* ignore */ }
        lastScanAt = Date.now();
        scanReveal(pc, false);
    }

    // ---------- Hiệu ứng chuyển trang ----------
    function playPageEnter() {
        if (prefersReduced) return;
        var pc = document.getElementById('page-content');
        if (!pc) return;
        pc.classList.remove('page-enter');
        // reflow để restart animation
        void pc.offsetWidth;
        pc.classList.add('page-enter');
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
        if (cs.position === 'static') target.style.position = 'relative';
        if (cs.overflow === 'visible') target.style.overflow = 'hidden';
        var rect = target.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height);
        var span = document.createElement('span');
        span.className = 'ripple';
        span.style.width = span.style.height = size + 'px';
        var cx = (e.clientX != null ? e.clientX : rect.left + rect.width / 2) - rect.left - size / 2;
        var cy = (e.clientY != null ? e.clientY : rect.top + rect.height / 2) - rect.top - size / 2;
        span.style.left = cx + 'px';
        span.style.top = cy + 'px';
        target.appendChild(span);
        setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 620);
    }

    // ---------- Haptics nhẹ ----------
    var HAPTIC_SELECTOR = '.copy-btn, .fab, .nav-item, .d-nav-item, .renew-btn';
    function tinyHaptic(e) {
        if (!canVibrate || !isTouch) return;
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

    // ---------- Khởi động ----------
    function init() {
        observePageContent();
        wrapNavigation();
        bindScrollShrink();
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
