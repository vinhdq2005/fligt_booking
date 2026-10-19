# Đặc tả trang Admin — Flight Booking

**Trạng thái:** Phương án đã chốt cho giao diện và phạm vi nghiệp vụ admin.  
**Phạm vi:** Chỉ trang quản trị nền tảng. Giao diện khách hàng và hãng bay là các phân hệ riêng.  
**Nguyên tắc:** Admin xem dữ liệu toàn hệ thống và xử lý ngoại lệ; hãng bay tạo chuyến, đặt giá, quản lý bán vé thường ngày.

**Tiến độ:** Bước 1–4 đã có giao diện và luồng can thiệp mẫu. Bước 5 đã thêm tài khoản, phiên đăng nhập và phân quyền. Bước 6 đã nối tổng quan, danh sách và panel chi tiết với API đọc dữ liệu thật. Bước 7 đã có API can thiệp, kiểm tra nghiệp vụ, transaction, nhật ký và chống gửi lặp. Bước 8 đã nối các nút/hộp thoại của trang dữ liệu thật với API, tải lại trạng thái và nhật ký sau thao tác; kiểm thử mã và build đã đạt.

## 1. Mục tiêu và ranh giới

Admin cần trả lời nhanh: hệ thống đang hoạt động ra sao, dữ liệu của hãng nào có vấn đề, booking nào cần hỗ trợ, ai đã thực hiện thay đổi. Admin **không** thao tác trực tiếp trên mọi bảng database. Giao diện trình bày dữ liệu theo nghiệp vụ; mỗi thao tác ghi dữ liệu phải đi qua API có kiểm tra điều kiện và ghi nhật ký.

- Admin được xem thông tin nghiệp vụ của mọi hãng. Thông tin hành khách chỉ hiển thị đủ để hỗ trợ; không hiển thị mật khẩu, token, khóa API hay dữ liệu bí mật.
- Admin không tạo chuyến, đặt giá hoặc sửa sức chứa thay hãng trong luồng thường ngày.
- Admin không đổi trực tiếp trạng thái thanh toán, số tiền, mã giao dịch hoặc xóa booking.
- Việc giữ chỗ và thanh toán của dự án là **mô phỏng nội bộ**, không đồng nghĩa với vé được hãng bay xác nhận.

## 2. Khung giao diện

Áp dụng bố cục từ ảnh tham khảo: **menu trái → vùng danh sách chính → panel chi tiết bên phải**. Menu là nhóm nghiệp vụ, không phải tên bảng database.

```text
┌──────────────────┬──────────────────────────────────────────┬──────────────────────┐
│ Menu admin       │ Tiêu đề, bộ lọc, bảng, phân trang         │ Chi tiết dòng chọn   │
│                  │                                          │ Dữ liệu liên quan    │
│ Tổng quan        │                                          │ Lịch sử              │
│ Hãng bay         │                                          │ Thao tác được phép   │
│ Tài khoản        │                                          │                      │
│ Chuyến bay       │                                          │                      │
│ Booking          │                                          │                      │
│ Thanh toán       │                                          │                      │
│ Nhật ký          │                                          │                      │
└──────────────────┴──────────────────────────────────────────┴──────────────────────┘
```

Quy tắc chung cho các trang danh sách:

- Có tìm kiếm, bộ lọc phù hợp, sắp xếp và phân trang phía server. Mỗi bảng chỉ hiển thị khoảng 5–8 cột quan trọng; chi tiết nằm ở panel.
- Có trạng thái **đang tải**, **không có dữ liệu**, **không có kết quả lọc**, **lỗi tải dữ liệu** và nút thử lại. Không dùng cùng một thông báo cho hai trường hợp không có dữ liệu và lọc không ra kết quả.
- Trên màn hình hẹp, menu thu gọn và panel chi tiết mở dạng drawer. Bảng có thể cuộn ngang khi thật cần, nhưng không bắt người dùng cuộn ngang để thấy cột hành động chính.
- Nút thao tác phụ thuộc trạng thái bản ghi; thao tác nhạy cảm mở hộp thoại nêu hậu quả, yêu cầu lý do và xác nhận. Sau thành công cập nhật danh sách và panel.
- Không có nút `+`, sửa, xóa, import/export chung cho mọi trang. Mỗi trang chỉ có hành động được đặc tả bên dưới.

## 3. Các màn hình

### 3.1. Tổng quan — `/admin`

