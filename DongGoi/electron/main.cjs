const { app, BrowserWindow, Menu, Notification, Tray, globalShortcut, ipcMain, powerMonitor, shell } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

// ===== Module logic thuần dùng chung (Update_System) =====
// Nguồn sự thật duy nhất cho so sánh phiên bản và các quyết định logic cập nhật,
// dùng chung giữa Electron main (Node) và webview Android. Thay cho các bản sao
// cục bộ trước đây trong file này (compareVersions/normalizeVersion/
// sanitizeUpdateMessage/appendUpdateLog).
const { normalizeVersion, compareVersions } = require('../../js/shared/version-compare.js');
const { sanitizeUpdateMessage, appendUpdateLogEntry } = require('../../js/shared/update-core.js');

const FIREBASE_AUTH_DOMAIN = 'ting-d2c78.firebaseapp.com';
const LOCAL_APP_HOSTNAME = 'localhost';
const LOCAL_APP_BIND_HOST = '127.0.0.1';
const LOCAL_APP_PORT = Number(process.env.TING_APP_PORT || 42887);
const GITHUB_OWNER = 'taorain01';
const GITHUB_REPO = '8.-Ting';
const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const IS_TEST = process.argv.includes('--ting-test') || process.env.TING_TEST === '1';
const QUIT_FOR_INSTALL_ARGS = new Set(['--quit-for-install', '--quit-for-update']);

function hasQuitForInstallArg(argv = []) {
  return argv.some(arg => QUIT_FOR_INSTALL_ARGS.has(String(arg || '').toLowerCase()));
}

const SHOULD_QUIT_FOR_INSTALL = hasQuitForInstallArg(process.argv);

// Keep the browser URL as localhost for Firebase Auth, but avoid slow localhost
// DNS/proxy paths on Windows by binding and resolving to IPv4 directly.
app.commandLine.appendSwitch('host-resolver-rules', `MAP ${LOCAL_APP_HOSTNAME} ${LOCAL_APP_BIND_HOST}`);
app.commandLine.appendSwitch('no-proxy-server');

let autoUpdater = null;
let autoUpdaterLoadAttempted = false;
let autoUpdaterSetupDone = false;
// KHOÁ single-flight cho luồng tải bản cập nhật desktop: đảm bảo chỉ một tiến
// trình tải diễn ra tại một thời điểm (Yêu cầu 3.4). Được đặt `true` khi bắt
// đầu `downloadUpdate()` và trả về `false` khi tải xong hoặc lỗi.
let updateDownloadInFlight = false;

const IS_DEV = !app.isPackaged;
const APP_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGED_WINDOW_ICON = path.join(process.resourcesPath, 'icon.ico');
const DEFAULT_WINDOW_ICON = !IS_DEV && fs.existsSync(PACKAGED_WINDOW_ICON)
  ? PACKAGED_WINDOW_ICON
  : path.join(APP_ROOT, 'DongGoi', 'build', 'icon.ico');
const TEST_WINDOW_ICON = path.join(APP_ROOT, 'DongGoi', 'build', 'icon-test.ico');
const WINDOW_ICON = IS_TEST && fs.existsSync(TEST_WINDOW_ICON) ? TEST_WINDOW_ICON : DEFAULT_WINDOW_ICON;
const PRELOAD_PATH = path.join(__dirname, 'preload.cjs');
const QUICK_ADD_PRELOAD_PATH = path.join(__dirname, 'preload-quickadd.cjs');
const TEST_LOG_PATH = path.join(APP_ROOT, 'ting-test.log');

// ===== ÂM THANH CẢNH BÁO =====
// File âm thanh tùy chỉnh trong thư mục build, fallback sang âm Windows
const CUSTOM_ALERT_SOUND = path.join(APP_ROOT, 'DongGoi', 'build', 'notification.wav');
const WINDOWS_ALERT_SOUNDS = [
  'Windows Notify Calendar.wav',
  'Windows Notify Email.wav',
  'Windows Notify System Generic.wav',
  'chimes.wav',
];
let lastSoundPlayedAt = 0;
const SOUND_DEBOUNCE_MS = 10000; // Không phát lại trong 10 giây

// Phát âm thanh cảnh báo trên Windows qua PowerShell (zero dependency)
// Ưu tiên file tùy chỉnh trong build/, fallback sang âm hệ thống Windows
function playAlertSound() {
  if (process.platform !== 'win32') return;

  const now = Date.now();
  if (now - lastSoundPlayedAt < SOUND_DEBOUNCE_MS) {
    testLog('playAlertSound debounced', `${now - lastSoundPlayedAt}ms since last`);
    return;
  }
  lastSoundPlayedAt = now;

  // Tìm file âm thanh: tùy chỉnh → Windows built-in
  let soundFile = '';
  if (fs.existsSync(CUSTOM_ALERT_SOUND)) {
    soundFile = CUSTOM_ALERT_SOUND;
  } else {
    const winMediaDir = path.join(process.env.SystemRoot || 'C:\\Windows', 'Media');
    for (const name of WINDOWS_ALERT_SOUNDS) {
      const candidate = path.join(winMediaDir, name);
      if (fs.existsSync(candidate)) {
        soundFile = candidate;
        break;
      }
    }
  }

  if (!soundFile) {
    testLog('playAlertSound no sound file found');
    return;
  }

  testLog('playAlertSound', soundFile);
  // PowerShell SoundPlayer phát WAV không cần dependency ngoài
  const psCommand = `(New-Object System.Media.SoundPlayer '${soundFile.replace(/'/g, "''")}').PlaySync()`;
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
    windowsHide: true,
    timeout: 10000,
  }, (error) => {
    if (error) testLog('playAlertSound error', error?.message || String(error));
  });
}

