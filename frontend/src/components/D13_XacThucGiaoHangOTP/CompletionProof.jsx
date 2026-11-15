import { getCompletionProof } from '../../services/D13_XacThucGiaoHangOTP/completionApi'
import PrivateDeliveryProof from '../D05_TheoDoiDonHang/PrivateDeliveryProof'
const load = (orderId, deliveryId, signal) => getCompletionProof(orderId, deliveryId, signal)
export default function CompletionProof({ orderId, deliveryId }) {
  return <PrivateDeliveryProof orderId={orderId} deliveryId={deliveryId} load={load} title="Bằng chứng giao hàng (D13)" alt={`Bằng chứng giao hàng chuyến #${deliveryId}`} />
}
