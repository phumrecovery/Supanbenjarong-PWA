/* Recently typed names for selected text fields (shop names, item names).
   An input opts in with data-recent="<key>"; a module calls window.pwaRecent.remember(key,value)
   after a save succeeds. The last five values per key are kept on this device only.
   Prices, quantities, searches, phone numbers and PINs are deliberately not remembered. */
const KEY="suphan.recent.v1",MAX=5,MAX_LEN=80;
let box=null,target=null,hideTimer=0;

function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||"{}");return v&&typeof v==="object"?v:{};}catch(error){return {};}}
function save(all){try{localStorage.setItem(KEY,JSON.stringify(all));}catch(error){}}
function list(key){const v=load()[key];return Array.isArray(v)?v.filter(x=>typeof x==="string"&&x):[];}
function remember(key,value){
  const text=String(value==null?"":value).trim();
  if(!key||!text||text.length>MAX_LEN)return;
  const all=load(),same=text.toLowerCase();
  all[key]=[text,...list(key).filter(x=>x.toLowerCase()!==same)].slice(0,MAX);
  save(all);
}
function forget(key,value){const all=load();all[key]=list(key).filter(x=>x!==value);save(all);}

function ensureBox(){
  if(box)return box;
  const style=document.createElement("style");
  style.textContent=`.pwa-recent{position:fixed;z-index:2147483000;margin:0;padding:4px 0;list-style:none;background:#fff;color:#202124;border:1px solid #dadce0;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.24);font:16px/1.3 Prompt,Sarabun,system-ui,sans-serif;max-height:260px;overflow-y:auto;-webkit-tap-highlight-color:transparent}
.pwa-recent li{display:flex;align-items:center;min-height:44px;padding:0 4px 0 14px;cursor:pointer}
.pwa-recent li:hover,.pwa-recent li.on{background:#eef1f4}
.pwa-recent span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pwa-recent button{flex:none;width:40px;height:40px;border:0;background:none;color:#80868b;font-size:18px;line-height:1;cursor:pointer}`;
  document.head.append(style);
  box=document.createElement("ul");box.className="pwa-recent";box.hidden=true;box.setAttribute("role","listbox");
  // pointerdown, not click: the field must keep focus (and the phone keyboard) while choosing
  box.addEventListener("pointerdown",event=>{
    event.preventDefault();
    const row=event.target.closest("li");if(!row||!target)return;
    if(event.target.closest("button")){forget(target.dataset.recent,row.dataset.value);show(target);return;}
    choose(row.dataset.value);
  });
  document.body.append(box);
  return box;
}
function choose(value){
  const input=target;if(!input)return;
  input.value=value;
  input.dispatchEvent(new Event("input",{bubbles:true}));
  input.dispatchEvent(new Event("change",{bubbles:true}));
  hide();
}
function hide(){if(box)box.hidden=true;target=null;}
function place(){
  if(!box||box.hidden||!target)return;
  if(!target.isConnected){hide();return;}
  const r=target.getBoundingClientRect(),view=window.visualViewport,viewHeight=view?view.height:window.innerHeight;
  box.style.left=`${Math.max(4,r.left)}px`;box.style.width=`${Math.max(180,r.width)}px`;
  const below=viewHeight-r.bottom,height=Math.min(box.scrollHeight+2,260);
  if(below<height+8&&r.top>below){box.style.top="";box.style.bottom=`${window.innerHeight-r.top+2}px`;}
  else{box.style.bottom="";box.style.top=`${r.bottom+2}px`;}
}
function show(input){
  const key=input.dataset.recent;if(!key||input.readOnly||input.disabled){hide();return;}
  const typed=input.value.trim().toLowerCase();
  const rows=list(key).filter(x=>x.toLowerCase()!==typed&&(!typed||x.toLowerCase().includes(typed)));
  if(!rows.length){hide();return;}
  ensureBox();target=input;
  box.replaceChildren(...rows.map(value=>{
    const li=document.createElement("li"),span=document.createElement("span"),remove=document.createElement("button");
    li.dataset.value=value;li.setAttribute("role","option");span.textContent=value;
    remove.type="button";remove.textContent="×";remove.setAttribute("aria-label","ลบคำนี้ออกจากรายการ");
    li.append(span,remove);return li;
  }));
  box.hidden=false;place();
}
const recentInput=node=>node instanceof HTMLInputElement&&node.dataset.recent?node:null;

document.addEventListener("focusin",event=>{const input=recentInput(event.target);if(input){clearTimeout(hideTimer);show(input);}});
document.addEventListener("click",event=>{const input=recentInput(event.target);if(input&&(!box||box.hidden))show(input);});
document.addEventListener("input",event=>{const input=recentInput(event.target);if(input&&event.isTrusted)show(input);});
document.addEventListener("focusout",event=>{if(recentInput(event.target)){clearTimeout(hideTimer);hideTimer=setTimeout(hide,120);}});
document.addEventListener("keydown",event=>{
  if(!box||box.hidden||!target)return;
  const rows=[...box.children],at=rows.findIndex(x=>x.classList.contains("on"));
  if(event.key==="Escape"){hide();return;}
  if(event.key==="ArrowDown"||event.key==="ArrowUp"){
    event.preventDefault();
    const next=event.key==="ArrowDown"?(at+1)%rows.length:(at<=0?rows.length-1:at-1);
    rows.forEach((x,i)=>x.classList.toggle("on",i===next));rows[next].scrollIntoView({block:"nearest"});
  }else if(event.key==="Enter"&&at>=0){event.preventDefault();choose(rows[at].dataset.value);}
});
window.addEventListener("scroll",place,true);
window.addEventListener("resize",place);
window.visualViewport?.addEventListener("resize",place);

window.pwaRecent={remember,list};