**Hiển thị:** số hãng đang hoạt động, tài khoản đang hoạt động/bị khóa, chuyến đang bán/tạm ẩn, booking theo trạng thái, tổng tiền thanh toán thử thành công trong khoảng thời gian chọn. Có danh sách ngắn các việc cần chú ý: chuyến bị tạm ẩn, booking cần hỗ trợ, thanh toán lỗi.

**Tương tác:** chọn khoảng ngày; bấm vào thẻ số liệu hoặc việc cần chú ý để mở danh sách đã lọc. Tổng tiền phải ghi rõ **doanh thu mô phỏng**, không gọi là doanh thu thực.

**Dữ liệu:** thống kê từ API tổng hợp, không tính toàn bộ bằng cách tải mọi bản ghi về trình duyệt.

### 3.2. Hãng bay — `/admin/airlines`

**Bảng:** mã hãng, tên, trạng thái, số tài khoản nhân viên, số chuyến đang bán, ngày tạo.  
**Bộ lọc:** tên/mã hãng, trạng thái.  
**Panel:** thông tin hãng, danh sách nhân viên, số chuyến/booking liên quan và lịch sử can thiệp.

**Hành động:** tạo hãng; cập nhật thông tin nhận diện cơ bản; khóa/mở quyền hoạt động của hãng với lý do. Khóa hãng phải chặn việc tạo chuyến hoặc mở bán mới; ảnh hưởng lên các chuyến đang bán và booking hiện có phải được hiển thị trước khi xác nhận, không âm thầm hủy chúng.

### 3.3. Tài khoản — `/admin/users`

**Bảng:** tên, email, vai trò, hãng trực thuộc (nếu có), trạng thái, lần đăng nhập gần nhất.  
**Bộ lọc:** tên/email, vai trò, hãng, trạng thái.  
**Panel:** hồ sơ tối thiểu, vai trò hiện tại và lịch sử cấp quyền/khóa tài khoản.

**Hành động:** tạo tài khoản nhân viên hãng; gán vai trò `AIRLINE_FLIGHT_MANAGER` hoặc `AIRLINE_SALES_MANAGER`; khóa/mở tài khoản; đặt lại quyền truy cập theo cơ chế xác thực được chọn. Tài khoản khách có thể tra cứu và khóa khi cần, nhưng admin không xem mật khẩu. Không cho admin tự khóa chính mình hoặc gỡ admin cuối cùng.

### 3.4. Chuyến bay — `/admin/flights`

Trang này hiển thị **chuyến bay nội bộ do hãng tạo** (`Flight`), là loại khách có thể đặt chỗ trong hệ thống demo.

**Bảng:** mã chuyến, hãng, tuyến, giờ đi, giá cơ bản, sức chứa/chỗ còn, trạng thái.  
**Bộ lọc:** mã chuyến, hãng, tuyến, ngày bay, trạng thái.  
**Panel:** lịch trình, giá và sức chứa hiện tại, số booking theo trạng thái, lịch sử thay đổi.

**Hành động admin:** tạm ẩn/ngừng nhận booking mới hoặc mở lại sau khi kiểm tra; bắt buộc lý do. Không có form tạo chuyến, sửa lịch, giá hay sức chứa. Nếu chuyến đã có booking, panel và hộp thoại phải cho thấy số booking bị ảnh hưởng. Chuyến hủy và việc xử lý khách đã đặt cần quy trình riêng, không coi thao tác tạm ẩn là hủy chuyến.

**Lưu ý dữ liệu:** trang `/admin` hiện tại đang liệt kê `FlightOffer` lấy từ SerpApi (`fresh/expired`); đó là **dữ liệu tham khảo**, không phải `Flight` có sức chứa để bán. Không trộn hai loại vào cùng một danh sách. Phần SerpApi hiện có chuyển thành mục phụ **Dữ liệu tham khảo** (`/admin/reference-flights`) nếu vẫn cần giữ luồng nhập dữ liệu.

### 3.5. Booking — `/admin/bookings`

**Bảng:** mã booking, hãng, mã chuyến, khách liên hệ, tổng tiền, trạng thái, thời gian tạo.  
**Bộ lọc:** mã booking, hãng, trạng thái, ngày tạo, ngày bay.  
**Panel:** chuyến bay, thông tin liên hệ, danh sách hành khách, thanh toán liên quan, dòng thời gian trạng thái và nhật ký can thiệp.

