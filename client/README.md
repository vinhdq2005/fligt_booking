# Frontend Flight Booking

Ứng dụng React/Vite có luồng khách hàng và khung trang admin. Các màn hình admin mới (`/admin`, `/admin/airlines`, `/admin/users`, `/admin/flights`, `/admin/bookings`, `/admin/payments`, `/admin/audit-logs`) hiện dùng dữ liệu mẫu để duyệt giao diện. Tìm kiếm, bộ lọc, sắp xếp, phân trang và panel chi tiết hoạt động trên dữ liệu mẫu ở trình duyệt. Danh sách SerpApi hiện có được đặt tại `/admin/reference-flights`; trang này vẫn gọi API và cần backend để nhập hoặc xem dữ liệu thật.

## Chạy cục bộ

1. Cấu hình `DATABASE_URL`, `SERPAPI_API_KEY` và `ADMIN_API_TOKEN` trong `server/.env`.
2. Chạy API bằng `npm run dev:server` từ thư mục gốc.
3. Chạy giao diện bằng `npm run dev:client`; trang khách ở `/` và trang quản trị ở `/admin`.

Vite dev server đọc `ADMIN_API_TOKEN` ở phía Node và gắn vào request proxy `/api`. Token không nằm trong bundle React. Có thể đặt token trong biến môi trường của tiến trình Vite thay cho `server/.env`. Cách này chỉ dành cho phát triển cục bộ. Các route admin mới hiện chưa có đăng nhập/phân quyền thật; dữ liệu mẫu không chứa dữ liệu sản xuất.

`npm run build:client` tạo bản build trong `client/dist`. Bản build cần một backend phục vụ `/api/admin/*` có xác thực phù hợp.

Quy tắc đặt file, đặt tên và sử dụng dữ liệu mẫu: [Hướng dẫn Frontend](../docs/FRONTEND_GUIDE.md).

Phạm vi và thứ tự triển khai: [Đặc tả trang Admin](../docs/admin-spec.md).
