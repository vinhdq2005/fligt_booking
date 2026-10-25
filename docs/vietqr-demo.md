# VietQR cho luồng thanh toán demo

Trang thanh toán tạo VietQR theo `Booking.totalAmount` đã chốt trong MySQL. QR dùng thông tin tài khoản nhận từ cấu hình server và nội dung `FB<bookingId>` để phân biệt các booking. QR không xác nhận giao dịch; hai nút mô phỏng thành công/thất bại vẫn hoạt động như trước.

## Cấu hình tài khoản nhận

Thêm ba dòng vào `server/.env` (không commit file này):

```dotenv
VIETQR_BANK_ID=MA_BIN_HOAC_MA_NGAN_HANG
VIETQR_ACCOUNT_NO=SO_TAI_KHOAN
VIETQR_ACCOUNT_NAME="TEN CHU TAI KHOAN"
```

- `VIETQR_BANK_ID`: mã BIN 6 chữ số hoặc mã ngân hàng được VietQR hỗ trợ. Có thể tra cứu tại [danh sách ngân hàng VietQR](https://www.vietqr.io/api-bank).
- `VIETQR_ACCOUNT_NO`: số tài khoản nhận tiền, tối đa 19 chữ hoặc số.
- `VIETQR_ACCOUNT_NAME`: tên chủ tài khoản hiển thị trên ảnh QR. Đối chiếu tên người nhận trong ứng dụng ngân hàng trước khi sử dụng.

Khởi động lại server sau khi sửa `.env`. Nếu chưa cấu hình, booking vẫn có thể được tạo nhưng giao diện báo VietQR chưa sẵn sàng; không hiển thị một QR giả có thể gây hiểu nhầm.

## Kiểm tra demo

1. Chọn chuyến và hành khách, mở trang thanh toán rồi bấm **Tạo QR thanh toán**.
2. Đối chiếu số tiền trên QR với tổng tiền của booking. Quét bằng ứng dụng ngân hàng để xem số tài khoản, người nhận, số tiền và nội dung `FB<bookingId>`.
3. **Không xác nhận chuyển khoản trong ứng dụng ngân hàng khi chỉ demo.** VietQR chứa thông tin chuyển khoản thật nếu cấu hình tài khoản thật.
4. Dùng nút **Mô phỏng thanh toán thành công/thất bại** trên website để trình diễn kết quả. Nút thành công không kiểm tra giao dịch ngân hàng.

Booking giữ chỗ 15 phút. Khi hết hạn, ảnh QR biến mất; bấm tải lại để tạo booking mới với giá được tính lại. QR đã được lưu hoặc chụp lại vẫn có thể được app ngân hàng đọc, nên không dùng ảnh đó để chuyển tiền sau khi hết hạn.

VietQR Quick Link được tạo theo [cú pháp chính thức](https://www.vietqr.io/qr-dong). Chức năng này chỉ dùng để trình diễn QR; hệ thống không tự xác nhận tiền vào tài khoản.
