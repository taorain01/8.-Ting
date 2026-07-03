# Requirements Document
<!-- Tài liệu Yêu cầu -->

## Introduction
<!-- Giới thiệu -->

Tính năng này mang lại trải nghiệm tự cập nhật trong ứng dụng (in-app update) thống nhất, đa nền tảng
cho app quản lý tài khoản "Ting!". Người dùng trên cả bản desktop Windows (Electron) lẫn bản Android
cài ngoài (sideload, dùng Capacitor) đều có thể mở phần Cài đặt, bấm "Kiểm tra", xem phiên bản hiện
tại và biết có bản mới hơn hay không, đọc ghi chú phát hành (release notes), rồi kích hoạt cập nhật
("Cập nhật" / "Cài đặt").

Trên desktop, app dùng lại tích hợp `electron-updater` sẵn có với GitHub Releases làm nguồn phát hành
(owner `taorain01`, repo `8.-Ting`). Hiện tại GitHub release mới chỉ publish trình cài đặt `.exe` mà
chưa có `latest.yml`, nên `electron-updater` chưa thể hoàn tất luồng cập nhật đầu-cuối. Tính năng này
bao gồm việc publish `latest.yml` để tự cập nhật desktop hoạt động đầy đủ.

Trên Android, app được phân phối dưới dạng APK cài ngoài (không qua Google Play). Việc cập nhật do một
**repository công khai riêng chỉ chứa bản phát hành** (ví dụ `ting-releases`) điều khiển — repo này chỉ
chứa file APK và một manifest `version.json`. Repository mã nguồn (private) không bao giờ bị lộ, và
không có GitHub token nào bị nhúng vào app phân phối. App đọc `version.json` mà không cần xác thực, so
sánh phiên bản, tải APK, kiểm tra tính toàn vẹn, rồi khởi chạy intent trình cài đặt gói của Android.

Một quy trình phát hành (Publish_Workflow) tự động hoá việc tải lên các artifact desktop và Android đã
build và cập nhật metadata phát hành (`latest.yml` cho desktop, `version.json` + APK cho Android) trong
repository phát hành công khai.

iOS nằm ngoài phạm vi tự cập nhật trong app (App Store lo việc cập nhật), và giao diện cập nhật phải
suy giảm nhẹ nhàng (degrade gracefully) trên nền tảng đó. Tính năng này không được làm suy yếu trạng
thái bảo mật Firebase hiện có (Firestore rules cùng mã hoá client-side AES-256/PBKDF2). Toàn bộ chuỗi
văn bản hiển thị cho người dùng đều bằng tiếng Việt để đồng nhất với app hiện tại.

## Glossary
<!-- Thuật ngữ -->

- **Update_System**: Toàn bộ năng lực cập nhật đa nền tảng được mô tả trong tài liệu này.
- **Update_UI**: Khu vực "Phiên bản" trong Cài đặt, hiển thị phiên bản hiện tại, trạng thái cập nhật,
  release notes, và các hành động kiểm tra/cập nhật; được render bởi `renderSettings` /
  `renderUpdateStatus` trong `js/desktop-ui.js`.
- **Version_Comparator**: Thành phần so sánh phiên bản dạng semantic version dùng chung, quyết định một
  phiên bản ứng viên có mới hơn phiên bản đã cài hay không (tổng quát hoá `compareVersions` /
  `normalizeVersion` trong `DongGoi/electron/main.cjs`).
- **Desktop_Updater**: Thành phần cập nhật phía Electron dựa trên `electron-updater`
  (`setupAutoUpdater`, `getAutoUpdater`, `checkGithubRelease` trong `DongGoi/electron/main.cjs`).
- **Mobile_Updater**: Thành phần cập nhật phía Android, đọc `version.json`, tải APK, và gọi trình cài
  đặt.
- **APK_Installer**: Phần code native Android (một Capacitor plugin) kích hoạt intent trình cài đặt gói
  cho file APK đã tải, thông qua một FileProvider.
- **Release_Manifest**: File `version.json` trong repository phát hành công khai, mô tả bản phát hành
  Android mới nhất; được đọc từ một URL `raw.githubusercontent.com` cố định (nhánh `main`).
- **Releases_Repository**: Repository GitHub công khai riêng (ví dụ `ting-releases`) chỉ chứa artifact
  APK, `version.json`, và (cho desktop) `latest.yml` cùng trình cài đặt. Repo này không chứa mã nguồn
  và không chứa secret.
