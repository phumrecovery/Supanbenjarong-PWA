import assert from "node:assert/strict";
import fs from "node:fs";

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8");
const api=read("js/api.js");
const pos=read("js/pos.js");
const preorder=read("js/preorder.js");
const preorderCss=read("css/preorder-fixes.css");

assert.match(api,/posBootstrap\(session\)[\s\S]*warmRead\("posBootstrap",session,15_000,45000,2\)/,
  "POS bootstrap must tolerate GAS cold starts and retry read-only loading");
assert.match(pos,/data-pos-retry/,
  "POS load failure must offer an in-page retry action");
assert.doesNotMatch(preorderCss,/\n\s*body>\*\{display:none!important\}/,
  "Preorder print CSS must not hide every PWA route");
assert.match(preorderCss,/body\.preorder-printing>\*\{display:none!important\}/,
  "Preorder print isolation must only apply while printing a preorder document");
assert.match(preorder,/classList\.add\("preorder-printing"\)/,
  "Preorder printing must explicitly enter its scoped print mode");
assert.match(preorder,/afterprint[\s\S]*clearPrintMode/,
  "Preorder printing must remove its scoped print mode afterward");

console.log("PASS: POS cold-start retry and route-scoped print CSS prevent blank A4 receipts.");