**Hành động admin:** hủy booking ngoại lệ với lý do; chỉ bật khi quy tắc nghiệp vụ cho phép. Trước xác nhận hiển thị số chỗ được giải phóng và tình trạng thanh toán cần xử lý. Booking đã thanh toán không được tự động gắn nhãn “đã hoàn tiền” chỉ vì admin hủy. Không cho chỉnh trực tiếp hành khách, giá hoặc trạng thái bằng form tổng quát.

### 3.6. Thanh toán — `/admin/payments`

**Bảng:** mã giao dịch, mã booking, hãng, số tiền, phương thức, trạng thái, thời gian.  
**Bộ lọc:** mã giao dịch/booking, hãng, trạng thái, khoảng ngày.  
**Panel:** giao dịch, booking liên quan, các lần thanh toán nếu có và lịch sử xử lý.

**Hành động:** xem và đối soát; đánh dấu một trường hợp cần kiểm tra kèm lý do. Không có nút đổi `PENDING` sang `PAID`, sửa số tiền hoặc tạo giao dịch giả từ trang admin. Nếu sau này có hoàn tiền sandbox, phải làm thành luồng nghiệp vụ riêng có phản hồi từ hệ thống thanh toán.

### 3.7. Nhật ký — `/admin/audit-logs`

**Bảng:** thời gian, người thực hiện, vai trò, hành động, đối tượng, kết quả.  
**Bộ lọc:** người thực hiện, hành động, loại đối tượng, khoảng ngày.  
**Panel:** lý do, giá trị trước/sau ở các trường liên quan, mã yêu cầu và lỗi nếu thao tác thất bại. Chỉ đọc, không sửa/xóa qua giao diện.

### 3.8. Dữ liệu tham khảo — `/admin/reference-flights` (mục phụ)

Giữ lại trang danh sách lựa chọn từ SerpApi, trạng thái `fresh/expired`, thời điểm cập nhật và hộp thoại xác nhận trước khi nhập. Giá phải có nhãn **tham khảo**. Các bản ghi này không có số chỗ nội bộ và không được trình bày như chuyến đang mở bán. Đặt mục này sau các màn hình quản trị cốt lõi trong menu.

## 4. Ma trận quyền admin

| Đối tượng | Xem | Tạo/sửa thường ngày | Can thiệp ngoại lệ |
| --- | --- | --- | --- |
| Hãng bay | Toàn hệ thống | Tạo và sửa thông tin cơ bản | Khóa/mở quyền hoạt động |
| Tài khoản | Toàn hệ thống, che dữ liệu bí mật | Tạo nhân viên, gán vai trò | Khóa/mở tài khoản |
| Chuyến nội bộ | Toàn hệ thống | Thuộc nhân viên hãng | Tạm ẩn/mở lại với lý do |
| Booking | Toàn hệ thống | Thuộc luồng khách/hãng | Hủy ngoại lệ khi hợp lệ |
| Thanh toán | Toàn hệ thống | Thuộc luồng thanh toán | Đánh dấu cần kiểm tra; không sửa kết quả giao dịch |
| Nhật ký | Toàn hệ thống | Không | Không sửa/xóa |
| SerpApi tham khảo | Xem dữ liệu và nguồn | Nhập có xác nhận nếu giữ tính năng | Không biến dữ liệu tham khảo thành tồn chỗ |

Backend phải xác thực và phân quyền cho **từng API**, không dựa vào việc ẩn nút ở frontend. Nhân viên hãng chỉ truy cập bản ghi thuộc `airlineId` của mình; admin có phạm vi toàn hệ thống. Các thao tác can thiệp cần lưu `actorId`, `action`, `entityType`, `entityId`, `reason`, `before`, `after`, `createdAt`.

## 5. Quy trình nghiệp vụ admin

### 5.1. Cấp tài khoản cho hãng

Admin tạo hãng → tạo nhân viên → chọn vai trò và hãng trực thuộc → hệ thống kiểm tra email duy nhất → tài khoản được kích hoạt → ghi nhật ký. Khi đổi vai trò hoặc khóa tài khoản, quyền API mới có hiệu lực ngay sau khi phiên/credential được kiểm tra lại.

### 5.2. Tạm ẩn chuyến

Admin mở chi tiết chuyến → xem số booking liên quan → bấm **Tạm ẩn** → nhập lý do → backend kiểm tra trạng thái và ghi thay đổi/nhật ký → chuyến không nhận booking mới. Booking đã có không tự mất. Mở lại chỉ khi chuyến còn hợp lệ để bán.

### 5.3. Hủy booking ngoại lệ