const DEFAULT_SHORTCUTS = {
  openApp: 'Control+Shift+T',
  quickAdd: 'Control+Shift+S',
};

const DEFAULT_SETTINGS = {
  autoStart: true,
  autoLockMinutes: 5,
  updateLog: [],
  shortcuts: { ...DEFAULT_SHORTCUTS },
  // BackgroundCheckState (Update_System): `enabled` mặc định BẬT (Yêu cầu 7.1),
  // `lastCheckAt` (epoch ms) phục vụ ngưỡng 24h (Yêu cầu 7.4).
  backgroundCheck: { enabled: true, lastCheckAt: null },
};

app.setName(IS_DEV ? (IS_TEST ? 'Ting! Test' : 'Ting! Dev') : 'Ting!');
if (IS_DEV) {
  if (IS_TEST) {
    const testUserDataPath = path.join(APP_ROOT, '.ting-test-user-data');
    fs.mkdirSync(testUserDataPath, { recursive: true });
    app.setPath('userData', testUserDataPath);
  } else {
    app.setPath('userData', path.join(app.getPath('userData'), 'dev'));
  }
}

let localServer = null;
let appOrigin = '';
let appUrl = '';
let mainWindow = null;
let quickAddWindow = null;
let tray = null;
let store = null;
let isQuitting = false;
let idleTimer = null;
let lastAutoLockAt = 0;
const quickAddResolvers = new Map();

// ===== KHỞI TẠO SETTINGS STORE NGAY LẬP TỨC =====
// Dùng JSON store trực tiếp, không dynamic import electron-store (chậm do ESM)
// → Tiết kiệm ~1-3s so với await import('electron-store')
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
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch {}
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

// Khởi tạo store ngay khi module load — đồng bộ, không chờ
store = createJsonStore(DEFAULT_SETTINGS);

function getSetting(key, fallback) {
  return store?.get(key, fallback) ?? fallback;
}

function getSettingsStore() {
  return Promise.resolve(store);
}

// ===== TEST LOGGING =====
function testLog(message, details = '') {
  if (!IS_TEST) return;
  const line = `[${new Date().toISOString()}] ${message}${details ? ` ${details}` : ''}\n`;
  try {
    process.stdout.write(line);
  } catch {}
  try {
    fs.appendFileSync(TEST_LOG_PATH, line, 'utf8');
  } catch {}
}

process.on('uncaughtException', (error) => {
  testLog('uncaughtException', error?.stack || error?.message || String(error));
});

process.on('unhandledRejection', (error) => {
  testLog('unhandledRejection', error?.stack || error?.message || String(error));
});

// ===== CONSTANTS =====
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

function isNavigationAbort(error) {
  const message = error?.message || String(error || '');
  return error?.code === -3 || message.includes('ERR_ABORTED');
}

function isNetworkLoadFailure(error) {
  const message = error?.message || String(error || '');
  return error?.code === -2 || message.includes('ERR_FAILED');
}

if (process.platform === 'win32') {
  app.setAppUserModelId(IS_DEV ? 'app.ting.accountmanager.dev' : 'app.ting.accountmanager');
}

testLog('main start', process.argv.join(' | '));
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  testLog('single instance lock failed');
  app.quit();
}
if (gotSingleInstanceLock && SHOULD_QUIT_FOR_INSTALL) {
  testLog('quit-for-install requested without existing instance');
  app.quit();
}

Menu.setApplicationMenu(null);

// ===== LOCAL SERVER =====
function resolveStaticFile(requestUrl) {
  const url = new URL(requestUrl, `http://${LOCAL_APP_HOSTNAME}`);
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(APP_ROOT, relativePath);

  if (!filePath.startsWith(APP_ROOT)) return null;
  return filePath;
}

