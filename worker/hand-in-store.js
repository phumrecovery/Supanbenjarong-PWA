// Hand-ins (job + photo) kept on the phone until Google has them. Shared by the page
// (worker.js) and the service worker, which sends what is left after the app is closed
// (Background Sync, Android Chrome). Each item carries the clientRequestId Google uses
// to answer a repeated request with the hand-in it already saved (6 hours).
(function(){
  const DB="suphan-worker-handin",STORE="items";
  function open(){return new Promise((ok,bad)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:"id"});r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error);});}
  async function tx(mode,work){
    const db=await open();
    try{
      return await new Promise((ok,bad)=>{let out;const t=db.transaction(STORE,mode),req=work(t.objectStore(STORE));if(req)req.onsuccess=()=>{out=req.result;};t.oncomplete=()=>ok(out);t.onerror=t.onabort=()=>bad(t.error);});
    }finally{db.close();}
  }
  const all=()=>tx("readonly",s=>s.getAll()).then(list=>(list||[]).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)));
  const put=item=>tx("readwrite",s=>s.put(item));
  const del=id=>tx("readwrite",s=>s.delete(id));
  // done: Google saved it · pause: sign in again · retry: busy or no answer · failed: Google refused it
  function classify(r){
    if(!r||typeof r!=="object")return {outcome:"retry",message:"ระบบตอบกลับผิดรูปแบบ"};
    if(r.ok)return {outcome:"done",result:r.result||{}};
    const code=String(r.error||""),message=String(r.message||r.result?.message||code||"ส่งงานไม่สำเร็จ");
    if(/SESSION|USER_REQUIRED|FORBIDDEN/.test(code))return {outcome:"pause",message};
    if(/INVALID_RESPONSE|GATEWAY|HTTP_5|RATE|TIMEOUT/i.test(code)||/หมดเวลาการล็อก|ล็อกไว้นาน|lock|ขัดข้องชั่วคราว|ลองใหม่|Service invoked too many|Exceeded maximum/i.test(message))return {outcome:"retry",message};
    return {outcome:"failed",message};
  }
  // The service worker's request, the same as js/api.js sends it.
  async function send(item){
    try{
      const response=await fetch(item.apiUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"workerPortalSubmit",session:item.token,data:item.data}),cache:"no-store"});
      let r=null;try{r=JSON.parse(await response.text());}catch{}
      return classify(r);
    }catch(error){return {outcome:"retry",message:String(error&&error.message||error||"เชื่อมต่อไม่สำเร็จ")};}
  }
  self.HandInStore={all,put,del,classify,send};
})();
