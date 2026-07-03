# Kịch bản kiểm thử thủ công — Luồng native Android (`TingUpdaterPlugin`)

<!--
  Feature: auto-update-system — Task 8.4
  Thành phần: APK_Installer (android/app/src/main/java/app/ting/manager/TingUpdaterPlugin.java)
  Validates: Requirements 4.5, 4.7, 4.9, 5.3, 5.4, 9.5
-->

Tài liệu này mô tả các bước kiểm thử **thủ công trên thiết bị/emulator Android thật** cho plugin
Capacitor native `TingUpdaterPlugin` (`@CapacitorPlugin(name = "TingUpdater")`). Các bước này KHÔNG
chạy trên CI/Node vì cần môi trường Android (FileProvider, `PackageInstaller`, `Settings`, kiểm tra
chữ ký của hệ điều hành). Phần logic điều phối phía JS (`js/mobile-updater.js`) được kiểm chứng tự động
trong `tests/integration/mobile-updater-flow.test.js`.

## Điều kiện tiên quyết

- Thiết bị thật hoặc emulator chạy Android (khuyến nghị API 26+ để kiểm được
  `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES`; API 23–25 xem ghi chú ở Bước D).
- Build app Ting! bản Android (`npm run android:build:debug` hoặc build release), cài lên thiết bị.
- `applicationId = app.ting.manager`; FileProvider authority = `app.ting.manager.fileprovider`.
- Có sẵn một máy chủ/nguồn phát hành **HTTPS thuộc allowlist** để tải APK, ví dụ một release trên
  `github.com` / `objects.githubusercontent.com` / `raw.githubusercontent.com`
  (khớp `ALLOWED_HOSTS` trong plugin và `isAllowedReleaseUrl` phía JS).
- Chuẩn bị 2 APK dùng để kiểm thử:
  - **APK hợp lệ**: cùng khoá ký (signing key) với bản đang cài, versionCode cao hơn; ghi lại
    `apkSize` (byte) và `apkSha256` (SHA-256) chính xác.
  - **APK ký khoá khác**: cùng `applicationId` nhưng ký bằng keystore khác (để kiểm Bước E / 9.5).
- Bật `adb logcat` để quan sát log và event `downloadProgress` (cầu nối qua `notifyListeners`).

Cách gọi plugin từ webview khi kiểm thử thủ công (DevTools console của webview, qua `chrome://inspect`):

```js
const TingUpdater = window.Capacitor.Plugins.TingUpdater;
TingUpdater.addListener('downloadProgress', (e) => console.log('progress', e));
```

---

## Bước A — `downloadApk` từ origin cho phép + xác minh tiến độ `downloadProgress`

**Requirements: 4.5** (tải APK từ URL trong Release_Manifest), **9.4/9.5** (xác minh size + SHA-256).

Các bước:

1. Xác định `apkUrl`, `apkSize`, `apkSha256` của **APK hợp lệ**.
2. Đăng ký listener `downloadProgress` như đoạn mã ở trên.
3. Gọi:

   ```js
   await TingUpdater.downloadApk({
     url: '<apkUrl HTTPS thuộc allowlist>',
     expectedSha256: '<apkSha256>',
     expectedSize: <apkSize>,
   });
   ```

Kết quả mong đợi:

- Trong lúc tải, event `downloadProgress` phát liên tục với `percent` tăng dần `0 → 100`, kèm
  `transferred` và `total` (byte). Giá trị `percent` không vượt quá `100`.
- Khi tải xong và **size + SHA-256 khớp**, promise **resolve** với
  `{ filePath, size, sha256 }`; `filePath` nằm trong `getExternalFilesDir(null)` (fallback
  `getFilesDir()`), tên file `ting-update.apk`.
- File APK tồn tại thực tế tại `filePath` (kiểm bằng `adb shell run-as app.ting.manager ls -l ...`
  hoặc file manager phù hợp).

Trường hợp phủ định (tuỳ chọn, kiểm nhanh):

