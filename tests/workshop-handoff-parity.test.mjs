import assert from "node:assert/strict";
import fs from "node:fs";

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8");
const js=read("js/workshop.js");
const css=read("css/workshop.css");

for(const text of ["ส่งกลับให้ช่างแก้ไข","ยกเลิกรายการ","data-a=\"handoffOwnerAction\""])
  assert.ok(js.includes(text),`missing GAS-parity owner action: ${text}`);
assert.ok(js.includes("workerPortalOwnerReturn"),"return action is not connected to the real API");
assert.ok(js.includes("workerPortalOwnerCancel"),"cancel action is not connected to the real API");
assert.match(css,/\.pwa-workshop-dialog\{[^}]*position:relative/,
  "dialog must contain its absolute close button");
assert.match(js,/if\(S\.handoffPhoto\)\{S\.handoffPhoto=null/,
  "photo backdrop must close the topmost photo viewer");
assert.match(js,/photoImage\.complete/,
  "cached photos must be fitted even when load fired before binding");

console.log("PASS: worker handoff actions, close button, and photo viewer match GAS interaction requirements.");
