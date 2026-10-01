// Local-first Dashboard.
//
// The raw rows the Dashboard needs (GAS getReportSnapshot_) are kept in
// IndexedDB and fed to ReportCore — the same file as 41_ReportCore.gs, loaded
// from js/report-core.js — so every tab and period renders on the device at
// once. GAS stays the source of truth: dataVersion is checked in the
// background and a newer snapshot replaces the local one. Only family
// sessions reach this (the Dashboard is family-only); logout deletes it.
const DB_NAME="suphan-local-data",STORE="snapshots",KEY="report";
const CHECK_INTERVAL_MS=30_000;       // version checks at most this often
const MAX_SNAPSHOT_AGE_MS=15*60_000;  // refetch even if the version looks unchanged

let memo=null;      // {owner,version,fetchedAt,checkedAt,input}
let syncing=null;

function core(){return globalThis.ReportCore;}
function cores(){return {report:core()?.version,wage:globalThis.WageCore?.version};}
export function localReportSupported(){
  try{return !!core()&&!!globalThis.WageCore&&globalThis.WageCore.isSupportedRuntime()&&"indexedDB" in globalThis;}catch{return false;}
}

function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function withStore(mode,run){
  const db=await openDb();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode),request=run(tx.objectStore(STORE));
      tx.oncomplete=()=>resolve(request?.result);
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
  }finally{db.close();}
}

// GAS marks Date cells as {$d:epochMs}; rebuild them as Dates.
function decodeRows(rows){
  return (rows||[]).map(row=>row.map(value=>value&&typeof value==="object"&&"$d" in value?new Date(value.$d):value));
}
function hydrate(data){
  const input={preorderColumns:Number(data.preorderColumns)||0,materialCategories:data.materialCategories||[],
    fixedPrefix:data.fixedPrefix,cashflowStart:data.cashflowStart,stockValue:data.stockValue||null};
  for(const name of ["sales","preorder","expenses","outsource","purchase","jobs","attendance","investment"])input[name]=decodeRows(data[name]);
  return input;
}
function compatible(data){
  const c=cores();
  return data&&data.coreVersion===c.report&&data.wageCoreVersion===c.wage;
}

export async function loadLocalReport(owner){
  if(!localReportSupported())return null;
  if(memo&&memo.owner===owner)return memo;
  try{
    const saved=await withStore("readonly",store=>store.get(KEY));
    memo=saved&&saved.owner===owner&&compatible(saved.data)
      ?{owner,version:saved.version,fetchedAt:saved.fetchedAt,checkedAt:0,input:hydrate(saved.data)}:null;
  }catch{memo=null;}
  return memo;
}
export function localReportReady(owner){return !!memo&&memo.owner===owner;}

// Same result shapes as the report* API actions (cost/print month 0-based).
export function computeLocalReport(type,args){
  if(!memo)return null;
  const R=core(),input=memo.input;
  const result=type==="daily"?R.daily(input,args[0]):
    type==="month"?R.monthly(input,args[0],args[1]):
    type==="year"?R.yearly(input,args[0]):
    type==="cost"?R.cost(input,args[0],Number(args[1])-1):
    type==="cash"?R.cashflow(input,args[0]):
    type==="print"?R.print(input,args[0],Number(args[1])-1):null;
  return result===null?null:JSON.parse(JSON.stringify(result));
}

// Background revalidation. Resolves {changed:true} when a newer snapshot
// replaced the local one; throws when the server cannot be reached.
export function syncLocalReport(api,token,owner,{force=false}={}){
  if(!localReportSupported())return Promise.reject(new Error("LOCAL_UNSUPPORTED"));
  if(syncing)return syncing;
  syncing=(async()=>{
    await loadLocalReport(owner);
    if(!force&&memo&&Date.now()-memo.checkedAt<CHECK_INTERVAL_MS)return {changed:false};
    let version="";
    if(!force||memo){
      const versionReply=await api.request({action:"dataVersion",session:token},30000,{retries:1,retryLogical:true});
      if(!versionReply?.ok)throw new Error(versionReply?.message||versionReply?.error||"VERSION_FAILED");
      version=String(versionReply.result?.version||"");
      if(!force&&memo&&memo.version===version&&Date.now()-memo.fetchedAt<MAX_SNAPSHOT_AGE_MS){memo.checkedAt=Date.now();return {changed:false};}
    }
    const reply=await api.request({action:"reportSnapshot",session:token},60000,{retries:1,retryLogical:true});
    if(!reply?.ok)throw new Error(reply?.message||reply?.error||"SNAPSHOT_FAILED");
    const data=reply.result||{};
    if(!compatible(data))throw new Error("REPORT_CORE_VERSION_MISMATCH");
    const record={owner,version:String(data.version||version),fetchedAt:Date.now(),data};
    try{await withStore("readwrite",store=>store.put(record,KEY));}catch{/* memory copy still serves this visit */}
    memo={owner,version:record.version,fetchedAt:record.fetchedAt,checkedAt:Date.now(),input:hydrate(data)};
    return {changed:true};
  })().finally(()=>{syncing=null;});
  return syncing;
}
export function localReportSyncing(){return !!syncing;}
// A write from this app: the next sync must ask GAS instead of trusting a
// recent version check.
export function markLocalReportStale(){if(memo)memo.checkedAt=0;}
// Same shape as getReportInit().
export function localReportInit(){
  const now=new Date();
  return {years:memo?core().availableYears(memo.input):[now.getFullYear()],curYear:now.getFullYear(),curMonth:now.getMonth()+1};
}
export function localReportInfo(){return memo?{version:memo.version,fetchedAt:memo.fetchedAt,checkedAt:memo.checkedAt}:null;}

export async function clearLocalReport(){
  memo=null;
  try{await withStore("readwrite",store=>store.delete(KEY));}catch{}
}
