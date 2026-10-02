# Website Chợ Đồ Cũ

Đồ án nhóm 4 sinh viên, dùng ReactJS, Node.js, Express, Sequelize, MySQL và Docker. Website đóng vai trò nền tảng trung gian kết nối người mua, người bán và tài xế; người mua chuyển khoản trực tiếp cho người bán, còn website ghi nhận và đối soát hoa hồng.

## Yêu cầu máy

- Docker Desktop (Windows/macOS) hoặc Docker Engine có Docker Compose 2.24 trở lên.
- Git 2.23 trở lên.
- Nên dành tối thiểu 2 GB RAM và khoảng 5 GB dung lượng trống cho image Docker và MySQL.
- Các cổng **3306**, **3000** và **8081** đang trống.

## Chạy nhanh (máy mới)

```bash
git clone https://github.com/phamlam0375-cmd/WEB1-ChoDoCu.git
cd WEB1-ChoDoCu
docker compose up -d --build
```

Lần đầu mất vài phút để tải image, build frontend và khởi tạo MySQL. Khi khởi động, API **tự chạy migration** và **tự nạp dữ liệu mẫu nếu database còn trống**; các lần sau dữ liệu được giữ nguyên.

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

Đăng nhập thật chưa hoàn thiện, nên các trang quản trị và tài khoản dùng ô **"Tài khoản thử nghiệm"** ở góc phải: nhập mã tài khoản rồi bấm **Đổi**.

| Mã | Dùng để thử |
|---|---|
| 2 | Quản trị viên: mọi trang `/admin` |
| 1 | Người mua: báo cáo vi phạm, yêu cầu hoàn tiền đơn `/orders/9001/refund` |
| 3 | Người bán: phí và hoa hồng `/seller/fees` (khoản HH009001, HH009002) |
| 4, 8 | Hồ sơ đối tác đã xác thực ở tab Chờ duyệt (demo bấm Duyệt) |

## Cấu hình (không bắt buộc)

Docker chạy được ngay không cần file cấu hình. Muốn đổi giá trị mặc định thì tạo `backend/.env` từ file mẫu:

```bash
# Windows
copy backend\.env.example backend\.env
# macOS/Linux
cp backend/.env.example backend/.env
```

- Khi chạy trong Docker, API luôn kết nối MySQL qua `mysql:3306`, không cần sửa `DB_HOST`/`DB_PORT`.
- Đặt `AUTO_SEED=false` trong `backend/.env` nếu không muốn tự nạp dữ liệu mẫu.
- Không commit file `.env`.

## Phát triển giao diện (tự cập nhật khi sửa code)

Bản ở cổng 8081 là bản build sẵn. Khi sửa frontend, chạy thêm Vite (cần Node.js 20+ và pnpm):

```bash
cd frontend
pnpm install
pnpm dev
```

Mở http://localhost:5173. Vite tự chuyển `/api` sang backend ở cổng 3000. Sau khi sửa xong, build lại bản 8081 bằng `docker compose up -d --build nginx`.

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
| Báo cổng 3306/3000/8081 đang được dùng | Tắt MySQL hoặc chương trình đang dùng cổng đó, rồi chạy lại |
| Trang báo "Lỗi server" ngay sau khi khởi động | Chờ API chạy xong migration (xem `docker compose logs -f api`) |
| Trang quản trị chỉ hiện "Khu vực dành cho quản trị viên" | Nhập mã tài khoản 2 ở ô "Tài khoản thử nghiệm"; nếu dùng cổng 5173 thì khởi động lại `pnpm dev` |
| Sửa frontend nhưng cổng 8081 không đổi | Chạy `docker compose up -d --build nginx` |

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
│   ├── scripts/        # prepare-db, kiểm tra dữ liệu, kiểm tra cú pháp
│   ├── src/            # routes, controllers, models, services, middlewares
│   └── docs/           # Phân công branch, hướng dẫn GitHub, báo cáo
├── frontend/           # ReactJS (Vite, Tailwind)
├── nginx/              # Build frontend và chuyển /api sang backend
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
