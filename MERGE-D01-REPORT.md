# Báo cáo tích hợp merge D01

## Trạng thái và sao lưu

- Nhánh: `Lam/D01_DatHang_GiuMon`; thao tác là **merge**, không phải rebase.
- HEAD trước xử lý: `b93845c`; MERGE_HEAD: `66503838d9c68216083b5cd9464c069e0b0d990d`.
- Tổ tiên chung: `88e5e164e2a749e897ae189e6a730235a96eac08`.
- Không tìm thấy AGENTS.md trong repository.
- Bản sao lưu trước sửa: `C:\Users\LAM\AppData\Local\Temp\WEB1-ChoDoCu-merge-backup-20261007-134948`.
  `worktree` chứa 181 file tracked/nonignored, gồm nội dung conflict và phần đã sửa;
  `git-state` giữ toàn bộ .git, index, refs và thông tin merge.
- Không reset, clean, abort merge, commit hoặc push. Không dùng chọn ours/theirs hàng loạt.
- Đã đọc stage 2 và stage 3 của 14 file; .env.example, package.json, HomePage.jsx có stage 1.
  Các file add/add không tồn tại trong tổ tiên chung nên không có stage 1.

## 14 file conflict

| File | Cách bảo toàn hành vi hai nhánh |
| --- | --- |
| backend/.env.example | Giữ JWT_SECRET dạng placeholder, DB/seeder và toàn bộ cấu hình giữ món; ghi rõ header dev chỉ ngoài production. |
| backend/package.json | Giữ scripts chung, test, test:concurrency và auth:token của Lam; không đổi dependencies. Cố định pnpm 10.34.5 tương thích CI/lockfile. |
| backend/scripts/verify-order-concurrency.js | Hợp nhất kiểm thử JWT/API cũ, header dev/API v1, giá server và dữ liệu lưu; thêm race gọi chéo hai API, job đồng thời và cleanup fixture nguyên tử. |
| backend/src/jobs/reservationExpiration.job.js | Hai phiên bản chỉ khác format; giữ một timer, chống chạy chồng, startup scan và stop/unref. |
| backend/src/repositories/order.repository.js | Dùng models/notification service chung của master, giữ row lock, conditional update, READ COMMITTED, SKIP LOCKED của cả hai; nhận cả hai contract notification. |
| backend/src/services/deliveryFee.service.js | Giữ adapter D12 chưa sẵn sàng, mã lỗi 503 và endpoint v1; không tự đặt phí hoặc giả lập báo giá. |
| backend/src/services/order.service.js | Một transaction tạo đơn, lịch sử và thông báo; giữ mọi validation, quote backend, BigInt money, deadline, rollback và 409. Preview nhận buyerId cũ hoặc hồ sơ v1 để tự điền. Notification giữ timestamp của clock D01. |
| backend/src/utils/money.js | Giữ cộng số tiền bằng BigInt; dùng chuỗi khi số tiền không thể biểu diễn an toàn theo đơn vị xu, không đổi công thức/tỷ lệ. |
| backend/src/validators/order.validator.js | Giữ kiểm tra điện thoại VN, độ dài, DELIVERY/address/quote và cấm trường server-controlled. Trả errors.fields của v1 và details tương thích cũ; body sai kiểu cũng bị từ chối. |
| backend/tests/order.service.test.js | Giữ nguyên 22 test master; 18 test Lam chuyển nguyên hành vi sang order.legacy.test.js, chỉ đổi assertion tên field theo contract notification chung. |
| frontend/src/pages/HomePage.jsx | Giữ tìm kiếm, lọc, lưu, danh sách nổi bật; nút mua dẫn đến /orders/create/:listingId, kiểm tra ID nguyên dương an toàn. Không báo mua thành công giả khi thiếu ID. |
| frontend/src/pages/OrderCreatePage.jsx | Giữ JWT/returnTo, hỗ trợ tài khoản dev, tự điền hồ sơ, retry, nhãn tình trạng, validation server, a11y, chống submit lặp, quote/token hết hạn, countdown, xử lý 401/409 và success chi tiết/scroll đầu trang. |
| frontend/src/services/deliveryFeeApi.js | Dùng axios chung, giữ payload báo giá và response.data.data; chỉ gọi khi backend báo D12 sẵn sàng. |
| frontend/src/services/orderApi.js | Giữ GET preview/POST order và response contract; relative URL qua axios base v1, API cũ vẫn được backend hỗ trợ. |

