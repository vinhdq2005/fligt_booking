# Flight Booking

Website tìm kiếm và đặt chỗ chuyến bay nội địa Việt Nam, được xây dựng như một dự án học tập cho nhóm 3 thành viên.

> **Trạng thái:** đã có schema Prisma cho dữ liệu tìm kiếm chuyến bay, script import SerpApi, API quản trị cục bộ và trang admin danh sách chuyến bay. Luồng tài khoản, booking, thanh toán và frontend người dùng vẫn đang được triển khai. Các mốc và chức năng bên dưới là định hướng MVP.

> **Phạm vi đặt chỗ:** booking và thanh toán trong phiên bản đầu là **mô phỏng trên dữ liệu của dự án**. Mã booking do website tạo không phải vé hoặc mã đặt chỗ được hãng bay xác nhận.

## Mục tiêu

Xây dựng một website động có luồng hoàn chỉnh từ tìm chuyến bay đến xem lại đặt chỗ, kèm trang quản trị để quản lý người dùng, chuyến bay và dữ liệu. Dự án tập trung vào các chuyến bay nội địa Việt Nam và ưu tiên hoàn thiện luồng cơ bản trước khi mở rộng.

## Cấu trúc thư mục làm việc chung

```text
.
├── client/       # Frontend, gồm trang và thành phần giao diện
├── server/       # Backend và phần dữ liệu
├── docs/         # Tài liệu dùng chung đã được nhóm chốt
├── .gitignore
├── package.json  # Khai báo workspace client/server
└── README.md
```

Xem `client/README.md` và `server/README.md` để biết cách chạy trang admin và API hiện có. Các script `dev:client`, `dev:server` và `build:client` trong `package.json` gốc đã dùng được.

## Phạm vi phiên bản đầu (MVP)

### Người dùng

- Đăng ký, đăng nhập, đăng xuất và cập nhật hồ sơ.
- Tìm chuyến bay một chiều theo sân bay đi, sân bay đến, ngày bay và số hành khách; lọc hoặc sắp xếp kết quả.
- Xem chi tiết chuyến bay, giá và số chỗ còn trong **hệ thống demo**.
- Nhập thông tin hành khách, giữ chỗ có thời hạn và tạo booking.
- Thanh toán giả lập hoặc qua môi trường sandbox; nhận email xác nhận khi booking thành công.
- Xem danh sách và chi tiết booking trong tài khoản, bao gồm trạng thái, hành khách, số lượng chỗ và mã booking. Nếu triển khai chọn ghế, hiển thị thêm số ghế cụ thể.

### Quản trị viên

- Xem tổng quan chuyến bay, booking và doanh thu demo.
- Quản lý tài khoản người dùng và phân quyền.
- Quản lý sân bay, hãng bay, tuyến bay, chuyến bay, giá và số chỗ của hệ thống.
- Tra cứu booking, thanh toán và xử lý hủy theo quy tắc của dự án.
- Nhập hoặc cập nhật dữ liệu tham khảo từ API ngoài, xem thời điểm cập nhật và lỗi đồng bộ.

### Ngoài phạm vi MVP

- Xuất vé máy bay thật, giữ ghế tại hãng bay hoặc xử lý thanh toán thật.
- Tài khoản riêng cho hãng bay để tự cập nhật chuyến bay.
- Hành trình khứ hồi, nhiều chặng, đổi vé và hoàn tiền tự động.

Các chức năng này chỉ được xem xét sau khi luồng MVP hoạt động ổn định.

## Nguồn dữ liệu chuyến bay

