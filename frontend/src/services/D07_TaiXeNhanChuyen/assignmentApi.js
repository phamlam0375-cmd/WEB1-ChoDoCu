import { api } from '../../lib/api.js'
export const getDriverStatus = async signal => (await api.get('/driver/status', { sessionOnly: true, signal })).data.data
export const getAvailableDeliveries = async (params, signal) => (await api.get('/driver/deliveries/available', { sessionOnly: true, params, signal })).data
export const acceptDelivery = async id => (await api.patch(`/driver/deliveries/${encodeURIComponent(id)}/accept`, {}, { sessionOnly: true })).data
