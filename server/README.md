# Server

Thư mục backend và dữ liệu của dự án. Ở giai đoạn hiện tại, đây chỉ là khung thư mục; chưa có API, database schema hoặc dependency.

| Thư mục | Mục đích |
| --- | --- |
| `src/config/` | Đọc và kiểm tra cấu hình ứng dụng |
| `src/lib/` | Tiện ích dùng lại ở nhiều module |
| `src/middleware/` | Middleware dùng chung cho HTTP API |
| `src/modules/` | Các module nghiệp vụ như tài khoản, chuyến bay và booking |
| `prisma/` | Schema, migration và seed dữ liệu khi nhóm triển khai database |

Khi khởi tạo backend, thêm `server/package.json`, mã nguồn và hướng dẫn chạy thực tế tại đây.

Phạm vi chức năng và tiêu chí nghiệm thu: [Yêu cầu Backend](../docs/BACKEND_REQUIREMENTS.md).
