# Lịch sử thay đổi Ting!

File này lưu tóm tắt các thay đổi đáng chú ý theo từng phiên bản. Nội dung được
đối chiếu từ Git tag, commit và diff giữa các tag; không liệt kê các thay đổi nội
bộ quá nhỏ.

## Cách cập nhật

- Trong quá trình phát triển, thêm thay đổi đáng chú ý vào mục `Chưa phát hành`.
- Khi phát hành, chuyển các dòng liên quan sang mục `x.y.z - YYYY-MM-DD`.
- Chỉ ghi tóm tắt hành vi người dùng, bảo mật, dữ liệu hoặc quy trình phát hành.
- Không đưa spec, token, thông tin xác thực hoặc chi tiết triển khai nhạy cảm vào đây.

## Chưa phát hành

- Sửa Android CI không chạy được `gradlew` trên runner Linux sau khi checkout.

## 1.7.0 - 2026-07-17

- Thêm bảng lịch sử phiên bản trong Cài đặt; chọn một phiên bản sẽ ẩn nội dung cũ và hiện đúng thay đổi của bản được chọn.
- Thêm khôi phục backup có xem trước, chọn dữ liệu và merge tài khoản, thùng rác, danh mục.
- Thêm hệ thống dialog/toast dùng chung cho PC và mobile, hỗ trợ bàn phím và Android Back.
- Thêm giờ mua, sửa ngày nghiệp vụ theo múi giờ địa phương và bổ sung lịch sử dữ liệu đã nhập.
- Cải thiện search/filter, thao tác vuốt tab, kéo thả nhóm, animation, reduced motion và accessibility.
- Tăng cường XSS escaping, CSP nền, security headers và tắt Android OS Auto Backup.

## 1.6.0 - 2026-07-15

- Thêm Smart Paste để nhận diện tài khoản, mật khẩu, 2FA, nền tảng, thời hạn, người bán và giá.
- Chuyển form thêm tài khoản thành wizard có hướng dẫn, lịch sử nhập và điều hướng nhanh giữa các bước.
- Bổ sung tag gói cước tùy chỉnh, danh mục tạo nhanh và cải thiện form thêm/sửa trên PC lẫn mobile.
- Hoàn thiện tài liệu release và phương án dự phòng khi phát hành qua GitHub REST API.

## 1.5.1 - 2026-07-13

- Thêm chế độ xem thông tin chi tiết ngay trên card tài khoản, gồm ghi chú, ngày và link người bán.
- Cải thiện bộ lọc nhanh và phần tiêu đề kết quả theo nền tảng.
- Đồng bộ an toàn hơn giữa tài khoản gốc và tài khoản được chia sẻ trong nhóm.

## 1.5.0 - 2026-07-08

- Thiết kế lại màn hình Nhóm với Board, danh mục, tài khoản, thành viên và khu cài đặt rõ ràng hơn.
- Thêm chế độ chỉnh sửa nhóm: tạo/sửa/xóa/sắp xếp danh mục và di chuyển tài khoản.
- Bổ sung vai trò quản lý tài khoản, kiểm tra email mời và luồng duyệt/từ chối yêu cầu chỉnh sửa.
- Giữ trạng thái scroll/focus tốt hơn khi dữ liệu nhóm cập nhật realtime.

## 1.4.3 - 2026-07-07

- Thêm Sửa nhanh thông tin tài khoản ngay tại màn hình chi tiết, có xác thực và khôi phục khi hủy.
- Thêm mật khẩu vào nhóm độc lập với mật khẩu chung dùng để giải mã dữ liệu chia sẻ.
- Thêm nút ẩn/hiện tài khoản hết hạn, ưu tiên tài khoản đang hoạt động và nhóm thùng rác rõ ràng hơn.
- Bổ sung ghi chú theo nhóm tài khoản và thao tác vuốt tab trên mobile.

## 1.4.2 - 2026-07-05

- Cho phép bấm tài khoản trên Board nhóm để chuyển tới đúng card trong tab Tài khoản và làm nổi bật card.
- Cải thiện hiển thị release notes, trạng thái tải và dọn file APK cập nhật cũ.
- Ẩn thông tin bản mới khi thiết bị đã ở phiên bản mới nhất.

