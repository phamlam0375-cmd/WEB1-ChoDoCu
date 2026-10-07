# Báo cáo xử lý conflict D01 — 07/10/2026

## Trạng thái và sao lưu

- Nhánh thực tế: `Lam/D01_fix`, HEAD `66503838d9c68216083b5cd9464c069e0b0d990d` (khác tên nhánh trong yêu cầu cũ).
- Ban đầu index có 15 unmerged paths. Không có `MERGE_HEAD`, rebase hay cherry-pick metadata; không tự coi đây là rebase, không tự tạo lại merge metadata.
- Đã sao lưu 210 file tracked/nonignored ở worktree và toàn bộ Git metadata trước khi sửa tại:
  `C:\Users\LAM\AppData\Local\Temp\WEB1-D01-conflict-20261007-143524` (`worktree` và `git-state`).
- Đã đọc hai phiên bản index stage 2/3, stage 1 với các file UU; các file AA không có tổ tiên riêng trong index. Đối chiếu common ancestor `88e5e164e2a749e897ae189e6a730235a96eac08` khi có file.
- Dùng bản tích hợp đã có trong lịch sử `78296b9` làm tham chiếu sau khi đối chiếu các phiên bản, không dùng chọn hàng loạt ours/theirs.
- Giữ các thay đổi đã stage sẵn của cửa hàng, partner application, schema, dependency, Docker/Nginx; giữ sửa thủ công bỏ import OrderCreatePage trùng trong App.jsx. Không commit/push/abort/reset/seed.

## Tích hợp chức năng

- OrderCreatePage: một component/export duy nhất; giữ preview, tự điền hồ sơ người mua, retry, hai hình thức nhận hàng, validation, xử lý lỗi API hai dạng envelope, accessibility, skeleton, màn hình thành công và đếm ngược giữ món. Giữ khóa chống submit lặp, hủy request preview và bỏ qua báo giá trả về trễ khi đổi địa chỉ/hình thức nhận.
- Giữ kiểm tra hạn báo giá và token báo giá ở UI/backend. Tiền lấy từ database và phí từ báo giá do server xác thực, cộng bằng BigInt; không nhận buyerId/giá/trạng thái từ client.
- Giữ thời hạn theo cấu hình (mặc định 15 phút), transaction, row lock và cập nhật có điều kiện ACTIVE → RESERVED. Lịch sử và thông báo cùng transaction; lỗi thông báo rollback toàn bộ. Job chỉ hủy đơn RESERVED hết hạn, mở lại listing RESERVED (không mở SOLD), chạy lặp không tạo tác dụng phụ trùng.
- HomePage truyền mã sản phẩm nguyên dương hợp lệ vào /orders/create/:listingId. App.jsx giữ một route D01 cùng public store /store/:ownerId, seller store, partner application, admin, account, providers và ToastContainer. Giữ CSS prefers-reduced-motion đã có ở HEAD nhưng bị mất trong bản tự ghép.
- API frontend dùng client dùng chung /api/v1, named/default export tương thích và giữ download/error handling. Backend giữ cả /api/orders và /api/v1/orders trước middleware 404.
- Xác thực: JWT thật lấy hồ sơ/vai trò/trạng thái từ database. /api/orders vẫn yêu cầu JWT; /api/v1 giữ header dev có điều kiện ngoài production. JWT sai không hạ cấp sang header dev, không tin vai trò ADMIN trong token.
- Login gọi API qua URL cấu hình/proxy, giữ loading/lỗi/lưu phiên; xác minh danh tính qua /me rồi lưu token + user thật, không gán ID 2. Bỏ nhánh mật khẩu demo theo yêu cầu trước. Chuyển hướng theo returnTo query → location.state.from → sessionStorage postLoginRedirect → /, chỉ nhận đường dẫn nội bộ và chỉ xóa redirect sau khi lưu phiên thành công.
- Các dependency/scripts được hợp nhất; giữ nodemailer, multer, zod, jest, supertest và auth:token. Chạy pnpm 10.34.5 cập nhật/kiểm tra lockfile, không xóa lockfile; nội dung lockfile hiện có đã phù hợp, không cần thay dependency resolution. .env.example giữ JWT placeholder và toàn bộ cấu hình D01, bỏ dấu conflict còn sót dù file đã được stage trước.

## Hợp nhất phần trùng

- Các model đơn lẻ Order/Listing/Notification/StatusHistory trở thành alias của model dùng chung: cùng bảng, thuộc tính và associations; tránh hai khai báo Sequelize cạnh tranh.
- Controller, auth và error handler cũ chuyển qua implementation dùng chung. AppError tương thích HttpError; response giữ code/errors và error.code/details để cả hai frontend/API contract hoạt động.
- Repository thông báo hỗ trợ cả tên trường PascalCase và camelCase, giữ timestamp/transaction; không chèn hai thông báo cho cùng sự kiện tạo đơn.
- Hai migration D01 được giữ tên nhưng thêm kiểm tra tồn tại để không thêm cột/index hai lần. Undo migration tương thích không xóa schema do migration còn hiệu lực sở hữu. Chỉ kiểm thử bằng schema mô phỏng, không undo/migrate database đang dùng.
- Server giữ startup/job/shutdown và xử lý lỗi khởi động, chỉ một listen; import module không tự mở server.
- Giữ đủ 40 test ban đầu của hai phía trong hai file; bổ sung 13 test tương thích, không vô hiệu hóa assertion.

