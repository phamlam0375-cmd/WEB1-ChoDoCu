'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {plan}=require('../scripts/cleanup-auth-local');
const {verifyLocalDatabase}=require('../scripts/lib/local-db-guard');
test('AuthLocal dry-run retains mixed real orders, fixture seller permissions and required parents; removes only independent fixture rows',async()=>{
  const users=[{UserId:1,Username:'AuthLocal_abc_buyer',Email:'AuthLocal_abc_buyer@example.invalid',FullName:'Auth local buyer'},{UserId:2,Username:'AuthLocal_abc_seller',Email:'AuthLocal_abc_seller@example.invalid',FullName:'Auth local seller'},{UserId:999,Username:'admin',Email:'real@example.test',FullName:'Admin'},{UserId:4,Username:'AuthLocal_customer',Email:'real-customer@example.test',FullName:'AuthLocal customer'}];
  const rows={Users:users,Stores:[{StoreId:1,OwnerId:2,StoreName:'AuthLocal_abc',Address:'Local fixture only'}],Listings:[1,2].map(ListingId=>({ListingId,SellerId:2,StoreId:1,Title:'AuthLocal_abc '+(ListingId===1?'cancel':'browser create'),Description:'Isolated local auth test; no real transfer or external notification'})),Orders:[{OrderId:1,BuyerId:1,SellerId:2,ListingId:1},{OrderId:2,BuyerId:999,SellerId:2,ListingId:2}],Roles:[{RoleId:1}],UserRoles:[{UserId:1,RoleId:1},{UserId:2,RoleId:1}]};
  const primary={Users:['UserId'],Stores:['StoreId'],Listings:['ListingId'],Orders:['OrderId'],Roles:['RoleId'],UserRoles:['UserId','RoleId']};
  const fks=[['Stores','OwnerId','Users','UserId'],['Listings','SellerId','Users','UserId'],['Listings','StoreId','Stores','StoreId'],['Orders','BuyerId','Users','UserId'],['Orders','SellerId','Users','UserId'],['Orders','ListingId','Listings','ListingId'],['UserRoles','UserId','Users','UserId'],['UserRoles','RoleId','Roles','RoleId']].map(([t,c,pt,pc])=>({t,c,pt,pc}));
  const fake={query:async sql=>{assert.match(sql,/^SELECT/);if(sql.includes("CONSTRAINT_NAME='PRIMARY'"))return[Object.entries(primary).flatMap(([t,keys])=>keys.map(c=>({t,c})))];if(sql.includes('REFERENCED_TABLE_NAME'))return[fks];const table=sql.match(/FROM `([^`]+)`/)[1];return[rows[table]]}};
  const result=await plan(undefined,fake);
  assert.deepEqual(result.summary.Orders,[[1]]);assert.deepEqual(result.summary.Listings,[[1]]);assert.deepEqual(result.summary.Users,[[1]]);assert.deepEqual(result.summary.UserRoles,[[1,1]]);assert.equal(result.summary.Stores,undefined);assert(result.blocked.some(b=>b.table==='Orders'&&b.keys[0]===2));
});
test('local maintenance guard rejects a different server UUID even on the expected host and port',async()=>{
  const old={...process.env};Object.assign(process.env,{LOCAL_DATA_MAINTENANCE:'true',NODE_ENV:'test',EXPECTED_LOCAL_DB_UUID:'expected'});
  try{await assert.rejects(verifyLocalDatabase({config:{host:'127.0.0.1',port:33307},query:async()=>[[{db:'cho_do_cu',uuid:'other'}]]}),/other/)}finally{for(const key of['LOCAL_DATA_MAINTENANCE','NODE_ENV','EXPECTED_LOCAL_DB_UUID']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key]}}
});
