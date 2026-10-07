import { api } from '../lib/api.js'

// Diem tich hop danh rieng cho D12. D01 chi goi khi backend thong bao dich vu san sang.
export async function estimateDeliveryFee(payload) {
  const response = await api.post('/delivery-fees/estimate', payload)
  return response.data.data
}
