import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const body=app.match(/function showLogin\(message=""\)\{([\s\S]*?)\n\}/)?.[1];
assert.ok(body,'login screen handler exists');
let healthCalls=0;
const context=vm.createContext({
  loginFlowId:0,pinSubmitting:true,activeRoute:'home',main:{dataset:{},innerHTML:'',_settingsAbort:null},
  closeSidebar:()=>{},setShell:()=>{},pinInput:'123456',renderPin:()=>{},
  api:{health:()=>{healthCalls++;return Promise.resolve({ok:true});}},
  LOGO_FALLBACK:'logo',escapeHtml:text=>text
});
vm.runInContext(`function run(message=""){${body}\n};this.run=run`,context);
context.run();
assert.equal(context.loginFlowId,1);
assert.equal(healthCalls,0,'opening the PIN screen must not compete with the PIN request for GAS');
console.log('PASS: PIN screen opens without a competing GAS health request');
