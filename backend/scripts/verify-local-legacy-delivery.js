'use strict';
// Uses the existing D12 guard/isolated DB, never the demo database.
const assert=require('node:assert/strict');
const {createD12Environment}=require('../tests/helpers/d12-fixture');
let f;
(async()=>{
  f=await createD12Environment();
  const listing=await f.listing(),quote=await f.estimate(listing);
  assert.equal(quote.status,200);
  const created=await f.createOrder(listing,quote.body.data);assert.equal(created.status,201);
  const id=created.body.data.orderId;await f.pay(id);
  // Simulate pre-D12 structural data only in this new fixture. Never advance a
  // business status via SQL or infer a fee from the current tariff.
  await f.models.Orders.update({DeliveryQuoteSnapshot:null},{where:{OrderId:id}});
  const before=(await f.models.Orders.findByPk(id)).get({plain:true});
  const result=await f.request(`/api/seller/orders/${id}/preparation`,{user:f.seller,method:'POST',body:{}});
  assert.equal(result.status,409);assert.equal(result.body.code,'DELIVERY_SNAPSHOT_REQUIRED');
  const after=(await f.models.Orders.findByPk(id)).get({plain:true});
  assert.equal(after.Status,before.Status);assert.equal(after.DeliveryFee,before.DeliveryFee);assert.equal(after.TotalAmount,before.TotalAmount);
  assert.equal(await f.models.Deliveries.count({where:{OrderId:id}}),0);
  console.log(`PASS legacy Order#${id}: clear409 DELIVERY_SNAPSHOT_REQUIRED; no guessed fee/distance, no delivery or status change`);
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{if(f)await f.close()});
