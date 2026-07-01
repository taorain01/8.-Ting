/* MyPlugin — Firebase Configuration
   Dùng cùng project Firebase với Ting! */

const firebaseConfig = {
    apiKey: "AIzaSyCkPSEna_fZYTlcPM2LvsVEhR8n7boDjSQ",
    authDomain: "ting-d2c78.firebaseapp.com",
    projectId: "ting-d2c78",
    storageBucket: "ting-d2c78.firebasestorage.app",
    messagingSenderId: "166508794253",
    appId: "1:166508794253:web:830427d2f29618a497adc4"
};

let auth = null;
let db = null;

function loadFirebaseScript(src) {
    return new Promise((resolve, reject) => {
        if (src.includes('firebase-app-compat') && window.firebase?.initializeApp) { resolve(); return; }
        if (src.includes('firebase-auth-compat') && window.firebase?.auth) { resolve(); return; }
        if (src.includes('firebase-firestore-compat') && window.firebase?.firestore) { resolve(); return; }
        const script = document.createElement('script');
        script.src = src; script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Không tải được ${src}`));
        document.head.appendChild(script);
    });
}

async function initFirebase() {
    updateSplashStatus('Đang tải Firebase...');
    await loadFirebaseScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    updateSplashStatus('Đang tải Auth...');
    await loadFirebaseScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js');
    updateSplashStatus('Đang tải Firestore...');
    await loadFirebaseScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js');

    if (!firebase.apps?.length) firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();

    db.enablePersistence({ synchronizeTabs: true }).catch(err => console.warn('Offline persistence:', err.code));
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

    console.log('Firebase MyPlugin — project: ting-d2c78');
    return { auth, db, firebase };
}

window.firebaseReady = initFirebase().catch(error => {
    console.error('Firebase init error:', error);
    throw error;
});

function waitForFirebase() { return window.firebaseReady; }
function updateSplashStatus(msg) {
    const el = document.getElementById('splash-status');
    if (el) el.textContent = msg;
}
