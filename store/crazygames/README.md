# Ảnh bìa CrazyGames — Tube Tangle

Ba ảnh này dán thẳng vào Developer Portal, không cần sửa gì thêm. Tên file đã
mang sẵn kích thước, đúng thứ portal yêu cầu.

| file | cỡ | dùng ở đâu |
|---|---|---|
| `cover-1920x1080.png` | 1920×1080 | ảnh ngang, trang game / slot feature |
| `cover-800x1200.png` | 800×1200 | ảnh dọc, bản mobile |
| `cover-800x800.png` | 800×800 | thumbnail vuông trong lưới game — cái quan trọng nhất |

Cả ba đã kiểm: đúng kích thước tuyệt đối, không viền đen, không letterbox,
không con trỏ chuột, chữ "TUBE TANGLE" đúng chính tả, cùng một bảng màu và
cùng kiểu ánh sáng nên nhìn ra là một bộ.

**File gốc** do ChatGPT sinh ra nằm trong `Manythings/` (thư mục này bị
gitignore, không nằm trong repo). Ảnh ở đây là bản đã crop đúng tỉ lệ rồi mới
resize — không kéo giãn.

⚠ Thư mục `store/` **không** nằm trong bản build. `scripts/build-crazy.mjs`
dùng danh sách cho phép (`src`, `data`, `assets`, `public`), nên ảnh bìa không
bao giờ lọt vào `dist/` và không làm nặng bundle.

## Video preview

| file | cỡ | dài |
|---|---|---|
| `preview-landscape-1920x1080.mp4` | 1920×1080 | 18.00s |
| `preview-portrait-1080x1920.mp4` | 1080×1920 | 18.00s |

Cả hai cắt từ giây thứ 3 đến giây thứ 21 của bản ghi màn hình trong `Manythings/`.
H.264 high / yuv420p / 30fps / AAC 160k, có `faststart`.

- **Landscape** là bản ghi gốc cắt đúng đoạn, không crop — bản desktop vốn đã tràn hết khung 16:9.
- **Portrait** cắt lấy cột game ở giữa (700px) rồi phóng lên 1080 rộng; phần trên dưới còn trống
  được lấp bằng chính hình đó làm mờ và tối đi, không phải viền đen.

⚠ Đã kiểm: **không có viền đen** (mép khung vẫn mang màu nền thật, không phải 0,0,0),
**không có con trỏ chuột**, không dính thanh trình duyệt, và suốt 18 giây đều là gameplay
liền mạch — không menu, không bảng thắng.
