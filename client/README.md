# Trang quản trị chuyến bay

Ứng dụng React/Vite hiển thị các lựa chọn chuyến bay đã lưu trong MySQL. Trang có bộ lọc tuyến, ngày bay, trạng thái dữ liệu; chi tiết các chặng; và hộp thoại kiểm tra/xác nhận trước khi nhập dữ liệu từ SerpApi.

## Chạy cục bộ

1. Cấu hình `DATABASE_URL`, `SERPAPI_API_KEY` và `ADMIN_API_TOKEN` trong `server/.env`.
2. Chạy API bằng `npm run dev:server` từ thư mục gốc.
3. Chạy giao diện bằng `npm run dev:client`; mở `http://127.0.0.1:5173`.

Vite dev server đọc `ADMIN_API_TOKEN` ở phía Node và gắn vào request proxy `/api`. Token không nằm trong bundle React. Có thể đặt token trong biến môi trường của tiến trình Vite thay cho `server/.env`. Cách này chỉ dành cho phát triển cục bộ; môi trường triển khai cần đăng nhập và phân quyền admin thật.

`npm run build:client` tạo bản build trong `client/dist`. Bản build cần một backend phục vụ `/api/admin/*` có xác thực phù hợp.
