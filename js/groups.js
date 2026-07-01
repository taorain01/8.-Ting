/* Ting! - Shared groups module
   Firestore CRUD + realtime sync for zero-knowledge shared accounts */

let groupsUnsubscribe = null;
const sharedAccountsUnsubscribes = new Map();
const sharedEditRequestsUnsubscribes = new Map();

const GROUP_SENSITIVE_FIELDS = new Set(['username', 'password', 'twoFaCode', 'note', 'rawInput']);
const GROUP_SYSTEM_FIELDS = new Set([
    'id',
    'encryptedData',
    'salt',
    'iv',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'pendingSync',
    'sharedByUid',
    'sharedByEmail',
    'sourceAccountId',
]);

function normalizeGroupEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizeGroupEmailList(value) {
    return Array.isArray(value) ? value.map(normalizeGroupEmail).filter(Boolean) : [];
}

function isValidGroupEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeGroupEmail(email));
}

function ensureGroupState() {
    if (!window.appState) window.appState = {};
    if (!Array.isArray(window.appState.groups)) window.appState.groups = [];
    if (!Array.isArray(window.appState.groupInvites)) window.appState.groupInvites = [];
    if (!window.appState.sharedAccounts || typeof window.appState.sharedAccounts !== 'object') window.appState.sharedAccounts = {};
    if (!window.appState.sharedAccountCounts || typeof window.appState.sharedAccountCounts !== 'object') window.appState.sharedAccountCounts = {};
    if (!window.appState.sharedEditRequests || typeof window.appState.sharedEditRequests !== 'object') window.appState.sharedEditRequests = {};
    if (!window.appState.sharedEditRequestCounts || typeof window.appState.sharedEditRequestCounts !== 'object') window.appState.sharedEditRequestCounts = {};
    if (!window.appState.groupUnlocked || typeof window.appState.groupUnlocked !== 'object') window.appState.groupUnlocked = {};
    if (window.appState.currentGroupId === undefined) window.appState.currentGroupId = null;
}

function getCurrentGroupUser() {
    const user = auth?.currentUser || null;
    return {
        uid: user?.uid || window.appState?.user?.uid || '',
        email: normalizeGroupEmail(user?.email || window.appState?.user?.email || ''),
        verified: Boolean(user?.emailVerified || window.appState?.isDemo),
        name: user?.displayName || window.appState?.user?.name || '',
    };
}

function requireGroupUser() {
    const user = getCurrentGroupUser();
    if (!user.uid || !user.email) throw new Error('Chua dang nhap');
    if (!user.verified) throw new Error('Can xac minh email truoc khi dung Nhom');
    return user;
}

function groupTimestampToDate(value) {
    return value?.toDate?.() || value || null;
}

function getGroupById(groupId) {
    ensureGroupState();
    return (window.appState.groups || []).find(group => group.id === groupId) || null;
}

function getGroupInviteById(groupId) {
    ensureGroupState();
    return (window.appState.groupInvites || []).find(group => group.id === groupId) || null;
}

function getKnownGroupById(groupId) {
    return getGroupById(groupId) || getGroupInviteById(groupId);
}

function notifyGroupsChanged(groupId = null) {
    if (typeof updateHeader === 'function') updateHeader();
    const page = window.appState?.currentPage || '';
    if (page === 'groups' && typeof renderGroupList === 'function') renderGroupList();
    if (page === 'group-detail' && (!groupId || window.appState.currentGroupId === groupId) && typeof renderGroupDetail === 'function') {
        renderGroupDetail(window.appState.currentGroupId || groupId);
    }
}

