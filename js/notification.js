/* Ting! — Expiry Notification Module */

let notificationIntervalId = null;
const sentNotificationKeys = new Set();
const NOTIFICATION_SEEN_KEY = 'ting.notificationSeen';
const DAILY_NOTIFICATION_KEY = 'ting.dailyNotificationQuota';
const DAILY_NOTIFICATION_LIMIT = 1;
const LOCAL_NOTIFICATION_CHANNEL_ID = 'ting-expiry-alerts';
let localNotificationChannelReady = false;
const MAX_VISIBLE_OVERDUE_DAYS = 3;
const DEFAULT_NOTIFICATION_SETTINGS = {
    enabled: true,
    nativeEnabled: true,
    inAppEnabled: true,
    daysBefore: [5, 3, 1],
    repeatHours: 24,
    overdueDays: MAX_VISIBLE_OVERDUE_DAYS,
};

function normalizeNotifyDays(value) {
    const source = Array.isArray(value)
        ? value
        : String(value || '')
            .split(/[,\s;]+/)
            .map(item => item.trim());
    const days = [...new Set(source
        .map(item => Number.parseInt(item, 10))
        .filter(day => Number.isFinite(day) && day >= 0 && day <= 365))]
        .sort((a, b) => b - a);
    return days.length ? days : [...DEFAULT_NOTIFICATION_SETTINGS.daysBefore];
}

function getNotificationSettings() {
    const settings = window.appState?.settings || {};
    const notificationSettings = settings.notificationSettings || {};
    return {
        enabled: settings.notificationsEnabled ?? notificationSettings.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
        nativeEnabled: settings.nativeNotificationsEnabled ?? notificationSettings.nativeEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.nativeEnabled,
        inAppEnabled: settings.inAppNotificationsEnabled ?? notificationSettings.inAppEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.inAppEnabled,
        daysBefore: normalizeNotifyDays(settings.notifyDaysBefore ?? notificationSettings.daysBefore ?? settings.defaultNotifyDays),
        repeatHours: Math.max(DEFAULT_NOTIFICATION_SETTINGS.repeatHours, Number(settings.notifyRepeatHours ?? notificationSettings.repeatHours ?? DEFAULT_NOTIFICATION_SETTINGS.repeatHours) || DEFAULT_NOTIFICATION_SETTINGS.repeatHours),
        overdueDays: Math.min(MAX_VISIBLE_OVERDUE_DAYS, Math.max(0, Number(settings.notifyOverdueDays ?? notificationSettings.overdueDays ?? DEFAULT_NOTIFICATION_SETTINGS.overdueDays) || 0)),
    };
}

