/* Ting! — Database Module
   Firestore CRUD + Realtime Sync */

let accountsUnsubscribe = null;

function cleanFirestoreData(data = {}) {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function stripSensitiveAccountFields(data = {}) {
    const { username, password, twoFaCode, note, rawInput, ...safeData } = data;
    // Keep authMethod/linkedAccountId in safeData; they are non-sensitive SSO metadata.
    const requiresProtection = safeData.type === 'personal' || safeData.protectedByMasterPassword === true;
    if (requiresProtection) return cleanFirestoreData(safeData);
    return cleanFirestoreData({ ...safeData, username, password, twoFaCode, note, rawInput });
}

function isDBPermissionError(error) {
    return error?.code === 'permission-denied'
        || String(error?.message || '').toLowerCase().includes('insufficient permissions');
}

function showDBPermissionToast() {
    if (window.appState) window.appState.cloudPermissionDenied = true;
    if (typeof showToast === 'function') {
        showToast('Firestore chưa cấp quyền. Cần cập nhật Rules trên Firebase Console.', 'error');
    }
}

// ===== LOAD ACCOUNTS (Realtime) =====
function loadAccountsRealtime() {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    if (typeof accountsUnsubscribe === 'function') accountsUnsubscribe();

    accountsUnsubscribe = db.collection('users').doc(userId).collection('accounts')
        .orderBy('createdAt', 'desc')
        .onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
            const pendingWrites = snapshot.docs.filter(doc => doc.metadata?.hasPendingWrites).length;
            if (typeof setSyncMetadata === 'function') {
                setSyncMetadata({
                    fromCache: Boolean(snapshot.metadata?.fromCache),
                    pendingWrites,
                });
            }
            const accounts = [];
            const trashAccounts = [];
            snapshot.forEach(doc => {
                const data = stripSensitiveAccountFields(doc.data());
                const account = {
                    id: doc.id,
                    ...data,
                    // Cập nhật status dựa trên ngày thực
                    status: getStatusFromExpiry(data.expiryDate, data.expiryType),
                    // Convert Firestore Timestamp
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                    updatedAt: data.updatedAt?.toDate?.() || new Date(),
                    deletedAt: data.deletedAt?.toDate?.() || data.deletedAt || null,
                    isFavorite: data.isFavorite === true,
                    isPinned: data.isPinned === true,
                    favoriteAt: data.favoriteAt?.toDate?.() || data.favoriteAt || null,
                    pinnedAt: data.pinnedAt?.toDate?.() || data.pinnedAt || null,
                    pendingSync: Boolean(doc.metadata?.hasPendingWrites),
                };
                if (data.isDeleted === true) trashAccounts.push(account);
                else accounts.push(account);
            });
            window.appState.accounts = accounts;
            window.appState.trashAccounts = trashAccounts;
            updateHeader();
            if (typeof checkExpiryAndNotify === 'function') {
                checkExpiryAndNotify(accounts);
            }
            const notificationDropdown = document.getElementById('notification-dropdown');
            if (notificationDropdown && !notificationDropdown.hidden && typeof renderNotificationPanel === 'function') {
                renderNotificationPanel();
            }
            // Re-render trang hiện tại
            const page = window.appState.currentPage;
            if (page === 'dashboard') renderDashboard();
            else if (page === 'bought') renderAccountList('bought');
            else if (page === 'personal') renderAccountList('personal');
            else if (page === 'trash') renderTrashList();
            else if (page === 'categories') renderCategoriesPage();
            else if (page.startsWith('category:')) renderCategoryDetail(page.slice('category:'.length));
        }, (error) => {
            console.error('❌ Lỗi load accounts:', error);
            if (typeof setSyncMetadata === 'function') setSyncMetadata({ pendingWrites: 0 });
            window.appState.accounts = [];
            window.appState.trashAccounts = [];
            if (typeof updateHeader === 'function') updateHeader();
            const page = window.appState.currentPage;
            if (page === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
            else if (page === 'bought' && typeof renderAccountList === 'function') renderAccountList('bought');
            else if (page === 'personal' && typeof renderAccountList === 'function') renderAccountList('personal');
            else if (page === 'trash' && typeof renderTrashList === 'function') renderTrashList();
            else if (page === 'categories' && typeof renderCategoriesPage === 'function') renderCategoriesPage();
            else if (page.startsWith('category:') && typeof renderCategoryDetail === 'function') renderCategoryDetail(page.slice('category:'.length));
            if (isDBPermissionError(error)) showDBPermissionToast();
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
        const requiresProtection = safeData.type === 'personal' || safeData.protectedByMasterPassword === true;
        if (requiresProtection && (!safeData.encryptedData || !safeData.salt || !safeData.iv)) {
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
        await db.collection('users').doc(userId).collection('accounts').doc(accountId).update({
            isDeleted: true,
            deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        console.log('✅ Đã xoá TK:', accountId);
        return true;
    } catch (error) {
        console.error('❌ Lỗi xoá TK:', error);
        showToast('Lỗi xoá tài khoản', 'error');
        return false;
    }
}

// ===== GIA HẠN TÀI KHOẢN =====
// ===== KHOI PHUC TU THUNG RAC =====
async function restoreAccountFromDB(accountId) {
    const userId = auth.currentUser?.uid;
    if (!userId) return false;

    try {
        await db.collection('users').doc(userId).collection('accounts').doc(accountId).update({
            isDeleted: false,
            deletedAt: null,
            restoredAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        console.log('✅ Đã khôi phục TK:', accountId);
        return true;
    } catch (error) {
        console.error('❌ Lỗi khôi phục TK:', error);
        showToast('Lỗi khôi phục tài khoản', 'error');
        return false;
    }
}

// ===== GIA HAN TAI KHOAN =====
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
async function loadUserCategories() {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];
    try {
        const doc = await db.collection('users').doc(userId).collection('settings').doc('categories').get();
        const categories = Array.isArray(doc.data()?.categories) ? doc.data().categories : [];
        window.appState.customCategories = categories
            .filter(category => category?.id && category?.name)
            .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
        if (typeof updateHeader === 'function') updateHeader();
        return window.appState.customCategories;
    } catch (error) {
        console.error('Load categories error:', error);
        if (isDBPermissionError(error)) showDBPermissionToast();
        return [];
    }
}

async function saveUserCategories(categories = []) {
    const userId = auth.currentUser?.uid;
    if (!userId) return false;
    try {
        await db.collection('users').doc(userId).collection('settings').doc('categories').set({
            categories,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        window.appState.customCategories = categories;
        if (typeof updateHeader === 'function') updateHeader();
        return true;
    } catch (error) {
        console.error('Save categories error:', error);
        showToast('Lỗi lưu danh mục', 'error');
        return false;
    }
}

async function saveMasterPasswordHash(hash, salt, masterPasswordLength = null) {
    const userId = auth.currentUser?.uid;
    if (!userId) return false;
    try {
        const securityData = {
            masterPasswordHash: hash,
            masterPasswordSalt: salt,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        if (masterPasswordLength === 4 || masterPasswordLength === 6) {
            securityData.masterPasswordLength = masterPasswordLength;
        }
        await db.collection('users').doc(userId).collection('settings').doc('security').set(securityData, { merge: true });
        return true;
    } catch (error) {
        console.error('❌ Lỗi lưu master password hash:', error);
        if (isDBPermissionError(error)) showDBPermissionToast();
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
        if (isDBPermissionError(error)) {
            showDBPermissionToast();
            return null;
        }
        throw error;
    }
}

async function deleteMasterPasswordHash() {
    const userId = auth.currentUser?.uid;
    if (!userId) return false;
    try {
        await db.collection('users').doc(userId).collection('settings').doc('security').delete();
        return true;
    } catch (error) {
        console.error('❌ Lỗi xoá master password hash:', error);
        if (isDBPermissionError(error)) showDBPermissionToast();
        return false;
    }
}
