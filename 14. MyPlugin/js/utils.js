/* MyPlugin — Utilities */

// ===== ICON SYSTEM =====
const MP_ICONS = {
    audioWaveform: '<path d="M2 13a2 2 0 0 0 4 0V7a2 2 0 0 1 4 0v10a2 2 0 0 0 4 0V5a2 2 0 0 1 4 0v14a2 2 0 0 0 4 0v-6"/>',
    boxes: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
    badgeCheck: '<path d="M3.85 8.62a4 4 0 0 1 4.77-4.77 4 4 0 0 1 6.76 0 4 4 0 0 1 4.77 4.77 4 4 0 0 1 0 6.76 4 4 0 0 1-4.77 4.77 4 4 0 0 1-6.76 0 4 4 0 0 1-4.77-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
    unlock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8A2.5 2.5 0 0 1 10 5.5C10 7 12 8 12 8s2-1 2-2.5A2.5 2.5 0 0 1 16.5 8"/>',
    refreshCw: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    piano: '<path d="M18 4v16"/><path d="M6 4v16"/><path d="M2 4h20"/><path d="M2 20h20"/><path d="M10 4v8"/><path d="M14 4v8"/>',
    slidersHorizontal: '<line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/>',
    folderArchive: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M10 12v-1"/><path d="M10 18v-2"/><path d="M10 15h.01"/>',
    slidersVertical: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="2" y1="14" x2="6" y2="14"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="18" y1="16" x2="22" y2="16"/>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    keyRound: '<path d="M2 18a6 6 0 1 0 11.31-2.79L22 6.5V2h-4.5l-8.71 8.69A6 6 0 0 0 2 18Z"/><path d="m15 7 2 2"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    pencil: '<path d="M21.17 6.83a2.83 2.83 0 0 0-4-4L4 16v4h4Z"/><path d="m15 5 4 4"/>',
    trash2: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M9 13v2"/><path d="M15 13v2"/>',
    notebookPen: '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.4 6.6a2.1 2.1 0 1 0-3-3L12 10v3h3Z"/>',
    images: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20"/><path d="M12 2a15.3 15.3 0 0 0 0 20"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    circleCheck: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    circleX: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    triangleAlert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    flaskConical: '<path d="M10 2v7.3L4.2 19.7A1.5 1.5 0 0 0 5.5 22h13a1.5 1.5 0 0 0 1.3-2.3L14 9.3V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 5.9 2 10.8 2 14.4 4.8 17 8.2 17H10a2 2 0 0 1 2 2 2 2 0 0 0 2 2c4.4 0 8-4 8-9 0-5.5-4.5-10-10-10Z"/>',
    youtube: '<path d="M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17Z"/><path d="m10 15 5-3-5-3Z"/>',
    messageCircle: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    layoutGrid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
};

const MP_CATEGORY_ICONS = {
    'VST Instrument': { icon: 'piano', className: 'category-instrument' },
    'VST Effect': { icon: 'slidersHorizontal', className: 'category-effect' },
    'Library / Samples': { icon: 'folderArchive', className: 'category-library' },
    'Mixing / Mastering': { icon: 'slidersVertical', className: 'category-mixing' },
    'Standalone': { icon: 'monitor', className: 'category-standalone' },
    'cat-vst-instrument': { icon: 'piano', className: 'category-instrument' },
    'cat-vst-effect': { icon: 'slidersHorizontal', className: 'category-effect' },
    'cat-library': { icon: 'folderArchive', className: 'category-library' },
    'cat-mixing': { icon: 'slidersVertical', className: 'category-mixing' },
    'cat-standalone': { icon: 'monitor', className: 'category-standalone' },
};

function renderIcon(name, className = '') {
    const icon = MP_ICONS[name] || MP_ICONS.info;
    const classes = ['mp-icon', className].filter(Boolean).join(' ');
    return `<svg class="${classes}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icon}</svg>`;
}

