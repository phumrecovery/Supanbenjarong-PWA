import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const body=source.match(/async function loadHomeData\(\)\{([\s\S]*?)\r?\n\}\r?\n\r?\nfunction renderPlaceholder/)?.[1];
assert.ok(body,'loadHomeData must be available for stale-response testing');
let resolveHome;
const calls=[];
const context=vm.createContext({
  sessionToken:'family-token', currentSession:{level:'family',user:{name:'เจ้าของ'}}, activeRoute:'home', homeData:null, loginFlowId:0,
  main:{dataset:{route:'home'}},
  api:{homeBootstrap:()=>new Promise(resolve=>{resolveHome=resolve;})},
  topbarTitle:{textContent:''}, setLogo:()=>calls.push('logo'), renderHome:()=>calls.push('render-home'), showToast:()=>calls.push('toast')
});
vm.runInContext(`async function underTest(){${body}}`,context);
const pending=context.underTest();
// This is the exact logout timing: request is in flight, local session is
// cleared, and the old #home route still exists in browser history.
context.sessionToken='';
context.currentSession=null;
context.loginFlowId++;
context.activeRoute='login';
context.main.dataset.route='login';
resolveHome({ok:true,shop:{name:'ร้านทดสอบ'}});
await pending;
assert.deepEqual(calls,[],'a home response from a logged-out session must not redraw the POS-only shell');
assert.equal(context.homeData,null,'logged-out state must not receive authenticated home data');
console.log('logout stale home response: PASS');
