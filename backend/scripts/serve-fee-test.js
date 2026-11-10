'use strict';
if (process.env.D12_INTEGRATION_TEST !== 'true' || process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '33307') throw new Error('Chỉ mở fixture D12 trên DB test local đã guard UUID.');
const { createD12Environment } = require('../tests/helpers/d12-fixture');
let f;
(async () => {
  f = await createD12Environment({ browser: true });
  const product = await f.listing(), pickup = await f.listing(), expire = await f.listing();
  await f.driver('browserdriver');
  console.log('D12_BROWSER_FIXTURE ' + JSON.stringify({ apiPort: f.server.address().port, listingId: product.ListingId, title: product.Title, pickupListingId: pickup.ListingId, expireListingId: expire.ListingId, area: f.area, otherArea: f.otherArea, sellerId: f.seller.UserId }));
  await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
})().catch(e => { console.error('D12 fixture failure:', e.name, e.code || ''); process.exitCode = 1; }).finally(async () => { if (f) await f.close(); });
