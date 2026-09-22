import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const app=read("js/app.js");
const api=read("js/api.js");
const gas=read("../36_PwaApi.gs");
const barcode=read("js/barcode.js");
const index=read("index.html");
const worker=read("service-worker.js");

assert.match(app,/import \{renderBarcode\} from "\.\/barcode\.js\?v=barcode-v1"/);
assert.match(app,/item\.dataset\.sidebarRoute==="claim"\|\|item\.dataset\.sidebarRoute==="barcode"/);
assert.match(app,/if\(route==="barcode"\)\{renderBarcode\(/);
assert.match(app,/setShell\([^\n]*route!=="barcode"/);
assert.match(api,/barcodeBootstrap\(session\)[\s\S]*action:"barcodeBootstrap"/);
assert.match(gas,/request\.action === 'barcodeBootstrap'/);
assert.match(gas,/function pwaApiBarcodeBootstrap_\(session\)[\s\S]*getBarcodeProductData\(\)/);
assert.match(barcode,/const STICKERS_PER_PAGE=90/);
assert.match(barcode,/window\.print\(\)/);
assert.match(barcode,/window\.JsBarcode/);
assert.match(index,/barcode\.css\?v=barcode-v1/);
assert.match(index,/JsBarcode\.all\.min\.js/);
assert.match(worker,/suphan-pwa-v160/);
assert.match(app,/api\.js\?v=api-v6/);
assert.match(index,/app\.js\?v=app-v38/);
assert.match(worker,/barcode\.js\?v=barcode-v1/);
console.log("barcode route uses real GAS catalog and A4 print flow: PASS");
