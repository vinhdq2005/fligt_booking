# Database Requirements

## 1. Mục đích

Database phục vụ hệ thống đặt vé máy bay nội địa, bao gồm:

* Quản lý người dùng và phân quyền.
* Quản lý sân bay, hãng bay và tuyến bay.
* Quản lý chuyến bay, giá vé và số ghế.
* Quản lý thông tin hành khách.
* Quản lý booking.
* Quản lý thanh toán.
* Lưu lịch sử import dữ liệu từ nguồn bên ngoài.

---

## 2. Các nhóm dữ liệu chính

Database dự kiến gồm các nhóm bảng:

```text
Users
Roles
Airports
Airlines
Routes
Flights
Flight Prices
Bookings
Passengers
Payments
Import Logs
```

Thiết kế bảng cụ thể có thể thay đổi trong quá trình code, miễn là vẫn đáp ứng được các nghiệp vụ bên dưới.

---

## 3. Users & Roles

### Users

Dùng để lưu tài khoản người dùng.

Các thông tin tối thiểu:

```text
id
name
email
password
phone
role_id
created_at
updated_at
```

### Roles

Dùng để phân quyền.

Các role chính:

```text
CUSTOMER
ADMIN
```

Quan hệ:

```text
Role 1 ─── N User
```

---

## 4. Airports

Lưu thông tin sân bay.

Các thông tin tối thiểu:

```text
id
code
name
city
country
status
```

Ví dụ:

```text
HAN - Noi Bai International Airport - Hanoi
SGN - Tan Son Nhat International Airport - Ho Chi Minh City
DAD - Da Nang International Airport - Da Nang
CXR - Cam Ranh International Airport - Khanh Hoa
PQC - Phu Quoc International Airport - Kien Giang
```

`code` phải unique.

---

## 5. Airlines

Lưu thông tin hãng hàng không.

Các thông tin tối thiểu:

```text
id
code
name
status
```

Ví dụ:

```text
Vietnam Airlines
Vietjet Air
Bamboo Airways
Vietravel Airlines
```

---

## 6. Routes

Lưu tuyến bay.

Các thông tin tối thiểu:

```text
id
departure_airport_id
arrival_airport_id
status
```

Quan hệ:

```text
Airport ─── Route ─── Airport
```

Một Route có:

```text
1 departure airport
1 arrival airport
```

Không cho phép departure airport và arrival airport giống nhau.

---

## 7. Flights

Lưu thông tin từng chuyến bay.

Các thông tin quan trọng:

```text
id
flight_number
airline_id
route_id
departure_time
arrival_time
total_seats
available_seats
status
created_at
updated_at
```

Flight status:

```text
DRAFT
PUBLISHED
CANCELLED
```

Quan hệ:

```text
Airline 1 ─── N Flight

Route 1 ─── N Flight
```

`available_seats` được sử dụng để xử lý nghiệp vụ giữ chỗ trong hệ thống demo.

---

## 8. Flight Prices

Nếu hệ thống muốn hỗ trợ lịch sử/thay đổi giá, nên tách giá khỏi Flight.

Các thông tin:

```text
id
flight_id
price
currency
valid_from
valid_to
created_at
```

Quan hệ:

```text
Flight 1 ─── N FlightPrice
```

Nếu nhóm quyết định mỗi chuyến bay chỉ có một mức giá hiện tại, có thể đặt `price` trực tiếp trong `Flights` thay vì tạo bảng riêng.

---

## 9. Bookings

Đây là bảng quan trọng nhất đối với backend.

Các thông tin tối thiểu:

```text
id
booking_code
user_id
flight_id
seat_count
total_price
status
hold_expires_at
created_at
updated_at
```

Booking status:

```text
HELD
CONFIRMED
CANCELLED
EXPIRED
```

### Ý nghĩa

`HELD`:

> Người dùng đã giữ chỗ nhưng chưa thanh toán thành công.

`CONFIRMED`:

> Thanh toán thành công và booking được xác nhận.

`CANCELLED`:

> Booking bị hủy.

`EXPIRED`:

> Thời gian giữ chỗ hết hạn.

Quan hệ:

```text
User 1 ─── N Booking

Flight 1 ─── N Booking
```

`booking_code` phải unique.

---

## 10. Passengers

Một booking có thể có một hoặc nhiều hành khách.

