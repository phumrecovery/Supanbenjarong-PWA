import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/api.js',import.meta.url),'utf8').replace('export class ApiClient','class ApiClient');
const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const requests=[];
let releasePos;
const heldPos=new Promise(resolve=>{releasePos=resolve;});
const context=vm.createContext({
  globalThis:{SUPANBENJARONG_RUNTIME_CONFIG:{gatewayApiUrl:'https://gateway.example.test/api'}},
  AbortController,setTimeout,clearTimeout,
  fetch:async(_url,options)=>{
    const payload=JSON.parse(options.body);
    requests.push(payload);
    if(payload.action==='posBootstrap')await heldPos;
    return {ok:true,text:async()=>JSON.stringify({ok:true,items:[]})};
  }
});
vm.runInContext(source+'\nthis.ApiClient=ApiClient',context);
const api=new context.ApiClient();

const background=api.posBootstrap('family-a');
const foreground=api.posBootstrap('family-a');
assert.strictEqual(background,foreground,'opening POS during preload must share the pending GAS request');
releasePos();
await Promise.all([background,foreground]);
assert.equal(requests.filter(item=>item.action==='posBootstrap').length,1);
await api.posBootstrap('family-a');
assert.equal(requests.filter(item=>item.action==='posBootstrap').length,1,'fresh catalog may be reused briefly');
await api.posBootstrap('family-b');
assert.equal(requests.filter(item=>item.action==='posBootstrap').length,2,'another login cannot reuse a catalog keyed to an old token');

await api.productBootstrap('family-a','store');
await api.productBootstrap('family-a','whiteware');
assert.deepEqual(requests.filter(item=>item.action==='productBootstrap').map(item=>item.layer),['store','whiteware'],
  'product layers need separate cache entries');
await api.request({action:'stockSaveMovement',session:'family-a',data:{}});
await api.posBootstrap('family-a');
assert.equal(requests.filter(item=>item.action==='posBootstrap').length,3,'stock writes must invalidate POS data');

const warmup=app.slice(app.indexOf('function schedulePriorityWarmup('),app.indexOf('function readLoginPreview('));
for(const action of ['posBootstrap','workshopBootstrap','workerPortalOwnerQueue','expenseBootstrap','preorderBootstrap','productBootstrap','stockBootstrap'])
  assert.ok(warmup.includes(`api.${action}(`),`${action} should be eligible for background preparation`);
assert.ok(!warmup.includes('barcodeBootstrap'),'rarely used barcode data should load on demand');
assert.ok(warmup.includes('Date.now()-startedAt>=30_000'),'background work must have a bounded launch window');
console.log('PASS: prioritized warmup reuses live reads and respects user/session boundaries');
