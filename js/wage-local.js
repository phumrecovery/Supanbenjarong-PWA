// Local-first wage summaries.
//
// The raw rows a wage summary needs (GAS getWageSnapshot_) are kept in
// IndexedDB and fed to WageCore — the same file as 39_WageCore.gs, loaded
// from js/wage-core.js — so any period renders on the device at once. GAS
// stays the source of truth: dataVersion is checked in the background and a
// newer snapshot replaces the local one. Only family sessions reach this
// (the wage tab is family-only) and logout deletes the stored rows.
const DB_NAME="suphan-local-data",STORE="snapshots",KEY="wage";
const CHECK_INTERVAL_MS=30_000;       // version checks at most this often
const MAX_SNAPSHOT_AGE_MS=15*60_000;  // refetch even if the version looks unchanged

let memo=null;      // {owner,version,coreVersion,fetchedAt,checkedAt,input}
let syncing=null;

function core(){return globalThis.WageCore;}
export function localWageSupported(){
  try{return !!core()&&core().isSupportedRuntime()&&"indexedDB" in globalThis;}catch{return false;}
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
  return {jobs:decodeRows(data.jobs),attendance:decodeRows(data.attendance),employees:decodeRows(data.employees),
    expenses:decodeRows(data.expenses),payments:decodeRows(data.payments),whitewareMap:data.whitewareMap||{},
    patternMap:data.patternMap||{},config:data.config||{}};
}
function accept(record,owner){
  return record&&record.owner===owner&&record.coreVersion===core()?.version&&record.data;
}

// Loads the stored snapshot for this user into memory (no network).
export async function loadLocalWage(owner){
  if(!localWageSupported())return null;
  if(memo&&memo.owner===owner)return memo;
  try{
    const saved=await withStore("readonly",store=>store.get(KEY));
    memo=accept(saved,owner)?{owner,version:saved.version,coreVersion:saved.coreVersion,fetchedAt:saved.fetchedAt,checkedAt:0,input:hydrate(saved.data)}:null;
  }catch{memo=null;}
  return memo;
}
export function localWageReady(owner){return !!memo&&memo.owner===owner;}

// Same result shape as the workshopWageSummary API (view only).
export function computeLocalWage(start,end){
  return memo?JSON.parse(JSON.stringify(core().summarize(memo.input,start,end))):null;
}

// Background revalidation. Resolves {changed:true} when a newer snapshot
// replaced the local one; throws when the server cannot be reached.
export function syncLocalWage(api,token,owner,{force=false}={}){
  if(!localWageSupported())return Promise.reject(new Error("LOCAL_UNSUPPORTED"));
  if(syncing)return syncing;
  syncing=(async()=>{
    await loadLocalWage(owner);
    if(!force&&memo&&Date.now()-memo.checkedAt<CHECK_INTERVAL_MS)return {changed:false};
    const versionReply=await api.request({action:"dataVersion",session:token},30000,{retries:1,retryLogical:true});
    if(!versionReply?.ok)throw new Error(versionReply?.message||versionReply?.error||"VERSION_FAILED");
    const version=String(versionReply.result?.version||"");
    if(!force&&memo&&memo.version===version&&Date.now()-memo.fetchedAt<MAX_SNAPSHOT_AGE_MS){memo.checkedAt=Date.now();return {changed:false};}
    const reply=await api.request({action:"wageSnapshot",session:token},60000,{retries:1,retryLogical:true});
    if(!reply?.ok)throw new Error(reply?.message||reply?.error||"SNAPSHOT_FAILED");
    const data=reply.result||{};
    if(data.coreVersion!==core().version)throw new Error("WAGE_CORE_VERSION_MISMATCH");
    const record={owner,version:String(data.version||version),coreVersion:data.coreVersion,fetchedAt:Date.now(),data};
    try{await withStore("readwrite",store=>store.put(record,KEY));}catch{/* memory copy still serves this visit */}
    memo={owner,version:record.version,coreVersion:record.coreVersion,fetchedAt:record.fetchedAt,checkedAt:Date.now(),input:hydrate(data)};
    return {changed:true};
  })().finally(()=>{syncing=null;});
  return syncing;
}
export function localWageSyncing(){return !!syncing;}
export function localWageInfo(){return memo?{version:memo.version,fetchedAt:memo.fetchedAt,checkedAt:memo.checkedAt}:null;}

export async function clearLocalWage(){
  memo=null;
  try{await withStore("readwrite",store=>store.delete(KEY));}catch{}
}
