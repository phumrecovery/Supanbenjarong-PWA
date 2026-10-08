// Temporary speed measurement for the main app (asked for by the shop to find
// out why loading is slow on some devices). It records, per device:
//   - every API call: total time, the server's own time (_ms stamped by GAS),
//     result, attempt number and response size;
//   - every page open: time until content is shown and until it is up to date.
// Records are sent in small batches to the "วัดความเร็วแอป" sheet. Nothing a
// user typed, no PIN and no page data is included. It switches itself off at
// PERF_UNTIL; remove this module and its hooks after the analysis.
const PERF_UNTIL=Date.parse("2026-10-14T00:00:00+07:00");
const MAX_QUEUE=300,BATCH=60,FLUSH_MS=45000;
export const perfOn=()=>Date.now()<PERF_UNTIL;

const queue=[];
let sender=null,flushing=false,timer=null,pageToken=0;
const now=()=>new Date().toISOString();
const round=v=>Math.round(Number(v)||0);

function deviceId(){
  try{
    let id=localStorage.getItem("suphan.perf.device");
    if(!id){id=Math.random().toString(36).slice(2,8);localStorage.setItem("suphan.perf.device",id);}
    return id;
  }catch{return "nostore";}
}
// A fixed bit of arithmetic: the same work takes longer on a slower device.
function cpuScore(){
  const t0=performance.now();let x=0;
  for(let i=0;i<3000000;i++)x+=Math.sqrt(i%1000);
  return round(performance.now()-t0)+(x<0?1:0);
}
let deviceInfo=null;
function device(){
  if(deviceInfo)return deviceInfo;
  const ua=navigator.userAgent||"",shortSide=Math.min(screen.width||0,screen.height||0);
  const kind=/Android/i.test(ua)?(shortSide>=600&&!/Mobile/i.test(ua)?"Tablet Android":shortSide>=600?"Tablet Android":"มือถือ Android"):/iPad/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1)?"iPad":/iPhone/i.test(ua)?"iPhone":"PC";
  const c=navigator.connection||{};
  const model=(ua.match(/Android [\d.]+; ([^;)]+)/)||ua.match(/\(([^;)]+)/)||[])[1]||"";
  const chrome=(ua.match(/(?:Chrome|CriOS|Firefox|Version)\/(\d+)/)||[])[1]||"";
  const standalone=window.matchMedia?.("(display-mode: standalone)").matches?"ติดตั้ง":"เบราว์เซอร์";
  const version=(document.querySelector('script[src*="app.js"]')?.src.match(/v=([\w-]+)/)||[])[1]||"";
  deviceInfo={id:deviceId(),kind,version,
    detail:[model.trim(),`browser ${chrome}`,`${screen.width}x${screen.height}@${window.devicePixelRatio||1}`,`RAM ${navigator.deviceMemory||"?"}GB`,`CPU ${navigator.hardwareConcurrency||"?"} cores`,`cpuTest ${cpuScore()}ms`,standalone].join(" · ")};
  return deviceInfo;
}
function network(){
  const c=navigator.connection;
  return c?`${c.effectiveType||""} ${c.downlink||"?"}Mbps rtt${c.rtt||"?"}`:(navigator.onLine?"":"offline");
}
function push(row){
  if(!perfOn())return;
  if(queue.length>=MAX_QUEUE)queue.shift();
  queue.push(row);
}

// Called by ApiClient for every attempt of every request.
export function perfApi({action,total,server,ok,error,attempt,size}){
  if(action==="perfLog")return;
  const s=Number.isFinite(Number(server))?round(server):"";
  push([now(),"api",String(action||""),round(total),s,s===""?"":Math.max(0,round(total)-s),ok?"ok":String(error||"fail"),Number(attempt)||0,size?Math.round(size/102.4)/10:"",network()]);
}

// Called on every navigation. "shown" = content visible (maybe from the
// device); "fresh" = the background update finished as well.
export function perfPage(route,main){
  if(!perfOn()||!main)return;
  const token=++pageToken,t0=performance.now();
  let shown=0,sawRefresh=false,quietSince=0;
  const finish=(note)=>{clearInterval(poll);push([now(),"page",String(route),round(shown||performance.now()-t0),"",round(performance.now()-t0),note,0,"",`${sawRefresh?"อัปเดตเบื้องหลัง":"ไม่มีอัปเดตเบื้องหลัง"} · ${network()}`]);};
  const poll=setInterval(()=>{
    const elapsed=performance.now()-t0;
    if(token!==pageToken)return finish(shown?"ออกก่อนอัปเดตเสร็จ":"ออกก่อนแสดงผล");
    const loading=!!main.querySelector(".bj-loader,.spinner,.app-loading")||!main.children.length;
    const refreshing=document.body.classList.contains("pwa-refreshing");
    if(refreshing)sawRefresh=true;
    if(!shown&&!loading)shown=elapsed;
    if(shown&&!loading&&!refreshing){
      // No refresh badge for a moment after content appeared: the page is done.
      if(!quietSince)quietSince=elapsed;
      if(sawRefresh||elapsed-quietSince>1500)return finish("ok");
    }else quietSince=0;
    if(elapsed>120000)return finish(shown?"อัปเดตไม่เสร็จใน 120 วิ":"ไม่แสดงผลใน 120 วิ");
  },100);
}

async function flush(){
  if(flushing||!sender||!queue.length)return;
  const session=sender.session();
  if(!session)return;
  flushing=true;
  const rows=queue.splice(0,BATCH);
  try{
    const r=await sender.api.send({action:"perfLog",session,device:device(),rows},20000);
    if(!r?.ok&&r?.error!=="PERF_CLOSED")queue.unshift(...rows);
  }catch{queue.unshift(...rows);}
  finally{flushing=false;}
}
// api: ApiClient, session: () => current session token ("" before sign-in).
export function perfStart(api,session){
  if(!perfOn()||timer)return;
  sender={api,session};
  device();
  timer=setInterval(()=>{if(!perfOn()){clearInterval(timer);return;}void flush();},FLUSH_MS);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")void flush();});
}
