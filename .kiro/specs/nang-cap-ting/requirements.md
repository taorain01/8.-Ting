# Yêu cầu — Nâng cấp Ting!

## Giới thiệu
Gói nâng cấp cho app quản lý tài khoản Ting! (Desktop Electron + Mobile Android + Web), tập trung vào: hỗ trợ app Việt Nam, 2FA tạo mã trực tiếp, quản lý giá/hết hạn, dọn UI, và nhập liệu thông minh. Áp dụng cho cả `js/desktop-*` và `mobile/js/*`, dùng chung `js/parser.js`, `js/platform-icons.js`, `js/platform-tags.js`, `js/utils.js`, `js/crypto.js`.

## Yêu cầu

### R1 — Thêm VNeID và các app Việt Nam
- Nhận diện & hiển thị icon/nhãn cho: VNeID, VssID, Dịch vụ công, MoMo, ZaloPay, VNPAY, Viettel Money, các ngân hàng (VCB, TCB, BIDV, MB, VPBank, ACB, TPBank, Agribank, VietinBank, Sacombank), Shopee, Lazada, Tiki, Grab, Be, Gojek, Zing MP3, NhacCuaTui, FPT Play, VieON, K+, Viettel/Vina/Mobifone, Cốc Cốc, VNG, Garena...
- Có gói cước gợi ý phù hợp, không tạo false-positive với từ thông dụng.

### R2 — 2FA đưa trực tiếp vào app + link web
- Nếu key 2FA là secret TOTP hợp lệ: tạo mã 6 số trực tiếp trong app kèm đếm ngược 30s, nút copy mã.
- Nếu chưa lấy được/không hợp lệ: nút mở trang web 2FA (copy sẵn key).

### R3 — Nút đánh dấu hết hạn ngay
- Trong chi tiết TK (không phải vĩnh viễn, chưa hết hạn): nút đặt hết hạn về hôm nay ngay lập tức.

### R4 — Giá mua (tùy chọn)
- Trường nhập giá khi thêm/sửa; để trống thì không lưu, không hiển thị. Có thì hiện ở chi tiết (định dạng VND).

### R5 — Tổng quan hiện TK vừa thêm
- TK mới thêm hiện nổi bật ở đầu trang Tổng quan (trong ~2 phút), có nút ẩn.

### R6 — Dọn tab "TK Mua" và "Cá nhân"
- Thay hàng filter dày đặc bằng toolbar gọn (nút Lọc + Lọc nền tảng mở panel), có thanh filter đang áp dụng + xoá lọc.
- Xoá code trùng lặp/chết gây rối trong `mobile/js/ui.js`.

### R7 — Sửa hiển thị sai TK Kiro
- Kiro nằm trong danh sách nền tảng chọn nhanh; nhận diện theo tên hoạt động đúng.

### R8 — Dán link thông minh → tự nhận người bán
- Dán link Zalo/Telegram/Facebook/Discord/web vào ô "Dán thông tin tài khoản" → tự điền tên người bán, chọn nền tảng nguồn, lưu link click được ở chi tiết.

### R9 — Tối ưu nhập nhanh nền tảng
- Ô "Dán thông tin" và "Tên dịch vụ" nhận diện tốt hơn; picker nền tảng bổ sung Kiro/Grok/Cursor + app VN phổ biến.
