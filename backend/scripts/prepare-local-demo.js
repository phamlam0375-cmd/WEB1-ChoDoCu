'use strict';
const db=require('../src/database');
const {ensureLocalDeliveryDemo}=require('./lib/local-delivery-demo');
ensureLocalDeliveryDemo(db).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.close());
