const { app, BrowserWindow, Menu, Notification, Tray, globalShortcut, ipcMain, powerMonitor, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch {
  autoUpdater = null;
}

const APP_ROOT = path.resolve(__dirname, '..', '..');
const WINDOW_ICON = path.join(APP_ROOT, 'DongGoi', 'build', 'icon.ico');
const PRELOAD_PATH = path.join(__dirname, 'preload.cjs');

const DEFAULT_SETTINGS = {
  autoStart: true,
  autoLockMinutes: 5,
  updateLog: [],
};

let localServer = null;
let appOrigin = '';
let appUrl = '';
let mainWindow = null;
let tray = null;
let store = null;
let isQuitting = false;
let idleTimer = null;
let lastAutoLockAt = 0;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

if (process.platform === 'win32') {
  app.setAppUserModelId('app.ting.accountmanager');
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function resolveStaticFile(requestUrl) {
  const url = new URL(requestUrl, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(APP_ROOT, relativePath);

  if (!filePath.startsWith(APP_ROOT)) return null;
  return filePath;
}

function createLocalServer() {
  if (localServer && appUrl) return Promise.resolve(appUrl);

  localServer = http.createServer((req, res) => {
    const filePath = resolveStaticFile(req.url || '/');
    if (!filePath) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve, reject) => {
    localServer.once('error', reject);
    localServer.listen(0, 'localhost', () => {
      const address = localServer.address();
      appUrl = `http://localhost:${address.port}/index.html`;
      appOrigin = `http://localhost:${address.port}`;
      resolve(appUrl);
    });
  });
}

function closeLocalServer() {
  if (!localServer) return;
  localServer.close();
  localServer = null;
  appOrigin = '';
  appUrl = '';
}

function createJsonStore(defaults) {
  const filePath = path.join(app.getPath('userData'), 'settings.json');
  let data = { ...defaults };
  try {
    if (fs.existsSync(filePath)) {
      data = { ...defaults, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
    }
  } catch {
    data = { ...defaults };
  }

  const persist = () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  };

  return {
    get(key, fallback) {
      return data[key] ?? fallback;
    },
    set(key, value) {
      data[key] = value;
      persist();
    },
  };
}

async function createSettingsStore() {
  try {
    const mod = await import('electron-store');
    const Store = mod.default || mod;
    return new Store({ defaults: DEFAULT_SETTINGS });
  } catch {
    return createJsonStore(DEFAULT_SETTINGS);
  }
}

function showMainWindow() {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function sendToRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

async function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return mainWindow;
  }

  const url = await createLocalServer();
  const startHidden = process.argv.includes('--hidden');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Ting!',
    backgroundColor: '#F8F9FC',
    icon: WINDOW_ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: PRELOAD_PATH,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    if (!startHidden) mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (/^https?:\/\//i.test(targetUrl) || /^mailto:/i.test(targetUrl)) {
      shell.openExternal(targetUrl);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (/^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith(appOrigin)) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  mainWindow.loadURL(url);
  return mainWindow;
}

function createTray() {
  if (tray) return tray;
  tray = new Tray(WINDOW_ICON);
  tray.setToolTip('Ting!');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở Ting!', click: showMainWindow },
    {
      label: 'Kiểm tra hết hạn',
      click: () => {
        showMainWindow();
        sendToRenderer('show-notifications');
      },
    },
    { type: 'separator' },
    {
      label: 'Thoát',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
  tray.on('double-click', showMainWindow);
  return tray;
}

function applyAutoStart() {
  if (process.platform !== 'win32') return;
  const openAtLogin = Boolean(store?.get('autoStart', true));
  app.setLoginItemSettings({
    openAtLogin,
    openAsHidden: true,
    args: ['--hidden'],
  });
}

function startAutoLockWatcher() {
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = setInterval(() => {
    const minutes = Number(store?.get('autoLockMinutes', 5) || 0);
    if (!minutes || !mainWindow || mainWindow.isDestroyed()) return;
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const shouldLock = idleSeconds >= minutes * 60;
    const cooledDown = Date.now() - lastAutoLockAt > Math.max(30000, minutes * 60 * 1000);
    if (shouldLock && cooledDown) {
      lastAutoLockAt = Date.now();
      sendToRenderer('auto-lock');
    }
  }, 15000);
}

function appendUpdateLog(entry) {
  const current = store?.get('updateLog', []) || [];
  const next = [{ ...entry, date: new Date().toLocaleString('vi-VN') }, ...current].slice(0, 10);
  store?.set('updateLog', next);
  return next;
}

function sendUpdateEvent(payload) {
  const log = store?.get('updateLog', []) || [];
  sendToRenderer('update-event', { ...payload, log });
}

function setupAutoUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateEvent({ status: 'checking', message: 'Đang kiểm tra cập nhật...' });
  });
  autoUpdater.on('update-available', info => {
    sendUpdateEvent({ status: 'available', message: `Có bản cập nhật ${info.version}`, info });
  });
  autoUpdater.on('update-not-available', () => {
    sendUpdateEvent({ status: 'not-available', message: 'Bạn đang dùng bản mới nhất' });
  });
  autoUpdater.on('download-progress', progress => {
    sendUpdateEvent({ status: 'downloading', message: `Đang tải ${Math.round(progress.percent || 0)}%`, progress });
  });
  autoUpdater.on('update-downloaded', info => {
    const log = appendUpdateLog({ version: info.version || 'unknown', status: 'downloaded' });
    sendToRenderer('update-event', {
      status: 'downloaded',
      message: `Đã tải xong bản ${info.version || ''}`,
      info,
      log,
    });
  });
  autoUpdater.on('error', error => {
    sendUpdateEvent({ status: 'error', type: 'error', message: error?.message || 'Lỗi cập nhật' });
  });
}

function setupIpc() {
  ipcMain.handle('tray:update-tooltip', (_event, text) => {
    tray?.setToolTip(String(text || 'Ting!'));
    return true;
  });

  ipcMain.handle('settings:get-auto-start', () => Boolean(store?.get('autoStart', true)));
  ipcMain.handle('settings:set-auto-start', (_event, enabled) => {
    store?.set('autoStart', Boolean(enabled));
    applyAutoStart();
    return Boolean(enabled);
  });

  ipcMain.handle('settings:get-auto-lock-minutes', () => Number(store?.get('autoLockMinutes', 5)));
  ipcMain.handle('settings:set-auto-lock-minutes', (_event, minutes) => {
    const value = Math.max(0, Number(minutes) || 0);
    store?.set('autoLockMinutes', value);
    return value;
  });

  ipcMain.handle('notification:send', (_event, payload) => {
    const title = String(payload?.title || 'Ting!');
    const body = String(payload?.body || '');
    if (Notification.isSupported()) {
      new Notification({ title, body, icon: WINDOW_ICON }).show();
      return true;
    }
    return false;
  });

  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('updates:get-log', () => store?.get('updateLog', []) || []);
  ipcMain.handle('updates:check', async () => {
    if (!autoUpdater) throw new Error('electron-updater chưa được cài đặt');
    return autoUpdater.checkForUpdates();
  });
  ipcMain.handle('updates:quit-and-install', () => {
    if (!autoUpdater) return false;
    isQuitting = true;
    autoUpdater.quitAndInstall();
    return true;
  });
}

function registerGlobalShortcuts() {
  globalShortcut.register('Control+Shift+T', showMainWindow);
}

if (gotSingleInstanceLock) {
  app.on('second-instance', showMainWindow);

  app.whenReady().then(async () => {
    store = await createSettingsStore();
    applyAutoStart();
    setupIpc();
    setupAutoUpdater();
    await createMainWindow();
    createTray();
    registerGlobalShortcuts();
    startAutoLockWatcher();

    if (autoUpdater && app.isPackaged) {
      setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 7000);
    }

    app.on('activate', showMainWindow);
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (idleTimer) clearInterval(idleTimer);
});

app.on('window-all-closed', () => {
  closeLocalServer();
  if (process.platform !== 'darwin') app.quit();
});
