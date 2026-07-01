/* MyPlugin — UI Rendering */

// ===== APP STATE =====
window.appState = {
    currentPage: 'dashboard',
    plugins: [],
    searchQuery: '',
    currentView: 'grid', // 'grid' | 'list'
    isDemoMode: false,
    currentUser: null,
    filterCategory: null,
    filterLicense: null,
    filterGenre: null,
    filterResourceType: null,
    aiSettings: loadLocalAISettings(),
    pluginScanResults: [],
    pluginScanOptions: {
        defaultLicense: 'licensed',
        defaultCategory: 'auto',
        rootLabel: '',
    },
    pluginScanProgress: null,
};

// ===== NAVIGATION =====
function navigateTo(page) {
    window.appState.currentPage = page;

    // Update nav active state
    document.querySelectorAll('.d-nav-item').forEach(el => el.classList.remove('active'));
    const navId = `nav-${page}`;
    const navEl = document.getElementById(navId);
    if (navEl) navEl.classList.add('active');

    // Update page title
    const titles = {
        dashboard: 'Tổng quan', all: 'Tất cả Plugin',
        'cat-vst-instrument': 'VST Instrument', 'cat-vst-effect': 'VST Effect',
        'cat-library': 'Library / Samples', 'cat-mixing': 'Mixing / Mastering',
        'cat-standalone': 'Standalone', settings: 'Cài đặt',
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[page] || page;

    // Render page
    const content = document.getElementById('page-content');
    if (!content) return;
    content.scrollTop = 0;

    if (page === 'dashboard') renderDashboard();
    else if (page === 'all') renderPluginList('all');
    else if (page.startsWith('cat-')) renderPluginList(page);
    else if (page === 'settings') renderSettings();
}

// ===== SEARCH =====
function handleSearch(query) {
    window.appState.searchQuery = normalizeSearchText(query.trim());
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.style.display = query ? 'flex' : 'none';
    const page = window.appState.currentPage;
    if (page === 'all' || page.startsWith('cat-')) rerenderPage(page);
    else if (page === 'dashboard') renderDashboard();
}

function clearSearch() {
    const input = document.getElementById('search-input');
    if (input) { input.value = ''; handleSearch(''); }
}

// ===== FILTER PLUGINS =====
function getCategoryForPage(catPage) {
    const catMap = {
        'cat-vst-instrument': 'VST Instrument',
        'cat-vst-effect': 'VST Effect',
        'cat-library': 'Library / Samples',
        'cat-mixing': 'Mixing / Mastering',
        'cat-standalone': 'Standalone',
    };
    return catMap[catPage] || null;
}

function getFilteredPlugins(catPage) {
    let plugins = window.appState.plugins;

    // Category filter
    const pageCategory = getCategoryForPage(catPage);
    if (catPage && catPage !== 'all' && pageCategory) {
        plugins = plugins.filter(p => p.category === pageCategory);
    }

    // License filter
    if (window.appState.filterLicense) {
        plugins = plugins.filter(p => p.license === window.appState.filterLicense);
    }

    // Genre/resource filters
    if (window.appState.filterGenre) {
        plugins = plugins.filter(p => getPluginFacets(p).genres.some(g => sameFacetValue(g, window.appState.filterGenre)));
    }
    if (window.appState.filterResourceType) {
        plugins = plugins.filter(p => getPluginFacets(p).resourceTypes.some(t => sameFacetValue(t, window.appState.filterResourceType)));
    }

    // Search
    const q = window.appState.searchQuery;
    if (q) {
        plugins = plugins.filter(p => normalizeSearchText(getPluginSearchText(p)).includes(q));
    }
    return plugins;
}

function getFacetBasePlugins(catPage) {
    const pageCategory = getCategoryForPage(catPage);
    let plugins = window.appState.plugins;
    if (catPage && catPage !== 'all' && pageCategory) {
        plugins = plugins.filter(p => p.category === pageCategory);
    }
    if (window.appState.filterLicense) {
        plugins = plugins.filter(p => p.license === window.appState.filterLicense);
    }
    if (window.appState.searchQuery) {
        plugins = plugins.filter(p => normalizeSearchText(getPluginSearchText(p)).includes(window.appState.searchQuery));
    }
    return plugins;
}

function getAvailableFacetValues(catPage, facetName) {
    const options = facetName === 'genre' ? MP_GENRES : MP_RESOURCE_TYPES;
    const values = [];
    getFacetBasePlugins(catPage).forEach(plugin => {
        const facets = getPluginFacets(plugin);
        const facetValues = facetName === 'genre' ? facets.genres : facets.resourceTypes;
        facetValues.forEach(value => addUniqueFacet(values, value, options));
    });
    return sortFacetValues(values, options);
}

function renderFacetFilterPanel(catPage) {
    const genres = getAvailableFacetValues(catPage, 'genre');
    const resourceTypes = getAvailableFacetValues(catPage, 'resourceType');
    if (!genres.length && !resourceTypes.length) return '';

    return `
        <div class="mp-facet-panel">
            ${genres.length ? `
            <div class="mp-facet-row">
                <div class="mp-facet-label">Dòng nhạc</div>
                <div class="mp-facet-chips">${genres.map(value => renderFacetFilterChip('genre', value)).join('')}</div>
            </div>` : ''}
            ${resourceTypes.length ? `
            <div class="mp-facet-row">
                <div class="mp-facet-label">Loại tài nguyên</div>
                <div class="mp-facet-chips">${resourceTypes.map(value => renderFacetFilterChip('resourceType', value)).join('')}</div>
            </div>` : ''}
            ${(window.appState.filterGenre || window.appState.filterResourceType) ? `
                <button class="mp-filter-clear" onclick="clearFacetFilters()">Xoá lọc tab</button>
            ` : ''}
        </div>
    `;
}

function renderFacetFilterChip(kind, value) {
    const activeValue = kind === 'genre' ? window.appState.filterGenre : window.appState.filterResourceType;
    const prefix = kind === 'genre' ? '#' : '';
    return `
        <button class="mp-filter-chip mp-facet-filter-chip ${activeValue && sameFacetValue(activeValue, value) ? 'active' : ''}"
            data-facet-kind="${kind}" data-facet-value="${escapeAttr(value)}" onclick="toggleFacetFilterFromElement(this)">
            ${prefix}${escapeHTML(value)}
        </button>
    `;
}

function toggleFacetFilterFromElement(el) {
    toggleFacetFilter(el.dataset.facetKind, el.dataset.facetValue);
}

function toggleFacetFilter(kind, value) {
    const stateKey = kind === 'genre' ? 'filterGenre' : 'filterResourceType';
    window.appState[stateKey] = window.appState[stateKey] && sameFacetValue(window.appState[stateKey], value) ? null : value;

    const page = window.appState.currentPage;
    if (page === 'all' || page.startsWith('cat-')) {
        rerenderPage(page);
    } else {
        navigateTo(window.appState.lastPage && window.appState.lastPage.startsWith('cat-') ? window.appState.lastPage : 'all');
    }
}

function clearFacetFilters() {
    window.appState.filterGenre = null;
    window.appState.filterResourceType = null;
    rerenderPage(window.appState.currentPage);
}

function quickSearchFromElement(el) {
    const value = el.dataset.chipValue || '';
    const input = document.getElementById('search-input');
    if (input) input.value = value;
    window.appState.searchQuery = normalizeSearchText(value);
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.style.display = value ? 'flex' : 'none';

    const page = window.appState.currentPage;
    if (page === 'all' || page.startsWith('cat-')) {
        rerenderPage(page);
    } else {
        navigateTo('all');
    }
}

// ===== UPDATE NAV BADGES =====
function updateNavBadges() {
    const all = window.appState.plugins;
    const setBadge = (id, count) => {
        const el = document.getElementById(`nav-badge-${id}`);
        if (el) el.textContent = count || '';
    };
    setBadge('all', all.length);
    setBadge('vst-instrument', all.filter(p => p.category === 'VST Instrument').length);
    setBadge('vst-effect', all.filter(p => p.category === 'VST Effect').length);
    setBadge('library', all.filter(p => p.category === 'Library / Samples').length);
    setBadge('mixing', all.filter(p => p.category === 'Mixing / Mastering').length);
    setBadge('standalone', all.filter(p => p.category === 'Standalone').length);
}

// ===== THEME =====
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.dataset.theme === 'dark';
    html.dataset.theme = isDark ? 'light' : 'dark';
    localStorage.setItem('mp-theme', html.dataset.theme);
    document.getElementById('icon-theme-light').style.display = isDark ? 'block' : 'none';
    document.getElementById('icon-theme-dark').style.display = isDark ? 'none' : 'block';
}
// Load saved theme
(function() {
    const saved = localStorage.getItem('mp-theme');
    if (saved) {
        document.documentElement.dataset.theme = saved;
        if (saved === 'dark') {
            const l = document.getElementById('icon-theme-light');
            const d = document.getElementById('icon-theme-dark');
            if (l) l.style.display = 'none';
            if (d) d.style.display = 'block';
        }
    }
})();

