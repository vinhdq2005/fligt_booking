# Backend Flow - Search Flights

## 1. Mục tiêu

Cho phép Customer tìm kiếm các chuyến bay nội địa dựa trên:

* Sân bay đi.
* Sân bay đến.
* Ngày khởi hành.
* Số lượng hành khách.

Backend lấy dữ liệu từ MySQL và trả về danh sách chuyến bay phù hợp.

---

## 2. Request

Frontend gửi request:

```http
GET /api/flights/search
```

Query parameters:

```text
departureAirport
arrivalAirport
departureDate
passengers
```

Ví dụ:

```http
GET /api/flights/search?departureAirport=HAN&arrivalAirport=SGN&departureDate=2026-10-20&passengers=2
```

---

## 3. Backend Processing

Backend thực hiện các bước:

```text
Receive request
      ↓
Validate parameters
      ↓
Find departure airport
      ↓
Find arrival airport
      ↓
Search flights
      ↓
Check flight status
      ↓
Check available seats
      ↓
Get price
      ↓
Sort / filter results
      ↓
Return response
```

---

## 4. Validate Request

Backend kiểm tra:

* `departureAirport` có tồn tại.
* `arrivalAirport` có tồn tại.
* Hai sân bay không được giống nhau.
* `departureDate` đúng định dạng.
* `passengers` là số nguyên lớn hơn 0.
* Không tìm chuyến bay đã quá ngày khởi hành.

Nếu dữ liệu không hợp lệ, trả về HTTP `400`.

Ví dụ:

```json
{
  "success": false,
  "message": "Invalid search parameters"
}
```

---

## 5. Query Database

Backend tìm các chuyến bay thỏa mãn:

```text
departure airport = departureAirport
arrival airport = arrivalAirport
departure date = departureDate
status = PUBLISHED
available seats >= passengers
```

Có thể thực hiện thông qua Prisma.

Pseudo-code:

```text
find flights
where
    route.departureAirport.code = departureAirport
    AND route.arrivalAirport.code = arrivalAirport
    AND departure_time matches departureDate
    AND status = PUBLISHED
    AND available_seats >= passengers
```

---

## 6. Response

Backend trả về danh sách chuyến bay.

Ví dụ:

```json
{
  "success": true,
  "data": [
    {
      "flightId": 101,
      "flightNumber": "VN123",
      "airline": "Vietnam Airlines",
      "departureAirport": "HAN",
      "arrivalAirport": "SGN",
      "departureTime": "2026-10-20T08:00:00",
      "arrivalTime": "2026-10-20T10:15:00",
      "price": 1500000,
      "availableSeats": 25
    }
  ]
}
```

---

## 7. Error Cases

### Không tìm thấy chuyến bay

HTTP `200`:

```json
{
  "success": true,
  "data": [],
  "message": "No flights found"
}
```

### Request không hợp lệ

HTTP `400`:

```json
{
  "success": false,
  "message": "Invalid search parameters"
}
```

### Database error

HTTP `500`:

```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## 8. Backend Responsibility

Backend chịu trách nhiệm:

* Validate request.
* Truy vấn database.
* Kiểm tra trạng thái chuyến bay.
* Kiểm tra số ghế.
* Lấy giá vé.
* Filter/sort theo yêu cầu.
* Chuẩn hóa response.
* Không để Frontend tự quyết định giá vé hoặc số ghế.

---

## 9. Data Flow

```text
Customer
    ↓
React Frontend
    ↓
GET /api/flights/search
    ↓
Express Backend
    ↓
Prisma
    ↓
MySQL
    ↓
Flight Results
    ↓
Prisma
    ↓
Express Backend
    ↓
JSON Response
    ↓
React Frontend
    ↓
Customer
```

---

## 10. Notes

Customer search sử dụng dữ liệu được lưu trong MySQL.

External flight API không được gọi trực tiếp trong chức năng Search Flights.

Dữ liệu từ external API được Admin import/synchronize trước và được chuẩn hóa vào database nội bộ.

