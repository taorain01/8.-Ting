# Ting! - Ke Hoach Thuc Hien Tung Buoc

Nguon dau vao: `C:\Users\PC\.gemini\antigravity\brain\61deb646-e9ef-4bfa-86e7-27d62b51f3d2\implementation_plan.md.resolved`

Muc tieu cua ke hoach nay la chuyen ban nang cap 6 phase thanh checklist co the lam tuan tu, moi buoc co dau ra ro rang va cach kiem tra rieng. App hien co 3 nhom source can chu y:

- Source chinh desktop/web o thu muc goc: `index.html`, `css/`, `js/`, `DongGoi/electron/`.
- Source Android web build o `www/`, duoc tao/lap lai bang `npm run prepare:android-web`.
- Source mobile rieng o `mobile/`, chi dong bo khi co yeu cau rieng.

## Trang Thai Thuc Thi - 2026-04-27

Da hoan thanh tren source desktop/web:

- Phase A: form dang ky co confirm password, strength bar, validate mat khau va email verification.
- Phase B: mask username format moi, an/hien secret 5 giay, nut copy theo trang thai unlock.
- Phase C: module `js/notification.js`, dropdown thong bao, badge va native/Web notification fallback.
- Phase D: Electron preload, tray, minimize-to-tray, single instance, auto-start, auto-lock, global shortcut.
- Phase E: auto-update qua `electron-updater`, UI check update, update log.
- Phase F: clipboard auto-clear, dark mode, Spotlight search, dashboard chart/timeline.
- Phase G: da sync `www/`, build Windows thanh cong, npm audit sach 0 vulnerabilities.

Con can thong tin tu user:

- Dien `build.publish.owner` trong `package.json` thay cho `YOUR_GITHUB_OWNER` truoc khi release auto-update that qua GitHub Releases.
- Neu muon mobile app co day du UI moi nhu desktop, can lap ke hoach rieng cho `mobile/index.html`, `mobile/js/app.js`, `mobile/js/ui.js`, `mobile/css/*`.

## Nguyen Tac Lam

- Lam theo thu tu Phase 0 -> A -> B -> C -> D -> E -> F.
- Xong phase nao thi test phase do truoc khi qua phase tiep theo.
- Khong sua `www/` bang tay neu thay doi den tu source goc, hay chay script sync.
- Cac tinh nang Electron can co fallback khi chay browser thuong.
- Cac thay doi lien quan mat khau phai uu tien an toan: khong log password, khong hien nut copy khi chua unlock, khong luu secret dang plaintext.

## Tinh Trang Hien Tai Can Nho

- `package.json` da co `electron`, `electron-builder`, cac script `electron:dev`, `dist:win`, `prepare:android-web`.
- Da co `electron-store` va `electron-updater`.
- `DongGoi/electron/main.cjs` da co tray, preload, single instance, auto-start, auto-lock va auto-update.
- `showNotifications()` trong `js/desktop-app.js` da mo notification dropdown.
- `js/utils.js` da cap nhat `maskUsername()` theo format 2 ky tu dau.

---

## Phase 0 - Chuan Bi Va Kiem Tra Nen

### Buoc 0.1 - Xac dinh pham vi file

File chinh se sua:

- `index.html`
- `js/desktop-app.js`
- `js/auth.js`
- `js/utils.js`
- `js/desktop-ui.js`
- `css/components.css`
- `css/desktop.css`
- `css/index.css`
- `DongGoi/electron/main.cjs`
- `package.json`

File moi se them:

- `js/notification.js`
- `DongGoi/electron/preload.cjs`

Dau ra: danh sach file anh huong da ro, khong sua nham `www/` hoac `mobile/`.

### Buoc 0.2 - Chay baseline

Lenh kiem tra:

```powershell
npm run electron:dev
```

Kiem tra nhanh:

- App mo duoc.
- Dang nhap/demo hien dung.
- Sidebar, dashboard, danh sach tai khoan, settings khong loi console nghiem trong.

