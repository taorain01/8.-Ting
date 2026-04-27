/* Ting! — Expiry Notification Module */

let notificationIntervalId = null;
const sentNotificationKeys = new Set();

async function requestNotificationPermission() {
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

function getNotificationList(accounts = []) {
    const list = (accounts || [])
        .filter(acc => acc.expiryType !== 'lifetime' && acc.expiryDate)
        .map(acc => ({
            ...acc,
            daysLeft: daysUntil(acc.expiryDate),
            notifyWindow: Math.max(...(acc.notifyDaysBefore || [5, 3, 1])),
        }))
        .filter(acc => acc.daysLeft < 0 || acc.daysLeft <= acc.notifyWindow)
        .sort((a, b) => a.daysLeft - b.daysLeft);
    return list;
}

async function sendNativeNotification(title, body) {
    if (window.electronAPI?.sendNativeNotification) {
        return window.electronAPI.sendNativeNotification(title, body);
    }
    if (!('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;
    new Notification(title, {
        body,
        icon: 'assets/icons/icon-512.png',
        badge: 'assets/icons/icon-512.png',
    });
    return true;
}

async function checkExpiryAndNotify(accounts = window.appState?.accounts || []) {
    const today = todayStr();
    const items = getNotificationList(accounts);
    for (const item of items) {
        const key = `${today}:${item.id}:${item.daysLeft}`;
        if (sentNotificationKeys.has(key)) continue;
        sentNotificationKeys.add(key);
        const body = item.daysLeft < 0
            ? `${item.name} đã quá hạn ${Math.abs(item.daysLeft)} ngày`
            : item.daysLeft === 0
                ? `${item.name} hết hạn hôm nay`
                : `${item.name} còn ${item.daysLeft} ngày`;
        await sendNativeNotification('Ting! nhắc hạn tài khoản', body);
    }
    return items;
}

function schedulePeriodicCheck(getAccounts = () => window.appState?.accounts || []) {
    if (notificationIntervalId) clearInterval(notificationIntervalId);
    notificationIntervalId = setInterval(() => {
        checkExpiryAndNotify(getAccounts());
    }, 60 * 60 * 1000);
    setTimeout(() => checkExpiryAndNotify(getAccounts()), 4000);
    return notificationIntervalId;
}
