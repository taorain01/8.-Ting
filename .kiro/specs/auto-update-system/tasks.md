# Implementation Plan: Update_System (Auto-Update System)
<!-- Kế hoạch Triển khai: Hệ thống Tự cập nhật -->

## Overview
<!-- Tổng quan -->

Kế hoạch này chuyển thiết kế Update_System thành một chuỗi bước code tăng dần (incremental). Thứ tự
triển khai bám nguyên tắc "pure core, impure edges": xây tầng logic thuần dùng chung (`js/shared/*`)
trước, kiểm chứng bằng property-based test với **fast-check**, rồi mới nối vào các cạnh I/O (Electron
main, webview Android, plugin native Java) và UI. Mỗi bước kế thừa kết quả của bước trước và kết thúc
bằng việc "wiring" (nối dây) các thành phần lại với nhau, không để lại code mồ côi.

Ngôn ngữ triển khai: **JavaScript** (module UMD dùng chung cho Electron main + webview, test Node),
**Java** cho Capacitor plugin native Android, cấu hình CI cho Publish_Workflow.

## Tasks
<!-- Danh sách công việc -->

- [x] 1. Thiết lập bộ khung module dùng chung và hạ tầng kiểm thử
  - [x] 1.1 Tạo cấu trúc thư mục, mẫu module UMD, và cấu hình test
    - Tạo thư mục `js/shared/` cho tầng logic thuần và `tests/property/` cho property-based test
    - Định nghĩa mẫu module UMD nhẹ (chạy được cả `require` trong Node/Electron main và `<script>` trong webview) và áp dụng thống nhất cho các module `js/shared/*`
    - Cài đặt và cấu hình **fast-check** cùng test runner (ví dụ Vitest/Jest) trong `package.json`; thêm script chạy test một lần (không watch)
    - Định nghĩa các kiểu dữ liệu runtime dùng chung (`UpdateStatusKind`, `UpdateInfo`, `DownloadProgress`, `UpdateLogEntry`, `ReleaseManifest`, `BackgroundCheckState`) làm tài liệu tham chiếu (JSDoc typedef)
    - _Requirements: 2.1_

- [x] 2. Xây dựng Version_Comparator (`js/shared/version-compare.js`)
  - [x] 2.1 Hiện thực `normalizeVersion` và `compareVersions`
    - `normalizeVersion(value)`: bỏ tiền tố "v", cắt metadata build, giữ các đoạn số dạng chấm; chuỗi không có đoạn số hợp lệ coi như `"0.0.0"`
    - `compareVersions(left, right)`: trả về `-1 | 0 | 1` bằng cách so sánh từng đoạn số; đoạn thiếu coi là 0; đảm bảo tính phản đối xứng
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Viết property test cho tính đúng đắn và phản đối xứng của `compareVersions`
    - **Property 1: Tính đúng đắn và phản đối xứng của Version_Comparator**
    - **Validates: Requirements 2.1, 2.3, 2.4, 2.5**
    - Generator bao phủ chuỗi số đoạn khác nhau và chuỗi rác/không có số

  - [x] 2.3 Viết property test cho tính bất biến khi chuẩn hoá
    - **Property 2: Chuẩn hoá phiên bản không đổi kết quả so sánh**
    - **Validates: Requirements 2.2**

  - [x] 2.4 Hiện thực `classifyUpdateStatus` và `versionDistance`
    - `classifyUpdateStatus(installed, latest)`: `'up-to-date'` khi `compareVersions(installed, latest) >= 0`, ngược lại `'update-available'`
    - `versionDistance(installed, latest)`: số nguyên không âm; đoạn số cho desktop, version code (số) cho Android; bằng 0 khi tương đương
    - _Requirements: 2.6, 2.7, 7.9_

  - [x] 2.5 Viết property test cho phân loại trạng thái
    - **Property 3: Phân loại trạng thái nhất quán với so sánh phiên bản**
    - **Validates: Requirements 2.6, 2.7, 4.3, 4.8, 10.2, 10.3**

  - [x] 2.6 Viết property test cho khoảng cách phiên bản
    - **Property 4: Khoảng cách phiên bản không âm và bằng 0 khi tương đương**
    - **Validates: Requirements 7.9**

