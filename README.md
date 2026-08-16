# Sao Mai Borrowed Items Manager

Website nội bộ quản lý công cụ/đồ dùng khách mượn tại Sao Mai Phu My Resort.

## Bộ phận
- F&B
- Housekeeping
- Lễ tân

## Chức năng
- Tạo phiếu mượn theo tên khách + phòng + đồ/công cụ + số lượng.
- Upload 01 ảnh nhận diện đồ mượn, tối đa 5MB (JPG/PNG/WEBP/GIF), lưu trong Cloudflare R2.
- Tạo phiếu xác nhận và in A4 bằng 4 ngôn ngữ: Việt / Anh / Trung / Hàn.
- Theo dõi trả từng món / trả hết / mất / hỏng.
- Tìm kiếm theo tên khách, phòng, đồ mượn hoặc mã phiếu.
- Kiểm tra trước checkout cả 3 bộ phận để biết phòng còn đồ chưa thu hồi.
- PIN quản lý dùng biến Cloudflare `ADMIN_PIN` (nếu chưa khai báo, mặc định `1000`).

## Cloudflare bindings
- D1: `DB` -> `saomai-borrowed-items-db`
- R2: `IMAGES` -> `saomai-borrowed-items-images`
- Static assets: `ASSETS`

Các binding đã được khai báo trong `wrangler.jsonc` để giữ nguyên khi deploy bằng Wrangler.

## Database
Chạy `schema.sql` cho database mới. Với database hiện có, Worker sẽ tự tạo bảng `loan_images` khi cần, vì vậy không bắt buộc chạy migration thủ công để bắt đầu sử dụng ảnh.

Ảnh thật được lưu trong R2; D1 chỉ lưu metadata và object key.

## V2.2 - Danh mục đồ mượn động đa ngôn ngữ
- Ô Đồ / công cụ khách mượn dùng danh mục lưu trong D1.
- Nút + Thêm đồ mới cho phép nhập tên VI / EN / 中文 / 한국어 và lưu để dùng lại.
- Quản lý có thể sửa/xóa danh mục ngay trên web bằng PIN.
- Phiếu in tự dùng bản dịch của món đồ theo ngôn ngữ đã chọn.
- Bảng `item_catalog` được Worker tự tạo và seed danh mục mặc định nếu chưa có dữ liệu.


## Workers AI tự động dịch
`wrangler.jsonc` đã cấu hình AI binding `AI`. Khi thêm đồ mới, Worker dùng Workers AI để dịch tên tiếng Việt sang English, Simplified Chinese và Korean.
