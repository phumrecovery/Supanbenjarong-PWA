import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const start=source.indexOf('document.addEventListener("pointerdown"');
const end=source.indexOf('document.addEventListener("keydown"',start);
assert.ok(start>0&&end>start,'pointer and click listeners exist');

const listeners={};
let unlocks=0,taps=0;
vm.runInNewContext(source.slice(start,end),{
  document:{addEventListener:(name,handler)=>{listeners[name]=handler;}},
  unlockAudio:()=>{unlocks++;},
  sound:{tap:()=>{taps++;}}
});

const button={disabled:false};
const event={target:{closest:()=>button}};
listeners.pointerdown(event);
assert.equal(unlocks,1,'touch still unlocks audio for a later real click');
assert.equal(taps,0,'touching a menu card to scroll must stay silent');
listeners.click(event);
assert.equal(taps,1,'an actual button click plays the tap sound');
button.disabled=true;
listeners.click(event);
assert.equal(taps,1,'disabled controls stay silent');
listeners.click({target:{closest:()=>null}});
assert.equal(taps,1,'non-button clicks stay silent');
console.log('PASS: scrolling touch stays silent; real button click plays tap');
