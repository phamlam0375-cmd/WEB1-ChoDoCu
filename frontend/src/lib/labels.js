// Nhãn tiếng Việt và màu cho các trạng thái của phân hệ B.
export const ROLE_LABELS = {
  USER: 'Người dùng',
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
  NEED_INFO: { label: 'Cần bổ sung', tone: 'blue' },
  APPROVED: { label: 'Đã duyệt', tone: 'green' },
  REJECTED: { label: 'Từ chối', tone: 'red' },
}

export const PARTNER_TYPE = { SELLER: 'Người bán', DRIVER: 'Tài xế' }

export const CATEGORY_STATUS = {
  ACTIVE: { label: 'Đang dùng', tone: 'green' },
  INACTIVE: { label: 'Tạm ẩn', tone: 'slate' },
}

export const LISTING_STATUS = {
  DRAFT: { label: 'Nháp', tone: 'slate' },
  PENDING: { label: 'Chờ duyệt', tone: 'amber' },
  ACTIVE: { label: 'Đang bán', tone: 'green' },
  RESERVED: { label: 'Đang giữ', tone: 'blue' },
  SOLD: { label: 'Đã bán', tone: 'slate' },
  HIDDEN: { label: 'Đã gỡ', tone: 'red' },
  REJECTED: { label: 'Từ chối', tone: 'red' },
}

export const CONDITION_LABELS = {
  LIKE_NEW: 'Như mới',
  GOOD: 'Tốt',
  FAIR: 'Khá',
  POOR: 'Cũ nhiều',
}

export const REPORT_STATUS = {
  PENDING: { label: 'Chờ xử lý', tone: 'amber' },
  PROCESSING: { label: 'Đang xử lý', tone: 'blue' },
  RESOLVED: { label: 'Có vi phạm', tone: 'green' },
  REJECTED: { label: 'Bác bỏ', tone: 'slate' },
}

export const REPORT_TARGET = { LISTING: 'Tin đăng', USER: 'Tài khoản', ORDER: 'Đơn hàng' }

export const REFUND_STATUS = {
  PENDING: { label: 'Chờ duyệt', tone: 'amber' },
  APPROVED: { label: 'Chờ người bán trả', tone: 'blue' },
  REJECTED: { label: 'Từ chối', tone: 'red' },
  SELLER_TRANSFERRED: { label: 'Người bán đã chuyển', tone: 'violet' },
  COMPLETED: { label: 'Hoàn tất', tone: 'green' },
}

export const COMMISSION_STATUS = {
  UNPAID: { label: 'Chưa nộp', tone: 'amber' },
  REPORTED: { label: 'Đã báo nộp', tone: 'blue' },
  PAID: { label: 'Đã thu', tone: 'green' },
  ADJUSTED: { label: 'Đã điều chỉnh', tone: 'violet' },
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
