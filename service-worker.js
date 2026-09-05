const VERSION="suphan-pwa-v111";
const APP_SHELL=["./","./index.html","./css/app.css","./css/pos.css","./css/product.css","./css/product-overrides.css","./css/stock.css?v=stock-v1","./css/stock-fixes.css?v=stock-fix-v2","./css/expense.css","./css/expense-day-groups.css","./css/preorder.css","./css/preorder-fixes.css","./css/outsource.css","./css/report.css","./css/report-print-parity.css","./css/settings.css?v=settings-v5","./js/app.js?v=app-v3","./js/api.js?v=expense-fix-v1","./js/pos.js","./js/product.js","./js/stock.js?v=stock-v1","./js/expense.js","./js/preorder.js","./js/outsource.js","./js/report.js","./js/settings.js?v=settings-v9","./assets/icon-48.png","./assets/icon-192.png","./assets/icon-512.png","./manifest.webmanifest"];
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
