import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/api.js',import.meta.url),'utf8').replace('export class ApiClient','class ApiClient');
let requests=[];
const context=vm.createContext({
  globalThis:{SUPANBENJARONG_RUNTIME_CONFIG:{gatewayApiUrl:'https://gateway.example.test/api'}},
  AbortController,
  setTimeout,clearTimeout,
  fetch:async (_url,options)=>{
    const payload=JSON.parse(options.body);
    requests.push(payload.action);
    await new Promise(resolve=>setTimeout(resolve,120));
    return {ok:true,json:async()=>({ok:true,products:[{code:'A1'}],result:{categories:['ค่าไฟ']}})};
  }
});
vm.runInContext(source+'\nthis.ApiClient=ApiClient',context);
const api=new context.ApiClient();
const start=Date.now();
await api.expenseBootstrap('session-a');
const firstMs=Date.now()-start;
const repeatStart=Date.now();
await api.expenseBootstrap('session-a');
const repeatMs=Date.now()-repeatStart;
assert.deepEqual(requests,['expenseBootstrap'],'repeat entry must reuse warmed master data');
assert.ok(repeatMs<firstMs*.9,`repeat ${repeatMs} ms must beat first ${firstMs} ms by 10%`);

requests=[];
await Promise.all([api.barcodeBootstrap('session-a'),api.barcodeBootstrap('session-a')]);
assert.deepEqual(requests,['barcodeBootstrap'],'concurrent route and warmup must share one request');
await api.barcodeBootstrap('session-b');
assert.deepEqual(requests,['barcodeBootstrap','barcodeBootstrap'],'another session must not see the first session cache');
api.clearWarmCache();
await api.barcodeBootstrap('session-a');
assert.deepEqual(requests,['barcodeBootstrap','barcodeBootstrap','barcodeBootstrap'],'invalidation must refresh catalog');
console.log(`PASS: warm master data first ${firstMs} ms, repeat ${repeatMs} ms`);
