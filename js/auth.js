/* Ting! — Authentication Module
   Firebase Auth: Google Sign-In, Email/Password, Đăng ký, Reset Password */

// ===== SPLASH SCREEN CONTROL =====
function updateSplashStatus(text) {
    const el = document.getElementById('splash-status');
    if (el) el.textContent = text;
}

function hideSplash() {
    const splash = document.getElementById('ting-splash');
    if (!splash || splash.classList.contains('hidden')) return;
    splash.classList.add('hidden');
    // Xoá khỏi DOM sau animation để giải phóng bộ nhớ
    setTimeout(() => {
        splash.remove();
        const splashCss = document.getElementById('splash-critical-css');
        if (splashCss) splashCss.remove();
    }, 500);
}

async function requireFirebaseReady() {
    if (typeof waitForFirebase === 'function') {
        return waitForFirebase();
    }
    if (auth && db) return { auth, db, firebase };
    throw new Error('Firebase chưa sẵn sàng');
}

function isFirestorePermissionError(error) {
    return error?.code === 'permission-denied'
        || String(error?.message || '').toLowerCase().includes('insufficient permissions');
}

let pendingGoogleLinkCredential = null;
let pendingGoogleLinkEmail = '';
const GOOGLE_SIGN_IN_TIMEOUT_MS = 20000;
const AUTH_REMEMBER_MODE_KEY = 'authRememberMode';
const AUTH_SESSION_META_KEY = 'authSessionMeta';
const AUTH_REMEMBER_30D_MS = 30 * 24 * 60 * 60 * 1000;

function readAuthLocalSetting(key, fallback) {
    try {
        const raw = localStorage.getItem(`ting.${key}`);
        return raw === null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeAuthLocalSetting(key, value) {
    try { localStorage.setItem(`ting.${key}`, JSON.stringify(value)); } catch {}
}

function normalizeAuthRememberMode(value) {
    return value === '30d' ? '30d' : 'forever';
}

function getAuthRememberMode() {
    return normalizeAuthRememberMode(readAuthLocalSetting(AUTH_REMEMBER_MODE_KEY, 'forever'));
}

function getAuthRememberModeLabel(mode = getAuthRememberMode()) {
    return normalizeAuthRememberMode(mode) === '30d' ? '30 ngày' : 'Vĩnh viễn';
}

function setAuthRememberMode(mode) {
    const next = normalizeAuthRememberMode(mode);
    writeAuthLocalSetting(AUTH_REMEMBER_MODE_KEY, next);
    return next;
}

function updateStoredAuthSession(user) {
    if (!user?.uid) return;
    writeAuthLocalSetting(AUTH_SESSION_META_KEY, {
        uid: user.uid,
        email: user.email || '',
        mode: getAuthRememberMode(),
        lastSeenAt: Date.now(),
    });
}

function isStoredAuthSessionExpired(user) {
    const mode = getAuthRememberMode();
    if (mode !== '30d') return false;
    const meta = readAuthLocalSetting(AUTH_SESSION_META_KEY, null);
    if (!meta || meta.uid !== user?.uid) {
        updateStoredAuthSession(user);
        return false;
    }
    return Date.now() - Number(meta.lastSeenAt || 0) > AUTH_REMEMBER_30D_MS;
}

async function handleRememberSignInChange(value) {
    const mode = setAuthRememberMode(value);
    if (auth?.currentUser) updateStoredAuthSession(auth.currentUser);
    showToast(`Đã đặt ghi nhớ đăng nhập: ${getAuthRememberModeLabel(mode)}`, 'success');
    if (window.appState?.currentPage === 'settings' && typeof renderSettings === 'function') renderSettings();
}

function isNativeCapacitorApp() {
    const platform = window.Capacitor?.getPlatform?.();
    const userAgent = navigator.userAgent || '';
    const isAndroidWebView = /Android/i.test(userAgent) && /; wv\)|\bwv\b/i.test(userAgent);
    const isCapacitorLocalhost = /Android/i.test(userAgent)
        && window.location.hostname === 'localhost'
        && window.location.protocol === 'https:';
    return Boolean(
        window.Capacitor?.isNativePlatform?.()
        || platform === 'android'
        || platform === 'ios'
        || isAndroidWebView
        || isCapacitorLocalhost
    );
}

function isMobileBrowserAuthFlow() {
    const userAgent = navigator.userAgent || '';
    return !isNativeCapacitorApp() && /Android|iPhone|iPad|iPod/i.test(userAgent);
}

function withAuthTimeout(promise, message) {
    let timer = null;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const error = new Error(message);
            error.code = 'auth/operation-timeout';
            reject(error);
        }, GOOGLE_SIGN_IN_TIMEOUT_MS);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function configureNativeAuthUi() {
    const googleBtn = document.getElementById('btn-google-login');
    const authDivider = document.querySelector('.d-auth-card .auth-divider, .auth-card .auth-divider');

    if (googleBtn) {
        googleBtn.hidden = false;
        googleBtn.disabled = false;
        googleBtn.style.display = '';
    }
    if (authDivider) authDivider.hidden = false;
}

