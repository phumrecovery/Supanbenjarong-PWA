// Copies the shared wage and report formulas from the GAS project into the PWA.
// 39_WageCore.gs and 41_ReportCore.gs are the source of truth; never edit
// js/wage-core.js or js/report-core.js by hand.
// Usage (from pwa-publish/): node tools/sync-wage-core.mjs
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";

const here=dirname(fileURLToPath(import.meta.url));
for(const [from,to] of [["39_WageCore.gs","wage-core.js"],["41_ReportCore.gs","report-core.js"]]){
  const source=resolve(here,"../../"+from),target=resolve(here,"../js/"+to);
  writeFileSync(target,readFileSync(source));
  console.log(`copied ${source} -> ${target}`);
}