- **Publish_Workflow**: Script hoặc workflow CI tự động tải artifact đã build lên và cập nhật metadata
  phát hành trong Releases_Repository.
- **Platform_Detector**: Bước kiểm tra lúc chạy để xác định app đang chạy dưới Electron, Android, hay
  nền tảng khác (tổng quát hoá `window.electronAPI?.isElectron`).
- **Installed_Version**: Phiên bản app đang chạy (`1.3.0` desktop / versionName `1.3`, versionCode `3`
  trên Android).
- **Latest_Version**: Phiên bản do nguồn phát hành công bố (`latest.yml` cho desktop, Release_Manifest
  cho Android).
- **Min_Supported_Version**: Một trường trong Release_Manifest cho biết Installed_Version thấp nhất được
  phép nhảy thẳng lên Latest_Version.
- **APK_Checksum**: Mã băm SHA-256 của artifact APK ghi trong Release_Manifest, dùng để kiểm tra tính
  toàn vẹn của bản tải.
- **Background_Check**: Lần kiểm tra cập nhật tự động, không chặn UI, thực hiện quanh lúc khởi động app.

## Requirements
<!-- Yêu cầu -->

### Yêu cầu 1: Điểm vào cập nhật trong app thống nhất

**User Story:** Là người dùng Ting! trên bất kỳ nền tảng được hỗ trợ nào, tôi muốn có một hành động
"Kiểm tra" duy nhất trong Cài đặt, để tôi biết được có bản mới hơn hay không bất kể thiết bị của mình.

#### Tiêu chí chấp nhận

1. THE Update_UI SHALL hiển thị Installed_Version trong khu vực "Phiên bản" trên mọi nền tảng được hỗ trợ.
2. WHERE app chạy dưới Electron, THE Update_UI SHALL bật hành động "Kiểm tra".
3. WHERE app chạy dưới Android, THE Update_UI SHALL bật hành động "Kiểm tra".
4. WHERE app chạy dưới iOS, THE Update_UI SHALL vô hiệu hoá hành động "Kiểm tra" và hiển thị thông báo tiếng Việt "Cập nhật qua App Store".
5. WHEN người dùng kích hoạt hành động "Kiểm tra", THE Update_System SHALL khởi tạo một lần kiểm tra cập nhật với nguồn phát hành tương ứng nền tảng hiện tại.
6. WHILE một lần kiểm tra cập nhật đang diễn ra, THE Update_UI SHALL vô hiệu hoá hành động "Kiểm tra" và hiển thị trạng thái tiếng Việt "Đang kiểm tra cập nhật...".

### Yêu cầu 2: So sánh phiên bản semantic dùng chung

**User Story:** Là lập trình viên, tôi muốn có một thành phần so sánh phiên bản dùng chung cho các nền
tảng, để quyết định cập nhật nhất quán trên desktop và Android.

#### Tiêu chí chấp nhận

1. WHEN Version_Comparator nhận hai chuỗi phiên bản, THE Version_Comparator SHALL trả về việc chuỗi thứ nhất lớn hơn, bằng, hay nhỏ hơn chuỗi thứ hai bằng cách so sánh từng đoạn số.
2. WHEN một chuỗi phiên bản có tiền tố "v" ở đầu hoặc metadata build ở đuôi, THE Version_Comparator SHALL chuẩn hoá chuỗi về các đoạn số dạng chấm trước khi so sánh.
3. WHEN hai chuỗi phiên bản có số đoạn khác nhau, THE Version_Comparator SHALL coi các đoạn thiếu là 0.
4. FOR ALL cặp chuỗi phiên bản, so sánh A với B SHALL cho kết quả phủ định của so sánh B với A (tính phản đối xứng).
5. IF một chuỗi phiên bản không chứa đoạn số phân tích được, THEN THE Version_Comparator SHALL coi phiên bản là `0.0.0` khi so sánh.
6. WHEN Installed_Version lớn hơn hoặc bằng Latest_Version, THE Update_System SHALL phân loại trạng thái là "đang ở bản mới nhất" (bao gồm cả trường hợp bản đã cài là bản dev/beta cao hơn bản chính thức).
7. WHEN Latest_Version lớn hơn Installed_Version, THE Update_System SHALL phân loại trạng thái là "có bản cập nhật".

### Yêu cầu 3: Cập nhật desktop qua electron-updater và latest.yml

