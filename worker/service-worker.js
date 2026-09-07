// Bump on every worker-shell release so installed PWA clients do not retain
// an obsolete login flow after GitHub Pages has deployed a fix.
const CACHE="suphan-worker-v3";
const SHELL=["./","./index.html","./worker.css","./worker.js","./manifest.webmanifest","../js/api.js","../js/runtime-config.js","../assets/icon-192.png","../assets/icon-512.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));});
