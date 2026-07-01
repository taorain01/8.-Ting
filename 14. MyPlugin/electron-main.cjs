const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const PLUGIN_EXTENSIONS = new Set([
  'dll',
  'vst',
  'vst3',
  'component',
  'clap',
  'aaxplugin',
  'exe',
]);

const MAX_SCAN_DEPTH = 10;
const MAX_SCAN_RESULTS = 2500;
const IGNORED_EXE_PATTERNS = [
  /^unins\d*$/,
  /^uninstall(er)?$/,
  /^(install|installer|setup|repair|remove|update|updater)(x64|x86|win64|win32|64bit|32bit)?$/,
  /^(vc(redist|redistributable)|vcredist|visualcredist|microsoftvisualc)/,
  /^dotnet(runtime|desktopruntime|sdk)?/,
  /^dx(web)?setup$/,
  /^(lame|ffmpeg|ffprobe|7z|7za|crashpadhandler|elevate|helper)$/,
];
const IGNORED_DLL_PATTERNS = [
  /^(api-ms-win|concrt|ucrtbase|vcruntime|msvcp|msvcr)/,
  /^(libgcc|libstdc|libwinpthread)/,
  /^qt[56]/,
];

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: '#f5f6fa',
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    },
  }));

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function getPluginExtension(fileName) {
  const lower = fileName.toLowerCase();
  const extensions = ['aaxplugin', 'component', 'vst3', 'vst', 'clap', 'dll', 'exe'];
  return extensions.find(ext => lower.endsWith(`.${ext}`)) || '';
}

function isSupportedPluginName(fileName) {
  return PLUGIN_EXTENSIONS.has(getPluginExtension(fileName)) && !isIgnoredPluginCandidate(fileName);
}

function isIgnoredPluginCandidate(fileName) {
  const extension = getPluginExtension(fileName);
  const compactName = getCompactPluginFileBase(fileName);

  if (extension === 'exe') {
    return IGNORED_EXE_PATTERNS.some(pattern => pattern.test(compactName));
  }

  if (extension === 'dll') {
    return IGNORED_DLL_PATTERNS.some(pattern => pattern.test(compactName));
  }

  return false;
}

function getCompactPluginFileBase(fileName) {
  const baseName = path.basename(fileName).replace(/\.(aaxplugin|component|vst3?|clap|dll|exe)$/i, '');
  return baseName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '');
}

async function scanDirectory(rootPath, onProgress = () => {}) {
  const results = [];
  const progress = {
    active: true,
    status: '\u0110ang qu\u00e9t th\u01b0 m\u1ee5c...',
    phase: '\u0110ang duy\u1ec7t',
    currentPath: rootPath,
    foldersScanned: 0,
    itemsChecked: 0,
    candidatesFound: 0,
  };
  let lastProgressAt = 0;

  function sendProgress(patch = {}, force = false) {
    Object.assign(progress, patch, { candidatesFound: results.length });
    const now = Date.now();
    if (!force && now - lastProgressAt < 120) return;
    lastProgressAt = now;
    onProgress({ ...progress });
  }

  async function walk(currentPath, depth) {
    if (depth > MAX_SCAN_DEPTH || results.length >= MAX_SCAN_RESULTS) return;
    progress.foldersScanned += 1;
    sendProgress({ currentPath, status: '\u0110ang \u0111\u1ecdc th\u01b0 m\u1ee5c...' });

    let entries = [];
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    progress.itemsChecked += entries.length;
    sendProgress({ currentPath });

    for (const entry of entries) {
      if (results.length >= MAX_SCAN_RESULTS) break;
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (isSupportedPluginName(entry.name)) {
          results.push({ fileName: entry.name, fullPath });
          sendProgress({ currentPath: fullPath, phase: `${results.length} plugin` }, true);
          continue;
        }
        await walk(fullPath, depth + 1);
      } else if (entry.isFile() && isSupportedPluginName(entry.name)) {
        results.push({ fileName: entry.name, fullPath });
        sendProgress({ currentPath: fullPath, phase: `${results.length} plugin` }, true);
      }
    }
  }

  sendProgress({}, true);
  await walk(rootPath, 0);
  sendProgress({ status: '\u0110ang x\u1eed l\u00fd k\u1ebft qu\u1ea3...', phase: `${results.length} plugin` }, true);
  return results;
}

ipcMain.handle('scan-plugin-folder', async () => {
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn thư mục plugin để quét',
    properties: ['openDirectory'],
  });

  if (selection.canceled || !selection.filePaths.length) {
    return { canceled: true, rootPath: '', plugins: [] };
  }

  const rootPath = selection.filePaths[0];
  const sendProgress = progress => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan-plugin-progress', progress);
    }
  };
  const plugins = await scanDirectory(rootPath, sendProgress);
  return { canceled: false, rootPath, plugins };
});

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