**User Story:** Là người dùng desktop Windows, tôi muốn app tự phát hiện, tải, và cài bản cập nhật, để
tôi luôn ở phiên bản mới nhất mà không phải cài đặt lại thủ công.

#### Tiêu chí chấp nhận

1. THE Publish_Workflow SHALL publish file metadata `latest.yml` kèm trình cài đặt `.exe` cho mỗi bản phát hành desktop để Desktop_Updater có thể phân giải bản cập nhật.
2. WHEN người dùng kích hoạt "Kiểm tra" trên desktop, THE Desktop_Updater SHALL truy vấn nguồn GitHub Releases đã cấu hình để lấy Latest_Version.
3. WHEN Desktop_Updater phát hiện Latest_Version lớn hơn Installed_Version, THE Desktop_Updater SHALL tải trình cài đặt của phiên bản đó.
4. WHILE trình cài đặt desktop đang tải, THE Update_UI SHALL hiển thị tiến độ tải dưới dạng phần trăm và SHALL khoá hành động cập nhật để chỉ có một tiến trình tải diễn ra tại một thời điểm.
5. WHEN trình cài đặt desktop tải xong, THE Update_UI SHALL hiển thị thông báo tiếng Việt "Bản cập nhật đã sẵn sàng" và bật hành động "Cài đặt".
6. WHEN người dùng kích hoạt hành động "Cài đặt" sau khi tải xong, THE Desktop_Updater SHALL thoát app và khởi chạy trình cài đặt của phiên bản đã tải.
7. WHEN Desktop_Updater xác định Installed_Version đã là mới nhất, THE Update_UI SHALL hiển thị thông báo tiếng Việt "Đang ở bản mới nhất".

### Yêu cầu 4: Cập nhật Android qua manifest version.json

**User Story:** Là người dùng Android với APK cài ngoài, tôi muốn app kiểm tra và tải APK mới hơn từ
một nguồn công khai, để tôi cập nhật được mà không cần Google Play.

#### Tiêu chí chấp nhận

1. WHEN người dùng kích hoạt "Kiểm tra" trên Android, THE Mobile_Updater SHALL lấy Release_Manifest từ một URL cố định trên `raw.githubusercontent.com` của Releases_Repository (ví dụ `https://raw.githubusercontent.com/taorain01/ting-releases/main/version.json`) qua HTTPS mà không cần thông tin xác thực.
2. THE Release_Manifest SHALL chứa tên Latest_Version, version code, release notes, URL tải APK, Min_Supported_Version, kích thước file APK, và APK_Checksum.
3. WHEN Mobile_Updater lấy được Release_Manifest, THE Mobile_Updater SHALL so sánh version code trong manifest với version code của Installed_Version bằng Version_Comparator để quyết định có bản cập nhật hay không.
4. WHEN có bản cập nhật Android, THE Update_UI SHALL hiển thị Latest_Version, release notes, và một hành động "Cập nhật" được bật.
5. WHEN người dùng kích hoạt hành động "Cập nhật" trên Android, THE Mobile_Updater SHALL tải APK từ URL ghi trong Release_Manifest.
6. WHILE APK đang tải, THE Update_UI SHALL hiển thị tiến độ tải dưới dạng phần trăm và SHALL khoá hành động "Cập nhật" để chỉ có một tiến trình tải diễn ra tại một thời điểm.
7. WHEN APK tải xong, THE APK_Installer SHALL khởi chạy intent trình cài đặt gói của Android cho file APK đã tải thông qua một FileProvider.
8. WHEN Mobile_Updater xác định version code của Installed_Version lớn hơn hoặc bằng version code trong manifest, THE Update_UI SHALL hiển thị thông báo tiếng Việt "Đang ở bản mới nhất".
9. WHEN quá trình cài đặt kết thúc HOẶC WHEN app khởi động lần kế tiếp, THE Mobile_Updater SHALL xoá file APK đã tải để tránh tích tụ dung lượng.

### Yêu cầu 5: Quyền cài đặt Android và tích hợp native

**User Story:** Là người dùng Android, tôi muốn app có đủ quyền cần thiết để cài bản cập nhật, để việc
cập nhật diễn ra mà không bị lỗi cấu hình.

#### Tiêu chí chấp nhận

