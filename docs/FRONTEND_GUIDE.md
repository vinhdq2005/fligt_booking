# Hướng dẫn làm việc Frontend

Tài liệu này dành cho người xây dựng **giao diện người dùng** của dự án Flight Booking. Ở giai đoạn hiện tại, frontend chạy độc lập với **dữ liệu mẫu**. Nội dung hiển thị, tài khoản, giá, số chỗ, mã đặt chỗ và kết quả thanh toán chỉ phục vụ trình diễn; chưa lấy từ backend và chưa tạo booking thật.

## 1. Phạm vi công việc

Xây giao diện và điều hướng cho các màn hình:

1. Trang chủ.
2. Đăng ký, đăng nhập và tài khoản cá nhân.
3. Tìm chuyến bay và kết quả tìm kiếm.
4. Chi tiết chuyến bay.
5. Nhập thông tin hành khách và kiểm tra lại đặt chỗ.
6. Thanh toán **mô phỏng** và trang kết quả.
7. Danh sách đặt chỗ đã tạo trong bản demo và chi tiết từng đặt chỗ.

Người dùng chọn **số lượng hành khách/chỗ**; giao diện chưa có sơ đồ chọn số ghế cụ thể và chưa có check-in. Trang admin nằm ngoài phạm vi tài liệu này.

Các thao tác như tìm kiếm, đăng nhập hoặc thanh toán chỉ cần tạo luồng tương tác hợp lý trên frontend. Không viết API, không kết nối MySQL/SerpApi, không xử lý email và không nhập thông tin thẻ thanh toán thật.

## 2. Đặt code vào đâu?

Mọi mã giao diện đặt trong `client/`. Không đưa mã frontend vào `server/` hoặc `docs/`.

```text
client/
├── public/                  # File tĩnh dùng trực tiếp, ví dụ favicon
└── src/
    ├── assets/              # Ảnh, icon, font được import vào mã nguồn
    ├── components/          # Thành phần dùng lại ở nhiều tính năng
    ├── features/            # Thành phần và logic giao diện theo tính năng
    ├── layouts/             # Khung trang chung
    ├── mocks/               # Dữ liệu mẫu và kịch bản demo
    ├── pages/               # Trang tương ứng với đường dẫn
    ├── routes/              # Khai báo đường dẫn và điều hướng
    └── styles/              # Kiểu dáng và biến giao diện toàn cục
```

| Khi cần thêm... | Đặt tại | Ví dụ |
| --- | --- | --- |
| Một trang mới | `client/src/pages/` | `FlightResultsPage.tsx` |
| Một thành phần dùng ở nhiều trang | `client/src/components/` | `FlightCard.tsx` |
| Thành phần riêng của một luồng | `client/src/features/<ten-tinh-nang>/` | `features/booking/PassengerForm.tsx` |
| Header/footer hoặc bố cục chung | `client/src/layouts/` | `MainLayout.tsx` |
| Dữ liệu giả | `client/src/mocks/` | `flights.ts`, `bookings.ts` |
| Định nghĩa route | `client/src/routes/` | `AppRoutes.tsx` |
| CSS dùng chung | `client/src/styles/` | `global.css`, `tokens.css` |
| Ảnh được import trong component | `client/src/assets/` | `flight-banner.webp` |
| File được dùng bằng URL trực tiếp | `client/public/` | `favicon.svg` |

**Quy tắc chọn chỗ đặt file:** nếu một component chỉ dùng trong một tính năng, đặt cạnh tính năng đó. Chỉ chuyển vào `components/` khi thực sự được nhiều tính năng dùng lại. Không đặt toàn bộ code trong một file trang hoặc tạo nhiều thư mục mới chỉ cho một component nhỏ.

## 3. Quy tắc đặt tên

Áp dụng thống nhất khi dự án frontend được khởi tạo bằng React và TypeScript như định hướng trong README:

| Đối tượng | Quy tắc | Ví dụ |
| --- | --- | --- |
| React component, page, layout và tên file tương ứng | `PascalCase` | `FlightCard.tsx`, `LoginPage.tsx` |
| Hook | `camelCase`, bắt đầu bằng `use` | `useFlightFilters.ts` |
| Hàm, biến, prop | `camelCase`, tên mô tả ý nghĩa | `selectedFlight`, `handleSearch` |
| Type/interface | `PascalCase` | `Flight`, `BookingSummary` |
| Hằng số cố định dùng chung | `UPPER_SNAKE_CASE` | `MAX_PASSENGERS` |
| Thư mục tính năng | `kebab-case` | `flight-search/`, `booking/` |
| Đường dẫn URL | Chữ thường, `kebab-case` | `/my-bookings`, `/flights/results` |
| File dữ liệu mẫu và tiện ích | `camelCase` | `mockFlights.ts`, `formatCurrency.ts` |
| CSS Module đi cùng component | Tên component + `.module.css` | `FlightCard.module.css` |
| Ảnh và file tĩnh | Chữ thường, `kebab-case` | `home-banner.webp` |

