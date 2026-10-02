import { toast } from 'react-toastify'

// Tự sinh nội dung mã QR chuyển khoản theo chuẩn VietQR (NAPAS) dựa trên EMVCo QR Code.
// Ứng dụng ngân hàng quét mã sẽ tự điền ngân hàng, số tài khoản, số tiền và nội dung.
//
// Cấu trúc: mỗi trường gồm ID (2 số) + độ dài (2 số) + giá trị.
//   00 Phiên bản  01 Phương thức (12 = QR động có số tiền)
//   38 Thông tin người nhận: 00 GUID NAPAS, 01 (00 mã BIN ngân hàng, 01 số tài khoản), 02 dịch vụ chuyển nhanh
//   53 Tiền tệ (704 = VND)  54 Số tiền  58 Quốc gia  62 Thông tin thêm (08 = nội dung chuyển khoản)
//   63 Mã kiểm tra CRC16-CCITT của toàn bộ chuỗi phía trước.

const field = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`

// CRC16-CCITT (đa thức 0x1021, giá trị đầu 0xFFFF) theo yêu cầu của EMVCo.
export function crc16(text) {
  let crc = 0xffff
  for (let i = 0; i < text.length; i += 1) {
    crc ^= text.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Nội dung chuyển khoản chỉ nên gồm chữ không dấu, số và khoảng trắng.
const asciiContent = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .slice(0, 25)

export function buildVietQrPayload({ bankCode, accountNumber, amount, content }) {
  const beneficiary = field('00', String(bankCode)) + field('01', String(accountNumber))
  const merchant = field('00', 'A000000727') + field('01', beneficiary) + field('02', 'QRIBFTTA')
  const amountText = amount ? String(Math.round(Number(amount))) : ''
  const note = asciiContent(content)

  const body =
    field('00', '01') +
    field('01', amountText ? '12' : '11') +
    field('38', merchant) +
    field('53', '704') +
    (amountText ? field('54', amountText) : '') +
    field('58', 'VN') +
    (note ? field('62', field('08', note)) : '') +
    '6304'
  return body + crc16(body)
}

// Mã giao dịch ngẫu nhiên gắn sau mã đối soát, mỗi lần bấm Thanh toán ra một mã QR khác nhau.
// Bỏ các ký tự dễ nhầm (0/O, 1/I) để người dùng đọc lại không sai.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function randomPaymentCode(length = 6) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

export function copyText(text) {
  if (!navigator.clipboard) {
    toast.error('Trình duyệt không hỗ trợ sao chép')
    return
  }
  navigator.clipboard.writeText(String(text)).then(
    () => toast.success('Đã sao chép'),
    () => toast.error('Không sao chép được'),
  )
}
