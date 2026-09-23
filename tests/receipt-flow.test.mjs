import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/receipt.js',import.meta.url),'utf8').replace('export function renderReceipt','function renderReceipt');
const root={isConnected:true,dataset:{route:'receipt'},innerHTML:'',querySelector(){return null;}};
const context=vm.createContext({console,Number,String,Array,Promise,root});
vm.runInContext(source,context);
let resolveFirst;
const api={receiptBootstrap:()=>new Promise(resolve=>{resolveFirst=resolve;})};
vm.runInContext('renderReceipt(root,api,"session-a",()=>{})',Object.assign(context,{api}));
assert.match(root.innerHTML,/id="rcpSearch"/,'search renders before GAS responds');
assert.match(root.innerHTML,/กำลังโหลดบิลย้อนหลัง/);
assert.equal(typeof resolveFirst,'function');
resolveFirst({ok:true,bills:[{billNo:'INV-1',customer:'ลูกค้าหนึ่ง',dateTH:'23/09/2026',time:'10:00',net:500,pcs:1,payment:'เงินสด',canCancel:true,items:[]}],shop:{name:'ร้านทดสอบ'}});
await new Promise(resolve=>setImmediate(resolve));
// The UI is refreshed through the real DOM in Chrome; this VM guard catches
// a late response being applied after navigation or a new entry.
let resolveOld,resolveNew;
const oldApi={receiptBootstrap:()=>new Promise(resolve=>{resolveOld=resolve;})};
vm.runInContext('renderReceipt(root,api,"session-a",()=>{})',Object.assign(context,{api:oldApi}));
const nextApi={receiptBootstrap:()=>new Promise(resolve=>{resolveNew=resolve;})};
vm.runInContext('renderReceipt(root,api,"session-b",()=>{})',Object.assign(context,{api:nextApi}));
resolveOld({ok:true,bills:[{billNo:'STALE'}]});
await new Promise(resolve=>setImmediate(resolve));
assert.doesNotMatch(root.innerHTML,/STALE/);
root.dataset.route='home';
resolveNew({ok:true,bills:[{billNo:'ALSO-STALE'}]});
await new Promise(resolve=>setImmediate(resolve));
assert.doesNotMatch(root.innerHTML,/ALSO-STALE/);
console.log('receipt shell and stale-response guards: PASS');
