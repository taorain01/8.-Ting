/* MyPlugin — Auth Module */

async function handleGoogleLogin() {
    const btn = document.getElementById('btn-google-login');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang đăng nhập...'; }
    try {
        await waitForFirebase();
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('Google login error:', error);
        showAuthError('Đăng nhập thất bại', error.message || 'Thử lại sau');
        if (btn) { btn.disabled = false; btn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Đăng nhập với Google`; }
    }
}

function showAuthError(title, message) {
    const notice = document.getElementById('auth-error');
    const titleEl = document.getElementById('auth-error-title');
    const msgEl = document.getElementById('auth-error-msg');
    if (notice) { notice.hidden = false; titleEl.textContent = title; msgEl.textContent = message; }
}

function enterDemoMode() {
    window.appState.isDemoMode = true;
    window.appState.plugins = [...DEMO_PLUGINS];
    updateNavBadges();
    showAppShell({ displayName: 'Demo User', email: 'demo@myplugin.app', photoURL: null });
    navigateTo('dashboard');
}

function signOut() {
    if (window.appState.isDemoMode) {
        window.appState.isDemoMode = false;
        window.appState.plugins = [];
        showAuthScreen();
        return;
    }
    auth?.signOut().then(() => showAuthScreen()).catch(console.error);
}

function showAuthScreen() {
    document.getElementById('auth-screen').classList.add('active', 'ready');
    document.getElementById('app-shell').classList.remove('active', 'ready');
}

function showAppShell(user) {
    // Update user info
    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = user.displayName || user.email || 'User';
    if (emailEl) emailEl.textContent = user.email || 'Demo mode';
    if (avatarEl) {
        if (user.photoURL) {
            avatarEl.innerHTML = `<img src="${user.photoURL}" alt="">`;
        } else {
            avatarEl.innerHTML = `<span>${(user.displayName || user.email || 'U')[0].toUpperCase()}</span>`;
        }
    }

    document.getElementById('auth-screen').classList.remove('active');
    const shell = document.getElementById('app-shell');
    shell.classList.add('active');
    setTimeout(() => shell.classList.add('ready'), 50);
}

// ===== INIT =====
async function initApp() {
    try {
        await waitForFirebase();
        updateSplashStatus('Đang kiểm tra đăng nhập...');

        auth.onAuthStateChanged(async user => {
            hideSplash();
            if (user) {
                window.appState.currentUser = user;
                const localAISettings = loadLocalAISettings();
                const savedAISettings = await loadMyPluginSettings().catch(() => null);
                window.appState.aiSettings = {
                    ...localAISettings,
                    ...(savedAISettings || {}),
                    apiKeyPlain: localAISettings.apiKeyPlain || window.appState.aiSettings?.apiKeyPlain || '',
                };
                loadPluginsRealtime();
                showAppShell(user);
                navigateTo('dashboard');
            } else {
                showAuthScreen();
                document.getElementById('auth-screen').classList.add('ready');
            }
        });
    } catch (error) {
        console.error('Init error:', error);
        hideSplash();
        // Vẫn cho phép demo mode
        showAuthScreen();
        document.getElementById('auth-screen').classList.add('ready');
    }
}

function hideSplash() {
    const splash = document.getElementById('mp-splash');
    if (splash) { splash.classList.add('hidden'); setTimeout(() => splash.remove(), 500); }
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
