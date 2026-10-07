# Chẩn đoán backend thực sự phục vụ D01 — 07/10/2026

## Kết luận

Frontend Vite hiện ở cổng 5173 đang gọi API của **container CD cổng 3000**, không phải backend trong repository làm việc. Có hai lỗi đồng thời trong bản CD: thiếu route /api/v1/orders/preview/:listingId và AppError 404 không được error handler nhận diện nên thành HTTP 500.

Bản sửa được thực hiện trong repository làm việc, đã kiểm chứng bằng controller/service thật và database thật. **Không hot-patch checkout runner, không restart/recreate container, không build/deploy CD. Container CD đang phục vụ vẫn chưa nhận bản sửa.**

## Xác định môi trường bằng dữ liệu thực tế

- Repository làm việc: `C:\Chuyển đề WEB1\WEB1-ChoDoCu`, nhánh Lam/D01_fix, HEAD 6650383; có các thay đổi tích hợp đang stage từ lượt trước.
- Checkout CD sạch: `C:\Users\LAM\actions-runner\_work\WEB1-ChoDoCu\WEB1-ChoDoCu`, commit **9d9e966** (merge PR #42 C03-Listing).
- API đang chạy: **cho-do-cu-cd-api-1**, publish host 3000 → container 3000.
- Image thực tế: `sha256:6609ae196f68fe538550684a75f81c43ce976a42b6cebaf863a79c58076ba5cb`, Node 20.20.2.
- Bind mount /app: checkout runner nói trên, thư mục backend. /app/node_modules là anonymous volume riêng. Sửa backend trong repository làm việc không đổi /app của container này.
- Lệnh chạy container: pnpm run docker:dev → prepare-db rồi nodemon. Chỉnh source runner sẽ bị nodemon phát hiện và thay đổi bản CD đang chạy; không làm việc đó khi chưa có yêu cầu cho phép thay đổi môi trường live.
- Hash của app.js, memberB.route.js, AppError.js và middlewares/errorHandler.js trong image gốc khớp checkout runner. Source /app đọc từ container cũng khớp; đây không chỉ là suy đoán từ tên image.
- Compose labels xác nhận project cho-do-cu-cd và working_dir/config_files là checkout runner.
- Workflow CD checkout commit qua CI rồi chạy Compose với project cho-do-cu-cd trong checkout đó. Build Compose ở repository làm việc không tự cập nhật container/project CD.

| Nơi frontend chạy | Đường API thực tế | Backend thực tế |
| --- | --- | --- |
| Vite :5173 | client mặc định /api/v1; Vite proxy /api → localhost:3000 | cho-do-cu-cd-api-1 |
| Nginx :8081 | /api/ → api:3000 trong network cho-do-cu-cd_default | cùng container CD |
| Gọi trực tiếp :3000 | /api/v1/orders/preview/1 | cùng container CD |

Đã đọc module api.js do Vite đang phục vụ: baseURL /api/v1, không có override VITE_API_URL. Nginx -T trong container xác nhận cấu hình proxy thực tế.

## Tái hiện và nguyên nhân

Lúc **2026-10-07 08:01:58 UTC**, GET /api/v1/orders/preview/1?diagnostic=d01-route-check qua cổng 3000, 8081 và 5173 đều trả:

- HTTP 500, body success=false, message=Lỗi server.
- Log mới của CD có AppError tại /app/src/app.js:57, status=404, code=ROUTE_NOT_FOUND.
- Gọi ID 1, 7, 10 kèm header dev hiện có cũng vẫn 500, nên đây không phải lỗi riêng một ID hoặc thiếu quyền.

Trong source CD:
1. app.js chỉ mount order.route tại /api/orders.
2. memberB.route.js được mount /api/v1 nhưng không có hai route D01 preview/create (khác bản đã tích hợp ở repository làm việc).
3. Không route nào khớp nên rơi xuống middleware 404.
4. AppError của CD extends Error, nhưng errorHandler chỉ nhận instanceof HttpError. Lỗi nghiệp vụ có status 404 vì vậy rơi vào nhánh unknown 500.

## Các file sửa trong lượt này

- backend/src/app.js: mount tường minh /api/v1/orders trước 404, giữ /api/orders và toàn bộ route thành viên khác.
- backend/src/routes/order.route.js: factory tạo router dùng chung controller preview/create; router mặc định vẫn xuất theo contract cũ. Legacy /api/orders giữ JWT-only; v1 dùng requireAuth hiện có với JWT và dev header có điều kiện.
- backend/src/routes/memberB.route.js: bỏ riêng hai khai báo D01 đã chuyển sang router riêng để không trùng; giữ route /orders/:id/refund-requests và tất cả route khác.
- backend/src/middlewares/errorHandler.js: nhận cả HttpError và AppError extends Error cũ, chỉ với status nguyên trong 400–599. Giữ code/details/errors và cả hai error envelope. Lỗi Error bất kỳ không được coi là lỗi đã biết chỉ vì có trường status; unknown vẫn 500, không lộ chi tiết nội bộ.
- backend/tests/orders.routing.test.js: thêm 7 test HTTP/regression dùng app/controller/service/auth thật, chỉ mock tầng database trong unit test.
- Báo cáo này là file mới.

AppError extends HttpError và các alias/controller/service/auth tích hợp ở lượt trước được giữ nguyên. Không chỉ copy app.js mới sang runner cũ: runner còn thiếu controllers/orders.controller.js và các sửa tương thích auth/model/service/error từ bản tích hợp trước.

## Kiểm chứng bản sửa

- Backend pnpm test: **60/60 PASS**. pnpm check: **PASS**.
- Frontend pnpm lint: **PASS**; pnpm test: **10/10 PASS**. Không thay frontend trong lượt này.
- Node --check các file JS mới/sửa: **PASS**. Không còn unmerged paths; git diff --check sạch.
- Test riêng với **AppError gốc lấy từ image CD**, qua errorHandler mới, trả **404 ROUTE_NOT_FOUND**, không phải 500.
- Server thử riêng dùng source repository đã sửa, controller/service thật, không mock DB. Xác nhận database cho_do_cu và MySQL server UUID khớp container CD.
- Chạy lại bằng container thử riêng dùng **đúng image CD**, dependency trong image, source mới mount read-only, cùng network/MySQL; không publish cổng, không chạy server.js/job/migration/seed. Các kiểm tra sau đều qua:

| Request ở server thử đã sửa | Kết quả |
| --- | --- |
| preview/1 không xác thực | 401 UNAUTHORIZED |
| preview/1 có JWT kiểm thử hợp lệ | 200, listing RESERVED, giá 51000 |
| preview/7 có JWT | 200, listing PENDING, giá 57000 |
| preview/10 có JWT | 200, listing SOLD, giá 60000 |
| preview/4 có JWT | 200, listing ACTIVE, giá 54000 |
| preview/16 (ID không tồn tại lúc kiểm tra) | 404 LISTING_NOT_FOUND |
| preview/not-an-id | 400 VALIDATION_ERROR |
| /api/v1/not-a-route | 404 ROUTE_NOT_FOUND |
| /api/orders/preview/1 | 401 khi anonymous; 200 khi có JWT |

JWT kiểm thử chỉ dùng secret ngẫu nhiên trong tiến trình thử riêng; vẫn chạy xác thực chữ ký và tải danh tính/vai trò từ DB. Không sửa secret của CD, không tạo đăng nhập giả cho frontend.

Preview đã đối chiếu với DB: listingId, status, price, isOwnListing/isAvailable; buyer fullName/phone/address; reservationMinutes và delivery.available. Không in thông tin liên hệ của người dùng ra báo cáo/log chẩn đoán.

ID **1 không phải tin ACTIVE** tại thời điểm kiểm tra, nên UI phải báo không khả dụng; không đổi trạng thái để nút đặt hàng sáng. ID **4** là tin ACTIVE được kiểm tra. Trạng thái có thể thay đổi theo nghiệp vụ sau thời điểm kiểm tra.

**Không ghi database trong lượt này:** chỉ SELECT và GET; không tạo đơn, không gọi job hết hạn, không chạy test concurrency có fixture, không seed/reset/migrate. Các container chẩn đoán tự xóa sau khi xong; container/volume CD được giữ nguyên.

## Cách áp dụng vào đúng môi trường

### Kiểm tra frontend với source đã sửa mà không đổi CD

Có thể dùng server Express thật của repository làm việc trên cổng riêng để kiểm tra preview, không bật job/prepare-db:

Terminal backend (repository làm việc):
```powershell
Set-Location 'C:\Chuyển đề WEB1\WEB1-ChoDoCu\backend'
node -e "require('./src/app').listen(3001, '127.0.0.1', () => console.log('Preview verification API :3001'))"
```

Terminal frontend mới (cần restart Vite để nhận biến):
```powershell
Set-Location 'C:\Chuyển đề WEB1\WEB1-ChoDoCu\frontend'
$env:VITE_API_URL = 'http://localhost:3001/api/v1'
pnpm.cmd dev
```

Kiểm tra Network phải là http://localhost:3001/api/v1/orders/preview/1, không còn cổng 3000. Dùng phiên hợp lệ/cơ chế dev đã tồn tại; không bỏ xác thực. API client dùng chung có baseURL mới, nhưng client Store/partnerApplication riêng hiện vẫn hardcode cổng 3000: cách này phục vụ xác minh D01, không tuyên bố toàn bộ frontend đã chuyển môi trường.

Server app-only trên chỉ phục vụ kiểm chứng, **không phải cách chạy production hoặc toàn luồng giữ món** vì cố ý không khởi động job trong phiên chẩn đoán. Khi chạy backend bình thường bằng pnpm dev/start, job sẽ hoạt động theo cấu hình; dùng DB test riêng nếu không muốn tác động nghiệp vụ của DB dùng chung. Không thực hiện các lệnh khởi động này tự động trong lượt xử lý.

### Cập nhật container CD hiện có

Cần nhóm duyệt toàn bộ bản tích hợp backend, đưa source tương thích vào checkout/version được CD sử dụng rồi chủ động áp dụng qua quy trình triển khai đã thống nhất. Không copy riêng một app.js và bỏ các file phụ thuộc.

Nếu muốn hotfix trực tiếp checkout bind-mount, cần cho phép riêng và sao lưu/diff trước: nodemon tự reload, đây là thay đổi bản đang phục vụ; runner checkout sau này có thể ghi đè hotfix. Vì yêu cầu hiện tại cấm tự triển khai CD, **chưa làm bước này và chưa tuyên bố container CD đã hết 500**.

Source cũ /app và image/dependency cần được kiểm tra lại sau khi người dùng/nhóm áp dụng. Sau đó lặp GET anonymous (401), preview với phiên hợp lệ (200/404 nghiệp vụ), route lạ (404) và xem log mới, tránh dùng log cũ.

## Sao lưu và Git

Bản trước sửa bốn file source trong lượt này được lưu tại:
`C:\Users\LAM\AppData\Local\Temp\WEB1-runtime-fix-20261007-150335`.

Giữ toàn bộ thay đổi đã stage từ lượt trước. Không reset, xóa dữ liệu, sửa checkout runner, commit hoặc push.
