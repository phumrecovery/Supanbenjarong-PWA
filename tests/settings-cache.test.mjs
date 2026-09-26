import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/api.js',import.meta.url),'utf8').replace('export class ApiClient','class ApiClient');
let clock=0;
const reads=[];
const context=vm.createContext({
  globalThis:{SUPANBENJARONG_RUNTIME_CONFIG:{gatewayApiUrl:'https://gateway.example.test/api'}},
  AbortController,setTimeout,clearTimeout,Date:{now:()=>clock},
  fetch:async(_url,options)=>{
    const payload=JSON.parse(options.body);
    if(payload.action==='settingsBootstrap')reads.push(payload.session);
    return {ok:true,text:async()=>JSON.stringify({ok:true,data:{config:{shop_name:'ร้าน'},users:[]}})};
  }
});
vm.runInContext(source+'\nthis.ApiClient=ApiClient',context);
const api=new context.ApiClient();

assert.equal(api.cachedSettingsBootstrap('family-a'),null);
const first=await api.settingsBootstrap('family-a');
assert.equal(first.data.config.shop_name,'ร้าน');
assert.equal(api.cachedSettingsBootstrap('family-a').data.config.shop_name,'ร้าน');
clock=60_000;
await api.settingsBootstrap('family-a');
assert.deepEqual(reads,['family-a'],'reopening settings shortly after the first visit must skip GAS');

await api.settingsBootstrap('family-b');
assert.deepEqual(reads,['family-a','family-b'],'another session must not see the first user’s settings');
await api.settingsSaveConfig('family-a',{shop_name:'ร้านใหม่'});
assert.equal(api.cachedSettingsBootstrap('family-a'),null,'a successful edit invalidates the snapshot');
await api.settingsBootstrap('family-a');
assert.deepEqual(reads,['family-a','family-b','family-a'],'the next visit after an edit must read fresh settings');

clock+=5*60_000+1;
assert.equal(api.cachedSettingsBootstrap('family-a'),null,'expired settings must not appear as current');
await api.settingsBootstrap('family-a');
assert.deepEqual(reads,['family-a','family-b','family-a','family-a']);
console.log('PASS: settings cache reuse, session isolation, edit invalidation, and expiry');
