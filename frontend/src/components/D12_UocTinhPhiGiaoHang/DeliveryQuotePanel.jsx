import { formatDecimalMoney, formatDateTime } from '../../lib/format'
export default function DeliveryQuotePanel({ context, area, vehicle, onChange, quote, fresh, accepted, estimating, disabled, onEstimate, onAccept }) {
  return <section className="mt-4 min-w-0 space-y-3 break-words rounded-xl border border-emerald-200 bg-emerald-50/40 p-4" aria-label="Báo giá giao hàng">
    <p className="text-sm"><strong>Điểm lấy hàng:</strong> {context.pickup ? `${context.pickup.pickupAddress} · ${context.pickup.pickupArea}` : context.message || 'Người bán chưa bổ sung khu vực lấy hàng.'}</p>
    {context.pickup && context.message && <p role="status" className="text-sm text-amber-800">{context.message}</p>}
    <label htmlFor="delivery-area" className="block text-sm font-bold">Khu vực nhận hàng
      <input id="delivery-area" list="delivery-area-options" maxLength={100} value={area} disabled={disabled} onChange={event => onChange('deliveryArea', event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal" />
      <datalist id="delivery-area-options">{context.deliveryAreas?.map(value => <option key={value} value={value} />)}</datalist>
    </label>
    <p className="text-xs text-slate-600">Chọn đúng khu vực của địa chỉ nhận đã nhập. Khu vực và địa chỉ chi tiết cùng được gắn với báo giá.</p>
    <label htmlFor="delivery-vehicle" className="block text-sm font-bold">Loại phương tiện
      <select id="delivery-vehicle" value={vehicle} disabled={disabled} onChange={event => onChange('vehicleType', event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal"><option value="">Chọn phương tiện</option>{context.vehicleTypes?.map(value => <option key={value} value={value}>{value}</option>)}</select>
    </label>
    <button type="button" disabled={disabled || estimating || !context.pickup} onClick={onEstimate} className="rounded-xl border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">{estimating ? 'Đang tính phí...' : 'Tính phí giao hàng'}</button>
    {quote && fresh && <div className="space-y-2 border-t border-emerald-200 pt-3 text-sm" aria-live="polite">
      <p>Phí giao hàng dự kiến là <strong data-testid="quoted-fee">{formatDecimalMoney(quote.amount)}</strong>.</p>
      <p>{quote.pickupArea} → {quote.deliveryArea} · {quote.vehicleType}</p>
      {quote.estimatedMinutes != null && <p>Thời gian tham khảo: {quote.estimatedMinutes} phút, không phải cam kết thời điểm giao.</p>}
      <p>Hiệu lực đến {formatDateTime(quote.expiresAt)}. Chưa có tài xế được phân công.</p>
      {accepted ? <p className="font-bold text-emerald-800">Đã chọn báo giá trên biểu mẫu; phí chỉ được chốt khi đặt đơn thành công.</p> : <button type="button" onClick={onAccept} disabled={disabled} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white">Dùng mức phí này</button>}
    </div>}
    {quote && !fresh && <p role="alert" className="text-sm font-bold text-rose-700">Báo giá giao hàng đã hết hạn. Vui lòng tính lại phí.</p>}
  </section>
}
