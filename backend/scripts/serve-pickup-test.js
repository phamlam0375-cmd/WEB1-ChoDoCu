'use strict';
const { createEnvironment } = require('../tests/helpers/d08-fixture');
let environment;
(async () => {
  environment = await createEnvironment({ browser: true });
  const driver = await environment.person('browserdriver', { driver: true });
  const fixture = await environment.trip({ driver, accept: process.env.D09_BROWSER_RECEIVE !== 'true' });
  // Không in mật khẩu/token/mã; browser thao tác cấp mã qua UI người bán thật.
  console.log('D08_BROWSER_FIXTURE ' + JSON.stringify({ orderId: fixture.order.OrderId, deliveryId: fixture.deliveryId }));
  await new Promise(resolve => { process.once('SIGTERM', resolve); process.once('SIGINT', resolve); });
})().catch(e => { console.error('D08 fixture server failed:', e.name); process.exitCode = 1; })
  .finally(async () => { if (environment) await environment.close(); });
