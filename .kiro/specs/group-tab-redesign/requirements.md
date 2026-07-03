# Requirements Document

## Introduction

Tính năng này re-design lại toàn bộ tab Nhóm (Groups) trong ứng dụng desktop Ting! (Electron, vanilla JS render bằng `innerHTML`). Mục tiêu chính là làm cho trải nghiệm mượt hơn: không giật/nháy khi dữ liệu đồng bộ realtime từ Firestore, khi chuyển tab con, và khi mở khoá nhóm; đồng thời làm gọn và nhất quán giao diện của các tab con (Bảng danh mục, Tài khoản, Thành viên) và cải thiện trải nghiệm các thao tác chính (mời thành viên, phân quyền, thêm/sửa/xoá danh mục, chuyển danh mục, sắp xếp thứ tự, mở khoá nhóm, duyệt yêu cầu chỉnh sửa).

Tính năng KHÔNG thay đổi mô hình bảo mật zero-knowledge (mã hoá bằng mật khẩu chung của nhóm) và KHÔNG thay đổi mô hình phân quyền hiện có (chủ nhóm / quản lý tài khoản / thành viên). Đây là bản re-design tập trung vào lớp giao diện (`js/desktop-ui.js`), tương tác (`js/desktop-app.js`), điều phối cập nhật (`js/groups.js`), và định kiểu (`css/components.css`, `css/desktop.css`).

Phạm vi tập trung vào phía render và trải nghiệm người dùng. Các thao tác dữ liệu (CRUD Firestore, mã hoá/giải mã, đồng bộ realtime) được giữ nguyên về mặt logic nghiệp vụ; chỉ điều chỉnh cách kích hoạt render và cách hiển thị kết quả.

## Glossary

- **Ting_Desktop**: Ứng dụng desktop Ting! chạy trên Electron, render giao diện bằng cách gán `innerHTML`.
- **Group_Tab**: Toàn bộ khu vực giao diện Nhóm, gồm màn hình danh sách nhóm và màn hình chi tiết nhóm.
- **Group_List_View**: Màn hình danh sách nhóm (`renderGroupList`), hiển thị các thẻ nhóm và các lời mời.
- **Group_Detail_View**: Màn hình chi tiết một nhóm (`renderGroupDetail`), chứa phần đầu (header) và ba tab con.
- **Board_Subtab**: Tab con "Bảng danh mục" của Group_Detail_View (`renderGroupBoard`), hiển thị tài khoản chia sẻ nhóm theo từng danh mục.
- **Accounts_Subtab**: Tab con "Tài khoản" của Group_Detail_View (`renderGroupAccountsTab`), hiển thị danh sách thẻ tài khoản chia sẻ chi tiết.
- **Members_Subtab**: Tab con "Thành viên" của Group_Detail_View (`renderGroupMembers`), hiển thị danh sách thành viên và phân quyền.
- **Group_Renderer**: Lớp render giao diện nhóm trong `js/desktop-ui.js`.
- **Group_Sync_Coordinator**: Lớp điều phối cập nhật realtime và kích hoạt render trong `js/groups.js` (gồm `notifyGroupsChanged`, `runGroupsChangedRender`).
- **Snapshot_Event**: Một lần callback từ Firestore `onSnapshot` (bật `includeMetadataChanges`) báo dữ liệu nhóm hoặc tài khoản chia sẻ thay đổi.
- **Render_Burst**: Một chuỗi nhiều Snapshot_Event và cập nhật `updatedAt` xảy ra liên tiếp trong khoảng thời gian ngắn cho cùng một hành động của người dùng.
- **Quiet_Render**: Lần render lại Group_Detail_View do dữ liệu thay đổi, KHÔNG phát lại hiệu ứng xuất hiện (entrance animation) để tránh nháy.
- **Entrance_Animation**: Hiệu ứng xuất hiện lần đầu của các phần tử (ví dụ `anim-fade-in-up`, `anim-stagger`).
- **Category_Dropdown**: Menu tuỳ biến để chọn danh mục cho một tài khoản chia sẻ (`cat-select`, `cat-menu`), thay cho `<select>` native.
- **Shared_Account**: Một tài khoản chia sẻ trong nhóm, có phần dữ liệu nhạy cảm được mã hoá zero-knowledge.
- **Account_Category**: Danh mục nhóm (`accountCategories`) dùng để phân loại Shared_Account.
- **Edit_Request**: Yêu cầu chỉnh sửa tài khoản chia sẻ đang chờ duyệt (`sharedEditRequests`).
- **Group_Owner**: Chủ nhóm (`ownerUid`), có toàn quyền quản lý nhóm.
- **Account_Manager**: Thành viên có quyền quản lý tài khoản (`accountManagerEmails`).
- **Group_Member**: Thành viên thường của nhóm.
- **Unlock_State**: Trạng thái đã mở khoá nhóm bằng mật khẩu chung để xem dữ liệu nhạy cảm (`groupUnlocked`).
- **Demo_Mode**: Chế độ demo của ứng dụng (`isDemo`), dùng dữ liệu giả lập cục bộ.
- **Active_Subtab**: Tab con đang được chọn trong Group_Detail_View (`currentGroupTab`).

