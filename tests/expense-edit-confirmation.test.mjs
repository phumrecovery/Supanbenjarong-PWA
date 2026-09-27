import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/api.js',import.meta.url),'utf8').replace('export class ApiClient','class ApiClient');
let replies=[];
const actions=[];
const context=vm.createContext({
  globalThis:{SUPANBENJARONG_RUNTIME_CONFIG:{gatewayApiUrl:'https://gateway.example.test/api'}},
  AbortController,setTimeout,clearTimeout,Date,Map,
  fetch:async(_url,options)=>{
    const payload=JSON.parse(options.body);
    actions.push(payload.action);
    const reply=replies.shift();
    return {ok:reply.ok??true,status:reply.status??200,text:async()=>reply.body};
  }
});
vm.runInContext(source+'\nthis.ApiClient=ApiClient',context);
const api=new context.ApiClient();
const expense={date:'2026-09-15',type:'รายจ่าย',cat:'อื่นๆ',detail:'ค่าจ้างรวมวันที่ 1-15 ก.ย.69',amount:25796.5};

replies=[{body:'<html>upstream error</html>'},{body:JSON.stringify({ok:true,result:{applied:true}})}];
const confirmed=await api.expenseUpdate('session',110,expense);
assert.equal(confirmed.ok,true);
assert.match(confirmed.message,/ตรวจยืนยัน/);
assert.deepEqual(actions,['expenseUpdate','expenseUpdateStatus'],'the edit must never be posted twice');

actions.length=0;
replies=[{ok:false,status:502,body:'<html>error</html>'},{body:JSON.stringify({ok:true,result:{applied:false}})}];
await assert.rejects(api.fixedUpdate('session',5,{name:'ค่าเช่า',amount:1000}),/รีเฟรชและตรวจรายการก่อนกดบันทึกซ้ำ/);
assert.deepEqual(actions,['fixedUpdate','expenseUpdateStatus']);

actions.length=0;
replies=[{body:JSON.stringify({ok:true,message:'แก้ไขสำเร็จ'})}];
assert.equal((await api.investmentUpdate('session',3,{amount:500})).ok,true);
assert.deepEqual(actions,['investmentUpdate']);

actions.length=0;
replies=[{body:JSON.stringify({ok:false,message:'แถวไม่ถูกต้อง'})}];
assert.equal((await api.expenseUpdate('session',1,expense)).ok,false);
assert.deepEqual(actions,['expenseUpdate'],'a definite server rejection needs no reconciliation');

console.log('expense edit response reconciliation: PASS');
