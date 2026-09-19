// Bump on every worker-shell release so installed PWA clients do not retain
// an obsolete login flow after GitHub Pages has deployed a fix.
const CACHE="suphan-worker-v20";
const SHELL=["./","./index.html","./worker.css","./worker-save-feedback.css?v=save-v1","./worker.js?v=worker-v20","./manifest.webmanifest","../js/api.js","../js/runtime-config.js","../assets/worker-app-icon.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;if(event.request.mode==="navigate"){event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match("./index.html"))));return;}event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));});