function cleanGroupFirestoreData(data = {}) {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function getSharedAccountSafeData(account = {}) {
    const safe = {};
    Object.entries(account || {}).forEach(([key, value]) => {
        if (GROUP_SENSITIVE_FIELDS.has(key) || GROUP_SYSTEM_FIELDS.has(key)) return;
        safe[key] = value;
    });
    return cleanGroupFirestoreData(safe);
}

function buildDemoGroupSnapshot(group, currentEmail = '') {
    const memberEmails = normalizeGroupEmailList(group.memberEmails);
    const pendingMemberEmails = normalizeGroupEmailList(group.pendingMemberEmails);
    return {
        ...group,
        memberEmails,
        pendingMemberEmails,
        createdAt: group.createdAt || new Date(),
        updatedAt: group.updatedAt || new Date(),
        sharedAccountCount: (window.appState.sharedAccounts?.[group.id] || []).length,
        editRequestCount: (window.appState.sharedEditRequests?.[group.id] || []).filter(item => item.status === 'pending').length,
        isMember: currentEmail ? memberEmails.includes(currentEmail) : group.isMember,
        isInvited: currentEmail ? pendingMemberEmails.includes(currentEmail) : group.isInvited,
    };
}

async function createGroup(name, sharedPassword) {
    ensureGroupState();
    const groupName = String(name || '').trim();
    if (!groupName) throw new Error('Nhap ten nhom');
    if (String(sharedPassword || '').length < 6) throw new Error('Mat khau chung can toi thieu 6 ky tu');
    const user = requireGroupUser();
    const sharedPwSalt = generateSalt();
    const sharedPwHash = await hashSharedPassword(sharedPassword, sharedPwSalt);

    if (window.appState.isDemo) {
        const id = `demo_group_${Date.now()}`;
        const group = buildDemoGroupSnapshot({
            id,
            name: groupName,
            ownerUid: user.uid,
            ownerEmail: user.email,
            memberEmails: [user.email],
            pendingMemberEmails: [],
            sharedPwHash,
            sharedPwSalt,
            role: 'owner',
        }, user.email);
        window.appState.groups.unshift(group);
        window.appState.sharedAccounts[id] = [];
        window.appState.sharedEditRequests[id] = [];
        setGroupUnlocked(id, sharedPassword);
        notifyGroupsChanged(id);
        return id;
    }

    const docRef = await db.collection('groups').add({
        name: groupName,
        ownerUid: user.uid,
        ownerEmail: user.email,
        memberEmails: [user.email],
        pendingMemberEmails: [],
        sharedPwHash,
        sharedPwSalt,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    setGroupUnlocked(docRef.id, sharedPassword);
    return docRef.id;
}

function mapGroupDoc(doc, currentEmail, currentUid, options = {}) {
    const data = doc.data() || {};
    const memberEmails = normalizeGroupEmailList(data.memberEmails);
    const pendingMemberEmails = normalizeGroupEmailList(data.pendingMemberEmails);
    const isOwner = data.ownerUid === currentUid;
    const isMember = memberEmails.includes(currentEmail);
    const isInvited = pendingMemberEmails.includes(currentEmail) && !isMember;
    return {
        id: doc.id,
        ...data,
        memberEmails,
        pendingMemberEmails,
        role: isOwner ? 'owner' : isMember ? 'member' : 'invited',
        sharedAccountCount: window.appState?.sharedAccountCounts?.[doc.id] || 0,
        editRequestCount: window.appState?.sharedEditRequestCounts?.[doc.id] || 0,
        createdAt: groupTimestampToDate(data.createdAt),
        updatedAt: groupTimestampToDate(data.updatedAt),
        isMember,
        isInvited: options.invite === true || isInvited,
    };
}

function sortGroupsByTime(groups) {
    return [...(groups || [])].sort((a, b) => {
        const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bt - at;
    });
}

function syncSharedAccountListeners(groupIds) {
    const wanted = new Set(groupIds || []);
    [...sharedAccountsUnsubscribes.keys()].forEach(groupId => {
        if (!wanted.has(groupId)) stopSharedAccountsRealtime(groupId);
    });
    [...sharedEditRequestsUnsubscribes.keys()].forEach(groupId => {
        if (!wanted.has(groupId)) stopSharedEditRequestsRealtime(groupId);
    });
    wanted.forEach(groupId => {
        if (!sharedAccountsUnsubscribes.has(groupId)) loadSharedAccountsRealtime(groupId);
        if (!sharedEditRequestsUnsubscribes.has(groupId)) loadSharedEditRequestsRealtime(groupId);
    });
}

function loadGroupsRealtime() {
    ensureGroupState();
    if (typeof groupsUnsubscribe === 'function') groupsUnsubscribe();
    groupsUnsubscribe = null;

    const user = getCurrentGroupUser();
    if (!user.email || !user.verified) {
        window.appState.groups = [];
        window.appState.groupInvites = [];
        syncSharedAccountListeners([]);
        notifyGroupsChanged();
        return null;
    }

    if (window.appState.isDemo) {
        const all = (window.appState.groups || []).map(group => buildDemoGroupSnapshot({
            ...group,
            role: group.ownerUid === user.uid ? 'owner' : 'member',
        }, user.email));
        window.appState.groups = sortGroupsByTime(all.filter(group => group.memberEmails.includes(user.email)));
        window.appState.groupInvites = sortGroupsByTime(all.filter(group => group.pendingMemberEmails.includes(user.email) && !group.memberEmails.includes(user.email)));
        notifyGroupsChanged();
        return null;
    }

    let memberUnsubscribe = null;
    let inviteUnsubscribe = null;

    memberUnsubscribe = db.collection('groups')
        .where('memberEmails', 'array-contains', user.email)
        .onSnapshot((snapshot) => {
            ensureGroupState();
            const groups = [];
            snapshot.forEach(doc => groups.push(mapGroupDoc(doc, user.email, user.uid)));
            window.appState.groups = sortGroupsByTime(groups);
            syncSharedAccountListeners(groups.map(group => group.id));
            notifyGroupsChanged();
        }, (error) => {
            console.error('Load groups error:', error);
            window.appState.groups = [];
            syncSharedAccountListeners([]);
            if (typeof isDBPermissionError === 'function' && isDBPermissionError(error) && typeof showDBPermissionToast === 'function') {
                showDBPermissionToast();
            } else if (typeof showToast === 'function') {
                showToast(error.message || 'Khong tai duoc danh sach nhom', 'error');
            }
            notifyGroupsChanged();
        });

    inviteUnsubscribe = db.collection('groups')
        .where('pendingMemberEmails', 'array-contains', user.email)
        .onSnapshot((snapshot) => {
            ensureGroupState();
            const memberIds = new Set((window.appState.groups || []).map(group => group.id));
            const invites = [];
            snapshot.forEach(doc => {
                if (!memberIds.has(doc.id)) invites.push(mapGroupDoc(doc, user.email, user.uid, { invite: true }));
            });
            window.appState.groupInvites = sortGroupsByTime(invites);
            notifyGroupsChanged();
        }, (error) => {
            console.error('Load group invites error:', error);
            window.appState.groupInvites = [];
            if (typeof isDBPermissionError === 'function' && isDBPermissionError(error) && typeof showDBPermissionToast === 'function') {
                showDBPermissionToast();
            } else if (typeof showToast === 'function') {
                showToast(error.message || 'Khong tai duoc loi moi nhom', 'error');
            }
            notifyGroupsChanged();
        });

    groupsUnsubscribe = () => {
        if (typeof memberUnsubscribe === 'function') memberUnsubscribe();
        if (typeof inviteUnsubscribe === 'function') inviteUnsubscribe();
    };
    return groupsUnsubscribe;
}

function stopGroupsRealtime() {
    if (typeof groupsUnsubscribe === 'function') groupsUnsubscribe();
    groupsUnsubscribe = null;
    syncSharedAccountListeners([]);
}

async function addGroupMember(groupId, email) {
    ensureGroupState();
    const normalizedEmail = normalizeGroupEmail(email);
    if (!isValidGroupEmail(normalizedEmail)) throw new Error('Email moi khong hop le');
    const group = getGroupById(groupId);
    if (!group) throw new Error('Khong tim thay nhom');
    if (group.role !== 'owner') throw new Error('Chi chu nhom duoc moi thanh vien');
    if ((group.memberEmails || []).includes(normalizedEmail)) throw new Error('Email da co trong nhom');
    if ((group.pendingMemberEmails || []).includes(normalizedEmail)) throw new Error('Email nay da co loi moi dang cho');

    if (window.appState.isDemo) {
        group.pendingMemberEmails = [...(group.pendingMemberEmails || []), normalizedEmail];
        group.updatedAt = new Date();
        notifyGroupsChanged(groupId);
        return true;
    }

    await db.collection('groups').doc(groupId).update({
        pendingMemberEmails: firebase.firestore.FieldValue.arrayUnion(normalizedEmail),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
}

async function cancelGroupInvite(groupId, email = '') {
    ensureGroupState();
    const user = requireGroupUser();
    const group = getKnownGroupById(groupId);
    if (!group) throw new Error('Khong tim thay nhom');
    const normalizedEmail = normalizeGroupEmail(email || user.email);
    const isOwner = group.ownerUid === user.uid || group.role === 'owner';
    const isSelf = normalizedEmail === user.email;
    if (!isOwner && !isSelf) throw new Error('Khong co quyen huy loi moi nay');

    if (window.appState.isDemo) {
        group.pendingMemberEmails = (group.pendingMemberEmails || []).filter(item => item !== normalizedEmail);
        window.appState.groupInvites = (window.appState.groupInvites || []).filter(item => item.id !== groupId || normalizedEmail !== user.email);
        group.updatedAt = new Date();
        notifyGroupsChanged(groupId);
        return true;
    }

    await db.collection('groups').doc(groupId).update({
        pendingMemberEmails: firebase.firestore.FieldValue.arrayRemove(normalizedEmail),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
}

async function acceptGroupInvite(groupId, sharedPassword) {
    ensureGroupState();
    const user = requireGroupUser();
    const group = getGroupInviteById(groupId) || getKnownGroupById(groupId);
    if (!group) throw new Error('Khong tim thay loi moi');
    if (!(group.pendingMemberEmails || []).includes(user.email) && !window.appState.isDemo) {
        throw new Error('Email cua ban khong co trong loi moi nhom');
    }
    if (!sharedPassword) throw new Error('Nhap mat khau chung cua nhom');

    const ok = await verifyGroupPassword(group, sharedPassword);
    if (!ok) throw new Error('Mat khau chung khong dung');

    if (window.appState.isDemo) {
        group.pendingMemberEmails = (group.pendingMemberEmails || []).filter(item => item !== user.email);
        group.memberEmails = [...new Set([...(group.memberEmails || []), user.email])];
        group.role = group.ownerUid === user.uid ? 'owner' : 'member';
        group.updatedAt = new Date();
        window.appState.groupInvites = (window.appState.groupInvites || []).filter(item => item.id !== groupId);
        if (!window.appState.groups.some(item => item.id === groupId)) window.appState.groups.unshift(group);
        setGroupUnlocked(groupId, sharedPassword);
        notifyGroupsChanged(groupId);
        return true;
    }

    await db.collection('groups').doc(groupId).update({
        memberEmails: firebase.firestore.FieldValue.arrayUnion(user.email),
        pendingMemberEmails: firebase.firestore.FieldValue.arrayRemove(user.email),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    const acceptedGroup = {
        ...group,
        memberEmails: [...new Set([...(group.memberEmails || []), user.email])],
        pendingMemberEmails: (group.pendingMemberEmails || []).filter(item => item !== user.email),
        role: group.ownerUid === user.uid ? 'owner' : 'member',
        isMember: true,
        isInvited: false,
        updatedAt: new Date(),
    };
    window.appState.groupInvites = (window.appState.groupInvites || []).filter(item => item.id !== groupId);
    window.appState.groups = [acceptedGroup, ...(window.appState.groups || []).filter(item => item.id !== groupId)];
    setGroupUnlocked(groupId, sharedPassword);
    return true;
}

async function removeGroupMember(groupId, email) {
    ensureGroupState();
    const normalizedEmail = normalizeGroupEmail(email);
    const group = getGroupById(groupId);
    if (!group) throw new Error('Khong tim thay nhom');
    if (group.role !== 'owner') throw new Error('Chi chu nhom duoc xoa thanh vien');
    if (normalizedEmail === normalizeGroupEmail(group.ownerEmail)) throw new Error('Khong the xoa chu nhom');

    if (window.appState.isDemo) {
        group.memberEmails = (group.memberEmails || []).filter(item => item !== normalizedEmail);
        group.updatedAt = new Date();
        notifyGroupsChanged(groupId);
        return true;
    }

    await db.collection('groups').doc(groupId).update({
        memberEmails: firebase.firestore.FieldValue.arrayRemove(normalizedEmail),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
}

async function renameGroup(groupId, name) {
    const groupName = String(name || '').trim();
    if (!groupName) throw new Error('Nhap ten nhom');
    const group = getGroupById(groupId);
    if (!group) throw new Error('Khong tim thay nhom');
    if (group.role !== 'owner') throw new Error('Chi chu nhom duoc doi ten');

    if (window.appState.isDemo) {
        group.name = groupName;
        group.updatedAt = new Date();
        notifyGroupsChanged(groupId);
        return true;
    }

    await db.collection('groups').doc(groupId).update({
        name: groupName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
}

async function deleteGroup(groupId) {
    const group = getGroupById(groupId);
    if (!group) throw new Error('Khong tim thay nhom');
    if (group.role !== 'owner') throw new Error('Chi chu nhom duoc xoa nhom');

    if (window.appState.isDemo) {
        window.appState.groups = (window.appState.groups || []).filter(item => item.id !== groupId);
        window.appState.groupInvites = (window.appState.groupInvites || []).filter(item => item.id !== groupId);
        delete window.appState.sharedAccounts[groupId];
        delete window.appState.sharedAccountCounts[groupId];
        delete window.appState.sharedEditRequests[groupId];
        delete window.appState.sharedEditRequestCounts[groupId];
        delete window.appState.groupUnlocked[groupId];
        notifyGroupsChanged(groupId);
        return true;
    }

    const groupRef = db.collection('groups').doc(groupId);
    const sharedSnapshot = await groupRef.collection('sharedAccounts').get();
    const editRequestSnapshot = await groupRef.collection('sharedEditRequests').get();
    const batch = db.batch();
    sharedSnapshot.forEach(doc => batch.delete(doc.ref));
    editRequestSnapshot.forEach(doc => batch.delete(doc.ref));
    batch.delete(groupRef);
    await batch.commit();
    return true;
}

async function verifyGroupPassword(group, sharedPassword) {
    if (!group?.sharedPwHash || !group?.sharedPwSalt) throw new Error('Nhom thieu thong tin xac minh mat khau');
    return verifySharedPassword(sharedPassword, group.sharedPwHash, group.sharedPwSalt);
}

function setGroupUnlocked(groupId, sharedPassword) {
    ensureGroupState();
    if (!groupId || !sharedPassword) return false;
    window.appState.groupUnlocked[groupId] = String(sharedPassword);
    notifyGroupsChanged(groupId);
    return true;
}

function getUnlockedGroupPassword(groupId) {
    ensureGroupState();
    return window.appState.groupUnlocked?.[groupId] || '';
}

function isGroupUnlocked(groupId) {
    return Boolean(getUnlockedGroupPassword(groupId));
}

function clearGroupUnlocks() {
    ensureGroupState();
    window.appState.groupUnlocked = {};
}

function mapSharedAccountDoc(doc) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        ...data,
        status: typeof getStatusFromExpiry === 'function'
            ? getStatusFromExpiry(data.expiryDate, data.expiryType)
            : data.status,
        createdAt: groupTimestampToDate(data.createdAt),
        updatedAt: groupTimestampToDate(data.updatedAt),
        pendingSync: Boolean(doc.metadata?.hasPendingWrites),
    };
}

function mapSharedEditRequestDoc(doc) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        ...data,
        status: data.status || 'pending',
        createdAt: groupTimestampToDate(data.createdAt),
        updatedAt: groupTimestampToDate(data.updatedAt),
        reviewedAt: groupTimestampToDate(data.reviewedAt),
        pendingSync: Boolean(doc.metadata?.hasPendingWrites),
    };
}

function loadSharedAccountsRealtime(groupId) {
    ensureGroupState();
    if (!groupId) return null;
    if (typeof sharedAccountsUnsubscribes.get(groupId) === 'function') return sharedAccountsUnsubscribes.get(groupId);

    if (window.appState.isDemo) {
        window.appState.sharedAccounts[groupId] = window.appState.sharedAccounts[groupId] || [];
        window.appState.sharedAccountCounts[groupId] = window.appState.sharedAccounts[groupId].length;
        notifyGroupsChanged(groupId);
        return null;
    }

    const unsubscribe = db.collection('groups').doc(groupId).collection('sharedAccounts')
        .orderBy('createdAt', 'desc')
        .onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
            ensureGroupState();
            const accounts = [];
            snapshot.forEach(doc => accounts.push(mapSharedAccountDoc(doc)));
            window.appState.sharedAccounts[groupId] = accounts;
            window.appState.sharedAccountCounts[groupId] = accounts.length;
            const group = getGroupById(groupId);
            if (group) group.sharedAccountCount = accounts.length;
            notifyGroupsChanged(groupId);
        }, (error) => {
            console.error('Load shared accounts error:', error);
            window.appState.sharedAccounts[groupId] = [];
            window.appState.sharedAccountCounts[groupId] = 0;
            if (typeof showToast === 'function') showToast(error.message || 'Khong tai duoc tai khoan chia se', 'error');
            notifyGroupsChanged(groupId);
        });
    sharedAccountsUnsubscribes.set(groupId, unsubscribe);
    return unsubscribe;
}

function stopSharedAccountsRealtime(groupId) {
    const unsubscribe = sharedAccountsUnsubscribes.get(groupId);
    if (typeof unsubscribe === 'function') unsubscribe();
    sharedAccountsUnsubscribes.delete(groupId);
}

function loadSharedEditRequestsRealtime(groupId) {
    ensureGroupState();
    if (!groupId) return null;
    if (typeof sharedEditRequestsUnsubscribes.get(groupId) === 'function') return sharedEditRequestsUnsubscribes.get(groupId);

    if (window.appState.isDemo) {
        window.appState.sharedEditRequests[groupId] = window.appState.sharedEditRequests[groupId] || [];
        window.appState.sharedEditRequestCounts[groupId] = window.appState.sharedEditRequests[groupId].filter(item => item.status === 'pending').length;
        notifyGroupsChanged(groupId);
        return null;
    }

    const unsubscribe = db.collection('groups').doc(groupId).collection('sharedEditRequests')
        .orderBy('createdAt', 'desc')
        .onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
            ensureGroupState();
            const requests = [];
            snapshot.forEach(doc => requests.push(mapSharedEditRequestDoc(doc)));
            const pendingCount = requests.filter(item => item.status === 'pending').length;
            window.appState.sharedEditRequests[groupId] = requests;
            window.appState.sharedEditRequestCounts[groupId] = pendingCount;
            const group = getGroupById(groupId);
            if (group) group.editRequestCount = pendingCount;
            notifyGroupsChanged(groupId);
        }, (error) => {
            console.error('Load shared edit requests error:', error);
            window.appState.sharedEditRequests[groupId] = [];
            window.appState.sharedEditRequestCounts[groupId] = 0;
            if (typeof showToast === 'function') showToast(error.message || 'Khong tai duoc yeu cau sua', 'error');
            notifyGroupsChanged(groupId);
        });
    sharedEditRequestsUnsubscribes.set(groupId, unsubscribe);
    return unsubscribe;
}

function stopSharedEditRequestsRealtime(groupId) {
    const unsubscribe = sharedEditRequestsUnsubscribes.get(groupId);
    if (typeof unsubscribe === 'function') unsubscribe();
    sharedEditRequestsUnsubscribes.delete(groupId);
}

function hasSharedSourceAccount(groupId, sourceAccountId) {
    if (!sourceAccountId) return false;
    return (window.appState?.sharedAccounts?.[groupId] || []).some(account => account.sourceAccountId === sourceAccountId);
}

function getSharedAccountByIdFromState(groupId, accountId) {
    return (window.appState?.sharedAccounts?.[groupId] || []).find(account => account.id === accountId) || null;
}

function getSharedEditRequestById(groupId, requestId) {
    return (window.appState?.sharedEditRequests?.[groupId] || []).find(request => request.id === requestId) || null;
}

function getSharedEditRequestsForAccount(groupId, accountId) {
    return (window.appState?.sharedEditRequests?.[groupId] || []).filter(request => request.accountId === accountId);
}

async function buildSharedAccountWriteData(plainAccount, sharedPassword) {
    const sensitive = {
        username: plainAccount?.username || '',
        password: plainAccount?.password || '',
        twoFaCode: plainAccount?.twoFaCode || '',
        note: plainAccount?.note || '',
    };
    const encryptedPayload = await encryptAccountData(sensitive, sharedPassword);
    const safe = getSharedAccountSafeData(plainAccount);
    return cleanGroupFirestoreData({
        ...safe,
        name: safe.name || safe.serviceName || 'Tai khoan chia se',
        serviceName: safe.serviceName || safe.name || '',
        displayUsername: safe.displayUsername || (typeof maskUsername === 'function' ? maskUsername(sensitive.username) : ''),
        protectedByMasterPassword: true,
        encryptedData: encryptedPayload.encryptedData,
        salt: encryptedPayload.salt,
        iv: encryptedPayload.iv,
    });
}

async function shareAccountToGroup(groupId, plainAccount, sharedPassword) {
    ensureGroupState();
    const group = getGroupById(groupId);
    if (!group) throw new Error('Khong tim thay nhom');
    if (!sharedPassword) throw new Error('Can mo khoa nhom truoc khi chia se');
    if (plainAccount?.id && hasSharedSourceAccount(groupId, plainAccount.id)) {
        throw new Error('Tai khoan nay da duoc chia se len nhom');
    }
    const user = requireGroupUser();
    const writeData = await buildSharedAccountWriteData(plainAccount, sharedPassword);
    const payload = cleanGroupFirestoreData({
        ...writeData,
        sharedByUid: user.uid,
        sharedByEmail: user.email,
        sourceAccountId: plainAccount?.id || null,
        updatedAt: window.appState.isDemo ? new Date() : firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: window.appState.isDemo ? new Date() : firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (window.appState.isDemo) {
        const id = `demo_shared_${Date.now()}`;
        const account = { id, ...payload, createdAt: new Date(), updatedAt: new Date() };
        window.appState.sharedAccounts[groupId] = [account, ...(window.appState.sharedAccounts[groupId] || [])];
        window.appState.sharedAccountCounts[groupId] = window.appState.sharedAccounts[groupId].length;
        const demoGroup = getGroupById(groupId);
        if (demoGroup) demoGroup.sharedAccountCount = window.appState.sharedAccountCounts[groupId];
        notifyGroupsChanged(groupId);
        return id;
    }

    const docRef = await db.collection('groups').doc(groupId).collection('sharedAccounts').add(payload);
    await db.collection('groups').doc(groupId).update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
    return docRef.id;
}

async function updateSharedAccountInGroup(groupId, accountId, plainAccount, sharedPassword) {
    ensureGroupState();
    const user = requireGroupUser();
    const group = getGroupById(groupId);
    const account = getSharedAccountByIdFromState(groupId, accountId);
    if (!group || !account) throw new Error('Khong tim thay tai khoan chia se');
    if (group.role !== 'owner' && account.sharedByUid !== user.uid) {
        throw new Error('Chi chu nhom hoac nguoi chia se duoc luu truc tiep');
    }
    if (!sharedPassword) throw new Error('Can mo khoa nhom truoc khi luu');

    const writeData = await buildSharedAccountWriteData({ ...account, ...plainAccount }, sharedPassword);
    const update = cleanGroupFirestoreData({
        ...writeData,
        updatedAt: window.appState.isDemo ? new Date() : firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (window.appState.isDemo) {
        Object.assign(account, update);
        notifyGroupsChanged(groupId);
        return true;
    }

    await db.collection('groups').doc(groupId).collection('sharedAccounts').doc(accountId).update(update);
    await db.collection('groups').doc(groupId).update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
    return true;
}

async function createSharedEditRequest(groupId, accountId, plainAccount, sharedPassword) {
    ensureGroupState();
    const user = requireGroupUser();
    const group = getGroupById(groupId);
    const account = getSharedAccountByIdFromState(groupId, accountId);
    if (!group || !account) throw new Error('Khong tim thay tai khoan chia se');
    if (!sharedPassword) throw new Error('Can mo khoa nhom truoc khi gui yeu cau sua');

    const reviewerUid = account.sharedByUid || group.ownerUid;
    const reviewerEmail = normalizeGroupEmail(account.sharedByEmail || group.ownerEmail);
    if (!reviewerUid && !reviewerEmail) throw new Error('Tai khoan nay thieu nguoi duyet');

    const writeData = await buildSharedAccountWriteData({ ...account, ...plainAccount }, sharedPassword);
    const { encryptedData, salt, iv, ...proposedSafeData } = writeData;
    const payload = cleanGroupFirestoreData({
        accountId,
        accountName: writeData.name || account.name || account.serviceName || '',
        requestedByUid: user.uid,
        requestedByEmail: user.email,
        reviewerUid,
        reviewerEmail,
        status: 'pending',
        proposedSafeData,
        proposedEncryptedData: encryptedData,
        proposedSalt: salt,
        proposedIv: iv,
        createdAt: window.appState.isDemo ? new Date() : firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: window.appState.isDemo ? new Date() : firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (window.appState.isDemo) {
        const id = `demo_edit_${Date.now()}`;
        window.appState.sharedEditRequests[groupId] = [{ id, ...payload }, ...(window.appState.sharedEditRequests[groupId] || [])];
        window.appState.sharedEditRequestCounts[groupId] = window.appState.sharedEditRequests[groupId].filter(item => item.status === 'pending').length;
        notifyGroupsChanged(groupId);
        return id;
    }

    const docRef = await db.collection('groups').doc(groupId).collection('sharedEditRequests').add(payload);
    await db.collection('groups').doc(groupId).update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
    return docRef.id;
}

function buildSharedAccountUpdateFromRequest(request, timestamp) {
    return cleanGroupFirestoreData({
        ...(request.proposedSafeData || {}),
        encryptedData: request.proposedEncryptedData,
        salt: request.proposedSalt,
        iv: request.proposedIv,
        updatedAt: timestamp,
    });
}

async function acceptSharedEditRequest(groupId, requestId) {
    ensureGroupState();
    const user = requireGroupUser();
    const group = getGroupById(groupId);
    const request = getSharedEditRequestById(groupId, requestId);
    if (!group || !request) throw new Error('Khong tim thay yeu cau sua');
    const isReviewer = request.reviewerUid === user.uid || normalizeGroupEmail(request.reviewerEmail) === user.email;
    if (!isReviewer) throw new Error('Chi nguoi chia se tai khoan duoc Accept');
    if (request.status !== 'pending') throw new Error('Yeu cau nay da duoc xu ly');

    if (window.appState.isDemo) {
        const account = getSharedAccountByIdFromState(groupId, request.accountId);
        if (!account) throw new Error('Khong tim thay tai khoan chia se');
        Object.assign(account, buildSharedAccountUpdateFromRequest(request, new Date()));
        request.status = 'accepted';
        request.reviewedByUid = user.uid;
        request.reviewedByEmail = user.email;
        request.reviewedAt = new Date();
        request.updatedAt = new Date();
        window.appState.sharedEditRequestCounts[groupId] = window.appState.sharedEditRequests[groupId].filter(item => item.status === 'pending').length;
        notifyGroupsChanged(groupId);
        return true;
    }

    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    const groupRef = db.collection('groups').doc(groupId);
    const accountRef = groupRef.collection('sharedAccounts').doc(request.accountId);
    const requestRef = groupRef.collection('sharedEditRequests').doc(requestId);
    const batch = db.batch();
    batch.update(accountRef, buildSharedAccountUpdateFromRequest(request, timestamp));
    batch.update(requestRef, {
        status: 'accepted',
        reviewedByUid: user.uid,
        reviewedByEmail: user.email,
        reviewedAt: timestamp,
        updatedAt: timestamp,
    });
    batch.update(groupRef, { updatedAt: timestamp });
    await batch.commit();
    return true;
}

async function rejectSharedEditRequest(groupId, requestId) {
    ensureGroupState();
    const user = requireGroupUser();
    const request = getSharedEditRequestById(groupId, requestId);
    if (!request) throw new Error('Khong tim thay yeu cau sua');
    const isReviewer = request.reviewerUid === user.uid || normalizeGroupEmail(request.reviewerEmail) === user.email;
    if (!isReviewer) throw new Error('Chi nguoi chia se tai khoan duoc tu choi');
    if (request.status !== 'pending') throw new Error('Yeu cau nay da duoc xu ly');

    if (window.appState.isDemo) {
        request.status = 'rejected';
        request.reviewedByUid = user.uid;
        request.reviewedByEmail = user.email;
        request.reviewedAt = new Date();
        request.updatedAt = new Date();
        window.appState.sharedEditRequestCounts[groupId] = window.appState.sharedEditRequests[groupId].filter(item => item.status === 'pending').length;
        notifyGroupsChanged(groupId);
        return true;
    }

    await db.collection('groups').doc(groupId).collection('sharedEditRequests').doc(requestId).update({
        status: 'rejected',
        reviewedByUid: user.uid,
        reviewedByEmail: user.email,
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
}

async function decryptSharedAccount(sharedAccount, sharedPassword) {
    if (!sharedAccount) return null;
    const decrypted = await decryptAccountData(sharedAccount, sharedPassword);
    return {
        ...sharedAccount,
        ...decrypted,
    };
}

async function removeSharedAccount(groupId, accountId) {
    ensureGroupState();
    if (!groupId || !accountId) return false;

    if (window.appState.isDemo) {
        window.appState.sharedAccounts[groupId] = (window.appState.sharedAccounts[groupId] || []).filter(account => account.id !== accountId);
        window.appState.sharedAccountCounts[groupId] = window.appState.sharedAccounts[groupId].length;
        notifyGroupsChanged(groupId);
        return true;
    }

    await db.collection('groups').doc(groupId).collection('sharedAccounts').doc(accountId).delete();
    await db.collection('groups').doc(groupId).update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
    return true;
}

window.normalizeGroupEmail = normalizeGroupEmail;
window.createGroup = createGroup;
window.loadGroupsRealtime = loadGroupsRealtime;
window.stopGroupsRealtime = stopGroupsRealtime;
window.addGroupMember = addGroupMember;
window.cancelGroupInvite = cancelGroupInvite;
window.acceptGroupInvite = acceptGroupInvite;
window.removeGroupMember = removeGroupMember;
window.renameGroup = renameGroup;
window.deleteGroup = deleteGroup;
window.verifyGroupPassword = verifyGroupPassword;
window.setGroupUnlocked = setGroupUnlocked;
window.getUnlockedGroupPassword = getUnlockedGroupPassword;
window.isGroupUnlocked = isGroupUnlocked;
window.clearGroupUnlocks = clearGroupUnlocks;
window.loadSharedAccountsRealtime = loadSharedAccountsRealtime;
window.stopSharedAccountsRealtime = stopSharedAccountsRealtime;
window.loadSharedEditRequestsRealtime = loadSharedEditRequestsRealtime;
window.stopSharedEditRequestsRealtime = stopSharedEditRequestsRealtime;
window.shareAccountToGroup = shareAccountToGroup;
window.updateSharedAccountInGroup = updateSharedAccountInGroup;
window.createSharedEditRequest = createSharedEditRequest;
window.acceptSharedEditRequest = acceptSharedEditRequest;
window.rejectSharedEditRequest = rejectSharedEditRequest;
window.decryptSharedAccount = decryptSharedAccount;
window.removeSharedAccount = removeSharedAccount;
window.getGroupById = getGroupById;
window.getGroupInviteById = getGroupInviteById;
window.getSharedEditRequestById = getSharedEditRequestById;
window.getSharedEditRequestsForAccount = getSharedEditRequestsForAccount;
window.hasSharedSourceAccount = hasSharedSourceAccount;
