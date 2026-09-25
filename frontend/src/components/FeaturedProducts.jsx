import { ArrowUpRight, BadgeCheck, Heart, MapPin } from 'lucide-react'
import { formatPrice } from '../data/mockProducts'

function FeaturedProducts({ products, savedIds, onToggleSave, onView }) {
  return (
    <section className="pb-16 sm:pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-amber-600">Được quan tâm</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Tin đăng nổi bật</h2>
          </div>
          <a href="#san-pham" className="hidden items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-800 sm:inline-flex">
            Xem thêm <ArrowUpRight size={16} />
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {products.slice(0, 3).map((product) => (
            <article key={product.id} className="group grid grid-cols-[116px_1fr] overflow-hidden rounded-2xl border border-amber-200/70 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:grid-cols-[140px_1fr] md:grid-cols-1 lg:grid-cols-[140px_1fr]">
              <div className="relative min-h-32 overflow-hidden rounded-xl bg-slate-100 md:aspect-[4/3] md:min-h-0 lg:aspect-auto lg:min-h-32">
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.onerror = null
                    event.currentTarget.src = '/product-placeholder.svg'
                  }}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute left-2 top-2 rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-950">VIP</span>
              </div>
              <div className="flex min-w-0 flex-col p-3">
                <div className="flex gap-2">
                  <h3 className="line-clamp-2 flex-1 text-sm font-extrabold leading-5 text-slate-800">{product.name}</h3>
                  <button type="button" onClick={() => onToggleSave(product.id)} className={`grid size-8 shrink-0 place-items-center rounded-full ${savedIds.has(product.id) ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400 hover:text-rose-500'}`} aria-label={`Lưu ${product.name}`}>
                    <Heart size={15} className={savedIds.has(product.id) ? 'fill-current' : ''} />
                  </button>
                </div>
                <p className="mt-2 text-base font-black text-emerald-700">{formatPrice(product.price)}</p>
                <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {product.location}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <span className="flex min-w-0 items-center gap-1 truncate text-xs font-semibold text-slate-500">
                    {product.seller}
                    {product.verified && <BadgeCheck size={14} className="shrink-0 fill-sky-500 text-white" />}
                  </span>
                  <button type="button" onClick={() => onView(product)} className="text-xs font-bold text-emerald-700 hover:text-emerald-800">Chi tiết</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FeaturedProducts