## File liên quan và phần trùng được hợp nhất

- `frontend/src/App.jsx`: tự merge tạo hai khai báo OrderCreatePage và hai route giống nhau.
  Chỉ còn một lazy import và một route trong Suspense/DevAccountProvider; mọi route admin,
  báo cáo, hoàn tiền, phí người bán, đăng ký đối tác vẫn giữ.
- `frontend/src/lib/api.js`: giữ cả default/named export, NOT_API, thông báo lỗi mạng và
  tải CSV; gửi Bearer khi có token, nếu không vẫn gửi header dev như trước.
- `frontend/src/lib/auth.js`: giữ các key token và dev access token; storage bị chặn
  không làm trang vỡ, returnTo vẫn truyền bằng URL/state.
- `frontend/src/pages/Login.jsx`: giữ đăng nhập demo của master và redirect trở lại D01,
  kiểm tra đường dẫn nội bộ; không coi đây là A02 hoàn chỉnh.
- `backend/src/middlewares/auth.middleware.js` và `middleware/authenticate.js`:
  một phần nạp hồ sơ/tài khoản/role DB dùng chung, không tin role trong token.
  /api/orders vẫn bắt JWT; /api/v1 nhận JWT hoặc header dev ngoài production nếu
  AUTH_DEV_HEADER không phải false. JWT sai không fallback sang dev; tài khoản khóa
  bị từ chối; ADMIN vẫn được kiểm tra.
- `backend/src/errors/AppError.js`, hai đường dẫn errorHandler và `utils/httpError.js`:
  AppError tương thích constructor cũ và kế thừa HttpError. Chỉ một middleware được
  đăng ký, giữ top-level code/errors và nested error.code/details.
- `backend/src/controllers/order.controller.js`, `orders.controller.js`:
  import cũ là alias của controller chung, không chạy nghiệp vụ hai lần.
- `backend/src/models/{Order,Listing,Notification,StatusHistory}.model.js` là alias
  của models số nhiều, giữ các associations và defaults của master.
  `Orders.model.js` giữ BuyerNote/DeliveryFeeRuleId của D01.
- `backend/src/services/notification.service.js`: thêm timestamp tùy chọn; các caller
  khác vẫn dùng default cũ, giới hạn độ dài và transaction được giữ.
- Hai migration `20261002000100-add-d01-order-fields.js` và
  `20261002000400-add-d01-order-fields.js`: giữ cả tên để tương thích SequelizeMeta
  ở máy đã triển khai mỗi nhánh; up kiểm tra trước khi thêm cột/index. Undo migration
  tương thích không xóa schema khi migration Lam vẫn còn áp dụng.
- Đã rà `backend/src/app.js`: import đầy đủ, JSON/auth/routes đúng nơi, cả /api/orders
  và /api/v1/orders trước 404, chỉ một error handler. Không cần sửa thêm app.js.
  `routes/memberB.route.js` giữ routes D01 cùng toàn bộ routes B.
- `backend/tests/merge.compatibility.test.js`: thêm 13 test cho các điểm tích hợp.
- Đã đọc CI/CD, server startup/job, Vite proxy và Nginx; không thay deployment/seed.

## Kiểm chứng

- Backend `pnpm.cmd test`: **53/53 pass**, gồm toàn bộ 40 test hai nhánh và 13 test mới.
- Backend `pnpm.cmd run check`: pass; kiểm tra thêm `node --check` toàn bộ **79** file
  JS dưới src/scripts/migrations/tests: pass.
