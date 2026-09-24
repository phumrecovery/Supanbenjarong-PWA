import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
const listeners={};
let installed=false;
const cache={addAll:requests=>{
  if(requests.some(url=>String(url).includes('barcode.css')))return Promise.reject(new Error('optional asset blocked'));
  return Promise.resolve();
}};
const context={
  self:{addEventListener:(type,handler)=>{listeners[type]=handler;},skipWaiting:()=>{installed=true;}},
  caches:{open:async()=>cache},
  URL,
};
vm.runInNewContext(source,context);
let pending;
listeners.install({waitUntil:promise=>{pending=promise;}});
await assert.doesNotReject(pending,'an optional route asset must not abort PWA installation');
assert.equal(installed,true,'worker activates after the critical shell is cached');
for(const size of ['192x192','512x512']){
  assert.ok(manifest.icons.some(icon=>icon.sizes===size&&icon.type==='image/png'),`manifest declares ${size} PNG icon`);
}
console.log('PASS: PWA installation tolerates optional asset failure and has Android icons');