Tên hiển thị cho người dùng viết bằng **tiếng Việt**. Tên trong code viết bằng **tiếng Anh** và dùng từ vựng thống nhất: `flight`, `passenger`, `booking`, `payment`, `airport`. Không trộn tên tiếng Việt không dấu vào biến hoặc tên file. Tránh tên chung chung như `data`, `temp`, `item1`, `page2` khi có thể đặt tên theo ý nghĩa.

## 4. Quy ước dữ liệu mẫu

- Tập trung dữ liệu giả trong `client/src/mocks/`; trang và component đọc từ đó, không lặp cùng một chuyến bay bằng các giá trị viết cứng ở nhiều file.
- Có ít nhất các kịch bản: chuyến có chỗ, chuyến hết chỗ, không có kết quả tìm kiếm, thanh toán demo thành công và thất bại.
- Dùng ID ổn định cho sân bay, chuyến bay và booking để điều hướng giữa các trang. Dữ liệu của cùng một chuyến phải nhất quán về giờ, giá và hãng trên mọi màn hình.
- Dùng thông tin hành khách giả. Không commit dữ liệu cá nhân thật, mật khẩu hoặc thông tin thẻ.
- Nếu cần giữ trạng thái khi tải lại trang, chỉ lưu **dữ liệu demo không nhạy cảm** trong lưu trữ trình duyệt. Mọi trạng thái lưu ở đây chỉ phục vụ trình diễn.
- Hiển thị nhãn như **“Dữ liệu minh họa”**, **“Đặt chỗ demo”** hoặc **“Thanh toán mô phỏng”** ở những vị trí có thể khiến người xem hiểu nhầm là giao dịch thật.

Ví dụ một bộ dữ liệu mẫu có thể gồm sân bay `HAN`, `SGN`, `DAD`, các chuyến bay giữa các sân bay này, giá tính bằng VND và số chỗ giả định. Đây là dữ liệu để kiểm tra giao diện, không phải lịch bay hoặc giá đang được bán.

## 5. Quy tắc xây giao diện

- Trang chủ và trang tìm chuyến dùng lại cùng biểu mẫu tìm kiếm; thay đổi biểu mẫu ở một nơi phải xuất hiện ở cả hai.
- Mỗi trang cần có trạng thái phù hợp: bình thường, rỗng, sai dữ liệu nhập và thao tác không thể tiếp tục. Nếu dùng trạng thái chờ để trình diễn, phải ghi rõ đây là mô phỏng.
- Biểu mẫu cần có nhãn, lỗi cụ thể cạnh trường và giữ giá trị người dùng đã nhập khi chuyển bước/quay lại.
- Trên kết quả tìm kiếm, người dùng có thể sửa tiêu chí, lọc/sắp xếp dữ liệu mẫu và mở chi tiết chuyến.
- Luồng đặt chỗ hiển thị **số lượng hành khách/chỗ**, thông tin hành khách, giá demo và mã đặt chỗ demo. Không hiển thị số ghế như `12A`.
- Trang thanh toán chỉ mô phỏng kết quả. Không dùng ô nhập số thẻ thật, không gọi cổng thanh toán và không ghi “đã thanh toán thật”.
- Giao diện phải dùng được trên điện thoại và desktop; các thao tác chính dùng được bằng bàn phím.

## 6. Trình tự làm việc đề xuất

1. Dựng layout, các thành phần chung và bộ dữ liệu mẫu.
2. Làm trang chủ → tìm chuyến → kết quả → chi tiết chuyến.
3. Làm đăng ký, đăng nhập và tài khoản demo.
4. Làm thông tin hành khách → kiểm tra đặt chỗ → thanh toán mô phỏng → kết quả.
5. Làm danh sách và chi tiết đặt chỗ demo.
6. Kiểm tra điều hướng, trạng thái rỗng/lỗi và responsive trên toàn bộ luồng.

Một màn hình được xem là xong khi mở được từ điều hướng, hiển thị đúng dữ liệu mẫu, có trạng thái lỗi/rỗng phù hợp và dùng được trên màn hình nhỏ. **Tài liệu này chưa đặt yêu cầu tích hợp backend.**
