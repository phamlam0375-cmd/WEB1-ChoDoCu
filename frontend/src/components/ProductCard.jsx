import { BadgeCheck, Clock3, Eye, Heart, MapPin, ShoppingBag, Store } from 'lucide-react'

import { formatPrice } from '../data/mockProducts'
import { useNavigate } from 'react-router-dom'

function ProductCard({ product, isSaved, onToggleSave, onView, onBuy, compact = false }) {
  const navigate = useNavigate()
  const isAvailable = product.status === 'ACTIVE'
  const availabilityLabel = product.status === 'RESERVED'
    ? 'Đã có người đặt'
    : product.status === 'SOLD'
      ? 'Đã bán'
      : 'Không khả dụng'
  const availabilityMessage = product.status === 'RESERVED'
    ? 'Sản phẩm đã có người đặt, hiện chưa thể mua.'
    : product.status === 'SOLD'
      ? 'Sản phẩm đã bán và không còn khả dụng.'
      : 'Sản phẩm hiện không khả dụng.'
  const handleImageError = (event) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = '/product-placeholder.svg'
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onView(product)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onView(product)
        }
      }}
      className={`group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-900/8 ${compact ? 'text-sm' : ''}`}
      aria-label={`Xem chi tiết ${product.name}`}
    >
      <div className={`relative overflow-hidden bg-slate-100 ${compact ? 'aspect-[5/3]' : 'aspect-4/3'}`}>
        <img
          src={product.image}
          alt={product.name}
          onError={handleImageError}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex max-w-[calc(100%-64px)] flex-wrap gap-1.5">
          {!isAvailable && <span className="rounded-lg bg-slate-800/90 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">{availabilityLabel}</span>}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleSave(product.id)
          }}
          className={`absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-white/70 shadow-md backdrop-blur transition ${isSaved ? 'bg-rose-500 text-white' : 'bg-white/90 text-slate-600 hover:text-rose-500'}`}
          aria-label={isSaved ? `Bỏ lưu ${product.name}` : `Lưu ${product.name}`}
        >
          <Heart size={17} className={isSaved ? 'fill-current' : ''} />
        </button>
      </div>

      <div className={`flex flex-1 flex-col ${compact ? 'p-3' : 'p-4'}`}>
        <h3 className={`line-clamp-2 font-bold leading-[1.4] text-slate-800 transition group-hover:text-emerald-700 ${compact ? 'min-h-9 text-sm' : 'min-h-11 text-[15px]'}`}>
          {product.name}
        </h3>
        <div className={`${compact ? 'mt-2' : 'mt-3'} flex flex-wrap items-baseline gap-x-2 gap-y-1`}>
          <span className={`${compact ? 'text-base' : 'text-lg'} font-black text-emerald-700`}>{formatPrice(product.price)}</span>
          {product.oldPrice && <span className="text-xs text-slate-400 line-through">{formatPrice(product.oldPrice)}</span>}
        </div>

        <div className={`${compact ? 'mt-2' : 'mt-3'} flex items-center gap-3 text-xs text-slate-500`}>
          <span className="flex min-w-0 items-center gap-1">
            <MapPin size={13} className="shrink-0 text-slate-400" />
            <span className="truncate">{product.location}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Clock3 size={13} className="text-slate-400" />
            {product.postedAt}
          </span>
        </div>

        <div className={`${compact ? 'mt-3 pt-2' : 'mt-4 pt-3'} border-t border-slate-100`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (product.sellerId) navigate(`/store/${product.sellerId}`)
            }}
            disabled={!product.sellerId}
            className="flex max-w-full items-center gap-2 rounded-lg text-left transition hover:text-emerald-700 disabled:cursor-default"
            aria-label={`Xem cửa hàng của ${product.seller}`}
          >
            {product.sellerAvatar ? (
              <img src={product.sellerAvatar} alt="" className="size-7 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-linear-to-br from-emerald-100 to-teal-100 text-emerald-700">
                <Store size={14} />
              </span>
            )}
            <span className="min-w-0 truncate text-xs font-semibold text-slate-600">{product.seller}</span>
            {product.verified && <BadgeCheck size={15} className="shrink-0 fill-sky-500 text-white" aria-label="Người bán đã xác minh" />}
          </button>
        </div>

        <div className={`mt-auto grid grid-cols-2 gap-2 ${compact ? 'pt-3' : 'pt-4'}`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onView(product)
            }}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-600 px-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50"
          >
            <Eye size={15} />
            Xem chi tiết
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onBuy(product)
            }}
            disabled={!isAvailable}
            title={!isAvailable ? availabilityMessage : undefined}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition ${isAvailable ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-200 text-slate-500'}`}
          >
            <ShoppingBag size={15} />
            {isAvailable ? 'Mua ngay' : availabilityLabel}
          </button>
        </div>
      </div>
    </article>
  )
}

export default ProductCard
