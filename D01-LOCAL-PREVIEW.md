# Chạy và kiểm chứng API preview LOCAL

## Môi trường đang chạy (07/10/2026)

- Source backend: `C:\Chuyển đề WEB1\WEB1-ChoDoCu\backend`.
- Backend local: **http://127.0.0.1:3001**, tiến trình Node PID **15328** tại thời điểm khởi động. Entrypoint `scripts/start-local-preview.js`.
- Frontend hiện có: **http://localhost:5173**, source từ `C:\Chuyển đề WEB1\WEB1-ChoDoCu\frontend`. Vite đã tự nhận cấu hình mới; không cần mở một frontend khác.
- Request trình duyệt: `http://localhost:5173/api/v1/orders/preview/1`.
- Vite chuyển nguyên đường dẫn sang `http://127.0.0.1:3001/api/v1/orders/preview/1`.
- MySQL: `127.0.0.1:3306/cho_do_cu`, kết nối thành công. Đây là cổng publish của MySQL hiện có, dùng chung database với CD. Tên host `mysql` dành cho Docker network, không dùng khi chạy Node trên Windows.
- Container CD cổng 3000 và checkout actions-runner giữ nguyên. Gọi cổng 3000 vẫn tái hiện lỗi cũ 500; request qua Vite mới tới local trả đúng 200/401/404. Không copy source, restart/recreate container hoặc deploy CD.

## Thay đổi

- `frontend/vite.config.js`: đọc VITE_API_PROXY_TARGET qua loadEnv để cấu hình proxy /api. Nếu không có override, vẫn giữ mặc định localhost:3000 của nhóm.
- `frontend/.env.development.local`: đặt VITE_API_PROXY_TARGET=http://127.0.0.1:3001 chỉ cho máy hiện tại và mode development. File được frontend/.gitignore ignore bởi *.local, không stage/commit.
- `frontend/src/api/axios.js`: Store/partnerApplication dùng /api qua cùng proxy **chỉ ở dev**; giữ nguyên URL production hiện có. Không đổi path, payload hoặc auth của các API này.
- `backend/scripts/start-local-preview.js`: chạy Express app thật, kiểm tra kết nối DB trước khi listen trên loopback, log source/PID/port, hỗ trợ PORT, tắt sạch kết nối khi Ctrl+C. Không thêm handler giả, không bỏ xác thực, không đổi src/server.js.
- Client D01 `frontend/src/lib/api.js` vẫn dùng /api/v1; không đổi URL production/Docker/Nginx.

Entrypoint này **chỉ dành kiểm chứng preview với DB có sẵn**: không chạy prepare-db, migration, seed hoặc reservation expiration job. Chức năng job của backend thông thường vẫn nguyên vẹn; chạy pnpm dev/start sẽ khởi động job như trước.

Các API ghi vẫn là API thật, không bị vô hiệu hóa: thao tác tạo/sửa đơn từ UI sẽ ghi vào database dùng chung. Trong lượt kiểm chứng này chỉ gửi GET và request không xác thực bị chặn, không tạo/sửa/xóa dữ liệu. Muốn kiểm thử đầy đủ giữ món/hết hạn, nên dùng database test riêng và entrypoint backend bình thường.

## Kết quả HTTP thực tế

Đã gửi cùng request cả trực tiếp cổng 3001 và qua frontend cổng 5173. Log **backend local** ghi nhận toàn bộ request, không dựa vào log CD.

| Request | Xác thực | Status / dữ liệu |
| --- | --- | --- |
| /api/health | không cần | 200, database=connected |
| /api/v1/orders/preview/1 | không có phiên | 401 UNAUTHORIZED |
| /api/v1/orders/preview/1 | dev header hiện có, user DB 2 | 200; listingId=1, price=51000, status=RESERVED, isAvailable=false |
| /api/v1/orders/preview/4 | cùng cơ chế xác thực | 200; listingId=4, price=54000, status=ACTIVE, isAvailable=true |
| /api/v1/orders/preview/7 | cùng cơ chế xác thực | 200; PENDING, price=57000, không khả dụng |
| /api/v1/orders/preview/10 | cùng cơ chế xác thực | 200; SOLD, price=60000, không khả dụng |
| /api/v1/orders/preview/99999999 | cùng cơ chế xác thực | 404 LISTING_NOT_FOUND |
| /api/v1/orders/preview/not-an-id | cùng cơ chế xác thực | 400 VALIDATION_ERROR |
| /api/v1/not-a-route | không cần | 404 ROUTE_NOT_FOUND |
| /api/stores/1 | theo API hiện có | 200, storeId=1 |
| /api/v1/categories | không cần | 200 |
| /api/v1/admin/users | không có phiên | 401, không bỏ phân quyền |
| POST /api/v1/orders/1/refund-requests | không có phiên | 401 trước controller, không ghi DB |
| /api/orders/preview/1 (đường cũ) | không có JWT | 401, giữ chính sách cũ |