function renderCategoryIcon(category, className = '') {
    const meta = MP_CATEGORY_ICONS[category] || { icon: 'audioWaveform', className: 'category-default' };
    return renderIcon(meta.icon, ['mp-category-icon', meta.className, className].filter(Boolean).join(' '));
}

// ===== AI / GEMINI HELPERS =====
const MP_AI_SETTINGS_STORAGE_KEY = 'mp-ai-settings-v1';
const MP_DEFAULT_AI_SETTINGS = {
    aiProvider: 'gemini',
    geminiModel: 'gemini-2.5-flash',
    apiKeyPlain: '',
};
const MP_GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
];
const MP_GEMINI_API_VERSIONS = ['v1beta', 'v1'];

function loadLocalAISettings() {
    try {
        const raw = localStorage.getItem(MP_AI_SETTINGS_STORAGE_KEY);
        return { ...MP_DEFAULT_AI_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
    } catch {
        return { ...MP_DEFAULT_AI_SETTINGS };
    }
}

function saveLocalAISettings(settings = {}) {
    const merged = { ...loadLocalAISettings(), ...settings };
    try {
        localStorage.setItem(MP_AI_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
    } catch {}
    return merged;
}

function getCurrentAISettings(overrides = {}) {
    return {
        ...MP_DEFAULT_AI_SETTINGS,
        ...loadLocalAISettings(),
        ...((typeof window !== 'undefined' && window.appState?.aiSettings) || {}),
        ...overrides,
    };
}

function parseAIKeyList(value) {
    return String(value || '')
        .split(/[\s,;]+/g)
        .map(key => key.trim())
        .filter(Boolean)
        .filter((key, index, list) => list.indexOf(key) === index);
}

function getGeminiModelOptions() {
    return [...MP_GEMINI_MODELS];
}

function getGeminiModelFallbacks(modelOverride) {
    const chosen = String(modelOverride || '').trim();
    const models = chosen ? [chosen] : MP_GEMINI_MODELS;
    return [...models, ...MP_GEMINI_MODELS].filter((model, index, list) => model && list.indexOf(model) === index);
}

function extractGeminiText(json) {
    const candidate = json?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const text = parts.map(part => part?.text || '').join('').trim();
    if (text) return text;

    const reason = candidate?.finishReason;
    const blockReason = json?.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`Gemini chặn prompt: ${blockReason}`);
    if (reason) throw new Error(`Gemini không trả text. Finish reason: ${reason}`);
    throw new Error('Gemini không trả candidates/text');
}

function getGeminiErrorMessage(json, status) {
    const message = json?.error?.message || json?.error || '';
    if (message) return `HTTP ${status}: ${message}`;
    return `HTTP ${status}`;
}

async function callGeminiAPI(prompt, options = {}) {
    const apiKeys = parseAIKeyList(options.apiKeys || options.apiKey);
    if (!apiKeys.length) throw new Error('Chưa có Gemini API Key');

    const models = getGeminiModelFallbacks(options.modelOverride);
    const versions = options.apiVersions || MP_GEMINI_API_VERSIONS;
    const maxRetries = Math.max(1, Number(options.maxRetries || 2));
    const lastErrors = [];
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: options.temperature ?? 1.2,
        },
    };

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
        options.onProgress?.(`Lần thử ${attempt + 1}/${maxRetries}`);

        for (const model of models) {
            for (const version of versions) {
                for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex += 1) {
                    const key = apiKeys[keyIndex];
                    const url = `https://generativelanguage.googleapis.com/${version}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
                    options.onProgress?.(`Gemini ${model} (${version}) key ${keyIndex + 1}/${apiKeys.length}`);

                    try {
                        const res = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                            },
                            body: JSON.stringify(payload),
                        });
                        const text = await res.text();
                        let json = {};
                        try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

                        if (!res.ok || json.error) {
                            const err = getGeminiErrorMessage(json, res.status);
                            lastErrors.push(`${model}/${version}/key${keyIndex + 1}: ${err}`);
                            continue;
                        }

                        return {
                            text: extractGeminiText(json),
                            model,
                            version,
                            raw: json,
                        };
                    } catch (error) {
                        lastErrors.push(`${model}/${version}/key${keyIndex + 1}: ${error.message}`);
                    }
                }
            }
        }
    }

    throw new Error(`Gemini lỗi sau khi thử fallback. ${lastErrors.slice(-4).join(' | ') || 'Không rõ lỗi'}`);
}

// ===== TOAST =====
function showToast(message, type = 'info', duration = 3000) {
    const icons = { success: 'circleCheck', error: 'circleX', warning: 'triangleAlert', info: 'info' };
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${renderIcon(icons[type] || 'info', 'mp-icon-sm')}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; toast.style.transition = 'all 0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ===== GENRE / RESOURCE FACETS =====
const MP_GENRES = [
    'EDM', 'Trance', 'House', 'Techno', 'Pop', 'Hip Hop', 'Trap', 'R&B',
    'Rock', 'Cinematic', 'Orchestral', 'Lo-fi', 'Ambient', 'Dubstep',
    'Future Bass', 'Drum & Bass',
];

const MP_RESOURCE_TYPES = ['Plugin', 'Preset', 'VST', 'Nhạc cụ ảo', 'Library/Sample', 'Standalone'];

const MP_FACET_ALIASES = {
    hiphop: 'Hip Hop',
    rb: 'R&B',
    rnb: 'R&B',
    lofi: 'Lo-fi',
    dnb: 'Drum & Bass',
    drumbass: 'Drum & Bass',
    drumandbass: 'Drum & Bass',
    plugin: 'Plugin',
    plugins: 'Plugin',
    preset: 'Preset',
    presets: 'Preset',
    vst: 'VST',
    vst2: 'VST',
    vst3: 'VST',
    vsti: 'VST',
    dll: 'VST',
    instrument: 'Nhạc cụ ảo',
    instruments: 'Nhạc cụ ảo',
    virtualinstrument: 'Nhạc cụ ảo',
    virtualinstruments: 'Nhạc cụ ảo',
    nhaccuao: 'Nhạc cụ ảo',
    synth: 'Nhạc cụ ảo',
    synthesizer: 'Nhạc cụ ảo',
    rompler: 'Nhạc cụ ảo',
    library: 'Library/Sample',
    libraries: 'Library/Sample',
    sample: 'Library/Sample',
    samples: 'Library/Sample',
    standalone: 'Standalone',
};

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
    return escapeHTML(value);
}

function normalizeSearchText(value) {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd');
}

function facetKey(value) {
    return normalizeSearchText(value)
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '');
}

function normalizeArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
    return String(value).split(',').map(v => v.trim()).filter(Boolean);
}

function sameFacetValue(a, b) {
    return facetKey(a) === facetKey(b);
}

function getCanonicalFacet(value, options) {
    const key = facetKey(value);
    if (!key) return null;
    const alias = MP_FACET_ALIASES[key];
    if (alias && options.some(option => sameFacetValue(option, alias))) return alias;
    return options.find(option => sameFacetValue(option, value)) || null;
}

function addUniqueFacet(list, value, options) {
    if (!value) return;
    const canonical = getCanonicalFacet(value, options) || String(value).trim();
    if (!canonical) return;
    if (!list.some(item => sameFacetValue(item, canonical))) list.push(canonical);
}

function sortFacetValues(values, options) {
    return [...values].sort((a, b) => {
        const ia = options.findIndex(option => sameFacetValue(option, a));
        const ib = options.findIndex(option => sameFacetValue(option, b));
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        return a.localeCompare(b, 'vi');
    });
}

function getPluginFacets(plugin = {}) {
    const tags = normalizeArray(plugin.tags);
    const genres = [];
    const resourceTypes = [];
    const category = plugin.category || '';
    const subCategory = plugin.subCategory || '';
    const installedPath = plugin.installedPath || '';

    normalizeArray(plugin.genres).forEach(value => addUniqueFacet(genres, value, MP_GENRES));
    normalizeArray(plugin.resourceTypes).forEach(value => addUniqueFacet(resourceTypes, value, MP_RESOURCE_TYPES));

    tags.forEach(tag => {
        const genre = getCanonicalFacet(tag, MP_GENRES);
        const resourceType = getCanonicalFacet(tag, MP_RESOURCE_TYPES);
        if (genre) addUniqueFacet(genres, genre, MP_GENRES);
        if (resourceType) addUniqueFacet(resourceTypes, resourceType, MP_RESOURCE_TYPES);
    });

    const catKey = facetKey(category);
    if (catKey.includes('vstinstrument')) {
        addUniqueFacet(resourceTypes, 'Plugin', MP_RESOURCE_TYPES);
        addUniqueFacet(resourceTypes, 'VST', MP_RESOURCE_TYPES);
        addUniqueFacet(resourceTypes, 'Nhạc cụ ảo', MP_RESOURCE_TYPES);
    } else if (catKey.includes('vsteffect') || catKey.includes('mixing') || catKey.includes('mastering')) {
        addUniqueFacet(resourceTypes, 'Plugin', MP_RESOURCE_TYPES);
        addUniqueFacet(resourceTypes, 'VST', MP_RESOURCE_TYPES);
    } else if (catKey.includes('library') || catKey.includes('sample')) {
        addUniqueFacet(resourceTypes, 'Library/Sample', MP_RESOURCE_TYPES);
    } else if (catKey.includes('standalone')) {
        addUniqueFacet(resourceTypes, 'Standalone', MP_RESOURCE_TYPES);
    }

    const subResource = getCanonicalFacet(subCategory, MP_RESOURCE_TYPES);
    if (subResource) addUniqueFacet(resourceTypes, subResource, MP_RESOURCE_TYPES);

    if (/\.(vst3?|dll)$/i.test(installedPath)) addUniqueFacet(resourceTypes, 'VST', MP_RESOURCE_TYPES);
    if (!resourceTypes.length && category) addUniqueFacet(resourceTypes, 'Plugin', MP_RESOURCE_TYPES);

    return {
        genres: sortFacetValues(genres, MP_GENRES),
        resourceTypes: sortFacetValues(resourceTypes, MP_RESOURCE_TYPES),
    };
}

function getPluginSearchText(plugin = {}) {
    const facets = getPluginFacets(plugin);
    return [
        plugin.name,
        plugin.developer,
        plugin.category,
        plugin.subCategory,
        ...normalizeArray(plugin.tags),
        ...facets.genres,
        ...facets.resourceTypes,
    ].filter(Boolean).join(' ');
}

function getPluginExtraTags(plugin = {}) {
    return normalizeArray(plugin.tags).filter(tag =>
        !getCanonicalFacet(tag, MP_GENRES) &&
        !getCanonicalFacet(tag, MP_RESOURCE_TYPES)
    );
}

// ===== GENERATE PLUGIN ICON =====
function getPluginEmoji(category) {
    return renderCategoryIcon(category);
}

// ===== RENDER STARS =====
function renderStars(rating, max = 5) {
    let html = '';
    for (let i = 1; i <= max; i++) {
        html += `<span class="mp-star">${i <= rating ? '&#9733;' : '&#9734;'}</span>`;
    }
    return html;
}

// ===== LICENSE BADGE =====
function getLicenseBadge(license) {
    const map = {
        licensed: { label: 'Licensed', class: 'licensed', icon: 'badgeCheck' },
        cracked: { label: 'Cracked', class: 'cracked', icon: 'unlock' },
        free: { label: 'Free', class: 'free', icon: 'gift' },
        subscription: { label: 'Subscription', class: 'subscription', icon: 'refreshCw' },
    };
    return map[license] || { label: license, class: 'free', icon: 'info' };
}

// ===== FORMAT MARKDOWN-LIKE TEXT =====
function renderMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.getElementById('search-input');
        if (input) input.focus();
    }
    if (e.key === 'Escape') {
        closeModal();
    }
});

// ===== DEMO DATA =====
const DEMO_PLUGINS = [
    {
        id: 'demo-serum',
        name: 'Serum',
        developer: 'Xfer Records',
        version: '1.36b',
        category: 'VST Instrument',
        subCategory: 'Wavetable Synth',
        license: 'licensed',
        daw: ['FL Studio', 'Ableton', 'Logic Pro'],
        rating: 5,
        tags: ['synth', 'edm', 'bass', 'lead', 'wavetable'],
        installed: true,
        installedPath: 'C:/VST3/Serum.vst3',
        notes: 'Plugin synth tốt nhất hiện tại. **Dùng macro** để map nhiều parameter cùng lúc.',
        aiSummary: '**Serum** là wavetable synthesizer hàng đầu, cực kỳ linh hoạt.\n\n**Parameters chính:**\n- **Wavetable** – Chọn dạng sóng cơ bản\n- **Filter Cutoff** – Tần số cắt bộ lọc\n- **Attack / Decay / Sustain / Release** – Bao thanh âm\n- **LFO Rate** – Tốc độ dao động\n- **Macro 1-4** – Điều khiển nhiều param cùng lúc\n\n**Dùng tốt cho:** Bass EDM, Lead, Pad, Pluck\n**Tip:** Dùng Macro để biểu diễn live',
        coverImage: null,
        images: [],
        createdAt: new Date(),
    },
    {
        id: 'demo-fabfilter',
        name: 'FabFilter Pro-Q 3',
        developer: 'FabFilter',
        version: '3.22',
        category: 'VST Effect',
        subCategory: 'EQ',
        license: 'cracked',
        daw: ['FL Studio', 'Ableton', 'Logic Pro', 'Cubase'],
        rating: 5,
        tags: ['eq', 'mixing', 'mastering', 'dynamic'],
        installed: true,
        installedPath: 'C:/VST3/FabFilter Pro-Q 3.vst3',
        notes: 'EQ tốt nhất hiện tại. Dynamic EQ rất mạnh.',
        aiSummary: '**FabFilter Pro-Q 3** là EQ plugin chuyên nghiệp cao cấp.\n\n**Parameters chính:**\n- **Frequency** – Tần số band EQ\n- **Gain** – Tăng/giảm dB\n- **Q Factor** – Độ rộng của band\n- **Dynamic EQ** – EQ tự động theo signal\n- **Linear Phase** – Mode không làm lệch pha\n\n**Dùng tốt cho:** Mixing, Mastering, Surgical EQ\n**Tip:** Dùng Spectrum Grab để EQ trực tiếp trên spectrum',
        coverImage: null,
        images: [],
        createdAt: new Date(),
    },
    {
        id: 'demo-nexus',
        name: 'Nexus 4',
        developer: 'ReFX',
        version: '4.5.4',
        category: 'Library / Samples',
        subCategory: 'ROMpler',
        license: 'cracked',
        daw: ['FL Studio', 'Ableton'],
        rating: 4,
        tags: ['rompler', 'edm', 'trance', 'presets'],
        installed: true,
        installedPath: 'C:/VSTi/Nexus4.dll',
        notes: 'Kho preset khổng lồ. Dễ dùng nhưng ít linh hoạt.',
        aiSummary: '**Nexus 4** là ROMpler với thư viện âm thanh khổng lồ (300GB+).\n\n**Parameters chính:**\n- **Preset Browser** – Duyệt theo category\n- **Arp** – Arpeggiator tích hợp\n- **Effects** – Reverb, Delay, Chorus built-in\n- **Layer** – Kết hợp nhiều sound layers\n\n**Dùng tốt cho:** EDM, Trance, Pop, Film scoring\n**Tip:** Tìm expansion packs theo genre cụ thể',
        coverImage: null,
        images: [],
        createdAt: new Date(),
    },
    {
        id: 'demo-ozone',
        name: 'iZotope Ozone 11',
        developer: 'iZotope',
        version: '11.0.1',
        category: 'Mixing / Mastering',
        subCategory: 'Mastering Suite',
        license: 'licensed',
        daw: ['FL Studio', 'Ableton', 'Logic Pro', 'Cubase', 'Pro Tools'],
        rating: 5,
        tags: ['mastering', 'ai', 'loudness', 'stereo'],
        installed: true,
        installedPath: 'C:/VST3/iZotope/Ozone 11.vst3',
        notes: 'Suite mastering all-in-one. **AI Mastering Assistant** rất hay.',
        aiSummary: '**iZotope Ozone 11** là suite mastering AI toàn diện nhất.\n\n**Modules chính:**\n- **Master Rebalance** – Tách và cân bằng stems\n- **Maximizer** – Loudness, True Peak\n- **Dynamic EQ** – EQ thông minh\n- **Imager** – Stereo width\n- **AI Assistant** – Tự động suggest settings\n\n**Dùng tốt cho:** Final mastering, Stem mastering\n**Tip:** Bắt đầu với AI Assistant rồi fine-tune thủ công',
        coverImage: null,
        images: [],
        createdAt: new Date(),
    },
    {
        id: 'demo-vital',
        name: 'Vital',
        developer: 'Vital Audio',
        version: '1.5.5',
        category: 'VST Instrument',
        subCategory: 'Spectral Warper',
        license: 'free',
        daw: ['FL Studio', 'Ableton', 'Logic Pro', 'Cubase'],
        rating: 5,
        tags: ['synth', 'free', 'wavetable', 'spectral'],
        installed: true,
        installedPath: 'C:/VST3/Vital.vst3',
        notes: 'Free wavetable synth tốt nhất. **Gần như ngang Serum** nhưng miễn phí.',
        aiSummary: '**Vital** là wavetable synth miễn phí đỉnh cao, thay thế Serum xuất sắc.\n\n**Parameters chính:**\n- **Wavetable Osc** – 3 oscillator độc lập\n- **Spectral Morph** – Biến đổi tần số\n- **Filter** – Nhiều kiểu lọc chuyên nghiệp\n- **Mod Matrix** – 64 mod slots\n- **Effects** – FX chain đầy đủ\n\n**Dùng tốt cho:** Mọi thể loại, thay thế Serum miễn phí\n**Tip:** Download community presets trực tiếp trong app',
        coverImage: null,
        images: [],
        createdAt: new Date(),
    },
    {
        id: 'demo-voicemeeter',
        name: 'VoiceMeeter Banana',
        developer: 'VB-Audio',
        version: '2.0.6.4',
        category: 'Standalone',
        subCategory: 'Virtual Mixer',
        license: 'free',
        daw: [],
        rating: 4,
        tags: ['mixer', 'routing', 'audio', 'virtual'],
        installed: true,
        installedPath: 'C:/Program Files/VB/Voicemeeter/voicemeeterpro.exe',
        notes: 'Virtual audio mixer. Dùng để route audio giữa các app.',
        aiSummary: '**VoiceMeeter Banana** là virtual audio mixer miễn phí.\n\n**Tính năng chính:**\n- **Virtual Input** – 3 virtual audio inputs\n- **Physical Input** – 2 hardware inputs\n- **Bus** – Mix và route audio\n- **EQ/FX** – Built-in parametric EQ\n- **Recording** – Ghi audio trực tiếp\n\n**Dùng tốt cho:** Streaming, Podcast, Audio routing\n**Tip:** Cài VBCABLE đi kèm để route audio tốt hơn',
        coverImage: null,
        images: [],
        createdAt: new Date(),
    },
];
