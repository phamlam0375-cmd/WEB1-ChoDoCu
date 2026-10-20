import { useEffect } from 'react'
import { BadgeInfo, MapPin, Store, Tag, X } from 'lucide-react'

import { formatPrice } from '../../data/mockProducts'

function ListingDetail({ product, onClose }) {
  const statusLabels = {
    DRAFT: 'Bản nháp',
    PENDING: 'Chờ duyệt',
    ACTIVE: 'Đang bán',
    RESERVED: 'Đã giữ món',
    SOLD: 'Đã bán',
    HIDDEN: 'Đã ẩn',
    REJECTED: 'Bị từ chối',
    DELETED: 'Đã xóa',
  }

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  if (!product) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="listing-detail-title"
        className="relative max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chi tiết sản phẩm"
          className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-white/90 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-900"
        >
          <X size={20} />
        </button>

        <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="flex min-h-[28rem] items-center justify-center overflow-hidden rounded-2xl bg-slate-100 lg:min-h-[38rem]">
            <img
              src={product.image || '/product-placeholder.svg'}
              alt={product.name}
              onError={(event) => {
                event.currentTarget.onerror = null
                event.currentTarget.src = '/product-placeholder.svg'
              }}
              className="h-full max-h-[38rem] min-h-[28rem] w-full object-contain"
            />
          </div>

          <div className="flex flex-col">
            <span className="w-fit rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              {product.condition}
            </span>

            <h2 id="listing-detail-title" className="mt-4 text-2xl font-extrabold leading-tight text-slate-900">
              {product.name}
            </h2>

            <p className="mt-4 text-3xl font-black text-emerald-700">
              {formatPrice(product.price)}
            </p>

            <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 text-sm text-slate-600 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Tag size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs text-slate-400">Mã sản phẩm</p>
                  <p className="mt-1 font-medium text-slate-700">#{product.id}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <BadgeInfo size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs text-slate-400">Danh mục</p>
                  <p className="mt-1 font-medium text-slate-700">{product.categoryName || 'Chưa cập nhật'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs text-slate-400">Địa điểm</p>
                  <p className="mt-1 font-medium text-slate-700">{product.location}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Store size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs text-slate-400">Người bán</p>
                  <p className="mt-1 font-medium text-slate-700">{product.seller}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <BadgeInfo size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs text-slate-400">Trạng thái</p>
                  <p className="mt-1 font-medium text-slate-700">
                    {statusLabels[product.status] || product.status || 'Chưa cập nhật'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-5 border-t border-slate-100 pt-5">
              <section>
                <h3 className="border-l-4 border-emerald-500 pl-3 text-sm font-bold text-slate-800">
                  Mô tả sản phẩm
                </h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {product.description || 'Chưa có mô tả sản phẩm.'}
                </p>
              </section>

              <section>
                <h3 className="border-l-4 border-emerald-500 pl-3 text-sm font-bold text-slate-800">
                  Khuyết điểm
                </h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {product.knownDefects || 'Không có'}
                </p>
              </section>

              <p className="text-xs text-slate-400">Đăng ngày {product.postedAt}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ListingDetail