- [x] 3. Xây dựng Update_Core — các quyết định logic thuần (`js/shared/update-core.js`)
  - [x] 3.1 Hiện thực `sanitizeUpdateMessage` và `appendUpdateLogEntry`
    - `sanitizeUpdateMessage(message)`: thay token GitHub (`gh[opsu]_...`), `set-cookie`, response header nhạy cảm bằng thông báo tiếng Việt chung an toàn
    - `appendUpdateLogEntry(log, entry)`: chèn mục mới nhất lên đầu, giữ tối đa 10 mục
    - _Requirements: 6.5, 6.6_

  - [x] 3.2 Viết property test cho làm sạch thông báo lỗi
    - **Property 7: Làm sạch thông báo lỗi loại bỏ token/credential**
    - **Validates: Requirements 6.6**

  - [x] 3.3 Viết property test cho cắt nhật ký cập nhật
    - **Property 8: Nhật ký cập nhật giữ tối đa 10 mục, mới nhất ở đầu**
    - **Validates: Requirements 6.5**

  - [x] 3.4 Hiện thực `parseReleaseManifest` và `verifyArtifactIntegrity`
    - `parseReleaseManifest(raw)`: kiểm tra schema và trả về `{ok, manifest?, error?}`; thiếu trường bắt buộc → `ok = false`
    - `verifyArtifactIntegrity(actual, expected)`: `true` khi và chỉ khi cả `size` và `sha256` khớp
    - _Requirements: 4.2, 6.4, 8.3, 8.4, 9.4_

  - [x] 3.5 Viết property test cho round-trip và schema của Release_Manifest
    - **Property 9: Round-trip và kiểm tra schema của Release_Manifest**
    - **Validates: Requirements 4.2, 8.3, 8.4**

  - [x] 3.6 Viết property test cho xác minh tính toàn vẹn artifact
    - **Property 10: Xác minh tính toàn vẹn artifact chính xác**
    - **Validates: Requirements 6.4, 9.4**

  - [x] 3.7 Hiện thực `decideNotificationKind`, `shouldRunBackgroundCheck`, và `isAllowedReleaseUrl`
    - `decideNotificationKind(distance)`: `'toast'` khi `distance <= 3`, `'dialog'` khi `distance > 3`
    - `shouldRunBackgroundCheck(lastCheckAt, now, enabled)`: `true` khi `enabled` và (`lastCheckAt === null` hoặc `now - lastCheckAt >= 24h`)
    - `isAllowedReleaseUrl(url)`: `true` khi scheme là `https` và host thuộc allowlist (`raw.githubusercontent.com` + miền tải asset GitHub)
    - _Requirements: 7.4, 7.5, 7.7, 7.8, 9.3, 9.4_

  - [x] 3.8 Viết property test cho ngưỡng thông báo Background_Check
    - **Property 5: Ngưỡng thông báo Background_Check theo khoảng cách**
    - **Validates: Requirements 7.7, 7.8**

  - [x] 3.9 Viết property test cho kiểm soát tần suất 24 giờ
    - **Property 6: Kiểm soát tần suất Background_Check trong 24 giờ**
    - **Validates: Requirements 7.4, 7.5**

  - [x] 3.10 Viết property test cho allowlist origin URL
    - **Property 12: Chỉ chấp nhận URL phát hành từ origin tin cậy qua HTTPS**
    - **Validates: Requirements 9.3, 9.4**

- [x] 4. Xây dựng Platform_Detector (`js/shared/platform-detector.js`)
  - [x] 4.1 Hiện thực `detectPlatform` và `updateCapability`
    - `detectPlatform(env)`: xác định `'electron' | 'android' | 'ios' | 'web'` từ object `env` được bơm phụ thuộc (từ `window.electronAPI?.isElectron`, `window.Capacitor?.getPlatform?.()`)
    - `updateCapability(platform)`: `canCheck = true` cho `electron`/`android`; `false` cho `ios`/`web` kèm `disabledMessage` tiếng Việt (iOS: "Cập nhật qua App Store", web: thông báo không hỗ trợ)
    - _Requirements: 1.2, 1.3, 1.4, 10.2, 10.3, 10.4_

  - [x] 4.2 Viết property test cho năng lực cập nhật theo nền tảng
    - **Property 13: Năng lực cập nhật theo nền tảng**
    - **Validates: Requirements 1.2, 1.3, 1.4, 10.2, 10.3**

  - [x] 4.3 Viết unit test cho `detectPlatform` với các `env` mock
    - Kiểm tra phát hiện Electron, Android, iOS, web và trường hợp không xác định được
    - _Requirements: 10.3_

