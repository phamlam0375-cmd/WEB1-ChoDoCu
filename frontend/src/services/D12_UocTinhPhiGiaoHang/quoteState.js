export function addAmounts(first, second) {
  const cents = value => {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value))
    if (!match) throw new Error('Số tiền không hợp lệ')
    return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'))
  }
  const sum = cents(first) + cents(second)
  return `${sum / 100n}.${String(sum % 100n).padStart(2, '0')}`
}
export const quoteSelectionKey = (listingId, form) => JSON.stringify([String(listingId), form.deliveryMethod, form.receiverAddress.trim(), form.deliveryArea.trim(), form.vehicleType])