## Requirements

### Requirement 1: Gộp cụm cập nhật realtime thành một lần render

**User Story:** Là người dùng nhóm, tôi muốn giao diện chi tiết nhóm chỉ vẽ lại một lần cho mỗi hành động của tôi, để không bị giật/nháy nhiều lần khi dữ liệu đồng bộ.

#### Acceptance Criteria

1. WHEN một Render_Burst gồm nhiều Snapshot_Event xảy ra trong vòng 50ms, THE Group_Sync_Coordinator SHALL gộp thành đúng một lần gọi render Group_Detail_View.
2. WHILE Group_Detail_View đang hiển thị, THE Group_Sync_Coordinator SHALL kích hoạt lại render ở chế độ Quiet_Render cho các cập nhật do dữ liệu thay đổi.
3. IF một Snapshot_Event đến trong khi một lần render đang chờ trong hàng đợi gộp (debounce), THEN THE Group_Sync_Coordinator SHALL đặt lại bộ đếm gộp và giữ lại đúng một lần render sau cùng.
4. WHEN Snapshot_Event báo thay đổi cho một nhóm khác với nhóm đang mở, THE Group_Sync_Coordinator SHALL bỏ qua việc render lại Group_Detail_View của nhóm đang mở.

### Requirement 2: Không phát lại hiệu ứng khi refresh dữ liệu

**User Story:** Là người dùng nhóm, tôi muốn nội dung không bị "fade-in" lại mỗi khi có cập nhật, để trải nghiệm liền mạch thay vì chớp giật.

#### Acceptance Criteria

1. WHEN Group_Detail_View được render lại ở chế độ Quiet_Render, THE Group_Renderer SHALL vô hiệu hoá Entrance_Animation cho toàn bộ nội dung của lần render đó.
2. WHEN người dùng mở Group_Detail_View lần đầu qua thao tác điều hướng, THE Group_Renderer SHALL phát Entrance_Animation một lần.
3. WHEN người dùng chuyển đổi Active_Subtab, THE Group_Renderer SHALL phát Entrance_Animation của tab con vừa chọn đúng một lần.
4. THE Group_Renderer SHALL giới hạn dấu hiệu Quiet_Render trong phạm vi nội dung của Group_Detail_View sao cho các trang khác không bị ảnh hưởng.

### Requirement 3: Chuyển tab con mượt và giữ đúng trạng thái

**User Story:** Là người dùng nhóm, tôi muốn chuyển giữa ba tab con nhanh và không mất trạng thái, để thao tác liền mạch.

#### Acceptance Criteria

