import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../js/workshop.js",import.meta.url),"utf8").replace(/export function /g,"function ");
const timers=new Map();
let timerId=0;
const calls=[];
const pending=[];
const root={isConnected:true,dataset:{route:"workshop"}};
const context=vm.createContext({
  console,root,renderCalls:0,
  setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,delay});return id;},
  clearTimeout(id){timers.delete(id);}
});
vm.runInContext(source,context);
vm.runInContext("render=()=>{renderCalls++}",context);
const state=vm.runInContext("S",context);
state.token="family-test";
state.tab="receive";
state.api={workshopWageSummary:(_token,start,end)=>{
  calls.push(`${start}|${end}`);
  return new Promise(resolve=>pending.push(resolve));
}};
const fireTimer=delay=>{
  const entry=[...timers].find(([,timer])=>timer.delay===delay);
  assert.ok(entry,`expected ${delay} ms timer`);
  timers.delete(entry[0]);
  entry[1].callback();
};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

vm.runInContext("queueInitialWage(root)",context);
fireTimer(900);
assert.equal(calls.length,1,"opening workshop prepares only the selected wage period");
state.tab="wage";
const selected=vm.runInContext("loadWage(root)",context);
assert.equal(calls.length,1,"opening the tab joins the in-flight read");
pending.shift()({ok:true,result:{pieceWork:[],dailyWork:[],marker:"current"}});
await selected;
await flush();
assert.equal(state.wages[state.wageKey].marker,"current");
assert.equal(context.renderCalls,1,"current result renders the selected tab");
fireTimer(600);
assert.equal(calls.length,2,"only the adjacent older period is prepared");
pending.shift()({ok:true,result:{pieceWork:[],dailyWork:[],marker:"previous"}});
await flush();
assert.equal(context.renderCalls,1,"background result cannot redraw the selected period");

state.wageKey=calls[1];
await vm.runInContext("loadWage(root)",context);
assert.equal(calls.length,2,"prepared period opens without another GAS read");
assert.equal(state.wages[state.wageKey].marker,"previous");

state.wagePrefetchedAt[state.wageKey]=Date.now()-25_000;
const fresh=vm.runInContext("loadWage(root)",context);
assert.equal(calls.length,3,"an expired prepared wage must be checked against GAS again");
assert.equal(Object.hasOwn(state.wages,state.wageKey),false,"expired figures cannot be used for payment decisions");
pending.shift()({ok:true,result:{pieceWork:[],dailyWork:[],marker:"refreshed"}});
await fresh;
assert.equal(state.wages[state.wageKey].marker,"refreshed");

const staleKey="2026-07-01|2026-07-15";
const late=vm.runInContext(`loadWagePeriod(root,"${staleKey}",{prefetch:true})`,context);
vm.runInContext("invalidateWages()",context);
pending.shift()({ok:true,result:{marker:"stale"}});
await late;
assert.equal(Object.hasOwn(state.wages,staleKey),false,"an invalidated reply cannot restore an old wage figure");
console.log("PASS: wage prefetch joins the active read, warms only one prior period, and rejects invalidated data");
