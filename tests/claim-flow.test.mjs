import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const claimSource=fs.readFileSync(new URL('../js/claim.js',import.meta.url),'utf8').replace(/export /g,'');
const gasSource=fs.readFileSync(new URL('../../36_PwaApi.gs',import.meta.url),'utf8');
const bill={billNo:'INV-TEST',customer:'ลูกค้าทดสอบ',type:'INV',date:'01/01/2569',amount:800,items:'แก้วมัค',itemsArr:[{code:'SKU-OLD',name:'แก้วมัค',pattern:'ลายทอง',size:'M',price:800,qty:1,remainingQty:1}]};
const product={code:'SKU-NEW',name:'จานเบญจรงค์',pattern:'ลายทอง',size:'L',price:1200,stock:2};
const fields={'#claimCustomer':{value:'ลูกค้าทดสอบ'},'#claimPhone':{value:'0800000000'},'#claimReason':{value:'สินค้าเสียหาย'},'#claimNote':{value:'ทดสอบเส้นทาง'}};
for(const field of Object.values(fields)) field.closest=()=>null;
const root={isConnected:true,dataset:{route:'claim'},innerHTML:'',querySelector(selector){return fields[selector]||null;}};
const context=vm.createContext({console,Intl,Number,String,Math,Promise,setTimeout,Node:{TEXT_NODE:3}});
vm.runInContext(claimSource,context);
let savedPayload=null;
const toastLog={value:''};
context.api={
  claimBootstrap:async()=>({ok:true,result:{bills:[bill]}}),
  claimSupport:async()=>({ok:true,result:{products:[product],claims:[]}}),
  claimSave:async(_token,payload)=>{savedPayload=payload;return {ok:true,result:{success:true,message:'บันทึกสำเร็จ'}};},
  claimComplete:async()=>({ok:true,result:{success:true,message:'complete'}})
};
context.root=root;
context.testBill=bill;
context.testProduct=product;
context.toastLog=toastLog;
vm.runInContext('renderClaim(root,api,"session",()=>{}, {toast:(message)=>toastLog.value=message})',context);
await new Promise(resolve=>setImmediate(resolve));
await new Promise(resolve=>setImmediate(resolve));
assert.match(root.innerHTML,/📝 บันทึกเคลม/,'claim page should render from real bootstrap payload');
assert.match(root.innerHTML,/🔄 รับคืน\/เคลม/,'claim header should retain its GAS-parity identity');
vm.runInContext('S.bill=JSON.parse(JSON.stringify(testBill));S.items=[{...S.bill.itemsArr[0],source:0,qty:1,newProduct:JSON.parse(JSON.stringify(testProduct))}];S.method="เปลี่ยน+ส่วนต่าง";S.draft={customer:"ลูกค้าทดสอบ",phone:"0800000000",reason:"สินค้าเสียหาย",note:"ทดสอบเส้นทาง"}',context);
await vm.runInContext('save(root)',context);
assert.equal(savedPayload.billNo,'INV-TEST');
assert.equal(savedPayload.method,'เปลี่ยน+ส่วนต่าง');
assert.equal(savedPayload.items[0].oldProductSku,'SKU-OLD');
assert.equal(savedPayload.items[0].newProductSku,'SKU-NEW');
assert.match(toastLog.value,/สำเร็จ/,'successful claim response should reach the user');
savedPayload=null;toastLog.value='';
vm.runInContext('S.data={bills:[testBill],products:[testProduct],claims:[]};S.bill=JSON.parse(JSON.stringify(testBill));S.items=[{...S.bill.itemsArr[0],source:0,qty:1}];S.method="เปลี่ยนชิ้นใหม่";S.draft={customer:"ลูกค้าทดสอบ",phone:"",reason:"สินค้าเสียหาย",note:""}',context);
await vm.runInContext('save(root)',context);
assert.equal(savedPayload,null,'client must not send a change claim without a replacement');
assert.match(toastLog.value,/เลือกสินค้าทดแทน/);
assert.match(gasSource,/if\(!bill\) throw new Error\('ไม่พบบิลหรือ PO ที่เลือก/,'server must reject an invented bill');
assert.match(gasSource,/claimItem\.oldPrice=\(Number\(source\.price\)\|\|0\)\*qty/,'server must calculate the old price from the bill');
assert.match(gasSource,/claimItem\.newPrice=\(Number\(replacement\.price\)\|\|0\)\*qty/,'server must calculate the replacement price from product data');
assert.match(gasSource,/เปลี่ยนชิ้นใหม่ต้องใช้สินค้า SKU เดิม/,'server must enforce same-SKU exchanges');
console.log('PASS: claim bootstrap/support rendering, save payload, required replacement guard, and server-side price/SKU validation contract. Test doubles only; no production writes.');
