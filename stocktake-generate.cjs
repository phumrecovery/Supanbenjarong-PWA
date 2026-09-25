const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','34_StockTake.html'),'utf8');
const css=source.match(/<style>([\s\S]*?)<\/style>/)[1]
  .replace(/\.st-page\{max-width:1120px;margin:0 auto;padding:84px 16px 44px\}/,'.st-page{max-width:1120px;margin:0 auto;padding:16px 16px 44px}')
  .replace(/\.st-page\{padding:76px 10px 30px\}/,'.st-page{padding:10px 10px 30px}');
fs.writeFileSync(path.join(__dirname,'css','stocktake.css'),
  '.main.stocktake-main{max-width:none;padding:0;background:var(--bg-main)}\n'+
  '.sb-shop{display:flex;align-items:center;gap:10px;line-height:1.3;font-size:20px}.sb-shop-logo{width:46px;height:46px;object-fit:contain;flex:none;border-radius:11px;background:white}\n'+
  '.st-pwa-topbar{position:sticky;top:0;z-index:90;box-sizing:border-box;width:100vw;display:flex;align-items:center;gap:12px;min-height:58px;padding:10px max(16px,env(safe-area-inset-right)) 10px max(16px,env(safe-area-inset-left));background:var(--bg-card);border-bottom:3px solid var(--primary);box-shadow:0 1px 3px rgba(139,69,19,.1)}\n'+
  '.st-pwa-topbar button{flex:none;min-height:40px;padding:7px 11px;border:2px solid var(--border);border-radius:var(--radius);background:#fff;color:var(--primary-dark);font:700 var(--text-sm) var(--font)}.st-pwa-topbar h1{margin:0;color:var(--primary-dark);font-size:var(--text-lg)}\n'+
  css+'\n.st-modal{box-sizing:border-box}.st-modal-card{box-sizing:border-box;max-height:calc(100dvh - 24px)}.st-location:focus-visible,.st-btn:focus-visible,.st-position-btn:focus-visible{outline:3px solid var(--primary);outline-offset:2px}\n', 'utf8');
let html=source.match(/<div class="st-page">([\s\S]*?)<script>/)[0].replace(/<script>$/,'');
html=html.replace('aria-label="ปิด"','aria-label="ปิด" data-popup-close').replace('aria-label="ปิด"','aria-label="ปิด" data-popup-close');
// Both close controls must opt in to the app-wide Escape handler.
html=html.replace('data-popup-close data-popup-close','data-popup-close');
html=html.replace(/(<button type="button" class="st-modal-close" onclick="closeReviewModal\(\)" aria-label="ปิด")/, '$1 data-popup-close');
let js=source.match(/<script>([\s\S]*?)<\/script>/)[1];
js=js.replace(/window\.addEventListener\("DOMContentLoaded",function\(\)\{[\s\S]*?\}\);/,
  'USER_NAME=String(context.displayUser?.name||"");\n  reloadPageData();');
js=js.replace(/function goHome\(\)\{[\s\S]*?\n\}\n\nfunction byId/,
  'function goHome(){if(CURRENT_LOCATION_ID)closeCountModal();onBack();}\n\nfunction byId');
js=js.replace('box.dataset.id=item.id;','box.dataset.id=item.id;\n    box.setAttribute("role","button");\n    box.tabIndex=0;\n    box.setAttribute("aria-label",item.name+" "+state.text);\n    box.onkeydown=function(event){if(event.key==="Enter"||event.key===" "){event.preventDefault();openLocation(this.dataset.id);}};');
js=js.replace('toastStockTake(error&&error.message?error.message:"โหลดข้อมูลไม่สำเร็จ");',
  'byId("roundText").textContent=error&&error.message?error.message:"โหลดข้อมูลไม่สำเร็จ";\n    byId("stockTakeCanvas").innerHTML=\'<div class="st-empty">โหลดผังร้านไม่สำเร็จ <button class="st-btn secondary" onclick="reloadPageData()">ลองอีกครั้ง</button></div>\';');
const names=[...new Set([...html.matchAll(/onclick="([A-Za-z_][A-Za-z_0-9]*)\(/g)].map(m=>m[1])
  .concat([...html.matchAll(/on(?:input|change)="([A-Za-z_][A-Za-z_0-9]*)\(/g)].map(m=>m[1]),
    ['goHome','changeCountByIndex','previewCountByIndex','setCountByIndex','applySaleFromPosition']))];
const pre=`// Ported from 34_StockTake.html. GAS remains the source for labels, layout and count flow.\nexport function renderStocktake(root,api,session,onBack,context={}){\n  const viewId=root._stocktakeViewId=(root._stocktakeViewId||0)+1;\n  const current=()=>root.isConnected&&root.dataset.route==='stocktake'&&root._stocktakeViewId===viewId;\n  const bjSound=window.SuphanSound||{};\n  function runner(success,failure){return new Proxy({}, {get(_target,key){if(key==='withSuccessHandler')return fn=>runner(fn,failure);if(key==='withFailureHandler')return fn=>runner(success,fn);return (...args)=>{const data=key==='getStockTakeReviewData'?{roundId:args[0]}:(args[0]||{});api.stockTake(session,key,data).then(response=>{if(!current())return;if(response?.result)success?.(response.result);else if(response?.ok)success?.(response);else failure?.(new Error(response?.message||'เชื่อมต่อระบบไม่สำเร็จ'));}).catch(error=>{if(current())failure?.(error);});};}});}\n  const google={script:{run:runner()}};\n  root.innerHTML=\`<section class="pwa-stocktake"><header class="st-pwa-topbar"><button type="button" onclick="goHome()">← กลับ</button><h1>📋 ตรวจนับสต๊อก</h1></header>${html.replace(/`/g,'\\`').replace(/\$\{/g,'\\${')}</section>\`;\n  root._stocktakeHandlerNames=${JSON.stringify(names)};\n`;
const post=`\n  const handlers={goHome,startRound,reloadPageData,openReviewModal,closeCountModal,completeCurrentLocation,closeReviewModal,renderCountProducts,renderReviewItems,changeCountByIndex,previewCountByIndex,setCountByIndex,applySaleFromPosition};\n  for(const name of root._stocktakeHandlerNames){window[name]=(...args)=>{if(current())return handlers[name](...args);};}\n}\n`;
// Initialization is moved below handler registration, so early-render controls work.
js=js.replace('USER_NAME=String(context.displayUser?.name||"");\n  reloadPageData();','USER_NAME=String(context.displayUser?.name||"");');
fs.writeFileSync(path.join(__dirname,'js','stocktake.js'),pre+js+post.replace('  const handlers', '  reloadPageData();\n  const handlers'), 'utf8');
