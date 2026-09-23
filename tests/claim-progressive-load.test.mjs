import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/claim.js',import.meta.url),'utf8').replace(/export /g,'');
const root={isConnected:true,dataset:{route:'claim'},innerHTML:'',querySelector(){return null;}};
const context=vm.createContext({console,Intl,Number,String,Math,Promise,Node:{TEXT_NODE:3}});
vm.runInContext(source,context);
let resolveBills,resolveSupport;
const api={
  claimBootstrap:()=>new Promise(resolve=>{resolveBills=resolve;}),
  claimSupport:()=>new Promise(resolve=>{resolveSupport=resolve;})
};
context.root=root;
context.api=api;
vm.runInContext('renderClaim(root,api,"session-a",()=>{})',context);
assert.match(root.innerHTML,/id="claimCustomer"/,'claim form must render before the bill request resolves');
assert.match(root.innerHTML,/กำลังโหลดบิล/,'the bill field must explain its loading state');
assert.equal(typeof resolveBills,'function');
assert.equal(typeof resolveSupport,'function','support data should start in parallel with bills');
vm.runInContext('S.billPicker=true;render(root)',context);
assert.match(root.innerHTML,/เลือกบิลหรือ PO/);
assert.match(root.innerHTML,/กำลังโหลดบิล/);
resolveSupport({ok:true,result:{products:[],claims:[]}});
await new Promise(resolve=>setImmediate(resolve));
assert.match(root.innerHTML,/id="claimCustomer"/,'support response must not hide the form');
root.dataset.route='home';
resolveBills({ok:true,result:{bills:[{billNo:'OLD'}]}});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(vm.runInContext('S.data.bills.length',context),0,'a response after navigation must be ignored');
console.log('PASS: claim form is immediate, requests run concurrently, and stale bill responses are ignored.');