Admin mở booking → xem chuyến, hành khách, thanh toán → bấm **Hủy ngoại lệ** → giao diện hiển thị tác động → nhập lý do → backend kiểm tra trạng thái và cập nhật booking/số chỗ một cách nhất quán → ghi nhật ký. Nếu đã thanh toán, tạo trạng thái cần xử lý/đối soát phù hợp; không tự ghi đã hoàn tiền khi chưa có luồng hoàn tiền.

### 5.4. Kiểm tra thanh toán

Admin lọc giao dịch lỗi hoặc chờ xử lý → xem booking và các lần thanh toán → đánh dấu **Cần kiểm tra** kèm ghi chú → nhân viên phụ trách xử lý theo quy trình riêng. Admin không sửa trực tiếp kết quả giao dịch.

## 6. Xây dựng từ code hiện có

| Hiện trạng | Vị trí | Hướng xử lý |
| --- | --- | --- |
| Trang SerpApi có danh sách, bộ lọc, phân trang, panel và modal import | `client/src/pages/admin/AdminReferenceFlightsPage.tsx`, `client/src/styles.css` | Đã chuyển sang **Dữ liệu tham khảo** trong giai đoạn 2; trang **Chuyến bay nội bộ** hiện dùng dữ liệu mẫu để duyệt giao diện |
| Đã có nhóm route `/admin/*`, `AdminGuard` và trang 403 | `client/src/routes/AppRoutes.tsx`, `client/src/admin/AdminLayout.tsx` | Bước 6 nối giao diện với API đọc; guard hiện dùng `/api/auth/me` |
| API client hiện có cho SerpApi và booking khách | `client/src/api.ts` | Tách module API admin theo tài nguyên; khai báo kiểu dữ liệu, phân trang, lỗi và quyền thao tác |
| Admin API đã dùng cookie phiên và vai trò từ database | `server/src/app.ts`, `client/vite.config.ts` | Bước 7 áp dụng kiểm tra điều kiện và nhật ký cho từng can thiệp |
| API tạo hãng và tạo chuyến hiện nằm dưới `/api/admin/*` | `server/src/app.ts` | Sau khi có tài khoản hãng, chuyển thao tác tạo chuyến về API hãng; admin giữ quyền quản trị hãng và xem chuyến toàn hệ thống |
| Prisma có `Airline`, `Flight`, `Booking`, `Payment`; chưa có `User`, `Role`, `AuditLog` | `server/prisma/schema.prisma` | Bổ sung migration cho tài khoản, vai trò/quyền và nhật ký; liên kết booking với khách nếu cần “booking của tôi” thực sự |
| `FlightStatus` hiện là `SCHEDULED/BOARDING/DEPARTED/COMPLETED/CANCELLED` | `server/prisma/schema.prisma` | Bổ sung trạng thái hoặc cờ mở bán/tạm ẩn riêng; không dùng `CANCELLED` để biểu diễn tạm ẩn |
| Login/đăng ký khách dùng backend; không còn `mockUsers` | `client/src/auth/`, `client/src/pages/LoginPage.tsx` | Bước 6 bổ sung API truy vấn booking theo `userId`; booking khách chưa đăng nhập vẫn dùng mã đặt chỗ |

**Cấu trúc frontend gợi ý:**

```text
client/src/admin/
  components/       # AdminLayout, DataTable, FilterBar, DetailDrawer, ActionDialog
  pages/            # Dashboard, Airlines, Users, Flights, Bookings, Payments, AuditLogs
  api/              # các hàm gọi API admin và kiểu dữ liệu
  routes/           # AdminGuard và khai báo route
```

**Cấu trúc backend gợi ý:** module `auth`, `admin/airlines`, `admin/users`, `admin/flights`, `admin/bookings`, `admin/payments`, `admin/audit`; mỗi module có route, service và kiểm tra quyền. Đây là gợi ý tổ chức khi triển khai, không yêu cầu đổi toàn bộ cấu trúc hiện có ngay.

## 7. Chia nhỏ bài toán và thứ tự làm

Ưu tiên **chốt giao diện trước** bằng dữ liệu mẫu có cấu trúc giống API dự kiến. Những nút chưa có backend phải được đánh dấu là bản mẫu, không giả vờ thao tác đã lưu thành công.