- [x] 5. Checkpoint — Đảm bảo tầng logic thuần đạt yêu cầu
  - Đảm bảo tất cả test qua, hỏi người dùng nếu có thắc mắc.

- [x] 6. Refactor Desktop_Updater dùng module chung và hoàn thiện luồng electron-updater (`DongGoi/electron/main.cjs`)
  - [x] 6.1 Thay thế bản sao `compareVersions`/`normalizeVersion` bằng Version_Comparator dùng chung
    - `require('../../js/shared/version-compare.js')` (hoặc đường dẫn tương ứng) trong main process
    - Chuyển `sanitizeUpdateMessage`/`appendUpdateLog` sang gọi Update_Core dùng chung
    - _Requirements: 2.1, 6.5, 6.6_

  - [x] 6.2 Nối luồng electron-updater đầu-cuối
    - Dùng `autoUpdater.checkForUpdates()` / `downloadUpdate()` / `quitAndInstall()` thay cho chỉ gọi REST API `releases/latest`
    - Phát `update-event` qua `sendToRenderer` với payload `{status, message, info, progress, log}`; giữ nguyên IPC `updates:check`, `updates:get-log`, `updates:quit-and-install`
    - Khoá tải để chỉ một tiến trình tải diễn ra tại một thời điểm (single-flight)
    - Lưu nhật ký bằng `electron-store` khoá `updateLog`, cắt bằng `appendUpdateLogEntry`
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.5_

  - [x] 6.3 Viết property test cho bất biến single-flight của luồng tải
    - **Property 14: Bất biến chỉ một tiến trình tải tại một thời điểm (single-flight)**
    - **Validates: Requirements 3.4, 4.6**

  - [x] 6.4 Viết integration test cho luồng desktop với `latest.yml` mẫu
    - Dùng feed cục bộ/mock cho `electron-updater`; kiểm tra phát hiện, tải, `quitAndInstall`
    - _Requirements: 3.2, 3.3, 3.6_

- [x] 7. Xây dựng Mobile_Updater cho webview Android (`js/mobile-updater.js`)
  - [x] 7.1 Hiện thực `checkForUpdate`
    - `fetch` `version.json` từ URL cố định `https://raw.githubusercontent.com/taorain01/ting-releases/main/version.json` qua HTTPS, không xác thực
    - Kiểm tra URL bằng `isAllowedReleaseUrl`, phân tích bằng `parseReleaseManifest`, so sánh version code bằng Version_Comparator, phân loại trạng thái
    - Lưu/đọc nhật ký và mốc Background_Check bằng `localStorage`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.8, 9.3_

  - [x] 7.2 Hiện thực `downloadAndInstall`, `onProgress`, và chính sách thử lại toàn vẹn
    - Uỷ quyền tải + xác minh toàn vẹn (`verifyArtifactIntegrity`) + cài đặt cho APK_Installer native
    - Khoá tải single-flight; phát tiến độ phần trăm qua `onProgress`
    - Khi lỗi toàn vẹn: xoá artifact, tự thử lại tối đa 1 lần (tổng ≤ 2 lần tải), sau đó dừng và cung cấp nút thử lại thủ công; KHÔNG bao giờ khởi chạy installer khi thất bại toàn vẹn
    - _Requirements: 4.5, 4.6, 6.3, 6.4, 9.4_

  - [x] 7.3 Viết property test cho chính sách thử lại khi lỗi toàn vẹn
    - **Property 11: Chính sách thử lại khi lỗi toàn vẹn không bao giờ cài đặt**
    - **Validates: Requirements 6.4**

  - [x] 7.4 Viết unit test cho xử lý lỗi Mobile_Updater với mock
    - Offline, HTTP 4xx/5xx, tải thất bại giữa chừng, manifest sai định dạng
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 8. Xây dựng APK_Installer — Capacitor plugin native (`TingUpdaterPlugin.java`)
  - [x] 8.1 Khai báo quyền và FileProvider trong `AndroidManifest.xml`
    - Thêm quyền `REQUEST_INSTALL_PACKAGES`
    - Khai báo/tận dụng FileProvider `${applicationId}.fileprovider` với `file_paths.xml` cấp quyền đọc APK đã tải
    - _Requirements: 5.1, 5.2_

  - [x] 8.2 Hiện thực `downloadApk`, `installApk`, `ensureInstallPermission`, `cleanupApk`
    - `downloadApk(call)`: tải HTTPS chỉ từ origin cho phép, phát tiến độ về JS
    - `installApk(call)`: `Intent.ACTION_VIEW`/`ACTION_INSTALL_PACKAGE` với URI qua FileProvider, cấp `FLAG_GRANT_READ_URI_PERMISSION`
    - `ensureInstallPermission(call)`: nếu `canRequestPackageInstalls()` = false → mở `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES`
    - `cleanupApk(call)`: xoá APK đã tải (sau cài đặt hoặc lúc khởi động kế tiếp)
    - _Requirements: 4.7, 4.9, 5.3, 5.4_

  - [x] 8.3 Đăng ký plugin trong `MainActivity.onCreate()`
    - Đăng ký `TingUpdaterPlugin` theo mẫu `TingNotificationsPlugin`
    - _Requirements: 4.7_

  - [x] 8.4 Viết integration test cho luồng native Android
    - Tải APK, chạy intent cài đặt qua FileProvider, dọn dẹp APK; xác minh OS từ chối APK ký khác khoá (chạy trên thiết bị/emulator, thủ công khi cần)
    - _Requirements: 4.5, 4.7, 4.9, 5.3, 5.4, 9.5_