### Buoc 0.3 - Ghi lai baseline loi neu co

Neu app dang co loi truoc khi sua, ghi vao cuoi file nay trong muc "Ghi chu phat sinh". Loi co san khong duoc tinh la loi cua phase moi, nhung neu chan viec test thi xu ly truoc.

---

## Phase A - Sua Form Dang Ky Va Email Verification

### Buoc A1 - Them confirm password va strength bar vao HTML

File: `index.html`

Lam:

- Sau truong password trong form auth, them block `pw-strength-wrap`.
- Them text yeu cau mat khau: `6-20 ky tu, 1 chu hoa, 1 ky tu dac biet`.
- Them group `confirm-pw-group` voi input "Nhap lai mat khau".
- Mac dinh an 2 block nay khi dang o che do dang nhap.

Dau ra:

- DOM co input confirm password.
- DOM co thanh do do manh mat khau.
- Khong lam vo layout auth hien tai.

### Buoc A2 - Them CSS cho strength bar va verify banner

File: `css/components.css`, `css/desktop.css`

Lam:

- Tao style `.pw-strength-wrap`, `.pw-strength-bar`, `.pw-strength-segment`.
- Tao state mau: weak, medium, strong, very-strong.
- Tao `.pw-requirement` va state dat/chua dat.
- Tao `.email-verify-banner` de hien canh bao chua xac minh email.

Dau ra:

- Register mode hien form gon, khong tran text tren mobile/desktop.
- Banner verify co style dong bo voi giao dien hien tai.

### Buoc A3 - Cap nhat logic toggle auth mode

File: `js/desktop-app.js`

Lam:

- Sua `toggleAuthMode()` de hien/an confirm password va strength bar.
- Khi chuyen ve login, clear confirm password va reset strength.
- Khi chuyen sang register, gan event input cho password de cap nhat realtime.

Dau ra:

- Login mode chi hien email/password.
- Register mode hien them confirm password va strength.

### Buoc A4 - Validate dang ky email

File: `js/desktop-app.js`

Lam:

- Trong `handleEmailAuth()`, khi `authMode === 'register'` thi validate:
  - Do dai 6-20 ky tu.
  - Co it nhat 1 chu hoa.
  - Co it nhat 1 ky tu dac biet.
  - Confirm password trung password.
- Them helper `getPasswordStrength()` va `updatePasswordStrength(value)`.
- Bao loi bang toast/text hien co, khong submit khi invalid.

Dau ra:

- Mat khau yeu bi chan truoc khi goi Firebase.
- Strength bar doi theo realtime.

### Buoc A5 - Gui email verification

File: `js/auth.js`

Lam:

- Trong `registerWithEmail()`, sau khi tao user thi goi `sendEmailVerification(user)`.
- Hien toast yeu cau kiem tra email.
- Trong auth listener, neu user email/password chua verify thi hien banner.
- Them nut "Gui lai" de resend verification.
- Google Sign-In khong can banner verify rieng neu provider da verified.

Dau ra:

- Tai khoan email moi nhan email xac minh.
- User chua verify nhin thay canh bao ro rang.

### Kiem tra Phase A

- Toggle login/register hoat dong.
- Password `abc` bi tu choi.
- Password `Abcdef!` hop le neu confirm trung.
- Confirm sai bi bao loi.
- Dang ky thanh cong hien toast "Kiem tra email".
- User chua verify hien banner va nut gui lai.

---

## Phase B - Cai Thien Hien Thi Tai Khoan Va Nut Copy

### Buoc B1 - Chuan hoa maskUsername

File: `js/utils.js`

Lam:

- Email: hien 2 ky tu dau local part, phan con lai che bang `******`, giu domain.
- So dien thoai: hien 2 ky tu dau va 2 ky tu cuoi, giua la `******`.
- Username thuong: hien 2 ky tu dau, sau do `******`.
- Xu ly chuoi ngan de khong lo toan bo username.

