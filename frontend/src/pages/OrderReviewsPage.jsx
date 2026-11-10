import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Card, ErrorState, Loading, PageHeader } from '../components/admin/AdminUi'
import { btn, input } from '../components/admin/styles'
import { errorMessage } from '../lib/api'
import { createOrderReview, listOrderReviews } from '../services/reviewApi'

const targetLabels = { SELLER: 'Người bán', DRIVER: 'Đối tác giao hàng' }

function ReviewForm({ orderId, targetType, existing, disabled, onCreated }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const label = targetLabels[targetType]

  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const review = await createOrderReview(orderId, targetType, { rating, comment: comment.trim() || null })
      onCreated(review)
      setComment('')
      toast.success(`Đã gửi đánh giá ${label.toLowerCase()}.`)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  if (existing) {
    return <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
      <p className="font-semibold">Bạn đã đánh giá {label.toLowerCase()}</p>
      <p className="mt-1 text-amber-600" aria-label={`${existing.Rating} trên 5 sao`}>{'★'.repeat(existing.Rating)}{'☆'.repeat(5 - existing.Rating)}</p>
      {existing.Comment && <p className="mt-2 whitespace-pre-wrap">{existing.Comment}</p>}
      {existing.Reply && <p className="mt-3 border-t border-emerald-200 pt-3"><strong>Phản hồi:</strong> {existing.Reply}</p>}
    </div>
  }

  return <form onSubmit={submit} className="mt-4 space-y-4">
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <fieldset disabled={disabled || busy}>
      <legend className="mb-2 text-sm font-medium text-slate-700">Mức đánh giá</legend>
      <div className="flex gap-1" role="radiogroup" aria-label={`Đánh giá ${label.toLowerCase()}`}>
        {[1, 2, 3, 4, 5].map(value => <button
          key={value}
          type="button"
          role="radio"
          aria-checked={rating === value}
          aria-label={`${value} sao`}
          onClick={() => setRating(value)}
          className={`text-3xl leading-none ${value <= rating ? 'text-amber-400' : 'text-slate-300'}`}
        >★</button>)}
      </div>
    </fieldset>
    <label className="block text-sm font-medium text-slate-700">
      Nhận xét (không bắt buộc)
      <textarea className={`${input} mt-1 min-h-24 resize-y`} maxLength={1000} value={comment} disabled={disabled || busy} onChange={event => setComment(event.target.value)} placeholder={`Chia sẻ trải nghiệm với ${label.toLowerCase()}...`} />
    </label>
    <button className={btn.primary} type="submit" disabled={disabled || busy}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
  </form>
}

export default function OrderReviewsPage() {
  const { orderId } = useParams()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setReviews(await listOrderReviews(orderId))
      setError('')
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    const controller = new AbortController()
    listOrderReviews(orderId, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) {
        setReviews(data)
        setError('')
        setLoading(false)
      }
    }).catch(requestError => {
      if (!controller.signal.aborted) {
        setError(errorMessage(requestError))
        setLoading(false)
      }
    })
    return () => controller.abort()
  }, [orderId])

  const existingByType = useMemo(() => Object.fromEntries(reviews.map(review => [review.TargetType, review])), [reviews])

  return <>
    <PageHeader title={`Đánh giá đơn hàng #${orderId}`} description="Đánh giá riêng người bán và đối tác giao hàng sau khi đơn đã hoàn tất." actions={<Link to={`/orders/${orderId}/tracking`} className={btn.secondary}>Quay lại đơn hàng</Link>} />
    {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> : <div className="grid gap-5 md:grid-cols-2">
      <Card className="p-5">
        <h2 className="text-lg font-bold">Đánh giá người bán</h2>
        <p className="mt-1 text-sm text-slate-500">Chất lượng sản phẩm và cách hỗ trợ của người bán.</p>
        <ReviewForm orderId={orderId} targetType="SELLER" existing={existingByType.SELLER} onCreated={review => setReviews(previous => [...previous, review])} />
      </Card>
      <Card className="p-5">
        <h2 className="text-lg font-bold">Đánh giá đối tác giao hàng</h2>
        <p className="mt-1 text-sm text-slate-500">Chỉ áp dụng nếu đơn có sử dụng giao hàng tận nơi.</p>
        <ReviewForm orderId={orderId} targetType="DRIVER" existing={existingByType.DRIVER} onCreated={review => setReviews(previous => [...previous, review])} />
      </Card>
    </div>}
  </>
}
