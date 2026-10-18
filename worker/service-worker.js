// Bump on every worker-shell release so installed PWA clients do not retain
// an obsolete login flow after GitHub Pages has deployed a fix.
const CACHE="suphan-worker-v43";
const SHELL=["./","./index.html","./worker.css","../css/loader.css?v=loader-v2","../js/loader.js?v=loader-v1","../js/perf.js?v=perf-v6","./worker-save-feedback.css?v=save-v1","./worker.js?v=worker-v43","./hand-in-store.js?v=handin-v1","./manifest.webmanifest","../js/api.js?v=worker-login-v6","../js/runtime-config.js","../assets/worker-app-icon.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
// Hand-ins still on the phone after the app was hidden or closed (see hand-in-store.js).
// Throwing asks the browser to run the sync again later; an item the page has been
// trying for over 5 hours is left to the page, which first checks Google's list.
importScripts("./hand-in-store.js?v=handin-v1");
self.addEventListener("sync",event=>{if(event.tag==="worker-hand-in")event.waitUntil(sendHandIns());});
async function sendHandIns(){
  const items=await self.HandInStore.all();let again=false;
  for(const item of items){
    if(item.state==="failed")continue;
    if(item.firstSentAt&&Date.now()-item.firstSentAt>5*3600000)continue;
    if(!item.firstSentAt){item.firstSentAt=Date.now();await self.HandInStore.put(item);}
    const r=await self.HandInStore.send(item);
    if(r.outcome==="done"){await self.HandInStore.del(item.id);tellPages({type:"hand-in-done",id:item.id,result:r.result});}
    else if(r.outcome==="failed"){item.state="failed";item.message=r.message;await self.HandInStore.put(item);tellPages({type:"hand-in-failed",id:item.id});}
    else if(r.outcome==="retry"){again=true;break;}
    else break;// signed out: the page continues after the next sign-in
  }
  if(again)throw new Error("hand-in: try again later");
}
function tellPages(message){return self.clients.matchAll({includeUncontrolled:true,type:"window"}).then(list=>list.forEach(client=>client.postMessage(message)));}
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;if(event.request.mode==="navigate"){event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match("./index.html"))));return;}event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));});
