import { useEffect, useRef } from 'react'

// Trang thanh toán mở ở tab riêng; thanh toán xong thì báo cho tab gốc để tải lại trạng thái.
const CHANNEL = 'cho-do-cu-payment'

export function announcePaymentDone(detail) {
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage(detail)
    channel.close()
  } catch {
    // Trình duyệt không hỗ trợ BroadcastChannel: người dùng tự tải lại trang gốc.
  }
}

// Gọi onDone(detail) khi một tab thanh toán báo đã chuyển tiền xong.
export function usePaymentDone(onDone) {
  const callback = useRef(onDone)
  useEffect(() => {
    callback.current = onDone
  })
  useEffect(() => {
    let channel
    try {
      channel = new BroadcastChannel(CHANNEL)
      channel.onmessage = (event) => callback.current(event.data)
    } catch {
      return undefined
    }
    return () => channel.close()
  }, [])
}
