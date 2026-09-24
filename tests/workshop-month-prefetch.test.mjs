import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../js/workshop.js",import.meta.url),"utf8").replace("export function renderWorkshop","function renderWorkshop");
const timers=new Map();
let nextTimer=0;
const calls=[];
const context=vm.createContext({
  console,
  setTimeout(callback){const id=++nextTimer;timers.set(id,callback);return id;},
  clearTimeout(id){timers.delete(id);},
  renderCalls:0,
  root:{isConnected:true,dataset:{route:"workshop"}}
});
vm.runInContext(source,context);
vm.runInContext("render=()=>{renderCalls++}",context);
const state=vm.runInContext("S",context);
state.token="session-a";
state.tab="monthly";
state.monthKey="2026-09";
state.api={workshopMonthlyAttendance:async(_token,year,month)=>{
  calls.push(`${year}-${String(month).padStart(2,"0")}`);
  return {ok:true,result:[{name:"ช่างทดสอบ",date:1,rate:100}]};
}};

await vm.runInContext('loadMonth(root,"2026-09")',context);
assert.deepEqual(calls,["2026-09"],"selected month loads first");
assert.equal(timers.size,1,"previous month is queued after selected month loads");
const [timerId,prefetch]=[...timers][0];
timers.delete(timerId);
prefetch();
await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(calls,["2026-09","2026-08"],"only the adjacent previous month is prefetched");
state.monthKey="2026-08";
await vm.runInContext('loadMonth(root,"2026-08")',context);
assert.deepEqual(calls,["2026-09","2026-08"],"navigation to warmed month does not repeat the API request");
assert.equal(context.renderCalls,1,"background prefetch does not redraw another month");

let resolveLate;
state.monthKey="2026-07";
assert.match(vm.runInContext("monthly()",context),/กำลังโหลดข้อมูลเดือนนี้/,"unloaded month must not appear empty");
state.monthErrors["2026-07"]="timeout";
assert.match(vm.runInContext("monthly()",context),/data-a="retryMonth"/,"failed month must offer retry");
delete state.monthErrors["2026-07"];
state.api.workshopMonthlyAttendance=()=>new Promise(resolve=>{resolveLate=resolve;});
const oldRequest=vm.runInContext('loadMonth(root,"2026-07")',context);
state.monthGeneration++;
state.monthRequests={};
resolveLate({ok:true,result:[{name:"stale"}]});
await oldRequest;
assert.equal(Object.hasOwn(state.months,"2026-07"),false,"invalidated response must not restore stale attendance");
console.log("PASS: workshop month prefetch, cache reuse, and stale-response guard");
