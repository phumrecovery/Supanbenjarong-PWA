const VERSION="suphan-pwa-v278";
const APP_SHELL=["./","./index.html","./css/app.css?v=login-v8","./css/loader.css?v=loader-v2","./js/loader.js?v=loader-v1","./js/recent.js?v=recent-v1","./js/image-shrink.js?v=image-shrink-v1","./js/perf.js?v=perf-v7","./css/picker-avatar.css?v=picker-avatar-v3","./css/home-depth.css?v=home-depth-v9","./css/stock.css?v=stock-v3","./css/stock-fixes.css?v=stock-fix-v6","./css/pos.css?v=pos-v26","./css/preorder-fixes.css?v=preorder-fix-v11","./css/workshop.css?v=workshop-v35","./css/expense-day-groups.css?v=expense-v12","./css/menu-icons.css?v=menu-icons-v1","./css/list-performance.css?v=list-performance-v1","./js/runtime-config.js","./js/app.js?v=app-v146","./js/menu-icons.js?v=menu-icons-v1","./js/api.js?v=api-v31","./js/pos.js?v=pos-v32","./js/product.js?v=product-v8","./js/stock.js?v=stock-v7","./js/expense.js?v=expense-v21","./js/preorder.js?v=preorder-v23","./js/outsource.js?v=outsource-v9","./js/report.js?v=report-v21","./js/settings.js?v=settings-v15","./js/workshop.js?v=workshop-v59","./js/claim.js?v=claim-v6","./js/barcode.js?v=barcode-v5","./js/receipt.js?v=receipt-v3","./css/stocktake.css?v=stocktake-v1","./js/stocktake.js?v=stocktake-v3","./js/wage-core.js?v=wage-core-v5","./js/wage-local.js?v=wage-local-v2","./js/report-core.js?v=report-core-v1","./js/report-local.js?v=report-local-v2"];
self.addEventListener("install",event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  const isAppCode=request.mode==="navigate"||/\.(?:html|css|js|webmanifest)$/.test(url.pathname);
  const cacheResponse=response=>{
    if(response.ok)caches.open(VERSION).then(cache=>cache.put(request,response.clone()));
    return response;
  };
  if(isAppCode){
    event.respondWith(fetch(request).then(cacheResponse).catch(()=>caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(cacheResponse)));
});
