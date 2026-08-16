# Sao Mai Borrowed Items Manager

Website nội bộ quản lý công cụ/đồ dùng khách mượn tại Sao Mai Phu My Resort.

## 3 bộ phận
- F&B
- Housekeeping
- Lễ tân

## Điểm chính
- Tạo phiếu mượn theo tên khách + phòng + món + số lượng.
- Theo dõi trả từng món / trả hết / mất / hỏng.
- Tìm kiếm theo tên khách, phòng, đồ mượn hoặc mã phiếu.
- Ô **Kiểm tra trước checkout** tra cứu đồng thời cả 3 bộ phận để biết phòng còn đồ chưa thu hồi.
- PIN quản lý dùng biến Cloudflare `ADMIN_PIN` (nếu chưa khai báo, code mặc định 1000).

## Triển khai Cloudflare Pages
1. Tạo repository GitHub mới, ví dụ `sao-mai-borrowed-items`.
2. Upload toàn bộ nội dung thư mục này lên repository.
3. Cloudflare → D1 → Create database: `sao-mai-borrowed-items-db`.
4. Mở D1 Console và chạy toàn bộ `schema.sql`.
5. Tạo Cloudflare Pages từ GitHub repo.
   - Build command: để trống
   - Build output directory: `public`
6. Pages → Settings → Bindings → D1 database:
   - Variable name: `DB`
   - Database: `sao-mai-borrowed-items-db`
7. Settings → Variables and Secrets → tạo `ADMIN_PIN` = PIN quản lý mong muốn (ví dụ 1000).
8. Redeploy.

## Quy trình checkout đề xuất
Trước khi hoàn tất checkout: nhập số phòng tại **Kiểm tra trước checkout**. Chỉ khi hiện màu xanh “Không còn đồ chưa trả” mới hoàn tất quy trình, hoặc xử lý các món đang còn mở trước.
