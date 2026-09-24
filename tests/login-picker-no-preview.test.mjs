import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const submit=app.match(/async function submitPin\(\)\{([\s\S]*?)\n\}/)?.[1];
assert.ok(submit,'PIN submission handler exists');
let rejectLogin;
const events=[];
const context=vm.createContext({
  pinInput:'123456',pinSubmitting:false,loginFlowId:1,
  document:{querySelector:()=>null},
  readLoginPreview:()=>[],
  showUserPicker:(_users,options)=>events.push(`picker:${!!options?.pending}`),
  api:{login:()=>new Promise((_resolve,reject)=>{rejectLogin=reject;})},
  sound:{error:()=>{}},
  showLogin:message=>events.push(`login:${message}`),
  renderPin:()=>events.push('render-pin')
});
vm.runInContext(`async function run(){${submit}}; this.run=run`,context);
const pending=context.run();
assert.deepEqual(events,['picker:true'],'the picker shell must appear immediately even without cached names');
rejectLogin(new Error('INVALID_PIN'));
await pending;
assert.deepEqual(events,['picker:true','login:รหัสไม่ถูกต้อง'],'invalid PIN must return to a usable PIN screen');
console.log('PASS: picker shell without cached names and invalid PIN recovery');

let resolveLate,loginCalls=0;
const staleEvents=[];
const stale=vm.createContext({
  pinInput:'123456',pinSubmitting:false,loginFlowId:1,
  document:{querySelector:()=>null},
  readLoginPreview:()=>[],
  showUserPicker:(_users,options)=>staleEvents.push(options?.pending?'pending':'authorized'),
  api:{login:()=>{loginCalls++;return new Promise(resolve=>{resolveLate=resolve;})}},
  sound:{error:()=>{}},showLogin:()=>{},
  sessionStorage:{setItem:()=>{}},SESSION_KEY:'session',
  saveLoginPreview:()=>{},preloadHomeData:()=>{},
  renderPin:()=>{}
});
vm.runInContext(`async function run(){${submit}}; this.run=run`,stale);
const old=stale.run();
await stale.run();
assert.equal(loginCalls,1,'repeated submit while pending must not send another PIN request');
stale.loginFlowId=2;
resolveLate({ok:true,session:'old',level:'family',users:[{name:'old'}]});
await old;
assert.deepEqual(staleEvents,['pending'],'late login must not show names after the flow changed');