- Gọi `downloadApk` với `url` scheme `http://` hoặc host ngoài allowlist → promise **reject**
  "URL bản cập nhật không thuộc nguồn phát hành tin cậy.", KHÔNG tải.
- Gọi với `expectedSha256` sai (nhưng URL/kích thước đúng) → tải xong nhưng **reject**
  "Bản tải không qua kiểm tra toàn vẹn. Đã xoá file tải về."; file `ting-update.apk` bị xoá; installer
  KHÔNG được khởi chạy (9.4).

---

## Bước B — `installApk` mở intent cài đặt qua FileProvider

**Requirements: 4.7** (khởi chạy intent trình cài đặt gói qua FileProvider), **5.4** (cấp quyền đọc
tạm thời trên URI của APK).

Các bước:

1. Dùng `filePath` trả về từ Bước A.
2. Gọi:

   ```js
   await TingUpdater.installApk({ filePath: '<filePath>' });
   ```

Kết quả mong đợi:

- Hệ điều hành mở màn hình cài đặt gói (package installer) cho `ting-update.apk`.
- URI của APK được cấp qua FileProvider authority `app.ting.manager.fileprovider` (KHÔNG phải `file://`
  URI thô — nếu sai sẽ ném `FileUriExposedException`).
- Intent dùng `Intent.ACTION_VIEW` với type `application/vnd.android.package-archive`, có cờ
  `FLAG_GRANT_READ_URI_PERMISSION` (trình cài đặt đọc được file mà không lỗi quyền) và
  `FLAG_ACTIVITY_NEW_TASK`.
- Promise **resolve** `{ launched: true }` sau khi `startActivity` chạy trên UI thread.

Trường hợp phủ định:

- Gọi `installApk({ filePath: '<đường dẫn không tồn tại>' })` → **reject**
  "Không tìm thấy file APK để cài đặt."
- Gọi `installApk({})` (thiếu `filePath`) → **reject** "Thiếu đường dẫn file APK để cài đặt."

---

## Bước C — `cleanupApk` xoá APK đã tải

**Requirements: 4.9** (xoá file APK đã tải để tránh tích tụ dung lượng).

Các bước:

1. Đảm bảo `ting-update.apk` đang tồn tại (chạy Bước A trước).
2. Gọi một trong hai:

   ```js
   await TingUpdater.cleanupApk({ filePath: '<filePath>' }); // xoá đúng file chỉ định
   // hoặc
   await TingUpdater.cleanupApk({});                         // xoá file mặc định ting-update.apk
   ```

Kết quả mong đợi:

- File APK bị xoá khỏi thư mục tải; kiểm lại bằng `adb shell run-as ... ls -l` thấy file không còn.
- Promise **resolve** `{ deleted: true }` khi file tồn tại và xoá thành công.
- Gọi lại `cleanupApk` khi file đã bị xoá → **resolve** `{ deleted: false }` (idempotent, không lỗi).
- Kiểm bối cảnh "khởi động kế tiếp": mở lại app sau khi tải dở → xác nhận luồng khởi động gọi dọn dẹp
  (`cleanupDownloadedApk` phía JS) và APK cũ bị xoá.

---

## Bước D — `ensureInstallPermission` mở Settings khi thiếu quyền