// ===== DASHBOARD =====
function renderDashboard() {
    const plugins = window.appState.plugins;
    const content = document.getElementById('page-content');

    const total = plugins.length;
    const licensed = plugins.filter(p => p.license === 'licensed').length;
    const cracked = plugins.filter(p => p.license === 'cracked').length;
    const free = plugins.filter(p => p.license === 'free' || p.license === 'subscription').length;

    const cats = [
        { id: 'cat-vst-instrument', name: 'VST Instrument', cat: 'VST Instrument' },
        { id: 'cat-vst-effect', name: 'VST Effect', cat: 'VST Effect' },
        { id: 'cat-library', name: 'Library / Samples', cat: 'Library / Samples' },
        { id: 'cat-mixing', name: 'Mixing / Mastering', cat: 'Mixing / Mastering' },
        { id: 'cat-standalone', name: 'Standalone', cat: 'Standalone' },
    ];

    const recentPlugins = plugins.slice(0, 6);
    const searchQ = window.appState.searchQuery;

    content.innerHTML = `
        ${searchQ ? renderSearchResults(searchQ) : `
        <div class="mp-stats-row">
            <div class="mp-stat-card"><div class="mp-stat-icon total">${renderIcon('boxes', 'mp-icon-md')}</div><div class="mp-stat-info"><div class="mp-stat-number">${total}</div><div class="mp-stat-label">Tổng Plugin</div></div></div>
            <div class="mp-stat-card"><div class="mp-stat-icon licensed">${renderIcon('badgeCheck', 'mp-icon-md')}</div><div class="mp-stat-info"><div class="mp-stat-number">${licensed}</div><div class="mp-stat-label">Có bản quyền</div></div></div>
            <div class="mp-stat-card"><div class="mp-stat-icon cracked">${renderIcon('unlock', 'mp-icon-md')}</div><div class="mp-stat-info"><div class="mp-stat-number">${cracked}</div><div class="mp-stat-label">Crack</div></div></div>
            <div class="mp-stat-card"><div class="mp-stat-icon free">${renderIcon('gift', 'mp-icon-md')}</div><div class="mp-stat-info"><div class="mp-stat-number">${free}</div><div class="mp-stat-label">Miễn phí</div></div></div>
        </div>

        <div class="section-header" style="margin-bottom:14px">
            <span class="section-title">Phân loại</span>
        </div>
        <div class="mp-cat-grid" style="margin-bottom:28px">
            ${cats.map(c => {
                const count = plugins.filter(p => p.category === c.cat).length;
                return `<div class="mp-cat-card" onclick="navigateTo('${c.id}')">
                    <div class="mp-cat-card-icon">${renderCategoryIcon(c.cat, 'mp-icon-lg')}</div>
                    <div class="mp-cat-card-name">${c.name}</div>
                    <div class="mp-cat-card-count">${count} plugin</div>
                </div>`;
            }).join('')}
        </div>

        ${recentPlugins.length > 0 ? `
        <div class="section-header">
            <span class="section-title">Plugin gần đây</span>
            <button class="btn btn-sm btn-outline" onclick="navigateTo('all')">Xem tất cả</button>
        </div>
        <div class="mp-plugin-grid">
            ${recentPlugins.map(p => renderPluginCard(p)).join('')}
        </div>` : `
        <div class="mp-empty">
            <div class="mp-empty-icon">${renderIcon('audioWaveform', 'mp-icon-xl')}</div>
            <div class="mp-empty-title">Chưa có plugin nào</div>
            <div class="mp-empty-desc">Bắt đầu thêm plugin của bạn vào đây!</div>
            <div class="mp-empty-actions">
                <button class="btn btn-primary" style="width:auto;padding:12px 24px" onclick="openAddPluginModal()">${renderIcon('plus', 'mp-icon-sm')} Thêm plugin đầu tiên</button>
                <button class="btn btn-outline" style="width:auto;padding:12px 24px" onclick="openPluginScannerModal()">Quét plugin trong máy</button>
            </div>
        </div>`}
        `}
    `;
}