1. THE Group_Detail_View SHALL cung cấp ba tab con: Board_Subtab, Accounts_Subtab, và Members_Subtab.
2. WHEN người dùng chọn một tab con, THE Group_Renderer SHALL hiển thị nội dung của tab con đó và đánh dấu tab đó là Active_Subtab.
3. WHEN Group_Detail_View được render lại do dữ liệu thay đổi, THE Group_Renderer SHALL giữ nguyên Active_Subtab đang chọn trước đó.
4. WHEN người dùng mở một nhóm mà chưa từng chọn tab con, THE Group_Renderer SHALL hiển thị Board_Subtab làm tab mặc định.
5. WHEN người dùng chọn tab con đang là Active_Subtab, THE Group_Renderer SHALL giữ nguyên tab đó và không phát lại Entrance_Animation.

### Requirement 4: Mở khoá nhóm mượt, giữ nguyên zero-knowledge

**User Story:** Là thành viên nhóm, tôi muốn mở khoá nhóm và thấy nội dung hiện ra mượt, để đọc dữ liệu chia sẻ mà không bị giật.

#### Acceptance Criteria

1. WHILE nhóm ở trạng thái chưa mở khoá, THE Group_Renderer SHALL ẩn dữ liệu nhạy cảm và hiển thị nút mở khoá cho mỗi Shared_Account.
2. WHEN người dùng mở khoá nhóm thành công bằng mật khẩu chung, THE Group_Renderer SHALL cập nhật Unlock_State và hiển thị dữ liệu đã giải mã mà không phát lại Entrance_Animation cho toàn bộ danh sách.
3. WHILE một Shared_Account đang được giải mã để hiển thị, THE Group_Renderer SHALL hiển thị chỉ báo "Đang giải mã" cho tài khoản đó.
4. IF việc giải mã một Shared_Account thất bại, THEN THE Group_Renderer SHALL giữ tài khoản đó ở trạng thái ẩn dữ liệu nhạy cảm.
5. THE Ting_Desktop SHALL giữ nguyên cơ chế mã hoá/giải mã zero-knowledge hiện có, không lưu mật khẩu chung của nhóm ở dạng chưa mã hoá ngoài phạm vi Unlock_State trong bộ nhớ phiên.

### Requirement 5: Chọn danh mục qua dropdown tuỳ biến đồng bộ theme

**User Story:** Là người quản lý tài khoản, tôi muốn đổi danh mục của một tài khoản qua một dropdown đẹp và đúng theme, để thao tác nhanh và nhất quán về giao diện.

#### Acceptance Criteria

1. WHERE người dùng có quyền quản lý một Shared_Account, THE Group_Renderer SHALL hiển thị Category_Dropdown cho tài khoản đó.
2. WHERE người dùng không có quyền quản lý một Shared_Account, THE Group_Renderer SHALL ẩn Category_Dropdown của tài khoản đó.
3. WHEN người dùng mở Category_Dropdown, THE Group_Renderer SHALL hiển thị mọi Account_Category hiện có cùng lựa chọn "Chưa phân loại" và đánh dấu lựa chọn đang áp dụng.
4. WHEN người dùng chọn một danh mục khác trong Category_Dropdown, THE Ting_Desktop SHALL gán tài khoản vào danh mục đã chọn và cập nhật giao diện đúng một lần theo Requirement 1.
5. WHEN người dùng bấm ra ngoài Category_Dropdown đang mở, THE Group_Renderer SHALL đóng menu đó.
6. THE Group_Renderer SHALL áp dụng biến theme hiện hành cho Category_Dropdown để màu nền, viền và chữ khớp với phần còn lại của giao diện.

### Requirement 6: Quản lý danh mục nhóm ở Board_Subtab

**User Story:** Là chủ nhóm, tôi muốn thêm, sửa, xoá và sắp xếp danh mục, để tổ chức tài khoản chia sẻ theo ý mình.

#### Acceptance Criteria