Vi du:

```text
rainosb@gmail.com -> ra******@gmail.com
0912345789        -> 09******89
fb.username       -> fb******
```

Dau ra:

- Format mask dung thong nhat tren card, detail, mock data.

### Buoc B2 - Sua card tai khoan ca nhan

File: `js/desktop-ui.js`

Lam trong `renderDesktopCard()`:

- Tai khoan ca nhan hien username da mask thay vi ky tu bullet chung chung.
- Password mac dinh hien `******`.
- Them nut eye de reveal password 5 giay roi tu an.
- Khi `masterUnlocked === true`, hien nut copy username va password.
- Khi chua unlock, khong render nut copy secret.

Dau ra:

- Card ca nhan an thong tin nhay cam dung muc.
- Nut copy chi xuat hien sau khi unlock.

### Buoc B3 - Sua trang chi tiet

File: `js/desktop-ui.js`

Lam trong `renderDetail()`:

- Username: hien mask, co nut eye, co nut copy neu unlock.
- Password: hien `******`, co nut eye, co nut copy neu unlock.
- Reveal co timeout 5 giay va reset khi chuyen trang.

Dau ra:

- Detail page dong nhat voi card.
- Khong lo password khi chua unlock.

### Buoc B4 - Cap nhat action copy/reveal

File: `js/desktop-app.js`

Lam:

- Bao dam cac handler copy lay data da decrypt chi khi master unlocked.
- Neu chua unlock thi yeu cau unlock truoc hoac khong hien action.
- Them cleanup timeout reveal neu can.

Dau ra:

- Khong co duong copy password khi chua unlock.

### Buoc B5 - Sua mock data

File: `js/desktop-app.js`

Lam:

- Cap nhat `displayUsername` trong `MOCK_ACCOUNTS` theo format mask moi.

### Kiem tra Phase B

- Email hien `ra******@gmail.com`.
- So dien thoai hien `09******89`.
- TK ca nhan chua unlock khong co nut copy.
- Sau unlock, nut copy hien va copy dung.
- Eye reveal password 5 giay roi tu an.

---

## Phase C - He Thong Thong Bao Het Han

### Buoc C1 - Tao module notification

File moi: `js/notification.js`

Ham can co:

- `requestNotificationPermission()`
- `getNotificationList(accounts)`
- `checkExpiryAndNotify(accounts)`
- `schedulePeriodicCheck(getAccounts)`
- `sendNativeNotification(title, body)`

Nguyen tac:

- Account lifetime khong bao het han.
- Expired va expiring can co trong list.
- Neu co `window.electronAPI.sendNativeNotification` thi dung Electron native.
- Neu khong co Electron thi fallback Web Notification API.
- Tranh spam: can co co che `lastNotifiedDate` hoac in-memory sent key.

Dau ra:

- Module doc lap, browser va Electron deu chay duoc.

### Buoc C2 - Them script va container HTML

File: `index.html`

Lam:

- Them `<div id="notification-dropdown"></div>` gan khu header/action hien co.
- Them `<script src="js/notification.js"></script>` truoc `desktop-app.js` neu app can goi ham global.

Dau ra:

- Module notification duoc load truoc khi init app dung den no.

### Buoc C3 - Render notification dropdown

File: `js/desktop-ui.js`

Lam:

- Them `renderNotificationPanel(items)`.
- Moi item co ten TK, trang thai, so ngay con lai hoac da qua han, nut "Gia han".
- Empty state: "Tat ca deu on".
- Badge so luong tren nut chuong neu co account can chu y.

Dau ra:

- Bam chuong hien dropdown thay vi toast placeholder.

### Buoc C4 - Tich hop app init

File: `js/desktop-app.js`

Lam:

- Sua `showNotifications()` de toggle dropdown.
- Sau khi accounts load/sync, cap nhat badge notification.
- Khi app init, goi `requestNotificationPermission()` theo cach khong lam phien user.
- Goi `schedulePeriodicCheck()` moi 1 gio.