- [x] 9. Checkpoint — Đảm bảo các cạnh I/O hoạt động
  - Đảm bảo tất cả test qua, hỏi người dùng nếu có thắc mắc.

- [x] 10. Mở rộng Update_UI cho đa nền tảng (`js/desktop-ui.js`)
  - [x] 10.1 Mở rộng khu "Phiên bản" theo Platform_Detector
    - `renderSettings`/`renderUpdateStatus`/`renderUpdateLog` hiển thị Installed_Version trên mọi nền tảng
    - Bật/vô hiệu hoá hành động "Kiểm tra" theo `updateCapability`; iOS hiển thị "Cập nhật qua App Store", web hiển thị thông báo không hỗ trợ + liên kết tải thủ công
    - Định tuyến "Kiểm tra"/"Cập nhật"/"Cài đặt" tới Desktop_Updater (IPC) hoặc Mobile_Updater theo nền tảng
    - Ánh xạ trạng thái (`idle | checking | update-available | downloading | downloaded | up-to-date | error | offline`) sang nhãn/thông báo tiếng Việt; hiển thị tiến độ phần trăm; khoá hành động khi đang tải
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.4, 3.5, 3.7, 4.4, 4.6, 4.8, 6.1, 6.2, 6.3, 10.1, 10.2, 10.3, 10.4_

  - [x] 10.2 Hiện thực cảnh báo Min_Supported_Version
    - Khi Installed_Version < Min_Supported_Version: hiển thị cảnh báo nổi bật khuyến nghị cập nhật ngay nhưng vẫn cho bỏ qua/tiếp tục
    - _Requirements: 9.7_

  - [x] 10.3 Viết unit test cho ánh xạ trạng thái → thông báo tiếng Việt và định tuyến theo nền tảng
    - Kiểm tra mapping nhãn/thông báo và cảnh báo Min_Supported_Version vẫn cho tiếp tục
    - _Requirements: 1.6, 3.5, 3.7, 4.4, 9.7, 10.1, 10.4_

- [x] 11. Nối Background_Check vào luồng khởi động
  - [x] 11.1 Hiện thực điều phối Background_Check
    - Cung cấp cài đặt `enabled` mặc định bật; đọc/ghi `BackgroundCheckState` (desktop `electron-store`, Android `localStorage`)
    - Lúc khởi động xong, gọi kiểm tra không chặn qua `shouldRunBackgroundCheck` (tôn trọng ngưỡng 24h và cờ enabled)
    - Khi tìm thấy bản mới: dùng `decideNotificationKind` để chọn toast (khoảng cách ≤ 3) hoặc dialog nổi (> 3 hoặc khi mở app), kèm hành động cập nhật và tùy chọn bỏ qua
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 11.2 Viết unit test cho Background_Check
    - Mặc định bật; khởi động gọi check không chặn; tôn trọng ngưỡng 24h và cờ tắt
    - _Requirements: 7.1, 7.2, 7.5_

