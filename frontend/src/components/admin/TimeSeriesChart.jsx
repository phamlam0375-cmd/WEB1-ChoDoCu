import { useEffect, useRef, useState } from 'react'

// Biểu đồ theo thời gian vẽ bằng SVG (không thêm thư viện): cột chồng hoặc đường.
// series = [{ key, label, color }], rows = [{ period, [key]: number }].
// Một trục Y duy nhất; có chú thích, tooltip khi rê chuột và đường lưới mờ.
const HEIGHT = 240
const PAD = { top: 12, right: 12, bottom: 28, left: 56 }

function niceMax(value, integer) {
  // Số đếm (đơn hàng): trục chia 4 vạch nguyên.
  if (integer) return Math.max(4, Math.ceil(value / 4) * 4)
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((item) => item * power >= value / 4) * power
  return Math.ceil(value / step) * step
}

function formatPeriod(period) {
  const [year, month, day] = period.split('-')
  return day ? `${day}/${month}` : `${month}/${year}`
}

export default function TimeSeriesChart({ type = 'bar', series, rows, formatValue, formatAxis = formatValue, title, integer = false }) {
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    const node = wrapRef.current
    if (!node) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const plotW = width - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const totals = rows.map((row) =>
    type === 'bar' ? series.reduce((sum, item) => sum + row[item.key], 0) : Math.max(...series.map((item) => row[item.key])),
  )
  const max = niceMax(Math.max(0, ...totals), integer)
  const y = (value) => PAD.top + plotH - (value / max) * plotH
  const band = plotW / Math.max(1, rows.length)
  const x = (index) => PAD.left + band * index + band / 2
  const barW = Math.max(2, Math.min(28, band * 0.6))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max)
  const labelEvery = Math.ceil(rows.length / Math.max(1, Math.floor(plotW / 56)))

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const index = Math.floor((event.clientX - rect.left - PAD.left) / band)
    setHover(index >= 0 && index < rows.length ? index : null)
  }

  const hovered = hover !== null ? rows[hover] : null
  const tooltipLeft = hover !== null ? Math.min(Math.max(x(hover) - 90, 0), width - 180) : 0

  return (
    <figure className="m-0">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600" aria-hidden="true">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <span className={type === 'bar' ? 'size-2.5 rounded-sm' : 'h-0.5 w-4 rounded'} style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={title}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          className="block max-w-full"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#cbd5e1' : '#eef2f6'} />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px] tabular-nums">
                {formatAxis(tick)}
              </text>
            </g>
          ))}

          {hover !== null && <rect x={PAD.left + band * hover} y={PAD.top} width={band} height={plotH} fill="#f1f5f9" />}

          {type === 'bar' &&
            rows.map((row, index) => {
              let base = 0
              const parts = series.filter((item) => row[item.key] > 0)
              return parts.map((item, partIndex) => {
                const top = y(base + row[item.key])
                const bottom = y(base)
                base += row[item.key]
                const isTop = partIndex === parts.length - 1
                // Khe 2px giữa các phần chồng; bo góc 4px ở đầu cột.
                const h = Math.max(0, bottom - top - (partIndex > 0 ? 2 : 0))
                const r = isTop ? Math.min(4, barW / 2, h) : 0
                const left = x(index) - barW / 2
                const path = `M${left},${top + h} V${top + r} Q${left},${top} ${left + r},${top} H${left + barW - r} Q${left + barW},${top} ${left + barW},${top + r} V${top + h} Z`
                return <path key={item.key} d={path} fill={item.color} />
              })
            })}

          {type === 'line' &&
            series.map((item) => (
              <polyline
                key={item.key}
                fill="none"
                stroke={item.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={rows.map((row, index) => `${x(index)},${y(row[item.key])}`).join(' ')}
              />
            ))}
          {type === 'line' &&
            hover !== null &&
            series.map((item) => (
              <circle key={item.key} cx={x(hover)} cy={y(rows[hover][item.key])} r="4" fill={item.color} stroke="#fff" strokeWidth="2" />
            ))}

          {rows.map((row, index) =>
            index % labelEvery === 0 ? (
              <text key={row.period} x={x(index)} y={HEIGHT - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
                {formatPeriod(row.period)}
              </text>
            ) : null,
          )}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: tooltipLeft }}
          >
            <p className="mb-1 font-semibold text-slate-900">{formatPeriod(hovered.period)}</p>
            {series.map((item) => (
              <p key={item.key} className="flex items-center justify-between gap-2 text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ background: item.color }} />
                  {item.label}
                </span>
                <span className="font-medium tabular-nums text-slate-900">{formatValue(hovered[item.key])}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}
