import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import ProductCard from './ProductCard'

function FeaturedProducts({ products, savedIds, onToggleSave, onView, onBuy }) {
  const [startIndex, setStartIndex] = useState(0)
  const [slideDirection, setSlideDirection] = useState('next')
  const maxStartIndex = Math.max(0, products.length - 3)
  const visibleStartIndex = Math.min(startIndex, maxStartIndex)
  const moveTo = (nextIndex, direction) => {
    setSlideDirection(direction)
    setStartIndex(nextIndex)
  }

  return (
    <section className="pb-16 sm:pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-amber-600">Được quan tâm</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Tin đăng nổi bật</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {products.length > 3 && (
            <button
              type="button"
              onClick={() => moveTo(Math.max(0, visibleStartIndex - 1), 'previous')}
              disabled={visibleStartIndex === 0}
              aria-label="Xem tin VIP trước"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div
            key={`${visibleStartIndex}-${slideDirection}`}
            className={`grid min-w-0 flex-1 gap-4 md:grid-cols-3 featured-products-slide featured-products-slide--${slideDirection}`}
          >
          {products.slice(visibleStartIndex, visibleStartIndex + 3).map((product) => (
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
          {products.length > 3 && (
            <button
              type="button"
              onClick={() => moveTo(Math.min(maxStartIndex, visibleStartIndex + 1), 'next')}
              disabled={visibleStartIndex === maxStartIndex}
              aria-label="Xem tin VIP tiếp theo"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

export default FeaturedProducts