function renderSearchResults(q) {
    const results = getFilteredPlugins('all');
    if (!results.length) return `<div class="mp-empty"><div class="mp-empty-icon">${renderIcon('search', 'mp-icon-xl')}</div><div class="mp-empty-title">Không tìm thấy "${q}"</div><div class="mp-empty-desc">Thử từ khoá khác</div></div>`;
    return `
        <div class="section-header"><span class="section-title">Kết quả tìm kiếm "${q}"</span><span class="section-badge">${results.length} plugin</span></div>
        <div class="mp-plugin-grid">${results.map(p => renderPluginCard(p)).join('')}</div>
    `;
}

// ===== PLUGIN LIST PAGE =====
function renderPluginList(catPage) {
    const content = document.getElementById('page-content');
    const filtered = getFilteredPlugins(catPage);

    const licenseFilters = [
        { key: null, label: 'Tất cả', icon: null },
        { key: 'licensed', label: 'Licensed', icon: 'badgeCheck' },
        { key: 'cracked', label: 'Cracked', icon: 'unlock' },
        { key: 'free', label: 'Free', icon: 'gift' },
        { key: 'subscription', label: 'Sub', icon: 'refreshCw' },
    ];

    const isGrid = window.appState.currentView === 'grid';

    content.innerHTML = `
        <div class="mp-toolbar">
            <div class="mp-filter-bar">
                ${licenseFilters.map(f => `
                    <button class="mp-filter-chip ${window.appState.filterLicense === f.key ? 'active' : ''}"
                        onclick="setLicenseFilter(${f.key === null ? 'null' : `'${f.key}'`})">${f.icon ? renderIcon(f.icon, 'mp-icon-xs') : ''}${f.label}</button>
                `).join('')}
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <button class="btn btn-sm btn-outline" onclick="openPluginScannerModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/><path d="M8 13h8M12 9v8"/></svg>
                    Quét
                </button>
                <span style="font-size:13px;color:var(--text-tertiary)">${filtered.length} plugin</span>
                <div class="mp-view-toggle">
                    <button class="mp-view-btn ${isGrid ? 'active' : ''}" onclick="setView('grid')" title="Grid">
                        ${renderIcon('layoutGrid', 'mp-icon-sm')}
                    </button>
                    <button class="mp-view-btn ${!isGrid ? 'active' : ''}" onclick="setView('list')" title="List">
                        ${renderIcon('list', 'mp-icon-sm')}
                    </button>
                </div>
            </div>
        </div>
        ${renderFacetFilterPanel(catPage)}
        ${filtered.length === 0
            ? `<div class="mp-empty"><div class="mp-empty-icon">${catPage === 'all' ? renderIcon('audioWaveform', 'mp-icon-xl') : renderCategoryIcon(catPage, 'mp-icon-xl')}</div><div class="mp-empty-title">Chưa có plugin nào</div><div class="mp-empty-desc">Thêm plugin đầu tiên vào đây!</div><div class="mp-empty-actions"><button class="btn btn-primary" style="width:auto;padding:12px 24px" onclick="openAddPluginModal()">${renderIcon('plus', 'mp-icon-sm')} Thêm Plugin</button><button class="btn btn-outline" style="width:auto;padding:12px 24px" onclick="openPluginScannerModal()">Quét Plugin</button></div></div>`
            : isGrid
                ? `<div class="mp-plugin-grid">${filtered.map(p => renderPluginCard(p)).join('')}</div>`
                : `<div class="mp-plugin-list">${filtered.map(p => renderPluginListItem(p)).join('')}</div>`
        }
    `;
}