function getNativeFirebaseAuthentication() {
    const plugin = window.Capacitor?.Plugins?.FirebaseAuthentication
        || window.FirebaseAuthentication
        || window.capacitorFirebaseAuthentication?.FirebaseAuthentication;
    return typeof plugin?.signInWithGoogle === 'function' ? plugin : null;
}

function getNativeGoogleConfigErrorMessage(error) {
    const message = String(error?.message || error || '');
    if (
        message.includes('default_web_client_id')
        || message.includes('WILL_BE_OVERRIDDEN')
        || message.includes('DEVELOPER_ERROR')
        || message.includes('10:')
    ) {
        return 'Google Sign-In native thiếu cấu hình Firebase Android. Cần thêm Android app app.ting.manager, SHA-1 debug/release và google-services.json trong Firebase Console.';
    }
    return message || 'Không đăng nhập được Google trên Android';
}

async function getNativeGoogleCredential() {
    const nativeAuth = getNativeFirebaseAuthentication();
    if (!nativeAuth) {
        throw new Error('Plugin FirebaseAuthentication native chưa sẵn sàng trong APK.');
    }

    const result = await nativeAuth.signInWithGoogle({
        useCredentialManager: true,
        skipNativeAuth: false,
    });
    let idToken = result?.credential?.idToken;
    if (!idToken && typeof nativeAuth.getIdToken === 'function') {
        const tokenResult = await nativeAuth.getIdToken({ forceRefresh: false }).catch(() => null);
        idToken = tokenResult?.token || tokenResult?.idToken;
    }
    if (!idToken) throw new Error('Google không trả về idToken cho Firebase.');
    return {
        credential: firebase.auth.GoogleAuthProvider.credential(idToken),
        nativeUser: result.user || null,
    };
}

async function restoreNativeGoogleSessionIfAvailable() {
    if (!isNativeCapacitorApp() || auth.currentUser) return null;
    const nativeAuth = getNativeFirebaseAuthentication();
    if (!nativeAuth?.getCurrentUser || !nativeAuth?.getIdToken) return null;

    try {
        const current = await nativeAuth.getCurrentUser();
        const nativeUser = current?.user || current;
        if (!nativeUser?.uid && !nativeUser?.email) return null;
        const tokenResult = await nativeAuth.getIdToken({ forceRefresh: false });
        const idToken = tokenResult?.token || tokenResult?.idToken;
        if (!idToken) return null;
        const result = await auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(idToken));
        console.log('✅ Khôi phục phiên Google native:', result.user.displayName || result.user.email);
        return result.user;
    } catch (error) {
        console.warn('Không khôi phục được phiên Google native:', error);
        return null;
    }
}

async function signInWithNativeGoogle() {
    const { credential, nativeUser } = await getNativeGoogleCredential();
    const currentUser = auth.currentUser;

    if (currentUser && isPasswordProviderUser(currentUser) && !isGoogleProviderUser(currentUser)) {
        const googleEmail = normalizeAuthEmail(nativeUser?.email);
        if (googleEmail && googleEmail !== normalizeAuthEmail(currentUser.email)) {
            throw new Error('Google vừa chọn không trùng email đang đăng ký.');
        }
        const linkResult = await currentUser.linkWithCredential(credential);
        await linkResult.user.reload();
        showToast('Đã đồng bộ Google với tài khoản email hiện có.', 'success');
        await handleAuthenticatedUser(auth.currentUser || linkResult.user);
        return auth.currentUser || linkResult.user;
    }

    const result = await auth.signInWithCredential(credential);
    console.log('✅ Đăng nhập Google native:', result.user.displayName || result.user.email);
    await handleAuthenticatedUser(auth.currentUser || result.user);
    return result.user;
}

function normalizeAuthEmail(value = '') {
    return String(value || '').trim().toLowerCase();
}

function createGoogleProvider(loginHint = '', options = {}) {
    const provider = new firebase.auth.GoogleAuthProvider();
    const params = {};
    if (loginHint) params.login_hint = loginHint;
    if (options.forceSelectAccount) params.prompt = 'select_account';
    provider.setCustomParameters(params);
    return provider;
}

function getGoogleCredentialFromError(error) {
    if (error?.credential) return error.credential;
    return firebase.auth.GoogleAuthProvider.credentialFromError?.(error) || null;
}

function setGoogleRedirectState(mode, email = '') {
    try {
        sessionStorage.setItem('ting.googleRedirectPending', '1');
        sessionStorage.setItem('ting.googleRedirectMode', mode || 'sign-in');
        sessionStorage.setItem('ting.googleRedirectEmail', email || '');
    } catch {}
}

function getGoogleRedirectState() {
    try {
        return {
            pending: sessionStorage.getItem('ting.googleRedirectPending') === '1',
            mode: sessionStorage.getItem('ting.googleRedirectMode') || 'sign-in',
            email: sessionStorage.getItem('ting.googleRedirectEmail') || '',
        };
    } catch {
        return { pending: false, mode: 'sign-in', email: '' };
    }
}

