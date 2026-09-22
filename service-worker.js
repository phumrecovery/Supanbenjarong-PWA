const VERSION="suphan-pwa-v163";
const APP_SHELL=["./","./index.html","./css/app.css?v=login-v2","./css/pos.css?v=pos-v19","./css/product.css","./css/product-overrides.css","./css/stock.css?v=stock-v3","./css/stock-fixes.css?v=stock-fix-v4","./css/expense.css","./css/expense-day-groups.css","./css/preorder.css","./css/preorder-fixes.css?v=preorder-fix-v10","./css/outsource.css","./css/report.css?v=report-v3","./css/report-print-parity.css","./css/settings.css?v=settings-v5","./css/workshop.css?v=workshop-v17","./css/workshop-handoff-review.css?v=review-v1","./css/workshop-photo-zoom.css?v=photo-zoom-v2","./css/claim.css?v=claim-v1","./css/barcode.css?v=barcode-v3","./js/app.js?v=app-v41","./js/api.js?v=api-v6","./js/pos.js?v=pos-v19","./js/product.js","./js/stock.js?v=stock-v4","./js/expense.js","./js/preorder.js?v=preorder-v15","./js/outsource.js","./js/report.js?v=report-v18","./js/settings.js?v=settings-v10","./js/workshop.js?v=workshop-v25","./js/claim.js?v=claim-v1","./js/barcode.js?v=barcode-v3","./assets/icon-48.png","./assets/icon-192.png","./assets/icon-512.png","./assets/main-app-icon.png","./manifest.webmanifest"];
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