function setLicenseFilter(key) {
    window.appState.filterLicense = key === 'null' ? null : key;
    rerenderPage(window.appState.currentPage);
}

function setView(view) {
    window.appState.currentView = view;
    rerenderPage(window.appState.currentPage);
}

function renderPluginFacetChips(plugin, options = {}) {
    const limit = options.limit ?? Infinity;
    const facets = getPluginFacets(plugin);
    const extraTags = options.includeExtraTags ? getPluginExtraTags(plugin) : [];
    const chips = [];

    if (plugin.subCategory) {
        chips.push({
            label: plugin.subCategory,
            className: 'sub',
            attrs: `data-chip-value="${escapeAttr(plugin.subCategory)}" onclick="event.stopPropagation(); quickSearchFromElement(this)"`,
        });
    }

    facets.genres.forEach(value => chips.push({
        label: `#${value}`,
        className: 'genre',
        attrs: `data-facet-kind="genre" data-facet-value="${escapeAttr(value)}" onclick="event.stopPropagation(); toggleFacetFilterFromElement(this)"`,
    }));

    facets.resourceTypes.forEach(value => chips.push({
        label: value,
        className: 'resource',
        attrs: `data-facet-kind="resourceType" data-facet-value="${escapeAttr(value)}" onclick="event.stopPropagation(); toggleFacetFilterFromElement(this)"`,
    }));

    extraTags.forEach(value => chips.push({
        label: `#${value}`,
        className: 'extra',
        attrs: `data-chip-value="${escapeAttr(value)}" onclick="event.stopPropagation(); quickSearchFromElement(this)"`,
    }));

    if (!chips.length) return '';

    return chips.slice(0, limit).map(chip => `
        <button type="button" class="mp-tag mp-tag-clickable mp-tag-${chip.className}" ${chip.attrs}>${escapeHTML(chip.label)}</button>
    `).join('');
}

