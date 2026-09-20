import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=name=>fs.readFileSync(new URL('../js/'+name,import.meta.url),'utf8').replace(/export /g,'');
const context=()=>vm.createContext({window:{addEventListener:()=>{}},console,Intl,Date,Number,String,Math,Promise,setTimeout:()=>{},document:{querySelector:()=>null,addEventListener:()=>{}},sessionStorage:{getItem:()=>null}});
const root=route=>({isConnected:true,dataset:{route},innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]});
const c=context();vm.runInContext(read('stock.js'),c);c.root=root('stock');
vm.runInContext('state.data={products:[{code:"TEST",name:"Test",layer:"ของขาว",balance:10}],movements:[]}',c);
const click=(action,direction)=>{c.button={dataset:{action,direction,index:'0'},closest:()=>null};vm.runInContext('handle(root,{target:{closest:()=>button}})',c);};
click('quickAdjust','OUT');assert.match(c.root.innerHTML,/ลดยอดสต๊อก/);
c.root.querySelector=id=>({'#quickStockQty':{value:'4'},'#quickStockNote':{value:'ตรวจนับ'}}[id]||null);
click('quickDirection','IN');assert.match(c.root.innerHTML,/value="4"/);assert.match(c.root.innerHTML,/value="ตรวจนับ"/);
const qty={value:2};c.root.querySelector=()=>qty;click('qty-plus');assert.equal(qty.value,3);click('qty-minus');assert.equal(qty.value,2);
c.root.querySelector=id=>({'#quickStockQty':{value:'4'},'#quickStockNote':{value:'ตรวจนับ'}}[id]||null);
let payload,calls=0,resolveSave;c.api={stockSaveMovement:(_token,data)=>{calls++;payload=data;return new Promise(resolve=>resolveSave=resolve)},stockBootstrap:async()=>({ok:true,result:{products:[],movements:[]}})};
vm.runInContext('state.api=api',c);const saving=vm.runInContext('saveQuickAdjust(root,{preventDefault(){}})',c);await vm.runInContext('saveQuickAdjust(root,{preventDefault(){}})',c);assert.equal(calls,1);assert.equal(payload.qty,4);assert.equal(payload.layer,'ของขาว');assert.equal(payload.type,'ปรับเพิ่ม');assert.equal(payload.note,'ตรวจนับ');
c.root.dataset.route='home';c.root.innerHTML='HOME';resolveSave({ok:true,result:{success:true}});await saving;assert.equal(c.root.innerHTML,'HOME');
for(const failed of [false,true]){
 const e=context();vm.runInContext(read('expense.js'),e);e.root=root('expense');let complete;e.api={expenseBootstrap:()=>new Promise((res,rej)=>complete=failed?()=>rej(Error('test')):()=>res({ok:true,result:{}})),expenseTransactions:async()=>({ok:true,result:{}}),expenseSupport:async()=>({ok:true,result:{}})};
 const pending=vm.runInContext('renderExpense(root,api,"",()=>{})',e);e.root.dataset.route='home';e.root.innerHTML='HOME';complete();await pending;await new Promise(res=>setImmediate(res));assert.equal(e.root.innerHTML,'HOME');
 e.root.dataset.route='expense';await vm.runInContext(failed?'Promise.resolve()':'renderExpense(root,api,"",()=>{})',e);if(!failed)assert.match(e.root.innerHTML,/expense-page/);
}
for(const [file,route,draw] of [['preorder.js','preorder','draw()'],['workshop.js','workshop','render(root)'],['pos.js','sales','draw(root)']]){const e=context();vm.runInContext(read(file),e);e.root=root('home');e.root.innerHTML='HOME';if(file==='preorder.js')vm.runInContext('runtime.root=root',e);vm.runInContext(draw,e);assert.equal(e.root.innerHTML,'HOME',route);}
console.log('PASS: popup, quantity controls, retained draft, real API payload contract, duplicate-submit protection, late save, delayed expense success/failure, revisit, other route render guards. Test doubles only; no production writes.');
