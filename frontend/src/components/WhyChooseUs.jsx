import { BadgeCheck, Bike, CircleDollarSign, Zap } from 'lucide-react'

const reasons = [
  { icon: Zap, title: 'Mua bán nhanh chóng', description: 'Đăng tin đơn giản, tìm kiếm dễ dàng và kết nối trực tiếp.' },
  { icon: BadgeCheck, title: 'Người bán xác minh', description: 'Thông tin minh bạch giúp bạn an tâm hơn khi lựa chọn.' },
  { icon: CircleDollarSign, title: 'Thanh toán minh bạch', description: 'Giá bán hiển thị rõ ràng, không có chi phí ẩn.' },
  { icon: Bike, title: 'Hỗ trợ giao hàng', description: 'Linh hoạt thỏa thuận hình thức nhận hàng phù hợp.' },
]

function WhyChooseUs({ onSell }) {
  return (
    <>
      <section className="bg-emerald-950 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-emerald-300">Mua bán an tâm hơn</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Vì sao chọn Chợ Đồ Cũ?</h2>
            <p className="mt-3 text-sm leading-6 text-emerald-100/70">Một cộng đồng trao đổi đồ cũ thân thiện, tiết kiệm và bền vững dành cho sinh viên.</p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {reasons.map(({ icon: Icon, title, description }, index) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><Icon size={22} /></span>
                  <span className="text-xs font-black text-white/20">0{index + 1}</span>
                </div>
                <h3 className="mt-5 font-extrabold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-emerald-100/60">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-14 sm:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-10 text-white shadow-xl shadow-emerald-900/10 sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-14">
            <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border-[36px] border-white/10" />
            <div className="relative max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-emerald-100">Đăng tin hoàn toàn miễn phí</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Bạn có đồ cũ không còn sử dụng?</h2>
              <p className="mt-3 text-sm leading-6 text-emerald-50 sm:text-base">Đăng bán ngay để sản phẩm tìm được chủ mới.</p>
            </div>
            <button type="button" onClick={onSell} className="relative mt-6 h-12 rounded-xl bg-white px-6 text-sm font-extrabold text-emerald-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50 lg:mt-0">
              Đăng tin miễn phí
            </button>
          </div>
        </div>
      </section>
    </>
  )
}

export default WhyChooseUs
