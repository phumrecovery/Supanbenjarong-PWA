import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../../36_PwaApi.gs',import.meta.url),'utf8');
const start=source.indexOf('function pwaApiExpenseUpdateStatus_(');
const end=source.indexOf('function pwaApiExpenseDelete_(',start);
assert.ok(start>0&&end>start,'the read-only GAS confirmation action must exist');
assert.match(source,/request\.action === 'expenseUpdateStatus'/,'the PWA API must route the confirmation action');

const rows={
  expense:[new Date('2026-09-15T00:00:00Z'),'รายจ่าย','อื่นๆ','ค่าจ้างรวมวันที่ 1-15 ก.ย.69',25796.5,'','เจ้าของร้าน','','',0,0,''],
  investment:[new Date('2026-09-15T00:00:00Z'),'อุปกรณ์','เครื่องมือ',1200,'เงินสด','','เจ้าของร้าน',''],
  fixed:[1,'ค่าเช่า',1000,'วันที่ 1','ร้าน',new Date('2026-01-01T00:00:00Z'),'','ยังจ่ายอยู่']
};
const names={expense:'ค่าใช้จ่าย',investment:'เงินลงทุน',fixed:'ค่าใช้จ่ายประจำ'};
const context=vm.createContext({
  Date,Math,Number,String,isFinite,
  EXP_SHEET:names.expense,INVEST_SHEET:names.investment,FIXED_SHEET:names.fixed,
  pwaApiExpenseRun_:(_session,fn)=>fn(),
  pwaApiCleanExpense_:v=>v,pwaApiCleanInvestment_:v=>v,pwaApiCleanFixed_:v=>v,
  isAdvanceWageCategory_:()=>false,
  Utilities:{formatDate:d=>new Date(d.getTime()+7*60*60*1000).toISOString().slice(0,10)},
  getSS_:()=>({getSheetByName:name=>{
    const kind=Object.keys(names).find(key=>names[key]===name);
    return {getLastRow:()=>110,getRange:()=>({getValues:()=>[rows[kind]]})};
  }})
});
vm.runInContext(source.slice(start,end),context);
const check=(kind,expected)=>context.pwaApiExpenseUpdateStatus_({kind,row:110,expected},{user:{name:'เจ้าของร้าน'}}).applied;
assert.equal(check('expense',{date:'2026-09-15',type:'รายจ่าย',cat:'อื่นๆ',detail:'ค่าจ้างรวมวันที่ 1-15 ก.ย.69',amount:25796.5,note:'',img:'__KEEP__'}),true);
assert.equal(check('expense',{date:'2026-08-31',type:'รายจ่าย',cat:'อื่นๆ',detail:'ค่าจ้างรวมวันที่ 1-15 ก.ย.69',amount:25796.5,note:'',img:'__KEEP__'}),false);
assert.equal(check('investment',{date:'2026-09-15',cat:'อุปกรณ์',detail:'เครื่องมือ',amount:1200,payMethod:'เงินสด',note:'',img:'__KEEP__'}),true);
assert.equal(check('fixed',{name:'ค่าเช่า',amount:1000,payDate:'วันที่ 1',payTo:'ร้าน',status:'ยังจ่ายอยู่'}),true);
assert.equal(check('fixed',{name:'ค่าเช่า',amount:2000,payDate:'วันที่ 1',payTo:'ร้าน',status:'ยังจ่ายอยู่'}),false);
console.log('expense edit status across three card types: PASS');
