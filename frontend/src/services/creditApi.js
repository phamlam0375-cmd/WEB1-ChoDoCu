import api from './apiClient'

export async function listCreditPackages() {
  const response = await api.get('/credit/packaged')
  return response.data.data
}

export async function createSePayCheckout(packageId) {
  const response = await api.post('/credit/sepay/checkout', { packageId }, { sessionOnly: true })
  return response.data.data
}

export async function getSePayStatus(invoice) {
  const response = await api.get(`/credit/sepay/status/${encodeURIComponent(invoice)}`, { sessionOnly: true })
  return response.data.data
}