Mẫu rút gọn response preview/1 qua Vite, HTTP 200:
```json
{
  "success": true,
  "message": "Lấy thông tin đặt hàng thành công.",
  "data": {
    "listing": {
      "listingId": 1,
      "title": "Sản phẩm cũ minh họa 000001",
      "price": 51000,
      "status": "RESERVED",
      "isAvailable": false,
      "isOwnListing": false
    },
    "reservationMinutes": 15,
    "delivery": {
      "available": false,
      "estimateEndpoint": "/api/v1/delivery-fees/estimate",
      "message": "Dịch vụ ước tính phí giao hàng chưa sẵn sàng."
    }
  }
}
```

Response đầy đủ còn có mô tả/ảnh/vị trí/người bán của listing và buyer.fullName/phone/address; không in thông tin liên hệ ra báo cáo. Header dev là cơ chế đã có của dự án, chỉ dùng ngoài production và vẫn tải/kiểm tra tài khoản từ DB. Không tự lưu user 2 vào trình duyệt, không tạo đường login giả.

Không có phiên thì UI vẫn yêu cầu đăng nhập — đây là hành vi đúng, không phải lỗi route. Đăng nhập API thật và D12 vẫn là các điểm tích hợp còn thiếu đã báo trước. Tin 1 hiện RESERVED nên không dùng để chứng minh nút tạo đơn phải sáng; có thể xem preview tin 4 đang ACTIVE. Trạng thái có thể thay đổi theo dữ liệu thực tế sau thời điểm kiểm tra.

## Lệnh mở lại lần sau

Nếu hai server vẫn đang chạy thì chỉ mở lại trình duyệt/refresh, không chạy thêm tiến trình trùng cổng.

Terminal 1 — backend local, không seed/job:
```powershell
Set-Location 'C:\Chuyển đề WEB1\WEB1-ChoDoCu\backend'
$env:NODE_ENV = 'development'
$env:PORT = '3001'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3306'
node scripts/start-local-preview.js
```

Giữ MySQL hiện có đang chạy. Script dùng DB_NAME/DB_USER/DB_PASSWORD trong môi trường hoặc backend/.env nếu có, nếu không dùng mặc định giống Compose hiện tại. Không cần chạy docker:dev/db:prepare/db:seed/db:reset. Không đưa secret vào Git.

Terminal 2 — frontend:
```powershell
Set-Location 'C:\Chuyển đề WEB1\WEB1-ChoDoCu\frontend'
Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
$env:VITE_API_PROXY_TARGET = 'http://127.0.0.1:3001'
pnpm.cmd dev --port 5173 --strictPort
```

Remove-Item ở đây chỉ xóa biến môi trường trong terminal hiện tại, không xóa file. Biến VITE_API_URL cũ nếu là URL tuyệt đối có thể khiến client bỏ qua proxy, nên bỏ override đó khi kiểm chứng theo hướng dẫn này. File .env.development.local trên máy đã lưu proxy target, dòng đặt biến vẫn giúp lệnh có thể tái sử dụng khi clone khác không có file ignored.

Mở **http://localhost:5173/orders/create/1** hoặc **/orders/create/4**. Không mở cổng 8081 để kiểm tra bản local: đó là frontend Nginx của CD.

Kiểm tra nhanh trong terminal khác:
```powershell
Invoke-RestMethod 'http://localhost:5173/api/health'
Invoke-RestMethod 'http://localhost:5173/api/v1/orders/preview/1' -Headers @{ 'x-user-id' = '2' }
```

Lệnh thứ hai dành cho cơ chế dev đã có và tài khoản DB được kiểm tra tại thời điểm này; không dùng header dev trong production. Khi làm việc với JWT thật, dùng phiên hợp lệ do backend cung cấp, không đổi ID hoặc tự xóa token đang có để giả phiên.

Ctrl+C trong các terminal do bạn mở để dừng local. Backend được Codex mở hiện tại là PID 15328; không dừng container CD hay các tiến trình khác. Nếu báo EADDRINUSE, kiểm tra tiến trình đang chiếm cổng trước, không kill hàng loạt hoặc đổi sang cổng 3000.

## Kiểm tra và sao lưu

- Backend pnpm test **60/60 PASS**, pnpm check **PASS**, node --check launcher **PASS**.
- Frontend pnpm lint **PASS**, pnpm test **10/10 PASS**, pnpm build **PASS** (chỉ cảnh báo chunk lớn).
- Build production không chứa địa chỉ proxy local 127.0.0.1:3001. URL production được giữ nguyên; build tạo cùng bundle chính như trước.
- git diff --check sạch; không còn unmerged paths. Checkout actions-runner vẫn sạch.
- Trước sửa, vite.config.js và axios.js được sao lưu tại `C:\Users\LAM\AppData\Local\Temp\WEB1-local-preview-20261007-152408`.

Không commit, push, merge master, xóa volume, reset/seed database hoặc dừng CD.
