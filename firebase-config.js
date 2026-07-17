/* Ting! — Firebase Configuration
   Load Firebase CDN after the static UI can paint. */

// Firebase config từ console
const firebaseConfig = {
    apiKey: "AIzaSyCkPSEna_fZYTlcPM2LvsVEhR8n7boDjSQ",
    authDomain: "ting-d2c78.firebaseapp.com",
    projectId: "ting-d2c78",
    storageBucket: "ting-d2c78.firebasestorage.app",
    messagingSenderId: "166508794253",
    appId: "1:166508794253:web:830427d2f29618a497adc4",
    measurementId: "G-XSR0BP3M40"
};

let auth = null;
let db = null;

function loadFirebaseScript(src) {
    return new Promise((resolve, reject) => {
        if (src.includes('firebase-app-compat') && window.firebase?.initializeApp) {
            resolve();
            return;
        }
        if (src.includes('firebase-auth-compat') && window.firebase?.auth) {
            resolve();
            return;
        }
        if (src.includes('firebase-firestore-compat') && window.firebase?.firestore) {
            resolve();
            return;
        }

        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing?.dataset.loaded === 'true') {
            resolve();
            return;
        }
        const script = existing || document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            script.dataset.loaded = 'true';
            resolve();
        };
        script.onerror = () => reject(new Error(`Không tải được ${src}`));
        if (!existing) document.head.appendChild(script);
    });
}

async function initFirebase() {
    // Nạp SDK local trước (nhanh + chạy offline), fallback CDN nếu thiếu file.
    const V = '10.12.0';
    const localBase = 'js/vendor/firebase';
    const cdnBase = `https://www.gstatic.com/firebasejs/${V}`;

    async function loadModule(fileName, statusText) {
        if (typeof updateSplashStatus === 'function') updateSplashStatus(statusText);
        try {
            await loadFirebaseScript(`${localBase}/${fileName}`);
        } catch (localError) {
            console.warn(`⚠️ Không nạp được ${fileName} từ local, thử CDN:`, localError?.message || localError);
            await loadFirebaseScript(`${cdnBase}/${fileName}`);
        }
    }

    await loadModule('firebase-app-compat.js', 'Đang tải Firebase...');
    await loadModule('firebase-auth-compat.js', 'Đang tải Auth...');
    await loadModule('firebase-firestore-compat.js', 'Đang tải Firestore...');

    if (!firebase.apps?.length) {
        firebase.initializeApp(firebaseConfig);
    }

    auth = firebase.auth();
    db = firebase.firestore();
    // Shared feature modules use window-scoped clients after firebaseReady resolves.
    window.auth = auth;
    window.db = db;

    // Bật offline persistence cho Firestore
    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
        console.warn('Firestore offline persistence không khả dụng:', err.code);
    });

    // Persistent login — giữ đăng nhập khi đóng tab
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch (error) {
        console.warn('Không thiết lập được persistent login:', error);
    }

    console.log('✅ Firebase đã khởi tạo — project: ting-d2c78');
    return { auth, db, firebase };
}

window.firebaseReady = initFirebase().catch(error => {
    console.error('❌ Lỗi khởi tạo Firebase:', error);
    throw error;
});

function waitForFirebase() {
    return window.firebaseReady;
}
