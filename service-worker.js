const VERSION="suphan-pwa-v188";
const APP_SHELL=["./","./index.html","./css/app.css?v=login-v2","./css/home-depth.css?v=home-depth-v6","./css/list-performance.css?v=list-performance-v1","./js/runtime-config.js","./js/app.js?v=app-v64","./js/api.js?v=api-v14","./js/pos.js?v=pos-v20","./js/product.js","./js/stock.js?v=stock-v4","./js/expense.js?v=expense-v13","./js/preorder.js?v=preorder-v17","./js/outsource.js?v=outsource-v3","./js/report.js?v=report-v18","./js/settings.js?v=settings-v10","./js/workshop.js?v=workshop-v28","./js/claim.js?v=claim-v4","./js/barcode.js?v=barcode-v4","./js/receipt.js?v=receipt-v1","./css/stocktake.css?v=stocktake-v1","./js/stocktake.js?v=stocktake-v1"];
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
