/* MyPlugin — Database Module (Firestore) */

let pluginsUnsubscribe = null;

// ===== LOAD PLUGINS REALTIME =====
function loadPluginsRealtime() {
    const userId = auth?.currentUser?.uid;
    if (!userId) return;
    if (typeof pluginsUnsubscribe === 'function') pluginsUnsubscribe();

    pluginsUnsubscribe = db.collection('users').doc(userId).collection('plugins')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const plugins = [];
            snapshot.forEach(doc => {
                plugins.push({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.() || new Date() });
            });
            window.appState.plugins = plugins;
            updateNavBadges();
            // Re-render current page
            const page = window.appState.currentPage;
            if (page) rerenderPage(page);
        }, error => {
            console.error('Load plugins error:', error);
            window.appState.plugins = [];
        });
}

function rerenderPage(page) {
    if (page === 'dashboard') renderDashboard();
    else if (page === 'all') renderPluginList('all');
    else if (page.startsWith('cat-')) renderPluginList(page);
    else if (page === 'settings') renderSettings();
}

// ===== ADD PLUGIN =====
async function addPluginToDB(data) {
    const userId = auth?.currentUser?.uid;
    if (!userId) return null;
    try {
        const ref = await db.collection('users').doc(userId).collection('plugins').add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        console.log('Added plugin:', ref.id);
        return ref.id;
    } catch (error) {
        console.error('Add plugin error:', error);
        showToast('Lỗi thêm plugin', 'error');
        return null;
    }
}

async function addPluginsToDB(pluginList) {
    const userId = auth?.currentUser?.uid;
    if (!userId || !Array.isArray(pluginList) || pluginList.length === 0) return 0;
    try {
        const collectionRef = db.collection('users').doc(userId).collection('plugins');
        let imported = 0;

        for (let i = 0; i < pluginList.length; i += 450) {
            const batch = db.batch();
            const chunk = pluginList.slice(i, i + 450);
            chunk.forEach(data => {
                const ref = collectionRef.doc();
                batch.set(ref, {
                    ...data,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
            });
            await batch.commit();
            imported += chunk.length;
        }

        console.log('Imported plugins:', imported);
        return imported;
    } catch (error) {
        console.error('Import plugins error:', error);
        showToast('Lỗi import plugin', 'error');
        return 0;
    }
}

// ===== UPDATE PLUGIN =====
async function updatePluginInDB(pluginId, data) {
    const userId = auth?.currentUser?.uid;
    if (!userId) return false;
    try {
        await db.collection('users').doc(userId).collection('plugins').doc(pluginId).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        return true;
    } catch (error) {
        console.error('Update plugin error:', error);
        showToast('Lỗi cập nhật', 'error');
        return false;
    }
}

// ===== DELETE PLUGIN =====
async function deletePluginFromDB(pluginId) {
    const userId = auth?.currentUser?.uid;
    if (!userId) return false;
    try {
        await db.collection('users').doc(userId).collection('plugins').doc(pluginId).delete();
        showToast('Đã xoá plugin', 'success');
        return true;
    } catch (error) {
        console.error('Delete plugin error:', error);
        showToast('Lỗi xoá plugin', 'error');
        return false;
    }
}

// ===== LOAD PRESETS OF A PLUGIN =====
async function loadPresets(pluginId) {
    const userId = auth?.currentUser?.uid;
    if (!userId) {
        // Demo mode
        return window.appState.demoPresets?.[pluginId] || [];
    }
    try {
        const snap = await db.collection('users').doc(userId).collection('plugins').doc(pluginId).collection('presets')
            .orderBy('createdAt', 'desc').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Load presets error:', error);
        return [];
    }
}

// ===== ADD PRESET =====
async function addPresetToDB(pluginId, data) {
    const userId = auth?.currentUser?.uid;
    if (!userId) {
        // Demo mode
        if (!window.appState.demoPresets) window.appState.demoPresets = {};
        if (!window.appState.demoPresets[pluginId]) window.appState.demoPresets[pluginId] = [];
        const preset = { id: `demo-preset-${Date.now()}`, ...data, createdAt: new Date() };
        window.appState.demoPresets[pluginId].unshift(preset);
        showToast('Đã thêm preset (Demo)', 'success');
        return preset.id;
    }
    try {
        const ref = await db.collection('users').doc(userId).collection('plugins').doc(pluginId)
            .collection('presets').add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
        return ref.id;
    } catch (error) {
        console.error('Add preset error:', error);
        showToast('Lỗi thêm preset', 'error');
        return null;
    }
}

// ===== GET / SAVE SETTINGS =====
async function loadMyPluginSettings() {
    const userId = auth?.currentUser?.uid;
    if (!userId) return null;
    try {
        const doc = await db.collection('users').doc(userId).collection('settings').doc('myplugin').get();
        return doc.exists ? doc.data() : null;
    } catch (error) { return null; }
}

async function saveMyPluginSettings(data) {
    const userId = auth?.currentUser?.uid;
    if (!userId) return false;
    try {
        await db.collection('users').doc(userId).collection('settings').doc('myplugin').set(data, { merge: true });
        return true;
    } catch (error) { return false; }
}

// ===== DEMO MODE: save/delete =====
function addPluginDemo(data) {
    const plugin = {
        id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    window.appState.plugins.unshift(plugin);
    updateNavBadges();
    return plugin.id;
}

function updatePluginDemo(pluginId, data) {
    const idx = window.appState.plugins.findIndex(p => p.id === pluginId);
    if (idx !== -1) {
        window.appState.plugins[idx] = { ...window.appState.plugins[idx], ...data, updatedAt: new Date() };
    }
    return true;
}

function deletePluginDemo(pluginId) {
    window.appState.plugins = window.appState.plugins.filter(p => p.id !== pluginId);
    updateNavBadges();
    return true;
}
