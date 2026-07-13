/* Ting! - Shared groups module
   Firestore CRUD + realtime sync for zero-knowledge shared accounts */

let groupsUnsubscribe = null;
const sharedAccountsUnsubscribes = new Map();
const sharedEditRequestsUnsubscribes = new Map();
const sharedAccountUpdateTimers = new Map();
const SHARED_ACCOUNT_UPDATE_HIGHLIGHT_MS = 3000;

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
    if (!window.appState.recentlyUpdatedSharedAccounts || typeof window.appState.recentlyUpdatedSharedAccounts !== 'object') window.appState.recentlyUpdatedSharedAccounts = {};
    if (window.appState.currentGroupId === undefined) window.appState.currentGroupId = null;
}

function getSharedAccountUpdateKey(groupId, accountId) {
    return `${groupId}:${accountId}`;
}

function isSharedAccountRecentlyUpdated(groupId, accountId) {
    ensureGroupState();
    return Number(window.appState.recentlyUpdatedSharedAccounts[getSharedAccountUpdateKey(groupId, accountId)] || 0) > Date.now();
}

function markSharedAccountRecentlyUpdated(groupId, accountId) {
    ensureGroupState();
    const key = getSharedAccountUpdateKey(groupId, accountId);
    window.appState.recentlyUpdatedSharedAccounts[key] = Date.now() + SHARED_ACCOUNT_UPDATE_HIGHLIGHT_MS;
    if (sharedAccountUpdateTimers.has(key)) clearTimeout(sharedAccountUpdateTimers.get(key));
    sharedAccountUpdateTimers.set(key, setTimeout(() => {
        delete window.appState.recentlyUpdatedSharedAccounts[key];
        sharedAccountUpdateTimers.delete(key);
        notifyGroupsChanged(groupId);
    }, SHARED_ACCOUNT_UPDATE_HIGHLIGHT_MS));
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
// Cờ tích luỹ cho cả cụm (burst): true nếu có bất kỳ Snapshot_Event nào đổi nội dung.
// Sự kiện chỉ đổi Snapshot_Metadata (fromCache/hasPendingWrites) không bật cờ này (Req 1.5).
let _pendingContentChanged = false;

// Bản đồ lưu "content signature" gần nhất theo nhóm để phát hiện thay đổi chỉ-metadata.
// So sánh nội dung đã map (bỏ qua pendingSync/metadata) giữa các Snapshot_Event.
const _sharedAccountsContentSig = new Map();
const _sharedEditRequestsContentSig = new Map();

// Chuỗi hoá nội dung danh sách để so sánh, loại bỏ trường metadata (pendingSync)
// nhằm chỉ phát hiện thay đổi nội dung hiển thị chứ không phải thay đổi fromCache/hasPendingWrites.
function computeGroupContentSignature(list) {
    try {
        return JSON.stringify((Array.isArray(list) ? list : []).map(item => {
            const clone = { ...(item || {}) };
            delete clone.pendingSync; // bỏ cờ metadata (hasPendingWrites) khỏi chữ ký nội dung
            return clone;
        }));
    } catch (e) {
        // Fallback an toàn: coi như luôn thay đổi để không bỏ sót render.
        return `__sig_${Date.now()}_${Math.random()}`;
    }
}

function runGroupsChangedRender() {
    _groupsRenderTimer = null;
    const groupId = _pendingGroupRenderId;
    const contentChanged = _pendingContentChanged;
    _pendingGroupRenderId = null;
    _pendingContentChanged = false;
    if (typeof updateHeader === 'function') updateHeader();
    const page = window.appState?.currentPage || '';
    if (page === 'groups' && typeof renderGroupList === 'function') renderGroupList();

    // Cổng render Group_Detail_View: dùng hàm thuần shouldRenderGroupDetail để quyết định.
    // Khi groupId là null (cập nhật chung, ví dụ danh sách nhóm) coi như nhắm đúng nhóm đang mở.
    const state = {
        currentPage: page,
        currentGroupId: window.appState?.currentGroupId || null,
    };
    const eventGroupId = (groupId === null) ? state.currentGroupId : groupId;
    const event = { groupId: eventGroupId, contentChanged };
    if (shouldRenderGroupDetail(state, event) && typeof renderGroupDetail === 'function') {
        // Data-driven refresh: render ở chế độ quiet để không phát lại entrance animation (tránh nháy).
        renderGroupDetail(state.currentGroupId, { quiet: true });
    }
    if (page === 'group-design' && (!groupId || window.appState.currentGroupId === groupId) && typeof renderGroupDesign === 'function') {
        renderGroupDesign(window.appState.currentGroupId || groupId);
    }
}

// Firestore snapshots (with includeMetadataChanges) + the group doc "updatedAt" write
// can fire this several times in a very short burst. Debounce so a burst collapses into
// a single repaint instead of the interface jittering 2-3 times.
// meta.contentChanged: false nếu Snapshot_Event chỉ đổi metadata (fromCache/hasPendingWrites);
// mặc định coi là có thay đổi nội dung để giữ tương thích ngược với các lời gọi cũ.
function notifyGroupsChanged(groupId = null, meta = {}) {
    if (groupId !== null) _pendingGroupRenderId = groupId;
    // undefined/không truyền => true (tương thích ngược); chỉ false khi khai báo tường minh.
    if ((meta && meta.contentChanged) !== false) _pendingContentChanged = true;
    if (_groupsRenderTimer) clearTimeout(_groupsRenderTimer);
    _groupsRenderTimer = setTimeout(runGroupsChangedRender, GROUP_RENDER_DEBOUNCE_MS);
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
    // Mật khẩu chung là TUỲ CHỌN: chỉ đặt khi chủ nhóm nhập. Nếu để trống thì
    // nhóm không yêu cầu mật khẩu (thành viên vào xem ngay, không cần mở khoá).
    const pw = String(sharedPassword || '');
    let sharedPwSalt = null;
    let sharedPwHash = null;
    if (pw) {
        if (pw.length < 6) throw new Error('Mật khẩu chung cần tối thiểu 6 ký tự');
        sharedPwSalt = generateSalt();
        sharedPwHash = await hashSharedPassword(pw, sharedPwSalt);
    }
    const user = requireGroupUser();

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
        if (pw) setGroupUnlocked(id, pw);
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
    if (pw) setGroupUnlocked(docRef.id, pw);
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

async function acceptGroupInvite(groupId, joinPassword = '') {
    ensureGroupState();
    const user = requireGroupUser();
    const group = getGroupInviteById(groupId) || getKnownGroupById(groupId);
    if (!group) throw new Error('Không tìm thấy lời mời');
    if (!(group.pendingMemberEmails || []).includes(user.email) && !window.appState.isDemo) {
        throw new Error('Email của bạn không có trong lời mời nhóm');
    }
    // Việc tham gia nhóm chỉ phụ thuộc Join_Password (nếu chủ nhóm đã đặt),
    // hoàn toàn tách rời khỏi Mật khẩu chung (Shared_Password). Không tự động
    // mở khoá dữ liệu nhạy cảm — việc đó vẫn cần Shared_Password riêng (Req 5.8, 9.4).
    if (isJoinPasswordEnabled(group)) {
        assertJoinRateLimitOk(groupId);
        const candidate = String(joinPassword ?? '').trim();
        if (!candidate) throw new Error('Nhập mật khẩu vào nhóm');
        const ok = await verifyGroupJoinPassword(group, candidate);
        if (!ok) {
            registerJoinFailure(groupId);
            throw new Error('Mật khẩu vào nhóm không đúng');
        }
        clearJoinFailures(groupId);
    }

    if (window.appState.isDemo) {
        group.pendingMemberEmails = (group.pendingMemberEmails || []).filter(item => item !== user.email);
        group.memberEmails = [...new Set([...(group.memberEmails || []), user.email])];
        group.role = group.ownerUid === user.uid ? 'owner' : 'member';
        group.updatedAt = new Date();
        window.appState.groupInvites = (window.appState.groupInvites || []).filter(item => item.id !== groupId);
        if (!window.appState.groups.some(item => item.id === groupId)) window.appState.groups.unshift(group);
        notifyGroupsChanged(groupId);
        return true;
    }

    // Không thay đổi mảng thành viên cục bộ trước khi ghi: nếu ghi lỗi thì
    // không có gì để rollback, người dùng vẫn ở nguyên trạng thái được mời (Req 4.5).
    try {
        await withJoinSaveTimeout(db.collection('groups').doc(groupId).update({
            memberEmails: firebase.firestore.FieldValue.arrayUnion(user.email),
            pendingMemberEmails: firebase.firestore.FieldValue.arrayRemove(user.email),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }));
    } catch (error) {
        throw new Error(error?.message || 'Không tham gia được nhóm');
    }
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
    // Nhóm không đặt mật khẩu chung ⇒ luôn hợp lệ (không cần mật khẩu).
    if (!groupHasSharedPassword(group)) return true;
    return verifySharedPassword(sharedPassword, group.sharedPwHash, group.sharedPwSalt);
}

// Nhóm chỉ được coi là "có mật khẩu chung" khi chủ nhóm đã đặt (có hash + salt).
function groupHasSharedPassword(group) {
    return Boolean(group?.sharedPwHash && group?.sharedPwSalt);
}

// Khoá mã hoá suy diễn dùng cho nhóm KHÔNG đặt mật khẩu chung.
// Dữ liệu nhạy cảm vẫn được mã hoá (không lưu plaintext), nhưng thành viên
// không phải nhập mật khẩu để xem — đúng yêu cầu "chỉ nhập khi chủ nhóm đặt".
function getGroupDerivedKey(groupId) {
    return `ting-open-group::${String(groupId || '')}`;
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
    const group = getKnownGroupById(groupId);
    // Nhóm không đặt mật khẩu ⇒ tự "mở khoá" bằng khoá suy diễn.
    if (group && !groupHasSharedPassword(group)) return getGroupDerivedKey(groupId);
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
            const previousAccounts = window.appState.sharedAccounts[groupId] || [];
            const previousById = new Map(previousAccounts.map(account => [account.id, account]));
            const accounts = [];
            snapshot.forEach(doc => accounts.push(mapSharedAccountDoc(doc)));
            const sortedAccounts = sortSharedAccountsForGroup(accounts);
            const currentUid = getCurrentGroupUser().uid;
            if (_sharedAccountsContentSig.has(groupId) && !snapshot.metadata?.fromCache) {
                sortedAccounts.forEach(account => {
                    const previous = previousById.get(account.id);
                    const previousVersion = Number(previous?.sourceVersion || 0);
                    const nextVersion = Number(account.sourceVersion || 0);
                    if (previous && nextVersion > previousVersion && account.updatedByUid && account.updatedByUid !== currentUid) {
                        const accountKey = getSharedAccountUpdateKey(groupId, account.id);
                        if (window.appState.decryptedSharedAccounts) delete window.appState.decryptedSharedAccounts[accountKey];
                        if (window.appState.decryptFailedSharedAccounts) delete window.appState.decryptFailedSharedAccounts[accountKey];
                        markSharedAccountRecentlyUpdated(groupId, account.id);
                    }
                });
            }
            window.appState.sharedAccounts[groupId] = sortedAccounts;
            window.appState.sharedAccountCounts[groupId] = sortedAccounts.length;
            const group = getGroupById(groupId);
            if (group) group.sharedAccountCount = sortedAccounts.length;
            // Phát hiện Snapshot_Event chỉ đổi metadata: so chữ ký nội dung với lần trước (Req 1.5).
            const sig = computeGroupContentSignature(sortedAccounts);
            const contentChanged = sig !== _sharedAccountsContentSig.get(groupId);
            _sharedAccountsContentSig.set(groupId, sig);
            notifyGroupsChanged(groupId, { contentChanged });
        }, (error) => {
            console.error('Load shared accounts error:', error);
            window.appState.sharedAccounts[groupId] = [];
            window.appState.sharedAccountCounts[groupId] = 0;
            _sharedAccountsContentSig.set(groupId, computeGroupContentSignature([]));
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
    _sharedAccountsContentSig.delete(groupId); // xoá chữ ký để lần listen sau coi là mới
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
            // Phát hiện Snapshot_Event chỉ đổi metadata: so chữ ký nội dung với lần trước (Req 1.5).
            const sig = computeGroupContentSignature(requests);
            const contentChanged = sig !== _sharedEditRequestsContentSig.get(groupId);
            _sharedEditRequestsContentSig.set(groupId, sig);
            notifyGroupsChanged(groupId, { contentChanged });
        }, (error) => {
            console.error('Load shared edit requests error:', error);
            window.appState.sharedEditRequests[groupId] = [];
            window.appState.sharedEditRequestCounts[groupId] = 0;
            _sharedEditRequestsContentSig.set(groupId, computeGroupContentSignature([]));
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
    _sharedEditRequestsContentSig.delete(groupId); // xoá chữ ký để lần listen sau coi là mới
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
        sourceVersion: 1,
        sourceUpdatedAt: window.appState.isDemo ? new Date() : firebase.firestore.FieldValue.serverTimestamp(),
        updatedByUid: user.uid,
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
    const optimisticAccount = mapSharedAccountDoc({
        id: docRef.id,
        data: () => ({ ...payload, createdAt: new Date(), updatedAt: new Date(), sourceUpdatedAt: new Date() }),
        metadata: { hasPendingWrites: true },
    });
    window.appState.sharedAccounts[groupId] = sortSharedAccountsForGroup([
        optimisticAccount,
        ...(window.appState.sharedAccounts[groupId] || []).filter(account => account.id !== docRef.id),
    ]);
    window.appState.sharedAccountCounts[groupId] = window.appState.sharedAccounts[groupId].length;
    notifyGroupsChanged(groupId);
    await db.collection('groups').doc(groupId).update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
    return docRef.id;
}

async function prepareSharedSourceAccountSync(sourceAccountId, plainAccount) {
    ensureGroupState();
    const user = requireGroupUser();
    const targets = [];
    for (const group of window.appState.groups || []) {
        for (const account of window.appState.sharedAccounts[group.id] || []) {
            if (account.sourceAccountId === sourceAccountId && account.sharedByUid === user.uid) targets.push({ group, account });
        }
    }
    if (!targets.length) return [];

    const passwords = new Map();
    for (const { group } of targets) {
        if (passwords.has(group.id)) continue;
        let password = getUnlockedGroupPassword(group.id);
        if (!password && groupHasSharedPassword(group)) {
            password = String(window.prompt?.(`Nhập mật khẩu chung để đồng bộ tài khoản vào nhóm “${group.name || ''}”:`) || '');
            if (!password) throw new Error(`Chưa mở khoá nhóm ${group.name || ''}`);
            if (!(await verifyGroupPassword(group, password))) throw new Error(`Mật khẩu nhóm ${group.name || ''} không đúng`);
            setGroupUnlocked(group.id, password);
        }
        if (!password) throw new Error(`Không có khoá mã hoá cho nhóm ${group.name || ''}`);
        passwords.set(group.id, password);
    }

    return Promise.all(targets.map(async ({ group, account }) => {
        const writeData = await buildSharedAccountWriteData({ ...account, ...plainAccount, id: sourceAccountId }, passwords.get(group.id));
        return {
            groupId: group.id,
            accountId: account.id,
            ref: db.collection('groups').doc(group.id).collection('sharedAccounts').doc(account.id),
            groupRef: db.collection('groups').doc(group.id),
            update: cleanGroupFirestoreData({
                ...writeData,
                sourceAccountId,
                sharedByUid: account.sharedByUid,
                sharedByEmail: account.sharedByEmail,
                groupCategoryId: account.groupCategoryId || null,
                groupSortOrder: account.groupSortOrder,
                groupNote: account.groupNote || '',
                sourceVersion: Math.max(Number(account.sourceVersion || 0) + 1, Date.now()),
                sourceUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedByUid: user.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            }),
        };
    }));
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

async function changeGroupSharedPassword(groupId, newPassword) {
    ensureGroupState();
    const group = getGroupById(groupId);
    if (!group) throw new Error('Không tìm thấy nhóm');
    if (group.role !== 'owner') throw new Error('Chỉ chủ nhóm được đổi mật khẩu chung');
    const newPw = String(newPassword || '');
    if (newPw && newPw.length < 6) throw new Error('Mật khẩu chung cần tối thiểu 6 ký tự');

    const hadPassword = groupHasSharedPassword(group);
    const currentKey = getUnlockedGroupPassword(groupId);
    if (hadPassword && !currentKey) throw new Error('Cần mở khoá nhóm trước khi đổi mật khẩu');
    const oldKey = currentKey || getGroupDerivedKey(groupId);
    const newKey = newPw || getGroupDerivedKey(groupId);

    let sharedPwHash = null;
    let sharedPwSalt = null;
    if (newPw) {
        sharedPwSalt = generateSalt();
        sharedPwHash = await hashSharedPassword(newPw, sharedPwSalt);
    }

    // Mã hoá lại toàn bộ tài khoản chia sẻ khi khoá đổi.
    const accounts = (window.appState.sharedAccounts?.[groupId] || []).slice();
    const reEncrypted = [];
    if (oldKey !== newKey) {
        for (const account of accounts) {
            const decrypted = await decryptSharedAccount(account, oldKey);
            if (!decrypted) throw new Error('Không giải mã được tài khoản chia sẻ để đổi mật khẩu');
            const payload = await encryptAccountData({
                username: decrypted.username || '',
                password: decrypted.password || '',
                twoFaCode: decrypted.twoFaCode || '',
                note: decrypted.note || '',
            }, newKey);
            reEncrypted.push({ id: account.id, payload });
        }
    }

    if (window.appState.isDemo) {
        reEncrypted.forEach(({ id, payload }) => {
            const acc = accounts.find(item => item.id === id);
            if (acc) { acc.encryptedData = payload.encryptedData; acc.salt = payload.salt; acc.iv = payload.iv; }
        });
        group.sharedPwHash = sharedPwHash;
        group.sharedPwSalt = sharedPwSalt;
        group.updatedAt = new Date();
        if (newPw) setGroupUnlocked(groupId, newPw);
        else if (window.appState.groupUnlocked) delete window.appState.groupUnlocked[groupId];
        window.appState.decryptedSharedAccounts = Object.fromEntries(
            Object.entries(window.appState.decryptedSharedAccounts || {}).filter(([key]) => !key.startsWith(`${groupId}:`))
        );
        notifyGroupsChanged(groupId);
        return true;
    }

    const groupRef = db.collection('groups').doc(groupId);
    const batch = db.batch();
    reEncrypted.forEach(({ id, payload }) => {
        batch.update(groupRef.collection('sharedAccounts').doc(id), {
            encryptedData: payload.encryptedData,
            salt: payload.salt,
            iv: payload.iv,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    });
    batch.update(groupRef, {
        sharedPwHash: newPw ? sharedPwHash : firebase.firestore.FieldValue.delete(),
        sharedPwSalt: newPw ? sharedPwSalt : firebase.firestore.FieldValue.delete(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    // Cập nhật state cục bộ để UI phản hồi ngay, không chờ snapshot.
    group.sharedPwHash = sharedPwHash;
    group.sharedPwSalt = sharedPwSalt;
    reEncrypted.forEach(({ id, payload }) => {
        const acc = (window.appState.sharedAccounts?.[groupId] || []).find(item => item.id === id);
        if (acc) { acc.encryptedData = payload.encryptedData; acc.salt = payload.salt; acc.iv = payload.iv; }
    });
    if (newPw) setGroupUnlocked(groupId, newPw);
    else if (window.appState.groupUnlocked) delete window.appState.groupUnlocked[groupId];
    window.appState.decryptedSharedAccounts = Object.fromEntries(
        Object.entries(window.appState.decryptedSharedAccounts || {}).filter(([key]) => !key.startsWith(`${groupId}:`))
    );
    notifyGroupsChanged(groupId);
    return true;
}

// ===================== Join_Password (mật khẩu vào nhóm) =====================
// Tách rời hoàn toàn với Shared_Password: chỉ gác cổng việc tham gia nhóm,
// không đụng tới sharedPwHash/sharedPwSalt và không suy ra khoá mã hoá.

const MIN_JOIN_PASSWORD_LENGTH = 6;
const MAX_JOIN_PASSWORD_LENGTH = 128;
const JOIN_SAVE_TIMEOUT_MS = 10000;

// Rate-limit chống dò mật khẩu (chỉ trong bộ nhớ, reset khi khởi động lại app).
const joinAttemptState = new Map(); // groupId -> { failures, lockedUntil }
const JOIN_MAX_ATTEMPTS = 5;
const JOIN_LOCK_MS = 60000;

// Nhóm bật Join_Password khi và chỉ khi có cả hash lẫn salt hợp lệ (không rỗng).
function isJoinPasswordEnabled(group) {
    return Boolean(group?.joinPwHash && group?.joinPwSalt);
}

function isValidJoinPasswordLength(value) {
    const len = String(value ?? '').length;
    return len >= MIN_JOIN_PASSWORD_LENGTH && len <= MAX_JOIN_PASSWORD_LENGTH;
}

// Xác minh Join_Password người dùng nhập với hash/salt của nhóm.
// Nhóm chưa bật Join_Password ⇒ luôn trả về không khớp (Req 7.6).
async function verifyGroupJoinPassword(group, joinPassword) {
    if (!isJoinPasswordEnabled(group)) return false;
    // Trim để khớp với cách lưu (setGroupJoinPassword băm giá trị đã trim),
    // tránh trường hợp mật khẩu có khoảng trắng đầu/cuối không bao giờ khớp.
    return verifyJoinPassword(String(joinPassword ?? '').trim(), group.joinPwHash, group.joinPwSalt);
}

// Xác định quyền chủ nhóm cho thao tác quản lý Join_Password (Req 6).
function assertGroupOwnerForJoinPassword(group) {
    const user = requireGroupUser();
    if (!group?.ownerUid || !user?.uid) throw new Error('Không thể xác minh quyền chủ nhóm');
    if (!isGroupOwnerUser(group, user)) throw new Error('Chỉ chủ nhóm mới có quyền quản lý mật khẩu vào nhóm');
    return user;
}

// Bọc thao tác ghi bằng timeout 10s để coi là offline khi quá hạn (Req 8.5).
function withJoinSaveTimeout(promise) {
    let timer = null;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Thao tác chưa được lưu (thiết bị offline hoặc quá thời gian)')), JOIN_SAVE_TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]).finally(() => { if (timer) clearTimeout(timer); });
}

function assertJoinRateLimitOk(groupId) {
    const state = joinAttemptState.get(groupId);
    if (state?.lockedUntil && Date.now() < state.lockedUntil) {
        const secondsLeft = Math.ceil((state.lockedUntil - Date.now()) / 1000);
        throw new Error(`Đã nhập sai quá nhiều lần. Thử lại sau ${secondsLeft} giây`);
    }
}

function registerJoinFailure(groupId) {
    const state = joinAttemptState.get(groupId) || { failures: 0, lockedUntil: 0 };
    state.failures += 1;
    if (state.failures >= JOIN_MAX_ATTEMPTS) {
        state.lockedUntil = Date.now() + JOIN_LOCK_MS;
        state.failures = 0;
    }
    joinAttemptState.set(groupId, state);
}

function clearJoinFailures(groupId) {
    joinAttemptState.delete(groupId);
}

// Đặt hoặc đổi Join_Password (chỉ chủ nhóm). Sinh salt mới mỗi lần lưu.
async function setGroupJoinPassword(groupId, joinPassword) {
    ensureGroupState();
    const group = getGroupById(groupId);
    if (!group) throw new Error('Không tìm thấy nhóm');
    assertGroupOwnerForJoinPassword(group);

    const pw = String(joinPassword ?? '');
    if (!isValidJoinPasswordLength(pw)) {
        throw new Error(`Mật khẩu vào nhóm cần từ ${MIN_JOIN_PASSWORD_LENGTH} đến ${MAX_JOIN_PASSWORD_LENGTH} ký tự`);
    }
    // Khi đang bật (đổi mật khẩu): giá trị mới phải khác giá trị cũ (Req 2.4).
    if (isJoinPasswordEnabled(group)) {
        const sameAsCurrent = await verifyGroupJoinPassword(group, pw);
        if (sameAsCurrent) throw new Error('Mật khẩu vào nhóm mới phải khác mật khẩu hiện tại');
    }

    const joinPwSalt = generateSalt();
    // Băm giá trị đã trim để nhất quán với luồng xác minh (verifyGroupJoinPassword trim input).
    const joinPwHash = await hashJoinPassword(pw.trim(), joinPwSalt);
    const snapshot = { joinPwHash: group.joinPwHash, joinPwSalt: group.joinPwSalt };

    if (window.appState.isDemo) {
        group.joinPwHash = joinPwHash;
        group.joinPwSalt = joinPwSalt;
        group.updatedAt = new Date();
        notifyGroupsChanged(groupId);
        return true;
    }

    // Áp dụng lạc quan lên state cục bộ, rollback nếu ghi thất bại/timeout.
    group.joinPwHash = joinPwHash;
    group.joinPwSalt = joinPwSalt;
    try {
        await withJoinSaveTimeout(db.collection('groups').doc(groupId).update({
            joinPwHash,
            joinPwSalt,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }));
    } catch (error) {
        group.joinPwHash = snapshot.joinPwHash;
        group.joinPwSalt = snapshot.joinPwSalt;
        notifyGroupsChanged(groupId);
        throw new Error(error?.message || 'Chưa lưu được mật khẩu vào nhóm');
    }
    notifyGroupsChanged(groupId);
    return true;
}

// Gỡ Join_Password, đưa nhóm về trạng thái Disabled (chỉ chủ nhóm).
async function removeGroupJoinPassword(groupId) {
    ensureGroupState();
    const group = getGroupById(groupId);
    if (!group) throw new Error('Không tìm thấy nhóm');
    assertGroupOwnerForJoinPassword(group);

    const snapshot = { joinPwHash: group.joinPwHash, joinPwSalt: group.joinPwSalt };

    if (window.appState.isDemo) {
        delete group.joinPwHash;
        delete group.joinPwSalt;
        group.updatedAt = new Date();
        notifyGroupsChanged(groupId);
        return true;
    }

    delete group.joinPwHash;
    delete group.joinPwSalt;
    try {
        await withJoinSaveTimeout(db.collection('groups').doc(groupId).update({
            joinPwHash: firebase.firestore.FieldValue.delete(),
            joinPwSalt: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }));
    } catch (error) {
        group.joinPwHash = snapshot.joinPwHash;
        group.joinPwSalt = snapshot.joinPwSalt;
        notifyGroupsChanged(groupId);
        throw new Error(error?.message || 'Chưa gỡ được mật khẩu vào nhóm');
    }
    notifyGroupsChanged(groupId);
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
window.groupHasSharedPassword = groupHasSharedPassword;
window.isJoinPasswordEnabled = isJoinPasswordEnabled;
window.isValidJoinPasswordLength = isValidJoinPasswordLength;
window.verifyGroupJoinPassword = verifyGroupJoinPassword;
window.setGroupJoinPassword = setGroupJoinPassword;
window.removeGroupJoinPassword = removeGroupJoinPassword;
window.getGroupDerivedKey = getGroupDerivedKey;
window.changeGroupSharedPassword = changeGroupSharedPassword;
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
window.prepareSharedSourceAccountSync = prepareSharedSourceAccountSync;
window.isSharedAccountRecentlyUpdated = isSharedAccountRecentlyUpdated;

/* =============================================================================
   Lớp logic thuần (pure functions) cho re-design tab Nhóm (group-tab-redesign).

   Các hàm dưới đây là THUẦN: không chạm DOM, không gọi Firestore, không side-effect
   (không đọc/ghi window.appState, không hẹn giờ). Chúng nhận đầu vào và trả về kết
   quả mới, dùng chung cho lớp render + handler và là đối tượng của property test.
   Xem "Correctness Properties 1-17" trong design.md để biết hợp đồng từng hàm.
   ============================================================================ */

// --- Hằng số cấu hình --------------------------------------------------------
const GROUP_RENDER_DEBOUNCE_MS = 50;       // Cửa sổ gộp cụm Snapshot_Event (Req 1.1, 1.3)
const DECRYPTION_TIMEOUT_MS = 5000;        // Ngưỡng timeout giải mã 1 tài khoản (Req 4.7)
const MAX_PENDING_INVITES = 100;           // Giới hạn số lời mời đang chờ (Req 8.5)
const MAX_INVITE_EMAIL_LENGTH = 254;       // Độ dài email mời tối đa (Req 8.2, 8.3)
const CATEGORY_NAME_MIN = 1;               // Độ dài tên danh mục tối thiểu (Req 6.3)
const CATEGORY_NAME_MAX = 50;              // Độ dài tên danh mục tối đa (Req 6.3, 6.4)
const VALID_GROUP_TABS = ['board', 'accounts', 'members']; // Ba tab con hợp lệ (Req 3.1)

// Chuẩn hoá một giá trị số về số nguyên không âm; mặc định 0 khi không hợp lệ.
function toNonNegativeInt(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
}

// --- Property 1: Điều kiện render Group_Detail_View (Req 1.4, 1.5, 1.6) ------
// Trả về true KHI VÀ CHỈ KHI: đang ở trang 'group-detail', đúng nhóm đang mở,
// và nội dung thực sự thay đổi (contentChanged === true). Sự kiện chỉ đổi
// Snapshot_Metadata (fromCache/hasPendingWrites) có contentChanged !== true.
function shouldRenderGroupDetail(state, event) {
    const s = state || {};
    const e = event || {};
    return s.currentPage === 'group-detail'
        && e.groupId === s.currentGroupId
        && e.contentChanged === true;
}

// --- Property 2: Chuẩn hoá Active_Subtab (Req 3.4, 3.6) ----------------------
// Luôn trả về một tab nằm trong danh sách khả dụng. Nếu tab hợp lệ và khả dụng
// thì giữ nguyên; ngược lại trả về 'board' (tab mặc định).
function normalizeGroupTab(tab, availableTabs) {
    // Lọc danh sách khả dụng về đúng tập tab hợp lệ; nếu rỗng thì dùng cả 3 tab.
    const filtered = (Array.isArray(availableTabs) ? availableTabs : [])
        .filter(item => VALID_GROUP_TABS.includes(item));
    const available = filtered.length ? filtered : VALID_GROUP_TABS.slice();
    const fallback = available.includes('board') ? 'board' : available[0];
    if (typeof tab === 'string' && VALID_GROUP_TABS.includes(tab) && available.includes(tab)) {
        return tab;
    }
    return fallback;
}

// --- Property 3: Danh sách lựa chọn của Category_Dropdown (Req 5.3) ----------
// Trả về mọi Account_Category cộng lựa chọn "Chưa phân loại" (id = null), độ dài
// = categories.length + 1, và đánh dấu active cho ĐÚNG MỘT lựa chọn khớp currentId
// (coi null/'' và id lạ là "Chưa phân loại").
function buildCategoryDropdownOptions(categories, currentId) {
    const list = Array.isArray(categories) ? categories : [];
    const current = normalizeGroupCategoryId(currentId);
    let matched = false;
    const options = list.map(cat => {
        const id = normalizeGroupCategoryId(cat?.id);
        const active = Boolean(current) && !matched && id === current;
        if (active) matched = true;
        return {
            id: cat?.id != null ? cat.id : (id || null),
            name: String(cat?.name || '').trim(),
            active,
        };
    });
    // "Chưa phân loại" active khi currentId rỗng hoặc không khớp danh mục nào.
    options.push({ id: null, name: 'Chưa phân loại', active: !matched });
    return options;
}

// --- Property 4: Chỉ gán lại danh mục khi thực sự đổi (Req 5.5) --------------
// Trả về true KHI VÀ CHỈ KHI hai id khác nhau sau khi chuẩn hoá null/'' về cùng
// dạng "Chưa phân loại".
function isCategoryReassignNeeded(currentId, selectedId) {
    return normalizeGroupCategoryId(currentId) !== normalizeGroupCategoryId(selectedId);
}

// --- Property 6: Validation tên Account_Category (Req 6.3, 6.4) --------------
// Chấp nhận KHI VÀ CHỈ KHI độ dài sau trim nằm trong [CATEGORY_NAME_MIN,
// CATEGORY_NAME_MAX] và không trùng tên (không phân biệt hoa/thường) với danh mục
// KHÁC trong cùng nhóm. `existingNames` có thể là mảng chuỗi tên hoặc mảng đối
// tượng { id, name }; khi là đối tượng và có `editingId` thì loại trừ chính danh
// mục đang sửa theo id. Trả về { valid, reason?, name }.
function validateCategoryName(name, existingNames, editingId) {
    const trimmed = String(name == null ? '' : name).trim();
    const length = trimmed.length;
    if (length < CATEGORY_NAME_MIN) return { valid: false, reason: 'empty', name: trimmed };
    if (length > CATEGORY_NAME_MAX) return { valid: false, reason: 'too_long', name: trimmed };

    const editing = editingId == null ? '' : normalizeGroupCategoryId(editingId);
    const key = trimmed.toLowerCase();
    const others = (Array.isArray(existingNames) ? existingNames : []).filter(entry => {
        // Loại chính danh mục đang sửa (chỉ áp dụng khi entry là đối tượng có id).
        if (editing && entry && typeof entry === 'object') {
            return normalizeGroupCategoryId(entry.id) !== editing;
        }
        return true;
    });
    const duplicated = others.some(entry => {
        const otherName = entry && typeof entry === 'object' ? entry.name : entry;
        return String(otherName == null ? '' : otherName).trim().toLowerCase() === key;
    });
    if (duplicated) return { valid: false, reason: 'duplicate', name: trimmed };
    return { valid: true, name: trimmed };
}

// Gán lại trường `order` theo đúng vị trí trong mảng (0..n-1) trên bản sao nông,
// để thứ tự lưu trữ khớp với thứ tự hiển thị sau khi di chuyển.
function reindexCategoryOrder(categories) {
    return (Array.isArray(categories) ? categories : []).map((cat, index) => ({ ...cat, order: index }));
}

// --- Property 7: Di chuyển thứ tự danh mục là hoán vị bảo toàn (Req 6.7, 6.8) -
// Trả về một hoán vị của cùng tập danh mục, chỉ hoán đổi danh mục chỉ định với
// danh mục liền kề theo hướng ('up'/'down'). Ở biên (đầu + up hoặc cuối + down)
// giữ nguyên trật tự. Trường `order` được đánh lại theo vị trí mới.
function moveCategoryOrder(categories, categoryId, direction) {
    const list = Array.isArray(categories) ? categories.slice() : [];
    const targetId = normalizeGroupCategoryId(categoryId);
    const index = list.findIndex(cat => normalizeGroupCategoryId(cat?.id) === targetId);
    const delta = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    if (index === -1 || delta === 0) return reindexCategoryOrder(list);
    const swapIndex = index + delta;
    if (swapIndex < 0 || swapIndex >= list.length) return reindexCategoryOrder(list);
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
    return reindexCategoryOrder(list);
}

// --- Property 8: Xoá danh mục chuyển account về "Chưa phân loại" (Req 6.6) ---
// Đặt groupCategoryId = null cho ĐÚNG các tài khoản thuộc danh mục bị xoá, giữ
// nguyên groupCategoryId của các tài khoản khác. Trả về mảng bản sao mới.
function reassignAccountsOnCategoryDelete(accounts, deletedId) {
    const target = normalizeGroupCategoryId(deletedId);
    return (Array.isArray(accounts) ? accounts : []).map(account => {
        const accCat = normalizeGroupCategoryId(account?.groupCategoryId);
        if (target && accCat === target) return { ...account, groupCategoryId: null };
        return { ...account };
    });
}

// --- Property 9: Board sections + "Chưa phân loại" ở cuối (Req 6.9, 6.10) ----
// Sinh các section theo thứ tự danh mục (sắp theo `order`), luôn thêm section
// "Chưa phân loại" ở cuối chứa các tài khoản không thuộc danh mục nào (kể cả
// tài khoản trỏ tới id danh mục không tồn tại). Hợp các section = đúng tập tài
// khoản đầu vào (không mất, không nhân bản).
function buildGroupBoardSections(accounts, categories) {
    const accountList = Array.isArray(accounts) ? accounts : [];
    const categoryList = (Array.isArray(categories) ? categories.slice() : [])
        .map((cat, index) => ({ cat, index }))
        .sort((a, b) => {
            const ao = Number(a.cat?.order);
            const bo = Number(b.cat?.order);
            const av = Number.isFinite(ao) ? ao : a.index;
            const bv = Number.isFinite(bo) ? bo : b.index;
            return av - bv || a.index - b.index;
        })
        .map(item => item.cat);

    const byId = new Map();
    const sections = categoryList.map(cat => {
        const id = normalizeGroupCategoryId(cat?.id);
        const section = { id: cat?.id != null ? cat.id : (id || null), name: String(cat?.name || '').trim(), accounts: [] };
        if (id) byId.set(id, section);
        return section;
    });

    const uncategorized = { id: null, name: 'Chưa phân loại', accounts: [] };
    accountList.forEach(account => {
        const catId = normalizeGroupCategoryId(account?.groupCategoryId);
        const section = catId && byId.has(catId) ? byId.get(catId) : uncategorized;
        section.accounts.push(account);
    });

    sections.push(uncategorized);
    // Sắp xếp tài khoản trong từng section theo groupSortOrder để hiển thị.
    sections.forEach(section => { section.accounts = sortSharedAccountsForGroup(section.accounts); });
    return sections;
}

// --- Property 10: Trạng thái nút di chuyển account theo vị trí (Req 7.2-7.4) --
// upDisabled === (index === 0); downDisabled === (index === total - 1). Khi
// total === 1 cả hai nút đều bị vô hiệu hoá.
function computeAccountMoveButtons(index, total) {
    const i = Number(index);
    const size = Number(total);
    const safeIndex = Number.isFinite(i) ? i : 0;
    const safeTotal = Number.isFinite(size) ? size : 0;
    return {
        upDisabled: safeIndex <= 0,
        downDisabled: safeIndex >= safeTotal - 1,
    };
}

// --- Property 11: Hoán đổi thứ tự account bảo toàn tập giá trị order (Req 7.5) -
// Chỉ hoán đổi giá trị groupSortOrder giữa tài khoản chỉ định và tài khoản liền
// kề theo hướng (xác định theo thứ tự hiển thị hiện tại). Tập giá trị
// groupSortOrder sau thao tác bằng đúng tập trước thao tác. Trả về mảng bản sao
// mới (giữ nguyên vị trí phần tử trong mảng gốc, chỉ đổi giá trị order).
function swapAccountSortOrder(accounts, accountId, direction) {
    const list = Array.isArray(accounts) ? accounts : [];
    const ordered = sortSharedAccountsForGroup(list);
    const pos = ordered.findIndex(acc => acc?.id === accountId);
    const delta = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    if (pos === -1 || delta === 0) return list.map(acc => ({ ...acc }));
    const swapPos = pos + delta;
    if (swapPos < 0 || swapPos >= ordered.length) return list.map(acc => ({ ...acc }));
    const a = ordered[pos];
    const b = ordered[swapPos];
    const aOrder = getSharedAccountSortValue(a, pos);
    const bOrder = getSharedAccountSortValue(b, swapPos);
    return list.map(acc => {
        if (acc?.id === a?.id) return { ...acc, groupSortOrder: bOrder };
        if (acc?.id === b?.id) return { ...acc, groupSortOrder: aOrder };
        return { ...acc };
    });
}

// --- Property 12: Validation email mời thành viên (Req 8.2-8.6) --------------
// Chấp nhận KHI VÀ CHỈ KHI: email khác rỗng, độ dài <= MAX_INVITE_EMAIL_LENGTH,
// đúng định dạng, chưa có trong memberEmails, chưa có trong pendingEmails, và
// pendingEmails.length < maxPending. Trả về { valid, reason?, email? }.
function validateInviteEmail(email, memberEmails, pendingEmails, maxPending) {
    const normalized = normalizeGroupEmail(email);
    const members = normalizeGroupEmailList(memberEmails);
    const pending = normalizeGroupEmailList(pendingEmails);
    const parsedLimit = Number(maxPending);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : MAX_PENDING_INVITES;

    if (!normalized) return { valid: false, reason: 'empty' };
    if (normalized.length > MAX_INVITE_EMAIL_LENGTH) return { valid: false, reason: 'too_long' };
    if (!isValidGroupEmail(normalized)) return { valid: false, reason: 'invalid_format' };
    if (pending.length >= limit) return { valid: false, reason: 'limit_reached' };
    if (members.includes(normalized)) return { valid: false, reason: 'already_member' };
    if (pending.includes(normalized)) return { valid: false, reason: 'already_pending' };
    return { valid: true, email: normalized };
}

// --- Property 13: Bật/tắt quyền Account_Manager là round-trip (Req 9.2, 9.3) -
// Bật (enable=true): email có mặt ĐÚNG MỘT LẦN (không nhân đôi). Tắt (enable=false):
// loại email khỏi danh sách. Từ danh sách không chứa email, bật rồi tắt khôi phục
// đúng trạng thái ban đầu (không tính thứ tự). Trả về danh sách email đã chuẩn hoá.
function toggleAccountManager(managerEmails, email, enable) {
    const list = normalizeGroupEmailList(managerEmails);
    const normalized = normalizeGroupEmail(email);
    if (!normalized) return list;
    const without = list.filter(item => item !== normalized);
    return enable ? [...without, normalized] : without;
}

// --- Property 14: Nhãn vai trò xác định duy nhất (Req 9.4) -------------------
// Ưu tiên: 'Chủ nhóm' nếu isOwner; ngược lại 'Quản lý TK' nếu isManager; ngược
// lại 'Thành viên'.
function computeRoleLabel(isOwner, isManager) {
    if (isOwner) return 'Chủ nhóm';
    if (isManager) return 'Quản lý TK';
    return 'Thành viên';
}

// --- Property 15: Quyết định duyệt/từ chối Edit_Request idempotent (Req 10.4, 10.5, 10.8) -
// Chỉ đổi trạng thái của request đang 'pending' thành quyết định ('approved'/
// 'rejected') và loại nó khỏi danh sách chờ. Nếu request đã được xử lý trước đó
// (approved/rejected) thì kết quả KHÔNG đổi (idempotence). Trả về
// { requests, pending, changed, request }.
function applyEditRequestDecision(requests, requestId, decision) {
    const list = Array.isArray(requests) ? requests : [];
    const normalizedDecision = (decision === 'approved' || decision === 'rejected') ? decision : null;
    let changed = false;
    let request = null;
    const updated = list.map(req => {
        if (req?.id === requestId && req?.status === 'pending' && normalizedDecision) {
            changed = true;
            request = { ...req, status: normalizedDecision };
            return request;
        }
        return req;
    });
    const pending = updated.filter(req => req?.status === 'pending');
    return { requests: updated, pending, changed, request };
}

// --- Property 16: Chỉ báo số Edit_Request trên thẻ account (Req 10.9, 10.10) --
// Hiện chỉ báo với đúng số khi count >= 1; ẩn khi count === 0. Trả về
// { visible, count } với count là số nguyên không âm.
function computeEditRequestBadge(count) {
    const safe = toNonNegativeInt(count);
    return { visible: safe >= 1, count: safe };
}

// --- Property 17: Số đếm header luôn là số nguyên không âm (Req 11.1, 11.2) --
// Trả về { memberCount, sharedAccountCount } đều là số nguyên >= 0, dùng 0 làm
// mặc định khi không lấy được (thiếu hoặc dữ liệu bẩn).
function computeGroupHeaderCounts(group) {
    const g = group || {};
    const memberCount = Array.isArray(g.memberEmails)
        ? g.memberEmails.length
        : toNonNegativeInt(g.memberCount);
    let sharedRaw = g.sharedAccountCount;
    if (sharedRaw == null && Array.isArray(g.sharedAccounts)) sharedRaw = g.sharedAccounts.length;
    const sharedAccountCount = toNonNegativeInt(sharedRaw);
    return { memberCount, sharedAccountCount };
}
