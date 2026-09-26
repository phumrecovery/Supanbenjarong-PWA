import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/pos.js',import.meta.url),'utf8');
const entry=source.slice(source.indexOf('const DEFAULT_CHANNELS='),source.indexOf('function draw(root){')).replace('export async function renderPos','async function renderPos');
const requests=[];
const api={posBootstrap:async token=>{requests.push(token);return {ok:true,products:[{code:token}]};}};
const context=vm.createContext({
  document:{querySelector:()=>({hidden:false,style:{display:''}})},
  sessionStorage:{getItem:()=>''},draw:()=>{},handleBarcodeScan:()=>{},
});
vm.runInContext(entry+'\nthis.renderPos=renderPos;this.peek=()=>state',context);
const root={isConnected:true,dataset:{route:'sales'},innerHTML:''};
await context.renderPos(root,api,'family-a',()=>{},{});
context.peek().cart.push({sku:'A',qty:1});
await context.renderPos(root,api,'family-b',()=>{},{});
assert.deepEqual(requests,['family-a','family-b'],'a new user must not reuse another user\'s catalog');
assert.equal(context.peek().cart.length,0,'a new user must not inherit the prior user\'s cart');
