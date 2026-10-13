const moneyFormatter = new Intl.NumberFormat('vi-VN')

// Hiển thị chính xác DECIMAL khi cần; không đổi cách làm tròn hiện có của B.
export function formatDecimalMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  const match = /^(-?\d+)(?:\.(\d{1,2}))?$/.exec(String(value))
  if (!match) return '—'
  const fraction = (match[2] || '00').padEnd(2, '0')
  return `${BigInt(match[1]).toLocaleString('vi-VN')}${fraction === '00' ? '' : `,${fraction}`} ₫`
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  return `${moneyFormatter.format(Math.round(Number(value)))}đ`
}

export function formatNumber(value) {
  return moneyFormatter.format(Number(value || 0))
}

// Rút gọn số tiền lớn cho trục biểu đồ: 1,2 tr, 350 N.
export function formatCompactMoney(value) {
  const number = Number(value || 0)
  if (Math.abs(number) >= 1e9) return `${(number / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`
  if (Math.abs(number) >= 1e6) return `${(number / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`
  if (Math.abs(number) >= 1e3) return `${(number / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} N`
  return String(number)
}

export function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

// YYYY-MM-DD theo giờ Việt Nam, dùng cho ô chọn ngày.
export function toDateInput(date) {
  return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

// Bỏ các tham số rỗng trước khi gửi lên API.
export function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
}
