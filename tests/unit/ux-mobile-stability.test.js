const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('PC/mobile UX stability contracts', () => {
  it('keeps search input and actions in separate non-overlapping layout tracks', () => {
    const desktop = read('index.html');
    const mobile = read('mobile/index.html');
    expect(desktop).toContain('class="d-search-actions"');
    expect(desktop).toContain('onkeydown="handleSearchKeydown(event)"');
    expect(mobile).toContain('class="search-actions"');
    expect(mobile).toContain('aria-label="Xóa nội dung tìm kiếm"');
    expect(read('css/desktop.css')).toContain('grid-template-columns:minmax(0, 1fr) auto');
    expect(read('mobile/css/components.css')).toContain('@media (max-width:380px)');
  });

  it('debounces search and supports immediate clear/Enter rendering', () => {
    for (const file of ['js/desktop-app.js', 'mobile/js/app.js']) {
      const source = read(file);
      expect(source).toContain('setTimeout(render, 120)');
      expect(source).toContain('function handleSearchKeydown(event)');
      expect(source).toContain("handleSearch('', { immediate: true })");
      const start = source.indexOf('function handleSearch(');
      const end = source.indexOf('function handleSearchKeydown', start);
      expect(source.slice(start, end)).not.toContain('expandedGroups = {}');
    }
  });

  it('updates list result shells quietly instead of replacing toolbar and focus', () => {
    expect(read('js/desktop-ui.js')).toContain('data-account-results');
    expect(read('mobile/js/ui.js')).toContain('data-account-results');
    expect(read('css/components.css')).toContain('.search-results-quiet .anim-fade-in-up');
    expect(read('mobile/css/components.css')).toContain('.search-results-quiet .anim-stagger > *');
  });

  it('keeps mobile Group Detail/Design quiet renders signature-stable', () => {
    const ui = read('mobile/js/ui.js');
    expect(ui).toContain('function renderGroupDetail(groupId, options = {})');
    expect(ui).toContain('function renderGroupDesign(groupId, options = {})');
    expect(ui).toContain('_lastMobileGroupDetailSignature');
    expect(ui).toContain('_lastMobileGroupDesignSignature');
    expect(ui).toContain("bodyHtml.replace('@@DESIGN@@'");
    expect(read('js/groups.js')).toContain("renderGroupDesign(window.appState.currentGroupId || groupId, { quiet: true })");
  });

  it('uses Pointer Events for constrained tab swipes', () => {
    const source = read('mobile/js/smooth-ux.js');
    expect(source).toContain('SWIPE_MIN_X = 64');
    expect(source).toContain('SWIPE_MAX_OFF = 0.45');
    expect(source).toContain('SWIPE_MAX_MS = 600');
    expect(source).toContain("addEventListener('pointerdown'");
    expect(source).toContain("addEventListener('pointerup'");
    expect(source).not.toContain("addEventListener('touchstart'");
    expect(source).toContain('[data-drag-handle]');
    expect(source).toContain('suppressClickUntil');
  });

  it('does not wrap tabs and passes direction to the tab transition', () => {
    const source = read('mobile/js/smooth-ux.js');
    expect(source).toContain('if (nextIdx < 0 || nextIdx >= ctx.order.length) return;');
    expect(source).toContain('direction: dx < 0 ? \'left\' : \'right\'');
    expect(read('mobile/js/ui.js')).toContain('tab-slide-from-right');
    expect(read('mobile/js/ui.js')).toContain('scrollIntoView');
  });

  it('suppresses nested card animations when a page transition starts', () => {
    for (const file of ['js/smooth-ux.js', 'mobile/js/smooth-ux.js']) {
      const source = read(file);
      const suppressAt = source.indexOf('suppressNestedPageAnimations(pc)');
      const frameAt = source.indexOf('requestAnimationFrame(function () {', suppressAt);
      expect(suppressAt).toBeGreaterThan(-1);
      expect(source).toContain("querySelectorAll('.anim-fade-in-up, .anim-stagger')");
      expect(frameAt).toBeGreaterThan(suppressAt);
    }
  });

  it('guards mobile drag with threshold, pointer capture, rAF, placeholder and save lock', () => {
    const source = read('mobile/js/app.js');
    expect(source).toContain('Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 8');
    expect(source).toContain('handle.setPointerCapture(event.pointerId)');
    expect(source).toContain('requestAnimationFrame(() => processGroupDesignDragFrame(state))');
    expect(source).toContain('group-design-placeholder');
    expect(source).toContain('getGroupDesignAutoScrollSpeed');
    expect(source).toContain('window.appState.groupDesignSaving = true');
    expect(source).toContain('updateSharedAccountGroupMetaBatch(groupId, changed.map');
    expect(source).toContain('accountId: id');
  });

  it('marks group/settings tabs with the ARIA tab contract and keyboard handler', () => {
    for (const file of ['js/desktop-ui.js', 'mobile/js/ui.js']) {
      const source = read(file);
      expect(source).toContain('role="tablist"');
      expect(source).toContain('onkeydown="handleAccessibleTabKeydown(event)"');
      expect(source).toContain('role="tab"');
      expect(source).toContain('aria-selected=');
      expect(source).toContain('aria-controls=');
      expect(source).toContain('role="tabpanel"');
    }
    expect(read('js/utils.js')).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
  });

  it('disables all motion channels when reduced-motion is active', () => {
    for (const file of ['js/smooth-ux.js', 'mobile/js/smooth-ux.js']) {
      const source = read(file);
      expect(source).toContain('matchMedia');
      expect(source).toContain('addEventListener(\'change\'');
      expect(source).toContain('document.documentElement.classList.toggle(\'reduced-motion\'');
      expect(source).toContain('prefersReduced || !canVibrate');
    }
    for (const file of ['css/animations.css', 'mobile/css/animations.css']) {
      expect(read(file)).toContain('animation:none !important');
      expect(read(file)).toContain('scroll-behavior:auto !important');
    }
  });

  it('does not permanently write ripple layout styles or rescan the whole page', () => {
    for (const file of ['js/smooth-ux.js', 'mobile/js/smooth-ux.js']) {
      const source = read(file);
      expect(source).toContain('ripple-host');
      expect(source).not.toContain('target.style.position');
      expect(source).not.toContain('target.style.overflow');
      expect(source).toContain('record.addedNodes');
      expect(source).toContain('.ripple, .toast-progress, .page-enter');
    }
  });

  it('keeps mobile touch targets and removes broad transition:all declarations', () => {
    const css = read('mobile/css/components.css');
    expect(css).toContain('.copy-btn {\n    width:44px; height:44px');
    expect(css).toContain('.group-design-drag-handle {\n    width:44px;\n    height:44px');
    expect(css).toContain('min-height:44px');
    expect(`${read('css/components.css')}\n${read('css/desktop.css')}\n${css}`).not.toMatch(/transition:\s*all/);
  });

  it('consumes dialog keys and serializes Android back navigation', () => {
    for (const file of ['js/dialogs.js', 'mobile/js/dialogs.js']) {
      const source = read(file);
      expect(source).toContain('event.stopImmediatePropagation()');
      expect(source).toContain('if (active.options.dismissible) finish(false)');
    }
    const mobileApp = read('mobile/js/app.js');
    expect(mobileApp).toContain('if (window.appState.backNavigationInFlight) return true');
    expect(mobileApp).toContain('.finally(() => {');
    expect(mobileApp).toContain('window.appState.backNavigationInFlight = false');
  });
});
