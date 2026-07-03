# Kịch bản kiểm thử thủ công — Luồng cập nhật desktop (electron-updater + `latest.yml`)

<!--
  Feature: auto-update-system — Task 6.4
  Thành phần: Desktop_Updater (DongGoi/electron/main.cjs — setupAutoUpdater,
              startUpdateDownload, IPC updates:check/get-log/quit-and-install)
  Validates: Requirements 3.2, 3.3, 3.6
-->

Tài liệu này mô tả cách kiểm thử **luồng electron-updater THẬT** trên Electron runtime với một feed
`latest.yml` cục bộ. Các bước này KHÔNG chạy trên CI/Node vì `electron-updater` cần tiến trình Electron
thật (chữ ký, giải nén, ghi đĩa). Phần "wiring" logic (phát hiện → tự tải → sẵn sàng cài, khoá
single-flight, IPC) được kiểm chứng tự động trong `tests/integration/desktop-updater-flow.test.js`
bằng mock autoUpdater; file `tests/fixtures/latest.yml` là feed mẫu dùng chung cho cả hai.

## Điều kiện tiên quyết

- Windows với Node + phụ thuộc đã cài (`npm install`).
- Build bản đóng gói không nén: `npm run dist:unpacked` (tạo `DongGoi/dist-electron/win-unpacked`).
- Một trình phục vụ HTTP tĩnh cục bộ (ví dụ `npx serve` hoặc `python -m http.server`) để giả lập
  nguồn phát hành. electron-updater đọc `latest.yml` + trình cài đặt `.exe` từ cùng thư mục.
- Hai artifact đặt trong thư mục phục vụ:
  - `latest.yml` (tham chiếu `tests/fixtures/latest.yml`; cập nhật `sha512`/`size` cho khớp `.exe` thật).
  - `Ting-setup-<version>.exe` (trình cài đặt do `electron-builder` sinh).

## Bước 1 — Trỏ electron-updater tới feed cục bộ

Trong bản build thử, cấu hình `autoUpdater.setFeedURL` (hoặc file `dev-app-update.yml` cạnh app) trỏ
tới nguồn cục bộ:

```yml
# dev-app-update.yml
provider: generic
url: http://localhost:5000/
```

Đặt `Installed_Version` (trong `package.json` của bản build) THẤP hơn `version` trong `latest.yml`
(ví dụ cài `1.3.0`, feed công bố `1.4.0`) để kích hoạt nhánh "có bản cập nhật".

## Bước 2 — Kiểm tra phát hiện + tự động tải (Yêu cầu 3.2, 3.3)

1. Mở app; vào Cài đặt → khu "Phiên bản"; bấm **"Kiểm tra"** (IPC `updates:check`).
2. Quan sát chuỗi `update-event` phát về renderer (DevTools console lắng nghe `electronAPI`).

Kết quả mong đợi:

- Phát `status: 'checking'` ("Đang kiểm tra cập nhật...").
- electron-updater đọc `latest.yml`, thấy `1.4.0 > 1.3.0` → phát `status: 'available'`.
- Vì `autoDownload = false`, `startUpdateDownload` tự gọi `downloadUpdate()` (khoá single-flight bật).
- Phát `status: 'downloading'` kèm `progress.percent` tăng dần `0 → 100` (Yêu cầu 3.4).

## Bước 3 — Sẵn sàng cài đặt + `quitAndInstall` (Yêu cầu 3.5, 3.6)

1. Chờ tải xong: phát `status: 'downloaded'` ("Bản cập nhật đã sẵn sàng (1.4.0)"), hành động
   **"Cài đặt"** được bật.
2. Bấm **"Cài đặt"** (IPC `updates:quit-and-install`).

Kết quả mong đợi:

- App thoát và trình cài đặt `.exe` của phiên bản đã tải được khởi chạy (Yêu cầu 3.6).
- Sau khi cài, mở lại app: `Installed_Version` = `1.4.0`; bấm "Kiểm tra" → `status: 'not-available'`
  ("Đang ở bản mới nhất") (Yêu cầu 3.7).

## Bước 4 — Kiểm khoá single-flight (Yêu cầu 3.4)

1. Trong lúc `downloading`, bấm **"Kiểm tra"** hoặc **"Cập nhật"** nhiều lần liên tiếp.

Kết quả mong đợi:

- Chỉ MỘT tiến trình tải diễn ra; các yêu cầu tải chồng lấn bị bỏ qua cho tới khi tải hiện tại kết
  thúc (log nội bộ: "update download skipped (single-flight lock held)").

## Bước 5 — Nhật ký cập nhật (Yêu cầu 6.5)

1. Gọi IPC `updates:get-log` (qua UI khu "Phiên bản" hoặc DevTools).

Kết quả mong đợi:

- Nhật ký giữ tối đa 10 mục, mục mới nhất ở đầu; các trạng thái `available`/`downloaded` được ghi kèm
  `version`, `source`, `date` (định dạng vi-VN).

## Bảng truy vết bước ↔ yêu cầu

| Bước | Nội dung | Requirements |
|---|---|---|
| 2 | Phát hiện `latest.yml` + tự động tải | 3.2, 3.3, 3.4 |
| 3 | Sẵn sàng cài + `quitAndInstall` | 3.5, 3.6, 3.7 |
| 4 | Khoá single-flight | 3.4 |
| 5 | Nhật ký cập nhật | 6.5 |

## Ghi chú vận hành

- Các bước trên **chạy thủ công trên Windows với Electron runtime**; không tự động hoá trong CI.
- Phần logic wiring (`setupAutoUpdater`/`startUpdateDownload`/IPC) đã được kiểm chứng tự động trong
  `tests/integration/desktop-updater-flow.test.js` với mock autoUpdater và `tests/fixtures/latest.yml`.
