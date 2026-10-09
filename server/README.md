# Server

Backend Express/Prisma dùng MySQL để lưu các lượt tìm kiếm, lựa chọn chuyến bay và từng chặng bay. Hiện có API admin để xem danh sách chuyến bay và nhập dữ liệu SerpApi có xác nhận.

## Chạy cục bộ

Tạo `server/.env` với `DATABASE_URL`, `SERPAPI_API_KEY` và `ADMIN_API_TOKEN`. Từ thư mục gốc chạy `npm run dev:server`; server chỉ lắng nghe tại `127.0.0.1:3001` nếu không đặt `PORT`.

Các endpoint admin yêu cầu `Authorization: Bearer <ADMIN_API_TOKEN>`. Xem [quy tắc import](../docs/admin-flight-import.md) để biết tham số và trạng thái phản hồi. Token này chỉ dùng cho phát triển cục bộ; cần thay bằng xác thực và phân quyền admin trước khi triển khai.

Script `src/import-flights.ts` vẫn hỗ trợ nhập một tuyến/ngày từ CLI, còn `src/import-batch.ts` hỗ trợ kiểm tra và nhập theo lô có giới hạn. Cả hai dùng dữ liệu trong schema Prisma hiện tại.
