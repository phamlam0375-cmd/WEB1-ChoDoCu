import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { btn } from '../admin/styles'
import { errorMessage } from '../../lib/api'
import { getBuyerCode, issueDeliveryCode } from '../../services/D13_XacThucGiaoHangOTP/completionApi'

export default function BuyerCodePanel({ orderId, onVerified }) {
  const [data, setData] = useState(null), [secret, setSecret] = useState(null), [error, setError] = useState('')
  const [busy, setBusy] = useState(false), [tick, setTick] = useState(() => Date.now()), [reload, setReload] = useState(0)
  const lock = useRef(false), verified = useRef(false), generation = useRef(0)
  useEffect(() => {
    let controller, disposed = false
    const load = async () => {
      if (lock.current) return
      controller?.abort(); controller = new AbortController()
      const current = generation.current
      try {
        const next = await getBuyerCode(orderId, controller.signal)
        if (disposed || controller.signal.aborted || current !== generation.current) return
        setData({ ...next, receivedAt: Date.now() }); setError('')
        setSecret(old => old && next.policy.allowed && !next.code.used && next.code.policy.allowed && String(old.expiresAt) === String(next.code.expiresAt) ? old : null)
        if (next.verified && !verified.current) { verified.current = true; onVerified?.() }
      } catch (e) {
        if (!disposed && !controller.signal.aborted && current === generation.current) { setError(errorMessage(e)); setSecret(null); setData(null) }
      }
    }
    load(); const timer = window.setInterval(load, 5000)
    return () => { disposed = true; controller?.abort(); window.clearInterval(timer) }
  }, [orderId, reload, onVerified])
  useEffect(() => { const timer = window.setInterval(() => setTick(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  const serverNow = data ? Date.parse(data.serverNow) + Math.max(0, tick - data.receivedAt) : tick
  const remaining = Math.max(0, Math.ceil((Date.parse(secret?.expiresAt) - serverNow) / 1000)) || 0
  const wait = data ? Math.max(0, data.code.retryAfterSeconds - Math.floor(Math.max(0, tick - data.receivedAt) / 1000)) : 0
  const visible = secret && remaining > 0 && data?.policy.allowed && !data.code.used
  async function issue() {
    if (lock.current) return
    lock.current = true; generation.current++; setBusy(true); setSecret(null); setError('')
    try {
      const result = await issueDeliveryCode(orderId)
      const { completionCode, ...metadata } = result.data
      setData({ ...metadata, receivedAt: Date.now() })
      setSecret({ value: completionCode, expiresAt: metadata.code.expiresAt })
    } catch (e) { setError(errorMessage(e)) }
    finally { lock.current = false; setBusy(false); setReload(n => n + 1) }
  }
  return <section className="mt-5 space-y-3 rounded-2xl border bg-white p-5" aria-label="Mã xác thực giao hàng">
    <h2 className="text-lg font-bold">Mã giao hàng cho tài xế</h2>
    <p>Chỉ tạo và cung cấp mã khi bạn đang nhận kiện hàng trực tiếp từ tài xế. Mã lấy hàng của người bán không dùng tại đây.</p>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {data?.verified ? <><p role="status">Đã xác thực giao hàng. Bạn kiểm tra sản phẩm trước khi xác nhận nhận hàng.</p><Link to={data.receiptUrl} className={btn.primary}>Xác nhận nhận hàng</Link></> : <>
      {visible && <div><output aria-label="Mã giao hàng" className="font-mono text-3xl font-bold tracking-widest">{secret.value}</output><p>Hết hạn sau {remaining} giây. Mã chỉ hiển thị trong phiên trang này.</p></div>}
      {secret && !visible && <p role="status">Mã đã hết hiệu lực. Vui lòng tạo mã mới khi đủ điều kiện.</p>}
      {data && !data.policy.allowed && <p className="text-amber-800">{data.policy.message}</p>}
      {data?.code.exists && !visible && <p>Mã cũ không thể xem lại. Tạo mã mới sẽ vô hiệu hóa mã trước đó.</p>}
      {wait > 0 && <p role="status">Có thể tạo lại sau {wait} giây.</p>}
      <button type="button" className={btn.primary} disabled={busy || !data?.policy.allowed || wait > 0} onClick={issue}>{busy ? 'Đang tạo mã…' : data?.code.exists ? 'Tạo lại mã giao hàng' : 'Tạo mã giao hàng'}</button>
    </>}
    <button type="button" className={`${btn.secondary} ml-2`} disabled={busy} onClick={() => setReload(n => n + 1)}>Tải lại trạng thái mã</button>
  </section>
}
