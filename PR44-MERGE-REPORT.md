# PR #44 — giải quyết merge conflict tại repository local

Ngày kiểm tra: 07/10/2026. Không commit, push hoặc triển khai CD.

## Trạng thái và sao lưu

- Repository: `C:\Chuyển đề WEB1\WEB1-ChoDoCu`.
- Nhánh nguồn đúng của PR #44: `Lam/D01_fix`, upstream `origin/Lam/D01_fix`.
- HEAD và remote nguồn: `b8f97ad49f3d9759d74cd6ba28b5e0a41d7370ef`.
- Merge đang diễn ra ngay khi bắt đầu: `MERGE_HEAD = origin/master = 9d9e966ec55dcaa77bb85a03b1c36b0fc41f62be`.
- Tổ tiên chung: `88e5e164e2a749e897ae189e6a730235a96eac08`.
- Đã đối chiếu PR qua GitHub API và đọc lại SHA hai nhánh bằng `git ls-remote`; master vẫn ở commit trên. Vì đã có merge, tiếp tục merge hiện tại, không abort/reset hay khởi tạo merge khác.
- Backup trước chỉnh sửa: `C:\Users\LAM\AppData\Local\Temp\WEB1-PR-merge-20261007-154944`, gồm `worktree`, toàn bộ `git-state` và cấu hình frontend local bị ignore.
- Không tìm thấy AGENTS.md trong repository.
- Git có **28 unmerged paths**, khác số 16 hiển thị trên PR. Đã đọc stage 2, stage 3 và stage 1 khi tồn tại. File add/add không có phiên bản tổ tiên; không suy diễn ra một bản base giả.
- Kiểm tra nội dung ngoài conflict: hầu hết tương ứng với nội dung đã commit. Riêng package.json được Git tự ghép thứ tự dependency rồi giữ thêm khối conflict, gây dependency trùng; đã hợp nhất thành một khóa cho mỗi dependency.

Commit HEAD `b8f97ad` đã chứa bản tích hợp chức năng được kiểm chứng ở lượt trước, nhưng chỉ có parent `6650383`; master `9d9e966` chưa được ghi nhận là tổ tiên qua merge. Vì vậy các file add/add tiếp tục conflict trên PR. Nhiều file sau giải quyết giống HEAD về nội dung là do HEAD đã bảo toàn hành vi master qua các adapter dùng chung, không phải bỏ thay đổi của master. Lần merge đang mở sẽ ghi nhận quan hệ này khi người dùng tự tạo merge commit sau khi duyệt.

## Từng file conflict đã xử lý

