# Website Chợ Đồ Cũ

Đồ án nhóm 4 sinh viên, dùng ReactJS, Node.js, Express, Sequelize, MySQL và Docker. Website đóng vai trò nền tảng trung gian kết nối người mua, người bán và tài xế; người mua chuyển khoản trực tiếp cho người bán, còn website ghi nhận và đối soát hoa hồng.

## Yêu cầu máy

- Docker Desktop (Windows/macOS) hoặc Docker Engine có Docker Compose v2. Docker Desktop phải **đang mở** trước khi chạy lệnh.
- Git 2.23 trở lên.
- Nên dành tối thiểu 2 GB RAM và khoảng 5 GB dung lượng trống cho image Docker và MySQL.
- Các cổng **3306**, **3000** và **8081** đang trống.

## Chạy nhanh (máy mới)

```bash
git clone https://github.com/phamlam0375-cmd/WEB1-ChoDoCu.git
cd WEB1-ChoDoCu
docker compose up -d --build
```

Lần đầu mất vài phút để tải image, build frontend và khởi tạo MySQL. Khi khởi động, API tự chuẩn bị database:

1. Database còn trống và repo có `backend/data/snapshot.sql` thì nạp **dữ liệu chung của nhóm** từ file này.
2. Chạy các migration còn thiếu.
3. Vẫn chưa có dữ liệu thì nạp dữ liệu mẫu.

Các lần sau dữ liệu trên máy được giữ nguyên.

Kiểm tra đã chạy xong:

```bash
docker compose ps
curl http://localhost:8081/api/health
```

Kết quả có `"database":"connected"` là sẵn sàng.

| Địa chỉ | Nội dung |
|---|---|
| http://localhost:8081 | Website (bản build qua Nginx) |
| http://localhost:8081/admin | Trang quản trị |
| http://localhost:3000/api/health | API backend |

Theo dõi quá trình khởi động nếu cần: `docker compose logs -f api`.

### Tài khoản thử nghiệm

Đăng nhập, đăng ký và xác thực email dùng tài khoản thật. Bộ chọn **"Tài khoản thử nghiệm"** vẫn có thể dùng để kiểm tra riêng các trang quản trị và tài khoản demo: nhập mã tài khoản rồi bấm **Đổi**.

| Mã | Dùng để thử |
|---|---|
| 2 | Quản trị viên: mọi trang `/admin` |
| 1 | Người mua: báo cáo vi phạm, yêu cầu hoàn tiền đơn `/orders/9001/refund` |
| 3 | Người bán: phí và hoa hồng `/seller/fees` (khoản HH009001, HH009002) |
| 4, 8 | Hồ sơ đối tác đã xác thực ở tab Chờ duyệt (demo bấm Duyệt) |

## Tìm kiếm sản phẩm

Trang chủ tải tin đăng từ API; `frontend/src/data/mockProducts.js` cung cấp danh mục và catalog dự phòng. Tìm kiếm chạy cục bộ bằng JavaScript, không gọi dịch vụ tìm kiếm bên thứ ba và không cần cài thêm package. Từ khóa được chuẩn hóa tiếng Việt (có/không dấu), hỗ trợ một số viết tắt phổ biến như `dt`, `ip`, `mt`, `xm`, từ khóa tiếng Anh tương ứng như `phone`, `laptop`, `chair`, và dung sai lỗi gõ gần đúng. Tìm kiếm xét tên sản phẩm và tên danh mục, đồng thời yêu cầu mọi phần của truy vấn đều khớp để hạn chế kết quả không liên quan. Tối đa 8 từ khóa gần đây được lưu trong local storage của trình duyệt; có thể xóa ngay tại danh sách lịch sử. Lịch sử không đồng bộ giữa các máy hoặc trình duyệt.

## Chia sẻ dữ liệu giữa các máy

Dữ liệu nằm trong Docker trên từng máy, không tự đi theo Git. Muốn máy khác có đúng dữ liệu của mình:

**Máy có dữ liệu** xuất ra file rồi commit, push:

