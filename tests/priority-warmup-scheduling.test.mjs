import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const scheduler=app.slice(app.indexOf('function setWarmupStatus('),app.indexOf('function readLoginPreview('));
const calls=[];
const pending=new Map();
let clock=0;
const read=name=>{
  calls.push(name);
  return new Promise(resolve=>pending.set(name,resolve));
};
const api={warmEpoch:0};
for(const name of ['posBootstrap','stockBootstrap','workshopBootstrap','workerPortalOwnerQueue','expenseBootstrap','preorderBootstrap','productBootstrap'])
  api[name]=()=>read(name);
const context=vm.createContext({
  api,main:{querySelector:()=>null},hasFamilyAccess:()=>true,
  priorityWarmupToken:'',warmupStatus:'',loginFlowId:1,
  sessionToken:'family-a',currentSession:{user:{name:'Owner'}},activeRoute:'home',
  Date:{now:()=>clock},setTimeout:(callback,delay)=>{if(delay===700)callback();return 1;}
});
vm.runInContext(scheduler+'\nthis.schedule=schedulePriorityWarmup',context);
context.schedule('family-a',1);
assert.deepEqual(calls,['posBootstrap','workshopBootstrap','expenseBootstrap']);

clock=8000;
for(const name of [...calls])pending.get(name)({ok:true});
for(let i=0;i<8;i++)await Promise.resolve();
assert.ok(calls.includes('stockBootstrap'));
assert.ok(calls.includes('workerPortalOwnerQueue'));
assert.ok(calls.includes('preorderBootstrap'));

clock=12000;
for(const name of ['stockBootstrap','workerPortalOwnerQueue','preorderBootstrap'])pending.get(name)({ok:true});
for(let i=0;i<8;i++)await Promise.resolve();
assert.ok(calls.includes('productBootstrap'),
  'a user who stays on Home should eventually have the frequently used product catalog prepared');
pending.get('productBootstrap')({ok:true});
