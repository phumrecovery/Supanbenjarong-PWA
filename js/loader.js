// Shared Benjarong loader for the main PWA (styles: css/loader.css).
//
// Modules keep writing their usual loading text ("⏳ กำลังบันทึก…",
// "กำลังโหลดข้อมูล…", a .spinner). installLoader() watches the page and turns
// each of those into the one shared animation, so every screen looks the same
// without each module carrying its own copy:
//   - "⏳ …" inside a button or a line of text  → the mini ring in place of ⏳
//   - a placeholder that only says "กำลังโหลด…"   → bowl + ring block
//   - body.pwa-refreshing                        → the ring badge
const RING='<svg viewBox="0 0 160 160" class="bj-ring" aria-hidden="true"><circle cx="80" cy="80" r="70" class="bj-ring-bg"/><circle cx="80" cy="80" r="70" class="bj-ring-arc"/></svg>';
const BOWL='<svg viewBox="0 0 160 160" class="bj-bowl" aria-hidden="true"><ellipse pathLength="1" cx="80" cy="66" rx="36" ry="7"/><path pathLength="1" d="M 44,66 C 46,92 60,106 71,108 L 89,108 C 100,106 114,92 116,66"/><path pathLength="1" class="late" d="M 50,80 C 64,87 96,87 110,80"/><path pathLength="1" class="late" d="M 69,108 L 66,116 L 94,116 L 91,108"/></svg>';
const GOLD_DEFS='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="bjGold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffe259"/><stop offset="50%" stop-color="#d4af37"/><stop offset="100%" stop-color="#996515"/></linearGradient></defs></svg>';
const DEFAULT_TEXT="กำลังโหลดข้อมูล…";
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export const ringMini='<span class="bj-ring-mini" aria-hidden="true"></span>';
// Bowl + ring block for a page or list that has nothing to show yet.
export function loaderBlock(text=DEFAULT_TEXT){
  return `<div class="bj-loader" role="status" data-bj="1"><span class="bj-stage">${RING}${BOWL}</span><span class="bj-loader-text">${esc(text)}</span></div>`;
}
// Full version for app start and PIN check.
export function loaderFull(){
  return `<div class="bj-loader full" role="status" data-bj="1"><span class="bj-stage">${RING}${BOWL}</span><span class="bj-loader-title">สุพรรณบุรีเบญจรงค์</span><span class="bj-loader-text">กำลังรังสรรค์ลวดลาย…</span></div>`;
}

const LOADING_TEXT=/^(⏳\s*)?กำลัง(โหลด|เตรียม|เปิด)/;
// Short status lines that sit inside other content: keep them inline.
const INLINE_HOSTS=".product-count,.expense-note,.rpt-local-note,.toast,.st-toast,button,label,summary,td,th,option";
function upgradeText(node){
  const parent=node.parentElement;
  if(!parent||parent.closest("[data-bj],script,style,textarea,input"))return;
  const raw=node.nodeValue,text=raw.trim();
  if(!text)return;
  const hasIcon=text.startsWith("⏳");
  if(!hasIcon&&!LOADING_TEXT.test(text))return;
  const alone=parent.childNodes.length===1&&!parent.closest(INLINE_HOSTS);
  if(alone&&LOADING_TEXT.test(text)){
    // Keep a longer, specific message (it usually tells the user what they can do meanwhile).
    const clean=text.replace(/^⏳\s*/,"");
    parent.innerHTML=loaderBlock(clean.length>45?clean:DEFAULT_TEXT);
    return;
  }
  if(!hasIcon)return;
  const ring=document.createElement("span");
  ring.className="bj-ring-mini";ring.setAttribute("aria-hidden","true");ring.dataset.bj="1";
  node.nodeValue=raw.replace(/⏳\s*/,"");
  parent.insertBefore(ring,node);
}
function upgradeSpinner(spinner){
  const host=spinner.parentElement;
  if(!host||host.closest("[data-bj]"))return;
  const message=host.querySelector("p")?.textContent.trim()||"";
  host.innerHTML=loaderBlock(message.length>45?message:DEFAULT_TEXT);
}
function scan(root){
  if(root.nodeType===Node.TEXT_NODE){upgradeText(root);return;}
  if(root.nodeType!==Node.ELEMENT_NODE||root.closest?.("[data-bj]"))return;
  if(root.matches?.(".spinner"))return upgradeSpinner(root);
  root.querySelectorAll?.(".spinner").forEach(upgradeSpinner);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode()){const value=walker.currentNode.nodeValue;if(value.includes("⏳")||value.includes("กำลัง"))nodes.push(walker.currentNode);}
  nodes.forEach(upgradeText);
}

let installed=false;
export function installLoader(){
  if(installed)return;installed=true;
  document.body.insertAdjacentHTML("afterbegin",GOLD_DEFS);
  document.body.insertAdjacentHTML("beforeend",`<div class="bj-refresh-badge" aria-hidden="true" data-bj="1">${ringMini}กำลังอัปเดต</div>`);
  scan(document.body);
  // Our own edits add nodes too; data-bj marks them so they are skipped.
  new MutationObserver(records=>{
    for(const record of records){
      if(record.type==="characterData"){upgradeText(record.target);continue;}
      record.addedNodes.forEach(scan);
    }
  }).observe(document.body,{childList:true,subtree:true,characterData:true});
}