1. THE Android_App SHALL khai báo quyền `REQUEST_INSTALL_PACKAGES` trong manifest.
2. THE Android_App SHALL khai báo một FileProvider cấp quyền đọc file APK đã tải.
3. IF app thiếu quyền cài gói khi có yêu cầu cài đặt, THEN THE APK_Installer SHALL đưa người dùng tới màn hình cài đặt "cài ứng dụng không rõ nguồn gốc" của Android cho app.
4. WHEN APK_Installer khởi chạy intent cài đặt, THE APK_Installer SHALL cấp quyền đọc tạm thời trên URI của file APK cho trình cài đặt.

### Yêu cầu 6: Các trạng thái cập nhật và xử lý lỗi

**User Story:** Là người dùng, tôi muốn có phản hồi rõ ràng cho mọi kết quả cập nhật, để tôi hiểu app
đang làm gì và cần làm gì tiếp theo.

#### Tiêu chí chấp nhận

1. WHILE thiết bị không có kết nối mạng và người dùng kích hoạt "Kiểm tra", THE Update_System SHALL hiển thị thông báo tiếng Việt "Không có kết nối mạng" và SHALL NOT báo là có bản cập nhật.
2. IF nguồn phát hành trả về phản hồi lỗi trong lúc kiểm tra, THEN THE Update_System SHALL hiển thị thông báo lỗi tiếng Việt và giữ nguyên trạng thái Installed_Version.
3. IF một bản tải cập nhật thất bại trước khi hoàn tất, THEN THE Update_System SHALL hiển thị thông báo lỗi tiếng Việt và bật lại hành động cập nhật để thử lại.
4. IF một artifact đã tải không qua được kiểm tra toàn vẹn, THEN THE Update_System SHALL loại bỏ artifact đó, hiển thị thông báo lỗi toàn vẹn bằng tiếng Việt, tự động thử tải lại tối đa MỘT lần, và nếu vẫn thất bại thì dừng lại và cung cấp nút thử lại thủ công; THE Update_System SHALL NOT khởi chạy trình cài đặt trong mọi trường hợp thất bại.
5. WHEN bất kỳ lần kiểm tra hay tải cập nhật nào hoàn tất, THE Update_System SHALL ghi lại kết quả, phiên bản, và mốc thời gian vào nhật ký cập nhật, lưu giữ 10 mục gần nhất.
6. WHEN thông báo lỗi từ nguồn phát hành chứa token dạng thông tin xác thực hoặc response header, THE Update_System SHALL thay thông báo đó bằng một thông báo tiếng Việt chung chung trước khi hiển thị.

### Yêu cầu 7: Kiểm tra nền tuỳ chọn lúc khởi động

**User Story:** Là người dùng, tôi muốn app tự kiểm tra cập nhật, để tôi biết về phiên bản mới mà không
phải nhớ tự kiểm tra.

#### Tiêu chí chấp nhận

1. THE Update_System SHALL cung cấp một cài đặt Background_Check mặc định bật.
2. WHERE cài đặt Background_Check bật, WHEN app khởi động xong, THE Update_System SHALL thực hiện một lần kiểm tra cập nhật không chặn.
3. WHILE một Background_Check chạy, THE Update_System SHALL NOT chặn UI app hoặc làm chậm trình tự khởi động.
4. WHERE cài đặt Background_Check bật, THE Update_System SHALL thực hiện tối đa một lần kiểm tra tự động trong mỗi khoảng 24 giờ.
5. WHERE cài đặt Background_Check tắt, THE Update_System SHALL chỉ kiểm tra cập nhật khi người dùng kích hoạt "Kiểm tra".
6. WHEN một Background_Check tìm thấy bản cập nhật khả dụng, THE Update_UI SHALL hiển thị một hộp thoại nổi (dialog) ngay khi mở app để thông báo có bản mới, kèm hành động cập nhật và tùy chọn để bỏ qua.
7. WHEN một Background_Check phát hiện bản mới mà khoảng cách giữa Installed_Version và Latest_Version là 3 phiên bản trở xuống, THE Update_System SHALL hiển thị một toast/thông báo nhẹ (không chặn) về bản mới.
8. WHEN một Background_Check phát hiện bản mới mà khoảng cách giữa Installed_Version và Latest_Version lớn hơn 3 phiên bản, THE Update_System SHALL hiển thị một hộp thoại nổi ngay khi mở app để khuyến nghị cập nhật.
9. WHEN Update_System xác định khoảng cách phiên bản, THE Version_Comparator SHALL cung cấp số phiên bản chênh lệch (dựa trên version code với Android và trên đoạn số phiên bản với desktop) để quyết định giữa toast và hộp thoại nổi.

