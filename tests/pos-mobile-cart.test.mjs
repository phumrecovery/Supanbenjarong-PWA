import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const pos=fs.readFileSync(new URL('../js/pos.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../css/pos.css',import.meta.url),'utf8');
const stateCode=pos.slice(pos.indexOf('const initialState='),pos.indexOf('let runtime='));
const closeCode=pos.slice(pos.indexOf('function closeEmptyCart(){'),pos.indexOf('function draw(root){'));
const context=vm.createContext({});
vm.runInContext(`${stateCode}\n${closeCode}\nthis.cartState=()=>state;this.closeEmptyCart=closeEmptyCart;`,context);

context.cartState().cart=[{code:'A',qty:1}];
context.cartState().mobileCartOpen=true;
context.closeEmptyCart();
assert.equal(context.cartState().mobileCartOpen,true,'a cart with items stays open');

context.cartState().cart=[];
context.cartState().step=1;
context.cartState().editingDiscount='A';
context.closeEmptyCart();
assert.equal(context.cartState().mobileCartOpen,false,'removing the last item closes the mobile sheet');
assert.equal(context.cartState().step,0,'an empty cart returns to item selection');
assert.equal(context.cartState().editingDiscount,null,'the removed item leaves no discount editor');
assert.match(pos,/function draw\(root\)\{\s*if\(!root\.isConnected\|\|root\.dataset\.route!=="sales"\)return;\s*closeEmptyCart\(\);/,
  'every POS redraw must reconcile the mobile cart after remove and quantity changes');
assert.match(css,/\.item-remove\{padding:0;line-height:1\}/,
  'the remove glyph must fit inside its button at mobile size');

console.log('PASS: mobile cart closes after the last item and the remove glyph fits its button');