```bash
# Windows (Command Prompt hoặc PowerShell)
scripts\export-data.cmd
# macOS/Linux hoặc Git Bash
sh scripts/export-data.sh

git add backend/data/snapshot.sql
git commit -m "data: cập nhật dữ liệu chung"
git push
```

**Máy nhận** kéo code mới rồi tạo lại database để nạp file vừa push. Lệnh `down -v` **xóa dữ liệu đang có trên máy nhận**:

```bash
git pull
docker compose down -v
docker compose up -d --build
```

Ảnh người dùng tải lên (thư mục `backend/uploads/`) không nằm trong file dữ liệu; cần thì chép thư mục này sang máy kia.

## Cấu hình môi trường

Docker Compose development có sẵn giá trị mặc định cho database và JWT; không cần tạo file `.env` để chạy đăng ký, đăng nhập email/mật khẩu, xác thực OTP hoặc quên mật khẩu. OTP mặc định chỉ được in trong log API (development), không gửi email. Chạy:

```powershell
docker compose up -d --build
docker compose logs -f api
```

Tìm dòng `[OTP][development]` trong log rồi nhập mã trên trang xác thực. Không dùng chế độ ghi OTP vào log trong production. Muốn gửi email khi development, đặt `OTP_DELIVERY_MODE=email` và cấu hình SMTP; production luôn yêu cầu SMTP.

Muốn thay đổi cấu hình thì tạo `backend/.env` từ file mẫu:

```bash
# Windows
copy backend\.env.example backend\.env
# macOS/Linux
cp backend/.env.example backend/.env
```

- Khi chạy trong Docker, API luôn kết nối MySQL qua `mysql:3306`, không cần sửa `DB_HOST`/`DB_PORT`.
- Đặt `AUTO_SEED=false` trong `backend/.env` nếu không muốn tự nạp dữ liệu mẫu.
- Muốn gửi mã OTP thật qua email, điền `MAIL_USER` và `MAIL_PASS` trong `backend/.env` (Gmail cần App Password), rồi khởi động lại API.
- Không commit file `.env`.

### Đăng nhập bằng Google (tùy chọn)

Đăng nhập Google thật cần OAuth Client ID dạng Web application. Khi chưa cấu hình, Docker Compose development hiển thị nút **Đăng nhập Google thử nghiệm**; chức năng này chỉ tạo tài khoản giả với email kết thúc bằng `@example.test`, không xác minh hay đăng nhập thay cho Gmail thật. Tài khoản dùng chung database không thể bị chiếm qua nút thử nghiệm. Không dùng chức năng mock trong production.

Để thấy nút thử nghiệm sau khi lấy code mới, chạy lại `docker compose up -d --build nginx api` rồi mở http://localhost:8081. Nếu chạy Vite bằng `pnpm dev`, nút thử nghiệm tự hiện khi chưa đặt `VITE_GOOGLE_CLIENT_ID`. Nếu máy đã cấu hình Client ID, giao diện ưu tiên nút Google thật.