Dau ra:

- Notification list cap nhat theo data hien tai.

### Buoc C5 - Them CSS dropdown

File: `css/desktop.css`

Lam:

- Style dropdown gan icon chuong.
- Co max-height va scroll.
- Responsive khong tran ngoai man hinh.

### Kiem tra Phase C

- Bam chuong hien danh sach sap het han/da het han.
- Khong co item thi hien empty state.
- Account het han trong 5 ngay co trong list.
- Electron co the hien native notification neu API san sang.
- Browser fallback khong gay loi console.

---

## Phase D - Nang Cap Electron Desktop

### Buoc D1 - Cai dependency Electron settings

File: `package.json`, `package-lock.json`

Lam:

```powershell
npm install electron-store
```

Dau ra:

- `electron-store` co trong dependencies.
- Lockfile duoc cap nhat.

### Buoc D2 - Tao preload IPC bridge

File moi: `DongGoi/electron/preload.cjs`

Expose toi renderer:

- `isElectron: true`
- `sendNativeNotification(title, body)`
- `setAutoStart(enabled)`
- `getAutoStart()`
- `setAutoLockMinutes(minutes)`
- `getAutoLockMinutes()`
- `updateTrayTooltip(text)`
- `onAutoLock(callback)`
- Cac API update se them tiep o Phase E.

Dau ra:

- Renderer chi goi API an toan qua `window.electronAPI`.
- Khong bat `nodeIntegration`.

### Buoc D3 - Gan preload vao BrowserWindow

File: `DongGoi/electron/main.cjs`

Lam:

- Them `preload: path.join(__dirname, 'preload.cjs')`.
- Giu `contextIsolation: true`.
- Kiem tra `sandbox: true` co tuong thich voi preload hien tai; neu preload can API Electron bi chan, dieu chinh co chu dich va ghi ro ly do.

Dau ra:

- `window.electronAPI.isElectron === true` trong renderer.

### Buoc D4 - Single instance

File: `DongGoi/electron/main.cjs`

Lam:

- Them `app.requestSingleInstanceLock()`.
- Neu instance thu 2 duoc mo, focus cua so cu.
- Quan ly bien `mainWindow` thay vi chi local `win`.
- Dam bao local server khong tao nhieu instance thua.

Dau ra:

- Mo app lan 2 chi focus app dang chay.

### Buoc D5 - System tray va minimize to tray

File: `DongGoi/electron/main.cjs`

Lam:

- Tao tray icon tu `DongGoi/build/icon.ico`.
- Context menu: "Mo Ting!", "Kiem tra het han", "Thoat".
- Bam X thi hide xuong tray, khong quit.
- Double-click tray thi show/focus app.
- Tooltip cap nhat duoc tu renderer.
- Co flag `isQuitting` de phan biet quit that va close-to-tray.

Dau ra:

- App o system tray dung nhu desktop app.

### Buoc D6 - Auto-start

File: `DongGoi/electron/main.cjs`, `preload.cjs`

Lam:

- Dung `electron-store` luu setting.
- Mac dinh `autoStart = true` lan dau.
- Goi `app.setLoginItemSettings({ openAtLogin, openAsHidden: true })`.
- IPC get/set auto-start cho settings UI.

Dau ra:

- User bat/tat tu khoi dong cung Windows duoc.

### Buoc D7 - Auto-lock

File: `DongGoi/electron/main.cjs`, `preload.cjs`, `js/desktop-app.js`

Lam:

- Luu setting auto-lock minutes: `1`, `5`, `15`, `30`, `0` la tat.
- Mac dinh 5 phut.
- Main process theo doi idle/activity cua renderer hoac renderer gui activity ping.
- Khi idle qua nguong, main gui IPC `auto-lock`.
- Renderer reset `masterUnlocked` va `masterPassword`, dong secret dang reveal.

Dau ra:

