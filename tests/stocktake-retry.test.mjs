import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/api.js',import.meta.url),'utf8').replace('export class ApiClient','class ApiClient');
let attempts=0;
const context=vm.createContext({
  globalThis:{SUPANBENJARONG_RUNTIME_CONFIG:{gatewayApiUrl:'https://gateway.example.test/api'}},
  AbortController,setTimeout,clearTimeout,
  fetch:async()=>{
    attempts++;
    return {ok:true,text:async()=>attempts===1?'<!doctype html><title>Temporary</title>':JSON.stringify({ok:true,result:{success:true,message:'เปิดจุดตรวจนับแล้ว'}})};
  }
});
vm.runInContext(source+'\nthis.ApiClient=ApiClient',context);
const api=new context.ApiClient();
const opened=await api.stockTake('session','openStockTakeLocation',{roundId:'R1',locationId:'L1'});
assert.equal(opened.result.message,'เปิดจุดตรวจนับแล้ว');
assert.equal(attempts,2,'idempotent open should recover after a malformed redirect');
attempts=0;
await assert.rejects(api.stockTake('session','applyStockTakeSaleAdjustment',{roundId:'R1'}),/ผิดรูปแบบ/);
assert.equal(attempts,1,'a sale adjustment must not be replayed blindly');
console.log('PASS: stocktake safe retry and sale-adjustment duplicate protection.');
