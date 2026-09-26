import { ArrowRight, CheckCircle2, PackageCheck, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'

const stats = [
  { value: '1.000+', label: 'Sản phẩm', icon: PackageCheck },
  { value: '500+', label: 'Người dùng', icon: UsersRound },
  { value: 'An tâm', label: 'Giao dịch an toàn', icon: ShieldCheck },
]

function HeroSection({ onExplore, onSell }) {
  return (
    <section id="top" className="relative overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-white">
      <div className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 size-80 rounded-full bg-teal-100/50 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.06fr_.94fr] lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700 shadow-sm">
            <Sparkles size={14} />
            Cũ với bạn, mới với người khác
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.12] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Mua bán đồ cũ{' '}
            <span className="relative text-emerald-600">
              dễ dàng
              <svg className="absolute -bottom-2 left-0 h-3 w-full text-emerald-300" viewBox="0 0 180 12" aria-hidden="true">
                <path d="M2 9C44 2 115 2 178 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
              </svg>
            </span>{' '}
            và an toàn
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Nơi sinh viên mua được món đồ cần thiết với giá hợp lý và giúp những món đồ còn tốt tìm thấy người chủ mới.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              Khám phá sản phẩm
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              onClick={onSell}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
            >
              Đăng bán ngay
            </button>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3 border-t border-slate-200/80 pt-6">
            {stats.map(({ value, label, icon: Icon }) => (
              <div key={label} className="min-w-0">
                <div className="flex items-center gap-1.5 text-slate-900">
                  <Icon className="hidden text-emerald-600 sm:block" size={18} />
                  <span className="text-base font-extrabold sm:text-lg">{value}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto hidden w-full max-w-lg lg:block" aria-label="Minh họa mua bán đồ cũ an toàn">
          <div className="absolute -inset-5 rotate-3 rounded-[2.5rem] bg-emerald-100/70" />
          <div className="relative overflow-hidden rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-2xl shadow-emerald-900/10">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold text-slate-400">GỢI Ý HÔM NAY</p>
                <p className="mt-1 font-bold text-slate-800">Món tốt, giá sinh viên</p>
              </div>
              <span className="grid size-10 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <Sparkles size={19} />
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 p-5 text-white">
                <div className="mb-12 inline-flex rounded-lg bg-white/10 p-2 text-emerald-300">
                  <PackageCheck size={25} />
                </div>
                <p className="text-xs text-slate-300">Công nghệ</p>
                <p className="mt-1 text-lg font-bold">Giá tốt mỗi ngày</p>
              </div>
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl bg-amber-50 p-4">
                  <span className="grid size-9 place-items-center rounded-xl bg-amber-100 text-amber-700">
                    <CheckCircle2 size={20} />
                  </span>
                  <p className="mt-5 text-sm font-bold text-slate-800">Người bán xác minh</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <span className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                    <ShieldCheck size={20} />
                  </span>
                  <p className="mt-5 text-sm font-bold text-slate-800">Mua bán an tâm</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex -space-x-2">
                {['MA', 'HN', 'TV'].map((initial, index) => (
                  <span key={initial} className={`grid size-9 place-items-center rounded-full border-2 border-white text-[10px] font-bold ${['bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-sky-100 text-sky-700'][index]}`}>
                    {initial}
                  </span>
                ))}
              </div>
              <p className="text-right text-xs leading-5 text-slate-500">
                <strong className="block text-sm text-slate-800">+500 thành viên</strong>
                đã tham gia cộng đồng
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
