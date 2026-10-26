import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { Card, ErrorState, Loading, PageHeader } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import PickupProof from '../../components/D08_XacNhanLayHang/PickupProof'
import { getAccessToken } from '../../lib/auth'
import { errorMessage } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { DELIVERY_STATUS } from '../../lib/labels'
import { getPickupPreview, getSellerPickup, issuePickupCode, confirmPickup, validatePickupImage } from '../../services/D08_XacNhanLayHang/pickupApi'

function usePickupResource(id, seller) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState({ loading: true, data: null, error: '', unauthorized: false })
  const generation = useRef(0)
  const refresh = useCallback(() => { generation.current++; setRevision(value => value + 1) }, [])
  const setMutation = data => { generation.current++; setResult({ loading: false, data, error: '', unauthorized: false }) }
  useEffect(() => {
    const controller = new AbortController(), current = ++generation.current
    async function load() {
      setResult(previous => ({ ...previous, loading: true, error: '' }))
      try {
        const data = await (seller ? getSellerPickup(id, { signal: controller.signal }) : getPickupPreview(id, { signal: controller.signal }))
        if (!controller.signal.aborted && current === generation.current) setResult({ data, loading: false, error: '', unauthorized: false })
      } catch (error) {
        if (!controller.signal.aborted && current === generation.current) setResult(previous => ({ ...previous, loading: false, error: errorMessage(error), unauthorized: error.response?.status === 401 }))
      }
    }
    load()
    return () => controller.abort()
  }, [id, seller, revision])
  return { ...result, refresh, setMutation }
}
function useServerTime(serverNow) {
  const [now, setNow] = useState(null)
  useEffect(() => {
    if (!serverNow) return
    const start = performance.now(), server = new Date(serverNow).getTime()
    const tick = () => setNow(server + performance.now() - start)
    tick(); const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [serverNow])
  return now
}
function FilePreview({ file }) {
  const image = useRef(null)
  useEffect(() => {
    if (!file || !image.current) return
    const objectUrl = URL.createObjectURL(file)
    image.current.src = objectUrl
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return file ? <img ref={image} alt="Ảnh kiện sẽ gửi để xác nhận lấy hàng" className="mt-3 max-h-64 max-w-full rounded-xl border border-slate-200 object-contain" /> : null
}
function PickupContent({ id, seller }) {
  const location = useLocation(), resource = usePickupResource(id, seller)
  const [code, setCode] = useState(''), [intact, setIntact] = useState(false), [file, setFile] = useState(null)
  const [handover, setHandover] = useState(false), [issued, setIssued] = useState(null)
  const [sending, setSending] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('')
  const lock = useRef(false), fileInput = useRef(null)
  const now = useServerTime(resource.data?.serverNow)
  const { data, loading } = resource
  if (!getAccessToken({ sessionOnly: true }) || resource.unauthorized) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace state={{ from: location }} />
  async function submit(event) {
    event.preventDefault()
    if (lock.current || loading) return
    if (seller ? !handover : !intact) { setError(seller ? 'Vui lòng chủ động xác nhận bàn giao cho đúng tài xế.' : 'Vui lòng xác nhận kiện hàng còn nguyên vẹn.'); return }
    if (!seller && !/^\d{6}$/.test(code)) { setError('Mã xác nhận không đúng hoặc đã hết hiệu lực.'); return }
    const fileError = validatePickupImage(file)
    if (fileError) { setError(fileError); return }
    lock.current = true; setSending(true); setError(''); setNotice('')
    if (seller) setIssued(null)
    try {
      const response = seller ? await issuePickupCode(id) : await confirmPickup(id, { pickupCode: code, packageIntact: intact, file })
      setNotice(response.message)
      if (seller) {
        setIssued({ code: response.data.pickupCode, expiresAt: response.data.code.expiresAt })
        // Không giữ mã rõ trong resource dùng chung, storage hoặc URL.
        const { pickupCode: oneTimeCode, ...preview } = response.data
        if (!oneTimeCode) throw new Error('Máy chủ chưa trả mã bàn giao.')
        resource.setMutation(preview)
      } else {
        setCode(''); setFile(null); if (fileInput.current) fileInput.current.value = ''
        resource.setMutation(response.data)
      }
      resource.refresh()
    } catch (e) {
      setError(errorMessage(e, 'Không nhận được phản hồi. Hãy tải lại để kiểm tra trạng thái trước khi thử tiếp.'))
      if (!seller) setCode('')
      if (e.response?.status === 401) resource.setMutation(null)
      resource.refresh()
    } finally { lock.current = false; setSending(false) }
  }
  const cooldown = data?.code.nextIssueAt && now !== null ? Math.max(0, Math.ceil((new Date(data.code.nextIssueAt).getTime() - now) / 1000)) : 0
  const visibleCode = issued && data?.code.expiresAt === issued.expiresAt && !data.code.used && now !== null && new Date(issued.expiresAt).getTime() > now
  const codeExpired = data?.code.expiresAt && now !== null && new Date(data.code.expiresAt).getTime() <= now
  return <>
    <PageHeader code={seller ? 'C07 / D08' : 'D08'} title={seller ? 'Bàn giao và cấp mã lấy hàng' : 'Xác nhận đã lấy hàng'} actions={<>
      <Link className={btn.secondary} to={data?.trackingUrl || (seller ? '/seller/orders' : '/driver/deliveries')}>Quay lại đơn/chuyến</Link>
      <button type="button" className={btn.secondary} disabled={loading || sending} onClick={resource.refresh}>Tải lại</button>
    </>} />
    {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-900">{notice}</p>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    {loading && !data ? <Loading /> : resource.error ? <ErrorState message={resource.error} onRetry={resource.refresh} /> : data && <>
      <Card className="mb-5 space-y-3 break-words p-5">
        <h2 className="text-lg font-bold">Chuyến #{data.deliveryId || 'chưa phân công'} · Đơn #{data.orderId}</h2>
        <p className="font-semibold text-emerald-800">{DELIVERY_STATUS[data.deliveryStatus] || 'Chưa có chuyến giao'}</p>
        <p>Sản phẩm/kiện: {data.product.title || `Tin #${data.product.listingId}`}</p>
        {data.product.knownDefects && <p>Tình trạng đã mô tả: {data.product.knownDefects}</p>}
        <p>Người bán: {data.seller.name}{data.seller.phone ? ` · ${data.seller.phone}` : ''}</p>
        <p>Địa điểm lấy hàng: {data.pickupAddress || 'Chưa có dữ liệu'}</p>
        {data.driverId && <p>Tài xế được phân công: #{data.driverId}</p>}
        {data.sellerHandoverAt && <p>Người bán xác nhận bàn giao: {formatDateTime(data.sellerHandoverAt)}</p>}
        {data.pickedUpAt && <p className="font-bold">Đã lấy hàng lúc {formatDateTime(data.pickedUpAt)}</p>}
        {data.pickupProofUrl && <PickupProof key={data.deliveryId} orderId={data.orderId} deliveryId={data.deliveryId} />}
        <p className="text-sm text-slate-600">{data.nextStep}</p>
      </Card>
      {!data.pickedUpAt && <Card className="p-5">
        {!data.policy.allowed && <p role="status" className="mb-4 text-amber-800">{data.policy.message}</p>}
        {seller ? <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-600">Đây là bước bàn giao tối thiểu: bạn phải đã chuẩn bị hàng và đối chiếu đúng tài xế D07 tại điểm lấy hàng. Thao tác này không tự xác nhận tài xế đã lấy kiện.</p>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={handover} onChange={e => setHandover(e.target.checked)} disabled={sending} className="mt-1 accent-emerald-600" />Tôi xác nhận đã kiểm tra và bàn giao đúng kiện cho tài xế được phân công.</label>
          {visibleCode && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold">Mã lấy hàng — chỉ cung cấp trực tiếp cho đúng tài xế</p><output aria-label="Mã lấy hàng" className="mt-2 block text-3xl font-bold tracking-[0.25em]">{issued.code}</output><p className="mt-2 text-sm">Hiệu lực đến {formatDateTime(issued.expiresAt)}.</p></div>}
          <p className="text-sm text-slate-600">Mã chỉ hiện khi cấp thành công. Tải lại trang sẽ không xem lại mã cũ; nếu không còn giữ mã, hãy cấp lại sau thời gian chờ. Mã mới làm mã cũ hết hiệu lực.</p>
          {cooldown > 0 && <p role="status" className="text-sm text-amber-800">Vui lòng chờ {cooldown} giây trước khi tạo mã mới.</p>}
          <button type="submit" className={btn.primary} disabled={sending || loading || !handover || !data.policy.allowed || cooldown > 0 || now === null}>{sending ? 'Đang cấp mã…' : data.code.exists ? 'Cấp lại mã lấy hàng' : 'Xác nhận bàn giao và cấp mã'}</button>
        </form> : <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold" htmlFor="pickup-code">Mã lấy hàng do người bán cung cấp<input id="pickup-code" type="text" inputMode="numeric" autoComplete="off" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={sending} className={`${input} mt-2 max-w-xs tracking-[0.2em]`} /></label>
          {data.code.expiresAt && <p className="text-sm text-slate-600">Mã có hiệu lực đến {formatDateTime(data.code.expiresAt)}. Còn {data.code.attemptsRemaining} lần thử.</p>}
          {codeExpired && <p role="status" className="text-sm text-rose-700">Mã xác nhận không đúng hoặc đã hết hiệu lực. Hãy nhờ người bán cấp lại mã.</p>}
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={intact} onChange={e => setIntact(e.target.checked)} disabled={sending} className="mt-1 accent-emerald-600" />Tôi đã đối chiếu đúng kiện và xác nhận kiện hàng còn nguyên vẹn.</label>
          <p className="text-sm text-amber-800">Nếu kiện không nguyên vẹn hoặc không đúng, chưa xác nhận lấy hàng; hãy liên hệ người bán để xử lý. D08 không tự hủy đơn hoặc tạo hoàn tiền.</p>
          <label className="block text-sm font-semibold" htmlFor="pickup-proof">Ảnh bằng chứng (không bắt buộc, JPG/PNG tối đa 5 MB)<input id="pickup-proof" ref={fileInput} type="file" accept="image/jpeg,image/png" disabled={sending} className="mt-2 block w-full text-sm" onChange={e => {
            const selected = e.target.files?.[0] || null, message = validatePickupImage(selected)
            setError(message || ''); setFile(message ? null : selected); if (message) e.target.value = ''
          }} /></label>
          <FilePreview key={file?.name || 'no-file'} file={file} />
          <button type="submit" className={btn.primary} disabled={sending || loading || !data.canConfirm || codeExpired || !intact || code.length !== 6}>{sending ? 'Đang xác nhận…' : 'Xác nhận đã lấy hàng'}</button>
        </form>}
      </Card>}
      {data.pickedUpAt && <Link to={data.trackingUrl} className={btn.primary}>Mở tiến trình D05</Link>}
      {!seller && data.pickedUpAt && data.progress?.href && <Link to={data.progress.href} className={`${btn.secondary} ml-2`}>Cập nhật tiến độ giao hàng</Link>}
    </>}
  </>
}
export default function PickupPage({ seller = false }) {
  const params = useParams(), id = seller ? params.orderId : params.deliveryId
  return <div className="min-h-screen bg-slate-50 text-slate-900"><Header /><main className="mx-auto min-h-[600px] max-w-4xl px-4 py-8 sm:px-6"><PickupContent key={`${seller}:${id}`} id={id} seller={seller} /></main><Footer /></div>
}
