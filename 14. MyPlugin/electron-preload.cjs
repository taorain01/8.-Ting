const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('myPluginDesktop', {
  scanPluginFolder: options => ipcRenderer.invoke('scan-plugin-folder', options || {}),
  onScanPluginProgress: callback => {
    const listener = (_event, progress) => callback(progress || {});
    ipcRenderer.on('scan-plugin-progress', listener);
    return () => ipcRenderer.removeListener('scan-plugin-progress', listener);
  },
});
