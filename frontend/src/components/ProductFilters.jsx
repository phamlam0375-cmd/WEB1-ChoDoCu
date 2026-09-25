import { RotateCcw, SlidersHorizontal, X } from 'lucide-react'

const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'

function FilterFields({ idPrefix, filters, categories, conditions, locations, onChange, onApply, onReset, onClose }) {
  const handleSubmit = (event) => {
    event.preventDefault()
    onApply()
    onClose?.()
  }

  const handleReset = () => {
    onReset()
    onClose?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor={`${idPrefix}-category`} className="mb-2 block text-sm font-bold text-slate-700">Danh mục</label>
        <select id={`${idPrefix}-category`} value={filters.category} onChange={(event) => onChange('category', event.target.value)} className={inputClass}>
          <option value="all">Tất cả danh mục</option>
          {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-slate-700">Khoảng giá</p>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="sr-only">Giá tối thiểu</span>
            <input
              type="number"
              min="0"
              value={filters.minPrice}
              onChange={(event) => onChange('minPrice', event.target.value)}
              placeholder="Từ"
              className={inputClass}
            />
          </label>
          <label>
            <span className="sr-only">Giá tối đa</span>
            <input
              type="number"
              min="0"
              value={filters.maxPrice}
              onChange={(event) => onChange('maxPrice', event.target.value)}
              placeholder="Đến"
              className={inputClass}
            />
          </label>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">Đơn vị: đồng (₫)</p>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-condition`} className="mb-2 block text-sm font-bold text-slate-700">Tình trạng</label>
        <select id={`${idPrefix}-condition`} value={filters.condition} onChange={(event) => onChange('condition', event.target.value)} className={inputClass}>
          <option value="all">Tất cả tình trạng</option>
          {conditions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-location`} className="mb-2 block text-sm font-bold text-slate-700">Khu vực</label>
        <select id={`${idPrefix}-location`} value={filters.location} onChange={(event) => onChange('location', event.target.value)} className={inputClass}>
          <option value="all">Toàn quốc</option>
          {locations.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-sort`} className="mb-2 block text-sm font-bold text-slate-700">Sắp xếp</label>
        <select id={`${idPrefix}-sort`} value={filters.sort} onChange={(event) => onChange('sort', event.target.value)} className={inputClass}>
          <option value="newest">Mới đăng</option>
          <option value="price-asc">Giá thấp đến cao</option>
          <option value="price-desc">Giá cao đến thấp</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button type="submit" className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700">
          Áp dụng
        </button>
        <button type="button" onClick={handleReset} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
          <RotateCcw size={15} />
          Xóa bộ lọc
        </button>
      </div>
    </form>
  )
}

function ProductFilters({ filters, categories, conditions, locations, onChange, onApply, onReset, mobileOpen, onMobileOpenChange }) {
  return (
    <>
      <aside className="hidden self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24 lg:block">
        <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><SlidersHorizontal size={18} /></span>
          <div>
            <h3 className="font-extrabold text-slate-900">Bộ lọc sản phẩm</h3>
            <p className="text-xs text-slate-400">Tìm đúng món bạn cần</p>
          </div>
        </div>
        <FilterFields
          idPrefix="desktop-filter"
          filters={filters}
          categories={categories}
          conditions={conditions}
          locations={locations}
          onChange={onChange}
          onApply={onApply}
          onReset={onReset}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title">
          <button type="button" aria-label="Đóng bộ lọc" onClick={() => onMobileOpenChange(false)} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <div className="absolute inset-y-0 right-0 w-[min(92vw,400px)] overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><SlidersHorizontal size={18} /></span>
                <h3 id="mobile-filter-title" className="font-extrabold text-slate-900">Bộ lọc sản phẩm</h3>
              </div>
              <button type="button" onClick={() => onMobileOpenChange(false)} className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-600" aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            <FilterFields
              idPrefix="mobile-filter"
              filters={filters}
              categories={categories}
              conditions={conditions}
              locations={locations}
              onChange={onChange}
              onApply={onApply}
              onReset={onReset}
              onClose={() => onMobileOpenChange(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default ProductFilters
