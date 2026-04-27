/* Ting! — Firebase Configuration
   Dùng Firebase CDN (compat) cho vanilla JS, không cần bundler */

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

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);

// Khởi tạo các service
const auth = firebase.auth();
const db = firebase.firestore();

// Bật offline persistence cho Firestore
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    console.warn('Firestore offline persistence không khả dụng:', err.code);
});

// Persistent login — giữ đăng nhập khi đóng tab
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

console.log('✅ Firebase đã khởi tạo — project: ting-d2c78');