## 1.4.1 - 2026-07-05

- Thiết kế lại khu Cập nhật với trạng thái, release notes, lịch sử và thanh tiến trình tải.
- Hiển thị phiên bản hiện tại cạnh logo ở sidebar desktop.
- Giảm log cập nhật trùng khi ứng dụng đã ở phiên bản mới nhất.
- Cải thiện installer Windows và bố cục cập nhật trên màn hình hẹp.

## 1.4.0 - 2026-07-05

- Thêm màn hình thiết kế Nhóm trên mobile với danh mục tùy chỉnh, icon, màu và ghi chú.
- Hỗ trợ kéo thả để sắp xếp danh mục, tài khoản và chuyển tài khoản giữa các danh mục.
- Cho phép mở nhanh tài khoản từ Board nhóm sang tab Tài khoản.

## 1.3.9 - 2026-07-05

- Cho phép tạo nhóm không cần mật khẩu chung và tham gia nhóm không mật khẩu trực tiếp.
- Thêm tab Cài đặt nhóm để đặt, đổi hoặc gỡ mật khẩu chung và quản lý tên nhóm.
- Cải thiện nút mở rộng nhóm tài khoản và trạng thái khóa/mở khóa.
- Chuẩn hóa tài liệu hướng dẫn release cho PC và Android.

## 1.3.8 - 2026-07-04

- Thêm mở khóa bằng vân tay hoặc khuôn mặt trên thiết bị hỗ trợ.
- Thêm xuất và nhập file backup được mã hóa bằng Master Password.
- Thêm animation, ripple, haptic và hiệu ứng chuyển trang cho PC/mobile.
- Thêm quy trình backup Firestore hằng ngày qua GitHub Actions.

## 1.3.7 - 2026-07-03

- Sửa nút cập nhật Android khi manifest không có kích thước file dự kiến.
- Tiếp tục xác minh file APK tải về bằng SHA-256 trước khi cài đặt.

## 1.3.6 - 2026-07-03

- Thêm cửa sổ Quick Add cho Electron và hỗ trợ thêm nhanh tài khoản từ context hiện tại.
- Bổ sung danh mục tài khoản nhóm, quyền quản lý tài khoản và thứ tự tài khoản chia sẻ.
- Sửa lỗi cuộn và dẫn focus trong form Thêm tài khoản trên PC/mobile.

## 1.3.5 - 2026-07-03

- Sửa installer Windows và luồng đóng ứng dụng trước khi cài bản cập nhật.
- Sửa quá trình tải, kiểm tra và mở file cập nhật trên Android.

## 1.3.4 - 2026-07-03

- Đồng bộ version desktop/Android và kiểm tra lại pipeline phát hành.

> Git không có tag `v1.3.3`; vì vậy không có mục riêng cho phiên bản này.

## 1.3.2 - 2026-07-03

- Hotfix hệ thống cập nhật đa nền tảng.
- Hoàn thiện phần native Android cho tải/cài APK và kiểm tra thông báo tài khoản hết hạn nền.

## 1.3.1 - 2026-07-03

- Thêm luồng hướng dẫn khi tạo tài khoản, tự dẫn qua nền tảng, dữ liệu đăng nhập và thời hạn.
- Sửa build/publish Android và xử lý lỗi updater rõ ràng hơn.

## 1.3.0 - 2026-07-03

- Thêm cập nhật trong ứng dụng cho Electron và Android, kèm kiểm tra phiên bản và tính toàn vẹn artifact.
- Thêm workflow phát hành tự động cho installer Windows, APK và manifest cập nhật.
- Bổ sung Nhóm chia sẻ tài khoản, điều hướng Back có lịch sử và cải thiện nhận diện nền tảng.
- Cải tiến dashboard, sidebar desktop và hồ sơ người dùng.

## 1.0.0 - 2026-04-27

- Khởi tạo Ting! Account Manager với quản lý tài khoản, mã hóa dữ liệu và giao diện desktop/mobile cơ bản.
