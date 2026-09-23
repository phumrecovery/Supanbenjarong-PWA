import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/preorder.js',import.meta.url),'utf8').replace('export async function renderPreorder','async function renderPreorder');
const portal={innerHTML:''};
const root={isConnected:true,dataset:{route:'preorder'},innerHTML:''};
const context=vm.createContext({
  console,Intl,Date,Number,String,Math,Promise,
  window:{addEventListener(){}},
  document:{querySelector(selector){return selector==='#preorder-modal-portal'?portal:null;},addEventListener(){}},
  root
});
vm.runInContext(source,context);
vm.runInContext(`runtime.root=root;state.data={
  quotations:[{qtNo:'QT-PENDING',customer:'หนึ่ง',status:'รอสร้าง PO'},{qtNo:'QT-DONE',customer:'สอง',status:'สร้าง PO แล้ว'}],
  preorders:[{poNo:'PO-PENDING',customer:'สาม',status:'รอส่ง'},{poNo:'PO-DONE',customer:'สี่',status:'ส่งแล้ว'}]
};draw()`,context);
assert.match(root.innerHTML,/QT-PENDING/);
assert.doesNotMatch(root.innerHTML,/QT-DONE/);
context.button={dataset:{pre:'tab',tab:'1'}};
await vm.runInContext('click({target:{closest:()=>button},preventDefault(){}})',context);
assert.match(root.innerHTML,/PO-PENDING/);
assert.doesNotMatch(root.innerHTML,/PO-DONE/);
console.log('preorder QT and PO pending defaults: PASS');
