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

Danh sách và can thiệp của trang admin hiện vẫn dùng dữ liệu mẫu. Bước 6–8 sẽ nối API đọc, API can thiệp và nhật ký thật. Booking khách không đăng nhập vẫn được phép; booking mới của khách đã đăng nhập sẽ có `userId`. Booking cũ không được gán chủ sở hữu dựa trên email liên hệ.