1. Trong Google Cloud Console, tạo OAuth Client ID cho ứng dụng web.
2. Thêm Authorized JavaScript origins `http://localhost:8081` và `http://localhost:5173`.
3. Tạo file `.env` ở thư mục gốc repo với nội dung:

   ```dotenv
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

4. Build lại API và website để áp dụng cấu hình:

   ```bash
   docker compose up -d --build api nginx
   ```

Khi chạy frontend bằng `pnpm dev` thay vì Docker, đặt cùng Client ID trong `frontend/.env.local` dưới tên `VITE_GOOGLE_CLIENT_ID`. Với Docker Compose, bước build website lấy `GOOGLE_CLIENT_ID` từ `.env` ở thư mục gốc; API lấy giá trị từ `.env` gốc hoặc `backend/.env` (nếu cả hai có thì `.env` gốc được ưu tiên). Cả frontend lẫn API phải dùng cùng Client ID, nếu không Google có thể cho chọn tài khoản nhưng API sẽ báo chưa cấu hình hoặc từ chối token. Nếu chạy backend ngoài Docker, đặt `GOOGLE_CLIENT_ID` trong `backend/.env`. Client ID là cấu hình công khai, không phải client secret. Ứng dụng chỉ nhận email/name/avatar và mã định danh đã được Google xác minh, không nhận mật khẩu Google.

Trước khi chuyển OAuth app sang chế độ production, cần triển khai website lên HTTPS domain do bạn sở hữu, xác minh domain trong Google Search Console, rồi khai báo URL trang chủ và đường dẫn `/privacy` trong Google Auth Platform → Branding. Trang chính sách này không thể thay thế việc triển khai domain công khai hoặc quy trình xác minh mà Google yêu cầu.

### Triển khai production trên VPS

Repo có cấu hình Docker Compose production cho VPS Linux. Cấu hình này chỉ công khai Caddy trên cổng 80/443; MySQL và API chỉ nằm trong mạng nội bộ Docker. Caddy tự cấp và gia hạn HTTPS sau khi domain trỏ tới VPS.

1. Tạo bản ghi DNS `A` cho domain trỏ tới IPv4 của VPS. Mở cổng TCP 80/443 trên firewall; giữ SSH được giới hạn theo nhu cầu.
2. Trên VPS, clone repo rồi sao chép `.env.production.example` thành `.env`. Điền domain, OAuth Client ID, mật khẩu cơ sở dữ liệu mạnh và riêng biệt, JWT secret ngẫu nhiên, cùng SMTP credentials. Với Gmail SMTP, dùng Google App Password, không dùng mật khẩu đăng nhập Gmail. Không commit hoặc gửi file `.env`.
3. Khởi động các dịch vụ:

   ```bash
   docker compose --env-file .env -f docker-compose.prod.yml config
   docker compose --env-file .env -f docker-compose.prod.yml up -d --build
   ```

   Lần đầu API chạy migration và không nạp dữ liệu mẫu. Dữ liệu MySQL và ảnh tải lên được giữ trong Docker volumes; cần thiết lập sao lưu các volume này trước khi dùng dữ liệu thật.
4. Kiểm tra `https://your-domain.com/` và `https://your-domain.com/privacy`. Trong Google Auth Platform, xác minh domain, thêm domain gốc vào Authorized domains, đặt URL trang chủ và trang quyền riêng tư ở Branding, thêm HTTPS origin vào OAuth client, rồi hoàn tất bước Publish/verification của Google.

## Phát triển giao diện (tự cập nhật khi sửa code)

Bản ở cổng 8081 là bản build sẵn. Khi sửa frontend, chạy thêm Vite (cần Node.js 20+ và pnpm):

```bash
cd frontend
pnpm install
pnpm dev
```

Mở http://localhost:5173. Vite tự chuyển `/api` sang backend ở cổng 3000. Sau khi sửa xong, build lại bản 8081 bằng `docker compose up -d --build nginx`.

### Tùy chỉnh màu giao diện bằng Sass

Khách truy cập có thể chọn màu chủ đạo từ nút **Màu giao diện** trên thanh đầu trang (cả desktop và mobile). Lựa chọn được lưu trên trình duyệt hiện tại. Mặc định là xanh lá; ngoài ra có xanh dương, tím, hồng đỏ và cam. Các palette được khai báo trong `frontend/src/styles/_palette.scss`; Sass xuất CSS custom properties để đồng bộ màu với giao diện Tailwind. Khi chạy `pnpm dev`, Vite cập nhật thay đổi trực tiếp; để áp dụng cho bản build, chạy `pnpm build`.

Backend trong Docker tự khởi động lại khi sửa file trong `backend/` (nodemon).

## Các lệnh cơ sở dữ liệu

Chạy trong container API: `docker compose exec api pnpm run <lệnh>`.

| Lệnh | Mục đích |
|---|---|
| `db:prepare` | Chạy migration và nạp dữ liệu mẫu nếu database trống (tự chạy khi API khởi động) |
| `db:migrate` | Chạy các migration còn thiếu |
| `db:migrate:undo` | Gỡ toàn bộ migration |
| `db:seed` | Nạp dữ liệu mẫu (chỉ chạy được khi database trống) |
| `db:seed:undo` | Xóa dữ liệu mẫu |
| `db:verify` | Đếm số dòng từng bảng và báo PASS/FAIL theo mức 100.001 dòng |
| `check` | Kiểm tra cú pháp, migration 22 bảng và danh sách 40 branch |

