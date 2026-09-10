# Ball Sort Puzzle – Color Game (bản HTML)

Bản dựng lại bằng HTML/CSS/JS thuần của game **Ball Sort Puzzle – Color Game**,
**dùng đúng level design gốc** trích từ file APK v5.4.0 kèm theo.

## Chạy

Mở thẳng `index.html` bằng trình duyệt (không cần server, không cần cài gì).

## Nguồn dữ liệu level

Level nằm trong các TextAsset của Unity ở `assets/bin/Data/` trong APK, dạng JSON
`{"stage_id":"lv_a_b","levels":[{"puzzle_id":..,"tubes":[[...]],"steps":[[from,to],..]}]}`.
Toàn bộ 35 stage đã được trích, ghép lại và nén vào `data/`:

| Chế độ | Số màn | Ống mỗi màn | Bóng / ống | Nguồn |
|---|---|---|---|---|
| Cổ điển | **15.100** (màn 1 → 15100, liên tục) | 2 → 14 | 4 | `lv_1_100` + `lv_101_600` + … + `lv_14601_15100` |
| Khó | **2.596** | 6 → 14 | 6 hoặc 8 | `lv_1_502` + `lv_503_2596` |

Cách mã hoá trong `data/*.js`: mỗi màn là một chuỗi, các ống ngăn bởi `-`,
mỗi ký tự là một màu (`1`–`9`, `a`–`c` = 10–12), đọc **từ đáy lên miệng ống**;
ống rỗng là đoạn trống. Riêng chế độ Khó, ký tự đầu chuỗi là số bóng mỗi ống.

Ví dụ màn 3 cổ điển: `1132-2132-3213--` → 5 ống, 3 ống có bóng + 2 ống rỗng.

## Cách chơi

- Bấm vào ống để nhấc bóng trên cùng (nhấc cả cụm cùng màu liền nhau).
- Bấm ống đích để thả. Chỉ thả được vào ống rỗng, hoặc ống có bóng trên cùng cùng màu và còn chỗ.
- Thắng khi mọi ống đều rỗng hoặc đầy một màu duy nhất.

## Cảm giác chơi (bám theo video gốc)

Quỹ đạo bóng được dựng lại đúng như trong video: **nhấc thẳng lên khỏi ống →
bay ngang ở độ cao trên miệng ống → rơi thẳng xuống ống đích** (không đi chéo).
Kèm theo:

- Squash & stretch theo hướng di chuyển: kéo ngang khi bay, kéo dọc khi rơi,
  bẹt xuống lúc chạm đáy rồi nảy nhẹ về hình cầu.
- Thời lượng bay tỉ lệ theo quãng đường (~250–400 ms), ba chặng chia theo đúng
  tỉ lệ khoảng cách nên tốc độ đều, không bị khựng.
- Ống đích nhún nhẹ khi bóng chạm; ống hoàn thành thì loạt bóng nảy lần lượt
  kèm vòng sáng.
- Vào màn: bóng rơi từ trên xuống theo thứ tự. Thắng màn: pháo giấy.
- Âm thanh WebAudio cho nhấc / thả / sai / xong ống / thắng, kèm rung trên máy
  hỗ trợ. Tôn trọng `prefers-reduced-motion`.

## Bố cục vừa màn điện thoại

Số hàng được chọn tự động (1–3) sao cho bi to nhất mà vẫn lọt màn, các ống chia
đều cho các hàng và **mỗi hàng căn giữa** — đo lại ảnh mẫu ở độ phân giải gốc
thì tâm cả hai hàng đều trùng tâm màn, nên cách này giống hệt bản gốc.

Khoảng cách lấy theo tỉ lệ đường kính bi: **cách ngang 0.68**, **cách hàng 0.70**,
lề hai bên **6% bề ngang**, và chừa đáy tối thiểu 3% chiều cao cho bóng đổ của
ống khỏi đè lên thanh công cụ. Ví dụ 7 ống (màn 5) trên điện thoại ra **4 trên,
3 dưới**; 14 ống ra **5–5–4** trên điện thoại và **7–7** trên màn rộng.

## Tạo hình 3D (theo ảnh App Store)

Ống là **thành nhựa trắng dày** dựng bằng CSS thuần: một vòng gradient được cắt
bằng `mask-composite: exclude` nên ánh sáng đổ từ trên-trái xuống dưới-phải,
trông như nhựa đúc chứ không phải một đường viền phẳng. Bên trong là mặt kính
mờ với vệt sáng dọc sát mép trái, viền trong tối một nét cho thấy độ dày kính,
cộng gờ nổi và bóng đổ mềm bên dưới. Trình duyệt không hỗ trợ `mask-composite`
thì tự rơi về đường viền trắng đặc — vẫn đẹp.

Bi là khối cầu có: gradient chính, chóa sáng lớn góc trên-trái, một chấm sáng
nhỏ đi kèm, đáy tối dần, **ánh hắt viền dưới** và bóng đổ riêng. Mọi thông số
đều tính theo đường kính bi (biến CSS `--d`) nên co giãn đúng ở mọi cỡ màn hình.
Ống đã xong một màu thì mờ đi; ống rỗng vẫn sáng vì còn là đích hợp lệ.

## Hiệu ứng & âm thanh

Tất cả âm thanh đều **tổng hợp bằng WebAudio ngay trong trình duyệt** — không có
file mp3/ogg nào, nên thư mục vẫn nhẹ và chạy offline.

**Nhấc bi lên:** tiếng "pop" kiểu bật nút chai (cao dần theo độ đầy của ống),
vòng sáng bung ra ở miệng ống, vài ngôi sao lấp lánh, bi sáng lên và **nhấp nhô
nhè nhẹ** trong lúc chờ, ống nhô lên một chút.

