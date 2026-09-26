import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');

assert.match(html,/\.\/js\/app\.js\?v=app-v69/,'HTML must request the current app bundle');
assert.match(html,/\.\/css\/app\.css\?v=login-v2/,'HTML must request the login-preview stylesheet by a new URL');
assert.match(worker,/const VERSION="suphan-pwa-v193"/,'service worker cache must be replaced for this release');
assert.match(worker,/\.\/js\/app\.js\?v=app-v69/,'offline shell must match the new app bundle');
assert.match(worker,/\.\/css\/app\.css\?v=login-v2/,'offline shell must match the new stylesheet');
assert.match(html,/\.\/css\/home-depth\.css\?v=home-depth-v6/,'HTML must request the updated home design');
assert.match(worker,/\.\/css\/home-depth\.css\?v=home-depth-v6/,'offline shell must cache the updated home design');
assert.match(html,/\.\/css\/menu-icons\.css\?v=menu-icons-v1/,'HTML must request the menu icon stylesheet');
assert.match(worker,/\.\/css\/menu-icons\.css\?v=menu-icons-v1/,'offline shell must cache the menu icon stylesheet');
assert.match(app,/\.\/menu-icons\.js\?v=menu-icons-v1/,'app must import the versioned menu icons');
assert.match(worker,/\.\/js\/menu-icons\.js\?v=menu-icons-v1/,'offline shell must cache the menu icons module');
assert.match(html,/\.\/css\/list-performance\.css\?v=list-performance-v1/,'HTML must request the catalog performance stylesheet');
assert.match(worker,/\.\/css\/list-performance\.css\?v=list-performance-v1/,'offline shell must cache the catalog performance stylesheet');
assert.match(app,/service-worker\.js\?v=145/,'the browser must check the updated service worker');
console.log('release cache bust: PASS');
