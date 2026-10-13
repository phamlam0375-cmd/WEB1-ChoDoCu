import { useRef, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { applyColorTheme, COLOR_THEMES, getSavedColorTheme } from '../utils/colorThemes'

function ColorThemePicker() {
  const [selectedTheme, setSelectedTheme] = useState(getSavedColorTheme)
  const pickerRef = useRef(null)

  const handleSelectTheme = (themeId) => {
    applyColorTheme(themeId)
    setSelectedTheme(themeId)
    pickerRef.current.open = false
  }

  return (
    <details ref={pickerRef} className="relative">
      <summary
        className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 [&::-webkit-details-marker]:hidden"
        aria-label="Chọn màu giao diện"
        title="Chọn màu giao diện"
      >
        <Palette size={17} />
        <span>Màu giao diện</span>
      </summary>

      <div
        className="absolute right-0 top-full z-[60] mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
        role="group"
        aria-label="Các màu giao diện"
      >
        <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Chọn màu chủ đạo
        </p>
        {COLOR_THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => handleSelectTheme(theme.id)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            aria-pressed={selectedTheme === theme.id}
          >
            <span
              className="grid size-5 shrink-0 place-items-center rounded-full"
              style={{ backgroundColor: theme.color }}
              aria-hidden="true"
            >
              {selectedTheme === theme.id && <Check size={13} className="text-white" strokeWidth={3} />}
            </span>
            <span className="flex-1">{theme.name}</span>
            {selectedTheme === theme.id && (
              <span className="text-xs font-medium text-slate-500">Đang dùng</span>
            )}
          </button>
        ))}
      </div>
    </details>
  )
}

export default ColorThemePicker