function createLocalServer() {
  if (localServer && appUrl) return Promise.resolve(appUrl);

  localServer = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${LOCAL_APP_HOSTNAME}`);
    const pathname = decodeURIComponent(url.pathname);
    const requestStartedAt = Date.now();
    const logRequest = (status, extra = '') => {
      testLog('server request', `${status} ${req.method || 'GET'} ${pathname} ${Date.now() - requestStartedAt}ms${extra ? ` ${extra}` : ''}`);
    };

    // Proxy Firebase Auth handler → signInWithPopup hoạt động trong Electron
    if (pathname.startsWith('/__/')) {
      const proxyUrl = `https://${FIREBASE_AUTH_DOMAIN}${pathname}${url.search || ''}`;
      https.get(proxyUrl, (proxyRes) => {
        const headers = { ...proxyRes.headers };
        delete headers['x-frame-options'];
        res.writeHead(proxyRes.statusCode, headers);
        logRequest(proxyRes.statusCode || 200, 'firebase-proxy');
        proxyRes.pipe(res);
      }).on('error', () => {
        res.writeHead(502);
        res.end('Firebase proxy error');
        logRequest(502, 'firebase-proxy-error');
      });
      return;
    }

    const filePath = resolveStaticFile(req.url || '/');
    if (!filePath) {
      res.writeHead(403);
      res.end('Forbidden');
      logRequest(403);
      return;
    }

    fs.stat(filePath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        res.writeHead(404);
        res.end('Not found');
        logRequest(404);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      logRequest(200, path.relative(APP_ROOT, filePath));
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    let port = LOCAL_APP_PORT;
    let attempts = 0;

    const listen = () => {
      localServer.listen(port, LOCAL_APP_BIND_HOST, () => {
        settled = true;
        const address = localServer.address();
        appUrl = `http://${LOCAL_APP_HOSTNAME}:${address.port}/index.html`;
        appOrigin = `http://${LOCAL_APP_HOSTNAME}:${address.port}`;
        testLog('server listening', `${appUrl} bind=${typeof address === 'string' ? address : `${address.address}:${address.port}`}`);
        resolve(appUrl);
      });
    };

    localServer.on('error', (error) => {
      if (!settled && error?.code === 'EADDRINUSE' && attempts < 10) {
        attempts += 1;
        port += 1;
        testLog('server port busy', `${LOCAL_APP_BIND_HOST}:${port - 1}, retry=${port}`);
        listen();
        return;
      }
      testLog('server error', error?.stack || error?.message || String(error));
      reject(error);
    });

    listen();
  });
}

// ===== PRE-START SERVER NGAY KHI MODULE LOAD =====
// Không cần chờ app.whenReady() — http.createServer là Node.js thuần
// → Tiết kiệm 1-2s vì server sẵn sàng trước khi window cần
const serverReadyPromise = gotSingleInstanceLock && !SHOULD_QUIT_FOR_INSTALL ? createLocalServer().catch((error) => {
  testLog('server pre-start error', error?.message || String(error));
  return null;
}) : Promise.resolve(null);

function closeLocalServer() {
  if (!localServer) return;
  localServer.close();
  localServer = null;
  appOrigin = '';
  appUrl = '';
}

function quitForInstall(reason = 'installer') {
  testLog('quit-for-install', reason);
  isQuitting = true;
  try {
    quickAddWindow?.close();
    mainWindow?.close();
  } catch {}
  try {
    tray?.destroy();
    tray = null;
  } catch {}
  closeLocalServer();
  app.quit();
  setTimeout(() => app.exit(0), 2000).unref?.();
}

// ===== WINDOW MANAGEMENT =====
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

function waitForMainWindowReady(timeoutMs = 20000) {
  if (!mainWindow || mainWindow.isDestroyed()) return Promise.resolve(false);
  if (!mainWindow.webContents.isLoadingMainFrame() && mainWindow.webContents.getURL()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (value) => {
      clearTimeout(timer);
      mainWindow?.webContents?.removeListener('did-finish-load', onReady);
      mainWindow?.webContents?.removeListener('dom-ready', onReady);
      resolve(value);
    };
    const onReady = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    mainWindow.webContents.once('did-finish-load', onReady);
    mainWindow.webContents.once('dom-ready', onReady);
  });
}

function resolveQuickAddRequest(requestId, result) {
  const resolver = quickAddResolvers.get(requestId);
  if (!resolver) return false;
  quickAddResolvers.delete(requestId);
  resolver(result);
  return true;
}

function notifyQuickAddShown() {
  if (!quickAddWindow || quickAddWindow.isDestroyed()) return;
  quickAddWindow.webContents.send('quick-add:shown');
}

async function showQuickAddWindow() {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    const wasVisible = quickAddWindow.isVisible();
    quickAddWindow.show();
    quickAddWindow.focus();
    if (!wasVisible) notifyQuickAddShown();
    return quickAddWindow;
  }

  await createQuickAddWindow(true);
  return quickAddWindow;
}

// Pre-create Quick Add window ẩn để mở nhanh khi nhấn shortcut
async function createQuickAddWindow(showImmediately = false) {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) return quickAddWindow;

  const servedUrl = await serverReadyPromise || await createLocalServer();
  const quickUrl = `${appOrigin || new URL(servedUrl).origin}/quick-add.html`;
  testLog('quick-add create', `show=${showImmediately} ${quickUrl}`);

  quickAddWindow = new BrowserWindow({
    width: 430,
    height: 520,
    minWidth: 390,
    minHeight: 460,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: 'Ting! Quick Add',
    backgroundColor: '#F8F9FC',
    icon: WINDOW_ICON,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: QUICK_ADD_PRELOAD_PATH,
    },
  });

  if (showImmediately) {
    quickAddWindow.once('ready-to-show', () => {
      if (!quickAddWindow || quickAddWindow.isDestroyed()) return;
      quickAddWindow.show();
      quickAddWindow.focus();
      notifyQuickAddShown();
    });
  }

  // Khi đóng: ẩn thay vì destroy để tái sử dụng nhanh
  quickAddWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    quickAddWindow.hide();
  });

  quickAddWindow.on('closed', () => {
    quickAddWindow = null;
  });

  quickAddWindow.loadURL(quickUrl).catch((error) => {
    testLog('quick-add load error', error?.stack || error?.message || String(error));
  });

  return quickAddWindow;
}