| File | Cách bảo toàn chức năng |
| --- | --- |
| `backend/migrations/20261002000100-add-d01-order-fields.js` | Giữ schema master (BuyerNote/DeliveryFeeRuleId/index), kiểm tra tồn tại để tương thích migration 004 đã triển khai. |
| `backend/package.json` | Hợp nhất dependencies/scripts của master với packageManager pnpm hiện tại; loại khóa dependency trùng do auto-merge. |
| `backend/scripts/verify-order-concurrency.js` | Giữ kiểm tra HTTP JWT 201/409 và dữ liệu của master; fixture nguyên tử, thêm v1/cross-prefix và expiration, không chạy trên dữ liệu thật trong lượt này. |
| `backend/src/app.js` | Giữ routes master Store/listing/partner/admin/memberB; thêm v1 D01 cạnh legacy, middleware trước 404. |
| `backend/src/controllers/order.controller.js` | Alias controller dùng chung giữ preview envelope 200/create 201 và truyền hồ sơ auth thật. |
| `backend/src/errors/AppError.js` | Giữ constructor status/code/message/details của master, kế thừa HttpError để cùng error handler không đổi status. |
| `backend/src/middleware/authenticate.js` | Giữ HS256 JWT verifier/master exports; hydrate DB qua auth dùng chung để D01/user roles không tách đôi. |
| `backend/src/middleware/errorHandler.js` | Alias shared handler vẫn trả error.code/details kiểu master, bảo toàn xử lý lỗi B và 404. |
| `backend/src/models/Listing.model.js` | Alias canonical Listings: cùng table/fields master và associations B/C, không khai báo model trùng. |
| `backend/src/models/Notification.model.js` | Alias canonical Notifications giữ fields master và defaults của shared notification. |
| `backend/src/models/Order.model.js` | Alias canonical Orders đã có đủ fields D01 (BuyerNote/DeliveryFeeRuleId), giữ associations refund/commission. |
| `backend/src/models/StatusHistory.model.js` | Alias canonical StatusHistories giữ table/fields và shared history. |
| `backend/src/repositories/order.repository.js` | Giữ SQL preview, READ_COMMITTED/update locks/expiry của master; shared models + adapter notification hai naming conventions cùng transaction. |
| `backend/src/routes/order.route.js` | Factory giữ GET preview/POST và JWT-only legacy của master; dùng cùng controller cho v1 auth. |
| `backend/src/server.js` | Hai phiên bản cùng startup/shutdown/job/main guard; chỉ khác dòng trắng, giữ toàn bộ hành vi master. |
| `backend/src/services/deliveryFee.service.js` | Giữ D12 unavailable 503, không phí giả; capability prefix v1 khớp API client. |
| `backend/src/services/order.service.js` | Giữ giá DB/quote hết hạn/15 phút/transaction/history/notify/deadlock/expiration master; hỗ trợ buyerId và profile D01. |
| `backend/src/utils/money.js` | Giữ phép cộng BigInt; không chuyển số vượt độ chính xác cents sang Number. |
| `backend/src/validators/order.validator.js` | Giữ toàn bộ validation/chặn client-controlled fields master và lỗi field-compatible; bổ sung body type guard đã kiểm chứng. |
| `backend/tests/order.service.test.js` | Giữ bộ test D01 hiện tại; toàn bộ suite master vẫn ở order.legacy.test.js, chỉ đổi notification field theo adapter shared. |
| `frontend/src/api/axios.js` | Giữ API Store/partner Axios master; dev đi qua proxy local đã kiểm chứng, URL production không đổi. |
| `frontend/src/lib/api.js` | Giữ named/default export, download/NOT_API/network errors master; JWT ưu tiên + dev opt-in/skipSession. |
| `frontend/src/lib/auth.js` | Giữ accessToken/token/dev-token master; redirect nội bộ query/state/session/home và lưu phiên sau xác thực. |
| `frontend/src/pages/HomePage.jsx` | Giữ UI/filter/save của cả hai; mua tới route D01 với ID hợp lệ. |
| `frontend/src/pages/Login.jsx` | Giữ Axios login thật/loading/errors/user storage master; xác minh danh tính /me và returnTo D01, không demo giả. |
| `frontend/src/pages/OrderCreatePage.jsx` | Giữ preview/DELIVERY quote/PICKUP/create/reservation/countdown UI master cùng profile/retry/race guard/error envelope D01. |
| `frontend/src/services/deliveryFeeApi.js` | Giữ POST payload listingId/address và response.data.data; shared named API export tương thích. |
| `frontend/src/services/orderApi.js` | Giữ preview options AbortSignal, POST payload và envelopes; named/default API đều còn. |

## Kiểm tra phần tự merge và các nơi liên quan

- `frontend/src/App.css`: Git tự bỏ toàn bộ media query prefers-reduced-motion. Đã giữ lại để bảo toàn khả năng truy cập, không để thay đổi smooth-scroll ảnh hưởng người dùng cần giảm chuyển động.
- `frontend/src/App.jsx`: giữ đầy đủ OrderCreatePage, PublicStore, SellerStore, PartnerApplication, admin/account lazy routes, DevAccountProvider, Suspense và ToastContainer. Route D01 là `/orders/create/:listingId`, phù hợp useParams; cửa hàng là `store/:ownerId`. Không thêm route/import trùng.
- `frontend/vite.config.js`, shared API client và Store client: giữ proxy dev local đã kiểm chứng. Không thay URL production hoặc sửa cấu hình CD.
- `backend/src/routes/memberB.route.js`: giữ /me, upload, category, report, refund, commission và fee-payment routes; không nhân đôi endpoint tạo đơn.
- Canonical model registry/associations, notification.service, shared auth/error middleware, jobs, order config và migration 004 đã được đọc lại. Một model/controller/error handler dùng chung và các alias bảo toàn đường import cũ.
- Không đổi reservationMinutes mặc định 15, commission config, điều kiện ACTIVE, RESERVED, hủy hết hạn, giá trong DB hoặc chính sách xác thực hiện có.
- Test master còn nguyên các trường hợp ở `backend/tests/order.legacy.test.js`; so với master chỉ đổi assertion notification.UserId thành notification.userId theo contract service dùng chung, không bỏ assertion hoặc test. Adapter repository đã có test cho cả PascalCase và camelCase.
- Package giữ toàn bộ dependency/script master và packageManager hiện tại; dùng thứ tự dependency của master, loại khóa trùng. Hai lockfile được pnpm kiểm chứng frozen/offline và không đổi nội dung.

## Kiểm tra thực tế

Tất cả lệnh dưới đây chạy từ source repository local, không chạy từ checkout actions-runner.