Các thông tin:

```text
id
booking_id
full_name
date_of_birth
gender
identity_number
created_at
```

Quan hệ:

```text
Booking 1 ─── N Passenger
```

Ví dụ:

```text
Booking BK001
    ├── Passenger 1
    ├── Passenger 2
    └── Passenger 3
```

---

## 11. Payments

Lưu thông tin thanh toán.

Các thông tin:

```text
id
booking_id
amount
payment_method
status
transaction_id
paid_at
created_at
updated_at
```

Payment status:

```text
PENDING
SUCCESS
FAILED
```

Quan hệ:

```text
Booking 1 ─── N Payment
```

Trong MVP có thể sử dụng mock/sandbox payment.

---

## 12. Import Logs

Dùng để theo dõi quá trình Admin import dữ liệu từ API bên ngoài.

Các thông tin:

```text
id
source
status
started_at
completed_at
records_imported
error_message
```

Import status:

```text
RUNNING
SUCCESS
FAILED
```

Ví dụ:

```text
source = SerpApi
status = SUCCESS
records_imported = 25
```

---

## 13. Quan hệ tổng quát

```text
Role
 │
 └──── N User
          │
          └──── N Booking
                    │
                    ├──── N Passenger
                    │
                    └──── N Payment
                    │
                    └──── N Flight
                              │
                              ├──── 1 Airline
                              │
                              ├──── 1 Route
                              │
                              └──── N FlightPrice

Route
 │
 ├──── 1 Departure Airport
 │
 └──── 1 Arrival Airport
```

---

## 14. Các yêu cầu quan trọng cho Backend

### 14.1 Search Flights

Backend cần có khả năng tìm:

```text
departure airport
arrival airport
departure date
number of passengers
```

và trả về:

```text
flight
airline
departure time
arrival time
price
available seats
```

---

### 14.2 Hold Seat

Backend cần kiểm tra:

```text
available_seats >= requested_seats
```

Nếu đủ ghế:

```text
Create booking
status = HELD
hold_expires_at = current_time + hold_duration
available_seats -= requested_seats
```

Các thao tác trên phải được xử lý an toàn khi có nhiều request đồng thời.

---

### 14.3 Payment

Khi tạo thanh toán:

```text
Payment.status = PENDING
```

Nếu thanh toán thành công:

```text
Payment.status = SUCCESS
Booking.status = CONFIRMED
```

Nếu thất bại:

```text
Payment.status = FAILED
```

Booking/ghế được xử lý theo quy tắc hết hạn hoặc hủy của hệ thống.

---

### 14.4 Booking Expiry

Nếu:

```text
Booking.status = HELD
```

và:

```text
current_time > hold_expires_at
```

thì booking có thể chuyển thành:

```text
EXPIRED
```

và số ghế được giữ phải được giải phóng.

---

## 15. Data Integrity

Database nên đảm bảo:

* Email user unique.
* Airport code unique.
* Airline code unique.
* Booking code unique.
* Foreign key giữa các bảng phải được đảm bảo.
* Không cho phép số ghế khả dụng nhỏ hơn 0.
* Không cho phép đặt vượt quá số ghế khả dụng.
* Giá booking được lưu tại thời điểm đặt vé.
* Payment phải liên kết với Booking.
* Passenger phải liên kết với Booking.

---

## 16. External API Data

SerpApi được sử dụng để cung cấp dữ liệu tham khảo.

Luồng:

```text
SerpApi
   ↓
Backend
   ↓
Validate / Normalize
   ↓
MySQL
```

Dữ liệu import nên có thông tin nguồn và thời gian lấy dữ liệu nếu cần:

```text
source
fetched_at
expires_at
```

Dữ liệu từ API bên ngoài không được coi là trạng thái inventory/đặt chỗ thực tế của hãng hàng không.

Số ghế và trạng thái booking trong hệ thống demo được quản lý bởi database nội bộ.

---

## 17. MVP Priority

### Bắt buộc

```text
Users
Roles
Airports
Airlines
Routes
Flights
Bookings
Passengers
Payments
```

### Có thể bổ sung

```text
Flight Prices
Import Logs
```

Nếu nhóm muốn đơn giản hóa database trong giai đoạn đầu, có thể để `price` trực tiếp trong `Flights` và bổ sung `Flight Prices` sau.