**Requirements: 5.3** (nếu thiếu quyền cài gói → đưa người dùng tới màn hình "cài ứng dụng không rõ
nguồn gốc").

Chuẩn bị: thu hồi quyền "Cài đặt ứng dụng không rõ nguồn gốc" cho Ting! trong
Settings → Apps → Ting! → Install unknown apps (đặt về **Not allowed**).

Các bước:

1. Gọi:

   ```js
   await TingUpdater.ensureInstallPermission();
   ```

Kết quả mong đợi (API 26+ / Android O trở lên):

- Vì `canRequestPackageInstalls()` = `false`, plugin mở màn hình
  `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` với data `package:app.ting.manager`.
- Promise **resolve** `{ granted: false, opened: true }`.
- Sau khi người dùng bật quyền và gọi lại `ensureInstallPermission()` → **resolve** `{ granted: true }`.

Ghi chú theo phiên bản OS:

- **API 23–25** (dưới Android O): plugin trả `{ granted: true }` ngay vì không có màn hình quyền riêng
  cho cài ngoài; đây là hành vi đúng.
- Trên các thiết bị này, kiểm Bước B vẫn phải mở được trình cài đặt gói.

---

## Bước E — OS từ chối APK ký bằng khoá khác + xác minh checksum chống giả mạo

**Requirements: 9.5** (dựa vào kiểm tra chữ ký ký của Android để từ chối APK ký khoá khác, kết hợp xác
minh APK_Checksum làm lớp chống giả mạo).

### E.1 — Chặn ở tầng checksum (trước khi cài)

1. Lấy **APK ký khoá khác** (giả lập artifact bị giả mạo). Dùng `apkSize`/`apkSha256` của **APK hợp lệ**
   làm giá trị kỳ vọng (mô phỏng manifest công bố cho bản chính hãng).
2. Gọi `downloadApk` với `url` trỏ tới APK giả mạo nhưng `expectedSha256`/`expectedSize` của bản hợp lệ.

Kết quả mong đợi:

- Vì SHA-256 (và/hoặc size) không khớp, `downloadApk` **reject** lỗi toàn vẹn, **xoá file**, và
  installer KHÔNG bao giờ được khởi chạy. Đây là lớp chống giả mạo đầu tiên (9.4/9.5).

### E.2 — Chặn ở tầng chữ ký OS (khi cố cài trực tiếp)

1. Để kiểm riêng cơ chế OS, cài trực tiếp APK ký khoá khác qua adb:

   ```
   adb install -r <apk-ky-khoa-khac>.apk
   ```

   hoặc chỉ điểm `installApk` tới đúng file APK ký khoá khác (bỏ qua bước checksum) để mở trình cài đặt.

Kết quả mong đợi:

- Hệ điều hành **từ chối cài đè** với lỗi chữ ký không khớp
  (`INSTALL_FAILED_UPDATE_INCOMPATIBLE` / "App not installed" / signatures do not match the previously
  installed version). App hiện có KHÔNG bị thay thế bởi bản ký khoá khác.

Kết luận Bước E: bản cập nhật chỉ được cài khi **vừa khớp APK_Checksum trong manifest** vừa **được ký
bằng đúng khoá** như bản đang cài — hai lớp bảo vệ độc lập chống APK giả mạo.

---

## Bảng truy vết bước ↔ yêu cầu

| Bước | Nội dung | Requirements |
|---|---|---|
| A | `downloadApk` từ origin cho phép + tiến độ `downloadProgress` | 4.5, 9.4 |
| B | `installApk` mở intent qua FileProvider + FLAG_GRANT_READ_URI_PERMISSION | 4.7, 5.4 |
| C | `cleanupApk` xoá APK đã tải | 4.9 |
| D | `ensureInstallPermission` mở `ACTION_MANAGE_UNKNOWN_APP_SOURCES` | 5.3 |
| E | OS từ chối APK ký khoá khác + checksum chống giả mạo | 9.5 |

## Ghi chú vận hành

- Toàn bộ Bước A–E **chạy thủ công trên thiết bị/emulator**; không tự động hoá trong CI.
- Nếu cần tự động hoá một phần trong tương lai, có thể dùng Android instrumented test
  (`androidTest`, Espresso/UiAutomator) — ngoài phạm vi task hiện tại.
- Luồng điều phối JS gọi `downloadApk → installApk → cleanupApk` theo đúng thứ tự, và KHÔNG gọi
  `installApk` khi `downloadApk` thất bại toàn vẹn, đã được kiểm chứng tự động trong
  `tests/integration/mobile-updater-flow.test.js`.
