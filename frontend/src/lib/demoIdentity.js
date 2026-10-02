// Ảnh giấy tờ minh họa (SVG) cho hồ sơ mẫu không có ảnh thật. Ngẫu nhiên nhưng cố định
// theo mã hồ sơ: cùng hồ sơ luôn ra cùng một ảnh. Có chữ "ẢNH MINH HỌA" để không nhầm giấy tờ thật.

// Bộ sinh số giả ngẫu nhiên có hạt giống (mulberry32).
function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const escapeXml = (text) =>
  String(text).replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char])

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#ffdbac', '#f5cba7']
const HAIR = ['#2b1d0e', '#3b2a1a', '#1c1c1c', '#4a3020', '#5a3825']
const SHIRT = ['#1e3a8a', '#065f46', '#7c2d12', '#334155', '#581c87']
const PLACES = ['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Bình Dương', 'Đồng Nai', 'Huế', 'Hải Phòng']

export function demoIdentityImage({ id = 1, fullName = 'NGUYEN VAN A', partnerType = 'SELLER', maskedNumber = '***0000' }) {
  const rand = seededRandom(Number(id) * 9973 + 17)
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const isDriver = partnerType === 'DRIVER'
  const hue = isDriver ? 200 + Math.floor(rand() * 30) : 30 + Math.floor(rand() * 25)
  const day = String(1 + Math.floor(rand() * 28)).padStart(2, '0')
  const month = String(1 + Math.floor(rand() * 12)).padStart(2, '0')
  const year = 1975 + Math.floor(rand() * 30)
  const gender = rand() > 0.5 ? 'Nam' : 'Nữ'
  const place = pick(PLACES)
  const skin = pick(SKIN)
  const hair = pick(HAIR)
  const shirt = pick(SHIRT)
  const title = isDriver ? 'GIẤY PHÉP LÁI XE' : 'CĂN CƯỚC CÔNG DÂN'
  const extra = isDriver
    ? `<text x="236" y="300" class="l">Hạng / Class:</text><text x="350" y="300" class="v">${pick(['A1', 'A2', 'B1', 'B2'])}</text>`
    : `<text x="236" y="300" class="l">Quê quán:</text><text x="330" y="300" class="v">${escapeXml(place)}</text>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},70%,92%)"/>
      <stop offset="1" stop-color="hsl(${hue + 20},60%,82%)"/>
    </linearGradient>
    <style>
      .h{font:700 15px Arial,sans-serif;fill:#7f1d1d}
      .t{font:800 22px Arial,sans-serif;fill:#b91c1c;letter-spacing:1px}
      .l{font:13px Arial,sans-serif;fill:#475569}
      .v{font:700 15px Arial,sans-serif;fill:#0f172a}
      .w{font:900 54px Arial,sans-serif;fill:#dc2626;opacity:.14}
    </style>
  </defs>
  <rect width="640" height="400" rx="22" fill="url(#bg)"/>
  <rect x="10" y="10" width="620" height="380" rx="16" fill="none" stroke="hsl(${hue},45%,60%)" stroke-width="2"/>
  <circle cx="62" cy="58" r="30" fill="#dc2626"/>
  <polygon points="62,38 67,53 83,53 70,62 75,77 62,68 49,77 54,62 41,53 57,53" fill="#facc15"/>
  <text x="330" y="48" text-anchor="middle" class="h">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</text>
  <text x="330" y="68" text-anchor="middle" class="l">Độc lập - Tự do - Hạnh phúc</text>
  <text x="330" y="104" text-anchor="middle" class="t">${title}</text>
  <rect x="40" y="128" width="170" height="210" rx="10" fill="#e2e8f0" stroke="#94a3b8"/>
  <rect x="58" y="270" width="134" height="68" rx="30" fill="${shirt}"/>
  <circle cx="125" cy="215" r="44" fill="${skin}"/>
  <path d="M81 205 Q84 160 125 160 Q168 160 169 205 Q150 180 125 182 Q100 180 81 205 Z" fill="${hair}"/>
  <text x="236" y="150" class="l">Số / No.:</text>
  <text x="320" y="150" class="v">${escapeXml(maskedNumber)}</text>
  <text x="236" y="190" class="l">Họ và tên / Full name:</text>
  <text x="236" y="212" class="v">${escapeXml(String(fullName).toUpperCase())}</text>
  <text x="236" y="248" class="l">Ngày sinh:</text>
  <text x="320" y="248" class="v">${day}/${month}/${year}</text>
  <text x="450" y="248" class="l">Giới tính:</text>
  <text x="525" y="248" class="v">${gender}</text>
  ${extra}
  <text x="236" y="338" class="l">Có giá trị đến: ${day}/${month}/${year + 40}</text>
  <text x="330" y="232" text-anchor="middle" class="w" transform="rotate(-18 330 232)">ẢNH MINH HỌA</text>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