## Kiểm tra đã chạy thực tế

- Frontend: `pnpm test` **10/10 PASS** (mock Axios; không phải đăng nhập bằng tài khoản thật), `pnpm lint` **PASS**, `pnpm build` **PASS**. Vite chỉ cảnh báo bundle lớn hơn 500 kB, không lỗi parse.
- Backend: `pnpm check` **PASS**; `pnpm test` **53/53 PASS**, gồm validation, quote expiry, concurrency, rollback, job, auth/role, error contract/model/migration compatibility.
- `node --check` toàn bộ **88 file JS** trong backend/src/scripts/migrations/tests **PASS**; import server **PASS** và không tự listen.
- `pnpm test:concurrency` **PASS trên HTTP + MySQL thật**: race JWT /api/orders, dev /api/v1/orders và race chéo đều cho đúng một 201, một 409. Kiểm tra preview/hồ sơ, auth 401, mua sản phẩm của mình 403, admin 403, categories 200 và 404 envelope.
- Hai worker hết hạn đồng thời xử lý đúng ba đơn fixture; chạy lại không xử lý trùng. Script chỉ quét ID fixture và đã dọn dữ liệu fixture trong transaction; không seed/reset hoặc hủy đơn có sẵn.
- Smoke test cửa hàng chỉ đọc: /api/stores/not-an-id → **400**, /api/stores/:ownerId với cửa hàng hiện có → **200**.
- `docker compose build` **PASS** cho API và Nginx, cài dependency bằng frozen lockfile và build React trên Node 20. Chạy lại backend test trong image, network none, không mount database: **53/53 PASS**. Không chạy compose up/deploy/migration/seed.
- Quét toàn bộ backend/frontend (kể cả .env.example, bỏ node_modules/dist) không còn dấu conflict; kiểm tra index không còn unmerged paths sau khi stage các file đã giải quyết.

## Chưa kiểm chứng / cần nhóm hoàn thiện

- **Backend chưa triển khai /api/auth/login**: gọi HTTP thực tế trả **404 ROUTE_NOT_FOUND**. Không thể khẳng định đăng nhập sai/đúng bằng tài khoản thật hoặc toàn luồng UI chưa đăng nhập → mua → login → quay lại checkout đã qua. Frontend đã có test mô phỏng lỗi/thành công/redirect và cần backend cung cấp accessToken hoặc token; danh tính được xác nhận qua /api/v1/me.
- **D12 chưa triển khai** trong cả hai bản: giữ available=false và lỗi DELIVERY_SERVICE_UNAVAILABLE, không tự bịa phí hoặc bỏ kiểm tra báo giá. DELIVERY với báo giá hợp lệ/hết hạn mới được kiểm bằng dependency giả trong unit test; thực tế PICKUP đã chạy HTTP/MySQL.
- Điều hướng Home/App/Store và các trạng thái giao diện được kiểm tra mã nguồn, lint/build; chưa chạy thao tác click/render trong trình duyệt. API cửa hàng đã chạy thật nhưng không kiểm thử ghi sửa cửa hàng/gửi email/partner application để tránh tác động dữ liệu.
- Ngoài các điểm tích hợp chưa có nêu trên, không phát hiện mâu thuẫn nghiệp vụ buộc phải bỏ chức năng của một bên. Đây là giải quyết nội dung/index conflict, không phải tuyên bố đã hoàn tất một merge commit khi MERGE_HEAD không tồn tại.

## Các file đã giải quyết/điều chỉnh hoặc bổ sung kiểm thử

- `backend/.env.example`
- `backend/migrations/20261002000100-add-d01-order-fields.js`
- `backend/migrations/20261002000400-add-d01-order-fields.js`
- `backend/package.json`
- `backend/scripts/verify-order-concurrency.js`
- `backend/src/controllers/order.controller.js`
- `backend/src/errors/AppError.js`
- `backend/src/jobs/reservationExpiration.job.js`
- `backend/src/middleware/authenticate.js`
- `backend/src/middleware/errorHandler.js`
- `backend/src/middlewares/auth.middleware.js`
- `backend/src/middlewares/errorHandler.js`
- `backend/src/models/Listing.model.js`
- `backend/src/models/Notification.model.js`
- `backend/src/models/Order.model.js`
- `backend/src/models/StatusHistory.model.js`
- `backend/src/repositories/order.repository.js`
- `backend/src/server.js`
- `backend/src/services/deliveryFee.service.js`
- `backend/src/services/notification.service.js`
- `backend/src/services/order.service.js`
- `backend/src/utils/money.js`
- `backend/src/validators/order.validator.js`
- `backend/tests/merge.compatibility.test.js`
- `backend/tests/order.legacy.test.js`
- `backend/tests/order.service.test.js`
- `frontend/package.json`
- `frontend/src/App.css`
- `frontend/src/App.jsx`
- `frontend/src/lib/api.js`
- `frontend/src/lib/auth.js`
- `frontend/src/pages/HomePage.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/OrderCreatePage.jsx`
- `frontend/src/services/authApi.js`
- `frontend/src/services/deliveryFeeApi.js`
- `frontend/src/services/orderApi.js`
- `frontend/tests/auth.test.js`
- `frontend/tests/orderApi.test.js`

Báo cáo này là file mới bổ sung. Các thay đổi staged khác đã có sẵn trước khi làm được giữ nguyên.