- Frontend `pnpm.cmd run lint`, `pnpm.cmd run build`: pass.
- Backend lockfile được cập nhật/kiểm tra bằng pnpm 10.34.5:
  `pnpm.cmd install --lockfile-only --ignore-scripts --offline` và frozen-lockfile:
  pass, không có thay đổi nội dung dependency trong lockfile. Lần install trực tiếp
  vào node_modules hiện có dừng vì no-TTY trước khi thay thư mục; clean install trong
  Docker với frozen-lockfile đã thành công.
- `pnpm.cmd run test:concurrency` trên MySQL thật: pass. Ba race (JWT/API cũ,
  dev/API v1, gọi chéo) đều đúng một 201 + một 409, một đơn + lịch sử + thông báo,
  giá lấy từ server. Preview cả hai API trả hồ sơ đúng; /me nhận JWT/dev; người
  không có ADMIN bị 403; categories công khai vẫn 200; 404 trả đúng typed error.
- Hai worker hết hạn chỉ quét **listing fixture**, tổng hủy đúng ba đơn, chạy lại
  không hủy thêm; kiểm tra lịch sử/thông báo và mở lại listing. Fixture đã được
  dọn trong transaction; không đụng đơn có sẵn, không seed/reset DB.
- Kiểm tra schema hiện có bằng truy vấn đọc: có BuyerNote, DeliveryFeeRuleId,
  index orders_status_reserved_until và cả hai tên migration trong SequelizeMeta.
- `docker compose config --quiet`, `docker compose build`: pass cả hai image.
  Ban đầu Corepack chọn pnpm 12 không được cố định; đã dừng build đó và dùng
  packageManager pnpm 10.34.5. Unit test 53/53 và backend check cũng pass trên
  image Node 20, container tạm network none; `nginx -t`: pass.
- Không chạy CD, compose up, migrate/undo hoặc seed trên database đang dùng.

## Giới hạn kiểm chứng và việc nhóm cần lưu ý

- Không tìm thấy mâu thuẫn nghiệp vụ còn phải chọn một bên để resolve.
- D12 và A02 thật chưa hoàn chỉnh ở cả hai nhánh: giữ nguyên adapter unavailable
  và login demo; không tự thêm phí giao hàng hoặc bỏ xác thực để test.
- Trang chủ vẫn dùng mockProducts có ID số. D01 lấy sản phẩm/giá thực theo ID từ DB;
  nội dung mock không đảm bảo trùng tên/ảnh với listing thật. Không tự thay toàn bộ
  phân hệ duyệt tin bằng một API mới ngoài phạm vi merge.
- Chưa xác nhận luồng bằng thao tác trình duyệt: bộ điều khiển báo thiếu
  `codex app-server`. Đã kiểm tra code điều hướng, lint/build và HTTP/MySQL thật,
  nhưng nhóm cần bấm thử trang chủ → đăng nhập → preview → đặt hàng sau khi UI
  automation hoạt động. Skill computer-use không thể hoàn tất phần kiểm chứng này.
- Fresh migration/rollback được test bằng QueryInterface giả lập, chưa chạy DDL
  lên database trống riêng; không khẳng định đã migrate/undo DB thật.
- Chỉ smoke test các chức năng B liên quan (auth/role, /me, categories, associations,
  error handling); không khẳng định đã kiểm thử toàn bộ quản trị/hoàn tiền/hoa hồng.

## Bàn giao

Các file đã xử lý/kiểm tra được stage để nhóm review. Không còn unmerged paths
hoặc dấu conflict Git. Merge vẫn chờ commit của nhóm; HEAD và MERGE_HEAD không đổi.
Bản sao lưu gốc vẫn giữ nguyên. Cache .pnpm-store phát sinh lúc kiểm tra được
chuyển ra thư mục sao lưu (generated-pnpm-store), không đưa vào Git.
