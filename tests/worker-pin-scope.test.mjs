import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../36_PwaApi.gs', import.meta.url), 'utf8');
const properties = {PIN_WORKER: '777777'};
const context = vm.createContext({
  PropertiesService: {getScriptProperties: () => ({getProperty: key => properties[key] || null})},
  Utilities: {getUuid: () => 'id'},
  Date, JSON, String, Number, Math,
  ContentService: {createTextOutput: payload => ({setMimeType: () => JSON.parse(payload)}), MimeType: {JSON: 'json'}}
});
vm.runInContext(source, context);
context.verifyPin = pin => ({level: pin === '777777' ? 'worker' : 'family'});
context.getLoginUsers = level => level === 'worker'
  ? [{name: 'นางรำแพน ต้องสู้', role: 'ช่างเขียนลาย'}]
  : [{name: 'เจ้าของ', role: 'เจ้าของร้าน'}];
context.pwaApiCreateSession_ = () => 'signed-session';
let legacyCalls = 0;
context.workerPortalLegacyIdentity_ = pin => {
  legacyCalls++;
  return pin === '123456' ? {name: 'นางรำแพน ต้องสู้', role: 'ช่าง'} : null;
};
context.workerPortalIsWorker_ = user => context.getLoginUsers('worker').find(x => x.name === user.name);

const shop = context.pwaApiLogin_({pin: '123456'});
assert.equal(shop.level, 'family');
assert.equal(legacyCalls, 0, 'shop login must remain fast');

const worker = context.pwaApiLogin_({pin: '123456', scope: 'worker'});
assert.equal(worker.level, 'worker');
assert.equal(worker.user.name, 'นางรำแพน ต้องสู้');
assert.equal(legacyCalls, 1, 'worker login must check the individual identity');

const denied = context.pwaApiLogin_({pin: '999999', scope: 'worker'});
assert.equal(denied.ok, false);
assert.equal(denied.error, 'INVALID_PIN', 'a shop PIN alone cannot enter the worker portal');

const shared = context.pwaApiLogin_({pin: '777777', scope: 'worker'});
assert.equal(shared.level, 'worker');
assert.equal(shared.users.length, 1);
assert.equal(legacyCalls, 2, 'the shared worker PIN must not call the legacy identity provider');
console.log('worker PIN scope and collision: PASS');