function clearGoogleRedirectState() {
    try {
        sessionStorage.removeItem('ting.googleRedirectPending');
        sessionStorage.removeItem('ting.googleRedirectMode');
        sessionStorage.removeItem('ting.googleRedirectEmail');
    } catch {}
}

async function startGoogleRedirect(provider, mode = 'sign-in', email = '') {
    setGoogleRedirectState(mode, email);
    await auth.signInWithRedirect(provider);
    return null;
}

async function consumeGoogleRedirectResult() {
    const state = getGoogleRedirectState();
    if (!state.pending || typeof auth?.getRedirectResult !== 'function') return false;

    try {
        const result = await auth.getRedirectResult();
        if (!result?.user) return false;

        clearGoogleRedirectState();
        if (state.mode === 'link-current' && state.email) {
            const googleProfile = result.user.providerData?.find(item => item.providerId === 'google.com');
            if (normalizeAuthEmail(googleProfile?.email) !== normalizeAuthEmail(state.email)) {
                await result.user.unlink('google.com').catch(() => {});
                throw new Error('Google vừa chọn không trùng email đang đăng ký.');
            }
            await result.user.reload();
            showToast('Đã đồng bộ Google với tài khoản email hiện có.', 'success');
        }

        await handleAuthenticatedUser(auth.currentUser || result.user);
        return true;
    } catch (error) {
        clearGoogleRedirectState();
        console.error('❌ Lỗi redirect Google:', error);
        if (error.code === 'auth/account-exists-with-different-credential') {
            await handleGoogleAccountExists(error);
            return true;
        }
        showToast('Lỗi đăng nhập Google: ' + getNativeGoogleConfigErrorMessage(error), 'error');
        return false;
    }
}

function userHasProvider(user, providerId) {
    return Boolean(user?.providerData?.some(provider => provider.providerId === providerId));
}

function isPasswordProviderUser(user) {
    return userHasProvider(user, 'password');
}

function isGoogleProviderUser(user) {
    return userHasProvider(user, 'google.com');
}

function requiresEmailVerification(user) {
    return Boolean(user && isPasswordProviderUser(user) && !isGoogleProviderUser(user) && !user.emailVerified);
}

function switchAuthFormToLogin() {
    if (window.appState) window.appState.authMode = 'login';
    const submit = document.getElementById('btn-email-login');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('auth-toggle-link');
    const title = document.getElementById('auth-card-title');
    const strength = document.getElementById('pw-strength-wrap');
    const confirmGroup = document.getElementById('confirm-pw-group');
    const confirmInput = document.getElementById('auth-confirm-password');
    const passwordInput = document.getElementById('auth-password');
    const googleBtn = document.getElementById('btn-google-login');
    const authDivider = document.querySelector('.d-auth-card .auth-divider, .auth-card .auth-divider');

    if (submit) submit.textContent = 'Đăng nhập';
    if (toggleText) toggleText.textContent = 'Chưa có tài khoản?';
    if (toggleLink) toggleLink.textContent = 'Đăng ký ngay';
    if (title) title.textContent = 'Đăng nhập';
    if (strength) strength.hidden = true;
    if (confirmGroup) confirmGroup.hidden = true;
    if (confirmInput) {
        confirmInput.required = false;
        confirmInput.value = '';
    }
    if (passwordInput) passwordInput.removeAttribute('maxlength');
    if (googleBtn) googleBtn.style.display = '';
    if (authDivider) authDivider.style.display = '';
    if (typeof updatePasswordStrength === 'function') updatePasswordStrength('');
}

function setAuthEmailInput(email = '') {
    const input = document.getElementById('auth-email');
    if (input) input.value = email;
}

function focusAuthPasswordInput() {
    setTimeout(() => document.getElementById('auth-password')?.focus(), 50);
}

function clearAuthNotice() {
    const notice = document.getElementById('auth-notice');
    if (!notice) return;
    notice.hidden = true;
    notice.className = 'auth-notice';
    const actions = document.getElementById('auth-notice-actions');
    if (actions) actions.textContent = '';
}