- [x] 12. Hiện thực Publish_Workflow (CI — `.github/workflows` hoặc script)
  - [x] 12.1 Bước phát hành desktop
    - Build `.exe` + sinh `latest.yml`; upload cả hai lên nguồn phát hành desktop
    - _Requirements: 3.1, 8.1_

  - [x] 12.2 Bước phát hành Android và ghi Release_Manifest
    - Build APK; tính APK_Checksum (SHA-256) + kích thước file; ghi `version.json` với `latestVersion`, `versionCode`, `releaseNotes`, `apkUrl`, `apkSize`, `apkSha256`, `minSupportedVersion`; upload APK + `version.json` lên Releases_Repository
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 12.3 Guard artifact thiếu
    - Nếu thiếu artifact build cần thiết → dừng, không sửa `version.json`, báo cáo artifact bị thiếu
    - _Requirements: 8.5_

  - [x] 12.4 Viết unit test cho guard thiếu artifact của Publish_Workflow
    - Xác nhận workflow dừng và không ghi `version.json` khi thiếu artifact
    - _Requirements: 8.5_

- [x] 13. Kiểm thử cấu hình & bảo mật (smoke tests)
  - [x] 13.1 Viết smoke test cho artifact phát hành và cấu hình Android
    - `latest.yml` + `.exe` được publish (3.1, 8.1); APK + `version.json` được publish (8.2); `AndroidManifest.xml` khai báo `REQUEST_INSTALL_PACKAGES` và FileProvider (5.1, 5.2)
    - _Requirements: 3.1, 5.1, 5.2, 8.1, 8.2_

  - [x] 13.2 Viết smoke test cho ràng buộc bảo mật
    - Không có token/secret trong bundle app phân phối (9.1); Releases_Repository chỉ chứa artifact (9.2); không hồi quy Firestore rules và mã hoá AES-256/PBKDF2 (9.6); đo thời gian khởi động xác nhận Background_Check không chặn (7.3)
    - _Requirements: 7.3, 9.1, 9.2, 9.6_

- [x] 14. Checkpoint cuối — Đảm bảo toàn bộ test qua
  - Đảm bảo tất cả test qua, hỏi người dùng nếu có thắc mắc.

## Notes
<!-- Ghi chú -->

- Các task đánh dấu `*` là tùy chọn (test) và có thể bỏ qua để ra MVP nhanh hơn; task hiện thực cốt lõi không bao giờ đánh dấu tùy chọn.
- Mỗi task tham chiếu tiêu chí chấp nhận cụ thể để truy vết (traceability).
- Các checkpoint đảm bảo kiểm chứng tăng dần.
- Property test (dùng **fast-check**, tối thiểu 100 vòng lặp) kiểm chứng 14 correctness property của thiết kế; mỗi property là một sub-task riêng đặt gần phần hiện thực để bắt lỗi sớm.
- Unit/integration/smoke test kiểm chứng phần I/O, UI, native và CI theo Testing Strategy.
- Module `js/shared/*` viết theo UMD để `require` được trong Node/Electron main và nạp `<script>` được trong webview.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.1", "8.1"] },
    { "id": 1, "tasks": ["2.4", "3.4", "8.2", "2.2", "2.3", "3.2", "3.3", "4.2", "4.3"] },
    { "id": 2, "tasks": ["3.7", "6.1", "7.1", "8.3", "12.1", "2.5", "2.6", "3.5", "3.6"] },
    { "id": 3, "tasks": ["6.2", "7.2", "10.1", "12.2", "8.4", "3.8", "3.9", "3.10"] },
    { "id": 4, "tasks": ["6.3", "6.4", "7.3", "7.4", "10.2", "12.3"] },
    { "id": 5, "tasks": ["10.3", "11.1", "12.4", "13.1", "13.2"] },
    { "id": 6, "tasks": ["11.2"] }
  ]
}
```
