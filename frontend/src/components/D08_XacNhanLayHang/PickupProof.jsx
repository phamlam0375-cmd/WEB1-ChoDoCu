import { getPickupProof } from '../../services/D08_XacNhanLayHang/pickupApi'
import PrivateDeliveryProof from '../D05_TheoDoiDonHang/PrivateDeliveryProof'
const load = (orderId, deliveryId, signal) => getPickupProof(orderId, deliveryId, { signal })
export default function PickupProof({ orderId, deliveryId }) {
  return <PrivateDeliveryProof orderId={orderId} deliveryId={deliveryId} load={load} title="Bằng chứng lấy hàng (D08)" alt={`Bằng chứng lấy hàng chuyến #${deliveryId}`} />
}
