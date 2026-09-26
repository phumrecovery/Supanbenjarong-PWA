import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const functions=source.match(/function cancelHomeExit\(\)\{[\s\S]*?\n\}\nfunction openHomeMenu\(button\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(functions,'home exit handlers exist');

let timers=[],cleared=0,reduced=false;
const classes=new Set();
const chosen=new Set();
const routes=[];
const context=vm.createContext({
  main:{dataset:{route:'home'},classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},querySelector:()=>({classList:{remove:name=>chosen.delete(name)}})},
  sessionToken:'family',loginFlowId:4,activeRoute:'home',currentSession:{user:{name:'เจ้าของ'}},
  window:{matchMedia:()=>({matches:reduced})},
  setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearTimeout:()=>{cleared++;},
  navigate:route=>routes.push(route)
});
vm.runInContext(`let homeExitTimer=0;${functions};this.openHomeMenu=openHomeMenu;this.cancelHomeExit=cancelHomeExit`,context);
const button={dataset:{route:'expense'},classList:{add:name=>chosen.add(name)}};
const runNext=()=>timers.shift().fn();

context.openHomeMenu(button);
assert.ok(chosen.has('home-menu-chosen'),'tap starts the icon effect immediately');
assert.ok(!classes.has('home-leaving'),'cards stay put while the icon effect plays');
assert.equal(timers[0].delay,300,'icon effect leads the card exit');
context.openHomeMenu(button);
assert.equal(timers.length,1,'a second tap during the icon effect is ignored');
runNext();
assert.ok(classes.has('home-leaving'),'card exit starts after the icon lead');
assert.equal(timers[0].delay,380,'the cards remain visible long enough for the exit to register');
assert.deepEqual(routes,[],'destination waits for the exit effect');
runNext();
assert.deepEqual(routes,['expense'],'destination opens after both effects');

classes.clear();routes.length=0;
context.openHomeMenu(button);
context.activeRoute='stock';
runNext();
assert.deepEqual(routes,[],'a route change during the icon effect cancels navigation');
assert.ok(!classes.has('home-leaving'),'abandoned transition never starts the card exit');
assert.ok(!chosen.has('home-menu-chosen'),'abandoned transition clears the chosen icon');

context.activeRoute='home';
context.openHomeMenu(button);
runNext();
context.activeRoute='stock';
runNext();
assert.deepEqual(routes,[],'a route change during the card exit cannot reopen the abandoned destination');
assert.ok(!classes.has('home-leaving'),'abandoned exit is cleaned up');

context.activeRoute='home';
const before=cleared;
context.openHomeMenu(button);
context.cancelHomeExit();
assert.ok(cleared>before,'logout or another render cancels the pending timer');
timers=[];

reduced=true;
context.openHomeMenu(button);
assert.deepEqual(routes,['expense'],'reduced-motion navigation is immediate');
console.log('PASS: icon-led home transition, stale-route cancellation, and reduced motion');