- Backend `pnpm.cmd run check`: đạt (8 tệp theo static-check, schema 22 bảng, 40 branch tính năng).
- `node --check` toàn bộ 91 tệp JS dưới src/scripts/migrations/config/tests: đạt.
- Backend `pnpm.cmd test`: **60/60 đạt**, không skip; gồm validation, pickup/delivery quote, reservation, hai người đặt đồng thời trong memory, rollback, expiration/idempotence, auth/role, model aliases, migration mocks và HTTP routing.
- Frontend `pnpm.cmd run lint`: đạt.
- Frontend `pnpm.cmd test`: **10/10 đạt**, không skip; gồm login sai/đúng bằng Axios adapter mock, danh tính thật từ /me, redirect nội bộ, giữ postLoginRedirect khi lỗi và API contracts D01/D12.
- Frontend `pnpm.cmd run build`: đạt, 2187 modules. Còn cảnh báo bundle >500 kB, không phải lỗi build.
- Cả backend/frontend: `pnpm.cmd install --lockfile-only --frozen-lockfile --ignore-scripts --offline`: đạt với pnpm 10.34.5; không thay version/lockfile.
- `docker compose config --quiet`: exit 0; có cảnh báo sandbox không đọc được cấu hình Docker cá nhân. Không build image hoặc chạy lại CD trong lượt này.
- HTTP integration trên tiến trình mới require app từ source vừa ghép, listen cổng động rồi đóng, database hiện có `cho_do_cu`: chỉ SELECT/GET, không gọi server.start, không chạy job/migration/seed.
  - /api/v1/orders/preview/1 chưa đăng nhập: **401 UNAUTHORIZED**.
  - JWT hợp lệ cho user đang có trong DB: preview **1, 7, 10, 4 đều 200**, gồm listing/buyer/reservationMinutes/delivery; ID 4 ACTIVE, giá 54000. ID 1 RESERVED, ID 7 PENDING, ID 10 SOLD: các cờ isAvailable/isOwnListing khớp DB, không đổi trạng thái để test.
  - ID không tồn tại (16 tại thời điểm kiểm tra): **404 LISTING_NOT_FOUND**.
  - ID not-an-id: **400 VALIDATION_ERROR**; route không tồn tại: **404 ROUTE_NOT_FOUND**, không bị biến thành 500.
  - /api/orders/preview/1: không token **401**, JWT hợp lệ **200**, giữ prefix legacy.
  - Health, Store 1, categories/conditions, report reasons và refund reasons **200**.
  - Admin users/seller commissions không phiên đăng nhập **401**, không bỏ bảo vệ.
- JWT của tiến trình integration dùng khóa ngẫu nhiên chỉ trong tiến trình thử; không sửa .env, secret của backend local hoặc CD.
- `git diff --check` và quét dấu merge trong backend/frontend: không có lỗi/dấu conflict thực; các hàng dấu bằng trang trí trong Login.css không phải conflict.
- Sau khi stage đúng các file được duyệt: không còn unmerged paths; MERGE_HEAD vẫn giữ nguyên để người dùng tự duyệt và commit merge.

## Giới hạn và việc còn cần nhóm tích hợp

- Backend hiện **chưa triển khai POST /api/auth/login**: kiểm tra thực tế trả **404 ROUTE_NOT_FOUND**. Giữ frontend gọi API thật và xử lý lỗi, không tạo đăng nhập giả hoặc tự gán ID 2. Chưa thể chứng minh đăng nhập mật khẩu thành công end-to-end; các test login/redirect dùng mock có ghi rõ ở trên.
- D12 chưa có provider thực; giữ unavailable/503 và không tự tính phí giả. DELIVERY được kiểm tra bằng quote service mock, không tuyên bố đã gọi dịch vụ giao hàng thực.
- Không chạy script concurrency trên MySQL trong lượt này vì script phải tạo/xóa fixture. Concurrency/rollback/expiration đã chạy bằng test memory; chưa kiểm chứng lại race cấp MySQL trong lượt này.
- Chưa chạy E2E trình duyệt hoặc Docker image build trong lượt này. Không thao tác CRUD/OTP/email/upload của thành viên khác trên dữ liệu đang dùng; kiểm tra liên quan ở mức source, build và HTTP read-only như liệt kê.
- Không thấy mâu thuẫn nghiệp vụ mới cần chọn bỏ một bên. Việc còn thiếu là backend login và provider D12 vốn chưa có, không phải xóa chức năng khi merge.
- Không stage .env, .env.development.local, node_modules, dist hoặc file sinh tự động. Không sửa checkout actions-runner, không dừng container CD.
- GitHub sẽ vẫn hiển thị conflict cho đến khi người dùng duyệt, tự commit merge trên Lam/D01_fix và push nhánh đó. Agent không thực hiện commit/push.