// ===== PLUGIN CARD (Grid) =====
function renderPluginCard(plugin) {
    const badge = getLicenseBadge(plugin.license);
    const categoryIcon = renderCategoryIcon(plugin.category, 'mp-icon-xl');
    const chipsHTML = renderPluginFacetChips(plugin, { limit: 6 });
    return `
        <div class="mp-plugin-card" onclick="openPluginDetail('${plugin.id}')">
            <div class="mp-plugin-card-cover">
                ${plugin.coverImage
                    ? `<img src="${escapeAttr(plugin.coverImage)}" alt="${escapeAttr(plugin.name)}" loading="lazy">`
                    : `<div class="mp-plugin-card-cover-fallback">${categoryIcon}</div>`
                }
                <span class="mp-license-badge ${plugin.license}">${renderIcon(badge.icon, 'mp-icon-xs')}${badge.label}</span>
            </div>
            <div class="mp-plugin-card-body">
                <div class="mp-plugin-card-name" title="${plugin.name}">${plugin.name}</div>
                <div class="mp-plugin-card-dev">${plugin.developer || '–'}</div>
                <div class="mp-plugin-card-meta">
                    <span class="mp-plugin-cat-badge">${plugin.category || '–'}</span>
                </div>
                ${chipsHTML ? `<div class="mp-plugin-card-chips">${chipsHTML}</div>` : ''}
            </div>
        </div>
    `;
}

// ===== PLUGIN LIST ITEM =====
function renderPluginListItem(plugin) {
    const badge = getLicenseBadge(plugin.license);
    const categoryIcon = renderCategoryIcon(plugin.category, 'mp-icon-md');
    const chipsHTML = renderPluginFacetChips(plugin, { limit: 8 });
    return `
        <div class="mp-plugin-list-item" onclick="openPluginDetail('${plugin.id}')">
            <div class="mp-plugin-list-avatar">
                ${plugin.coverImage ? `<img src="${escapeAttr(plugin.coverImage)}" alt="">` : categoryIcon}
            </div>
            <div class="mp-plugin-list-info">
                <div class="mp-plugin-list-name">${plugin.name}</div>
                <div class="mp-plugin-list-sub">${plugin.developer || '–'} · ${plugin.category || '–'}</div>
                ${chipsHTML ? `<div class="mp-plugin-list-chips">${chipsHTML}</div>` : ''}
            </div>
            <div class="mp-plugin-list-right">
                <span class="mp-badge mp-badge-license-${plugin.license}">${renderIcon(badge.icon, 'mp-icon-xs')}${badge.label}</span>
            </div>
        </div>
    `;
}

