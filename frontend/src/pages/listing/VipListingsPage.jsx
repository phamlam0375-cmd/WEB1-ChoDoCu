import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, Crown, RefreshCw, Square, Wallet } from 'lucide-react'
import { toast } from 'react-toastify'

import Header from '../../components/Header'
import { errorMessage } from '../../lib/api'
import { getSellerVipPromotions, stopVipPromotion } from '../../services/listingApi'

const formatNumber = (value) => Number(value || 0).toLocaleString('vi-VN')

const formatDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Chưa xác định'
    : date.toLocaleString('vi-VN')
}

const getRemainingText = (endsAt, now) => {
  const remainingMinutes = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 60000))
  const days = Math.floor(remainingMinutes / (24 * 60))
  const hours = Math.floor((remainingMinutes % (24 * 60)) / 60)
  const minutes = remainingMinutes % 60

  if (days > 0) return `${days} ngày ${hours} giờ`
  if (hours > 0) return `${hours} giờ ${minutes} phút`
  return `${minutes} phút`
}

export default function VipListingsPage() {
  const [promotions, setPromotions] = useState([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  // The clock is refreshed once per minute so the remaining time stays current.
  // eslint-disable-next-line react-hooks/purity
  const [now, setNow] = useState(Date.now())

  const loadPromotions = useCallback(async () => {
    try {
      setLoading(true)
      const response = await getSellerVipPromotions()
      setPromotions(Array.isArray(response.data?.promotions) ? response.data.promotions : [])
      setBalance(Number(response.data?.balance || 0))
    } catch (error) {
      toast.error(errorMessage(error, 'Không thể tải danh sách tin VIP.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Loading data on mount is the synchronization point for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPromotions()
  }, [loadPromotions])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const activePromotions = useMemo(
    () => promotions.filter((promotion) => new Date(promotion.EndsAt).getTime() > now),
    [now, promotions],
  )

  const handleStop = async (promotion) => {
    try {
      await stopVipPromotion(promotion.ListingId)
      window.dispatchEvent(new Event('credit-balance-updated'))
      toast.success('Đã dừng tin VIP và hoàn Credit còn lại.')
      await loadPromotions()
    } catch (error) {
      toast.error(errorMessage(error, 'Không thể dừng tin VIP.'))
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-72px)] bg-slate-50/70 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Quản lý quảng bá</p>
              <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Tin đang VIP</h1>
              <p className="mt-2 text-sm text-slate-500">
                Theo dõi thời gian VIP và Credit đã sử dụng cho từng tin đăng.
              </p>
            </div>
            <button
              type="button"
              onClick={loadPromotions}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Crown size={20} />
                </span>
                <div>
                  <p className="text-sm text-slate-500">Tin đang VIP</p>
                  <p className="text-2xl font-black text-slate-900">{activePromotions.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
                  <Wallet size={20} />
                </span>
                <div>
                  <p className="text-sm text-slate-500">Số dư Credit</p>
                  <p className="text-2xl font-black text-slate-900">{formatNumber(balance)}</p>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Đang tải danh sách tin VIP...
            </div>
          ) : activePromotions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Crown className="mx-auto size-10 text-slate-300" />
              <h2 className="mt-4 font-bold text-slate-800">Chưa có tin VIP đang hoạt động</h2>
              <p className="mt-2 text-sm text-slate-500">Bạn có thể đẩy tin lên VIP tại trang quản lý sản phẩm.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activePromotions.map((promotion) => (
                <article key={promotion.PromotionId} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-600">VIP đang hoạt động</p>
                      <h2 className="mt-1 truncate text-lg font-bold text-slate-900">
                        {promotion.Listing?.Title || `Tin đăng #${promotion.ListingId}`}
                      </h2>
                    </div>
                    <Crown className="shrink-0 text-amber-500" size={22} />
                  </div>
                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-slate-500">Còn lại</p>
                      <p className="mt-1 flex items-center gap-1.5 font-bold text-emerald-700">
                        <Clock3 size={15} />
                        {getRemainingText(promotion.EndsAt, now)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-slate-500">Credit đã dùng</p>
                      <p className="mt-1 font-bold text-slate-900">{formatNumber(promotion.CreditUsed)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">Kết thúc: {formatDate(promotion.EndsAt)}</p>
                    <button
                      type="button"
                      onClick={() => handleStop(promotion)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50"
                    >
                      <Square size={13} />
                      Dừng VIP
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