| Bước | Việc cần làm | Đầu ra/điều kiện hoàn thành |
| --- | --- | --- |
| 1. Chốt hợp đồng dữ liệu | Thống nhất các cột bảng, bộ lọc, cấu trúc panel, trạng thái và hành động của 7 trang | Có type/interface và ví dụ dữ liệu cho từng trang; phân biệt `Flight` nội bộ với `FlightOffer` tham khảo |
| 2. Dựng khung UI | Tách sidebar/topbar; tạo bảng, lọc, phân trang, panel, modal xác nhận và các trạng thái tải/rỗng/lỗi | Điều hướng được `/admin/*` trên desktop và màn hình hẹp bằng mock data |
| 3. Dựng trang đọc dữ liệu | Chuyến bay, booking, thanh toán, hãng bay, tài khoản, nhật ký, tổng quan | Mỗi trang có danh sách và panel đúng nội dung; không có nút trái quyền |
| 4. Thiết kế luồng can thiệp trên UI | Hộp thoại khóa tài khoản, tạm ẩn chuyến, hủy booking, đánh dấu thanh toán cần kiểm tra | Có mô tả hậu quả, lý do bắt buộc, xác nhận/hủy và trạng thái lỗi; mới là UI mẫu |
| 5. Xây nền backend | Migration `User`/quyền/`AuditLog`, xác thực, middleware admin; điều chỉnh mô hình mở bán chuyến | API từ chối người không có quyền; quyền không phụ thuộc localStorage hay Vite proxy |
| 6. API đọc | API danh sách, chi tiết, bộ lọc và thống kê | UI dùng dữ liệu thật; có phân trang phía server và che dữ liệu bí mật |
| 7. API can thiệp | API khóa/mở tài khoản, tạm ẩn/mở chuyến, hủy booking ngoại lệ, đánh dấu cần kiểm tra | Kiểm tra điều kiện nghiệp vụ, cập nhật nhất quán, ghi nhật ký, xử lý gọi lặp |
| 8. Tích hợp và kiểm chứng | Nối UI với API, kiểm tra quyền và các ca lỗi | Demo được admin tra cứu → can thiệp → thấy trạng thái mới và bản ghi nhật ký |

**Nếu thời gian đồ án hạn chế:** hoàn thành bước 1–3 cho toàn bộ menu; làm thật bước 5–8 cho **Tài khoản**, **Chuyến bay** và **Booking** trước. Thanh toán có thể chỉ đọc; Tổng quan dùng số liệu cơ bản; SerpApi tham khảo giữ nguyên tính năng hiện có ở mục phụ.

## 8. Tiêu chí nghiệm thu trang admin

1. Người không có quyền admin không truy cập được API admin, kể cả khi gõ URL trực tiếp.
2. Admin xem và lọc được chuyến, booking và thanh toán của nhiều hãng; mở được chi tiết liên quan.
3. Admin không có nút tạo chuyến/sửa giá hoặc sửa trực tiếp trạng thái thanh toán.
4. Khóa tài khoản, tạm ẩn chuyến và hủy booking chỉ thực hiện khi hợp lệ, có lý do và nhật ký.
5. Tạm ẩn chuyến không làm mất booking cũ; hủy booking cập nhật số chỗ nhất quán.
6. Dữ liệu SerpApi được gắn nhãn tham khảo, tách khỏi chuyến có thể đặt trong hệ thống.
7. Bảng, bộ lọc, panel và thông báo lỗi dùng được trên màn hình máy tính và điện thoại.

### Kiểm chứng bước 8 trên giao diện

Đăng nhập bằng admin, mở `/admin/flights`, chọn một chuyến `SCHEDULED` còn giờ bay và đang `ON_SALE`. Trong panel bấm **Tạm ẩn chuyến**, kiểm tra hộp thoại hiển thị số booking còn hiệu lực, nhập lý do ít nhất 10 ký tự rồi xác nhận. Danh sách và panel phải hiển thị `HIDDEN`; nhật ký liên quan phải có hành động `HIDE_FLIGHT` và lý do. Mở `/admin/audit-logs` để tra cứu cùng bản ghi. Có thể mở bán lại bằng thao tác ngược khi hãng còn hoạt động.

Thử khóa chính tài khoản admin đang đăng nhập: nút phải bị vô hiệu hóa. Với booking đã thanh toán và còn hiệu lực, hộp thoại hủy phải báo số chỗ được giải phóng và thanh toán cần đối soát; sau khi xác nhận, booking thành `CANCELLED`, thanh toán giữ `PAID` và có `NEEDS_REVIEW`. Không thử hủy booking thật nếu chưa có dữ liệu kiểm thử riêng.