- Sau idle, tai khoan ca nhan bi khoa lai.

### Buoc D8 - Global shortcut

File: `DongGoi/electron/main.cjs`

Lam:

- Dang ky `Ctrl+Shift+T` de show/focus Ting.
- Unregister khi app quit.
- Chu y Phase F3 cung dung Ctrl+Shift+T trong app cho Spotlight, can quy uoc:
  - Ngoai app: focus Ting.
  - Trong app: mo Spotlight.

Dau ra:

- Phim tat desktop hoat dong, khong gay crash neu dang ky that bai.

### Buoc D9 - Settings UI cho Electron

File: `js/desktop-ui.js`, `js/desktop-app.js`, `css/desktop.css`

Lam:

- Trong `renderSettings()`, them:
  - Toggle "Tu khoi dong cung Windows".
  - Dropdown "Tu khoa sau" 1/5/15/30 phut/Tat.
  - Toggle "Tu xoa clipboard sau 30s" de dung o Phase F1.
- Neu khong chay Electron, disable/hide cac option chi danh cho Electron.

Dau ra:

- Settings dieu khien duoc IPC va co fallback web.

### Kiem tra Phase D

- `npm run electron:dev` app mo duoc.
- `window.electronAPI` ton tai.
- Bam X thi app an xuong tray.
- Double-click tray hien lai.
- Mo app lan 2 focus app cu.
- Toggle auto-start khong loi.
- Auto-lock reset master password theo thoi gian chon.
- Ctrl+Shift+T focus app.

---

## Phase E - Auto-Update Tu GitHub Releases Va Update Log

### Buoc E1 - Cai dependency update

File: `package.json`, `package-lock.json`

Lam:

```powershell
npm install electron-updater
```

Dau ra:

- `electron-updater` co trong dependencies.

### Buoc E2 - Them publish config

File: `package.json`

Lam:

- Them `build.publish` cho GitHub Releases.
- Can xac dinh `owner` va `repo` GitHub chinh xac truoc khi release that.
- Giu cau hinh Windows target hien co.

Dau ra:

- `electron-builder` biet noi publish update.

### Buoc E3 - Tich hop autoUpdater o main process

File: `DongGoi/electron/main.cjs`

Lam:

- Import `autoUpdater` tu `electron-updater`.
- Khi app ready, check update sau khi window san sang.
- IPC:
  - `check-for-updates`
  - `update-available`
  - `update-not-available`
  - `update-downloaded`
  - `update-error`
  - `quit-and-install`
- Khong bat auto install ngay, cho user xac nhan restart.

Dau ra:

- App check update duoc tu Settings va khi khoi dong.

### Buoc E4 - Settings UI update

File: `js/desktop-ui.js`, `js/desktop-app.js`

Lam:

- Hien version app.
- Nut "Kiem tra cap nhat".
- Trang thai: dang kiem tra, co ban moi, da tai xong, loi.
- Nut "Khoi dong lai de cap nhat" khi update da downloaded.

Dau ra:

- User thay duoc trang thai update trong Settings.

### Buoc E5 - Luu update log

File: `DongGoi/electron/main.cjs`, `preload.cjs`, `js/desktop-ui.js`

Lam:

- Luu log vao `electron-store`: version cu, version moi, ngay gio, trang thai.
- Hien danh sach gan nhat trong Settings.

Dau ra:

- Co lich su cap nhat don gian de doi chieu.

### Kiem tra Phase E

- `npm run electron:dev` khong crash khi chua co release.
- Nut check update co response.
- Build `npm run dist:win` thanh cong.
- Khi cau hinh GitHub Releases dung, app nhan duoc update.

---

## Phase F - Bonus Features

Chi lam Phase F sau khi A-E da on.

### Buoc F1 - Clipboard auto-clear

File: `js/utils.js`, `js/desktop-ui.js`, `js/desktop-app.js`

Lam:

