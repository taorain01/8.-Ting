const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quickAddAPI', {
  isElectron: true,
  saveQuickAccount: data => ipcRenderer.invoke('quick-add:save', data),
  closePopup: () => ipcRenderer.invoke('quick-add:close'),
  onShown: callback => {
    const handler = () => callback?.();
    ipcRenderer.on('quick-add:shown', handler);
    return () => ipcRenderer.removeListener('quick-add:shown', handler);
  },
});
