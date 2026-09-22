import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const gas=fs.readFileSync(new URL('../../36_PwaApi.gs',import.meta.url),'utf8');

assert.match(gas,/loginHints:\{family:familyUsers\}/,
  'health must return only display-safe family name hints, never PINs or tokens');
assert.match(app,/function readLoginPreview\(\)/,
  'PWA must retain a short-lived local preview of owner names');
assert.match(app,/showUserPicker\(previewUsers,\{pending:true\}\)/,
  'the name cards must appear before login waits for the server');
assert.match(app,/function preloadHomeData\(token\)/,
  'authenticated login should warm the small home payload while the user chooses a name');
const submit=app.match(/async function submitPin\(\)\{([\s\S]*?)\n\}/)?.[1]||'';
assert.ok(submit.indexOf('showUserPicker(previewUsers,{pending:true})') < submit.indexOf('await api.login'),
  'preview must render before the PIN verification round trip');
assert.match(app,/pending\?"กำลังตรวจ PIN และเตรียมข้อมูลร้าน…":"คุณคือใคร\?"/,
  'pending picker must communicate its status clearly');
console.log('login picker preview: PASS');
