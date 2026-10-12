import { Modal } from '../admin/AdminUi'
import { btn } from '../admin/styles'

export default function PaymentDecisionDialog({ action, orderId, busy, onClose, onSubmit }) {
  if (!action) return null
  return <Modal open title={action === 'CONFIRM' ? 'Xác nhận đã nhận đủ tiền' : 'Xác nhận chưa nhận được tiền'} onClose={() => { if (!busy) onClose() }} footer={<>
    <button type="button" className={btn.secondary} disabled={busy} onClick={onClose}>Quay lại đối chiếu</button>
    <button type="button" className={btn.primary} disabled={busy} onClick={onSubmit}>{busy ? 'Đang gửi…' : 'Lưu kết quả đối chiếu'}</button>
  </>}>
    <p className="text-sm text-slate-700">Bạn đang quyết định cho đơn #{orderId} và biên lai vừa xem. Hãy kiểm tra ứng dụng ngân hàng của mình trước khi lưu.</p>
    <p className="mt-3 text-sm text-slate-600">{action === 'CONFIRM' ? 'Chỉ chọn đã nhận đủ khi tiền sản phẩm thực sự đã vào tài khoản. Đơn sẽ chuyển sang PAID, chưa tự hoàn tất hay bàn giao.' : 'Người mua sẽ được yêu cầu kiểm tra giao dịch và gửi lại biên lai. Không yêu cầu chuyển thêm tiền, không hủy đơn hay mở bán lại món.'}</p>
  </Modal>
}
