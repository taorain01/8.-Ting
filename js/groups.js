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

function normalizeGroupCategoryId(value) {
    return String(value || '').trim().toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeGroupAccountCategories(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
        .map((category, index) => {
            const rawName = String(category?.name || '').trim();
            const id = normalizeGroupCategoryId(category?.id || rawName);
            if (!id || !rawName || seen.has(id)) return null;
            seen.add(id);
            const order = Number(category?.order);
            return {
                id,
                name: rawName,
                note: String(category?.note || '').trim(),
                icon: String(category?.icon || 'folder').trim() || 'folder',
                color: String(category?.color || '#6C5CE7').trim() || '#6C5CE7',
                order: Number.isFinite(order) ? order : index,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function getGroupAccountManagerEmails(group = {}) {
    return normalizeGroupEmailList(group.accountManagerEmails);
}

function getGroupAccountCategories(group = {}) {
    return normalizeGroupAccountCategories(group.accountCategories);
}

function isGroupOwnerUser(group, user = getCurrentGroupUser()) {
    return Boolean(group && user?.uid && group.ownerUid === user.uid);
}

function isGroupAccountManager(group, user = getCurrentGroupUser()) {
    if (!group || !user?.email) return false;
    return isGroupOwnerUser(group, user) || getGroupAccountManagerEmails(group).includes(user.email);
}

function canManageGroupAccounts(group) {
    return isGroupAccountManager(group);
}

function canManageSharedAccount(group, account) {
    const user = getCurrentGroupUser();
    return isGroupAccountManager(group, user) || Boolean(account?.sharedByUid && account.sharedByUid === user.uid);
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
    if (!user.verified) throw new Error('Cần xác minh email trước khi dùng Nhóm');
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

let _groupsRenderTimer = null;
let _pendingGroupRenderId = null;

function runGroupsChangedRender() {
    _groupsRenderTimer = null;
    const groupId = _pendingGroupRenderId;
    _pendingGroupRenderId = null;
    if (typeof updateHeader === 'function') updateHeader();
    const page = window.appState?.currentPage || '';
    if (page === 'groups' && typeof renderGroupList === 'function') renderGroupList();
    if (page === 'group-detail' && (!groupId || window.appState.currentGroupId === groupId) && typeof renderGroupDetail === 'function') {
        // Data-driven refresh: render without replaying entrance animations to avoid flicker.
        renderGroupDetail(window.appState.currentGroupId || groupId, { quiet: true });
    }
}

// Firestore snapshots (with includeMetadataChanges) + the group doc "updatedAt" write
// can fire this several times in a very short burst. Debounce so a burst collapses into
// a single repaint instead of the interface jittering 2-3 times.
function notifyGroupsChanged(groupId = null) {
    if (groupId !== null) _pendingGroupRenderId = groupId;
    if (_groupsRenderTimer) clearTimeout(_groupsRenderTimer);
    _groupsRenderTimer = setTimeout(runGroupsChangedRender, 50);
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
    const accountManagerEmails = getGroupAccountManagerEmails(group);
    const accountCategories = getGroupAccountCategories(group);
    return {
        ...group,
        memberEmails,
        pendingMemberEmails,
        accountManagerEmails,
        accountCategories,
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
    if (!groupName) throw new Error('Nhập tên nhóm');
    if (String(sharedPassword || '').length < 6) throw new Error('Mật khẩu chung cần tối thiểu 6 ký tự');
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
            accountManagerEmails: [],
            accountCategories: [],
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
        accountManagerEmails: [],
        accountCategories: [],
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
    const accountManagerEmails = getGroupAccountManagerEmails(data);
    const accountCategories = getGroupAccountCategories(data);
    const isOwner = data.ownerUid === currentUid;
    const isMember = memberEmails.includes(currentEmail);
    const isInvited = pendingMemberEmails.includes(currentEmail) && !isMember;
    return {
        id: doc.id,
        ...data,
        memberEmails,
        pendingMemberEmails,
        accountManagerEmails,
        accountCategories,
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
                showToast(error.message || 'Không tải được danh sách nhóm', 'error');
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
                showToast(error.message || 'Không tải được lời mời nhóm', 'error');
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
    if (!isValidGroupEmail(normalizedEmail)) throw new Error('Email mời không hợp lệ');
    const group = getGroupById(groupId);
    if (!group) throw new Error('Không tìm thấy nhóm');
    if (group.role !== 'owner') throw new Error('Chỉ chủ nhóm được mời thành viên');
    if ((group.memberEmails || []).includes(normalizedEmail)) throw new Error('Email đã có trong nhóm');
    if ((group.pendingMemberEmails || []).includes(normalizedEmail)) throw new Error('Email này đã có lời mời đang chờ');

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
    if (!group) throw new Error('Không tìm thấy nhóm');
    const normalizedEmail = normalizeGroupEmail(email || user.email);
    const isOwner = group.ownerUid === user.uid || group.role === 'owner';
    const isSelf = normalizedEmail === user.email;
    if (!isOwner && !isSelf) throw new Error('Không có quyền huỷ lời mời này');

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
    if (!group) throw new Error('Không tìm thấy lời mời');
    if (!(group.pendingMemberEmails || []).includes(user.email) && !window.appState.isDemo) {
        throw new Error('Email của bạn không có trong lời mời nhóm');
    }
    if (!sharedPassword) throw new Error('Nhập mật khẩu chung của nhóm');

    const ok = await verifyGroupPassword(group, sharedPassword);
    if (!ok) throw new Error('Mật khẩu chung không đúng');

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
    if (!group) throw new Error('Không tìm thấy nhóm');
    if (group.role !== 'owner') throw new Error('Chỉ chủ nhóm được xoá thành viên');
    if (normalizedEmail === normalizeGroupEmail(group.ownerEmail)) throw new Error('Không thể xoá chủ nhóm');

    if (window.appState.isDemo) {
        group.memberEmails = (group.memberEmails || []).filter(item => item !== normalizedEmail);
        group.accountManagerEmails = getGroupAccountManagerEmails(group).filter(item => item !== normalizedEmail);
        group.updatedAt = new Date();
        notifyGroupsChanged(groupId);
        return true;
    }

    await db.collection('groups').doc(groupId).update({
        memberEmails: firebase.firestore.FieldValue.arrayRemove(normalizedEmail),
        accountManagerEmails: firebase.firestore.FieldValue.arrayRemove(normalizedEmail),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
}

async function renameGroup(groupId, name) {
    const groupName = String(name || '').trim();
    if (!groupName) throw new Error('Nhập tên nhóm');
    const group = getGroupById(groupId);
    if (!group) throw new Error('Không tìm thấy nhóm');
    if (group.role !== 'owner') throw new Error('Chỉ chủ nhóm được đổi tên');

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
    if (!group) throw new Error('Không tìm thấy nhóm');
    if (group.role !== 'owner') throw new Error('Chỉ chủ nhóm được xoá nhóm');

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
    if (!group?.sharedPwHash || !group?.sharedPwSalt) throw new Error('Nhóm thiếu thông tin xác minh mật khẩu');
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

function getSharedAccountSortValue(account, fallbackIndex = 0) {
    const value = Number(account?.groupSortOrder);
    if (Number.isFinite(value)) return value;
    return (fallbackIndex + 1) * 1000;
}

function sortSharedAccountsForGroup(accounts = []) {
    return [...accounts]
        .map((account, index) => ({ account, sortValue: getSharedAccountSortValue(account, index) }))
        .sort((a, b) => {
        const sortDelta = a.sortValue - b.sortValue;
        if (sortDelta !== 0) return sortDelta;
        const at = new Date(a.account.updatedAt || a.account.createdAt || 0).getTime();
        const bt = new Date(b.account.updatedAt || b.account.createdAt || 0).getTime();
        return bt - at;
    })
        .map(item => item.account);
}

function getNextSharedAccountSortOrder(groupId) {
    const accounts = window.appState?.sharedAccounts?.[groupId] || [];
    const values = accounts
        .map(account => Number(account.groupSortOrder))
        .filter(Number.isFinite);
    return values.length ? Math.max(...values) + 1000 : (accounts.length + 1) * 1000;
}

function cleanSharedAccountGroupMetaPatch(patch = {}) {
    const cleaned = {};
    if (Object.prototype.hasOwnProperty.call(patch, 'groupCategoryId')) {
        const categoryId = normalizeGroupCategoryId(patch.groupCategoryId);
        cleaned.groupCategoryId = categoryId || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'groupSortOrder')) {
        const order = Number(patch.groupSortOrder);
        cleaned.groupSortOrder = Number.isFinite(order) ? order : Date.now();
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'groupNote')) {
        cleaned.groupNote = String(patch.groupNote || '').trim();
    }
    return cleaned;
}

async function updateGroupAccountCategories(groupId, categories = []) {
    ensureGroupState();
    const group = getGroupById(groupId);
    if (!group) throw new Error('Không tìm thấy nhóm');
    if (group.role !== 'owner') throw new Error('Chỉ chủ nhóm được thiết kế danh mục');
    const accountCategories = normalizeGroupAccountCategories(categories);

    if (window.appState.isDemo) {
        group.accountCategories = accountCategories;
        group.updatedAt = new Date();
        notifyGroupsChanged(groupId);
        return true;
    }

    await db.collection('groups').doc(groupId).update({
        accountCategories,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
}

async function setGroupAccountManager(groupId, email, enabled) {
    ensureGroupState();
    const group = getGroupById(groupId);
    const normalizedEmail = normalizeGroupEmail(email);
    if (!group) throw new Error('Không tìm thấy nhóm');
    if (group.role !== 'owner') throw new Error('Chỉ chủ nhóm được cấp quyền quản lý');
    if (!normalizedEmail || !(group.memberEmails || []).includes(normalizedEmail)) throw new Error('Email không thuộc nhóm');
    if (normalizedEmail === normalizeGroupEmail(group.ownerEmail)) throw new Error('Chủ nhóm đã có toàn quyền');

    if (window.appState.isDemo) {
        const current = new Set(getGroupAccountManagerEmails(group));
        if (enabled) current.add(normalizedEmail);
        else current.delete(normalizedEmail);
        group.accountManagerEmails = [...current];
        group.updatedAt = new Date();
        notifyGroupsChanged(groupId);
        return true;
    }

    await db.collection('groups').doc(groupId).update({
        accountManagerEmails: enabled
            ? firebase.firestore.FieldValue.arrayUnion(normalizedEmail)
            : firebase.firestore.FieldValue.arrayRemove(normalizedEmail),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
}

async function updateSharedAccountGroupMeta(groupId, accountId, patch = {}) {
    ensureGroupState();
    const group = getGroupById(groupId);
    const account = getSharedAccountByIdFromState(groupId, accountId);
    if (!group || !account) throw new Error('Không tìm thấy tài khoản chia sẻ');
    if (!canManageSharedAccount(group, account)) throw new Error('Không có quyền quản lý tài khoản này');
    const update = cleanSharedAccountGroupMetaPatch(patch);
    if (!Object.keys(update).length) return true;

    if (window.appState.isDemo) {
        Object.assign(account, update, { updatedAt: new Date() });
        window.appState.sharedAccounts[groupId] = sortSharedAccountsForGroup(window.appState.sharedAccounts[groupId] || []);
        notifyGroupsChanged(groupId);
        return true;
    }

    await db.collection('groups').doc(groupId).collection('sharedAccounts').doc(accountId).update({
        ...update,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('groups').doc(groupId).update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
    return true;
}

function mapSharedAccountDoc(doc) {
    const data = doc.data() || {};
    const sortOrder = Number(data.groupSortOrder);
    return {
        id: doc.id,
        ...data,
        groupCategoryId: normalizeGroupCategoryId(data.groupCategoryId) || null,
        groupSortOrder: Number.isFinite(sortOrder) ? sortOrder : null,
        groupNote: String(data.groupNote || ''),
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
        window.appState.sharedAccounts[groupId] = sortSharedAccountsForGroup(window.appState.sharedAccounts[groupId] || []);
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
            const sortedAccounts = sortSharedAccountsForGroup(accounts);
            window.appState.sharedAccounts[groupId] = sortedAccounts;
            window.appState.sharedAccountCounts[groupId] = sortedAccounts.length;
            const group = getGroupById(groupId);
            if (group) group.sharedAccountCount = sortedAccounts.length;
            notifyGroupsChanged(groupId);
        }, (error) => {
            console.error('Load shared accounts error:', error);
            window.appState.sharedAccounts[groupId] = [];
            window.appState.sharedAccountCounts[groupId] = 0;
            if (typeof showToast === 'function') showToast(error.message || 'Không tải được tài khoản chia sẻ', 'error');
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
            if (typeof showToast === 'function') showToast(error.message || 'Không tải được yêu cầu sửa', 'error');
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
        name: safe.name || safe.serviceName || 'Tài khoản chia sẻ',
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
    if (!group) throw new Error('Không tìm thấy nhóm');
    if (!sharedPassword) throw new Error('Cần mở khoá nhóm trước khi chia sẻ');
    if (plainAccount?.id && hasSharedSourceAccount(groupId, plainAccount.id)) {
        throw new Error('Tài khoản này đã được chia sẻ lên nhóm');
    }
    const user = requireGroupUser();
    const writeData = await buildSharedAccountWriteData(plainAccount, sharedPassword);
    const sortOrder = Number(writeData.groupSortOrder);
    const payload = cleanGroupFirestoreData({
        ...writeData,
        groupCategoryId: normalizeGroupCategoryId(writeData.groupCategoryId) || null,
        groupSortOrder: Number.isFinite(sortOrder) ? sortOrder : getNextSharedAccountSortOrder(groupId),
        groupNote: String(writeData.groupNote || '').trim(),
        sharedByUid: user.uid,
        sharedByEmail: user.email,
        sourceAccountId: plainAccount?.id || null,
        updatedAt: window.appState.isDemo ? new Date() : firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: window.appState.isDemo ? new Date() : firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (window.appState.isDemo) {
        const id = `demo_shared_${Date.now()}`;
        const account = { id, ...payload, createdAt: new Date(), updatedAt: new Date() };
        window.appState.sharedAccounts[groupId] = sortSharedAccountsForGroup([account, ...(window.appState.sharedAccounts[groupId] || [])]);
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
    if (!group || !account) throw new Error('Không tìm thấy tài khoản chia sẻ');
    if (group.role !== 'owner' && account.sharedByUid !== user.uid) {
        throw new Error('Chỉ chủ nhóm hoặc người chia sẻ được lưu trực tiếp');
    }
    if (!sharedPassword) throw new Error('Cần mở khoá nhóm trước khi lưu');

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
    if (!group || !account) throw new Error('Không tìm thấy tài khoản chia sẻ');
    if (!sharedPassword) throw new Error('Cần mở khoá nhóm trước khi gửi yêu cầu sửa');

    const reviewerUid = account.sharedByUid || group.ownerUid;
    const reviewerEmail = normalizeGroupEmail(account.sharedByEmail || group.ownerEmail);
    if (!reviewerUid && !reviewerEmail) throw new Error('Tài khoản này thiếu người duyệt');

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
    if (!group || !request) throw new Error('Không tìm thấy yêu cầu sửa');
    const isReviewer = request.reviewerUid === user.uid || normalizeGroupEmail(request.reviewerEmail) === user.email;
    if (!isReviewer) throw new Error('Chỉ người chia sẻ tài khoản được duyệt');
    if (request.status !== 'pending') throw new Error('Yêu cầu này đã được xử lý');

    if (window.appState.isDemo) {
        const account = getSharedAccountByIdFromState(groupId, request.accountId);
        if (!account) throw new Error('Không tìm thấy tài khoản chia sẻ');
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
    if (!request) throw new Error('Không tìm thấy yêu cầu sửa');
    const isReviewer = request.reviewerUid === user.uid || normalizeGroupEmail(request.reviewerEmail) === user.email;
    if (!isReviewer) throw new Error('Chỉ người chia sẻ tài khoản được từ chối');
    if (request.status !== 'pending') throw new Error('Yêu cầu này đã được xử lý');

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
    const group = getGroupById(groupId);
    const account = getSharedAccountByIdFromState(groupId, accountId);
    if (!group || !account) throw new Error('Không tìm thấy tài khoản chia sẻ');
    if (!canManageSharedAccount(group, account)) throw new Error('Không có quyền gỡ tài khoản này');

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
window.getGroupAccountCategories = getGroupAccountCategories;
window.getGroupAccountManagerEmails = getGroupAccountManagerEmails;
window.canManageGroupAccounts = canManageGroupAccounts;
window.canManageSharedAccount = canManageSharedAccount;
window.updateGroupAccountCategories = updateGroupAccountCategories;
window.setGroupAccountManager = setGroupAccountManager;
window.updateSharedAccountGroupMeta = updateSharedAccountGroupMeta;
window.sortSharedAccountsForGroup = sortSharedAccountsForGroup;
window.getSharedEditRequestById = getSharedEditRequestById;
window.getSharedEditRequestsForAccount = getSharedEditRequestsForAccount;
window.hasSharedSourceAccount = hasSharedSourceAccount;