function addAuthNoticeButton(actions, label, handler, extraClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn btn-sm ${extraClass || 'btn-outline'}`;
    button.textContent = label;
    button.addEventListener('click', handler);
    actions.appendChild(button);
}

function showAuthNotice(type, title, message, options = {}) {
    const notice = document.getElementById('auth-notice');
    if (!notice) return;
    const titleEl = document.getElementById('auth-notice-title');
    const messageEl = document.getElementById('auth-notice-message');
    const actions = document.getElementById('auth-notice-actions');

    notice.hidden = false;
    notice.className = `auth-notice auth-notice-${type || 'info'}`;
    if (titleEl) titleEl.textContent = title || '';
    if (messageEl) messageEl.textContent = message || '';
    if (actions) {
        actions.textContent = '';
        if (options.resend) addAuthNoticeButton(actions, 'Gửi lại link', resendEmailVerification);
        if (options.check) addAuthNoticeButton(actions, 'Tôi đã xác minh', checkEmailVerificationAndContinue, 'btn-primary');
    }
}

function showVerificationRequiredNotice(user, sent = false) {
    const email = user?.email || document.getElementById('auth-email')?.value || '';
    showAuthNotice(
        'warning',
        'Cần xác minh email',
        sent
            ? `Đã gửi link xác minh tới ${email}. Xác minh xong bấm "Tôi đã xác minh" để vào app.`
            : `Email ${email} chưa được xác minh. Kiểm tra hộp thư hoặc gửi lại link xác minh.`,
        { resend: true, check: true }
    );
}

function showCloudPermissionToast() {
    if (window.appState) window.appState.cloudPermissionDenied = true;
    if (typeof showToast === 'function') {
        showToast('Đăng nhập OK, nhưng Firestore chưa cấp quyền dữ liệu Cloud', 'error');
    }
}

// ===== ĐĂNG NHẬP GOOGLE =====
async function signInWithGoogle() {
    try {
        await requireFirebaseReady();
        clearAuthNotice();
        if (isNativeCapacitorApp()) {
            return await signInWithNativeGoogle();
        }
        const provider = createGoogleProvider(auth.currentUser?.email || '');
        const currentUser = auth.currentUser;
        if (currentUser && isPasswordProviderUser(currentUser) && !isGoogleProviderUser(currentUser)) {
            if (isMobileBrowserAuthFlow()) {
                return await startGoogleRedirect(provider, 'link-current', currentUser.email || '');
            }
            const linkResult = await withAuthTimeout(
                currentUser.linkWithPopup(provider),
                'Không mở được Google trong cửa sổ đăng nhập.'
            );
            const googleProfile = linkResult.user.providerData.find(item => item.providerId === 'google.com');
            if (normalizeAuthEmail(googleProfile?.email) !== normalizeAuthEmail(currentUser.email)) {
                await linkResult.user.unlink('google.com').catch(() => {});
                throw new Error('Google vừa chọn không trùng email đang đăng ký.');
            }
            await linkResult.user.reload();
            showToast('Đã đồng bộ Google với tài khoản email hiện có.', 'success');
            await handleAuthenticatedUser(auth.currentUser || linkResult.user);
            return auth.currentUser || linkResult.user;
        }
        if (isMobileBrowserAuthFlow()) {
            console.log('Đang chuyển sang Google bằng redirect trên mobile...');
            return await startGoogleRedirect(provider, 'sign-in');
        }
        console.log('⏳ Đang mở popup Google...');
        const result = await withAuthTimeout(
            auth.signInWithPopup(provider),
            'Không mở được Google trong cửa sổ đăng nhập.'
        );
        console.log('✅ Đăng nhập Google:', result.user.displayName);
        await handleAuthenticatedUser(auth.currentUser || result.user);
        return result.user;
    } catch (error) {
        console.error('❌ Lỗi đăng nhập Google:', error);
        if (error.code === 'auth/account-exists-with-different-credential') {
            return handleGoogleAccountExists(error);
        }
        const messages = {
            'auth/popup-closed-by-user': 'Đã huỷ đăng nhập Google',
            'auth/popup-blocked': 'Popup đăng nhập bị chặn',
            'auth/cancelled-popup-request': 'Đã có một popup đăng nhập khác đang mở',
            'auth/unauthorized-domain': 'Firebase chưa cho phép domain test này',
            'auth/operation-timeout': 'Google không phản hồi. Vui lòng thử lại hoặc dùng Email/Mật khẩu',
        };
        showToast(messages[error.code] || 'Lỗi đăng nhập Google: ' + getNativeGoogleConfigErrorMessage(error), 'error');
        return null;
    }
}

// ===== ĐỒNG BỘ GOOGLE VỚI EMAIL/PASSWORD =====
async function handleGoogleAccountExists(error) {
    const email = normalizeAuthEmail(error.email);
    const credential = getGoogleCredentialFromError(error);
    if (!email || !credential) {
        showToast('Không thể đồng bộ Google với email này. Vui lòng thử lại.', 'error');
        return null;
    }

    const currentUser = auth.currentUser;
    if (currentUser && normalizeAuthEmail(currentUser.email) === email && isPasswordProviderUser(currentUser)) {
        try {
            const linkResult = await currentUser.linkWithCredential(credential);
            pendingGoogleLinkCredential = null;
            pendingGoogleLinkEmail = '';
            await linkResult.user.reload();
            clearAuthNotice();
            showToast('Đã đồng bộ Google với tài khoản email hiện có.', 'success');
            await handleAuthenticatedUser(auth.currentUser || linkResult.user);
            return auth.currentUser || linkResult.user;
        } catch (linkError) {
            console.error('Google link error:', linkError);
        }
    }

    pendingGoogleLinkCredential = credential;
    pendingGoogleLinkEmail = email;
    switchAuthFormToLogin();
    setAuthEmailInput(email);
    const passwordInput = document.getElementById('auth-password');
    if (passwordInput) passwordInput.value = '';
    showAuthNotice(
        'info',
        'Đồng bộ Google với email',
        'Email này đã đăng ký bằng mật khẩu. Nhập mật khẩu rồi bấm Đăng nhập để nối Google vào cùng tài khoản và dùng chung dữ liệu.'
    );
    focusAuthPasswordInput();
    return null;
}

async function linkPendingGoogleCredentialIfNeeded(user, email) {
    if (!pendingGoogleLinkCredential) return user;
    if (normalizeAuthEmail(email) !== pendingGoogleLinkEmail) {
        showAuthNotice(
            'error',
            'Sai email đồng bộ',
            'Vui lòng đăng nhập đúng email đang chờ đồng bộ Google.'
        );
        return user;
    }

    try {
        const linkResult = await user.linkWithCredential(pendingGoogleLinkCredential);
        pendingGoogleLinkCredential = null;
        pendingGoogleLinkEmail = '';
        await linkResult.user.reload();
        clearAuthNotice();
        showToast('Đã đồng bộ Google với tài khoản email. Dữ liệu sẽ dùng chung.', 'success');
        await handleAuthenticatedUser(auth.currentUser || linkResult.user);
        return auth.currentUser || linkResult.user;
    } catch (error) {
        console.error('Pending Google link error:', error);
        showToast('Đăng nhập email thành công nhưng chưa đồng bộ được Google: ' + error.message, 'error');
        return user;
    }
}

// ===== ĐĂNG NHẬP EMAIL =====
async function signInWithEmail(email, password) {
    try {
        await requireFirebaseReady();
        if (!pendingGoogleLinkCredential) clearAuthNotice();
        const result = await auth.signInWithEmailAndPassword(email, password);
        console.log('✅ Đăng nhập Email:', result.user.email);
        return linkPendingGoogleCredentialIfNeeded(result.user, email);
    } catch (error) {
        console.error('❌ Lỗi đăng nhập Email:', error);
        const messages = {
            'auth/user-not-found': 'Email chưa được đăng ký',
            'auth/wrong-password': 'Mật khẩu không đúng',
            'auth/invalid-email': 'Email không hợp lệ',
            'auth/too-many-requests': 'Quá nhiều lần thử. Vui lòng đợi',
            'auth/invalid-credential': 'Email hoặc mật khẩu không đúng',
        };
        showToast(messages[error.code] || 'Lỗi đăng nhập: ' + error.message, 'error');
        return null;
    }
}

// ===== ĐĂNG KÝ EMAIL =====
async function registerWithEmail(email, password) {
    try {
        await requireFirebaseReady();
        clearAuthNotice();
        const result = await auth.createUserWithEmailAndPassword(email, password);
        console.log('✅ Đăng ký thành công:', result.user.email);
        let verificationSent = false;
        try {
            await sendVerificationEmail(result.user, true);
            verificationSent = true;
        } catch (verificationError) {
            console.error('Email verification send error:', verificationError);
            showToast('Đã tạo tài khoản nhưng chưa gửi được link xác minh: ' + verificationError.message, 'error');
        }
        switchAuthFormToLogin();
        setAuthEmailInput(result.user.email || email);
        const passwordInput = document.getElementById('auth-password');
        if (passwordInput) passwordInput.value = '';
        showVerificationRequiredNotice(result.user, verificationSent);
        if (verificationSent) showToast('Đã tạo tài khoản và gửi link xác minh email.', 'success');
        return result.user;
    } catch (error) {
        console.error('❌ Lỗi đăng ký:', error);
        if (error.code === 'auth/email-already-in-use') {
            const linkedUser = await linkEmailPasswordToExistingGoogle(email, password);
            if (linkedUser) return linkedUser;
        }
        const messages = {
            'auth/email-already-in-use': 'Email đã được đăng ký',
            'auth/weak-password': 'Mật khẩu phải ít nhất 6 ký tự',
            'auth/invalid-email': 'Email không hợp lệ',
        };
        showToast(messages[error.code] || 'Lỗi đăng ký: ' + error.message, 'error');
        return null;
    }
}

async function linkEmailPasswordToExistingGoogle(email, password) {
    try {
        if (isNativeCapacitorApp()) {
            showAuthNotice(
                'info',
                'Email đã có Google',
                'Chọn đúng tài khoản Google để thêm đăng nhập bằng mật khẩu vào cùng dữ liệu.'
            );
            const { credential, nativeUser } = await getNativeGoogleCredential();
            if (normalizeAuthEmail(nativeUser?.email) !== normalizeAuthEmail(email)) {
                await auth.signOut().catch(() => {});
                showAuthNotice('error', 'Sai tài khoản Google', 'Google vừa chọn không trùng email đăng ký.');
                showToast('Vui lòng chọn đúng Google cùng email.', 'error');
                return null;
            }
            const googleResult = await auth.signInWithCredential(credential);
            const emailCredential = firebase.auth.EmailAuthProvider.credential(email, password);
            await googleResult.user.linkWithCredential(emailCredential);
            await googleResult.user.reload();
            clearAuthNotice();
            showToast('Đã đồng bộ đăng nhập email với Google. Dữ liệu dùng chung một tài khoản.', 'success');
            await handleAuthenticatedUser(auth.currentUser || googleResult.user);
            return auth.currentUser || googleResult.user;
        }
        const methods = await auth.fetchSignInMethodsForEmail(email).catch(() => []);
        if (!methods.includes('google.com') || methods.includes('password')) return null;

        showAuthNotice(
            'info',
            'Email đã có Google',
            'Chọn đúng tài khoản Google để thêm đăng nhập bằng mật khẩu vào cùng dữ liệu.'
        );
        if (isMobileBrowserAuthFlow()) {
            return startGoogleRedirect(createGoogleProvider(email), 'sign-in', email);
        }
        const result = await withAuthTimeout(
            auth.signInWithPopup(createGoogleProvider(email)),
            'Không mở được Google trong cửa sổ đăng nhập.'
        );
        if (normalizeAuthEmail(result.user.email) !== normalizeAuthEmail(email)) {
            await auth.signOut().catch(() => {});
            showAuthNotice('error', 'Sai tài khoản Google', 'Google vừa chọn không trùng email đăng ký.');
            showToast('Vui lòng chọn đúng Google cùng email.', 'error');
            return null;
        }

        const credential = firebase.auth.EmailAuthProvider.credential(email, password);
        await result.user.linkWithCredential(credential);
        await result.user.reload();
        clearAuthNotice();
        showToast('Đã đồng bộ đăng nhập email với Google. Dữ liệu dùng chung một tài khoản.', 'success');
        await handleAuthenticatedUser(auth.currentUser || result.user);
        return auth.currentUser || result.user;
    } catch (linkError) {
        console.error('Email/Google link error:', linkError);
        showToast('Không đồng bộ được email với Google: ' + linkError.message, 'error');
        return null;
    }
}

async function sendVerificationEmail(user, silent = false) {
    await user.sendEmailVerification();
    if (!silent) showToast('Đã gửi lại email xác minh', 'success');
}

async function requireFreshSensitiveActionAuth(actionLabel = 'thao tác này') {
    await requireFirebaseReady();
    const user = auth.currentUser;
    if (!user) {
        showToast('Bạn cần đăng nhập lại để tiếp tục', 'error');
        return false;
    }

    await user.reload().catch(error => {
        console.warn('Không thể làm mới trạng thái tài khoản:', error);
    });

    const currentUser = auth.currentUser || user;
    if (!currentUser.emailVerified) {
        try {
            await currentUser.sendEmailVerification({
                url: window.location.href,
                handleCodeInApp: false,
            });
            showToast('Đã gửi mail xác minh. Xác minh xong rồi bấm lại.', 'success');
        } catch (error) {
            console.error('Không gửi được mail xác minh:', error);
            showToast(error.message || 'Không gửi được mail xác minh', 'error');
        }
        return false;
    }

    try {
        if (isGoogleProviderUser(currentUser)) {
            const email = currentUser.email || '';
            if (isNativeCapacitorApp()) {
                const { credential, nativeUser } = await getNativeGoogleCredential();
                const selectedEmail = normalizeAuthEmail(nativeUser?.email || email);
                if (email && selectedEmail && selectedEmail !== normalizeAuthEmail(email)) {
                    throw new Error('Google vừa chọn không trùng email đang đăng nhập.');
                }
                await currentUser.reauthenticateWithCredential(credential);
            } else if (isMobileBrowserAuthFlow() && typeof currentUser.reauthenticateWithRedirect === 'function') {
                showToast('Xác thực Google xong hãy bấm lại thao tác này.', 'success');
                await currentUser.reauthenticateWithRedirect(createGoogleProvider(email, { forceSelectAccount: true }));
                return false;
            } else {
                await withAuthTimeout(
                    currentUser.reauthenticateWithPopup(createGoogleProvider(email, { forceSelectAccount: true })),
                    'Không mở được Google để xác thực lại.'
                );
            }
            await (auth.currentUser || currentUser).reload().catch(() => {});
            showToast(`Đã xác thực lại trước khi ${actionLabel}`, 'success');
            return true;
        }

        if (isPasswordProviderUser(currentUser)) {
            const password = window.prompt(`Nhập mật khẩu đăng nhập của ${currentUser.email || 'tài khoản'} để ${actionLabel}:`);
            if (!password) {
                showToast('Đã huỷ xác thực', 'error');
                return false;
            }
            const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
            await currentUser.reauthenticateWithCredential(credential);
            showToast(`Đã xác thực lại trước khi ${actionLabel}`, 'success');
            return true;
        }

        showToast('Tài khoản này chưa có phương thức xác thực lại phù hợp', 'error');
        return false;
    } catch (error) {
        console.error('Không xác thực lại được tài khoản:', error);
        const messages = {
            'auth/popup-closed-by-user': 'Đã huỷ xác thực Google',
            'auth/cancelled-popup-request': 'Đã huỷ xác thực Google',
            'auth/wrong-password': 'Mật khẩu đăng nhập không đúng',
            'auth/invalid-credential': 'Thông tin xác thực không đúng',
            'auth/user-mismatch': 'Tài khoản xác thực không trùng tài khoản đang đăng nhập',
        };
        showToast(messages[error.code] || error.message || 'Không xác thực lại được tài khoản', 'error');
        return false;
    }
}

// ===== QUÊN MẬT KHẨU ĐĂNG NHẬP =====
async function sendPasswordReset(email) {
    try {
        await requireFirebaseReady();
        await auth.sendPasswordResetEmail(email);
        showToast('Đã gửi email đặt lại mật khẩu!', 'success');
        return true;
    } catch (error) {
        console.error('❌ Lỗi gửi reset email:', error);
        const messages = {
            'auth/user-not-found': 'Email chưa được đăng ký',
            'auth/invalid-email': 'Email không hợp lệ',
        };
        showToast(messages[error.code] || 'Lỗi: ' + error.message, 'error');
        return false;
    }
}

// ===== ĐỔI MẬT KHẨU ĐĂNG NHẬP =====
async function changeLoginPassword(currentPassword, newPassword) {
    try {
        await requireFirebaseReady();
        const user = auth.currentUser;
        if (!user || !user.email) throw new Error('Chưa đăng nhập');
        // Re-authenticate trước khi đổi
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(newPassword);
        showToast('Đã đổi mật khẩu đăng nhập!', 'success');
        return true;
    } catch (error) {
        console.error('❌ Lỗi đổi mật khẩu:', error);
        if (error.code === 'auth/wrong-password') {
            showToast('Mật khẩu hiện tại không đúng', 'error');
        } else {
            showToast('Lỗi: ' + error.message, 'error');
        }
        return false;
    }
}

// ===== ĐĂNG XUẤT =====
async function signOut() {
    try {
        if (!confirm('Bạn chắc chắn muốn đăng xuất khỏi Ting!?')) return;
        await stopBackgroundNotificationCheck?.();
        if (window.appState?.isDemo) {
            stopAccountsRealtime?.();
            window.appState.isDemo = false;
            window.appState.isLoggedIn = false;
            window.appState.masterUnlocked = false;
            window.appState.masterPassword = null;
            window.appState.activeDecryptedAccount = null;
            window.appState.accounts = [];
            window.appState.trashAccounts = [];
            window.appState.customCategories = [];
            if (typeof clearRevealedSecrets === 'function') clearRevealedSecrets();
            updateEmailVerificationBanner(null);
            showAuthScreen();
            return;
        }

        await requireFirebaseReady();
        if (isNativeCapacitorApp()) {
            await getNativeFirebaseAuthentication()?.signOut?.().catch(error => {
                console.warn('Không đăng xuất được native Google:', error);
            });
        }
        await auth.signOut();
        writeAuthLocalSetting(AUTH_SESSION_META_KEY, null);
        // Reset state
        stopAccountsRealtime?.();
        window.appState.isLoggedIn = false;
        window.appState.masterUnlocked = false;
        window.appState.masterPassword = null;
        window.appState.activeDecryptedAccount = null;
        window.appState.accounts = [];
        window.appState.trashAccounts = [];
        window.appState.customCategories = [];
        if (typeof clearRevealedSecrets === 'function') clearRevealedSecrets();
        updateEmailVerificationBanner(null);
        showAuthScreen();
    } catch (error) {
        console.error('❌ Lỗi đăng xuất:', error);
    }
}

// ===== TẠO SETTINGS MẶC ĐỊNH =====
async function initUserSettings(userId) {
    await requireFirebaseReady();
    try {
        const settingsRef = db.collection('users').doc(userId).collection('settings').doc('general');
        const doc = await settingsRef.get();
        if (!doc.exists) {
            await settingsRef.set({
                defaultNotifyDays: [5, 3, 1],
                notificationSettings: {
                    enabled: true,
                    nativeEnabled: true,
                    inAppEnabled: true,
                    daysBefore: [5, 3, 1],
                    repeatHours: 24,
                    overdueDays: 3,
                },
                defaultRenewalDays: 30,
                language: 'vi',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
        }
        return true;
    } catch (error) {
        console.error('❌ Lỗi khởi tạo settings:', error);
        if (isFirestorePermissionError(error)) {
            showCloudPermissionToast();
            return false;
        }
        throw error;
    }
}

// ===== LẮNG NGHE TRẠNG THÁI AUTH =====
async function setupAuthListener() {
    configureNativeAuthUi();
    updateSplashStatus('Đang kết nối Firebase...');
    try {
        await requireFirebaseReady();
    } catch (error) {
        console.error('❌ Không thể tải Firebase:', error);
        updateSplashStatus('Lỗi kết nối — thử chế độ Demo');
        if (typeof showToast === 'function') {
            showToast('Không tải được Firebase. Bạn vẫn có thể dùng chế độ Demo.', 'error');
        }
        hideSplash();
        return;
    }

    updateSplashStatus('Đang kiểm tra đăng nhập...');
    await consumeGoogleRedirectResult();
    let nativeRestoreTried = false;

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            await handleAuthenticatedUser(user);
            return;
        } else {
            if (!nativeRestoreTried && isNativeCapacitorApp()) {
                nativeRestoreTried = true;
                const restored = await restoreNativeGoogleSessionIfAvailable();
                if (restored) {
                    await handleAuthenticatedUser(auth.currentUser || restored);
                    return;
                }
            }
            handleSignedOutUser();
            return;
        }
    });
}

function resetAppSessionState() {
    stopAccountsRealtime?.();
    if (!window.appState) return;
    window.appState.isLoggedIn = false;
    window.appState.masterUnlocked = false;
    window.appState.masterPassword = null;
    window.appState.activeDecryptedAccount = null;
    window.appState.accounts = [];
    window.appState.trashAccounts = [];
    window.appState.customCategories = [];
    if (typeof clearRevealedSecrets === 'function') clearRevealedSecrets();
}

async function handleAuthenticatedUser(user) {
    try {
        await user.reload();
        user = auth.currentUser || user;
    } catch (error) {
        console.warn('Không reload được trạng thái xác minh email:', error);
    }

    if (isStoredAuthSessionExpired(user)) {
        await getNativeFirebaseAuthentication()?.signOut?.().catch(() => {});
        await auth.signOut().catch(() => {});
        handleSignedOutUser();
        showToast('Phiên đăng nhập 30 ngày đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        return;
    }
    updateStoredAuthSession(user);

    if (requiresEmailVerification(user)) {
        handleUnverifiedEmailUser(user);
        return;
    }

    await user.getIdToken(true).catch(error => {
        console.warn('Không làm mới được token xác minh email:', error);
    });
    clearAuthNotice();
    updateSplashStatus(`Xin chào, ${user.displayName || user.email}!`);
    window.appState.isLoggedIn = true;
    window.appState.masterUnlocked = false;
    window.appState.masterPassword = null;
    window.appState.activeDecryptedAccount = null;
    if (typeof clearRevealedSecrets === 'function') clearRevealedSecrets();
    window.appState.user = {
        uid: user.uid,
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        avatar: user.photoURL,
    };
    showAppShell();
    updateEmailVerificationBanner(user);
    updateHeader();
    navigateTo('dashboard');
    hideSplash();
    try {
        const cloudReady = await initUserSettings(user.uid);
        if (cloudReady) {
            await loadCloudUserSettings?.();
            await loadUserCategories?.();
            loadAccountsRealtime();
            await startBackgroundNotificationCheck?.();
        }
    } catch (error) {
        console.error('Lỗi sau đăng nhập:', error);
        if (isFirestorePermissionError(error)) showCloudPermissionToast();
    }
}

function handleUnverifiedEmailUser(user) {
    resetAppSessionState();
    switchAuthFormToLogin();
    setAuthEmailInput(user.email || '');
    window.appState.user = {
        uid: null,
        name: user.email?.split('@')[0] || 'Người dùng',
        email: user.email || '',
        avatar: null,
    };
    updateEmailVerificationBanner(null);
    showAuthScreen();
    showVerificationRequiredNotice(user);
    hideSplash();
}

function handleSignedOutUser() {
    stopBackgroundNotificationCheck?.();
    resetAppSessionState();
    pendingGoogleLinkCredential = null;
    pendingGoogleLinkEmail = '';
    updateEmailVerificationBanner(null);
    showAuthScreen();
    hideSplash();
}

function updateEmailVerificationBanner(user) {
    const banner = document.getElementById('email-verify-banner');
    if (!banner) return;
    const shouldShow = requiresEmailVerification(user);
    banner.style.display = shouldShow ? 'flex' : 'none';
}

async function resendEmailVerification() {
    try {
        await requireFirebaseReady();
        const user = auth.currentUser;
        if (!user) throw new Error('Chưa đăng nhập');
        await sendVerificationEmail(user);
        showVerificationRequiredNotice(user, true);
    } catch (error) {
        console.error('❌ Lỗi gửi email xác minh:', error);
        showToast(error.message || 'Không gửi được email xác minh', 'error');
    }
}

async function checkEmailVerificationAndContinue() {
    try {
        await requireFirebaseReady();
        const user = auth.currentUser;
        if (!user) throw new Error('Chưa đăng nhập');
        await user.reload();
        const refreshedUser = auth.currentUser || user;
        if (requiresEmailVerification(refreshedUser)) {
            showVerificationRequiredNotice(refreshedUser);
            showToast('Email vẫn chưa được xác minh.', 'error');
            return false;
        }
        clearAuthNotice();
        showToast('Email đã xác minh. Đang mở Ting!.', 'success');
        await handleAuthenticatedUser(refreshedUser);
        return true;
    } catch (error) {
        console.error('Lỗi kiểm tra xác minh email:', error);
        showToast(error.message || 'Không kiểm tra được trạng thái xác minh', 'error');
        return false;
    }
}

// ===== UI HELPERS =====
function showAuthScreen() {
    configureNativeAuthUi();
    const authEl = document.getElementById('auth-screen');
    const appEl = document.getElementById('app-shell');
    authEl.classList.add('active');
    appEl.classList.remove('active');
    // Hiện content với fade-in (splash đang che ở trên)
    authEl.classList.add('ready');
    appEl.classList.remove('ready');
}

function showAppShell() {
    const authEl = document.getElementById('auth-screen');
    const appEl = document.getElementById('app-shell');
    authEl.classList.remove('active');
    appEl.classList.add('active');
    // Hiện content với fade-in
    appEl.classList.add('ready');
    authEl.classList.remove('ready');
}