Dữ liệu mẫu hiện tạo **10–20 dòng mỗi bảng** (`SEED_RECORDS_PER_TABLE`, giới hạn trong seeder), nên `db:verify` sẽ báo FAIL so với mức 100.001 dòng.

Làm lại dữ liệu từ đầu (xóa toàn bộ database):

```bash
docker compose down -v
docker compose up -d --build
```

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Lệnh `docker` báo `error during connect` hoặc không kết nối được | Mở Docker Desktop, chờ trạng thái "running" rồi chạy lại |
| Báo cổng 3306/3000/8081 đang được dùng | Tắt MySQL hoặc chương trình đang dùng cổng đó, rồi chạy lại |
| Máy từng chạy bản cũ của dự án, trang báo lỗi hoặc thiếu bảng | `git pull` rồi `docker compose up -d --build`; vẫn lỗi thì `docker compose down -v` rồi chạy lại (xóa dữ liệu cũ trên máy đó) |
| Máy khác không thấy dữ liệu mới của mình | Làm theo mục "Chia sẻ dữ liệu giữa các máy" |
| Trang báo "Lỗi server" ngay sau khi khởi động | Chờ API chạy xong migration (xem `docker compose logs -f api`) |
| Trang quản trị chỉ hiện "Khu vực dành cho quản trị viên" | Nhập mã tài khoản 2 ở ô "Tài khoản thử nghiệm"; nếu dùng cổng 5173 thì khởi động lại `pnpm dev` |
| Sửa frontend nhưng cổng 8081 không đổi | Chạy `docker compose up -d --build nginx` |

## Phân hệ B: Quản trị và doanh thu

Phân hệ B gồm 12 chức năng B01–B12: quản trị viên quản lý tài khoản, kiểm duyệt nội dung, xử lý hoàn tiền, thu hoa hồng và theo dõi doanh thu. Toàn bộ API quản trị nằm dưới `/api/v1/admin/*` và **chỉ vai trò ADMIN** gọi được; API phía người mua và người bán nằm dưới `/api/v1/*` và chỉ cần đăng nhập.

### Cách mở thử

