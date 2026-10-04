# Yêu cầu và nghiệm thu Backend — MVP đặt chỗ

Tài liệu này giao **kết quả cần đạt** cho người phụ trách backend. Người thực hiện tự thiết kế flow, đặc tả API, trạng thái và cách tổ chức mã nguồn. Tài liệu không quy định sẵn endpoint, bảng dữ liệu, thư viện hoặc thuật toán triển khai.

## 1. Ranh giới công việc

Backend phục vụ luồng người dùng đặt chỗ cho chuyến bay nội địa Việt Nam:

```text
Đăng ký/đăng nhập → Tìm chuyến → Giữ số lượng chỗ trong 10 phút
→ Nhập hành khách → Thanh toán mô phỏng → Xem mã đặt chỗ
```

**Trong MVP:** tài khoản người dùng, tra cứu chuyến bay, giữ chỗ, tạo booking, thanh toán mô phỏng và tra cứu booking cá nhân.

**Chưa giao trong MVP:** API quản trị, tích hợp SerpApi, cổng thanh toán thật, tài khoản hãng bay, chọn số ghế cụ thể, check-in, xuất vé thật, đổi/hoàn vé và chuyến quốc tế. Chuyến bay và số lượng chỗ dùng dữ liệu nội bộ do nhóm dữ liệu chuẩn bị; người làm backend phối hợp để thống nhất dữ liệu cần đọc/ghi, không tự mở rộng sang luồng import.

Mã đặt chỗ là mã của **hệ thống demo**, không phải xác nhận của hãng bay. Thanh toán chỉ có kết quả mô phỏng thành công/thất bại; không thu thập hoặc xử lý thông tin thẻ thật.

## 2. Tài liệu người làm backend tự chuẩn bị

Trước khi triển khai từng luồng, người phụ trách tự nộp bản ngắn gọn để cả nhóm thống nhất:

1. **Sơ đồ flow hoặc sequence:** các bước từ request của người dùng đến kết quả, gồm nhánh thành công, thất bại và hết hạn. Chọn cách vẽ phù hợp; không cần vẽ mọi hàm nội bộ.
2. **Đặc tả API:** mục đích từng thao tác, dữ liệu vào/ra, yêu cầu đăng nhập và các lỗi mà frontend cần hiển thị. Người thực hiện tự đề xuất tên endpoint.
3. **Trạng thái booking và thanh toán:** trạng thái nào có thể chuyển sang trạng thái nào; cách xử lý giữ chỗ 10 phút, thanh toán lặp và hết chỗ.
4. **Các trường hợp kiểm thử:** tối thiểu bao phủ các tiêu chí nghiệm thu ở mục 3 và luồng xuyên suốt ở mục 5.

Tài liệu phải đủ để frontend và thành viên phụ trách dữ liệu hiểu cách tích hợp. Tránh thêm thiết kế cho admin, hãng bay, vé thật hoặc những tính năng ngoài mục 1.

## 3. Thứ tự ưu tiên và tiêu chí nghiệm thu

### P0.1 — Tài khoản người dùng

**Yêu cầu:** người dùng có thể đăng ký, đăng nhập và sử dụng các thao tác cần tài khoản. Mỗi người chỉ được xem booking của mình.

**Nghiệm thu:**

- Không tạo hai tài khoản với cùng email; dữ liệu đăng nhập không được lưu dưới dạng mật khẩu rõ.
- Đăng nhập sai trả lỗi rõ ràng; thao tác cần đăng nhập từ chối người chưa đăng nhập.
- Người dùng A không lấy được booking của người dùng B bằng cách đổi ID trong request.

### P0.2 — Tìm và xem chuyến bay

**Yêu cầu:** cung cấp chuyến bay nội địa theo điểm đi, điểm đến, ngày đi và số hành khách; xem được chi tiết chuyến để quyết định đặt chỗ.

**Nghiệm thu:**

- Tiêu chí không hợp lệ được báo rõ, ví dụ điểm đi trùng điểm đến, ngày đã qua hoặc số hành khách không hợp lệ.
- Kết quả chỉ gồm chuyến phù hợp và còn đủ chỗ theo dữ liệu nội bộ; không có kết quả thì trả danh sách rỗng hợp lệ.
- Dữ liệu chi tiết thống nhất với chuyến được chọn ở kết quả tìm kiếm.

### P0.3 — Giữ chỗ 10 phút và thông tin hành khách

**Yêu cầu:** người dùng chọn một chuyến và số lượng hành khách để giữ đúng số lượng chỗ trong **10 phút theo thời gian máy chủ**. Người dùng nhập thông tin liên hệ và thông tin từng hành khách trước khi thanh toán mô phỏng.

**Nghiệm thu:**

