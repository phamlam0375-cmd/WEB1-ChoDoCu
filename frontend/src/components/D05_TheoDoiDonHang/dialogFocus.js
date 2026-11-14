// Giữ Tab trong hộp thoại D, kể cả trình duyệt cho phép Tab ra thanh địa chỉ.
export function keepDialogFocus(event) {
  if (event.key !== 'Tab') return
  const items = [...event.currentTarget.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length)
  if (!items.length) { event.preventDefault(); event.currentTarget.focus(); return }
  const first = items[0], last = items.at(-1), active = document.activeElement
  if (event.shiftKey && (active === first || !event.currentTarget.contains(active))) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (active === last || !event.currentTarget.contains(active))) { event.preventDefault(); first.focus() }
}
