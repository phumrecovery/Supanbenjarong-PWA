import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const gas=fs.readFileSync(new URL('../../04_WebApp.gs',import.meta.url),'utf8');
const source=gas.match(/function getLoginUsers\(level\) \{[\s\S]*?\n\}\n\nfunction clearLoginUsersCache_/);
assert.ok(source,'GAS family-user lookup exists');
const waits=[];
const cache={get:()=>null,put:()=>{}};
const context=vm.createContext({
  CacheService:{getScriptCache:()=>cache},
  LockService:{getScriptLock:()=>({waitLock:ms=>waits.push(ms),releaseLock:()=>{}})},
  getSS_:()=>({getSheetByName:()=>({getLastRow:()=>2,getRange:()=>({getValues:()=>[['1','Owner','ครอบครัว','','ใช้งาน','']]})})})
});
vm.runInContext(source[0].replace(/\n\nfunction clearLoginUsersCache_$/,''),context);
const users=context.getLoginUsers('family');
assert.equal(users.length,1);
assert.equal(users[0].name,'Owner');
assert.deepEqual(waits,[],'read-only family login must not queue behind long POS/workshop script locks');
console.log('PASS: family login cache miss never waits on the shared write lock');
