import { ArrowUpRight } from 'lucide-react'
import ProductCard from './ProductCard'

function FeaturedProducts({ products, savedIds, onToggleSave, onView, onBuy }) {
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
            <ProductCard
              key={product.id}
              product={product}
              isSaved={savedIds.has(product.id)}
              onToggleSave={onToggleSave}
              onView={onView}
              onBuy={onBuy}
              compact
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default FeaturedProducts
