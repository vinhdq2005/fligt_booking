# Quy tắc nhập dữ liệu chuyến bay

## Khi admin nhập dữ liệu

1. Admin chọn mã sân bay đi, mã sân bay đến và ngày bay.
2. Nếu đã có `FlightSearch` cùng tuyến/ngày còn hạn (`expiresAt` lớn hơn thời điểm hiện tại), hệ thống trả dữ liệu đó và không gọi SerpApi.
3. Nếu chưa có dữ liệu hoặc bản mới nhất đã hết hạn, hệ thống **phải hỏi xác nhận** trước khi gọi SerpApi. Hủy xác nhận thì không gọi API và không ghi database.
4. Sau khi admin xác nhận, backend kiểm tra API key, gọi SerpApi và lưu một `FlightSearch` mới. Bản cũ được giữ lại để xem lịch sử.
5. Một lần nhập chỉ áp dụng cho 1 người lớn, hạng phổ thông và tiền tệ VND theo schema hiện tại.

## Khi người dùng tìm chuyến

API tìm chuyến của người dùng chỉ đọc database; không tự gọi SerpApi. Chỉ dùng dữ liệu còn hạn và hiển thị thời điểm cập nhật cùng nhãn "Giá tham khảo". Nếu không có dữ liệu còn hạn, trả danh sách rỗng.

## Cách chạy CLI hiện tại

Từ thư mục `server`:

```text
npx tsx src/import-flights.ts HAN SGN 2026-11-01
npx tsx src/import-batch.ts --run
```

Hai lệnh trên hỏi `[y/N]` trước khi gọi SerpApi khi cần nhập. Nếu chạy không có terminal tương tác, mặc định là hủy. Cờ `--yes` là xác nhận rõ ràng cho tác vụ tự động, ví dụ `npx tsx src/import-flights.ts HAN SGN 2026-11-01 --yes`. Lệnh batch không có `--run` chỉ liệt kê dữ liệu còn thiếu hoặc hết hạn.

## Khi thêm trang admin

Form admin cần kiểm tra trạng thái dữ liệu trước, hiện hộp thoại xác nhận nếu thiếu/hết hạn, rồi mới gửi yêu cầu import. Backend phải kiểm tra lại trạng thái và chỉ gọi SerpApi khi yêu cầu import có xác nhận; không tin riêng vào việc frontend đã hiện hộp thoại. Các route admin cần kiểm tra quyền trước khi cho nhập dữ liệu.

## HTTP API hiện có

Đặt `DATABASE_URL` và `SERPAPI_API_KEY` trong `server/.env`, chạy migration và `npm run dev:server` từ thư mục gốc. Server lắng nghe tại `127.0.0.1:3001` (hoặc `PORT` nếu đã cấu hình). Đăng nhập tài khoản `ADMIN` trước khi gọi các API dưới đây; trình duyệt gửi cookie phiên tự động. Lệnh POST cần thêm header `x-csrf-intent: 1`.

| Phương thức | Đường dẫn | Dữ liệu | Kết quả |
| --- | --- | --- | --- |
| GET | `/api/admin/flight-imports/status` | Query `departureCode`, `arrivalCode`, `date` | `missing`, `expired` hoặc `fresh` |
| POST | `/api/admin/flight-imports` | JSON gồm ba trường trên và `confirmed: true` | `imported` hoặc `already_fresh` |
| GET | `/api/admin/flights` | Query tùy chọn `from`, `to`, `date`, `status`, `page` | Danh sách từng `FlightOffer` cùng các chặng, trạng thái và phân trang |

Nếu POST không có `confirmed: true` mà cần gọi SerpApi, API trả HTTP 428 và `confirmation_required`. Form admin chỉ gửi POST xác nhận sau khi người dùng đồng ý. Quyền admin được kiểm tra ở backend từ phiên đăng nhập.
