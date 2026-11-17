'use strict';
const fs=require('node:fs');
const {verifyLocalDatabase}=require('./local-db-guard');
// The schema comes from migrations. Import only snapshot INSERTs in FK order;
// never execute dump directives (DROP/USE/FOREIGN_KEY_CHECKS) on the local DB.
async function importLocalSnapshotData(db,file){
  await verifyLocalDatabase(db,{allowTest:true});
  const text=fs.readFileSync(file,'utf8'),columns=new Map(),inserts=new Map();
  for(const match of text.matchAll(/CREATE TABLE `([A-Za-z0-9_]+)` \(([\s\S]*?)\) ENGINE/g))columns.set(match[1],[...match[2].matchAll(/^\s*`([A-Za-z0-9_]+)`/gm)].map(m=>m[1]));
  for(const match of text.matchAll(/^INSERT INTO `([A-Za-z0-9_]+)` VALUES ([^\r\n]+);\s*$/gm)){
    if(match[1].startsWith('Sequelize'))continue;
    if(!columns.get(match[1])?.length)throw new Error('Snapshot column metadata missing: '+match[1]);
    (inserts.get(match[1])||inserts.set(match[1],[]).get(match[1])).push(match[2]);
  }
  if(!inserts.has('Users'))throw new Error('No Users INSERT in supported snapshot format');
  const [fks]=await db.query('SELECT TABLE_NAME t,REFERENCED_TABLE_NAME p FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL');
  const loaded=[],pending=new Set(inserts.keys());
  await db.transaction(async transaction=>{
    while(pending.size){let progress=false;
      for(const table of [...pending]){
        if(fks.some(f=>f.t===table&&f.p!==table&&pending.has(f.p)))continue;
        const [keys]=await db.query("SELECT COLUMN_NAME c FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION",{replacements:[table],transaction});
        if(!keys.length)throw new Error('Snapshot table has no primary key: '+table);
        // Migrations can already create admin#999/settings. Preserve those rows
        // while inserting missing snapshot identities needed by child records.
        for(const values of inserts.get(table))await db.query('INSERT INTO `'+table+'` ('+columns.get(table).map(c=>'`'+c+'`').join(',')+') VALUES '+values+' ON DUPLICATE KEY UPDATE `'+keys[0].c+'`=`'+keys[0].c+'`',{transaction});
        loaded.push(table);
        pending.delete(table);progress=true;
      }
      if(!progress)throw new Error('Snapshot has cyclic dependencies; no FK checks were disabled');
    }
  });
  return loaded;
}
module.exports={importLocalSnapshotData};