### Yêu cầu 8: Quy trình phát hành (Publish_Workflow)

**User Story:** Là người bảo trì, tôi muốn artifact đã build và metadata phát hành được tải lên
repository phát hành công khai một cách tự động, để việc ra bản cập nhật lặp lại được và ít tốn công.

#### Tiêu chí chấp nhận

1. WHEN một bản phát hành desktop được publish, THE Publish_Workflow SHALL tải trình cài đặt `.exe` và file `latest.yml` được sinh ra lên nguồn phát hành desktop.
2. WHEN một bản phát hành Android được publish, THE Publish_Workflow SHALL tải artifact APK lên và cập nhật Release_Manifest trong Releases_Repository.
3. WHEN Publish_Workflow tải một APK, THE Publish_Workflow SHALL tính APK_Checksum và kích thước file APK rồi ghi vào Release_Manifest.
4. WHEN Publish_Workflow ghi Release_Manifest, THE Publish_Workflow SHALL đặt Latest_Version, version code, release notes, URL tải APK, và Min_Supported_Version.
5. IF một artifact build cần thiết bị thiếu khi Publish_Workflow chạy, THEN THE Publish_Workflow SHALL dừng lại mà không sửa Release_Manifest và báo cáo artifact bị thiếu.

### Yêu cầu 9: Bảo mật và tin cậy

**User Story:** Là người dùng quan tâm bảo mật, tôi muốn bản cập nhật được phân phối mà không lộ secret
và được xác minh với nguồn tin cậy, để việc cài cập nhật không đặt dữ liệu của tôi vào rủi ro.

#### Tiêu chí chấp nhận

1. THE app phân phối SHALL NOT chứa bất kỳ GitHub token, API key, hay secret nào dùng cho việc lấy bản cập nhật.
2. THE Releases_Repository SHALL chỉ chứa artifact phát hành và metadata phát hành, và SHALL NOT chứa mã nguồn hay thông tin xác thực.
3. WHEN Mobile_Updater lấy Release_Manifest hoặc tải APK, THE Mobile_Updater SHALL dùng HTTPS chỉ từ origin Releases_Repository tin cậy (`raw.githubusercontent.com` và miền tải asset của GitHub).
4. WHEN một bản tải APK hoàn tất, THE Mobile_Updater SHALL xác minh kích thước file và APK_Checksum so với Release_Manifest trước khi mời cài đặt.
5. WHEN người dùng cài đè bản cập nhật Android, THE Update_System SHALL dựa vào cơ chế kiểm tra chữ ký ký (signing key) sẵn có của Android để từ chối mọi APK được ký bằng khoá khác, kết hợp với xác minh APK_Checksum, làm lớp chống APK giả mạo.
6. THE Update_System SHALL giữ nguyên hành vi Firestore security rules và mã hoá client-side AES-256/PBKDF2 hiện có.
7. WHERE Installed_Version thấp hơn Min_Supported_Version, THE Update_System SHALL hiển thị một cảnh báo nổi bật khuyến nghị cập nhật ngay, NHƯNG SHALL vẫn cho phép người dùng bỏ qua và tiếp tục sử dụng app.

### Yêu cầu 10: Bản địa hoá và suy giảm nhẹ nhàng theo nền tảng

**User Story:** Là người dùng nói tiếng Việt, tôi muốn mọi thông điệp cập nhật đều bằng tiếng Việt, và
tôi muốn app hành xử hợp lý trên các nền tảng không có tự cập nhật trong app, để trải nghiệm nhất quán.

#### Tiêu chí chấp nhận

1. THE Update_UI SHALL trình bày mọi nhãn, trạng thái, và thông báo liên quan cập nhật bằng tiếng Việt.
2. WHERE app chạy trên nền tảng không hỗ trợ tự cập nhật trong app, THE Update_System SHALL vô hiệu hoá các hành động cập nhật mà không phát sinh lỗi.
3. WHEN Platform_Detector không xác định được đường dẫn cập nhật được hỗ trợ, THE Update_UI SHALL hiển thị phiên bản hiện tại mà không có hành động cập nhật.
4. WHERE app chạy trên web (trình duyệt thường), THE Update_UI SHALL hiển thị thông báo tiếng Việt "Không hỗ trợ tự cập nhật trên nền tảng này" kèm một liên kết tải thủ công tới trang phát hành.
