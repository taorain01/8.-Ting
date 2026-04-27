/* Ting! — Authentication Module
   Firebase Auth: Google Sign-In, Email/Password, Đăng ký, Reset Password */

// ===== ĐĂNG NHẬP GOOGLE =====
async function signInWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        console.log('✅ Đăng nhập Google:', result.user.displayName);
        return result.user;
    } catch (error) {
        console.error('❌ Lỗi đăng nhập Google:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showToast('Đã huỷ đăng nhập', 'error');
        } else {
            showToast('Lỗi đăng nhập Google: ' + error.message, 'error');
        }
        return null;
    }
}

// ===== ĐĂNG NHẬP EMAIL =====
async function signInWithEmail(email, password) {
    try {
        const result = await auth.signInWithEmailAndPassword(email, password);
        console.log('✅ Đăng nhập Email:', result.user.email);
        return result.user;
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
        const result = await auth.createUserWithEmailAndPassword(email, password);
        console.log('✅ Đăng ký thành công:', result.user.email);
        await result.user.sendEmailVerification();
        // Tạo settings mặc định trong Firestore
        await initUserSettings(result.user.uid);
        showToast('Đăng ký thành công! Kiểm tra email để xác minh tài khoản.', 'success');
        return result.user;
    } catch (error) {
        console.error('❌ Lỗi đăng ký:', error);
        const messages = {
            'auth/email-already-in-use': 'Email đã được đăng ký',
            'auth/weak-password': 'Mật khẩu phải ít nhất 6 ký tự',
            'auth/invalid-email': 'Email không hợp lệ',
        };
        showToast(messages[error.code] || 'Lỗi đăng ký: ' + error.message, 'error');
        return null;
    }
}

// ===== QUÊN MẬT KHẨU ĐĂNG NHẬP =====
async function sendPasswordReset(email) {
    try {
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
        await auth.signOut();
        // Reset state
        stopAccountsRealtime?.();
        window.appState.isLoggedIn = false;
        window.appState.masterUnlocked = false;
        window.appState.masterPassword = null;
        window.appState.activeDecryptedAccount = null;
        window.appState.accounts = [];
        if (typeof clearRevealedSecrets === 'function') clearRevealedSecrets();
        updateEmailVerificationBanner(null);
        showAuthScreen();
    } catch (error) {
        console.error('❌ Lỗi đăng xuất:', error);
    }
}

// ===== TẠO SETTINGS MẶC ĐỊNH =====
async function initUserSettings(userId) {
    const settingsRef = db.collection('users').doc(userId).collection('settings').doc('general');
    const doc = await settingsRef.get();
    if (!doc.exists) {
        await settingsRef.set({
            defaultNotifyDays: [5, 3, 1],
            defaultRenewalDays: 30,
            language: 'vi',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    }
}

// ===== LẮNG NGHE TRẠNG THÁI AUTH =====
function setupAuthListener() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Đã đăng nhập
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
            await initUserSettings(user.uid);
            showAppShell();
            updateEmailVerificationBanner(user);
            updateHeader();
            // Load dữ liệu từ Firestore
            loadAccountsRealtime();
            navigateTo('dashboard');
        } else {
            // Chưa đăng nhập
            stopAccountsRealtime?.();
            window.appState.isLoggedIn = false;
            window.appState.masterUnlocked = false;
            window.appState.masterPassword = null;
            window.appState.activeDecryptedAccount = null;
            window.appState.accounts = [];
            if (typeof clearRevealedSecrets === 'function') clearRevealedSecrets();
            updateEmailVerificationBanner(null);
            showAuthScreen();
        }
    });
}

function isPasswordProviderUser(user) {
    return Boolean(user?.providerData?.some(provider => provider.providerId === 'password'));
}

function updateEmailVerificationBanner(user) {
    const banner = document.getElementById('email-verify-banner');
    if (!banner) return;
    const shouldShow = Boolean(user && isPasswordProviderUser(user) && !user.emailVerified);
    banner.style.display = shouldShow ? 'flex' : 'none';
}

async function resendEmailVerification() {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Chưa đăng nhập');
        await user.sendEmailVerification();
        showToast('Đã gửi lại email xác minh', 'success');
    } catch (error) {
        console.error('❌ Lỗi gửi email xác minh:', error);
        showToast(error.message || 'Không gửi được email xác minh', 'error');
    }
}

// ===== UI HELPERS =====
function showAuthScreen() {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('app-shell').classList.remove('active');
}

function showAppShell() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-shell').classList.add('active');
}