1. Chạy web theo mục [Chạy nhanh](#chạy-nhanh-máy-mới) rồi mở http://localhost:8081/admin.
2. Đăng nhập bằng tài khoản quản trị, hoặc dùng bộ chọn **Tài khoản thử nghiệm** với mã `2` (xem bảng [Tài khoản thử nghiệm](#tài-khoản-thử-nghiệm)).
3. Menu bên trái có các trang B01–B12 như bảng dưới. Số cạnh menu là việc đang chờ xử lý (hồ sơ chờ duyệt, tin chờ duyệt, báo cáo mở, hoàn tiền chờ xử lý, hoa hồng quá hạn, phí chờ đối soát).

### Danh sách chức năng

| Mã | Chức năng | Trang giao diện | API chính |
|---|---|---|---|
| B01 | Quản lý tài khoản và phân quyền: xem, khóa/mở khóa, gán vai trò USER, ADMIN, SELLER, DRIVER | `/admin/users` | `GET/PATCH /admin/users/:id` |
| B02 | Duyệt đăng ký đối tác: duyệt, từ chối hoặc yêu cầu bổ sung hồ sơ, xem ảnh giấy tờ | `/admin/partner-applications` | `GET/PATCH /admin/partner-applications/:id` |
| B03 | Quản lý danh mục và lựa chọn tình trạng sản phẩm | `/admin/categories` | `/admin/categories`, `/admin/conditions` |
| B04 | Tiếp nhận báo cáo vi phạm (người dùng gửi, admin tiếp nhận) | `/reports`, `/reports/new`, `/admin/reports` | `POST /reports`, `GET /admin/reports` |
| B05 | Kiểm duyệt tin: duyệt, từ chối, ẩn, gỡ, khôi phục; có gợi ý của AI | `/admin/listings` | `PATCH /admin/listings/:id/review`, `POST /admin/listings/:id/ai-review` |
| B06 | Gửi và tiếp nhận yêu cầu hoàn tiền | `/orders/:id/refund`, `/refunds`, `/admin/refunds` | `POST /orders/:id/refund-requests` |
| B07 | Giải quyết hoàn tiền (admin, người bán, người mua) | `/admin/refunds` | `PATCH /refund-requests/:id` |
| B08 | Hoa hồng theo đơn | `/admin/commissions`, `/seller/fees` | `GET /admin/commissions`, `GET /seller/commissions` |
| B09 | Thu và đối soát phí | `/admin/fee-payments`, `/seller/fees` | `PATCH /admin/fee-payments/:id`, `POST /seller/fee-payments` |
| B10 | Thống kê doanh thu và hoạt động | `/admin` | `GET /admin/statistics` |
| B11 | Nhật ký thao tác quản trị (chỉ đọc, có xuất file) | `/admin/audit-logs` | `GET /admin/audit-logs`, `/audit-logs/export` |
| B12 | Cấu hình quy tắc hệ thống | `/admin/settings` | `GET/PUT /admin/settings` |

### Quy tắc nghiệp vụ chính

**Báo cáo vi phạm (B04, B05).** Trạng thái đi từ `PENDING` (chờ) sang `PROCESSING` (đang xử lý), rồi kết thúc ở `RESOLVED` (có vi phạm) hoặc `REJECTED` (không vi phạm). Khi kết luận có vi phạm, admin có thể ẩn hoặc gỡ tin bị báo cáo và khóa người dùng; bắt buộc nhập lý do.

**Kiểm duyệt tin (B05).** Tin `PENDING` có thể được duyệt hoặc từ chối. Tin đang hiển thị có thể bị ẩn hoặc gỡ; tin bị đình chỉ có thể khôi phục. Từ chối, ẩn và gỡ đều bắt buộc có lý do và người bán nhận thông báo.

**Hoàn tiền (B06, B07).** Chỉ đơn đã thanh toán và còn trong hạn hoàn tiền (cấu hình `REFUND_WINDOW_DAYS`, mặc định 7 ngày sau khi hoàn tất) mới gửi được yêu cầu, và mỗi đơn chỉ có một yêu cầu đang mở. Các bước xử lý:

| Bước | Ai làm | Từ trạng thái | Sang trạng thái |
|---|---|---|---|
| Tiếp nhận | Admin | `PENDING` | `REVIEWING` |
| Chấp nhận (có thể sửa số tiền hoàn) | Admin | `PENDING`, `REVIEWING`, `DISPUTED` | `APPROVED` |
| Từ chối (bắt buộc lý do, trả đơn về trạng thái cũ) | Admin | `PENDING`, `REVIEWING`, `DISPUTED` | `REJECTED` |
| Người bán chuyển trả tiền (mã giao dịch hoặc ảnh chuyển khoản) | Người bán | `APPROVED` | `SELLER_TRANSFERRED` |
| Người mua xác nhận đã nhận | Người mua | `SELLER_TRANSFERRED` | `COMPLETED` |
| Người mua báo chưa nhận được | Người mua | `SELLER_TRANSFERRED` | `DISPUTED` |
| Admin xác nhận hoàn tất khi tranh chấp | Admin | `SELLER_TRANSFERRED`, `DISPUTED` | `COMPLETED` |

Khi hoàn tiền xong, đơn chuyển sang `REFUNDED` và hoa hồng của đơn được giảm theo tỷ lệ tiền hoàn trên giá sản phẩm.

**Hoa hồng (B08).** Khi đơn hoàn tất, hệ thống ghi đúng một khoản hoa hồng cho đơn đó: `giá sản phẩm x tỷ lệ`, làm tròn về đồng. Tỷ lệ được chốt trên từng đơn lúc đặt, nên đổi cấu hình sau đó không ảnh hưởng đơn cũ. Mã nội dung chuyển khoản có dạng `HH` cộng mã đơn đủ 6 chữ số (ví dụ `HH000007`). Hoa hồng bằng 0 đồng được ghi là `WAIVED`. Khi hoàn tiền, khoản chưa thu được giảm tương ứng; khoản đã thu (`PAID`) hoặc đã miễn (`WAIVED`) không tự sửa mà để ghi chú cho admin đối soát tay. API `POST /admin/commissions/sync` tạo hoa hồng còn thiếu cho các đơn đã hoàn tất (trang quản trị không có nút gọi API này), nút **Nhắc các khoản quá hạn** gửi nhắc cho người bán có khoản quá hạn.

**Thu và đối soát phí (B09).**

| Trạng thái | Ý nghĩa |
|---|---|
| `UNPAID` | Người bán còn nợ |
| `ADJUSTED` | Còn nợ sau khi điều chỉnh do hoàn tiền |
| `REPORTED` | Người bán đã báo nộp, chờ admin đối soát |
| `PAID` | Admin đã xác nhận thu |
| `WAIVED` | Được miễn |

Người bán báo nộp tối đa 50 khoản mỗi lần; số tiền phải khớp đúng tổng các khoản đã chọn và chỉ báo nộp được khoản của chính mình. Admin xác nhận đã thu, từ chối (khoản quay lại còn nợ, bắt buộc lý do) hoặc miễn (bắt buộc lý do), có thể xác nhận hàng loạt. Hệ thống tính tổng nợ của người bán và đánh dấu `overLimit` khi khoản chưa báo nộp vượt `SELLER_DEBT_LIMIT` (khoản đã báo nộp, đang chờ đối soát, không bị tính). Thông tin này hiện ở trang phí của người bán và hồ sơ người dùng. Hàm `isSellerOverDebtLimit` để phần đăng tin (C) chặn người bán nợ quá ngưỡng đã có sẵn nhưng **chưa được nơi nào gọi**, nên hiện chưa tự chặn đăng tin.

**Thống kê (B10).** Mặc định 30 ngày gần nhất, chọn được khoảng ngày. Gồm số đơn hoàn tất và bị hủy, tổng giá trị đơn, hoa hồng phải thu và đã thu, phí tin VIP, tiền hoàn, người dùng và tin đăng mới. Doanh thu bằng hoa hồng đã thu cộng phí tin VIP.

**Nhật ký thao tác (B11).** Các thao tác quan trọng của admin (duyệt, từ chối, hoàn tiền, đối soát, danh mục, hoa hồng...) được ghi cùng giá trị cũ, giá trị mới và ghi chú. Trang này chỉ đọc, xuất được file CSV, không có API sửa hay xóa nhật ký.

**Cấu hình quy tắc (B12).**

| Khóa | Ý nghĩa | Mặc định |
|---|---|---|
| `COMMISSION_RATE` | Tỷ lệ hoa hồng (%) | 5 |
| `COMMISSION_DUE_DAYS` | Số ngày hạn nộp hoa hồng | 7 |
| `SELLER_DEBT_LIMIT` | Ngưỡng nợ phí của người bán (đồng) | 5.000.000 |
| `VIP_FEE` | Phí tin VIP (đồng) | 40.000 |
| `RESERVATION_HOURS` | Thời gian giữ món (giờ) | 24 |
| `REFUND_WINDOW_DAYS` | Hạn yêu cầu hoàn tiền (ngày) | 7 |
| `FEE_BANK_CODE`, `FEE_BANK_ACCOUNT_NUMBER`, `FEE_BANK_ACCOUNT_HOLDER` | Tài khoản ngân hàng nhận phí (hiện mã QR cho người bán) | Dữ liệu minh họa |

### Kiểm thử phần B

Test chạy không cần MySQL (dùng model giả):

```bash
cd backend
node --test tests/b05.listingAiReview.test.js tests/b07.refundCommission.test.js tests/b08.commission.test.js tests/b09.feePayment.test.js
```

| File | Kiểm tra |
|---|---|
| `b05.listingAiReview.test.js` | Gợi ý kiểm duyệt tin của AI |
| `b07.refundCommission.test.js` | Điều chỉnh hoa hồng khi hoàn tiền |
| `b08.commission.test.js` | Tính hoa hồng, hạn nộp, tổng nợ và hạn mức nợ |
| `b09.feePayment.test.js` | Người bán báo nộp phí, admin đối soát |

Phần B đã được quét bằng OWASP ZAP trên bản chạy local: trang web và API quản trị không còn cảnh báo mức High, Medium hay Low. Quét bằng tài khoản quản trị cần header thử nghiệm `x-user-id` (xem bên dưới).

### Lưu ý khi chạy và nộp

- Đăng nhập bằng mã tài khoản thử nghiệm dùng header `x-user-id`, chỉ hoạt động khi `NODE_ENV` khác `production` và `AUTH_DEV_HEADER` khác `false`. Khi triển khai thật phải đặt `NODE_ENV=production`, nếu không ai cũng có thể giả làm quản trị viên chỉ bằng một header.
- Lệnh `POST /admin/commissions/sync` và `POST /admin/commissions/remind-overdue` thay đổi dữ liệu thật; chỉ chạy khi cần.
- Tính năng duyệt tin bằng AI cần khóa API AI trong `.env`; không có khóa thì chỉ phần AI không chạy, các chức năng khác vẫn dùng bình thường.

## Cơ sở dữ liệu

22 bảng chính theo phần Database và ERD của báo cáo:

`Users`, `Roles`, `UserRoles`, `VerificationCodes`, `PartnerApplications`, `Stores`, `Categories`, `Listings`, `ListingMedia`, `Favorites`, `ListingPromotions`, `Orders`, `Payments`, `RefundRequests`, `Commissions`, `Deliveries`, `StatusHistories`, `Conversations`, `Messages`, `Reviews`, `Reports`, `Notifications`.

Phân hệ quản trị và doanh thu bổ sung: `AdminAuditLogs` (nhật ký thao tác), `SystemSettings` (cấu hình quy tắc), `ConditionOptions` (lựa chọn tình trạng sản phẩm).

## Cấu trúc thư mục

```text
WEB1-ChoDoCu/
├── backend/            # Express API, Sequelize
│   ├── config/         # Cấu hình kết nối MySQL
│   ├── migrations/     # Tạo bảng
│   ├── seeders/        # Dữ liệu mẫu
│   ├── data/           # snapshot.sql: dữ liệu chung của nhóm
│   ├── scripts/        # prepare-db, kiểm tra dữ liệu, kiểm tra cú pháp
│   ├── src/            # routes, controllers, models, services, middlewares
│   └── docs/           # Phân công branch, hướng dẫn GitHub, báo cáo
├── frontend/           # ReactJS (Vite, Tailwind)
├── nginx/              # Build frontend và chuyển /api sang backend
├── scripts/            # export-data: xuất dữ liệu ra backend/data/snapshot.sql
├── .github/workflows/  # CI (kiểm tra) và CD (triển khai)
└── docker-compose.yml
```

## Quy trình Git

- Mỗi chức năng có một branch riêng `feature/...` (danh sách trong [backend/docs/BRANCHES.md](backend/docs/BRANCHES.md)).
- Chỉ code đúng chức năng được giao trên branch đó.
- Tạo Pull Request vào `master`; CI phải qua trước khi merge.
- Sau khi merge vào `master`, CD tự triển khai bằng Docker và chạy migration.

## Lưu ý an toàn

- Dữ liệu mẫu, địa chỉ Google Maps, tài khoản ngân hàng, mã QR và ảnh giấy tờ đều là dữ liệu minh họa.
- Không commit file `.env`, khóa AI, mật khẩu thật hoặc thông tin CCCD thật.
- Mỗi thành viên tự giữ API key AI trong `.env` cá nhân; chỉ commit tên biến vào `.env.example`.
- Chuyển khoản trong lúc demo nên dùng nội dung/dữ liệu thử nghiệm, không dùng tiền thật.