// ===== PLUGIN DETAIL =====
async function openPluginDetail(pluginId) {
    const plugin = window.appState.plugins.find(p => p.id === pluginId);
    if (!plugin) return;

    const presets = await loadPresets(pluginId);
    const content = document.getElementById('page-content');
    const badge = getLicenseBadge(plugin.license);
    const categoryIcon = renderCategoryIcon(plugin.category, 'mp-icon-xl');
    const dawList = plugin.daw?.join(', ') || '–';
    const isLicenseKeySet = plugin.licenseKeyDisplay || plugin.encryptedLicenseKey;
    const detailChipsHTML = renderPluginFacetChips(plugin, { includeExtraTags: true });

    content.innerHTML = `
        <button class="back-btn" onclick="navigateTo('${window.appState.currentPage === 'detail' ? 'all' : window.appState.lastPage || 'all'}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Quay lại
        </button>
        <div class="mp-detail-layout">
            <!-- LEFT SIDEBAR -->
            <div class="mp-detail-sidebar">
                <!-- Cover + Info -->
                <div class="mp-detail-card">
                    <div class="mp-detail-cover">
                        ${plugin.coverImage ? `<img src="${escapeAttr(plugin.coverImage)}" alt="${escapeAttr(plugin.name)}">` : categoryIcon}
                    </div>
                    <div class="mp-detail-name">${plugin.name}</div>
                    <div class="mp-detail-dev">by ${plugin.developer || '–'}${plugin.version ? ' · v' + plugin.version : ''}</div>
                    <div class="mp-detail-badges">
                        <span class="mp-badge mp-badge-license-${plugin.license}">${renderIcon(badge.icon, 'mp-icon-xs')}${badge.label}</span>
                        <span class="mp-badge mp-badge-cat">${renderCategoryIcon(plugin.category, 'mp-icon-xs')}${plugin.category}</span>
                    </div>
                    ${detailChipsHTML ? `<div class="mp-detail-tags">${detailChipsHTML}</div>` : ''}
                </div>

                <!-- Plugin Info -->
                <div class="mp-detail-card">
                    <div class="mp-section-title">${renderIcon('info', 'mp-icon-sm')} Thông tin</div>
                    <div class="mp-detail-row"><span class="mp-detail-label">DAW</span><span class="mp-detail-value">${dawList}</span></div>
                    <div class="mp-detail-row"><span class="mp-detail-label">Đã cài đặt</span><span class="mp-detail-value"><span class="mp-value-status ${plugin.installed ? 'success' : 'error'}">${renderIcon(plugin.installed ? 'circleCheck' : 'circleX', 'mp-icon-xs')}${plugin.installed ? 'Có' : 'Chưa'}</span></span></div>
                    ${plugin.installedPath ? `<div class="mp-detail-row"><span class="mp-detail-label">Đường dẫn</span><span class="mp-detail-value" style="font-family:monospace;font-size:11px;word-break:break-all">${plugin.installedPath}</span></div>` : ''}
                </div>

                <!-- License Key -->
                ${isLicenseKeySet ? `
                <div class="mp-detail-card">
                    <div class="mp-section-title">${renderIcon('keyRound', 'mp-icon-sm')} License Key</div>
                    <div class="mp-license-key-wrap">
                        <div class="mp-license-key-value masked" id="license-key-val">••••••••••••••••••••</div>
                    </div>
                    <div style="display:flex;gap:8px;margin-top:10px">
                        <button class="btn btn-sm btn-outline" onclick="toggleLicenseKey('${pluginId}')">${renderIcon('eye', 'mp-icon-sm')} Hiện</button>
                        <button class="btn btn-sm btn-ghost" onclick="copyLicenseKey('${pluginId}')">${renderIcon('copy', 'mp-icon-sm')} Copy</button>
                    </div>
                </div>` : ''}

                <!-- Quick Links -->
                <div class="mp-detail-card">
                    <div class="mp-section-title">${renderIcon('globe', 'mp-icon-sm')} Tìm kiếm nhanh</div>
                    <div class="mp-quick-links">
                        <a class="mp-quick-link" href="https://www.google.com/search?q=${encodeURIComponent(plugin.name + ' ' + (plugin.developer||'') + ' plugin tutorial')}" target="_blank">
                            ${renderIcon('search', 'mp-icon-sm')} Google
                        </a>
                        <a class="mp-quick-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(plugin.name + ' tutorial')}" target="_blank">
                            ${renderIcon('youtube', 'mp-icon-sm')} YouTube
                        </a>
                        <a class="mp-quick-link" href="https://www.kvraudio.com/search.php?q=${encodeURIComponent(plugin.name)}" target="_blank">
                            ${renderIcon('audioWaveform', 'mp-icon-sm')} KVR
                        </a>
                        <a class="mp-quick-link" href="https://www.reddit.com/search/?q=${encodeURIComponent(plugin.name)}" target="_blank">
                            ${renderIcon('messageCircle', 'mp-icon-sm')} Reddit
                        </a>
                    </div>
                </div>

                <!-- Actions -->
                <div style="display:flex;gap:8px">
                    <button class="btn btn-sm btn-outline" onclick="openEditPluginModal('${pluginId}')" style="flex:1">${renderIcon('pencil', 'mp-icon-sm')} Sửa</button>
                    <button class="btn btn-sm btn-danger" onclick="confirmDeletePlugin('${pluginId}')" style="flex:1">${renderIcon('trash2', 'mp-icon-sm')} Xoá</button>
                </div>
            </div>

            <!-- RIGHT MAIN -->
            <div class="mp-detail-main">
                <!-- AI Summary -->
                <div class="mp-detail-card">
                    <div class="mp-ai-header">
                        <div class="mp-ai-label">${renderIcon('bot', 'mp-icon-sm')} AI Tóm tắt Plugin</div>
                        <button class="btn btn-sm btn-outline" onclick="generateAISummary('${pluginId}')">${renderIcon('sparkles', 'mp-icon-sm')} ${plugin.aiSummary ? 'Làm mới' : 'Tạo AI tóm tắt'}</button>
                    </div>
                    <div class="mp-ai-block">
                        ${plugin.aiSummary
                            ? `<div class="mp-ai-content" id="ai-content-${pluginId}">${renderMarkdown(plugin.aiSummary)}</div>`
                            : `<div class="mp-ai-empty">Chưa có tóm tắt. Nhấn "Tạo AI tóm tắt" để AI phân tích plugin này.</div>`
                        }
                    </div>
                </div>

                <!-- Notes -->
                <div class="mp-detail-card">
                    <div class="section-header" style="margin-bottom:12px">
                        <div class="mp-section-title" style="margin:0">${renderIcon('notebookPen', 'mp-icon-sm')} Ghi chú cá nhân</div>
                        <button class="btn btn-sm btn-ghost" onclick="openEditNotesModal('${pluginId}')">${renderIcon('pencil', 'mp-icon-sm')} Sửa</button>
                    </div>
                    ${plugin.notes
                        ? `<div class="mp-notes-view">${renderMarkdown(plugin.notes)}</div>`
                        : `<div class="mp-ai-empty">Chưa có ghi chú. Nhấn Sửa để thêm.</div>`
                    }
                </div>

                <!-- Presets & Screenshots -->
                <div class="mp-detail-card">
                    <div class="section-header" style="margin-bottom:12px">
                        <div class="mp-section-title" style="margin:0">${renderIcon('images', 'mp-icon-sm')} Preset & Screenshots</div>
                        <button class="btn btn-sm btn-outline" onclick="openAddPresetModal('${pluginId}')">${renderIcon('plus', 'mp-icon-sm')} Thêm</button>
                    </div>
                    ${presets.length > 0 ? `
                    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
                        ${presets.map(preset => `
                        <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;border:1.5px solid var(--border)">
                            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${preset.name}</div>
                            ${preset.description ? `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">${preset.description}</div>` : ''}
                            ${preset.notes ? `<div style="font-size:13px;line-height:1.7">${renderMarkdown(preset.notes)}</div>` : ''}
                        </div>`).join('')}
                    </div>` : ''}
                    ${(plugin.images || []).length > 0 ? `
                    <div class="mp-images-grid">
                        ${(plugin.images || []).map(url => `
                        <div class="mp-image-thumb">
                            <img src="${url}" alt="Screenshot" loading="lazy">
                        </div>`).join('')}
                    </div>` : `<div class="mp-ai-empty">Chưa có ảnh hay preset. Nhấn "+ Thêm" để bắt đầu.</div>`}
                </div>
            </div>
        </div>
    `;

    window.appState.lastPage = window.appState.currentPage;
    window.appState.currentPage = 'detail';
    window.appState.currentDetailPluginId = pluginId;

    // Update nav - deactivate all
    document.querySelectorAll('.d-nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('page-title').textContent = plugin.name;
}

// ===== SETTINGS =====
function renderSettings() {
    const content = document.getElementById('page-content');
    const settings = getCurrentAISettings();
    const geminiModels = getGeminiModelOptions();

    content.innerHTML = `
        <div class="mp-settings-grid">
            <div class="mp-settings-card">
                <div class="mp-settings-card-title">${renderIcon('bot', 'mp-icon-sm')} Cài đặt AI</div>
                <div class="mp-form-group">
                    <label class="mp-form-label">AI Provider</label>
                    <select class="mp-form-select" id="settings-ai-provider">
                        <option value="gemini" ${settings.aiProvider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
                        <option value="openai" ${settings.aiProvider === 'openai' ? 'selected' : ''}>OpenAI (ChatGPT)</option>
                    </select>
                </div>
                <div class="mp-form-group">
                    <label class="mp-form-label">Gemini Model</label>
                    <select class="mp-form-select" id="settings-gemini-model">
                        ${geminiModels.map(model => `<option value="${model}" ${settings.geminiModel === model ? 'selected' : ''}>${model}</option>`).join('')}
                    </select>
                </div>
                <div class="mp-form-group">
                    <label class="mp-form-label">API Key</label>
                    <input type="password" class="mp-form-input" id="settings-api-key" placeholder="Gemini API key hoặc OpenAI key" value="${settings.apiKeyPlain || ''}">
                    <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px">Có thể nhập nhiều Gemini key, phân cách bằng dấu phẩy hoặc khoảng trắng. Key chỉ lưu cục bộ trong trình duyệt này.</div>
                </div>
                <div style="display:flex;gap:8px;margin-top:8px">
                    <button class="btn btn-primary btn-sm" onclick="saveAISettings()" style="flex:1">${renderIcon('save', 'mp-icon-sm')} Lưu</button>
                    <button class="btn btn-ghost btn-sm" onclick="testAISettings()">${renderIcon('flaskConical', 'mp-icon-sm')} Test</button>
                </div>
            </div>

            <div class="mp-settings-card">
                <div class="mp-settings-card-title">${renderIcon('palette', 'mp-icon-sm')} Giao diện</div>
                <div class="mp-settings-row">
                    <div><div class="mp-settings-label">Chế độ tối</div><div class="mp-settings-desc">Giao diện dark mode</div></div>
                    <div class="mp-settings-control">
                        <input type="checkbox" class="mp-toggle" id="settings-dark-mode" ${document.documentElement.dataset.theme === 'dark' ? 'checked' : ''} onchange="toggleTheme()">
                    </div>
                </div>
                <div class="mp-settings-row">
                    <div><div class="mp-settings-label">Hiển thị mặc định</div><div class="mp-settings-desc">Grid hoặc List</div></div>
                    <div class="mp-settings-control">
                        <select class="mp-form-select" style="min-width:100px" onchange="setView(this.value)">
                            <option value="grid" ${window.appState.currentView === 'grid' ? 'selected' : ''}>Grid</option>
                            <option value="list" ${window.appState.currentView === 'list' ? 'selected' : ''}>List</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="mp-settings-card">
                <div class="mp-settings-card-title">${renderIcon('info', 'mp-icon-sm')} Về MyPlugin</div>
                <div style="font-size:14px;color:var(--text-secondary);line-height:1.7">
                    <p>MyPlugin v1.0</p>
                    <p style="margin-top:8px">Quản lý plugin âm nhạc thông minh.<br>Tích hợp với Ting! – dùng chung Firebase.</p>
                    <p style="margin-top:8px;font-size:12px;color:var(--text-tertiary)">Firebase project: ting-d2c78</p>
                </div>
            </div>
        </div>
    `;
}

async function saveAISettings() {
    const provider = document.getElementById('settings-ai-provider')?.value || 'gemini';
    const key = document.getElementById('settings-api-key')?.value.trim();
    const geminiModel = document.getElementById('settings-gemini-model')?.value || 'gemini-2.5-flash';
    if (!key) { showToast('Vui lòng nhập API Key', 'warning'); return; }
    window.appState.aiSettings = saveLocalAISettings({ aiProvider: provider, apiKeyPlain: key, geminiModel });
    if (!window.appState.isDemoMode) await saveMyPluginSettings({ aiProvider: provider, geminiModel });
    showToast('Đã lưu cài đặt AI', 'success');
}

async function testAISettings() {
    const settings = getCurrentAISettings({
        aiProvider: document.getElementById('settings-ai-provider')?.value || 'gemini',
        apiKeyPlain: document.getElementById('settings-api-key')?.value || window.appState.aiSettings?.apiKeyPlain,
        geminiModel: document.getElementById('settings-gemini-model')?.value || window.appState.aiSettings?.geminiModel,
    });
    const key = settings.apiKeyPlain;
    if (!key) { showToast('Vui lòng nhập API Key trước', 'warning'); return; }
    showToast('Đang test kết nối AI...', 'info');
    try {
        const provider = settings.aiProvider || 'gemini';
        let ok = false;
        let detail = '';
        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
            ok = res.ok;
            if (!ok) detail = `HTTP ${res.status}`;
        } else {
            const result = await callGeminiAPI('Reply exactly: OK', {
                apiKeys: key,
                modelOverride: settings.geminiModel,
                maxRetries: 1,
                temperature: 0,
            });
            ok = Boolean(result.text);
            detail = `${result.model} ${result.version}`;
        }
        showToast(ok ? `Kết nối AI thành công! ${detail}` : 'API Key không hợp lệ', ok ? 'success' : 'error');
    } catch (e) {
        showToast('Lỗi kết nối: ' + e.message, 'error');
    }
}