function readNotificationSeenMap() {
    try {
        const raw = localStorage.getItem(NOTIFICATION_SEEN_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function writeNotificationSeenMap(map) {
    try {
        localStorage.setItem(NOTIFICATION_SEEN_KEY, JSON.stringify(map || {}));
    } catch {}
}

function getTodayNotificationKey() {
    const now = new Date();
    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
    ].join('-');
}

function readDailyNotificationQuota() {
    const today = getTodayNotificationKey();
    try {
        const raw = localStorage.getItem(DAILY_NOTIFICATION_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.date === today) {
            return { date: today, count: Math.max(0, Number(parsed.count) || 0) };
        }
    } catch {}
    return { date: today, count: 0 };
}

function writeDailyNotificationQuota(quota) {
    try {
        localStorage.setItem(DAILY_NOTIFICATION_KEY, JSON.stringify(quota));
    } catch {}
}

function canSendDailyNotification() {
    return readDailyNotificationQuota().count < DAILY_NOTIFICATION_LIMIT;
}

function recordDailyNotificationSent() {
    const quota = readDailyNotificationQuota();
    quota.count += 1;
    writeDailyNotificationQuota(quota);
    return quota.count;
}

function getNotificationSeenKey(item) {
    const phase = Number(item?.daysLeft) < 0 ? 'expired' : 'upcoming';
    return `${item?.id || item?.name || 'account'}:${item?.expiryDate || 'no-date'}:${phase}`;
}

function isNotificationSeen(item) {
    return Boolean(readNotificationSeenMap()[getNotificationSeenKey(item)]);
}

function pruneNotificationSeenMap(items = []) {
    const validKeys = new Set((items || []).map(getNotificationSeenKey));
    const map = readNotificationSeenMap();
    let changed = false;
    Object.keys(map).forEach(key => {
        if (!validKeys.has(key)) {
            delete map[key];
            changed = true;
        }
    });
    if (changed) writeNotificationSeenMap(map);
}

function markNotificationsAsSeen(items = []) {
    const list = items || [];
    if (!list.length) return 0;
    const map = readNotificationSeenMap();
    const now = new Date().toISOString();
    let changed = 0;
    for (const item of list) {
        const key = getNotificationSeenKey(item);
        if (!map[key]) changed += 1;
        map[key] = now;
    }
    writeNotificationSeenMap(map);
    return changed;
}

function getUnreadNotificationList(accounts = []) {
    return getNotificationList(accounts).filter(item => !isNotificationSeen(item));
}

function isNativeCapacitorNotificationHost() {
    const platform = window.Capacitor?.getPlatform?.();
    return Boolean(window.Capacitor?.isNativePlatform?.()) || platform === 'android' || platform === 'ios';
}

function getLocalNotificationsPlugin() {
    const plugin = window.Capacitor?.Plugins?.LocalNotifications
        || window.LocalNotifications
        || window.capacitorLocalNotifications?.LocalNotifications
        || null;
    if (plugin) return plugin;
    if (window.Capacitor?.nativePromise) {
        return {
            checkPermissions: () => window.Capacitor.nativePromise('LocalNotifications', 'checkPermissions', {}),
            requestPermissions: () => window.Capacitor.nativePromise('LocalNotifications', 'requestPermissions', {}),
            schedule: options => window.Capacitor.nativePromise('LocalNotifications', 'schedule', options),
            createChannel: channel => window.Capacitor.nativePromise('LocalNotifications', 'createChannel', channel),
        };
    }
    return null;
}

function getTingNotificationsPlugin() {
    const plugin = window.Capacitor?.Plugins?.TingNotifications || window.TingNotifications || null;
    if (plugin) return plugin;
    if (window.Capacitor?.nativePromise) {
        return {
            openNotificationSettings: () => window.Capacitor.nativePromise('TingNotifications', 'openNotificationSettings', {}),
            startBackgroundCheck: () => window.Capacitor.nativePromise('TingNotifications', 'startBackgroundCheck', {}),
            stopBackgroundCheck: () => window.Capacitor.nativePromise('TingNotifications', 'stopBackgroundCheck', {}),
        };
    }
    return null;
}

function createNotificationId(seed) {
    const text = String(seed || `${Date.now()}`);
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return Math.max(1, Math.abs(hash));
}

async function ensureLocalNotificationChannel(plugin) {
    if (localNotificationChannelReady || !plugin?.createChannel || window.Capacitor?.getPlatform?.() !== 'android') return;
    try {
        await plugin.createChannel({
            id: LOCAL_NOTIFICATION_CHANNEL_ID,
            name: 'Nhắc hạn tài khoản',
            description: 'Thông báo tài khoản sắp hoặc đã hết hạn trong Ting!',
            importance: 4,
            visibility: 1,
            lights: true,
            vibration: true,
        });
        localNotificationChannelReady = true;
    } catch (error) {
        console.warn('Không tạo được notification channel:', error);
    }
}

async function requestNotificationPermission() {
    const localNotifications = getLocalNotificationsPlugin();
    if (localNotifications && isNativeCapacitorNotificationHost()) {
        try {
            const current = await localNotifications.checkPermissions?.();
            if (current?.display === 'granted') return 'granted';
            if (current?.display === 'denied') return 'denied';
            const requested = await localNotifications.requestPermissions?.();
            return requested?.display || 'prompt';
        } catch (error) {
            console.warn('Không xin được quyền thông báo native:', error);
            return 'unsupported';
        }
    }
    if (window.electronAPI?.isElectron) return 'granted';
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
        return await Notification.requestPermission();
    } catch {
        return Notification.permission;
    }
}

async function getNativeNotificationPermissionState() {
    const localNotifications = getLocalNotificationsPlugin();
    if (!localNotifications || !isNativeCapacitorNotificationHost()) return 'unsupported';
    try {
        const current = await localNotifications.checkPermissions?.();
        return current?.display || 'prompt';
    } catch {
        return 'unsupported';
    }
}

async function ensureNotificationPermissionOnStartup() {
    const settings = getNotificationSettings();
    if (!settings.enabled || !settings.nativeEnabled) return 'skipped';
    const localNotifications = getLocalNotificationsPlugin();
    if (!localNotifications || !isNativeCapacitorNotificationHost()) return 'unsupported';
    const current = await getNativeNotificationPermissionState();
    if (current === 'granted' || current === 'denied') return current;
    return requestNotificationPermission();
}

async function openNativeNotificationSettings() {
    if (window.electronAPI?.openNotificationSettings) {
        try {
            return await window.electronAPI.openNotificationSettings();
        } catch (error) {
            console.warn('Không mở được cài đặt thông báo Windows:', error);
            return false;
        }
    }
    const plugin = getTingNotificationsPlugin();
    if (!plugin?.openNotificationSettings) return false;
    try {
        await plugin.openNotificationSettings();
        return true;
    } catch (error) {
        console.warn('Không mở được cài đặt thông báo:', error);
        return false;
    }
}

async function startBackgroundNotificationCheck() {
    const settings = getNotificationSettings();
    if (!settings.enabled || !settings.nativeEnabled || !isNativeCapacitorNotificationHost()) return false;

    const permission = await requestNotificationPermission();
    if (permission !== 'granted') return false;

    const plugin = getTingNotificationsPlugin();
    if (!plugin?.startBackgroundCheck) return false;

    try {
        await plugin.startBackgroundCheck();
        return true;
    } catch (error) {
        console.warn('Khong dang ky duoc background notification check:', error);
        return false;
    }
}

async function stopBackgroundNotificationCheck() {
    const plugin = getTingNotificationsPlugin();
    if (!plugin?.stopBackgroundCheck || !isNativeCapacitorNotificationHost()) return false;

    try {
        await plugin.stopBackgroundCheck();
        return true;
    } catch (error) {
        console.warn('Khong huy duoc background notification check:', error);
        return false;
    }
}

function getNotificationList(accounts = [], options = {}) {
    const settings = getNotificationSettings();
    if (!settings.enabled) return [];
    const maxOverdueDays = Math.min(MAX_VISIBLE_OVERDUE_DAYS, Math.max(0, Number(settings.overdueDays) || 0));
    const maxDaysBefore = Math.max(...settings.daysBefore);
    const list = (accounts || [])
        .filter(acc => acc.expiryType !== 'lifetime' && acc.expiryDate)
        .map(acc => {
            const notifyDays = normalizeNotifyDays(acc.notifyDaysBefore ?? settings.daysBefore);
            const notifyWindow = Math.max(maxDaysBefore, ...notifyDays);
            const daysLeft = daysUntil(acc.expiryDate);
            return {
                ...acc,
                daysLeft,
                notifyWindow,
                seen: false,
            };
        })
        .filter(acc => {
            if (acc.daysLeft < 0) {
                return maxOverdueDays > 0 && Math.abs(acc.daysLeft) <= maxOverdueDays;
            }
            return acc.daysLeft <= acc.notifyWindow;
        })
        .map(acc => ({ ...acc, seen: isNotificationSeen(acc) }))
        .sort((a, b) => {
            const upcomingDiff = Number(a.daysLeft < 0) - Number(b.daysLeft < 0);
            if (upcomingDiff) return upcomingDiff;
            if (a.daysLeft < 0 && b.daysLeft < 0) return b.daysLeft - a.daysLeft;
            return a.daysLeft - b.daysLeft;
        });
    if (options.pruneSeen !== false) pruneNotificationSeenMap(list);
    return list;
}

async function sendNativeNotification(title, body, options = {}) {
    const localNotifications = getLocalNotificationsPlugin();
    if (localNotifications && isNativeCapacitorNotificationHost()) {
        const permission = await requestNotificationPermission();
        if (permission !== 'granted') return false;
        await ensureLocalNotificationChannel(localNotifications);
        const id = createNotificationId(options.key || `${title}:${body}`);
        await localNotifications.schedule({
            notifications: [{
                id,
                title,
                body,
                largeBody: body,
                summaryText: 'Ting!',
                schedule: { at: new Date(Date.now() + 1000) },
                channelId: LOCAL_NOTIFICATION_CHANNEL_ID,
                group: 'ting-expiry',
                autoCancel: true,
                extra: options.extra || {},
            }],
        });
        return true;
    }
    if (window.electronAPI?.sendNativeNotification) {
        return window.electronAPI.sendNativeNotification(title, body, {
            playSound: Boolean(options.playSound),
        });
    }
    if (!('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;
    new Notification(title, {
        body,
        icon: 'assets/icons/icon-512.png',
        badge: 'assets/icons/icon-512.png',
        silent: Boolean(options.playSound), // Tắt âm mặc định nếu phát âm riêng
    });
    return true;
}

async function checkExpiryAndNotify(accounts = window.appState?.accounts || []) {
    const settings = getNotificationSettings();
    const items = getNotificationList(accounts, { includeQuietOverdue: false, pruneSeen: false });
    if (!settings.enabled || !settings.nativeEnabled) return items;
    if (!canSendDailyNotification()) return items;
    const repeatMs = settings.repeatHours * 60 * 60 * 1000;
    const repeatBucket = Math.floor(Date.now() / repeatMs);

    // Lọc ra các TK chưa gửi thông báo trong chu kỳ hiện tại
    const newItems = [];
    for (const item of items) {
        const key = `${repeatBucket}:${item.id}:${item.daysLeft}`;
        if (sentNotificationKeys.has(key)) continue;
        sentNotificationKeys.add(key);
        newItems.push(item);
    }

    // Không có TK mới → bỏ qua
    if (newItems.length === 0) return items;

    // Gom thành 1 thông báo duy nhất, không spam
    const lines = newItems.map(item => {
        if (item.daysLeft < 0) return `• ${item.name} — quá hạn ${Math.abs(item.daysLeft)} ngày`;
        if (item.daysLeft === 0) return `• ${item.name} — hết hạn hôm nay!`;
        return `• ${item.name} — còn ${item.daysLeft} ngày`;
    });

    const title = newItems.length === 1
        ? 'Ting! nhắc hạn tài khoản'
        : `Ting! ${newItems.length} tài khoản cần chú ý`;
    const body = lines.join('\n');

    const sent = await sendNativeNotification(title, body, {
        key: `batch:${repeatBucket}:${newItems.map(i => i.id).join(',')}`,
        playSound: true, // Phát âm thanh cảnh báo
        extra: {
            accountIds: newItems.map(i => i.id),
            count: newItems.length,
        },
    });
    if (sent) recordDailyNotificationSent();

    return items;
}

function schedulePeriodicCheck(getAccounts = () => window.appState?.accounts || []) {
    if (notificationIntervalId) clearInterval(notificationIntervalId);
    const settings = getNotificationSettings();
    const intervalMs = Math.max(6, settings.repeatHours) * 60 * 60 * 1000;
    notificationIntervalId = setInterval(() => {
        checkExpiryAndNotify(getAccounts());
    }, intervalMs);
    setTimeout(() => checkExpiryAndNotify(getAccounts()), 10000);
    return notificationIntervalId;
}
