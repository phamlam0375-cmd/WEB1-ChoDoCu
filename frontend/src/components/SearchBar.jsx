import { Layers3, MapPin, Search } from 'lucide-react'

function SearchBar({ keyword, category, location, categories, locations, onKeywordChange, onCategoryChange, onLocationChange, onSubmit }) {
  return (
    <div className="relative z-20 mx-auto -mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
      <form
        onSubmit={onSubmit}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/8 md:grid-cols-[minmax(240px,1fr)_210px_200px_auto] md:items-center md:rounded-3xl md:p-4"
      >
        <label className="flex h-12 items-center gap-3 rounded-xl bg-slate-50 px-4 ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-emerald-500">
          <Search size={19} className="shrink-0 text-slate-400" />
          <span className="sr-only">Từ khóa tìm kiếm</span>
          <input
            type="search"
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="Bạn đang tìm sản phẩm gì?"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </label>

        <label className="flex h-12 items-center gap-3 rounded-xl bg-slate-50 px-4 ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-emerald-500">
          <Layers3 size={18} className="shrink-0 text-slate-400" />
          <span className="sr-only">Chọn danh mục</span>
          <select
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm text-slate-700 outline-none"
          >
            <option value="all">Tất cả danh mục</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>

        <label className="flex h-12 items-center gap-3 rounded-xl bg-slate-50 px-4 ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-emerald-500">
          <MapPin size={18} className="shrink-0 text-slate-400" />
          <span className="sr-only">Chọn khu vực</span>
          <select
            value={location}
            onChange={(event) => onLocationChange(event.target.value)}
            className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm text-slate-700 outline-none"
          >
            <option value="all">Toàn quốc</option>
            {locations.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <Search size={18} />
          Tìm kiếm
        </button>
      </form>
    </div>
  )
}

export default SearchBar