1. WHERE người dùng là Group_Owner, THE Board_Subtab SHALL hiển thị các nút thêm danh mục, sửa danh mục, xoá danh mục và di chuyển thứ tự danh mục.
2. WHERE người dùng không phải Group_Owner, THE Board_Subtab SHALL ẩn các nút chỉnh sửa danh mục.
3. WHEN người dùng thêm hoặc sửa một Account_Category hợp lệ, THE Ting_Desktop SHALL lưu danh mục và cập nhật Board_Subtab đúng một lần theo Requirement 1.
4. WHEN người dùng xoá một Account_Category, THE Ting_Desktop SHALL chuyển các Shared_Account thuộc danh mục đó về nhóm "Chưa phân loại".
5. WHEN người dùng di chuyển một Account_Category lên hoặc xuống, THE Ting_Desktop SHALL cập nhật thứ tự (`order`) của danh mục và hiển thị lại theo thứ tự mới.
6. THE Board_Subtab SHALL luôn hiển thị mục "Chưa phân loại" chứa các Shared_Account không thuộc danh mục nào ở cuối danh sách danh mục.
7. IF danh sách Account_Category rỗng, THEN THE Board_Subtab SHALL hiển thị toàn bộ Shared_Account trong mục "Chưa phân loại".

### Requirement 7: Sắp xếp thứ tự tài khoản trong danh mục

**User Story:** Là người quản lý tài khoản, tôi muốn sắp xếp thứ tự tài khoản trong một danh mục, để đưa tài khoản quan trọng lên trên.

#### Acceptance Criteria

1. WHERE người dùng có quyền quản lý một Shared_Account, THE Board_Subtab SHALL hiển thị nút đưa tài khoản lên và đưa tài khoản xuống trong danh mục.
2. WHEN một Shared_Account đang ở vị trí đầu của danh mục, THE Board_Subtab SHALL vô hiệu hoá nút đưa lên của tài khoản đó.
3. WHEN một Shared_Account đang ở vị trí cuối của danh mục, THE Board_Subtab SHALL vô hiệu hoá nút đưa xuống của tài khoản đó.
4. WHEN người dùng di chuyển một Shared_Account lên hoặc xuống, THE Ting_Desktop SHALL cập nhật thứ tự và hiển thị lại danh mục theo thứ tự mới đúng một lần theo Requirement 1.

### Requirement 8: Mời và huỷ lời mời thành viên

**User Story:** Là chủ nhóm, tôi muốn mời thành viên qua email và huỷ lời mời đang chờ, để kiểm soát ai được vào nhóm.

#### Acceptance Criteria

1. WHERE người dùng là Group_Owner, THE Members_Subtab SHALL hiển thị ô nhập email và nút mời thành viên.
2. WHEN người dùng gửi lời mời với một email đúng định dạng, THE Ting_Desktop SHALL thêm email đó vào danh sách đang mời và hiển thị trạng thái "Đang mời".
3. IF người dùng gửi lời mời với một email sai định dạng, THEN THE Ting_Desktop SHALL từ chối và hiển thị thông báo lỗi.
4. WHEN người dùng huỷ một lời mời đang chờ, THE Ting_Desktop SHALL loại email đó khỏi danh sách đang mời và cập nhật Members_Subtab.
5. WHEN người được mời đã có trong danh sách thành viên hoặc đã được mời, THE Ting_Desktop SHALL từ chối lời mời trùng và hiển thị thông báo tương ứng.

### Requirement 9: Phân quyền quản lý tài khoản cho thành viên

**User Story:** Là chủ nhóm, tôi muốn cấp hoặc thu hồi quyền quản lý tài khoản cho thành viên, để giao bớt việc quản lý.

#### Acceptance Criteria

1. WHERE người dùng là Group_Owner, THE Members_Subtab SHALL hiển thị công tắc cấp quyền Account_Manager cho từng Group_Member không phải chủ nhóm.
2. WHEN Group_Owner bật công tắc quản lý cho một thành viên, THE Ting_Desktop SHALL thêm email đó vào danh sách Account_Manager và cập nhật nhãn vai trò thành "Quản lý TK".
3. WHEN Group_Owner tắt công tắc quản lý cho một thành viên, THE Ting_Desktop SHALL loại email đó khỏi danh sách Account_Manager và cập nhật nhãn vai trò thành "Thành viên".
4. THE Members_Subtab SHALL hiển thị nhãn vai trò "Chủ nhóm" cho Group_Owner, "Quản lý TK" cho Account_Manager, và "Thành viên" cho các thành viên còn lại.
5. WHERE người dùng không phải Group_Owner, THE Members_Subtab SHALL ẩn công tắc phân quyền và nút xoá thành viên.

