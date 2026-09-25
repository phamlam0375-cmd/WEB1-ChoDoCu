import { AtSign, Mail, MapPin, MessageCircle, Phone, Play, Store } from 'lucide-react'

const footerLinks = ['Giới thiệu', 'Điều khoản sử dụng', 'Chính sách bảo mật', 'Hỗ trợ khách hàng']
const socialLinks = [
  { label: 'Facebook', icon: MessageCircle },
  { label: 'Instagram', icon: AtSign },
  { label: 'Youtube', icon: Play },
]

function Footer() {
  return (
    <footer id="ho-tro" className="scroll-mt-24 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_.8fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2.5 text-white">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-600"><Store size={21} /></span>
            <span className="text-xl font-extrabold">Chợ <span className="text-emerald-400">Đồ Cũ</span></span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
            Nền tảng mua bán đồ cũ thân thiện dành cho sinh viên, giúp tiết kiệm chi phí và lan tỏa lối sống bền vững.
          </p>
          <div className="mt-5 flex gap-2">
            {socialLinks.map(({ label, icon: Icon }) => (
              <a key={label} href="#top" aria-label={label} className="grid size-9 place-items-center rounded-lg border border-slate-800 text-slate-400 transition hover:border-emerald-600 hover:bg-emerald-600 hover:text-white">
                <Icon size={17} />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-extrabold text-white">Liên kết hữu ích</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-400">
            {footerLinks.map((link) => (
              <li key={link}><a href="#top" className="transition hover:text-emerald-400">{link}</a></li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-extrabold text-white">Liên hệ</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-400">
            <li className="flex items-start gap-3"><MapPin size={17} className="mt-0.5 shrink-0 text-emerald-500" /> Khu đô thị Đại học Quốc gia, TP. Hồ Chí Minh</li>
            <li><a href="tel:19001234" className="flex items-center gap-3 hover:text-emerald-400"><Phone size={17} className="shrink-0 text-emerald-500" /> 1900 1234</a></li>
            <li><a href="mailto:hotro@chodocu.vn" className="flex items-center gap-3 hover:text-emerald-400"><Mail size={17} className="shrink-0 text-emerald-500" /> hotro@chodocu.vn</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 Chợ Đồ Cũ. Bảo lưu mọi quyền.</p>
          <p>Mua sắm thông minh · Sống xanh mỗi ngày</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