- Kết quả giữ chỗ cho biết thời điểm hết hạn để frontend hiển thị bộ đếm.
- Hai yêu cầu đồng thời không thể giữ vượt số chỗ còn lại; yêu cầu đến sau nhận lỗi hết chỗ.
- Giữ chỗ hết hạn được giải phóng; không thể tiếp tục thanh toán một giữ chỗ đã hết hạn.
- Số hành khách được lưu khớp với số chỗ giữ; thiếu thông tin bắt buộc được báo lỗi.
- Giá dùng cho booking được xác định ở backend và lưu tại thời điểm đặt; giá gửi từ trình duyệt không thể tự thay đổi tổng tiền.

### P0.4 — Thanh toán mô phỏng và xác nhận booking

**Yêu cầu:** cung cấp cách chủ động mô phỏng **thành công** hoặc **thất bại** để kiểm tra hai nhánh giao diện. Chỉ nhánh thành công khi giữ chỗ còn hiệu lực mới xác nhận booking và tạo/hiển thị mã đặt chỗ demo.

**Nghiệm thu:**

- Thanh toán thành công đưa booking sang trạng thái xác nhận; thanh toán thất bại giữ trạng thái phù hợp và không tạo xác nhận giả.
- Gọi lại cùng một thao tác thanh toán không trừ thêm chỗ, không ghi nhận hai lần và không tạo hai booking.
- Thanh toán đến sau khi giữ chỗ hết hạn bị từ chối; chỗ đã giữ được trả lại theo quy tắc hết hạn.
- Không có tích hợp cổng thanh toán hoặc dữ liệu thẻ thật trong luồng này.

### P0.5 — Đặt chỗ của tôi

**Yêu cầu:** người dùng xem danh sách và chi tiết booking của chính mình, gồm mã đặt chỗ demo, chuyến bay, hành khách, **số lượng chỗ**, tổng tiền đã chốt và trạng thái.

**Nghiệm thu:**

- Booking vẫn truy xuất được sau khi người dùng đăng xuất/đăng nhập lại.
- Trạng thái hiển thị khớp với kết quả giữ chỗ và thanh toán mô phỏng, kể cả booking hết hạn hoặc thanh toán thất bại.
- Không trả số ghế cụ thể hoặc thông tin check-in vì chưa có các luồng đó.

### P1 — Email xác nhận

**Yêu cầu:** gửi email thông báo cho booking đã được xác nhận. Làm sau khi toàn bộ P0 chạy ổn định.

**Nghiệm thu:**

- Chỉ booking được xác nhận mới phát sinh email xác nhận; cùng một booking không gửi lặp do thao tác thanh toán được gọi lại.
- Lỗi gửi email được ghi nhận nhưng không biến booking đã xác nhận thành thất bại.
- Nội dung email dùng mã đặt chỗ demo và không ngụ ý đó là vé do hãng bay phát hành.

## 4. Quy tắc giữ phạm vi

- Người làm backend tự quyết định cách triển khai, nhưng phải chứng minh được các tiêu chí nghiệm thu bằng request/response hoặc bài kiểm thử có thể chạy lại.
- Chỉ xử lý **số lượng chỗ**, không xây sơ đồ ghế hay gán mã ghế như `12A`.
- Không bổ sung API admin vào MVP. Nếu phát hiện nhu cầu quản trị dữ liệu để kiểm thử, trao đổi với người phụ trách dữ liệu về seed hoặc dữ liệu mẫu thay vì tự mở rộng dashboard/quyền admin.
- Không gọi SerpApi khi người dùng tìm chuyến. Phần nhập/cập nhật dữ liệu nguồn thuộc kế hoạch riêng.
- Không triển khai thanh toán sandbox hay cổng thật; hai kết quả mô phỏng phải dễ tái hiện để frontend tích hợp và nhóm nghiệm thu.

## 5. Kịch bản nghiệm thu xuyên suốt

Một bản demo backend được coi là hoàn thành P0 khi nhóm có thể thực hiện liên tiếp:

1. Tạo tài khoản và đăng nhập.
2. Tìm chuyến nội địa có đủ chỗ và xem chi tiết.
3. Giữ nhiều chỗ trong 10 phút, nhập đủ hành khách, xem tổng tiền do backend tính.
4. Mô phỏng thanh toán thành công, nhận mã đặt chỗ demo và xem booking trong tài khoản sau khi đăng nhập lại.
5. Lặp lại với thanh toán thất bại, giữ chỗ hết hạn và hai người cùng tranh chỗ cuối cùng; kết quả không làm sai số chỗ và trạng thái.
6. Thử truy cập booking của người khác; request bị từ chối.

Chỉ bắt đầu P1 sau khi các kịch bản P0 trên đạt yêu cầu.
