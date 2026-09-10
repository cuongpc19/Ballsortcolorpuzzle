# Ball Sort Puzzle – Color Game (bản HTML)

Bản dựng lại bằng HTML/CSS/JS thuần của game **Ball Sort Puzzle – Color Game**,
**dùng đúng level design gốc** trích từ file APK v5.4.0 kèm theo.

## Chạy

```bash
npm run dev          # http://localhost:5180
```

Không cần `npm install` — dev server là một file Node thuần, không phụ thuộc gì
([scripts/serve.mjs](scripts/serve.mjs)). Nó in luôn địa chỉ LAN để mở trên điện
thoại; trên Windows chạy `mo-firewall.bat` một lần để mở cổng.

Cũng mở thẳng `index.html` bằng trình duyệt được (không có bước build nào), chỉ
là bộ test cần chạy qua http.

## Các màn hình

| Màn | Có gì |
|---|---|
| **Home** | logo, thẻ tiến độ (đang ở màn nào, đã qua bao nhiêu, tổng sao), nút CHƠI, 4 nút phụ, đổi chế độ, ví xu |
| **Chọn màn** | lưới 60 ô mỗi trang, sao đã ăn trên từng ô, ô kế tiếp nổi bật, ô chưa tới thì khoá, ô nhảy nhanh tới màn bất kỳ |
| **Chơi** | bàn cờ, 4 booster, ví xu, nút tắt tiếng |
| **Hoàn thành màn** | sao và thưởng xu |
| **Quà mỗi ngày** | chuỗi 3 ngày, 100 → 150 → 250 xu, nhỡ một ngày là chuỗi reset |
| **Cửa hàng** | mua booster bằng xu |
| **Cài đặt** | âm thanh, nhạc nền, xoá tiến độ |

## Hướng dẫn ở màn 1

Người chơi mới vào màn 1 sẽ được dắt tay qua một nước đi: câu đầu nói mục tiêu,
rồi đèn rọi + bàn tay chỉ vào ống cần nhấc bi, rồi chuyển sang ống cần thả vào.
Trong lúc đó **chỉ ống đang được chỉ mới nhận chạm** — chạm chỗ khác chỉ rung
nhẹ chứ không làm lệch bài học khỏi thế cờ.

Hai ống được chỉ là do **solver tự tính** chứ không viết cứng, nên nếu dữ liệu
màn 1 có đổi thì hướng dẫn vẫn đúng. Học xong (hoặc bấm *Bỏ qua hướng dẫn*) thì
ghi vào `bsp_tutor` và không bao giờ hiện lại. Thẻ quà ngày cũng bị chặn không
cho bật đè lên bài học.

## Độ khó động (DDA)

Bộ màn cổ điển chỉ dốc lên trong ~30 màn đầu rồi **phẳng lì suốt 15.000 màn**:
từ màn 101 trở đi chỉ còn 9 màu và 12 màu đảo qua đảo lại, par trung bình đứng
yên ở 32.9 từ khối 1.000 tới khối 15.000. Không phải họ làm ẩu — độ khó của bản
gốc **không nằm ở danh sách màn**, mà ở một hệ thống chạy lúc runtime
(`DynamicLevelMgr`) chọn màn theo phong độ người chơi, đọc cấu hình từ server.

Bản này dựng lại đúng hình dạng đó:

| Bản gốc | Ở đây |
|---|---|
| `DynamicScore` | điểm 10–90, bắt đầu 50 |
| `undo_score` / `addtube_score` / `replay_score` | −1 / −6 / −8 |
| `OnDynamicGameWin` | so số bước với par: +8 / +4 / 0 / −4 |
| `dda_range1` / `dda_range2` + `min/max_performance_score` | hai nhóm, ngưỡng 45 và 55, có vùng đệm |
| `dda_levelpool` (tải từ server) | 7.500 màn 9 màu + 7.500 màn 12 màu có sẵn |
| `dda_start_level` | bật từ màn 101 |
| `DynamicLastRefreshLevel` | tính lại nhóm mỗi 3 màn |

Ba điểm đáng nói:

**Chấm điểm một lần mỗi màn, lúc thắng.** Bản đầu tôi cộng/trừ ngay theo từng
thao tác, và mô phỏng cho thấy *ai cũng leo lên trần* — vì thắng thì luôn được
cộng, mà rồi ai cũng thắng. Cái phân biệt người chơi không phải việc họ qua màn,
mà là qua màn tốn bao nhiêu.

**Có lực kéo về giữa** (`DECAY`). Không có nó thì điểm là một bộ tích phân
thuần: bất kỳ thói quen ổn định nào cũng đẩy nó vào biên rồi dính ở đó, và người
vừa tiến bộ phải chơi hay bốn chục màn mới thấy khác. Có nó thì điểm đậu ở mức
tương xứng với phong độ, và đổi phong độ thì hệ thống trả lời trong 3–4 màn.

**Mỗi nhóm có một con trỏ riêng** chạy tới trong bể màn. Bản đầu tôi tìm màn
cùng nhóm trong một cửa sổ quanh vị trí hiện tại, và sau ~12 màn cùng nhóm liên
tiếp thì hết cửa sổ, nó **lặng lẽ trả về màn sai nhóm**. Con trỏ vừa đảm bảo
không màn nào bị phát hai lần, vừa không bao giờ hết chỗ.

Puzzle được **chốt ngay lần đầu mở màn** (`bsp_pick`) — nếu không thì kỷ lục và
số sao của bạn ở màn 777 sẽ thuộc về một puzzle khác mỗi lần vào.