async function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return mainWindow;
  }

  testLog('createMainWindow start');

  // Chờ server sẵn sàng (đã pre-start từ module load nên thường xong ngay)
  const url = await serverReadyPromise || await createLocalServer();
  const startHidden = process.argv.includes('--hidden');
  const openDevTools = process.argv.includes('--open-devtools');
  testLog('createMainWindow url', url);

  testLog('browserWindow create begin');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Ting!',
    backgroundColor: '#F8F9FC',
    icon: WINDOW_ICON,
    // Ẩn title bar native của OS — tự dựng title bar tùy chỉnh trong renderer
    // (nút thu nhỏ / phóng to / đóng nằm trong index.html + desktop.css)
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: false — TẮT sandbox để fix 2 vấn đề nghiêm trọng:
      // 1. BrowserWindow tạo 8.3s (bình thường <500ms) do sandbox init overhead
      // 2. Network service crash (ERR_FAILED -2) khi loadURL lần đầu
      // An toàn: contextIsolation: true vẫn ngăn renderer truy cập Node.js
      // Bitwarden, 1Password cũng dùng sandbox: false cho main window
      sandbox: false,
      webSecurity: true,
      preload: PRELOAD_PATH,
    },
  });
  testLog('browserWindow created');

  // ===== TITLE BAR TÙY CHỈNH: báo trạng thái maximize cho renderer =====
  const sendMaximizeState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('window:maximize-changed', mainWindow.isMaximized());
  };
  mainWindow.on('maximize', sendMaximizeState);
  mainWindow.on('unmaximize', sendMaximizeState);
  mainWindow.on('app-command', (event, command) => {
    const normalized = String(command || '').toLowerCase();
    if (normalized === 'browser-backward' || normalized === 'browser-forward') {
      event.preventDefault();
      sendToRenderer('navigation-intent', normalized === 'browser-forward' ? 'forward' : 'back');
    }
  });

  let windowShown = false;
  const showWhenReady = (reason = 'show') => {
    if (windowShown || startHidden || !mainWindow || mainWindow.isDestroyed()) return;
    windowShown = true;
    testLog('window show', reason);
    mainWindow.show();
  };

  // ===== LOAD URL VỚI RETRY NHANH =====
  let appLoadStarted = false;
  let appLoadAttempts = 0;
  const MAX_LOAD_ATTEMPTS = 3;
  const loadApp = () => {
    if (appLoadStarted || !mainWindow || mainWindow.isDestroyed()) return;
    appLoadStarted = true;
    appLoadAttempts += 1;
    testLog('loadURL start', `${url} attempt=${appLoadAttempts}`);
    mainWindow.loadURL(url).catch((error) => {
      if (isNavigationAbort(error)) {
        testLog('loadURL aborted', url);
        return;
      }
      if (isNetworkLoadFailure(error) && appLoadAttempts < MAX_LOAD_ATTEMPTS) {
        testLog('loadURL retry after network failure', error?.message || String(error));
        appLoadStarted = false;
        // Retry ngay lập tức (0ms) — không chờ 1 giây như trước
        // Network service đã recover, retry nhanh hơn = mở app nhanh hơn
        setImmediate(loadApp);
        return;
      }
      testLog('loadURL error', error?.stack || error?.message || String(error));
    });
  };

  mainWindow.once('ready-to-show', () => {
    testLog('ready-to-show', mainWindow.webContents.getURL());
    showWhenReady('ready-to-show');
  });
  mainWindow.webContents.on('did-finish-load', () => {
    testLog('did-finish-load', mainWindow.webContents.getURL());
    setTimeout(() => showWhenReady('did-finish-load'), 150);
  });
  mainWindow.webContents.on('did-start-loading', () => testLog('did-start-loading'));
  mainWindow.webContents.on('did-stop-loading', () => testLog('did-stop-loading', mainWindow.webContents.getURL()));
  mainWindow.webContents.on('dom-ready', () => {
    const domUrl = mainWindow.webContents.getURL();
    testLog('dom-ready', domUrl);
    setTimeout(() => showWhenReady('dom-ready'), 250);
    if (openDevTools) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) {
      testLog('did-fail-load aborted', validatedURL);
      return;
    }
    testLog('did-fail-load', `${errorCode} ${errorDescription} ${validatedURL}`);
    // Retry nhanh nếu fail và còn attempts
    if (isNetworkLoadFailure({ code: errorCode }) && appLoadAttempts < MAX_LOAD_ATTEMPTS) {
      testLog('did-fail-load triggering retry');
      appLoadStarted = false;
      setImmediate(loadApp);
    }
  });
  mainWindow.webContents.on('console-message', (event) => {
    testLog('renderer console', `${event.level ?? ''} ${event.sourceId ?? ''}:${event.lineNumber ?? ''} ${event.message ?? ''}`);
  });
  mainWindow.webContents.on('did-create-window', (childWindow, details) => {
    testLog('child window created', details?.url || '');
    childWindow.webContents.on('did-navigate', (_event, childUrl) => {
      testLog('child window navigate', childUrl);
    });
    childWindow.webContents.on('did-finish-load', () => {
      testLog('child window did-finish-load', childWindow.webContents.getURL());
    });
    childWindow.on('closed', () => {
      testLog('child window closed');
    });
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
    // Cho phép Firebase Auth popup mở bên trong Electron
    const target = new URL(targetUrl, appOrigin || 'http://localhost');
    const isLocalAuthHandler = target.origin === appOrigin && target.pathname.startsWith('/__/');
    const isBrokenLocalHttpsAuth = /^https:\/\/(?:localhost|127\.0\.0\.1):\d+\/__\//i.test(targetUrl);
    const isFirebaseAuth = isLocalAuthHandler || /firebaseapp\.com|accounts\.google\.com|googleapis\.com/i.test(targetUrl);
    if (isBrokenLocalHttpsAuth) {
      testLog('blocked broken local https auth popup', targetUrl);
      return { action: 'deny' };
    }
    if (isFirebaseAuth) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 600,
          title: 'Đăng nhập Google',
          icon: WINDOW_ICON,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }
    // Các link khác mở bằng trình duyệt hệ thống
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

  showWhenReady('created');
  loadApp();
  return mainWindow;
}

