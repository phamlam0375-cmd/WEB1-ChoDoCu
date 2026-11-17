'use strict';
// Default is read-only. Only exact fixture identities and their isolated graph qualify.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const db = require('../src/database');
const { verifyLocalDatabase } = require('./lib/local-db-guard');
const quote = name => '`' + name.replace(/`/g, '``') + '`';
async function plan(transaction, connection = db) {
  const [keys] = await connection.query("SELECT TABLE_NAME t,COLUMN_NAME c FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION", { transaction });
  const [fks] = await connection.query('SELECT TABLE_NAME t,COLUMN_NAME c,REFERENCED_TABLE_NAME pt,REFERENCED_COLUMN_NAME pc FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL', { transaction });
  const tables = {};
  for (const k of keys) (tables[k.t] ||= { keys: [], rows: [] }).keys.push(k.c);
  for (const [name, table] of Object.entries(tables)) {
    if (name.startsWith('Sequelize')) continue;
    [table.rows] = await connection.query('SELECT * FROM ' + quote(name) + (transaction ? ' FOR UPDATE' : ''), { transaction });
    if (table.rows.length > 50000) throw new Error('Unexpected database size; manual review required');
  }
  const logical = [
    {t:'ConversationParticipants',c:'ConversationId',pt:'Conversations',pc:'ConversationId'},
    {t:'ConversationParticipants',c:'UserId',pt:'Users',pc:'UserId'},
  ];
  for (const fk of logical) if (tables[fk.t] && !fks.some(f => f.t===fk.t && f.c===fk.c)) fks.push(fk);
  const id = (t,r) => t+':'+JSON.stringify(tables[t].keys.map(k=>r[k]));
  const roots = tables.Users.rows.filter(u => /^AuthLocal_[a-z0-9]+_(buyer|other|seller|driver)$/.test(u.Username)
    && u.Email === u.Username+'@example.invalid' && u.FullName === 'Auth local '+u.Username.split('_').at(-1));
  const candidates = new Map(roots.map(r=>[id('Users',r),{t:'Users',r}]));
  let changed = true;
  while (changed) {
    changed=false;
    for (const f of fks) for (const r of tables[f.t]?.rows || []) {
      if (r[f.c] == null || candidates.has(id(f.t,r))) continue;
      if ([...candidates.values()].some(p=>p.t===f.pt && p.r[f.pc]===r[f.c])) {
        candidates.set(id(f.t,r),{t:f.t,r}); changed=true;
      }
    }
    for (const r of tables.Notifications?.rows || []) {
      const target={ORDER:'Orders',DELIVERY:'Deliveries',LISTING:'Listings'}[r.ReferenceType];
      if (target && [...candidates.values()].some(p=>p.t===target && p.r[tables[target].keys[0]]===r.ReferenceId) && !candidates.has(id('Notifications',r))) {
        candidates.set(id('Notifications',r),{t:'Notifications',r});changed=true;
      }
    }
  }
  const safe = new Map(candidates), blocked=[];
  const staticParents = new Set(['Roles','Categories','CreditPackages']);
  for (const [key,p] of safe) {
    const {t,r}=p;
    let reason;
    if (['SystemSettings','AdminAuditLogs'].includes(t)) reason='Shared configuration/audit is never deleted';
    if (t==='Stores' && (!/^AuthLocal_[a-z0-9]+$/.test(r.StoreName)||r.Address!=='Local fixture only')) reason='Store fixture signature differs';
    if (t==='Listings' && (!/^AuthLocal_[a-z0-9]+ (cancel|payment|delivery fixture|browser create|D01 concurrent)$/.test(r.Title)||r.Description!=='Isolated local auth test; no real transfer or external notification')) reason='Listing fixture signature differs';
    if (reason) {safe.delete(key);blocked.push({table:t,keys:tables[t].keys.map(k=>r[k]),reason});}
  }
  const invalidSignatures = new Set(blocked.map(b=>b.table+':'+JSON.stringify(b.keys)));
  // Retain mixed business rows and their required parents. Other isolated test
  // orders may still be removed even if their fixture seller must be retained.
  changed=true;
  while(changed) {
    changed=false;
    for(const [key,p] of safe) {
      let reason;
      for(const f of fks.filter(f=>f.t===p.t&&!staticParents.has(f.pt))) {
        if(p.r[f.c]==null)continue;
        const parent=tables[f.pt]?.rows.find(r=>r[f.pc]===p.r[f.c]);
        const parentKey=parent&&id(f.pt,parent);
        const accountData=['UserRoles','UserCredits','DriverProfiles','PartnerApplications','VerificationCodes'].includes(p.t);
        const fixtureParent=!accountData&&['Users','Stores','Listings'].includes(f.pt)&&candidates.has(parentKey)&&!invalidSignatures.has(parentKey);
        if(parent&&!safe.has(parentKey)&&!fixtureParent) {reason='References retained '+f.pt+'.'+f.pc;break;}
      }
      for(const f of fks.filter(f=>f.pt===p.t)) {
        if(tables[f.t]?.rows.some(r=>r[f.c]===p.r[f.pc]&&!safe.has(id(f.t,r)))) {reason='Referenced by retained '+f.t;break;}
      }
      if(p.t==='Notifications'&&!roots.some(u=>u.UserId===p.r.UserId))reason='Notification belongs to a non-fixture account';
      if(p.t==='Notifications'){
        const target={ORDER:'Orders',DELIVERY:'Deliveries',LISTING:'Listings'}[p.r.ReferenceType];
        const parent=target&&tables[target]?.rows.find(r=>r[tables[target].keys[0]]===p.r.ReferenceId);
        if(parent&&!safe.has(id(target,parent)))reason='Notification refers to retained business data';
      }
      if(['Orders','Deliveries','Listings'].includes(p.t)){
        const kind={Orders:'ORDER',Deliveries:'DELIVERY',Listings:'LISTING'}[p.t];
        if(tables.Notifications?.rows.some(r=>r.ReferenceType===kind&&r.ReferenceId===p.r[tables[p.t].keys[0]]&&!safe.has(id('Notifications',r))))reason='Referenced by retained notification';
      }
      if(reason){safe.delete(key);blocked.push({table:p.t,keys:tables[p.t].keys.map(k=>p.r[k]),reason});changed=true;}
    }
  }
  const summary={};
  for(const {t,r} of safe.values())(summary[t] ||= []).push(tables[t].keys.map(k=>r[k]));
  for(const list of Object.values(summary))list.sort((a,b)=>Number(a[0])-Number(b[0]));
  const digest=crypto.createHash('sha256').update(JSON.stringify(summary)).digest('hex');
  return {tables,fks,safe,summary,blocked,digest};
}
async function main(){
  const identity=await verifyLocalDatabase(db);
  const preview=await plan();
  const publicPlan={identity,digest:preview.digest,counts:Object.fromEntries(Object.entries(preview.summary).map(([t,ids])=>[t,ids.length])),ids:preview.summary,retained:preview.blocked};
  console.log(JSON.stringify(publicPlan,null,2));
  if(!process.argv.includes('--apply'))return;
  if(process.env.AUTHLOCAL_PLAN_SHA256!==preview.digest)throw new Error('Review dry-run IDs and provide AUTHLOCAL_PLAN_SHA256');
  if(!process.env.AUTHLOCAL_BACKUP_DIR)throw new Error('Provide backup directory before deleting fixture rows');
  fs.mkdirSync(process.env.AUTHLOCAL_BACKUP_DIR,{recursive:true});
  await db.transaction(async transaction=>{
    const locked=await plan(transaction);
    if(locked.digest!==preview.digest)throw new Error('Database changed since preview; review again');
    fs.writeFileSync(path.join(process.env.AUTHLOCAL_BACKUP_DIR,'authlocal-rows.json'),JSON.stringify({identity,rows:[...locked.safe.values()]},null,2),{flag:'wx'});
    const remaining=new Set(locked.safe.keys());
    while(remaining.size){let deleted=0;
      for(const key of [...remaining]){
        const {t,r}=locked.safe.get(key);
        const hasChild=locked.fks.some(f=>f.pt===t&&[...remaining].some(k=>{const p=locked.safe.get(k);return p.t===f.t&&p.r[f.c]===r[f.pc]}));
        if(hasChild)continue;
        const columns=locked.tables[t].keys;
        await db.query('DELETE FROM '+quote(t)+' WHERE '+columns.map(c=>quote(c)+' = ?').join(' AND '),{replacements:columns.map(c=>r[c]),transaction});
        remaining.delete(key);deleted++;
      }
      if(!deleted)throw new Error('Cyclic references retained; no FK checks are disabled');
    }
    for(const [table,definition] of Object.entries(locked.tables)){
      if(table.startsWith('Sequelize'))continue;
      const key=row=>JSON.stringify(definition.keys.map(k=>row[k]));
      const expected=definition.rows.filter(r=>!locked.safe.has(table+':'+key(r)));
      const [actual]=await db.query('SELECT * FROM '+quote(table),{transaction});
      const normalized=rows=>rows.map(r=>[key(r),JSON.stringify(r)]).sort((a,b)=>a[0].localeCompare(b[0]));
      assert.deepEqual(normalized(actual),normalized(expected),'Unexpected change to retained '+table+'; rollback');
    }
  });
  console.log('COMMITTED exact AuthLocal fixture graph; FK checks remained enabled.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.close());
module.exports={plan};
