import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../../36_PwaApi.gs',import.meta.url),'utf8');
let legacyCalls=0;
const context=vm.createContext({
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
  Utilities:{getUuid:()=>"id"},
  Date, JSON, String, Number, Math,
  ContentService:{createTextOutput:payload=>({setMimeType:()=>JSON.parse(payload)}),MimeType:{JSON:'json'}}
});
vm.runInContext(source,context);
context.verifyPin=()=>({level:'family'});
context.getLoginUsers=()=>[{name:'เจ้าของ',role:'เจ้าของร้าน'}];
context.pwaApiCreateSession_=()=>"signed-session";
context.workerPortalLegacyIdentity_=()=>{legacyCalls++; return null;};

const result=context.pwaApiLogin_({pin:'123456'});
assert.equal(legacyCalls,0,'a family PIN must never call the legacy worker app');
assert.equal(result.ok,true);
assert.equal(result.level,'family');
assert.equal(result.users.length,1);
console.log('family login skips worker fetch: PASS');