- Sau khi copy password/secret, dat timer 30 giay.
- Neu clipboard van bang text da copy thi clear.
- Toast: "Clipboard se tu xoa sau 30s".
- Toggle trong Settings bat/tat tinh nang.
- Luu setting bang `electron-store` neu Electron, `localStorage` neu web.

Kiem tra:

- Copy password thanh cong.
- Sau 30 giay clipboard bi xoa neu chua bi user thay doi.
- Tat toggle thi khong auto-clear.

### Buoc F2 - Dark mode

File: `css/index.css`, `css/components.css`, `css/desktop.css`, `js/desktop-app.js`, `js/desktop-ui.js`

Lam:

- Them `[data-theme="dark"]` cho CSS variables.
- Toggle trong Settings: system/light/dark.
- Tu detect `prefers-color-scheme`.
- Luu preference.
- Kiem tra toan bo man hinh khong bi text mo, border bien mat, input kho doc.

Kiem tra:

- Doi theme khong reload app.
- Restart app van nho theme.
- Dashboard, modal, dropdown, settings deu doc duoc.

### Buoc F3 - Spotlight search

File: `js/desktop-ui.js`, `js/desktop-app.js`, `css/desktop.css`

Lam:

- Overlay search trung tam.
- Shortcut trong renderer: `Ctrl+Shift+T`.
- Tim theo ten TK, platform, username mask.
- Enter mo detail account.
- Esc dong overlay.

Kiem tra:

- Search realtime dung.
- Enter mo detail dung account.
- Shortcut khong xung dot voi global focus cua Electron.

### Buoc F4 - Dashboard chart

File: `js/desktop-ui.js`, `css/desktop.css`

Lam:

- Donut chart phan bo TK theo platform/type bang Canvas API.
- Timeline tai khoan het han trong 30 ngay toi.
- Empty state khi khong co data.

Kiem tra:

- Canvas render khong blank.
- Resize man hinh chart khong vo layout.
- Data chart khop danh sach account.

---

## Phase G - Dong Bo, Build Va Nghiem Thu Cuoi

### Buoc G1 - Sync web Android neu can

Lenh:

```powershell
npm run prepare:android-web
```

Dung khi thay doi source goc can cap nhat `www/`.

### Buoc G2 - Chay Electron dev

Lenh:

```powershell
npm run electron:dev
```

Kiem tra:

- App load.
- Khong loi console nghiem trong.
- Cac flow A-F hoat dong.

### Buoc G3 - Build Windows

Lenh:

```powershell
npm run dist:win
```

Kiem tra:

- Tao installer va portable trong `DongGoi/dist-electron`.
- App build mo duoc.
- Tray, auto-lock, settings, update check hoat dong trong ban build.

### Buoc G4 - Checklist nghiem thu cuoi

- Dang nhap email/google khong loi.
- Dang ky email co confirm password, strength bar, email verification.
- Username mask dung format 2 ky tu.
- Password an mac dinh, reveal co timeout.
- Copy chi co khi unlock.
- Notification dropdown hien dung TK sap/da het han.
- Electron tray/minimize/focus hoat dong.
- Auto-start toggle duoc.
- Auto-lock khoa lai Master Password.
- Settings update check khong crash.
- Clipboard auto-clear, dark mode, spotlight, chart hoat dong neu da lam Phase F.

---

## Thu Tu Uu Tien Neu Can Rut Gon

Neu muon ra ban on dinh nhanh, lam theo goi nay truoc:

1. Phase A: Dang ky an toan va verify email.
2. Phase B: An/hien/copy secret dung cach.
3. Phase C: Notification panel trong app.
4. Phase D: Tray, single instance, auto-lock.
5. Phase E: Auto-update.
6. Phase F: Bonus.

## Ghi Chu Phat Sinh

- Chua co `.git` trong thu muc hien tai, nen neu can rollback nen tao ban copy file truoc khi sua lon.
- Can bo sung `owner/repo` GitHub thuc te truoc khi cau hinh auto-update release chinh thuc.
