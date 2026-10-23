# Backend Flight Booking

Backend Express/Prisma dùng MySQL. Từ thư mục `server`, đặt `DATABASE_URL` trong `.env`, chạy `..\node_modules\.bin\prisma.cmd migrate deploy --config prisma7.config.ts` rồi `..\node_modules\.bin\prisma.cmd generate --config prisma7.config.ts`. Chạy server bằng `npm.cmd run dev` (mặc định `127.0.0.1:3001`). `SERPAPI_API_KEY` chỉ cần cho chức năng nhập dữ liệu tham khảo.

## Tài khoản và phiên đăng nhập

Đăng ký công khai (`POST /api/auth/register`) chỉ tạo `CUSTOMER`. API `POST /api/auth/login` trả cookie phiên `HttpOnly`, `SameSite=Lax`; `GET /api/auth/me` kiểm tra phiên, `PATCH /api/auth/me` cập nhật tên/số điện thoại, `POST /api/auth/logout` hủy phiên. Mọi lệnh ghi vào `/api/auth/*`, `/api/admin/*`, `/api/airline/*` cần header `x-csrf-intent: 1`. Các phiên được lưu dưới dạng hash trong bảng `AuthSession`, hết hạn sau 7 ngày. Khóa tài khoản hoặc hãng sẽ khiến phiên hiện có không truy cập được API.

Tạo tài khoản quản trị hoặc nhân viên bằng CLI, không đặt mật khẩu mặc định trong code. Ví dụ PowerShell từ thư mục `server`:

```powershell
$env:BOOTSTRAP_USER_NAME = 'Quản trị viên'
$env:BOOTSTRAP_USER_EMAIL = 'admin@example.com'
$env:BOOTSTRAP_USER_PASSWORD = '<mật khẩu riêng ít nhất 10 ký tự>'
$env:BOOTSTRAP_USER_ROLE = 'ADMIN'
npm.cmd run create-user
```

Nhân viên hãng dùng role `AIRLINE_FLIGHT_MANAGER` hoặc `AIRLINE_SALES_MANAGER` và thêm `BOOTSTRAP_AIRLINE_ID` là ID hãng đã tạo. Một email đã tồn tại sẽ bị từ chối; CLI không ghi đè quyền hay mật khẩu. Xóa các biến môi trường tạm sau khi tạo tài khoản.

`/api/admin/*` chỉ chấp nhận `ADMIN`. `GET /api/airline/managed-flights` dành cho nhân viên hãng và chỉ trả chuyến của hãng trong phiên. `POST /api/airline/managed-flights` chỉ dành cho `AIRLINE_FLIGHT_MANAGER`; `airlineId` trong request bị bỏ qua. `ADMIN_API_TOKEN` và token gắn tự động trong Vite proxy đã bỏ.

Trang admin đọc dữ liệu thật qua `GET /api/admin/overview`, `GET /api/admin/read/options`, `GET /api/admin/read/:kind` và `GET /api/admin/read/:kind/:id`. `kind` gồm `airlines`, `users`, `flights`, `bookings`, `payments`, `audit-logs`. Danh sách hỗ trợ `page`, `pageSize`, `search`, `sort`, `direction` và các bộ lọc theo từng trang; server giới hạn tối đa 100 dòng/trang. API tài khoản không trả `passwordHash`, booking che số điện thoại và giấy tờ hành khách. Booking khách không đăng nhập vẫn được phép; booking mới của khách đã đăng nhập có `userId`.

## Can thiệp admin (bước 7)

`POST /api/admin/interventions` yêu cầu cookie admin, `x-csrf-intent: 1`, `Idempotency-Key` là UUID duy nhất cho một lần xác nhận và JSON `{ "action": "HIDE_FLIGHT", "entityId": 123, "reason": "Lý do ít nhất 10 ký tự" }`. Hành động hỗ trợ: `LOCK_AIRLINE`, `UNLOCK_AIRLINE`, `LOCK_USER`, `UNLOCK_USER`, `HIDE_FLIGHT`, `REOPEN_FLIGHT`, `CANCEL_BOOKING_EXCEPTION`, `MARK_PAYMENT_REVIEW`. Trả `201 { "status": "applied", "auditLogId": ... }` khi ghi mới; `200` với `already_processed` khi gửi lại cùng mã yêu cầu, hoặc `already_applied` khi trạng thái đích đã có. Lỗi dữ liệu trả 400, thiếu quyền 401/403, không thấy bản ghi 404, xung đột nghiệp vụ 409.

Mọi thay đổi và `AuditLog` nằm cùng transaction. Khóa tài khoản/hãng thu hồi phiên liên quan. Tạm ẩn chuyến không hủy booking cũ; mở bán lại đòi chuyến còn theo lịch, chưa khởi hành và hãng hoạt động. Hủy booking ngoại lệ hủy vé chưa sử dụng, giải phóng chỗ qua trạng thái booking và đánh dấu thanh toán `PAID` cần kiểm tra, không tự hoàn tiền. Các nút can thiệp trên giao diện dữ liệu thật đã được nối ở bước 8; panel tải lại chi tiết và danh sách sau thao tác. Kiểm thử database bằng `npm.cmd run test:admin-interventions` với dữ liệu thử được tạo và dọn riêng.
