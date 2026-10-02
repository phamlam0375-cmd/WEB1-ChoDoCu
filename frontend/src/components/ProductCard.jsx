import { BadgeCheck, Clock3, Eye, Heart, MapPin, ShoppingBag } from 'lucide-react'
import { formatPrice } from '../data/mockProducts'

function ProductCard({ product, isSaved, onToggleSave, onView, onBuy }) {
  const conditionStyle = product.condition === 'Như mới'
    ? 'bg-emerald-100 text-emerald-800'
    : product.condition === 'Cần sửa chữa nhẹ'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-slate-100 text-slate-700'

  const handleImageError = (event) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = '/product-placeholder.svg'
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-900/8">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img
          src={product.image}
          alt={product.name}
          onError={handleImageError}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex max-w-[calc(100%-64px)] flex-wrap gap-1.5">
          {product.isVip && <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow-sm">VIP</span>}
          <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold shadow-sm ${conditionStyle}`}>{product.condition}</span>
        </div>
        <button
          type="button"
          onClick={() => onToggleSave(product.id)}
          className={`absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-white/70 shadow-md backdrop-blur transition ${isSaved ? 'bg-rose-500 text-white' : 'bg-white/90 text-slate-600 hover:text-rose-500'}`}
          aria-label={isSaved ? `Bỏ lưu ${product.name}` : `Lưu ${product.name}`}
        >
          <Heart size={17} className={isSaved ? 'fill-current' : ''} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 min-h-11 text-[15px] font-bold leading-[1.4] text-slate-800 transition group-hover:text-emerald-700">
          {product.name}
        </h3>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-lg font-black text-emerald-700">{formatPrice(product.price)}</span>
          {product.oldPrice && <span className="text-xs text-slate-400 line-through">{formatPrice(product.oldPrice)}</span>}
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin size={13} className="shrink-0 text-slate-400" />
            <span className="truncate">{product.location}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Clock3 size={13} className="text-slate-400" />
            {product.postedAt}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-[10px] font-extrabold text-emerald-700">
            {product.seller.split(' ').map((word) => word[0]).slice(-2).join('')}
          </span>
          <span className="min-w-0 truncate text-xs font-semibold text-slate-600">{product.seller}</span>
          {product.verified && <BadgeCheck size={15} className="shrink-0 fill-sky-500 text-white" aria-label="Người bán đã xác minh" />}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
          <button
            type="button"
            onClick={() => onView(product)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <Eye size={15} />
            Xem chi tiết
          </button>
          <button
            type="button"
            onClick={() => onBuy(product)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2 text-xs font-bold text-white transition hover:bg-emerald-700"
          >
            <ShoppingBag size={15} />
            Mua ngay
          </button>
        </div>
      </div>
    </article>
  )
}

export default ProductCard
