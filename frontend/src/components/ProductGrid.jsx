import { PackageSearch, SlidersHorizontal } from 'lucide-react'
import ProductCard from './ProductCard'

function ProductGrid({ products, savedIds, savedOnly, onToggleSave, onView, onBuy, onOpenFilters, onReset }) {
  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-emerald-600">Gợi ý dành cho bạn</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {savedOnly ? 'Tin bạn đã lưu' : 'Sản phẩm mới đăng'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tìm thấy <strong className="text-slate-800">{products.length}</strong> sản phẩm phù hợp
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm lg:hidden"
        >
          <SlidersHorizontal size={17} />
          Bộ lọc
        </button>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isSaved={savedIds.has(product.id)}
              onToggleSave={onToggleSave}
              onView={onView}
              onBuy={onBuy}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div>
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
              <PackageSearch size={29} />
            </span>
            <h3 className="mt-4 text-lg font-extrabold text-slate-800">Không tìm thấy sản phẩm phù hợp</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Hãy thử thay đổi từ khóa, khu vực hoặc khoảng giá để xem thêm sản phẩm.
            </p>
            <button type="button" onClick={onReset} className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
              Xóa bộ lọc
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductGrid
