# Phân hệ hãng bay — quản lý chuyến và bán vé

## Phân quyền

| Vai trò | Được làm | Không được làm |
| --- | --- | --- |
| `AIRLINE_FLIGHT_MANAGER` | Xem chuyến của hãng, tạo chuyến với số hiệu, tuyến và giờ đi/đến | Quy định số ghế bán ra, đặt giá, mở/ngừng bán, xem dữ liệu hãng khác |
| `AIRLINE_SALES_MANAGER` | Xem chuyến của hãng, quy định số ghế bán ra và giá gốc, mở/ngừng bán, xem hiệu quả chuyến | Tạo hoặc sửa lịch trình, sửa thanh toán, xem dữ liệu hãng khác |

Backend lấy `airlineId` từ phiên đăng nhập cho mọi API. Hãng bị khóa không thể tạo chuyến, đặt giá hoặc mở/ngừng bán. Chuyến bị admin tạm ẩn cần admin mở lại trước khi nhóm bán vé có thể công bố.

## Quy trình

1. Nhóm quản lý chuyến tạo chuyến nội bộ với số hiệu, sân bay đi/đến và giờ bay. Form tự tính thời gian bay dự kiến từ giờ khởi hành và giờ đến, kể cả chuyến qua ngày. Chuyến ở trạng thái `SCHEDULED` và `HIDDEN`, số ghế bán ra và giá gốc bằng 0, khách chưa thể đặt.
2. Nhóm bán vé đặt **số ghế được bán ra** và **giá gốc**. Số ghế không được thấp hơn số chỗ đã xác nhận hoặc đang giữ còn hạn. Tỷ lệ lấp đầy = chỗ trong booking `CONFIRMED` / số ghế được bán. Booking `PENDING` còn hạn chiếm chỗ nhưng chưa được tính là đã bán.
3. Nhóm bán vé xác nhận mở bán. Chỉ chuyến còn theo lịch, chưa khởi hành, thuộc hãng đang hoạt động, có số ghế và giá gốc hợp lệ mới được mở. Ngừng bán chặn booking mới; booking cũ vẫn giữ nguyên.
4. Khi khách tìm hoặc đặt, backend dùng công thức giá động **đã có** dựa trên giá gốc, tỷ lệ lấp đầy, thời gian còn đến chuyến và thời điểm khởi hành. Giá của booking được chốt lúc tạo booking. Không có bảng giá thủ công theo từng ngưỡng lấp đầy.
5. BI hiển thị tỷ lệ lấp đầy theo chỗ xác nhận và **doanh thu mô phỏng** từ các thanh toán thử `PAID` của chuyến. Đây không phải doanh thu thực của hãng hàng không.

## Giao diện

- `/airline/flights`: thẻ số chuyến, số chuyến đang bán/chưa bán; bảng số hiệu, tuyến, giờ đi, ghế bán ra, trạng thái; panel chi tiết; form tạo lịch chuyến cơ bản có thời gian bay tự tính.
- `/airline/awaiting-sale`: mục riêng trong menu trái **Chờ mở bán**, gom các chuyến `SCHEDULED`, `HIDDEN` và chưa khởi hành; có lọc và phân trang. Bấm **Thiết lập bán vé** để nhập ghế và giá gốc, sau đó xác nhận mở bán. Chuyến tạm ngừng bán cũng xuất hiện tại đây để có thể mở lại.
- `/airline/sales`: mục riêng **Quản lý bán vé** với danh sách chuyến, số ghế bán ra, giá gốc, trạng thái bán; panel sửa ghế/giá và xác nhận mở/ngừng bán. Trang này chỉ phục vụ thao tác quản lý.
- `/airline/dashboard`: mục riêng **Dashboard** có hai chế độ **Toàn hãng** và **Theo chuyến**. Bộ lọc riêng gồm khoảng ngày khởi hành (múi giờ Việt Nam), sân bay đi/đến, số hiệu chuyến và trạng thái. KPI tính trên toàn bộ chuyến phù hợp bộ lọc, không phụ thuộc phân trang. Người xem đổi chỉ số và nhóm ngày/tuần/tháng trong phiên xem, không lưu cấu hình. Toàn hãng có biểu đồ xu hướng theo ngày bay và so sánh tuyến. Theo chuyến có danh sách so sánh, chọn chuyến để xem KPI và diễn biến bán vé theo ngày thanh toán/phát hành vé. Dashboard chỉ đọc.
- Chỉ số Dashboard: **vé đã bán** là vé trạng thái `ISSUED` hoặc `USED`; **lượt đã thanh toán** là số booking riêng biệt có thanh toán `PAID`; **doanh thu mô phỏng** là tổng `Payment.amount` có trạng thái `PAID`; **tỷ lệ lấp đầy** là vé đã bán chia số ghế mở bán. Một booking có thể có nhiều vé.
- Cả hai danh sách có tìm kiếm, lọc sân bay đi/đến, ngày bay hoặc khoảng ngày, trạng thái chuyến và trạng thái bán; sắp xếp các cột chính và phân trang phía server. Số liệu BI phản ánh các chuyến phù hợp bộ lọc.
- Sau đăng nhập, mỗi vai trò vào đúng màn hình của mình. Vai trò kia bị chặn ở cả giao diện và API.

## Giới hạn nghiệp vụ cần thiết kế tiếp

- Sửa giờ/tuyến của chuyến đã có booking, hủy chuyến và xử lý hành khách cần quy trình riêng.
- Số ghế bán ra hiện là `Flight.capacity` trong inventory nội bộ. Chưa quản lý sức chứa vật lý tách riêng hoặc nhiều đợt tung vé.
- Dashboard đã có biểu đồ theo ngày và tuyến; xuất báo cáo chưa có.
- Giá thay đổi theo tỷ lệ lấp đầy khi booking được xác nhận. Nếu cần giữ giá giữa lúc khách xem và giữ chỗ, phải bổ sung cơ chế báo giá có thời hạn.
