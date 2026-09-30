// Copies the shared wage formula from the GAS project into the PWA.
// 39_WageCore.gs is the source of truth; never edit js/wage-core.js by hand.
// Usage (from pwa-publish/): node tools/sync-wage-core.mjs
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";

const here=dirname(fileURLToPath(import.meta.url));
const source=resolve(here,"../../39_WageCore.gs");
const target=resolve(here,"../js/wage-core.js");
writeFileSync(target,readFileSync(source));
console.log(`copied ${source} -> ${target}`);
