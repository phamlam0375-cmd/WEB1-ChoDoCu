import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { Card, Loading, PageHeader } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import { getAccessToken } from '../../lib/auth'
import { errorMessage } from '../../lib/api'
import { getDriverProfile, saveDriverProfile, setDriverAvailability } from '../../services/D11_HoSoVanHanhTaiXe/profileApi'
import PrivateQr from '../../components/D11_HoSoVanHanhTaiXe/PrivateQr'

const fields = [['VehicleType', 'Loại phương tiện'], ['VehiclePlate', 'Biển số'], ['ServiceArea', 'Khu vực hoạt động'], ['MaxDistanceKm', 'Bán kính nhận chuyến (km)'], ['BankName', 'Ngân hàng'], ['BankAccountNumber', 'Số tài khoản'], ['BankAccountHolder', 'Tên chủ tài khoản']]
const labels = Object.fromEntries([...fields, ['ReceivingMethod', 'Tài khoản đầy đủ hoặc QR nhận phí'], ['BankDetails', 'Bộ thông tin ngân hàng đầy đủ']])
const fromProfile = profile => Object.fromEntries(fields.map(([key]) => [key, profile?.[key] ?? '']))
function Profile() {
  const location = useLocation()
  const [data, setData] = useState(null)
  const [form, setForm] = useState(fromProfile(null))
  const [qr, setQr] = useState(null)
  const [removeQr, setRemoveQr] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [errors, setErrors] = useState({})
  const [denied, setDenied] = useState(null)
  const [conflict, setConflict] = useState(null)
  const [unauthorized, setUnauthorized] = useState(false)
  const submitting = useRef(false), fileInput = useRef(null)
  function apply(next) {
    setData(next); setForm(fromProfile(next.profile)); setQr(null); setRemoveQr(false); setDirty(false); setErrors({})
    if (fileInput.current) fileInput.current.value = ''
  }
  function failure(e) {
    setError(errorMessage(e))
    setConflict(e.response?.data?.errors?.trackingUrl || null)
    if (e.response?.status === 401) setUnauthorized(true)
    if (e.response?.status === 403) setDenied(e.response.data.errors?.applicationStatus || 'Chưa đủ quyền DRIVER')
    const field = e.response?.data?.errors?.field
    if (field) setErrors({ [field]: e.response.data.message })
  }
  useEffect(() => {
    const controller = new AbortController()
    getDriverProfile(controller.signal).then(next => { if (!controller.signal.aborted) apply(next) }).catch(e => { if (!controller.signal.aborted) failure(e) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  async function refresh() {
    if (submitting.current) return
    submitting.current = true; setBusy(true); setError(''); setNotice(''); setConflict(null)
    try { apply(await getDriverProfile()); setDenied(null) } catch (e) { failure(e) }
    finally { submitting.current = false; setBusy(false) }
  }
  function validate() {
    const next = {}
    for (const [key] of fields) {
      const value = String(form[key]).trim()
      if (['VehicleType', 'VehiclePlate', 'ServiceArea'].includes(key) && !value) next[key] = 'Vui lòng nhập đầy đủ thông tin vận hành.'
      if (data.fieldLimits[key] && value.length > data.fieldLimits[key]) next[key] = `Tối đa ${data.fieldLimits[key]} ký tự.`
      if ([...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) next[key] = 'Không dùng ký tự điều khiển.'
    }
    if (form.MaxDistanceKm !== '' && (!/^\d{1,4}(?:\.\d{1,2})?$/.test(form.MaxDistanceKm) || Number(form.MaxDistanceKm) <= 0 || Number(form.MaxDistanceKm) > 9999.99)) next.MaxDistanceKm = 'Nhập từ 0.01 đến 9999.99 km hoặc để trống.'
    const bank = ['BankName', 'BankAccountNumber', 'BankAccountHolder']
    if (bank.some(k => form[k].trim())) for (const k of bank) if (!form[k].trim()) next[k] = 'Vui lòng nhập đủ bộ thông tin ngân hàng.'
    if (form.BankAccountNumber && !/^\d{1,30}$/.test(form.BankAccountNumber.trim())) next.BankAccountNumber = 'Số tài khoản gồm 1–30 chữ số.'
    setErrors(next); return Object.keys(next).length === 0
  }
  async function mutate(status) {
    if (submitting.current || (!status && !validate())) return
    submitting.current = true; setBusy(true); setError(''); setNotice(''); setConflict(null)
    let saved = false
    try {
      const response = status ? await setDriverAvailability(status) : await saveDriverProfile({ ...form, MaxDistanceKm: form.MaxDistanceKm === '' ? null : form.MaxDistanceKm, RemoveQr: removeQr }, qr)
      saved = true; setNotice(response.message)
      apply(await getDriverProfile())
    } catch (e) { failure(e); if (saved) setNotice('Thao tác đã được lưu nhưng chưa tải lại được dữ liệu. Hãy bấm Tải lại.') }
    finally { submitting.current = false; setBusy(false) }
  }
  if (!getAccessToken({ sessionOnly: true }) || unauthorized) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />
  const active = data?.activeDelivery, status = data?.profile?.AvailabilityStatus || 'OFFLINE'
  return <>
    <PageHeader title="Hồ sơ tài xế" description="Thông tin vận hành và nhận phí giao hàng trực tiếp." actions={<Link className={btn.secondary} to="/driver/deliveries">Chuyến tài xế</Link>} />
    {notice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-4">{notice}</p>}
    {error && <div role="alert" className="mb-4 rounded-lg bg-rose-50 p-4"><p>{error}</p>{conflict && <Link to={conflict}>Theo dõi chuyến đang phụ trách</Link>}{denied && <p>Trạng thái đối tác: {denied}. <Link to="/partner-application?type=DRIVER">Mở hồ sơ C01</Link></p>}</div>}
    {loading ? <Loading /> : data && <>
      <Card className="mb-5 space-y-3 p-5">
        <p>Đối tác DRIVER: {data.application?.Status === 'APPROVED' ? 'Đã được B02 duyệt' : data.application?.Status}</p>
        <p>Trạng thái vận hành: <strong data-testid="driver-availability">{active ? 'BUSY' : status}</strong></p>
        {!data.profile && <p>Chưa có hồ sơ vận hành. Lưu lần đầu sẽ tạo hồ sơ ở trạng thái OFFLINE.</p>}
        {active && <p>Chuyến #{active.deliveryId} · {active.status}. Hồ sơ tạm khóa trong lúc phụ trách chuyến để giữ thông tin nhận phí. <Link className={btn.secondary} to={active.trackingUrl}>Theo dõi chuyến đang phụ trách</Link></p>}
        {status === 'BUSY' && !active && <p>Chuyến đã kết thúc: bạn có thể chọn OFFLINE hoặc bật nhận chuyến trở lại.</p>}
        {!!data.readiness.missing.length && <p>Chưa đủ điều kiện nhận chuyến: {data.readiness.missing.map(key => labels[key] || key).join(', ')}.</p>}
        <button className={btn.secondary} type="button" disabled={busy || !!active || !data.profile || dirty} onClick={() => mutate('OFFLINE')}>Tắt nhận chuyến</button>{' '}
        <button className={btn.primary} type="button" disabled={busy || !!active || !data.profile || dirty || !data.readiness.ready} onClick={() => mutate('AVAILABLE')}>Bật nhận chuyến</button>
        {dirty && <p className="text-sm">Lưu hồ sơ trước khi đổi trạng thái nhận chuyến.</p>}
      </Card>
      <Card className="p-5"><form onSubmit={e => { e.preventDefault(); mutate() }}>
        <fieldset disabled={busy || !!active || !!denied} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="block text-sm" htmlFor={`driver-${key}`}>{label}
            <input id={`driver-${key}`} className={`${input} mt-1`} type="text" inputMode={key === 'MaxDistanceKm' ? 'decimal' : key === 'BankAccountNumber' ? 'numeric' : 'text'} maxLength={data.fieldLimits[key] || 7} list={key === 'VehicleType' ? 'driver-vehicles' : undefined} value={form[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined} onChange={e => { setForm(previous => ({ ...previous, [key]: e.target.value })); setDirty(true) }} />
            {errors[key] && <span id={`error-${key}`} className="text-rose-700">{errors[key]}</span>}
          </label>)}</div>
          <datalist id="driver-vehicles">{data.vehicleTypes.map(type => <option key={type} value={type} />)}</datalist>
          <p className="text-sm text-slate-600">Nhập mã phương tiện và khu vực khớp với tuyến đã cấu hình. Bán kính để trống nghĩa là không giới hạn theo hồ sơ; bán kính có giá trị chỉ lọc được chuyến đã có khoảng cách tuyến tin cậy. Dịch vụ báo giá và tuyến mới chưa sẵn sàng.</p>
          <section aria-label="QR nhận phí"><p className="font-semibold">QR nhận phí (JPG/PNG, tối đa 5MB)</p>
            <p className="text-sm">Chỉ cần bộ ngân hàng đầy đủ hoặc QR. Hệ thống kiểm tra file và quyền tải lên; chưa xác minh chủ tài khoản hay nội dung thanh toán trong QR.</p>
            {!removeQr && (qr || (data.qrValid && data.profile?.QrImageUrl)) && <PrivateQr file={qr} url={data.profile?.QrImageUrl} />}
            {data.profile?.QrImageUrl && !data.qrValid && !qr && <p>QR cũ chưa có quyền sở hữu/file hợp lệ theo D11. Vui lòng tải lại hoặc xóa.</p>}
            <input ref={fileInput} aria-label="Chọn QR nhận phí" type="file" accept="image/png,image/jpeg" onChange={e => {
              const file = e.target.files[0]
              if (file && (!['image/png', 'image/jpeg'].includes(file.type) || file.size > data.qrMaxBytes)) { setErrors(previous => ({ ...previous, Qr: 'Chỉ chọn JPG/PNG tối đa 5MB.' })); e.target.value = ''; return }
              setErrors(previous => ({ ...previous, Qr: '' })); setQr(file || null); setRemoveQr(false); setDirty(true)
            }} />
            {errors.Qr && <p role="alert">{errors.Qr}</p>}
            {(qr || data.profile?.QrImageUrl) && <button type="button" className={`${btn.secondary} ml-2`} onClick={() => { setQr(null); setRemoveQr(true); setDirty(true); if (fileInput.current) fileInput.current.value = '' }}>Xóa QR</button>}
            {removeQr && <p>QR sẽ được gỡ khi lưu hồ sơ; chưa xóa trên máy chủ.</p>}
          </section>
          <button className={btn.primary} type="submit">{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
        </fieldset>
      </form></Card>
    </>}
    <button className={`${btn.secondary} mt-4`} type="button" disabled={loading || busy} onClick={refresh}>{dirty ? 'Bỏ thay đổi và tải lại' : 'Tải lại hồ sơ'}</button>
  </>
}
export default function DriverProfilePage() {
  return <div className="min-h-screen bg-slate-50"><Header /><main className="mx-auto max-w-5xl px-4 py-8"><Profile /></main><Footer /></div>
}
