const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  updateTrayTooltip: text => ipcRenderer.invoke('tray:update-tooltip', text),
  setAutoStart: enabled => ipcRenderer.invoke('settings:set-auto-start', enabled),
  getAutoStart: () => ipcRenderer.invoke('settings:get-auto-start'),
  setAutoLockMinutes: minutes => ipcRenderer.invoke('settings:set-auto-lock-minutes', minutes),
  getAutoLockMinutes: () => ipcRenderer.invoke('settings:get-auto-lock-minutes'),
  sendNativeNotification: (title, body, options) => ipcRenderer.invoke('notification:send', { title, body, ...options }),
  openNotificationSettings: () => ipcRenderer.invoke('notification:open-settings'),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  getUpdateLog: () => ipcRenderer.invoke('updates:get-log'),
  getBackgroundCheckState: () => ipcRenderer.invoke('updates:get-bg-state'),
  setBackgroundCheckState: patch => ipcRenderer.invoke('updates:set-bg-state', patch),
  getShortcuts: () => ipcRenderer.invoke('settings:get-shortcuts'),
  setShortcut: (action, accelerator) => ipcRenderer.invoke('settings:set-shortcut', action, accelerator),
  resetShortcuts: () => ipcRenderer.invoke('settings:reset-shortcuts'),
  quitAndInstall: () => ipcRenderer.invoke('updates:quit-and-install'),
  onAutoLock: callback => {
    const handler = () => callback();
    ipcRenderer.on('auto-lock', handler);
    return () => ipcRenderer.removeListener('auto-lock', handler);
  },
  onShowNotifications: callback => {
    const handler = () => callback();
    ipcRenderer.on('show-notifications', handler);
    return () => ipcRenderer.removeListener('show-notifications', handler);
  },
  onUpdateEvent: callback => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('update-event', handler);
    return () => ipcRenderer.removeListener('update-event', handler);
  },
  onQuickAddRequest: callback => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('quick-add:save-request', handler);
    return () => ipcRenderer.removeListener('quick-add:save-request', handler);
  },
  onNavigationIntent: callback => {
    const handler = (_event, intent) => callback(intent);
    ipcRenderer.on('navigation-intent', handler);
    return () => ipcRenderer.removeListener('navigation-intent', handler);
  },
  sendQuickAddResult: result => ipcRenderer.send('quick-add:save-result', result),

  // ===== ĐIỀU KHIỂN CỬA SỔ (title bar tùy chỉnh) =====
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizeChanged: callback => {
    const handler = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window:maximize-changed', handler);
    return () => ipcRenderer.removeListener('window:maximize-changed', handler);
  },
});
