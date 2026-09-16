# Backend Website Chợ Đồ Cũ

Dự án khởi tạo cho nhóm 4 sinh viên, dùng Node.js, Express, Sequelize, MySQL và Docker. Website đóng vai trò nền tảng trung gian kết nối người mua, người bán và tài xế; người mua chuyển khoản trực tiếp cho người bán, còn website ghi nhận và đối soát hoa hồng.

## Kết quả đã chuẩn bị

- Migration tạo đủ 22 bảng đúng với phần Database và ERD của báo cáo.
- Seeder tạo tối thiểu **100.001 bản ghi cho mỗi bảng** theo từng lô.
- Tổng dữ liệu mặc định: **2.200.022 bản ghi**.
- Lệnh tự kiểm tra số dòng của toàn bộ bảng.
- Docker Compose chạy API và MySQL 8.4.
- Git có `main`, `develop` và 40 branch tính năng, chia đều 10 chức năng/người.

## Yêu cầu máy

- Docker Desktop hoặc Docker Engine có Docker Compose.
- Nên dành tối thiểu 2 GB RAM và khoảng 5-8 GB dung lượng trống cho MySQL và image Docker.
- Git 2.23 trở lên.

## Chạy dự án

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
curl http://localhost:3000/api/health
```

Container API tự chạy migration khi khởi động. Tạo dữ liệu mẫu và kiểm tra yêu cầu 100.001 dòng/bảng:

```bash
docker compose exec api npm run db:seed
docker compose exec api npm run db:verify
```

Seeder sinh hơn 2,2 triệu bản ghi nên thời gian chạy phụ thuộc cấu hình máy. Không tắt Docker giữa chừng. Dữ liệu được chèn theo lô 5.000 dòng để giảm sử dụng bộ nhớ.

## Các lệnh cơ sở dữ liệu

| Lệnh | Mục đích |
|---|---|
| `npm run db:migrate` | Tạo 22 bảng bằng migration |
| `npm run db:migrate:undo` | Gỡ toàn bộ migration |
| `npm run db:seed` | Sinh tối thiểu 100.001 dòng/bảng |
| `npm run db:seed:undo` | Xóa dữ liệu do seeder tạo |
| `npm run db:verify` | Đếm từng bảng và báo PASS/FAIL |
| `npm run check` | Kiểm tra cú pháp, 22 bảng, seeder và 40 branch |

Nếu muốn tăng số dòng, sửa `SEED_RECORDS_PER_TABLE` trong `.env`. Giá trị thấp hơn 100.001 sẽ tự động được nâng lên 100.001.

## Danh sách 22 bảng

1. `Users`
2. `Roles`
3. `UserRoles`
4. `VerificationCodes`
5. `PartnerApplications`
6. `Stores`
7. `Categories`
8. `Listings`
9. `ListingMedia`
10. `Favorites`
11. `ListingPromotions`
12. `Orders`
13. `Payments`
14. `RefundRequests`
15. `Commissions`
16. `Deliveries`
17. `StatusHistories`
18. `Conversations`
19. `Messages`
20. `Reviews`
21. `Reports`
22. `Notifications`

Lưu ý: trong hệ thống thực tế, bảng vai trò hoặc danh mục thường chỉ có ít dữ liệu. Bản đồ án vẫn tạo 100.001 dòng cho mọi bảng để đáp ứng đúng tiêu chí môn học.

## Quy trình Git

```text
feature/... -> develop -> main
```

- Mỗi chức năng có một branch riêng.
- Chỉ code đúng chức năng được giao trên branch đó.
- Tạo Pull Request từ `feature/...` vào `develop`.
- Sau khi tích hợp và kiểm thử, tạo Pull Request từ `develop` vào `main`.
- Không push trực tiếp lên `main`.

Danh sách chi tiết nằm tại [docs/BRANCHES.md](docs/BRANCHES.md). Cách tạo repo GitHub, đẩy toàn bộ branch và mời thành viên nằm tại [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md).

## Cấu trúc chính

```text
cho-do-cu-backend/
├── config/                 # Cấu hình Sequelize
├── migrations/             # Migration tạo 22 bảng
├── seeders/                # Seeder hơn 2,2 triệu bản ghi
├── scripts/                # Kiểm tra dữ liệu và tạo branch
├── src/                    # Express API và health check
├── docs/                   # Phân công branch, hướng dẫn GitHub
├── Dockerfile
└── docker-compose.yml
```

## Lưu ý an toàn

- Dữ liệu seeder, địa chỉ Google Maps, tài khoản ngân hàng và QR đều là dữ liệu minh họa.
- Không commit file `.env`, khóa AI, mật khẩu thật hoặc thông tin CCCD thật.
- Mỗi thành viên tự giữ API key AI trong `.env` cá nhân; chỉ commit tên biến vào `.env.example`.
- Chuyển khoản trong lúc demo nên dùng nội dung/dữ liệu thử nghiệm, không đưa tiền thật vào bài kiểm thử tự động.
