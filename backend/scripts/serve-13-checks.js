'use strict';
const assert=require('node:assert/strict');
const {createD13Environment}=require('../tests/helpers/d13-fixture');
const {pngReceipt}=require('../tests/D03_ThanhToan/fixtures');
let f;
(async()=>{
  f=await createD13Environment({browser:true});const m=f.models;
  const admin=await f.person('auditadmin'),role=(await m.Roles.findOrCreate({where:{RoleName:'ADMIN'}}))[0];await m.UserRoles.create({UserId:admin.UserId,RoleId:role.RoleId});
  const sellerRole=await m.Roles.findOne({where:{RoleName:'SELLER'}});await m.UserRoles.findOrCreate({where:{UserId:f.seller.UserId,RoleId:sellerRole.RoleId}});
  const profileNew=await f.person('newprofile',{driver:true,profile:false}),profileEdit=await f.driver('editprofile');
  const trip=await f.ready();
  const available=await f.listing({Price:'100000.00',Title:f.prefix+' UI product'});
  const replayListing=await f.listing({Price:'100000.00',Title:f.prefix+' retry product'});
  const pickupListing=await f.listing(),pickupQuote=await f.estimate(pickupListing),pickupOrder=await f.createOrder(pickupListing,pickupQuote.body.data);
  assert.equal(pickupOrder.status,201);await f.pay(pickupOrder.body.data.orderId);
  const prepared=await f.request(`/api/seller/orders/${pickupOrder.body.data.orderId}/preparation`,{user:f.seller,method:'POST',body:{}});assert.equal(prepared.status,201);
  const pickupDriver=await f.driver('pickupdriver');assert.equal((await f.request(`/api/v1/driver/deliveries/${prepared.body.data.DeliveryId}/accept`,{user:pickupDriver,method:'PATCH',body:{}})).status,200);
  const cancelListing=await f.listing({Price:'100000.00'}),cancel=await f.request('/api/v1/orders',{user:f.buyer,method:'POST',body:{listingId:cancelListing.ListingId,deliveryMethod:'PICKUP',receiverName:'Test Buyer',receiverPhone:'0900000111'}});assert.equal(cancel.status,201);
  const payListing=await f.listing({Price:'100000.00'}),pay=await f.request('/api/v1/orders',{user:f.buyer,method:'POST',body:{listingId:payListing.ListingId,deliveryMethod:'PICKUP',receiverName:'Test Buyer',receiverPhone:'0900000111'}});assert.equal(pay.status,201);const paymentId=pay.body.data.orderId;
  assert.equal((await f.request(`/api/seller/store/order/${paymentId}/status`,{user:f.seller,method:'PATCH',body:{status:'CONFIRM'}})).status,200);
  assert.equal((await f.request(`/api/v1/orders/${paymentId}/payment-notice`,{user:f.buyer,method:'POST',body:{amount:'100000.00'},file:{buffer:pngReceipt()}})).status,200);
  const category=await m.Categories.create({CategoryName:f.prefix+' unused',Description:f.prefix,Status:'ACTIVE'});
  const form=new FormData();for(const[k,v]of Object.entries({StoreId:f.store.StoreId,CategoryId:available.CategoryId,Title:f.prefix+' image product',Description:'Image fixture',Price:'100000',ConditionLevel:'GOOD',Location:'Test area'}))form.append(k,String(v));form.append('images',new Blob([pngReceipt()],{type:'image/png'}),'image.png');
  const posted=await f.request('/api/seller/listing',{user:f.seller,method:'POST',form});assert.equal(posted.status,201);
  assert.equal((await f.request('/api/v1/admin/listings/'+posted.body.data.ListingId+'/review',{user:admin,method:'PATCH',body:{action:'APPROVE',note:'Test fixture'}})).status,200);
  // Seed a legitimate C02-owned QR via its real upload and update APIs.
  const login=await fetch(`http://127.0.0.1:${f.server.address().port}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.seller.Email,password:process.env.D13_BROWSER_TEST_PASSWORD})});const token=(await login.json()).token;
  const upload=await fetch(`http://127.0.0.1:${f.server.address().port}/api/stores/${f.seller.UserId}/qr`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'image/png'},body:pngReceipt()});assert.equal(upload.status,201);const qr=(await upload.json()).data.url;
  assert.equal((await f.request(`/api/stores/${f.seller.UserId}`,{user:f.seller,method:'PATCH',body:{StoreName:f.store.StoreName,QrImageUrl:qr}})).status,200);
  const ids=new Set([trip.order.OrderId,cancel.body.data.orderId,paymentId]);
  process.on('message',async msg=>{if(msg?.type!=='CHECKS13_READ')return;try{let data;
    if(msg.action==='order'){
      const order=await m.Orders.findByPk(msg.id,{raw:true});assert.equal(order.BuyerId,f.buyer.UserId);ids.add(order.OrderId);
      data={order,payment:await m.Payments.findOne({where:{OrderId:order.OrderId},raw:true}),histories:await m.StatusHistories.findAll({where:{OrderId:order.OrderId},raw:true}),notifications:await m.Notifications.count({where:{ReferenceType:'ORDER',ReferenceId:order.OrderId}}),commissions:await m.Commissions.count({where:{OrderId:order.OrderId}})};
    }else if(msg.action==='profile'){
      assert([profileNew.UserId,profileEdit.UserId].includes(Number(msg.id)));data=await m.DriverProfiles.findOne({where:{UserId:msg.id},raw:true});
    }else if(msg.action==='listing'){
      const row=await m.Listings.findByPk(msg.id,{raw:true});assert.equal(row.SellerId,f.seller.UserId);data={listing:row,media:await m.ListingMedia.findAll({where:{ListingId:msg.id},raw:true})};
    }else if(msg.action==='categories'){
      data=await m.Categories.findAll({where:{CategoryName:{[require('sequelize').Op.like]:f.prefix+'%'}},raw:true});
    }else if(msg.action==='user')data=await m.Users.findByPk(f.buyer.UserId,{attributes:['UserId','FullName','Address','Phone','AvatarUrl'],raw:true});
    else throw Error('Read-only action not supported');
    process.send({type:'CHECKS13_RESULT',id:msg.requestId,data});
  }catch(e){process.send({type:'CHECKS13_RESULT',id:msg.requestId,error:e.name})}});
  console.log('CHECKS13_FIXTURE '+JSON.stringify({apiPort:f.server.address().port,prefix:f.prefix,accounts:{buyer:f.buyer.Email,seller:f.seller.Email,admin:admin.Email,newprofile:profileNew.Email,editprofile:profileEdit.Email,driver:trip.driver.Email,pickupdriver:pickupDriver.Email},buyerId:f.buyer.UserId,sellerId:f.seller.UserId,profileNewId:profileNew.UserId,profileEditId:profileEdit.UserId,storeId:f.store.StoreId,area:f.area,listingId:available.ListingId,replayListingId:replayListing.ListingId,pickupOrderId:pickupOrder.body.data.orderId,pickupDeliveryId:prepared.body.data.DeliveryId,title:available.Title,imageListingId:posted.body.data.ListingId,imageTitle:posted.body.data.Title,categoryId:category.CategoryId,categoryName:category.CategoryName,cancelOrderId:cancel.body.data.orderId,paymentOrderId:paymentId,tripOrderId:trip.order.OrderId,deliveryId:trip.deliveryId,qrUrl:qr}));
  await new Promise(resolve=>{process.once('disconnect',resolve);process.once('SIGTERM',resolve)});
})().catch(e=>{console.error('13-check fixture failed:',e.message);process.exitCode=1}).finally(async()=>{if(f)await f.close()});
