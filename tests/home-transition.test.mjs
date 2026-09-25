import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const functions=source.match(/function cancelHomeExit\(\)\{[\s\S]*?\n\}\nfunction openHomeMenu\(button\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(functions,'home exit handlers exist');

let callback,exitDelay,cleared=false,reduced=false;
const classes=new Set();
const routes=[];
const context=vm.createContext({
  main:{dataset:{route:'home'},classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}},
  sessionToken:'family',loginFlowId:4,activeRoute:'home',currentSession:{user:{name:'เจ้าของ'}},
  window:{matchMedia:()=>({matches:reduced})},
  setTimeout:(fn,delay)=>{callback=fn;exitDelay=delay;return 1;},clearTimeout:()=>{cleared=true;},
  navigate:route=>routes.push(route)
});
vm.runInContext(`let homeExitTimer=0;${functions};this.openHomeMenu=openHomeMenu;this.cancelHomeExit=cancelHomeExit`,context);
const button={dataset:{route:'expense'},classList:{add:name=>classes.add(name)}};
context.openHomeMenu(button);
assert.ok(classes.has('home-leaving'),'tap starts an exit effect immediately');
assert.equal(exitDelay,380,'the cards remain visible long enough for the exit to register');
assert.deepEqual(routes,[],'destination waits for the short exit effect');
callback();
assert.deepEqual(routes,['expense'],'destination opens after exit effect');

routes.length=0;
context.openHomeMenu(button);
context.activeRoute='stock';
callback();
assert.deepEqual(routes,[],'a route change during exit cannot reopen the abandoned destination');
assert.ok(!classes.has('home-leaving'),'abandoned exit is cleaned up');

context.activeRoute='home';
context.openHomeMenu(button);
context.cancelHomeExit();
assert.ok(cleared,'logout or another render cancels the pending exit timer');

reduced=true;
context.openHomeMenu(button);
assert.deepEqual(routes,['expense'],'reduced-motion navigation is immediate');
console.log('PASS: home transition, stale-route cancellation, and reduced motion');
