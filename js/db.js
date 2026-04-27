/* Ting! — Database Module
   Firestore CRUD + Realtime Sync */

let accountsUnsubscribe = null;

function stripSensitiveAccountFields(data = {}) {
    const { username, password, twoFaCode, note, rawInput, ...safeData } = data;
    return safeData;
}

// ===== LOAD ACCOUNTS (Realtime) =====
function loadAccountsRealtime() {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    if (typeof accountsUnsubscribe === 'function') accountsUnsubscribe();

    accountsUnsubscribe = db.collection('users').doc(userId).collection('accounts')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            const accounts = [];
            snapshot.forEach(doc => {
                const data = stripSensitiveAccountFields(doc.data());
                accounts.push({
                    id: doc.id,
                    ...data,
                    // Cập nhật status dựa trên ngày thực
                    status: getStatusFromExpiry(data.expiryDate, data.expiryType),
                    // Convert Firestore Timestamp
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                    updatedAt: data.updatedAt?.toDate?.() || new Date(),
                });
            });
            window.appState.accounts = accounts;
            updateHeader();
            const notificationDropdown = document.getElementById('notification-dropdown');
            if (notificationDropdown && !notificationDropdown.hidden && typeof renderNotificationPanel === 'function') {
                renderNotificationPanel();
            }
            // Re-render trang hiện tại
            const page = window.appState.currentPage;
            if (page === 'dashboard') renderDashboard();
            else if (page === 'bought') renderAccountList('bought');
            else if (page === 'personal' && window.appState.masterUnlocked) renderAccountList('personal');
        }, (error) => {
            console.error('❌ Lỗi load accounts:', error);
        });
}

function stopAccountsRealtime() {
    if (typeof accountsUnsubscribe === 'function') {
        accountsUnsubscribe();
        accountsUnsubscribe = null;
    }
}

// ===== THÊM TÀI KHOẢN =====
async function addAccountToDB(accountData) {
    const userId = auth.currentUser?.uid;
    if (!userId) { showToast('Chưa đăng nhập', 'error'); return null; }

    try {
        const safeData = stripSensitiveAccountFields(accountData);
        if (!safeData.encryptedData || !safeData.salt || !safeData.iv) {
            throw new Error('Tài khoản chưa được mã hoá');
        }

        const docRef = await db.collection('users').doc(userId).collection('accounts').add({
            ...safeData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        console.log('✅ Đã thêm tài khoản:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('❌ Lỗi thêm TK:', error);
        showToast(error.message || 'Lỗi lưu tài khoản', 'error');
        return null;
    }
}

// ===== CẬP NHẬT TÀI KHOẢN =====
async function updateAccountInDB(accountId, updateData) {
    const userId = auth.currentUser?.uid;
    if (!userId) return false;

    try {
        const safeData = stripSensitiveAccountFields(updateData);
        await db.collection('users').doc(userId).collection('accounts').doc(accountId).update({
            ...safeData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        console.log('✅ Đã cập nhật TK:', accountId);
        return true;
    } catch (error) {
        console.error('❌ Lỗi cập nhật TK:', error);
        showToast('Lỗi cập nhật', 'error');
        return false;
    }
}

// ===== XOÁ TÀI KHOẢN =====
async function deleteAccountFromDB(accountId) {
    const userId = auth.currentUser?.uid;
    if (!userId) return false;

    try {
        await db.collection('users').doc(userId).collection('accounts').doc(accountId).delete();
        console.log('✅ Đã xoá TK:', accountId);
        return true;
    } catch (error) {
        console.error('❌ Lỗi xoá TK:', error);
        showToast('Lỗi xoá tài khoản', 'error');
        return false;
    }
}

// ===== GIA HẠN TÀI KHOẢN =====
async function renewAccountInDB(accountId, days) {
    const acc = window.appState.accounts.find(a => a.id === accountId);
    if (!acc) return false;

    const base = acc.expiryDate ? new Date(acc.expiryDate) : new Date();
    base.setDate(base.getDate() + days);
    const newExpiry = base.toISOString().split('T')[0];

    const history = acc.renewalHistory || [];
    history.push({ date: todayStr(), days });

    return await updateAccountInDB(accountId, {
        expiryDate: newExpiry,
        renewalHistory: history,
        status: getStatusFromExpiry(newExpiry, acc.expiryType),
    });
}

// ===== LƯU/ĐỌC SETTINGS =====
async function getUserSettings() {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;
    try {
        const doc = await db.collection('users').doc(userId).collection('settings').doc('general').get();
        return doc.exists ? doc.data() : null;
    } catch (error) {
        console.error('❌ Lỗi đọc settings:', error);
        return null;
    }
}

async function updateUserSettings(data) {
    const userId = auth.currentUser?.uid;
    if (!userId) return false;
    try {
        await db.collection('users').doc(userId).collection('settings').doc('general').update(data);
        return true;
    } catch (error) {
        console.error('❌ Lỗi cập nhật settings:', error);
        return false;
    }
}

// ===== MASTER PASSWORD HASH (lưu trên Firestore) =====
async function saveMasterPasswordHash(hash, salt) {
    const userId = auth.currentUser?.uid;
    if (!userId) return false;
    try {
        await db.collection('users').doc(userId).collection('settings').doc('security').set({
            masterPasswordHash: hash,
            masterPasswordSalt: salt,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return true;
    } catch (error) {
        console.error('❌ Lỗi lưu master password hash:', error);
        return false;
    }
}

async function getMasterPasswordHash() {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;
    try {
        const doc = await db.collection('users').doc(userId).collection('settings').doc('security').get();
        return doc.exists ? doc.data() : null;
    } catch (error) {
        console.error('❌ Lỗi đọc master password hash:', error);
        throw error;
    }
}
