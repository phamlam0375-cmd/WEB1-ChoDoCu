import { useEffect, useRef } from 'react'
import { btn } from '../admin/styles'
import { formatDecimalMoney } from '../../lib/format'
import { keepDialogFocus } from '../D05_TheoDoiDonHang/dialogFocus'

export default function AcceptDeliveryDialog({ delivery, submitting, onClose, onConfirm }) {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    element.showModal() // Focus trap, Escape và trả focus dùng cơ chế dialog của trình duyệt.
    return () => element.close()
  }, [])
  return <dialog ref={dialog} onKeyDown={keepDialogFocus} aria-labelledby="accept-title" className="d-workspace d-modal m-auto w-[calc(100%-2rem)] max-w-md space-y-4 overflow-y-auto rounded-2xl border-0 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/40"
    onCancel={event => { event.preventDefault(); if (!submitting) onClose() }}>
    <h2 id="accept-title" className="text-xl font-bold">Nhận chuyến #{delivery.deliveryId}?</h2>
    <p>{delivery.pickupArea} → {delivery.deliveryArea}</p><p>Phí đã chốt: {formatDecimalMoney(delivery.driverFee)}</p>
    <p className="text-sm text-slate-600">Nhận chuyến chuyển bạn sang BUSY. Chưa xác nhận lấy hàng, giao hàng hay thanh toán phí.</p>
    <div className="flex justify-end gap-3"><button type="button" className={btn.secondary} disabled={submitting} onClick={onClose}>Quay lại</button><button type="button" className={btn.primary} disabled={submitting} onClick={onConfirm}>{submitting ? 'Đang nhận…' : 'Xác nhận nhận chuyến'}</button></div>
  </dialog>
}
