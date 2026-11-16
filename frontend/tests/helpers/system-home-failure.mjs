import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buyerReopensOrder } from './d-acceptance-navigation.mjs'
import { responseFor } from './system-round-helpers.mjs'

export async function failureFromHome({audit,root,origin,buyer,seller,driver,links,orderId,deliveryId}){
  await driver.setViewportSize({width:1440,height:1100})
  await driver.getByRole('link',{name:'Giao không thành công / Chuyển hoàn',exact:true}).click()
  await driver.locator('#failure-reason').selectOption('OTHER');await driver.locator('#failure-note').fill('Người nhận hẹn lại - nhánh nghiệm thu từ Home')
  await driver.getByRole('button',{name:'Ghi nhận giao thất bại',exact:true}).click()
  await driver.getByText('Đã ghi nhận lần giao thất bại thứ 1.',{exact:true}).waitFor()
  await buyerReopensOrder(buyer,orderId)
  const scheduled=await driver.evaluate(()=>{const d=new Date(Date.now()+5000),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}${d.getSeconds()?':'+pad(d.getSeconds()):''}`})
  await driver.locator('#retry-schedule').fill(scheduled);await driver.getByRole('button',{name:'Hẹn giao lại',exact:true}).click()
  await driver.getByText('Đã lưu lịch giao lại. Chưa bắt đầu giao và chưa tăng số lần giao lại.',{exact:true}).waitFor()
  await driver.reload();const p=await links.api(driver,`/api/v1/driver/deliveries/${deliveryId}/failure-preview`);assert.equal(p.status(),200);const preview=(await p.json()).data;assert.equal(preview.retryCount,0);assert.equal(preview.failureCount,1)
  await new Promise(r=>setTimeout(r,Math.max(0,new Date(preview.scheduledAt).getTime()-Date.now()+150)))
  await driver.getByRole('button',{name:'Tải lại',exact:true}).click();await driver.getByRole('button',{name:'Bắt đầu giao lại',exact:true}).click()
  await driver.getByText('Đã bắt đầu lần giao lại; tài xế tiếp tục phụ trách và giữ trạng thái vận hành.',{exact:true}).waitFor()
  await driver.locator('#failure-reason').selectOption('UNAVAILABLE');await driver.locator('#failure-note').fill('Người nhận vẫn vắng - thất bại lần hai')
  await driver.getByRole('button',{name:'Ghi nhận giao thất bại',exact:true}).click();await driver.getByText('Đã ghi nhận lần giao thất bại thứ 2.',{exact:true}).waitFor()
  await driver.getByRole('button',{name:'Chuyển hoàn',exact:true}).click();await driver.getByRole('button',{name:'Xác nhận chuyển hoàn',exact:true}).click();await driver.locator('#return-recipient').waitFor()
  await buyerReopensOrder(buyer,orderId);await buyer.getByRole('link',{name:'Tiếp tục yêu cầu hoàn tiền B06',exact:true}).click()
  const form=buyer.locator('form').filter({has:buyer.getByRole('button',{name:'Gửi yêu cầu',exact:true})});await form.locator('select').first().locator('option').filter({hasText:'Không nhận được hàng'}).waitFor({state:'attached'})
  assert.equal(await form.locator('select').first().inputValue(),'Không nhận được hàng')
  await form.locator('fieldset select').selectOption('970418');await form.locator('fieldset input').nth(0).fill('000012345678');await form.locator('fieldset input').nth(1).fill('TEST BUYER')
  const refund=responseFor(buyer,r=>r.url().endsWith(`/orders/${orderId}/refund-requests`)&&r.request().method()==='POST');await form.getByRole('button',{name:'Gửi yêu cầu',exact:true}).click();assert.equal((await refund).status(),201);await buyer.waitForURL(origin+'/refunds')
  await driver.reload();await driver.locator('#return-recipient').fill('TEST SELLER HOME');await driver.locator('#return-confirmed').check();await driver.getByRole('button',{name:'Ghi nhận đã trả hàng',exact:true}).click()
  const returned=responseFor(driver,r=>r.url().endsWith(`/deliveries/${deliveryId}/return`)&&r.request().method()==='PATCH');await driver.getByRole('button',{name:'Xác nhận đã trả kiện',exact:true}).click();assert.equal((await returned).status(),200)
  const state=await links.checkpoint('Home -> D10 -> B06 -> RETURNED',{orderId,deliveryId},'REFUND_PENDING','RETURNED')
  assert.equal(state.refunds,1);assert.equal(state.order.CompletedAt,null);assert.equal(state.commissions.length,0);assert.equal(state.histories.filter(h=>h.StatusType==='DELIVERY'&&h.StatusValue==='FAILED').length,2)
  await buyerReopensOrder(buyer,orderId)
  assert.equal(new URL(seller.url()).pathname,`/orders/${orderId}/tracking`)
  await seller.getByRole('button',{name:'Làm mới',exact:true}).click()
  await driver.getByRole('link',{name:'Theo dõi đơn/chuyến',exact:true}).click()
  for(const p of[buyer,seller,driver]){await p.getByRole('heading',{name:'Đã trả hàng cho người bán',exact:true}).waitFor();await p.getByText('Theo dõi yêu cầu B06–B07 hiện có; trả kiện không đồng nghĩa đã hoàn tiền.',{exact:true}).waitFor()}
  await writeFile(path.join(root,'frontend/test-results/two-rounds-1-d10-flow.json'),JSON.stringify({uiOnlyBusinessSteps:true,orderId,deliveryId,orderStatus:state.order.Status,deliveryStatus:state.deliveries[0].Status,refundRequests:state.refunds,commissions:state.commissions.length,completedAt:state.order.CompletedAt},null,2))
  await audit.record('D10','Đạt',`Home→D12/D01/C06/D03/D04/C07/D11/D07/D08/D09→thất bại→hẹn/giao lại→thất bại→RETURNING→B06→RETURNED. Order#${orderId}, Delivery#${deliveryId}; ba vai trò thấy D05, chưa hoàn tiền/hoàn tất giả.`)
  console.log(`PASS HOME D10 Order#${orderId} Delivery#${deliveryId}: fresh UI order, redelivery, return, B06 pending, D05 three roles; no API writes or manual state changes`)
}
