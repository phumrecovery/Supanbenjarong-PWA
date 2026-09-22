import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const named=source.match(/function logoutFromSidebar\(\)\{([\s\S]*?)\n\}/);
const inline=source.match(/document\.querySelector\("#logout"\)\.addEventListener\("click",async\(\)=>\{([\s\S]*?)\n\}\);/);
const body=(named||inline)?.[1];
assert.ok(body,'logout handler must be discoverable for the responsiveness test');

const events=[];
let resolveLogout;
const context=vm.createContext({
  sessionToken:'active-session',currentSession:{user:{name:'เจ้าของ'}},displayUser:{name:'เจ้าของ'},homeData:{},
  SESSION_KEY:'session',DISPLAY_USER_KEY:'display',
  sessionStorage:{removeItem:key=>events.push(`remove:${key}`)},
  showLogin:message=>events.push(`login:${message}`),
  api:{logout:()=>new Promise(resolve=>{resolveLogout=resolve;})}
});
vm.runInContext(`async function logoutHandler(){${body}}`,context);
const pending=context.logoutHandler();
await Promise.resolve();
assert.deepEqual(events,['remove:session','remove:display','login:ออกจากระบบแล้ว'],
  'the PIN screen must appear before a slow server logout finishes');
resolveLogout?.();
await pending;
console.log('logout responsiveness: PASS');
