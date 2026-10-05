import api from '../lib/api'

export async function estimateDeliveryFee({ listingId, receiverAddress }) {
  const response = await api.post('/delivery-fees/estimate', {
    listingId,
    receiverAddress,
  })
  return response.data.data
}