### Requirement 10: Duyệt yêu cầu chỉnh sửa tài khoản chia sẻ

**User Story:** Là người duyệt (chủ nhóm hoặc người quản lý tài khoản), tôi muốn xem và xử lý các yêu cầu chỉnh sửa đang chờ, để kiểm soát thay đổi trên tài khoản chia sẻ.

#### Acceptance Criteria

1. WHERE tồn tại Edit_Request ở trạng thái chờ mà người dùng hiện tại có quyền xem, THE Accounts_Subtab SHALL hiển thị danh sách các Edit_Request đó cùng số lượng.
2. WHERE người dùng có quyền duyệt một Edit_Request, THE Accounts_Subtab SHALL hiển thị nút duyệt và nút từ chối cho yêu cầu đó.
3. WHERE người dùng không có quyền duyệt một Edit_Request, THE Accounts_Subtab SHALL hiển thị trạng thái "Chờ duyệt" thay cho các nút hành động.
4. WHEN người dùng duyệt một Edit_Request, THE Ting_Desktop SHALL áp dụng thay đổi được đề xuất lên Shared_Account và cập nhật giao diện đúng một lần theo Requirement 1.
5. WHEN người dùng từ chối một Edit_Request, THE Ting_Desktop SHALL đánh dấu yêu cầu đó là đã từ chối và loại khỏi danh sách chờ.
6. THE Group_Renderer SHALL hiển thị số lượng Edit_Request đang chờ trên thẻ Shared_Account tương ứng.

### Requirement 11: Giao diện các tab con gọn và nhất quán

**User Story:** Là người dùng nhóm, tôi muốn ba tab con có bố cục và phong cách nhất quán, để dễ nhìn và dễ dùng.

#### Acceptance Criteria

1. THE Group_Detail_View SHALL hiển thị phần header gồm tên nhóm, nhãn vai trò của người dùng, số thành viên và số tài khoản chia sẻ.
2. THE Group_Renderer SHALL dùng chung một hệ thống thành phần giao diện (thẻ, nhãn, huy hiệu, nút) cho cả ba tab con để bảo đảm phong cách nhất quán.
3. WHERE một danh sách trong tab con rỗng, THE Group_Renderer SHALL hiển thị trạng thái rỗng có tiêu đề mô tả thay cho danh sách trống.
4. THE Group_Renderer SHALL áp dụng biến theme hiện hành cho toàn bộ thành phần của Group_Tab để đồng bộ chế độ sáng/tối.
5. WHERE nội dung tab con vượt quá chiều cao vùng hiển thị, THE Group_Renderer SHALL cho phép cuộn nội dung mà giữ cố định phần header và thanh tab con.

### Requirement 12: Bảo toàn hành vi trong chế độ demo và khi offline

**User Story:** Là người dùng thử ứng dụng ở chế độ demo hoặc khi mất mạng, tôi muốn tab Nhóm vẫn hiển thị đúng, để trải nghiệm không bị gián đoạn.

#### Acceptance Criteria

1. WHILE ứng dụng ở Demo_Mode, THE Group_Renderer SHALL hiển thị Group_Tab dùng dữ liệu giả lập cục bộ với cùng bố cục như chế độ thường.
2. WHILE thiết bị offline, THE Group_Renderer SHALL hiển thị dữ liệu nhóm từ bộ nhớ đệm cục bộ đã có.
3. WHEN một thao tác thay đổi dữ liệu được thực hiện khi offline, THE Ting_Desktop SHALL đánh dấu mục liên quan ở trạng thái "Chờ đồng bộ".
4. WHEN kết nối được khôi phục và dữ liệu đồng bộ xong, THE Group_Sync_Coordinator SHALL cập nhật giao diện theo Requirement 1 và bỏ dấu "Chờ đồng bộ" cho các mục đã đồng bộ.
