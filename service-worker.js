const VERSION="suphan-pwa-v52";
const APP_SHELL=["./","./index.html","./css/app.css","./css/pos.css","./css/product.css","./css/product-overrides.css","./css/expense.css","./css/preorder.css","./js/app.js","./js/api.js","./js/pos.js","./js/product.js","./js/expense.js","./js/preorder.js","./assets/icon-48.png","./assets/icon-192.png","./assets/icon-512.png","./manifest.webmanifest"];
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
