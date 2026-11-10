import { api, getDevUserId } from '../lib/api.js'

const optionsFor = options => ({ ...options, d01Demo: !getDevUserId() })

export async function listOrderReviews(orderId, options = {}) {
  const response = await api.get(`/orders/${encodeURIComponent(orderId)}/reviews`, optionsFor(options))
  return response.data.data
}

export async function createOrderReview(orderId, targetType, payload, options = {}) {
  const response = await api.post(
    `/orders/${encodeURIComponent(orderId)}/reviews`,
    { ...payload, targetType },
    optionsFor(options),
  )
  return response.data.data
}
