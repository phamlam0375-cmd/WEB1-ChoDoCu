export const COLOR_THEMES = [
  { id: 'emerald', name: 'Xanh lá', color: '#059669' },
  { id: 'ocean', name: 'Xanh dương', color: '#2563eb' },
  { id: 'violet', name: 'Tím', color: '#7c3aed' },
  { id: 'rose', name: 'Hồng đỏ', color: '#e11d48' },
  { id: 'amber', name: 'Cam', color: '#d97706' }
]

const STORAGE_KEY = 'chodocu-color-theme'
const themeIds = new Set(COLOR_THEMES.map(({ id }) => id))

export const getSavedColorTheme = () => {
  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY)
    return themeIds.has(savedTheme) ? savedTheme : 'emerald'
  } catch (error) {
    console.error('Không thể đọc màu giao diện đã lưu:', error)
    return 'emerald'
  }
}

export const applyColorTheme = (themeId) => {
  if (!themeIds.has(themeId)) {
    throw new Error(`Màu giao diện không hợp lệ: ${themeId}`)
  }

  document.documentElement.dataset.colorTheme = themeId

  try {
    localStorage.setItem(STORAGE_KEY, themeId)
  } catch (error) {
    console.error('Không thể lưu màu giao diện:', error)
  }
}