Dự kiến tham khảo [SerpApi Google Flights API](https://serpapi.com/google-flights-api) để lấy thông tin chuyến bay và giá. API này trả về **kết quả tìm kiếm và các lựa chọn đặt vé**, không cấp cho dự án quyền quản lý tồn ghế hoặc xác nhận vé với hãng bay. Vì vậy:

1. Admin nhập dữ liệu mẫu hoặc chủ động chạy tác vụ đồng bộ có giới hạn.
2. Backend chuẩn hóa dữ liệu cần dùng và lưu vào MySQL cùng nguồn, thời điểm lấy và thời điểm hết hạn.
3. Người dùng tìm kiếm trên dữ liệu của hệ thống; mỗi lượt tìm kiếm của người dùng không tự gọi SerpApi.
4. Giá và lịch bay lấy từ bên ngoài phải có nhãn **tham khảo** và thời điểm cập nhật. Admin quyết định chuyến nào được công bố trong hệ thống demo.
5. Số chỗ và trạng thái booking là dữ liệu **nội bộ** do website quản lý, không được trình bày như tình trạng ghế thực tế của hãng.

Trước khi công khai sản phẩm hoặc lưu và hiển thị dữ liệu API lâu dài, nhóm cần kiểm tra [điều khoản sử dụng SerpApi](https://serpapi.com/legal) và quyền sử dụng dữ liệu nguồn.

Để phát triển ổn định, nhóm nên bắt đầu bằng dữ liệu mẫu cho một số tuyến nội địa như HAN–SGN, HAN–DAD, SGN–DAD, SGN–CXR và SGN–PQC. Tích hợp SerpApi sau khi luồng booking nội bộ đã chạy được.

## Luồng nghiệp vụ chính

```text
Tìm chuyến → Xem chi tiết → Giữ chỗ (ví dụ: 10 phút)
          → Nhập thông tin hành khách → Thanh toán thử
          → Xác nhận booking → Gửi email → Xem trong tài khoản
```

- Khi giữ chỗ, backend kiểm tra chỗ còn và tạo booking `HELD` trong cùng một transaction MySQL. Hai yêu cầu đồng thời không được giữ quá số chỗ còn lại.
- Khi thanh toán thành công, booking chuyển sang `CONFIRMED`; khi thất bại hoặc quá hạn, booking chuyển sang `CANCELLED` hoặc `EXPIRED` và trả lại chỗ.
- Backend tự tính và lưu giá tại thời điểm tạo booking; không tin giá do trình duyệt gửi lên.
- Xử lý kết quả thanh toán theo cách không tạo booking hoặc ghi nhận thanh toán trùng khi callback được gửi lại.
- Email xác nhận được gửi sau khi booking thực sự chuyển sang `CONFIRMED`.

Trạng thái dự kiến:

| Đối tượng | Trạng thái |
| --- | --- |
| Booking | `HELD`, `CONFIRMED`, `CANCELLED`, `EXPIRED` |
| Thanh toán | `PENDING`, `SUCCESS`, `FAILED` |
| Chuyến bay | `DRAFT`, `PUBLISHED`, `CANCELLED` |

## Kiến trúc và công nghệ đề xuất

```text
React frontend (user + admin)
        ↓ HTTP API
Node.js backend ─────→ MySQL
        ├────────────→ Dịch vụ gửi email
        ├────────────→ Thanh toán mock/sandbox
        └────────────→ SerpApi (chỉ tác vụ import có kiểm soát)
```

| Thành phần | Đề xuất |
| --- | --- |
| Frontend | React, Vite, TypeScript |
| Backend | Node.js, Express, TypeScript |
| Database | MySQL, Prisma ORM |
| Xác thực | Phiên đăng nhập hoặc JWT theo quyết định của nhóm; mật khẩu được băm |
| Thanh toán | Mock hoặc sandbox cho MVP |
| Email | Nhà cung cấp email hoặc SMTP thử nghiệm |

React/Vite, Express và Prisma đã được cài cho phần admin/dữ liệu. Các thành phần còn lại trong bảng vẫn là định hướng triển khai.

### Các bảng dữ liệu dự kiến

`users`, `roles`, `airports`, `airlines`, `routes`, `flights`, `bookings`, `booking_passengers`, `payments`, `import_jobs`.

Nếu cần chọn **ghế cụ thể** như `12A`, bổ sung `flight_seats` và ràng buộc để một ghế không thuộc hai booking còn hiệu lực. Nếu MVP chỉ cần số lượng chỗ, quản lý tồn chỗ theo từng chuyến bay trước.

## Phân công nhóm 3 thành viên

| Vai trò | Trách nhiệm chính | Kết quả cần bàn giao |
| --- | --- | --- |
| Thành viên A — Frontend/UI | Thiết kế luồng, giao diện user và admin, responsive, tích hợp API | Wireframe, các trang chức năng và xử lý trạng thái tải/lỗi |
| Thành viên B — Backend/booking | API, đăng nhập, phân quyền, giữ chỗ, booking, thanh toán thử, email | API hoạt động và kiểm thử các trường hợp đặt chỗ đồng thời |
| Thành viên C — Database/dữ liệu | ERD, migration, dữ liệu mẫu, import SerpApi, quản lý dữ liệu và log | Schema MySQL, dữ liệu demo, tác vụ import có giới hạn |

Cả nhóm cùng chốt schema, hợp đồng API và trạng thái nghiệp vụ trước khi triển khai riêng. Mỗi tính năng hoàn thành khi chạy được từ giao diện qua backend đến database.


## Lộ trình dự kiến

| Giai đoạn | Mục tiêu |
| --- | --- |
| Tuần 1 | Chốt MVP, thiết kế giao diện, ERD, hợp đồng API và cách chạy dự án |
| Tuần 2 | Đăng ký/đăng nhập, dữ liệu chuyến bay mẫu, tìm kiếm và xem chi tiết |
| Tuần 3 | Giữ chỗ, nhập hành khách, tạo booking và xử lý hết hạn |
| Tuần 4 | Thanh toán mock/sandbox, email, trang booking của người dùng |
| Tuần 5 | Trang admin, quản lý dữ liệu và import SerpApi thủ công |
| Tuần 6 | Tích hợp, kiểm thử, sửa lỗi, hoàn thiện tài liệu và demo |

**Tiêu chí demo hoàn thành:** người dùng đăng ký → tìm chuyến nội địa → giữ chỗ → thanh toán thử → nhận email → thấy booking trong tài khoản; admin xem được booking và cập nhật chuyến bay.

## Quy ước triển khai

- Giữ API key, thông tin database và khóa dịch vụ trong biến môi trường phía backend; không commit file `.env` chứa bí mật.
- Ghi migration cho mọi thay đổi schema và cung cấp dữ liệu seed để cả nhóm chạy cùng một trạng thái ban đầu.
- Mỗi thay đổi nên có pull request hoặc được thành viên khác xem lại trước khi gộp.
- Kiểm thử ít nhất các trường hợp: hết chỗ, hai người đặt ghế cuối cùng, giữ chỗ hết hạn, thanh toán thất bại, callback thanh toán lặp, người dùng truy cập trang admin.
- Cập nhật README khi nhóm chốt công nghệ, cấu trúc thư mục và lệnh cài đặt/chạy thực tế.
