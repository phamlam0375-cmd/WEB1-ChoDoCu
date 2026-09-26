import { Armchair, Bike, BookOpen, CookingPot, Headphones, Laptop, Shirt, Smartphone } from 'lucide-react'

const iconMap = {
  Armchair,
  Bike,
  BookOpen,
  CookingPot,
  Headphones,
  Laptop,
  Shirt,
  Smartphone,
}

function CategorySection({ categories, products, selectedCategory, onSelect }) {
  return (
    <section id="danh-muc" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-emerald-600">Khám phá nhanh</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Danh mục phổ biến</h2>
          </div>
          {selectedCategory !== 'all' && (
            <button type="button" onClick={() => onSelect('all')} className="hidden text-sm font-semibold text-emerald-700 hover:text-emerald-800 sm:block">
              Xem tất cả
            </button>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((category) => {
            const Icon = iconMap[category.icon]
            const count = products.filter((product) => product.category === category.id).length
            const isActive = selectedCategory === category.id

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelect(category.id)}
                className={`group flex min-h-36 flex-col items-center justify-center rounded-2xl border p-3 text-center transition duration-200 hover:-translate-y-1 hover:shadow-lg ${isActive ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-900/5' : 'border-slate-200 bg-white hover:border-emerald-200'}`}
              >
                <span className={`grid size-12 place-items-center rounded-2xl transition ${isActive ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100'}`}>
                  <Icon size={23} strokeWidth={1.8} />
                </span>
                <span className="mt-3 text-sm font-bold leading-5 text-slate-800">{category.name}</span>
                <span className="mt-1 text-xs text-slate-400">{count} sản phẩm</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default CategorySection
