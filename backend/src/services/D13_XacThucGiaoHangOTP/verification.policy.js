'use strict';
const { UUID } = require('../../validators/D13_XacThucGiaoHangOTP/completion.validator');
const time = value => value ? new Date(value).getTime() : NaN;
// D06/D05 dùng dấu xác thực và bằng chứng D13, không coi ProofUrl/DELIVERED cũ là đủ.
function verifiedDelivery(d, now = new Date()) {
  if (!d || d.Status !== 'DELIVERED' || d.ReturnedAt || !d.DriverId || Number(d.CompletionCodeDriverId) !== Number(d.DriverId)
    || !UUID.test(d.CompletionCodeSession || '') || !/^d13-[0-9a-f-]{36}\.(?:png|jpg)$/.test(d.CompletionProofKey || '')
    || !/^[a-f0-9]{64}$/.test(d.CompletionProofDigest || '') || !d.CompletionProofAvailable || !d.HasD13Event) return false;
  const used = time(d.CompletionCodeUsedAt), issued = time(d.CompletionCodeIssuedAt), expires = time(d.CompletionCodeExpiresAt);
  return Number.isFinite(used) && Number.isFinite(issued) && Number.isFinite(expires) && issued <= used && used < expires && used <= now.getTime()
    && time(d.DeliveredAt) === used && time(d.VerifiedAt) === used;
}
module.exports = { verifiedDelivery, time };