**Thả bi vào ống:** tiếng gió khi bi rời ống, tiếng "blop" nảy khi chạm đáy
(cao thấp theo vị trí trong ống), vòng sóng va chạm + vài hạt màu bắn ra,
ống nhún xuống, máy rung nhẹ.

**Ống đủ bi một màu:** nhạc nền hạ xuống nhường chỗ cho một tràng arpeggio vui
tai, ống lắc lư, hai vòng sáng lan rộng, 26 hạt màu + 9 ngôi sao bắn tung,
⭐ nhảy lên trên miệng ống, và loạt bi nảy lần lượt từ dưới lên. Xong liên tiếp
nhiều ống thì cao độ tăng dần kèm dòng chữ "Ngon! ×2", "Đỉnh! ×3"…

**Thắng màn:** "ta-daa" 5 nốt, 70 mảnh confetti rơi, tiêu đề đổi ngẫu nhiên.

**Nhạc nền:** một vòng lặp 4 nhịp vui nhộn ở 118 BPM (C – G – Am – F) gồm bass
nảy, hợp âm đệm, giai điệu kiểu marimba, kick và shaker — được lập lịch theo
đồng hồ WebAudio nên không lệch nhịp. Nút 🔊 trên thanh trên tắt/bật toàn bộ
(phím `M`); trong menu ☰ có công tắc riêng cho **Âm thanh** và **Nhạc nền**,
lựa chọn được ghi nhớ. Nhạc tự dừng khi chuyển tab.

## Đóng nắp, pháo hoa và màn hình hoàn thành

**Đủ bi thì đóng nắp.** Ống nào xếp đủ một màu sẽ có một chiếc nắp trắng rơi từ
trên xuống, bẹt ra khi chạm rồi nảy về hình dạng — kèm tiếng "cạch". Ống đóng
nắp thì mờ đi, riêng nắp vẫn sáng để nhìn ra ngay ống nào đã xong.

**Lâu mới xong một ống thì khen to.** Trò chơi đếm số bước và thời gian kể từ
lần hoàn thành ống gần nhất. Xong nhanh thì ăn mừng bình thường; phải vật lộn
7 bước / 13 giây trở lên thì thêm một quả pháo nổ ngay trên ống và một dòng chữ
lớn; từ 14 bước / 28 giây trở lên thì bắn hẳn 4 quả pháo hoa, hiện 🏆, một câu
khen cỡ lớn ("Kiên trì quá!", "Bá cháy!"…) và dòng nhắc "Sau N bước mới xong".

**Hết màn thì nổ hoành tráng hơn nữa:** 11 quả pháo hoa bay lên từ đáy màn hình
rồi nổ tung (có tiếng rít lúc bay và tiếng nổ trầm kèm tiếng lép bép), 70 mảnh
confetti, chữ "HOÀN THÀNH!" cỡ đại — rồi mới tới bảng kết quả.

## Bảng kết quả cuối màn

Thiết kế theo tinh thần các game ball-sort nhưng vẽ lại theo tông tối của game
này: quầng tia sáng xoay chậm phía sau, viền bo lớn, tiêu đề chữ gradient vàng.

- **Chấm sao 1–3** — sao nảy vào từng cái một, mỗi cái một nốt nhạc cao dần và
  một chùm tia vàng nổ quanh nó. Đủ 3 sao thì bắn thêm pháo và hiện "HOÀN HẢO!".
- **Chuẩn so sánh là số bước lời giải gốc của nhà phát triển**, trích thẳng từ
  mảng `steps` trong APK (`data/par-*.js`, 35 KB). 3 sao khi đi ≤ 110% số bước
  chuẩn, 2 sao khi ≤ 145%, còn lại 1 sao — nên điểm sao có ý nghĩa thật chứ
  không phải con số cho vui.
- **Bốn ô thống kê**: số bước · chuẩn · thời gian · kỷ lục của chính bạn ở màn
  đó (lưu trong `localStorage`), kèm huy hiệu "🏆 Kỷ lục mới!" khi phá kỷ lục.
- Nút **Màn tiếp** có vệt sáng chạy qua và hiệu ứng nhấn lún xuống.

## Chức năng

- **Hoàn tác** (phím `Z`), **Chơi lại** (`R`), **Gợi ý** (`H`), **Tắt tiếng** (`M`), `Esc` bỏ chọn.
- **Thêm ống**: tối đa 2 ống phụ mỗi màn.
- **Gợi ý** dùng solver DFS chạy ngay trong trình duyệt (đã kiểm thử 900 màn ngẫu nhiên, giải được 100%, chậm nhất ~70 ms).
- Chọn màn bất kỳ qua nút ☰; tiến độ lưu trong `localStorage`.

## Cấu trúc

```
index.html                 giao diện
style.css                  giao diện tối, ống 3D, pháo hoa, bảng kết quả
game.js                    luật chơi, dựng hình, âm thanh, hiệu ứng, solver
data/levels-classic.js     15.100 màn cổ điển        (832 KB)
data/levels-hard.js         2.596 màn khó            (181 KB)
data/par-classic.js        số bước chuẩn, cổ điển     (30 KB)
data/par-hard.js           số bước chuẩn, chế độ khó   (5 KB)
```

File APK gốc và video quay màn hình **không nằm trong repo** (xem `.gitignore`):
chúng là tài liệu tham chiếu, nặng ~107 MB và không thuộc quyền phân phối của
dự án này. Muốn trích lại dữ liệu màn chơi thì cần tự có file APK.