// ===== TRAY =====
function createTray() {
  if (tray) return tray;
  tray = new Tray(WINDOW_ICON);
  tray.setToolTip('Ting!');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Them nhanh', click: () => showQuickAddWindow().catch(() => {}) },
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

// ===== AUTO-START =====
async function applyAutoStart() {
  if (process.platform !== 'win32') return;
  const openAtLogin = Boolean(store.get('autoStart', true));
  app.setLoginItemSettings({
    openAtLogin,
    openAsHidden: true,
    args: ['--hidden'],
  });
}

// ===== AUTO-LOCK =====
function startAutoLockWatcher() {
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = setInterval(() => {
    const minutes = Number(getSetting('autoLockMinutes', 5) || 0);
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

// ===== AUTO-UPDATER =====
function getAutoUpdater() {
  if (autoUpdater || autoUpdaterLoadAttempted) return autoUpdater;
  autoUpdaterLoadAttempted = true;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch {
    autoUpdater = null;
  }
  return autoUpdater;
}

async function appendUpdateLog(entry) {
  const current = store.get('updateLog', []) || [];
  // Dùng Update_Core để chèn mục mới nhất lên đầu và cắt còn tối đa 10 mục;
  // việc gắn `date`/lưu trữ (I/O) do tầng cạnh (main process) đảm nhiệm.
  const next = appendUpdateLogEntry(current, {
    ...entry,
    date: new Date().toLocaleString('vi-VN'),
  });
  store.set('updateLog', next);
  return next;
}

function sendUpdateEvent(payload) {
  const log = getSetting('updateLog', []) || [];
  sendToRenderer('update-event', {
    ...payload,
    message: sanitizeUpdateMessage(payload?.message),
    log,
  });
}

// Ghi một mục nhật ký (qua appendUpdateLogEntry, giữ tối đa 10 mục) RỒI phát
// `update-event` với nhật ký vừa cập nhật. Payload chuẩn hoá gồm
// `{status, message, info, progress, log}` (Yêu cầu 6.5). Nếu không truyền
// `logEntry` thì chỉ đọc lại nhật ký hiện có mà không thêm mục mới.
async function logAndSendUpdateEvent(payload, logEntry) {
  const log = logEntry
    ? await appendUpdateLog(logEntry)
    : (getSetting('updateLog', []) || []);
  sendToRenderer('update-event', {
    ...payload,
    message: sanitizeUpdateMessage(payload?.message),
    log,
  });
  return log;
}

// Bắt đầu tải bản cập nhật desktop dưới KHOÁ single-flight (Yêu cầu 3.4): nếu
// đã có một tiến trình tải đang chạy thì bỏ qua yêu cầu mới, tránh tải chồng
// lấn. Khoá được giải phóng trong handler `update-downloaded`/`error`.
function startUpdateDownload(updater) {
  if (!updater) return false;
  if (updateDownloadInFlight) {
    testLog('update download skipped (single-flight lock held)');
    return false;
  }
  updateDownloadInFlight = true;
  testLog('update download start');
  Promise.resolve()
    .then(() => updater.downloadUpdate())
    .catch(error => {
      updateDownloadInFlight = false;
      testLog('update download error', error?.stack || error?.message || String(error));
      logAndSendUpdateEvent(
        { status: 'error', type: 'error', message: error?.message || 'Không thể tải bản cập nhật' },
        { version: 'unknown', status: 'error', source: 'github' },
      );
    });
  return true;
}

function getGithubHeaders() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
  return {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Ting-Updater',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: getGithubHeaders() }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 1024 * 1024) {
          request.destroy(new Error('Phản hồi GitHub quá lớn'));
        }
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(`GitHub HTTP ${response.statusCode}`);
          error.statusCode = response.statusCode;
          error.body = body;
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(15000, () => {
      request.destroy(new Error('GitHub timeout'));
    });
    request.on('error', reject);
  });
}

async function checkGithubRelease() {
  const currentVersion = normalizeVersion(app.getVersion());
  sendUpdateEvent({ status: 'checking', message: 'Đang kiểm tra GitHub Releases...' });
  testLog('github update check start', GITHUB_LATEST_RELEASE_API);

  try {
    const release = await fetchJson(GITHUB_LATEST_RELEASE_API);
    const rawTag = release.tag_name || release.name || '';
    if (!rawTag) throw new Error('GitHub Release không có tag version');
    const latestVersion = normalizeVersion(rawTag);

    const isNewer = compareVersions(latestVersion, currentVersion) > 0;
    const status = isNewer ? 'available' : 'not-available';
    const message = isNewer
      ? `Có bản ${latestVersion} trên GitHub`
      : `Đang ở bản mới nhất (${currentVersion})`;
    const info = {
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url || GITHUB_RELEASES_URL,
      releaseName: release.name || release.tag_name || latestVersion,
      publishedAt: release.published_at || '',
      source: 'github',
    };
    const log = await appendUpdateLog({
      version: latestVersion,
      status,
      source: 'github',
      url: info.releaseUrl,
    });

    testLog('github update check done', `${status} current=${currentVersion} latest=${latestVersion}`);
    sendToRenderer('update-event', { status, message: sanitizeUpdateMessage(message), info, log });
    return info;
  } catch (error) {
    const isNotFound = error?.statusCode === 404;
    const message = isNotFound
      ? `Chưa có GitHub Release công khai hoặc repo đang private: ${GITHUB_OWNER}/${GITHUB_REPO}`
      : `Không thể kiểm tra GitHub: ${error?.message || error}`;
    const log = await appendUpdateLog({
      version: currentVersion,
      status: 'github-error',
      source: 'github',
      message: sanitizeUpdateMessage(message),
    });

    testLog('github update check error', error?.stack || error?.message || String(error));
    sendToRenderer('update-event', {
      status: 'error',
      type: 'error',
      message,
      info: {
        currentVersion,
        releaseUrl: GITHUB_RELEASES_URL,
        source: 'github',
      },
      log,
    });
    return { error: message };
  }
}

function setupAutoUpdater() {
  if (autoUpdaterSetupDone) return getAutoUpdater();

  const updater = getAutoUpdater();
  if (!updater) return null;

  autoUpdaterSetupDone = true;
  // Tự kiểm soát bước tải để đảm bảo KHOÁ single-flight (Yêu cầu 3.4): dùng
  // `downloadUpdate()` thủ công thay cho auto-download của electron-updater.
  updater.autoDownload = false;

  updater.on('checking-for-update', () => {
    sendUpdateEvent({ status: 'checking', message: 'Đang kiểm tra cập nhật...' });
  });
  updater.on('update-available', info => {
    // Yêu cầu 3.2/3.3: phát hiện Latest_Version > Installed_Version → phát
    // trạng thái "có bản cập nhật" và bắt đầu tải trình cài đặt.
    logAndSendUpdateEvent(
      { status: 'available', message: `Có bản cập nhật ${info?.version || ''}`, info },
      { version: info?.version || 'unknown', status: 'available', source: 'github' },
    );
    startUpdateDownload(updater);
  });
  updater.on('update-not-available', info => {
    // Yêu cầu 3.7: đã ở bản mới nhất.
    logAndSendUpdateEvent(
      { status: 'not-available', message: 'Đang ở bản mới nhất', info },
      { version: info?.version || normalizeVersion(app.getVersion()), status: 'not-available', source: 'github' },
    );
  });
  updater.on('download-progress', progress => {
    // Yêu cầu 3.4: hiển thị tiến độ tải theo phần trăm.
    sendUpdateEvent({
      status: 'downloading',
      message: `Đang tải ${Math.round(progress?.percent || 0)}%`,
      progress,
    });
  });
  updater.on('update-downloaded', info => {
    // Yêu cầu 3.5: tải xong → giải phóng khoá và báo sẵn sàng cài đặt.
    updateDownloadInFlight = false;
    logAndSendUpdateEvent(
      { status: 'downloaded', message: `Bản cập nhật đã sẵn sàng${info?.version ? ` (${info.version})` : ''}`, info },
      { version: info?.version || 'unknown', status: 'downloaded', source: 'github' },
    );
  });
  updater.on('error', error => {
    // Giải phóng khoá single-flight khi có lỗi để cho phép thử lại.
    updateDownloadInFlight = false;
    logAndSendUpdateEvent(
      { status: 'error', type: 'error', message: error?.message || 'Lỗi cập nhật' },
      { version: 'unknown', status: 'error', source: 'github' },
    );
  });

  return updater;
}

// ===== IPC HANDLERS =====
function setupIpc() {
  // ===== ĐIỀU KHIỂN CỬA SỔ (title bar tùy chỉnh) =====
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
    return true;
  });
  ipcMain.handle('window:toggle-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
    return true;
  });
  ipcMain.handle('window:is-maximized', (event) => {
    return Boolean(BrowserWindow.fromWebContents(event.sender)?.isMaximized());
  });

  ipcMain.handle('tray:update-tooltip', (_event, text) => {
    tray?.setToolTip(String(text || 'Ting!'));
    return true;
  });

  ipcMain.handle('settings:get-auto-start', () => {
    return Boolean(store.get('autoStart', true));
  });
  ipcMain.handle('settings:set-auto-start', (_event, enabled) => {
    store.set('autoStart', Boolean(enabled));
    applyAutoStart().catch(() => {});
    return Boolean(enabled);
  });

  ipcMain.handle('settings:get-auto-lock-minutes', () => {
    return Number(store.get('autoLockMinutes', 5));
  });
  ipcMain.handle('settings:set-auto-lock-minutes', (_event, minutes) => {
    const value = Math.max(0, Number(minutes) || 0);
    store.set('autoLockMinutes', value);
    return value;
  });

  ipcMain.handle('notification:send', (_event, payload) => {
    const title = String(payload?.title || 'Ting!');
    const body = String(payload?.body || '');
    const shouldPlaySound = Boolean(payload?.playSound);
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        icon: WINDOW_ICON,
        // Tắt âm mặc định khi có yêu cầu phát âm thanh riêng
        silent: shouldPlaySound,
        timeoutType: 'default',
      }).show();
      if (shouldPlaySound) playAlertSound();
      return true;
    }
    return false;
  });

  ipcMain.handle('notification:open-settings', async () => {
    if (process.platform === 'win32') {
      await shell.openExternal('ms-settings:notifications');
      return true;
    }
    return false;
  });

  ipcMain.handle('quick-add:close', () => {
    quickAddWindow?.close();
    return true;
  });

  ipcMain.handle('quick-add:save', async (_event, payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      await createMainWindow();
    }
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { ok: false, message: 'Hay mo Ting! truoc khi luu nhanh.' };
    }

    showMainWindow();
    await waitForMainWindowReady();
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        quickAddResolvers.delete(requestId);
        resolve({ ok: false, message: 'Ting! chua phan hoi. Hay thu lai sau khi app tai xong.' });
      }, 90000);

      quickAddResolvers.set(requestId, (result) => {
        clearTimeout(timer);
        resolve(result || { ok: false, message: 'Khong ro ket qua luu nhanh.' });
      });
      mainWindow.webContents.send('quick-add:save-request', { requestId, payload });
    });
  });

  ipcMain.on('quick-add:save-result', (_event, result) => {
    const requestId = String(result?.requestId || '');
    if (resolveQuickAddRequest(requestId, result)) {
      if (result?.ok) setTimeout(() => quickAddWindow?.close(), 600);
    }
  });

  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('updates:get-log', () => {
    return store.get('updateLog', []) || [];
  });
  // ===== BackgroundCheckState (Update_System — Yêu cầu 7.1/7.4/7.5) =====
  // Desktop lưu {enabled, lastCheckAt} trong electron-store; Android dùng
  // localStorage (xem js/background-check.js). Chuẩn hoá kiểu ngay tại nguồn.
  ipcMain.handle('updates:get-bg-state', () => {
    const raw = store.get('backgroundCheck', { enabled: true, lastCheckAt: null }) || {};
    const enabled = raw.enabled === undefined || raw.enabled === null ? true : Boolean(raw.enabled);
    const lastCheckAt = (typeof raw.lastCheckAt === 'number' && Number.isFinite(raw.lastCheckAt))
      ? raw.lastCheckAt
      : null;
    return { enabled, lastCheckAt };
  });
  ipcMain.handle('updates:set-bg-state', (_event, patch) => {
    const current = store.get('backgroundCheck', { enabled: true, lastCheckAt: null }) || {};
    const next = {
      enabled: current.enabled === undefined || current.enabled === null ? true : Boolean(current.enabled),
      lastCheckAt: (typeof current.lastCheckAt === 'number' && Number.isFinite(current.lastCheckAt))
        ? current.lastCheckAt
        : null,
    };
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'enabled')) {
      next.enabled = Boolean(patch.enabled);
    }
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'lastCheckAt')
        && typeof patch.lastCheckAt === 'number' && Number.isFinite(patch.lastCheckAt)) {
      next.lastCheckAt = patch.lastCheckAt;
    }
    store.set('backgroundCheck', next);
    return next;
  });
  ipcMain.handle('updates:check', async () => {
    // Ưu tiên luồng electron-updater đầu-cuối (checkForUpdates → downloadUpdate
    // → quitAndInstall). Sự kiện được phát qua các handler đã đăng ký trong
    // setupAutoUpdater.
    const updater = setupAutoUpdater();
    if (updater) {
      try {
        const result = await updater.checkForUpdates();
        return { ok: true, source: 'electron-updater', version: result?.updateInfo?.version };
      } catch (error) {
        // electron-updater chưa phân giải được bản cập nhật (thiếu latest.yml
        // hoặc đang chạy môi trường dev) → suy giảm nhẹ nhàng về REST API GitHub.
        testLog('electron-updater check failed, fallback REST', error?.message || String(error));
        return checkGithubRelease();
      }
    }
    // electron-updater không khả dụng → dùng fallback REST API GitHub Releases.
    return checkGithubRelease();
  });
  ipcMain.handle('updates:quit-and-install', () => {
    const updater = setupAutoUpdater();
    if (!updater) return false;
    isQuitting = true;
    updater.quitAndInstall();
    return true;
  });

  // ===== SHORTCUTS IPC =====
  ipcMain.handle('settings:get-shortcuts', () => {
    return getShortcutSettings();
  });
  ipcMain.handle('settings:set-shortcut', (_event, action, accelerator) => {
    const shortcuts = getShortcutSettings();
    const newAccelerator = String(accelerator || '').trim();
    // Validate: kiểm tra Electron có đăng ký được không
    if (newAccelerator) {
      // Thử đăng ký thử rồi gỡ ngay để validate
      try {
        globalShortcut.unregisterAll();
        const ok = globalShortcut.register(newAccelerator, () => {});
        globalShortcut.unregister(newAccelerator);
        if (!ok) {
          // Re-register shortcuts cũ
          registerGlobalShortcuts();
          return { ok: false, message: `Phím tắt "${newAccelerator}" không hợp lệ hoặc đã bị chiếm.` };
        }
      } catch (error) {
        registerGlobalShortcuts();
        return { ok: false, message: `Phím tắt không hợp lệ: ${error?.message || error}` };
      }
    }
    shortcuts[action] = newAccelerator;
    store.set('shortcuts', shortcuts);
    registerGlobalShortcuts();
    return { ok: true, shortcuts };
  });
  ipcMain.handle('settings:reset-shortcuts', () => {
    store.set('shortcuts', { ...DEFAULT_SHORTCUTS });
    registerGlobalShortcuts();
    return { ok: true, shortcuts: { ...DEFAULT_SHORTCUTS } };
  });
}

