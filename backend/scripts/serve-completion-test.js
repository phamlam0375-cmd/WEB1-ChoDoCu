'use strict';
if (process.env.D13_INTEGRATION_TEST !== 'true' || process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '33307') throw new Error('Chỉ mở fixture D13 trên DB test local đã guard UUID.');
const { createD13Environment } = require('../tests/helpers/d13-fixture');
let f;
(async () => {
  f = await createD13Environment({ browser: true });
  const product = await f.listing(); await f.driver('browserdriver');
  console.log('D13_BROWSER_FIXTURE ' + JSON.stringify({ apiPort: f.server.address().port, listingId: product.ListingId, title: product.Title, area: f.area }));
  await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
})().catch(e => { console.error('D13 fixture failure:', e.name, e.code || ''); process.exitCode = 1; }).finally(async () => { if (f) await f.close(); });