Người chơi không thấy gì cả: không nút bật/tắt, không thông báo, không huy hiệu.
Số màn vẫn đếm đều. Chỉ khác *puzzle nào* nằm sau con số đó. 100 màn đầu không
bị đụng tới. `tests/sim.html` là bench để chỉnh các hằng số này.

## Booster — làm đúng theo APK gốc

Metadata IL2CPP của bản gốc nói rõ booster của họ hoạt động thế nào, và bản này
làm theo đúng hình dạng đó:

| Trong APK | Nghĩa | Ở đây |
|---|---|---|
| `UndoNumber`, `AddUndo`, `ReduceUndo` | hoàn tác là **số lượng sở hữu** | kho `undo`, khởi điểm 5 |
| `TubeCount`, `TubeBoosterCount` | ống phụ cũng là số lượng sở hữu | kho `tube`, khởi điểm 2 |
| `FreeAddTubeNum` + `UseFreeCount` | …cộng **suất miễn phí reset mỗi màn** | 1 ống miễn phí mỗi màn |
| `ClearHintNum`, `_maxHintLimit` | gợi ý có hạn mức mỗi màn | 1 gợi ý miễn phí mỗi màn, rồi kho 3 |
| `EventShopUndoCoinClick` / `…RVClick` | hết thì mua bằng **xu** hoặc xem quảng cáo | không có quảng cáo nên chỉ còn đường xu |

Nút booster đổi mặt theo trạng thái: còn suất miễn phí thì hiện **FREE** (xanh
lá), còn hàng trong kho thì hiện **số lượng**, hết sạch thì hiện **giá** (vàng)
và bấm vào sẽ mở cửa hàng chứ không âm thầm trừ xu.

Con số cụ thể (5/2/3, giá 30/60/45) là của bản này — bản gốc đọc từ remote config
(`DynamicUndoCount`, `DynamicAddTubeScore`…) nên không nằm trong APK.

## Kinh tế xu

- Thắng lần đầu một màn: **10 xu**, cộng **5 xu mỗi sao** trên sao thứ nhất → 10 / 15 / 20.
- Chơi lại màn cũ **không trả xu** (vẫn ăn sao và kỷ lục) — tránh biến nó thành máy in xu.
- Quà ngày: **100 / 150 / 250** xu.
- Ví khởi điểm: **300** xu.

## Kiểm thử

```bash
npm run dev
# rồi mở:
#   http://localhost:5180/tests/boosters.html   (50 test)
#   http://localhost:5180/tests/game.html       (41 test)
#   http://localhost:5180/tests/tutorial.html   (20 test)
#   http://localhost:5180/tests/dda.html        (49 test)
```

`tests/boosters.html` bám sát hợp đồng booster ở trên: suất miễn phí không trừ
kho, hết kho thì mở cửa hàng chứ không trừ xu, suất miễn phí reset khi sang màn
và khi bấm Chơi lại nhưng kho thì không, mua thiếu xu thì không nhận hàng.
`tests/game.html` chơi hết màn thật bằng solver rồi kiểm sao / xu / mở khoá /
kỷ lục / chọn màn / quà ngày / chế độ Khó. `tests/tutorial.html` kiểm bài hướng
dẫn: đúng thứ tự ba bước, đèn rọi đúng ống, chặn chạm sai, chạy đúng một lần,
nút Bỏ qua, và các màn khác thì không hiện.

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

- **Hoàn tác** (phím `Z`), **Chơi lại** (`R`), **Gợi ý** (`H`), **Tắt tiếng** (`M`), `Esc` đóng bảng / về Home.
- **Gợi ý** dùng solver DFS chạy ngay trong trình duyệt (đã kiểm thử 900 màn ngẫu nhiên, giải được 100%, chậm nhất ~70 ms).
- Tiến độ, sao, kỷ lục, ví xu và kho booster lưu trong `localStorage` (khoá `bsp_*`).

## Cấu trúc

```
index.html                 khung tất cả các màn hình
style.css                  nền động, ống 3D, pháo hoa, Home, lưới màn, popup
src/save.js                tiến độ, sao, ví xu, kho booster, quà ngày
src/board.js               luật chơi, dựng hình, âm thanh, hiệu ứng, solver
src/dda.js                 độ khó động - chọn puzzle theo phong độ
src/tutorial.js            bài hướng dẫn ở màn 1
src/ui.js                  router + Home / Chọn màn / Cửa hàng / Quà / Cài đặt
scripts/serve.mjs          dev server, không phụ thuộc gì
tests/boosters.html        50 test cho booster & cửa hàng
tests/game.html            41 test cho luồng chơi
tests/tutorial.html        20 test cho bài hướng dẫn
tests/dda.html             49 test cho độ khó động
tests/sim.html             bench chỉnh số cho DDA (không phải test)
data/levels-classic.js     15.100 màn cổ điển        (832 KB)
data/levels-hard.js         2.596 màn khó            (181 KB)
data/par-classic.js        số bước chuẩn, cổ điển     (30 KB)
data/par-hard.js           số bước chuẩn, chế độ khó   (5 KB)
```

File APK gốc và video quay màn hình **không nằm trong repo** (xem `.gitignore`):
chúng là tài liệu tham chiếu, nặng ~107 MB và không thuộc quyền phân phối của
dự án này. Muốn trích lại dữ liệu màn chơi thì cần tự có file APK.
