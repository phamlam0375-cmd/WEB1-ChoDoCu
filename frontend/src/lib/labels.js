// Nhãn tiếng Việt và màu cho các trạng thái của phân hệ B.
export const ROLE_LABELS = {
  USER: 'Người mua',
  ADMIN: 'Quản trị',
  SELLER: 'Người bán',
  DRIVER: 'Tài xế',
}

export const USER_STATUS = {
  ACTIVE: { label: 'Hoạt động', tone: 'green' },
  LOCKED: { label: 'Đã khóa', tone: 'red' },
}

export const PARTNER_STATUS = {
  PENDING: { label: 'Chờ duyệt', tone: 'amber' },
  APPROVED: { label: 'Đã duyệt', tone: 'green' },
  REJECTED: { label: 'Từ chối', tone: 'red' },
  NEED_INFO: { label: 'Cần bổ sung', tone: 'blue' },
}

export const PARTNER_TYPE = { SELLER: 'Người bán', DRIVER: 'Tài xế' }

export const CATEGORY_STATUS = {
  ACTIVE: { label: 'Hiện', tone: 'green' },
  INACTIVE: { label: 'Ẩn', tone: 'slate' },
}

export const LISTING_STATUS = {
  DRAFT: { label: 'Nháp', tone: 'slate' },
  PENDING: { label: 'Chờ duyệt', tone: 'amber' },
  ACTIVE: { label: 'Đang bán', tone: 'green' },
  RESERVED: { label: 'Đang giữ', tone: 'blue' },
  SOLD: { label: 'Đã bán', tone: 'slate' },
  HIDDEN: { label: 'Đã ẩn', tone: 'slate' },
  REMOVED: { label: 'Đã gỡ', tone: 'red' },
  REJECTED: { label: 'Bị từ chối', tone: 'red' },
}

// Nhãn dự phòng; danh sách đầy đủ lấy từ API /categories/conditions.
export const CONDITION_LABELS = {
  NEW: 'Mới',
  LIKE_NEW: 'Như mới',
  GOOD: 'Đã qua sử dụng - tốt',
  FAIR: 'Đã qua sử dụng - khá',
  POOR: 'Cũ nhiều',
}

export const REPORT_STATUS = {
  PENDING: { label: 'Đã tiếp nhận', tone: 'amber' },
  PROCESSING: { label: 'Đang xử lý', tone: 'blue' },
  RESOLVED: { label: 'Đã xử lý', tone: 'green' },
  REJECTED: { label: 'Không vi phạm', tone: 'slate' },
}

export const REPORT_TARGET = { LISTING: 'Tin đăng', USER: 'Tài khoản', ORDER: 'Đơn hàng' }

export const REFUND_STATUS = {
  PENDING: { label: 'Chờ xử lý', tone: 'amber' },
  REVIEWING: { label: 'Đang xem xét', tone: 'blue' },
  APPROVED: { label: 'Chờ người bán chuyển trả', tone: 'violet' },
  SELLER_TRANSFERRED: { label: 'Chờ người mua xác nhận', tone: 'violet' },
  DISPUTED: { label: 'Đang tranh chấp', tone: 'red' },
  REJECTED: { label: 'Từ chối', tone: 'slate' },
  COMPLETED: { label: 'Hoàn tất', tone: 'green' },
}

export const COMMISSION_STATUS = {
  UNPAID: { label: 'Chưa nộp', tone: 'amber' },
  REPORTED: { label: 'Chờ xác nhận', tone: 'blue' },
  PAID: { label: 'Đã nộp', tone: 'green' },
  ADJUSTED: { label: 'Đã điều chỉnh', tone: 'violet' },
  WAIVED: { label: 'Miễn', tone: 'slate' },
}

// Tên trạng thái phía thu phí: Còn nợ / Chờ xác nhận / Đã thu.
export const FEE_STATUS = {
  UNPAID: { label: 'Còn nợ', tone: 'amber' },
  ADJUSTED: { label: 'Còn nợ (đã điều chỉnh)', tone: 'amber' },
  REPORTED: { label: 'Chờ xác nhận', tone: 'blue' },
  PAID: { label: 'Đã thu', tone: 'green' },
  WAIVED: { label: 'Miễn', tone: 'slate' },
}

export const ORDER_STATUS = {
  RESERVED: 'Đang giữ',
  WAITING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  IN_DELIVERY: 'Đang giao',
  DELIVERED: 'Đã giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  REFUND_PENDING: 'Đang hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
}
