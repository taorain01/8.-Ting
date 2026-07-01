/* MyPlugin — App Logic: Modals, Forms, AI */

const MP_AVATAR_IMAGE_MAX_SIZE = 512;
const MP_AVATAR_IMAGE_QUALITY = 0.86;

// ===== MODAL =====
function openModal(title, bodyHTML) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    const body = document.getElementById('modal-body');
    body.onpaste = null;
    body.innerHTML = '';
}

// ===== ADD PLUGIN MODAL =====
function openAddPluginModal() {
    openModal('Thêm Plugin Mới', getPluginFormHTML(null));
    initPluginForm(null);
}

function openEditPluginModal(pluginId) {
    const plugin = window.appState.plugins.find(p => p.id === pluginId);
    if (!plugin) return;
    openModal('Sửa Plugin', getPluginFormHTML(plugin));
    initPluginForm(plugin);
}

function getPluginFormHTML(plugin) {
    const categories = ['VST Instrument', 'VST Effect', 'Library / Samples', 'Mixing / Mastering', 'Standalone'];
    const licenses = [
        { value: 'licensed', label: 'Licensed (Có bản quyền)' },
        { value: 'cracked', label: 'Cracked' },
        { value: 'free', label: 'Free (Miễn phí)' },
        { value: 'subscription', label: 'Subscription' },
    ];
    const allDaws = ['FL Studio', 'Ableton', 'Logic Pro', 'Cubase', 'Pro Tools', 'Reaper', 'Bitwig', 'Studio One'];
    const facets = plugin ? getPluginFacets(plugin) : { genres: [], resourceTypes: [] };

    return `
        <div class="mp-form-section">Thông tin cơ bản</div>
        <div class="mp-form-row">
            <div class="mp-form-group">
                <label class="mp-form-label">Tên Plugin *</label>
                <input type="text" class="mp-form-input" id="f-name" placeholder="Serum" value="${plugin?.name || ''}">
            </div>
            <div class="mp-form-group">
                <label class="mp-form-label">Developer</label>
                <input type="text" class="mp-form-input" id="f-developer" placeholder="Xfer Records" value="${plugin?.developer || ''}">
            </div>
        </div>
        <div class="mp-form-group">
            <label class="mp-form-label">Phiên bản</label>
            <input type="text" class="mp-form-input" id="f-version" placeholder="1.0.0" value="${plugin?.version || ''}">
        </div>

        <div class="mp-form-section">Avatar</div>
        <div class="mp-avatar-editor" id="f-avatar-editor" tabindex="0" title="Ctrl+V để dán ảnh">
            <div class="mp-avatar-preview" id="f-avatar-preview"></div>
            <div class="mp-avatar-copy">
                <div class="mp-avatar-title">Ảnh đại diện plugin</div>
                <div class="mp-avatar-desc">Dùng ảnh vuông hoặc ảnh logo rõ nét để card plugin dễ nhận diện.</div>
                <div class="mp-avatar-actions">
                    <button type="button" class="btn btn-outline btn-sm" onclick="triggerAvatarFileInput()">${renderIcon('images', 'mp-icon-sm')} Chọn ảnh</button>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="focusAvatarPasteArea()">${renderIcon('copy', 'mp-icon-sm')} Dán ảnh</button>
                    <button type="button" class="btn btn-danger btn-sm" id="f-avatar-clear" onclick="clearAvatarImage()" hidden>${renderIcon('trash2', 'mp-icon-sm')} Xóa ảnh</button>
                </div>
            </div>
            <input type="file" id="f-cover-file" accept="image/*" style="display:none" onchange="handleAvatarFileSelect(this.files); this.value='';">
            <input type="hidden" id="f-cover-image" value="${escapeAttr(plugin?.coverImage || '')}">
        </div>

        <div class="mp-form-section">Phân loại</div>
        <div class="mp-form-row">
            <div class="mp-form-group">
                <label class="mp-form-label">Loại Plugin *</label>
                <select class="mp-form-select" id="f-category">
                    ${categories.map(c => `<option value="${c}" ${plugin?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
            </div>
            <div class="mp-form-group">
                <label class="mp-form-label">Sub-category</label>
                <input type="text" class="mp-form-input" id="f-subcategory" placeholder="Wavetable Synth" value="${plugin?.subCategory || ''}">
            </div>
        </div>
        <div class="mp-form-group">
            <label class="mp-form-label">License</label>
            <select class="mp-form-select" id="f-license">
                ${licenses.map(l => `<option value="${l.value}" ${plugin?.license === l.value ? 'selected' : ''}>${l.label}</option>`).join('')}
            </select>
        </div>
        <div class="mp-form-group">
            <label class="mp-form-label">Dòng nhạc</label>
            <div class="mp-chip-select" id="f-genre-chips">
                ${MP_GENRES.map(genre => `
                <button type="button" class="mp-select-chip ${facets.genres.some(g => sameFacetValue(g, genre)) ? 'active' : ''}" onclick="toggleSelectChip(this)">${genre}</button>`).join('')}
            </div>
        </div>
        <div class="mp-form-group">
            <label class="mp-form-label">Loại tài nguyên</label>
            <div class="mp-chip-select" id="f-resource-type-chips">
                ${MP_RESOURCE_TYPES.map(type => `
                <button type="button" class="mp-select-chip ${facets.resourceTypes.some(t => sameFacetValue(t, type)) ? 'active' : ''}" onclick="toggleSelectChip(this)">${type}</button>`).join('')}
            </div>
        </div>

        <div class="mp-form-section">DAW Hỗ trợ</div>
        <div class="mp-daw-chips" id="f-daw-chips">
            ${allDaws.map(daw => `
            <button type="button" class="mp-daw-chip ${plugin?.daw?.includes(daw) ? 'active' : ''}" 
                onclick="toggleDaw(this, '${daw}')">${daw}</button>`).join('')}
        </div>

        <div class="mp-form-section">Tags (phân cách bằng dấu phẩy)</div>
        <div class="mp-form-group">
            <input type="text" class="mp-form-input" id="f-tags" placeholder="synth, edm, bass, lead" value="${plugin?.tags?.join(', ') || ''}">
        </div>

        <div class="mp-form-section">Cài đặt</div>
        <div class="mp-form-row">
            <div class="mp-form-group">
                <label class="mp-form-label">
                    <input type="checkbox" id="f-installed" ${plugin?.installed ? 'checked' : ''} style="margin-right:6px">
                    Đã cài đặt trong máy
                </label>
            </div>
        </div>
        <div class="mp-form-group">
            <label class="mp-form-label">Đường dẫn cài đặt</label>
            <input type="text" class="mp-form-input" id="f-path" placeholder="C:/VST3/Serum.vst3" value="${plugin?.installedPath || ''}">
        </div>

        <div class="mp-form-section">License Key (tùy chọn)</div>
        <div class="mp-form-group">
            <label class="mp-form-label">License Key</label>
            <input type="password" class="mp-form-input" id="f-license-key" placeholder="Nhập license key (sẽ được mã hoá)" value="${plugin?.licenseKeyDisplay || ''}">
            <div class="mp-form-help mp-form-help-warning">${renderIcon('triangleAlert', 'mp-icon-xs')}<span>Key sẽ được mã hoá và bảo vệ bằng tài khoản của bạn</span></div>
        </div>

        <div class="mp-form-section">Ghi chú</div>
        <div class="mp-form-group">
            <label class="mp-form-label">Ghi chú cá nhân (hỗ trợ **bold**)</label>
            <textarea class="mp-form-textarea" id="f-notes" rows="4" placeholder="Ghi chú về plugin, cách dùng, tips...">${plugin?.notes || ''}</textarea>
        </div>

        <div class="mp-form-actions">
            <button type="button" class="btn btn-ghost btn-sm" onclick="closeModal()">Huỷ</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="savePlugin(${plugin ? `'${plugin.id}'` : 'null'})" style="min-width:120px">
                ${plugin ? `${renderIcon('save', 'mp-icon-sm')} Lưu thay đổi` : `${renderIcon('plus', 'mp-icon-sm')} Thêm Plugin`}
            </button>
        </div>
    `;
}

function initPluginForm(plugin) {
    const body = document.getElementById('modal-body');
    const editor = document.getElementById('f-avatar-editor');
    const category = document.getElementById('f-category');

    if (body) body.onpaste = handleAvatarPaste;
    if (editor) {
        editor.onpaste = handleAvatarPaste;
        editor.ondragover = handleAvatarDragOver;
        editor.ondragleave = handleAvatarDragLeave;
        editor.ondrop = handleAvatarDrop;
    }
    if (category) category.onchange = updateAvatarPreview;

    updateAvatarPreview();
}

function triggerAvatarFileInput() {
    document.getElementById('f-cover-file')?.click();
}

function focusAvatarPasteArea() {
    const editor = document.getElementById('f-avatar-editor');
    if (!editor) return;
    editor.focus();
    showToast('Có thể dán ảnh bằng Ctrl+V trong khung avatar', 'info', 2600);
}

function handleAvatarFileSelect(files) {
    const file = Array.from(files || []).find(item => item?.type?.startsWith('image/'));
    if (!file) {
        showToast('Vui lòng chọn một file ảnh', 'warning');
        return;
    }
    setAvatarImageFromFile(file);
}

function handleAvatarPaste(event) {
    if (event.defaultPrevented) return;
    if (!document.getElementById('f-avatar-editor')) return;
    const items = Array.from(event.clipboardData?.items || []);
    const item = items.find(entry => entry.type?.startsWith('image/'));
    if (!item) return;

    const file = item.getAsFile();
    if (!file) return;
    event.preventDefault();
    setAvatarImageFromFile(file);
}

function handleAvatarDragOver(event) {
    event.preventDefault();
    document.getElementById('f-avatar-editor')?.classList.add('dragover');
}

function handleAvatarDragLeave() {
    document.getElementById('f-avatar-editor')?.classList.remove('dragover');
}

function handleAvatarDrop(event) {
    event.preventDefault();
    document.getElementById('f-avatar-editor')?.classList.remove('dragover');
    handleAvatarFileSelect(event.dataTransfer?.files);
}

async function setAvatarImageFromFile(file) {
    try {
        const dataUrl = await resizeAvatarImage(file);
        setAvatarImageDataUrl(dataUrl);
        showToast('Đã cập nhật avatar plugin', 'success');
    } catch (error) {
        console.error('Avatar image error:', error);
        showToast('Không thể đọc ảnh này', 'error');
    }
}

function setAvatarImageDataUrl(dataUrl) {
    const input = document.getElementById('f-cover-image');
    if (input) input.value = dataUrl || '';
    updateAvatarPreview();
}

function clearAvatarImage() {
    setAvatarImageDataUrl('');
}

function updateAvatarPreview() {
    const preview = document.getElementById('f-avatar-preview');
    const input = document.getElementById('f-cover-image');
    const clearBtn = document.getElementById('f-avatar-clear');
    const editor = document.getElementById('f-avatar-editor');
    if (!preview || !input) return;

    const image = input.value.trim();
    if (image) {
        preview.innerHTML = `<img src="${escapeAttr(image)}" alt="">`;
    } else {
        const category = document.getElementById('f-category')?.value || 'VST Instrument';
        preview.innerHTML = `<div class="mp-avatar-fallback">${renderCategoryIcon(category, 'mp-icon-xl')}</div>`;
    }

    if (clearBtn) clearBtn.hidden = !image;
    if (editor) editor.classList.toggle('has-image', Boolean(image));
}

function resizeAvatarImage(file) {
    return new Promise((resolve, reject) => {
        if (!file?.type?.startsWith('image/')) {
            reject(new Error('Not an image'));
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const image = new Image();
            image.onload = () => {
                const scale = Math.min(1, MP_AVATAR_IMAGE_MAX_SIZE / Math.max(image.width, image.height));
                const width = Math.max(1, Math.round(image.width * scale));
                const height = Math.max(1, Math.round(image.height * scale));
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = width;
                canvas.height = height;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(image, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', MP_AVATAR_IMAGE_QUALITY));
            };
            image.onerror = () => reject(new Error('Image decode failed'));
            image.src = reader.result;
        };
        reader.onerror = () => reject(reader.error || new Error('File read failed'));
        reader.readAsDataURL(file);
    });
}

function toggleSelectChip(btn) {
    btn.classList.toggle('active');
}

function toggleDaw(btn, daw) {
    btn.classList.toggle('active');
}

async function savePlugin(pluginId) {
    const name = document.getElementById('f-name')?.value.trim();
    if (!name) { showToast('Vui lòng nhập tên plugin', 'warning'); return; }

    const daws = Array.from(document.querySelectorAll('.mp-daw-chip.active')).map(el => el.textContent);
    const genres = Array.from(document.querySelectorAll('#f-genre-chips .mp-select-chip.active')).map(el => el.textContent.trim());
    const resourceTypes = Array.from(document.querySelectorAll('#f-resource-type-chips .mp-select-chip.active')).map(el => el.textContent.trim());
    const tags = document.getElementById('f-tags')?.value.split(',').map(t => t.trim()).filter(Boolean);
    const licenseKey = document.getElementById('f-license-key')?.value.trim();

    const data = {
        name,
        developer: document.getElementById('f-developer')?.value.trim(),
        version: document.getElementById('f-version')?.value.trim(),
        category: document.getElementById('f-category')?.value,
        subCategory: document.getElementById('f-subcategory')?.value.trim(),
        license: document.getElementById('f-license')?.value,
        daw: daws,
        genres,
        resourceTypes,
        tags,
        installed: document.getElementById('f-installed')?.checked || false,
        installedPath: document.getElementById('f-path')?.value.trim(),
        coverImage: document.getElementById('f-cover-image')?.value.trim() || null,
        notes: document.getElementById('f-notes')?.value.trim(),
        ...(licenseKey && { licenseKeyDisplay: licenseKey }), // In real version: encrypt this
    };

    closeModal();

    if (window.appState.isDemoMode) {
        if (pluginId) {
            updatePluginDemo(pluginId, data);
            showToast('Đã cập nhật plugin', 'success');
            openPluginDetail(pluginId);
        } else {
            const newId = addPluginDemo(data);
            showToast('Đã thêm plugin', 'success');
            updateNavBadges();
            openPluginDetail(newId);
        }
    } else {
        if (pluginId) {
            await updatePluginInDB(pluginId, data);
            showToast('Đã cập nhật plugin', 'success');
        } else {
            const newId = await addPluginToDB(data);
            if (newId) showToast('Đã thêm plugin', 'success');
        }
    }
}

// ===== PLUGIN SCANNER =====
const MP_PLUGIN_SCAN_EXTENSIONS = ['dll', 'vst', 'vst3', 'component', 'clap', 'aaxplugin', 'exe'];
const MP_PLUGIN_SCAN_FORMAT_LABELS = {
    dll: 'VST',
    vst: 'VST',
    vst3: 'VST3',
    component: 'AU',
    clap: 'CLAP',
    aaxplugin: 'AAX',
    exe: 'Standalone',
};
const MP_PLUGIN_SCAN_MAX_DEPTH = 10;
const MP_PLUGIN_SCAN_MAX_RESULTS = 2500;
const MP_PLUGIN_SCAN_IGNORED_EXE_PATTERNS = [
    /^unins\d*$/,
    /^uninstall(er)?$/,
    /^(install|installer|setup|repair|remove|update|updater)(x64|x86|win64|win32|64bit|32bit)?$/,
    /^(vc(redist|redistributable)|vcredist|visualcredist|microsoftvisualc)/,
    /^dotnet(runtime|desktopruntime|sdk)?/,
    /^dx(web)?setup$/,
    /^(lame|ffmpeg|ffprobe|7z|7za|crashpadhandler|elevate|helper)$/,
];
const MP_PLUGIN_SCAN_IGNORED_DLL_PATTERNS = [
    /^(api-ms-win|concrt|ucrtbase|vcruntime|msvcp|msvcr)/,
    /^(libgcc|libstdc|libwinpthread)/,
    /^qt[56]/,
];

const MP_PLUGIN_VENDOR_HINTS = [
    { pattern: /\b(xfer|serum)\b/i, developer: 'Xfer Records' },
    { pattern: /\b(fabfilter|pro-?q|pro-?c|pro-?l|pro-?mb|saturn|timeless|volcano)\b/i, developer: 'FabFilter' },
    { pattern: /\b(izotope|ozone|neutron|nectar|rx\s?\d*)\b/i, developer: 'iZotope' },
    { pattern: /\b(arturia|pigments|analog lab|v collection)\b/i, developer: 'Arturia' },
    { pattern: /\b(waves|waveshell)\b/i, developer: 'Waves' },
    { pattern: /\b(antares|auto-?tune)\b/i, developer: 'Antares' },
    { pattern: /\b(native instruments|kontakt|massive|reaktor|battery|guitar rig|razer)\b/i, developer: 'Native Instruments' },
    { pattern: /\b(u-?he|diva|zebra|hive|repro)\b/i, developer: 'u-he' },
    { pattern: /\b(soundtoys|decapitator|echoboy|little alterboy)\b/i, developer: 'Soundtoys' },
    { pattern: /\b(valhalla)\b/i, developer: 'Valhalla DSP' },
    { pattern: /\b(slate digital|fresh air)\b/i, developer: 'Slate Digital' },
    { pattern: /\b(softube)\b/i, developer: 'Softube' },
    { pattern: /\b(plugin alliance|brainworx|bx_)\b/i, developer: 'Plugin Alliance' },
    { pattern: /\b(re-?fx|nexus)\b/i, developer: 'reFX' },
    { pattern: /\b(vital)\b/i, developer: 'Vital Audio' },
    { pattern: /\b(sylenth|lennar ?digital)\b/i, developer: 'LennarDigital' },
    { pattern: /\b(synapse|dune)\b/i, developer: 'Synapse Audio' },
    { pattern: /\b(air music|xpand)\b/i, developer: 'AIR Music Technology' },
    { pattern: /\b(ample sound|ample)\b/i, developer: 'Ample Sound' },
    { pattern: /\b(baby audio)\b/i, developer: 'BABY Audio' },
];

function openPluginScannerModal() {
    if (!window.appState.pluginScanResults) window.appState.pluginScanResults = [];
    if (!window.appState.pluginScanOptions) {
        window.appState.pluginScanOptions = { defaultLicense: 'licensed', defaultCategory: 'auto', rootLabel: '' };
    }
    openModal('Quét Plugin Tự Động', getPluginScannerHTML());
}

function getPluginScannerHTML() {
    const options = window.appState.pluginScanOptions || {};
    const results = window.appState.pluginScanResults || [];
    const progress = window.appState.pluginScanProgress;
    const isScanning = Boolean(progress?.active);
    const stats = getPluginScanStats(results);
    const categories = ['auto', 'VST Instrument', 'VST Effect', 'Library / Samples', 'Mixing / Mastering', 'Standalone'];
    const categoryLabels = {
        auto: 'Tự đoán theo tên file',
        'VST Instrument': 'VST Instrument',
        'VST Effect': 'VST Effect',
        'Library / Samples': 'Library / Samples',
        'Mixing / Mastering': 'Mixing / Mastering',
        Standalone: 'Standalone',
    };
    const licenses = [
        { value: 'licensed', label: 'Licensed (Có bản quyền)' },
        { value: 'free', label: 'Free (Miễn phí)' },
        { value: 'subscription', label: 'Subscription' },
        { value: 'cracked', label: 'Cracked' },
    ];

    return `
        <div class="mp-scanner-panel">
            <div class="mp-scanner-title">Quét thư mục plugin trong máy</div>
            <div class="mp-scanner-desc">
                Chọn thư mục như <strong>VST3</strong>, <strong>VSTPlugins</strong>, <strong>G:/64BIT</strong> hoặc thư mục plugin của FL Studio.
                App sẽ tìm các file .dll, .vst3, .clap, .component, .aaxplugin và .exe, bỏ qua installer/uninstaller/runtime phụ, rồi gộp các bản trùng tên.
            </div>
            <div class="mp-scanner-actions">
                <button type="button" class="btn btn-primary btn-sm" onclick="scanPluginFolder()" ${isScanning ? 'disabled' : ''}>
                    ${renderIcon('folderArchive', 'mp-icon-sm')}
                    ${isScanning ? 'Đang quét...' : 'Chọn thư mục quét'}
                </button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('plugin-folder-input')?.click()" ${isScanning ? 'disabled' : ''}>File picker dự phòng</button>
                <input type="file" id="plugin-folder-input" style="display:none" webkitdirectory directory multiple onchange="scanPluginFilesInput(this.files); this.value='';">
            </div>
        </div>

        <div class="mp-form-group">
            <label class="mp-form-label">Nhãn đường dẫn gốc (tuỳ chọn)</label>
            <input type="text" class="mp-form-input" id="plugin-scan-root" placeholder="VD: C:/Program Files/Common Files/VST3" value="${escapeAttr(options.rootLabel || '')}" onchange="syncPluginScanOptionsFromForm()">
            <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px">Trình duyệt không luôn cho biết đường dẫn tuyệt đối, nên bạn có thể điền nhãn này để path lưu trong app dễ đọc hơn.</div>
        </div>

        <div class="mp-scan-options">
            <div class="mp-form-group">
                <label class="mp-form-label">License mặc định</label>
                <select class="mp-form-select" id="plugin-scan-license" onchange="syncPluginScanOptionsFromForm()">
                    ${licenses.map(l => `<option value="${l.value}" ${options.defaultLicense === l.value ? 'selected' : ''}>${l.label}</option>`).join('')}
                </select>
            </div>
            <div class="mp-form-group">
                <label class="mp-form-label">Loại plugin mặc định</label>
                <select class="mp-form-select" id="plugin-scan-category" onchange="syncPluginScanOptionsFromForm()">
                    ${categories.map(c => `<option value="${c}" ${options.defaultCategory === c ? 'selected' : ''}>${categoryLabels[c]}</option>`).join('')}
                </select>
            </div>
        </div>

        ${renderPluginScanProgressHTML(progress)}

        ${results.length ? `
        <div class="mp-scan-summary">
            <div class="mp-scan-stat"><div class="mp-scan-stat-value">${stats.total}</div><div class="mp-scan-stat-label">Tìm thấy</div></div>
            <div class="mp-scan-stat"><div class="mp-scan-stat-value">${stats.newCount}</div><div class="mp-scan-stat-label">Có thể import</div></div>
            <div class="mp-scan-stat"><div class="mp-scan-stat-value">${stats.duplicateCount}</div><div class="mp-scan-stat-label">Đã có</div></div>
        </div>
        <div class="mp-scan-list">
            ${results.map(renderScannedPluginRow).join('')}
        </div>` : isScanning ? '' : `
        <div class="mp-scan-empty">
            Chưa có kết quả quét. Hãy chọn một thư mục plugin để bắt đầu.
        </div>`}

        <div class="mp-form-actions">
            <button type="button" class="btn btn-ghost btn-sm" onclick="clearPluginScanResults()" ${results.length && !isScanning ? '' : 'disabled'}>Xoá kết quả</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="closeModal()" ${isScanning ? 'disabled' : ''}>Đóng</button>
            <button type="button" class="btn btn-primary btn-sm" id="plugin-scan-import-btn" onclick="importScannedPlugins()" ${stats.newCount && !isScanning ? '' : 'disabled'} style="min-width:140px">
                Import ${stats.newCount} plugin
            </button>
        </div>
    `;
}

function syncPluginScanOptionsFromForm() {
    const current = window.appState.pluginScanOptions || {};
    window.appState.pluginScanOptions = {
        defaultLicense: document.getElementById('plugin-scan-license')?.value || current.defaultLicense || 'licensed',
        defaultCategory: document.getElementById('plugin-scan-category')?.value || current.defaultCategory || 'auto',
        rootLabel: document.getElementById('plugin-scan-root')?.value.trim() ?? current.rootLabel ?? '',
    };
}

function rerenderPluginScannerModal() {
    const body = document.getElementById('modal-body');
    if (body) body.innerHTML = getPluginScannerHTML();
}

function renderPluginScanProgressHTML(progress) {
    if (!progress?.active) return '';
    return `
        <div class="mp-scan-progress" id="plugin-scan-progress">
            <div class="mp-scan-progress-head">
                <div class="mp-scan-progress-title">
                    ${renderIcon('search', 'mp-icon-sm')}
                    <span id="plugin-scan-progress-status">${escapeHTML(progress.status || 'Đang quét...')}</span>
                </div>
                <div class="mp-scan-progress-count" id="plugin-scan-progress-count">${escapeHTML(progress.phase || 'Vui lòng đợi')}</div>
            </div>
            <div class="mp-scan-progress-track"><div class="mp-scan-progress-bar"></div></div>
            <div class="mp-scan-progress-grid">
                <div class="mp-scan-progress-metric">
                    <div class="mp-scan-progress-value" id="plugin-scan-progress-folders">${progress.foldersScanned || 0}</div>
                    <div class="mp-scan-progress-label">Thư mục</div>
                </div>
                <div class="mp-scan-progress-metric">
                    <div class="mp-scan-progress-value" id="plugin-scan-progress-items">${progress.itemsChecked || 0}</div>
                    <div class="mp-scan-progress-label">Mục đã đọc</div>
                </div>
                <div class="mp-scan-progress-metric">
                    <div class="mp-scan-progress-value" id="plugin-scan-progress-found">${progress.candidatesFound || 0}</div>
                    <div class="mp-scan-progress-label">Plugin</div>
                </div>
            </div>
            <div class="mp-scan-progress-path" id="plugin-scan-progress-path">${escapeHTML(progress.currentPath || '')}</div>
        </div>
    `;
}

function beginPluginScanProgress(status, currentPath = '') {
    window.appState.pluginScanProgress = {
        active: true,
        status,
        phase: 'Đang chuẩn bị',
        currentPath,
        foldersScanned: 0,
        itemsChecked: 0,
        candidatesFound: 0,
        _lastRenderAt: 0,
    };
    rerenderPluginScannerModal();
}

function updatePluginScanProgress(patch = {}, force = false) {
    const current = window.appState.pluginScanProgress || { active: true };
    const next = {
        ...current,
        ...patch,
        active: patch.active ?? current.active ?? true,
    };
    window.appState.pluginScanProgress = next;

    const now = Date.now();
    if (!force && next._lastRenderAt && now - next._lastRenderAt < 120) return;
    next._lastRenderAt = now;
    renderPluginScanProgressView();
}

function renderPluginScanProgressView() {
    const progress = window.appState.pluginScanProgress;
    const block = document.getElementById('plugin-scan-progress');
    if (!progress?.active) {
        if (block) block.remove();
        return;
    }
    if (!block) {
        rerenderPluginScannerModal();
        return;
    }

    setElementText('plugin-scan-progress-status', progress.status || 'Đang quét...');
    setElementText('plugin-scan-progress-count', progress.phase || 'Vui lòng đợi');
    setElementText('plugin-scan-progress-folders', progress.foldersScanned || 0);
    setElementText('plugin-scan-progress-items', progress.itemsChecked || 0);
    setElementText('plugin-scan-progress-found', progress.candidatesFound || 0);
    setElementText('plugin-scan-progress-path', progress.currentPath || '');
}

function clearPluginScanProgress(shouldRender = true) {
    window.appState.pluginScanProgress = null;
    if (shouldRender) rerenderPluginScannerModal();
}

function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function waitForBrowserPaint() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function attachDesktopPluginScanProgress() {
    if (!window.myPluginDesktop?.onScanPluginProgress) return null;
    return window.myPluginDesktop.onScanPluginProgress(progress => {
        updatePluginScanProgress({
            active: true,
            status: progress.status || 'Đang quét...',
            phase: progress.phase || 'Đang duyệt thư mục',
            currentPath: progress.currentPath || '',
            foldersScanned: progress.foldersScanned || 0,
            itemsChecked: progress.itemsChecked || 0,
            candidatesFound: progress.candidatesFound || 0,
        });
    });
}

function getPluginScanStats(results) {
    const total = results.length;
    const duplicateCount = results.filter(isScannedPluginDuplicate).length;
    return { total, duplicateCount, newCount: total - duplicateCount };
}

function renderScannedPluginRow(result) {
    const duplicate = isScannedPluginDuplicate(result);
    const format = (result.scanFormats || []).join(' + ') || 'Plugin';
    const meta = [
        result.developer || 'Unknown developer',
        result.category,
        result.installedPath,
    ].filter(Boolean).join(' · ');

    return `
        <div class="mp-scan-row ${duplicate ? 'duplicate' : ''}">
            <div class="mp-scan-name">
                <div class="mp-scan-plugin-name" title="${escapeAttr(result.name)}">${escapeHTML(result.name)}</div>
                <div class="mp-scan-plugin-meta" title="${escapeAttr(meta)}">${escapeHTML(meta)}</div>
            </div>
            <div class="mp-scan-format">${escapeHTML(format)}</div>
            <div class="mp-scan-status ${duplicate ? 'duplicate' : 'new'}">${duplicate ? 'Đã có' : 'Mới'}</div>
        </div>
    `;
}

async function scanPluginFolder() {
    syncPluginScanOptionsFromForm();

    if (window.myPluginDesktop?.scanPluginFolder) {
        const unsubscribeProgress = attachDesktopPluginScanProgress();
        try {
            beginPluginScanProgress('Đang chờ chọn thư mục...', 'Windows folder picker');
            const response = await window.myPluginDesktop.scanPluginFolder();
            if (response?.canceled) {
                clearPluginScanProgress();
                return;
            }

            updatePluginScanProgress({
                status: 'Đang xử lý kết quả...',
                phase: `${response?.plugins?.length || 0} file plugin`,
                currentPath: response?.rootPath || '',
                candidatesFound: response?.plugins?.length || 0,
            }, true);

            const found = (response?.plugins || [])
                .map(item => createScannedPluginFromPath(item.fileName, item.fullPath))
                .filter(Boolean);

            addScannedPlugins(found);
            clearPluginScanProgress(false);
            rerenderPluginScannerModal();
            showToast(`Đã tìm thấy ${found.length} file plugin`, found.length ? 'success' : 'warning', 4500);
        } catch (error) {
            console.error('Desktop plugin scan error:', error);
            clearPluginScanProgress();
            showToast('Không thể quét thư mục: ' + (error.message || 'Lỗi không xác định'), 'error', 5000);
        } finally {
            if (typeof unsubscribeProgress === 'function') unsubscribeProgress();
        }
        return;
    }

    if (!window.showDirectoryPicker) {
        showToast('Trình duyệt này chưa hỗ trợ chọn thư mục trực tiếp, dùng file picker dự phòng.', 'info', 4500);
        document.getElementById('plugin-folder-input')?.click();
        return;
    }

    try {
        const directoryHandle = await window.showDirectoryPicker({ mode: 'read' });
        beginPluginScanProgress(`Đang quét thư mục ${directoryHandle.name}...`, directoryHandle.name);
        const found = await collectScannedPluginsFromDirectory(directoryHandle);
        addScannedPlugins(found);
        clearPluginScanProgress(false);
        rerenderPluginScannerModal();
        showToast(`Đã tìm thấy ${found.length} file plugin`, found.length ? 'success' : 'warning', 4500);
    } catch (error) {
        clearPluginScanProgress();
        if (error?.name === 'AbortError') return;
        console.error('Plugin scan error:', error);
        showToast('Không thể quét thư mục: ' + (error.message || 'Lỗi không xác định'), 'error', 5000);
    }
}

async function scanPluginFilesInput(files) {
    syncPluginScanOptionsFromForm();
    const fileList = Array.from(files || []);
    if (!fileList.length) return;

    const firstPath = fileList[0].webkitRelativePath || fileList[0].name;
    const pickedRoot = splitScanPath(firstPath)[0] || 'Selected folder';
    const rootLabel = getPluginScanRootLabel(pickedRoot);
    const found = [];
    beginPluginScanProgress(`Đang kiểm tra ${fileList.length} mục...`, rootLabel);

    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (found.length >= MP_PLUGIN_SCAN_MAX_RESULTS) break;
        const webkitPath = file.webkitRelativePath || file.name;

        if (i % 100 === 0) {
            updatePluginScanProgress({
                status: `Đang kiểm tra ${i + 1}/${fileList.length} mục...`,
                phase: `${Math.min(i + 1, fileList.length)}/${fileList.length}`,
                currentPath: webkitPath,
                foldersScanned: 1,
                itemsChecked: i + 1,
                candidatesFound: found.length,
            }, true);
            await waitForBrowserPaint();
        }

        if (!isSupportedPluginName(file.name, webkitPath)) continue;

        const parts = splitScanPath(webkitPath);
        const relativePath = parts.length > 1 ? parts.slice(1).join('/') : file.name;
        found.push(createScannedPluginFromPath(file.name, `${rootLabel}/${relativePath}`));
        updatePluginScanProgress({
            currentPath: webkitPath,
            itemsChecked: i + 1,
            candidatesFound: found.length,
        });
    }

    addScannedPlugins(found.filter(Boolean));
    clearPluginScanProgress(false);
    rerenderPluginScannerModal();
    showToast(`Đã tìm thấy ${found.length} file plugin`, found.length ? 'success' : 'warning', 4500);
}

async function collectScannedPluginsFromDirectory(directoryHandle) {
    const found = [];
    const rootLabel = getPluginScanRootLabel(directoryHandle.name);
    let foldersScanned = 0;
    let itemsChecked = 0;

    async function walk(handle, currentPath, depth) {
        if (depth > MP_PLUGIN_SCAN_MAX_DEPTH || found.length >= MP_PLUGIN_SCAN_MAX_RESULTS) return;
        foldersScanned += 1;
        updatePluginScanProgress({
            status: 'Đang đọc thư mục...',
            phase: 'Đang duyệt',
            currentPath,
            foldersScanned,
            itemsChecked,
            candidatesFound: found.length,
        });

        const entries = [];
        for await (const entry of handle.entries()) entries.push(entry);
        entries.sort(([a], [b]) => a.localeCompare(b, 'vi'));
        itemsChecked += entries.length;
        updatePluginScanProgress({
            currentPath,
            foldersScanned,
            itemsChecked,
            candidatesFound: found.length,
        });
        await waitForBrowserPaint();

        for (const [name, childHandle] of entries) {
            if (found.length >= MP_PLUGIN_SCAN_MAX_RESULTS) break;
            const nextPath = `${currentPath}/${name}`;

            if (childHandle.kind === 'directory') {
                if (isSupportedPluginName(name, nextPath)) {
                    const plugin = createScannedPluginFromPath(name, nextPath);
                    if (plugin) found.push(plugin);
                    updatePluginScanProgress({
                        currentPath: nextPath,
                        foldersScanned,
                        itemsChecked,
                        candidatesFound: found.length,
                    });
                    continue;
                }
                await walk(childHandle, nextPath, depth + 1);
            } else if (isSupportedPluginName(name, nextPath)) {
                const plugin = createScannedPluginFromPath(name, nextPath);
                if (plugin) found.push(plugin);
                updatePluginScanProgress({
                    currentPath: nextPath,
                    foldersScanned,
                    itemsChecked,
                    candidatesFound: found.length,
                });
            }
        }
    }

    await walk(directoryHandle, rootLabel, 0);
    return found;
}

function getPluginScanRootLabel(fallback) {
    const optionRoot = window.appState.pluginScanOptions?.rootLabel?.trim();
    return normalizeScanDisplayPath(optionRoot || fallback || 'Plugin folder').replace(/\/+$/g, '');
}

function isSupportedPluginName(name, scanPath = '') {
    return MP_PLUGIN_SCAN_EXTENSIONS.includes(getPluginFileExtension(name)) && !isIgnoredPluginCandidate(name, scanPath);
}

function getPluginFileExtension(name) {
    const lower = String(name || '').toLowerCase();
    const extensions = ['aaxplugin', 'component', 'vst3', 'vst', 'clap', 'dll', 'exe'];
    return extensions.find(ext => lower.endsWith(`.${ext}`)) || '';
}

function createScannedPluginFromPath(fileName, displayPath) {
    const extension = getPluginFileExtension(fileName);
    const format = MP_PLUGIN_SCAN_FORMAT_LABELS[extension];
    if (!format) return null;
    if (isIgnoredPluginCandidate(fileName, displayPath)) return null;

    const installedPath = normalizeScanDisplayPath(displayPath);
    const name = cleanPluginNameFromFile(fileName);
    const scanKey = getPluginScanKey({ name, installedPath });
    if (!scanKey) return null;

    const category = inferPluginCategory(name, installedPath, extension);
    const subCategory = inferPluginSubCategory(name, installedPath, category);
    const resourceTypes = extension === 'exe' ? ['Standalone'] : ['Plugin', 'VST'];
    const tags = Array.from(new Set(['scan', format.toLowerCase(), subCategory].filter(Boolean)));

    return {
        scanKey,
        scanFormats: [format],
        scanPaths: [{ format, path: installedPath }],
        name,
        developer: inferPluginDeveloper(name, installedPath),
        version: '',
        category,
        subCategory,
        license: 'licensed',
        daw: inferPluginDaws(installedPath),
        resourceTypes,
        tags,
        installed: true,
        installedPath,
        notes: '',
    };
}

function cleanPluginNameFromFile(fileName) {
    let name = String(fileName || '').replace(/\.(aaxplugin|component|vst3?|clap|dll|exe)$/i, '');
    name = name.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
    name = name.replace(/\b(x64|x86|64\s?bit|32\s?bit|vst3?|au|aax|clap|plugin)\b/ig, '').replace(/\s+/g, ' ').trim();
    name = name.replace(/\s*[-–]\s*(x64|x86|64\s?bit|32\s?bit)$/i, '').trim();
    return name || String(fileName || '').trim();
}

function isIgnoredPluginCandidate(fileName, scanPath = '') {
    const extension = getPluginFileExtension(fileName);
    const compactName = getCompactPluginFileBase(fileName);

    if (extension === 'exe') {
        return MP_PLUGIN_SCAN_IGNORED_EXE_PATTERNS.some(pattern => pattern.test(compactName));
    }

    if (extension === 'dll') {
        return MP_PLUGIN_SCAN_IGNORED_DLL_PATTERNS.some(pattern => pattern.test(compactName));
    }

    const compactPath = getCompactPluginFileBase(scanPath);
    return compactPath.includes('uninstaller') || compactPath.includes('installerstub');
}

function getCompactPluginFileBase(fileName) {
    const baseName = getFileNameFromPath(fileName).replace(/\.(aaxplugin|component|vst3?|clap|dll|exe)$/i, '');
    return normalizeSearchText(baseName).replace(/[^a-z0-9]+/g, '');
}

function inferPluginDeveloper(name, path) {
    const haystack = `${name} ${path}`;
    const hint = MP_PLUGIN_VENDOR_HINTS.find(item => item.pattern.test(haystack));
    if (hint) return hint.developer;

    const parts = splitScanPath(path);
    const parent = parts.length > 1 ? cleanPathSegment(parts[parts.length - 2]) : '';
    if (parent && isLikelyDeveloperFolder(parent, name)) return parent;
    return '';
}

function inferPluginCategory(name, path, extension) {
    if (extension === 'exe') return 'Standalone';

    const haystack = normalizePluginScanText(`${name} ${path}`);
    const hasAny = words => words.some(word => haystack.includes(word));

    if (hasAny(['sample library', 'samples', 'library'])) return 'Library / Samples';
    if (hasAny(['mastering', 'ozone', 'maximizer', 'limiter', 'loudness'])) return 'Mixing / Mastering';
    if (hasAny(['compressor', 'comp ', 'eq', 'equalizer', 'reverb', 'delay', 'chorus', 'flanger', 'phaser', 'distortion', 'saturat', 'clipper', 'gate', 'deesser', 'auto tune', 'autotune', 'pitch', 'fx', 'effect'])) return 'VST Effect';
    if (hasAny(['vsti', 'generator', 'generators', 'synth', 'serum', 'pigments', 'sylenth', 'massive', 'vital', 'nexus', 'kontakt', 'omnisphere', 'keyscape', 'trilian', 'spire', 'diva', 'hive', 'dune', 'xpand', 'analog lab', 'piano', 'keys', 'guitar', 'bass', 'drum', 'rompler', 'sampler'])) return 'VST Instrument';

    return 'VST Effect';
}

function inferPluginSubCategory(name, path, category) {
    const haystack = normalizePluginScanText(`${name} ${path}`);
    const hasAny = words => words.some(word => haystack.includes(word));

    if (category === 'Standalone') return 'Standalone App';
    if (hasAny(['auto tune', 'autotune', 'pitch correction'])) return 'Pitch Correction';
    if (hasAny(['ozone', 'mastering'])) return 'Mastering Suite';
    if (hasAny(['pro q', 'eq', 'equalizer'])) return 'EQ';
    if (hasAny(['compressor', 'comp '])) return 'Compressor';
    if (hasAny(['limiter', 'maximizer'])) return 'Limiter';
    if (hasAny(['reverb'])) return 'Reverb';
    if (hasAny(['delay', 'echo'])) return 'Delay';
    if (hasAny(['saturat', 'distortion', 'clipper'])) return 'Saturation';
    if (hasAny(['wavetable', 'serum', 'vital', 'pigments'])) return 'Wavetable Synth';
    if (hasAny(['sampler', 'kontakt'])) return 'Sampler';
    if (hasAny(['rompler', 'nexus', 'xpand'])) return 'ROMpler';
    if (hasAny(['synth', 'sylenth', 'massive', 'spire', 'diva', 'hive', 'dune'])) return 'Synth';
    if (hasAny(['piano', 'keys'])) return 'Keys';
    if (hasAny(['guitar'])) return 'Guitar';
    if (hasAny(['drum'])) return 'Drums';
    return '';
}

function inferPluginDaws(path) {
    const haystack = normalizePluginScanText(path);
    const daws = [];
    if (haystack.includes('fl studio') || haystack.includes('image line') || haystack.includes('fruity')) daws.push('FL Studio');
    if (haystack.includes('ableton')) daws.push('Ableton');
    if (haystack.includes('cubase') || haystack.includes('steinberg')) daws.push('Cubase');
    if (haystack.includes('reaper')) daws.push('Reaper');
    if (haystack.includes('studio one')) daws.push('Studio One');
    return daws;
}

function addScannedPlugins(found) {
    const current = window.appState.pluginScanResults || [];
    const byKey = new Map(current.map(plugin => [plugin.scanKey, plugin]));

    found.forEach(plugin => {
        if (!plugin?.scanKey) return;
        const existing = byKey.get(plugin.scanKey);
        byKey.set(plugin.scanKey, existing ? mergeScannedPlugin(existing, plugin) : plugin);
    });

    window.appState.pluginScanResults = Array.from(byKey.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

function mergeScannedPlugin(base, incoming) {
    const scanPaths = [...(base.scanPaths || [])];
    (incoming.scanPaths || []).forEach(item => {
        if (!scanPaths.some(existing => normalizePathKey(existing.path) === normalizePathKey(item.path))) scanPaths.push(item);
    });

    const scanFormats = Array.from(new Set(scanPaths.map(item => item.format).filter(Boolean)));
    const preferredPath = choosePreferredScanPath(scanPaths)?.path || base.installedPath || incoming.installedPath;

    return {
        ...base,
        developer: base.developer || incoming.developer,
        category: base.category !== 'VST Effect' ? base.category : incoming.category,
        subCategory: base.subCategory || incoming.subCategory,
        daw: Array.from(new Set([...(base.daw || []), ...(incoming.daw || [])])),
        resourceTypes: Array.from(new Set([...(base.resourceTypes || []), ...(incoming.resourceTypes || [])])),
        tags: Array.from(new Set([...(base.tags || []), ...(incoming.tags || [])])),
        installedPath: preferredPath,
        scanFormats,
        scanPaths,
    };
}

function choosePreferredScanPath(paths) {
    const priority = ['VST3', 'CLAP', 'VST', 'AU', 'AAX', 'Standalone'];
    return [...paths].sort((a, b) => {
        const ia = priority.indexOf(a.format);
        const ib = priority.indexOf(b.format);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })[0];
}

function isScannedPluginDuplicate(result) {
    const existingPlugins = window.appState.plugins || [];
    return existingPlugins.some(plugin => {
        if (getPluginScanKey(plugin) === result.scanKey) return true;
        const pluginPath = normalizePathKey(plugin.installedPath || '');
        if (!pluginPath) return false;
        return (result.scanPaths || []).some(item => normalizePathKey(item.path) === pluginPath);
    });
}

function getPluginScanKey(plugin) {
    const name = plugin?.name || getFileNameFromPath(plugin?.installedPath || '');
    return facetKey(cleanPluginNameFromFile(name));
}

function clearPluginScanResults() {
    syncPluginScanOptionsFromForm();
    window.appState.pluginScanResults = [];
    rerenderPluginScannerModal();
}

async function importScannedPlugins() {
    syncPluginScanOptionsFromForm();
    const results = window.appState.pluginScanResults || [];
    const toImport = results.filter(result => !isScannedPluginDuplicate(result));

    if (!toImport.length) {
        showToast('Không có plugin mới để import', 'warning');
        return;
    }

    const btn = document.getElementById('plugin-scan-import-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Đang import...';
    }

    const dataList = toImport.map(prepareScannedPluginForImport);
    let imported = 0;

    try {
        if (window.appState.isDemoMode) {
            dataList.forEach(data => addPluginDemo(data));
            imported = dataList.length;
        } else if (typeof addPluginsToDB === 'function') {
            imported = await addPluginsToDB(dataList);
        } else {
            for (const data of dataList) {
                const id = await addPluginToDB(data);
                if (id) imported++;
            }
        }

        if (!imported) {
            showToast('Chưa import được plugin nào', 'error');
            rerenderPluginScannerModal();
            return;
        }

        window.appState.pluginScanResults = [];
        closeModal();
        updateNavBadges();
        navigateTo('all');
        showToast(`Đã import ${imported} plugin`, 'success', 5000);
    } catch (error) {
        console.error('Import scanned plugins error:', error);
        showToast('Lỗi import plugin: ' + (error.message || 'Không xác định'), 'error', 5000);
        rerenderPluginScannerModal();
    }
}

function prepareScannedPluginForImport(result) {
    const options = window.appState.pluginScanOptions || {};
    const category = options.defaultCategory && options.defaultCategory !== 'auto' ? options.defaultCategory : result.category;

    return {
        name: result.name,
        developer: result.developer,
        version: result.version || '',
        category,
        subCategory: result.subCategory,
        license: options.defaultLicense || result.license || 'licensed',
        daw: result.daw || [],
        genres: [],
        resourceTypes: result.resourceTypes || [],
        tags: result.tags || [],
        installed: true,
        installedPath: result.installedPath,
        notes: buildImportedScanNotes(result),
        importSource: 'plugin-scanner',
        importedAt: new Date(),
    };
}

function buildImportedScanNotes(result) {
    const paths = result.scanPaths || [];
    if (paths.length <= 1) return '';

    return [
        'Import tự động từ tính năng quét plugin.',
        '',
        'Các file/format tìm thấy:',
        ...paths.map(item => `- ${item.format}: ${item.path}`),
    ].join('\n');
}

function splitScanPath(path) {
    return String(path || '').split(/[\\/]+/).filter(Boolean);
}

function getFileNameFromPath(path) {
    const parts = splitScanPath(path);
    return parts[parts.length - 1] || '';
}

function cleanPathSegment(value) {
    return String(value || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isLikelyDeveloperFolder(folder, pluginName) {
    const folderKey = facetKey(folder);
    if (!folderKey) return false;
    if (folderKey === facetKey(pluginName)) return false;

    const genericFolders = [
        'vst', 'vst2', 'vst3', 'plugins', 'plugin', 'vstplugins', 'commonfiles',
        'programfiles', 'programfilesx86', 'steinberg', 'image line', 'imageline',
        'flstudio', 'effects', 'generators', 'instruments', '64bit', '32bit',
    ];
    return !genericFolders.some(value => facetKey(value) === folderKey);
}

function normalizeScanDisplayPath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

function normalizePathKey(path) {
    return normalizeScanDisplayPath(path).toLowerCase();
}

function normalizePluginScanText(value) {
    return normalizeSearchText(value)
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function confirmDeletePlugin(pluginId) {
    const plugin = window.appState.plugins.find(p => p.id === pluginId);
    if (!plugin) return;
    openModal('Xoá Plugin', `
        <div style="text-align:center;padding:10px 0 20px">
            <div class="mp-delete-warning">${renderIcon('triangleAlert', 'mp-icon-xl')}</div>
            <div style="font-size:16px;font-weight:700;margin-bottom:8px">Xoá "${plugin.name}"?</div>
            <div style="font-size:14px;color:var(--text-secondary);margin-bottom:24px">Hành động này không thể hoàn tác.</div>
            <div style="display:flex;gap:10px;justify-content:center">
                <button class="btn btn-ghost btn-sm" onclick="closeModal()">Huỷ</button>
                <button class="btn btn-danger btn-sm" onclick="doDeletePlugin('${pluginId}')">${renderIcon('trash2', 'mp-icon-sm')} Xoá vĩnh viễn</button>
            </div>
        </div>
    `);
}

async function doDeletePlugin(pluginId) {
    closeModal();
    if (window.appState.isDemoMode) {
        deletePluginDemo(pluginId);
        showToast('Đã xoá plugin', 'success');
    } else {
        await deletePluginFromDB(pluginId);
    }
    navigateTo('all');
}

// ===== EDIT NOTES MODAL =====
function openEditNotesModal(pluginId) {
    const plugin = window.appState.plugins.find(p => p.id === pluginId);
    if (!plugin) return;
    openModal('Sửa ghi chú', `
        <div class="mp-form-group">
            <label class="mp-form-label">Ghi chú (hỗ trợ **bold**, *italic*)</label>
            <textarea class="mp-form-textarea" id="edit-notes-input" rows="10" 
                placeholder="Ghi chú về plugin, cách dùng, tips...">${plugin.notes || ''}</textarea>
        </div>
        <div class="mp-form-actions">
            <button class="btn btn-ghost btn-sm" onclick="closeModal()">Huỷ</button>
            <button class="btn btn-primary btn-sm" onclick="saveNotes('${pluginId}')">${renderIcon('save', 'mp-icon-sm')} Lưu</button>
        </div>
    `);
}

async function saveNotes(pluginId) {
    const notes = document.getElementById('edit-notes-input')?.value.trim();
    closeModal();
    if (window.appState.isDemoMode) {
        updatePluginDemo(pluginId, { notes });
    } else {
        await updatePluginInDB(pluginId, { notes });
    }
    showToast('Đã lưu ghi chú', 'success');
    openPluginDetail(pluginId);
}

// ===== ADD PRESET MODAL =====
function openAddPresetModal(pluginId) {
    openModal('Thêm Preset', `
        <div class="mp-form-group">
            <label class="mp-form-label">Tên Preset *</label>
            <input type="text" class="mp-form-input" id="preset-name" placeholder="Heavy Bass Drop">
        </div>
        <div class="mp-form-group">
            <label class="mp-form-label">Mô tả ngắn</label>
            <input type="text" class="mp-form-input" id="preset-desc" placeholder="Bass mạnh dùng cho EDM drop">
        </div>
        <div class="mp-form-group">
            <label class="mp-form-label">Ghi chú chi tiết (hỗ trợ **bold** cho parameters)</label>
            <textarea class="mp-form-textarea" id="preset-notes" rows="5"
                placeholder="**Macro 1** = 80%, **Cutoff** = 2kHz, **Attack** = 5ms..."></textarea>
        </div>
        <div class="mp-form-actions">
            <button class="btn btn-ghost btn-sm" onclick="closeModal()">Huỷ</button>
            <button class="btn btn-primary btn-sm" onclick="savePreset('${pluginId}')">${renderIcon('plus', 'mp-icon-sm')} Thêm Preset</button>
        </div>
    `);
}

async function savePreset(pluginId) {
    const name = document.getElementById('preset-name')?.value.trim();
    if (!name) { showToast('Vui lòng nhập tên preset', 'warning'); return; }
    const data = {
        name,
        description: document.getElementById('preset-desc')?.value.trim(),
        notes: document.getElementById('preset-notes')?.value.trim(),
    };
    closeModal();
    await addPresetToDB(pluginId, data);
    showToast('Đã thêm preset', 'success');
    openPluginDetail(pluginId);
}

// ===== LICENSE KEY =====
function toggleLicenseKey(pluginId) {
    const plugin = window.appState.plugins.find(p => p.id === pluginId);
    const el = document.getElementById('license-key-val');
    if (!el) return;
    if (el.classList.contains('masked')) {
        el.textContent = plugin?.licenseKeyDisplay || '(Chưa có)';
        el.classList.remove('masked');
    } else {
        el.textContent = '••••••••••••••••••••';
        el.classList.add('masked');
    }
}

function copyLicenseKey(pluginId) {
    const plugin = window.appState.plugins.find(p => p.id === pluginId);
    const key = plugin?.licenseKeyDisplay;
    if (!key) { showToast('Không có license key', 'warning'); return; }
    navigator.clipboard.writeText(key).then(() => showToast('Đã copy license key', 'success')).catch(() => showToast('Không thể copy', 'error'));
}

// ===== AI SUMMARY =====
async function generateAISummary(pluginId) {
    const plugin = window.appState.plugins.find(p => p.id === pluginId);
    if (!plugin) return;

    const settings = getCurrentAISettings();
    const apiKey = settings.apiKeyPlain;
    const provider = settings.aiProvider || 'gemini';

    if (!apiKey) {
        showToast('Vui lòng nhập API Key trong Cài đặt trước', 'warning');
        return;
    }

    // Show loading
    const aiBlock = document.querySelector('.mp-ai-block');
    if (aiBlock) aiBlock.innerHTML = `<div class="mp-ai-loading"><div class="mp-ai-spinner"></div>AI đang phân tích ${plugin.name}...</div>`;

    const prompt = `Bạn là chuyên gia âm nhạc và sản xuất nhạc. Hãy tóm tắt plugin "${plugin.name}" của ${plugin.developer || 'Unknown'}.
Loại: ${plugin.category}${plugin.subCategory ? ' - ' + plugin.subCategory : ''}

Trả lời ngắn gọn bằng tiếng Việt, dùng định dạng Markdown:
1. Mô tả ngắn 1-2 câu plugin làm gì
2. Liệt kê **Parameters quan trọng** (in đậm tên parameter, giải thích ngắn)
3. Dùng tốt nhất cho loại nhạc/mục đích gì
4. 1-2 Tips thực tế

Ngắn gọn, súc tích, dễ đọc.`;

    try {
        let result = '';
        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 500 })
            });
            const json = await res.json();
            if (!res.ok || json.error) throw new Error(json.error?.message || `OpenAI HTTP ${res.status}`);
            result = json.choices?.[0]?.message?.content || 'Không nhận được phản hồi';
        } else {
            const gemini = await callGeminiAPI(prompt, {
                apiKeys: apiKey,
                modelOverride: settings.geminiModel,
                maxRetries: 2,
                temperature: 1.2,
                onProgress: msg => {
                    const block = document.querySelector('.mp-ai-loading');
                    if (block) block.innerHTML = `<div class="mp-ai-spinner"></div>${escapeHTML(msg)}`;
                },
            });
            result = gemini.text;
        }

        // Save to DB
        if (window.appState.isDemoMode) {
            updatePluginDemo(pluginId, { aiSummary: result });
        } else {
            await updatePluginInDB(pluginId, { aiSummary: result, aiSummaryUpdatedAt: new Date() });
        }

        // Update UI
        if (aiBlock) aiBlock.innerHTML = `<div class="mp-ai-content">${renderMarkdown(result)}</div>`;
        showToast('AI đã tóm tắt xong!', 'success');

    } catch (error) {
        if (aiBlock) aiBlock.innerHTML = `<div class="mp-ai-empty">Lỗi: ${error.message}</div>`;
        showToast('Lỗi gọi AI: ' + error.message, 'error');
    }
}
