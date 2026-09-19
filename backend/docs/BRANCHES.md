# Phân công 40 branch tính năng

Mỗi tính năng có đúng một branch riêng, được tạo từ `develop`. Tên thành viên đang để theo ký hiệu A/B/C/D để nhóm thay bằng họ tên thật.

## Thành viên A — Người dùng và khám phá sản phẩm

| Mã | Branch | Chức năng |
|---|---|---|
| A01 | `feature/a01-register-email-verification` | Đăng ký và xác thực email |
| A02 | `feature/a02-login` | Đăng nhập |
| A03 | `feature/a03-forgot-password` | Quên mật khẩu |
| A04 | `feature/a04-user-profile` | Hồ sơ cá nhân |
| A05 | `feature/a05-product-search-view` | Tìm kiếm và xem sản phẩm |
| A06 | `feature/a06-advanced-filter` | Bộ lọc nâng cao |
| A07 | `feature/a07-favorites` | Lưu tin yêu thích |
| A08 | `feature/a08-product-compare` | So sánh sản phẩm |
| A09 | `feature/a09-similar-recommendation` | Gợi ý sản phẩm tương tự |
| A10 | `feature/a10-ai-chatbot` | Chatbot AI hỗ trợ |

## Thành viên B — Quản trị hệ thống

| Mã | Branch | Chức năng |
|---|---|---|
| B01 | `feature/b01-user-role-management` | Quản lý tài khoản và phân quyền |
| B02 | `feature/b02-partner-approval` | Duyệt hồ sơ đối tác |
| B03 | `feature/b03-category-management` | Quản lý danh mục |
| B04 | `feature/b04-report-intake` | Tiếp nhận báo cáo vi phạm |
| B05 | `feature/b05-listing-moderation` | Kiểm duyệt tin và xử lý báo cáo |
| B06 | `feature/b06-refund-intake` | Tiếp nhận yêu cầu hoàn tiền |
| B07 | `feature/b07-refund-resolution` | Giải quyết yêu cầu hoàn tiền |
| B08 | `feature/b08-commission-calculation` | Tính hoa hồng theo đơn |
| B09 | `feature/b09-fee-reconciliation` | Thu và đối soát phí |
| B10 | `feature/b10-statistics-dashboard` | Thống kê và bảng điều khiển |

## Thành viên C — Người bán/đối tác

| Mã | Branch | Chức năng |
|---|---|---|
| C01 | `feature/c01-partner-registration` | Đăng ký đối tác |
| C02 | `feature/c02-store-map` | Gian hàng và Google Maps |
| C03 | `feature/c03-create-listing` | Đăng tin bán sản phẩm |
| C04 | `feature/c04-listing-management` | Quản lý tin đăng |
| C05 | `feature/c05-vip-promotion` | Đăng ký tin VIP |
| C06 | `feature/c06-order-confirmation` | Xác nhận hoặc từ chối đơn |
| C07 | `feature/c07-order-handover` | Chuẩn bị và bàn giao hàng |
| C08 | `feature/c08-direct-chat` | Nhắn tin trực tiếp |
| C09 | `feature/c09-reviews` | Đánh giá và phản hồi |
| C10 | `feature/c10-partner-notifications` | Thông báo cho đối tác |

## Thành viên D — Đặt hàng, thanh toán và giao hàng

| Mã | Branch | Chức năng |
|---|---|---|
| D01 | `feature/d01-place-reserve-order` | Đặt hàng và giữ món |
| D02 | `feature/d02-cancel-order` | Hủy đơn hàng |
| D03 | `feature/d03-buyer-payment` | Thanh toán cho người bán |
| D04 | `feature/d04-seller-payment-confirmation` | Xác nhận đã nhận tiền |
| D05 | `feature/d05-order-tracking` | Theo dõi đơn hàng |
| D06 | `feature/d06-buyer-receipt-confirmation` | Xác nhận đã nhận hàng |
| D07 | `feature/d07-driver-accept-delivery` | Tài xế nhận chuyến |
| D08 | `feature/d08-driver-pickup` | Xác nhận đã lấy hàng |
| D09 | `feature/d09-delivery-progress` | Cập nhật tiến độ giao hàng |
| D10 | `feature/d10-failed-return-delivery` | Giao thất bại và chuyển hoàn |

## Cách làm một chức năng

Ví dụ thành viên D làm D01:

```bash
git switch feature/d01-place-reserve-order
git pull --rebase origin feature/d01-place-reserve-order
# code và kiểm thử
git add .
git commit -m "feat(D01): hoàn thiện đặt hàng và giữ món"
git push origin feature/d01-place-reserve-order
```

Sau đó tạo Pull Request vào `develop`, yêu cầu ít nhất một thành viên khác kiểm tra.
