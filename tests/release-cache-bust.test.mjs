import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');

assert.match(html,/\.\/js\/app\.js\?v=app-v36/,'HTML must request the login-preview app bundle by a new URL');
assert.match(html,/\.\/css\/app\.css\?v=login-v2/,'HTML must request the login-preview stylesheet by a new URL');
assert.match(worker,/const VERSION="suphan-pwa-v157"/,'service worker cache must be replaced for this release');
assert.match(worker,/\.\/js\/app\.js\?v=app-v36/,'offline shell must match the new app bundle');
assert.match(worker,/\.\/css\/app\.css\?v=login-v2/,'offline shell must match the new stylesheet');
assert.match(app,/service-worker\.js\?v=118/,'the browser must check the updated service worker');
console.log('release cache bust: PASS');