// ===== GLOBAL SHORTCUTS =====
const SHORTCUT_ACTIONS = {
  openApp: () => showMainWindow(),
  quickAdd: () => showQuickAddWindow().catch((error) => testLog('quick-add shortcut error', error?.message || String(error))),
};

function getShortcutSettings() {
  const saved = store.get('shortcuts', null);
  return { ...DEFAULT_SHORTCUTS, ...(saved || {}) };
}

function registerGlobalShortcuts() {
  globalShortcut.unregisterAll();
  const shortcuts = getShortcutSettings();
  for (const [action, accelerator] of Object.entries(shortcuts)) {
    if (!accelerator || !SHORTCUT_ACTIONS[action]) continue;
    try {
      const ok = globalShortcut.register(accelerator, SHORTCUT_ACTIONS[action]);
      testLog('shortcut register', `${action}=${accelerator} ok=${ok}`);
    } catch (error) {
      testLog('shortcut register error', `${action}=${accelerator} ${error?.message || error}`);
    }
  }
}

// ===== APP LIFECYCLE =====
if (gotSingleInstanceLock && !SHOULD_QUIT_FOR_INSTALL) {
  testLog('single instance lock acquired');
  app.on('second-instance', (_event, commandLine = []) => {
    testLog('second-instance', Array.isArray(commandLine) ? commandLine.join(' | ') : '');
    if (hasQuitForInstallArg(commandLine)) {
      quitForInstall('second-instance');
      return;
    }
    showMainWindow();
  });

  app.whenReady().then(async () => {
    testLog('app ready');

    // Chạy setupIpc trước — IPC handlers cần sẵn sàng khi renderer load
    setupIpc();

    // Tạo window — server đã pre-start nên rất nhanh
    // Không await — để tray, shortcuts, auto-lock chạy song song
    const windowPromise = createMainWindow();

    // Chạy song song với createMainWindow — không phụ thuộc lẫn nhau
    createTray();
    registerGlobalShortcuts();
    startAutoLockWatcher();

    // Chờ window xong trước khi làm các task phụ
    await windowPromise;

    // Delay applyAutoStart — không urgent, chạy sau
    setTimeout(() => {
      applyAutoStart().catch(() => {});
    }, 2000);

    // Pre-create Quick Add window ẩn sau 3s để mở nhanh khi nhấn shortcut
    setTimeout(() => {
      createQuickAddWindow(false).catch((error) => {
        testLog('quick-add pre-create error', error?.message || String(error));
      });
    }, 3000);

    // Auto-update check — delay dài hơn, ưu tiên UX mở app nhanh
    // GitHub release hiện chỉ publish installer .exe, chưa có latest.yml cho electron-updater.
    // Không tự gọi autoUpdater khi mở app để tránh lộ response header/cookie trong lỗi cập nhật.

    app.on('activate', showMainWindow);
  }).catch((error) => {
    testLog('app ready error', error?.stack || error?.message || String(error));
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
