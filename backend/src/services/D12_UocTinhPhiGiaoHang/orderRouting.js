'use strict';
const { matchesAmount } = require('../../validators/D03_ThanhToan/payment.validator');
const { HttpError } = require('../../utils/httpError');
const v = require('../../validators/D12_UocTinhPhiGiaoHang/fee.validator');
function orderRouting(order) {
  let snapshot = order.DeliveryQuoteSnapshot;
  if (typeof snapshot === 'string') { try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; } }
  try {
    if (!snapshot || snapshot.version !== 1 || Number(snapshot.ruleId) !== Number(order.DeliveryFeeRuleId) || !matchesAmount(snapshot.driverFee, order.DeliveryFee) || snapshot.receiverAddress !== v.text(order.ReceiverAddress, 255, 'receiverAddress')) throw new Error();
    for (const [name, max] of [['pickupAddress', 255], ['pickupArea', 100], ['deliveryArea', 100], ['vehicleType', 30]]) v.text(snapshot[name], max, name);
    return snapshot;
  } catch { throw new HttpError(409, 'Đơn chưa có snapshot tuyến/phí D12 hợp lệ. Không suy diễn từ bảng phí hiện tại; cần nhóm kiểm tra đơn cũ.', null, 'DELIVERY_SNAPSHOT_REQUIRED'); }
}
module.exports = { orderRouting };
