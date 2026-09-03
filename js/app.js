import {ApiClient} from "./api.js";
import {renderPos} from "./pos.js?v=pos-v17";
import {renderProduct} from "./product.js";
import {renderExpense} from "./expense.js?v=expense-v10";
import {renderPreorder} from "./preorder.js?v=preorder-v13";
import {renderOutsource} from "./outsource.js?v=outsource-v3";
import {renderReport} from "./report.js?v=report-v15";

const api=new ApiClient();
const main=document.querySelector("#main");
const appHeader=document.querySelector("#appHeader");
const connection=document.querySelector("#connection");
const topbarTitle=document.querySelector("#topbarTitle");
const topbarLogo=document.querySelector("#topbarLogo");
const sidebar=document.querySelector("#sidebar");
const sidebarOverlay=document.querySelector("#sidebarOverlay");
const sidebarUser=document.querySelector("#sidebarUser");
const toast=document.querySelector("#toast");
const floatingLayer=document.querySelector("#floatingLayer");
const SESSION_KEY="suphanbenjarong.pwa.session";
const DISPLAY_USER_KEY="suphanbenjarong.pwa.display-user";
const PENDING_BARCODE_KEY="suphanbenjarong.pwa.pending-barcode";
// URL เดียวกับ Web App เดิม เพื่อให้ก่อนโหลดข้อมูลร้าน PWA ยังใช้ตราร้านจริง
const LOGO_FALLBACK="https://lh3.googleusercontent.com/d/18rwkqytClqwNtg0PReV1ILLFwkiIKa01";
const MENU=[
  ["sales","🧾","ขายของ","ออกบิลเงินสด"],
  ["workshop","🖌️","จัดการงานช่าง","จ่ายงาน / บันทึกวัน / จ่ายค่าจ้าง"],
  ["outsource","🚚","สั่งของ/รับของ","Outsource + ซื้อเข้าร้าน"],
  ["expense","💸","ค่าใช้จ่าย","จดรายจ่าย"],
  ["preorder","📋","งานสั่งทำ","Preorder / ใบเสนอราคา"],
  ["report","📊","ดูสรุป","ยอดขาย / กำไร / Cashflow"],
  ["product","📦","จัดการสินค้า","ดู / แก้ไข / เพิ่มสินค้า"],
  ["stock","🗃️","สต๊อกสินค้า","คงเหลือ / รับเข้า / ปรับยอด"],
  ["settings","⚙️","ตั้งค่าร้าน","ข้อมูลร้าน / ผู้ใช้ / พนักงาน"]
];
const PAGES={
  workshop:["🖌️ จัดการงานช่าง","กำลังย้ายหน้าจ่ายงานช่างจาก Web App เดิม"],
  outsource:["🚚 สั่งของ/รับของ","กำลังย้ายข้อมูล Outsource และรับสินค้า"],
  expense:["💸 ค่าใช้จ่าย","กำลังย้ายรายการรับ-จ่ายโดยยังคง validation เดิม"],
  preorder:["📋 งานสั่งทำ","กำลังย้าย Preorder และใบเสนอราคา"],
  report:["📊 ดูสรุป","กำลังย้ายรายงานยอดขาย กำไร และ Cashflow"],
  product:["📦 จัดการสินค้า","กำลังย้ายหน้าจัดการสินค้า"],
  stock:["🗃️ สต๊อกสินค้า","กำลังย้ายหน้าสต๊อกสินค้า"],
  settings:["⚙️ ตั้งค่าร้าน","กำลังย้ายหน้าตั้งค่าร้าน"]
};

let sessionToken=sessionStorage.getItem(SESSION_KEY)||"";
let currentSession=null;
let displayUser=null;
let activeRoute="";
let pinInput="";
let homeData=null;
let toastTimer=0;
let audioContext=null;
let barcodeBuffer="";
let barcodeTimer=0;

// เสียงสั้นจาก Web Audio: ไม่ต้องโหลดไฟล์เพิ่ม และเริ่มได้หลังผู้ใช้แตะหน้าจอเท่านั้น
// รูปแบบและลำดับโน้ตเดียวกับ bjSound ใน 03_Style.html ของ GAS เดิม
// ปรับระดับรวมขึ้น 3 เท่าจาก PWA รุ่นก่อน โดยลดสัดส่วนจากเสียงเดิม
// เพื่อไม่ให้ Web Audio clipping.
function playTone(frequency,duration=.1,volume=.3,type="sine",delay=0){
  try{
    audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==="suspended")audioContext.resume();
    const oscillator=audioContext.createOscillator();
    const gain=audioContext.createGain();
    const start=audioContext.currentTime+delay;
    oscillator.type=type;oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(0.0001,start);
    gain.gain.exponentialRampToValueAtTime(Math.min(.5,volume),start+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);oscillator.stop(start+duration);
  }catch(error){}
}
const sound={
  tap:()=>{const now=Date.now();if(now-(sound.lastTap||0)<60)return;sound.lastTap=now;playTone(600,.08,.375,"sine");playTone(800,.06,.23,"sine",.02);},
  success:()=>{playTone(523,.18,.447,"sine");playTone(659,.18,.447,"sine",.12);playTone(784,.25,.296,"sine",.25);},
  error:()=>{playTone(250,.18,.493,"sine");playTone(200,.25,.375,"sine",.1);},
  add:()=>{playTone(880,.1,.375,"sine");playTone(1100,.08,.27,"sine",.05);},
  notify:()=>playTone(700,.15,.296,"sine")
};
window.SuphanSound=sound;
document.addEventListener("pointerdown",event=>{const button=event.target.closest("button");if(button&&!button.disabled) sound.tap();},{capture:true});

function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function money(value){return (Number(value)||0).toLocaleString("th-TH");}
function thaiDate(){return new Date().toLocaleDateString("th-TH",{weekday:"long",year:"numeric",month:"long",day:"numeric"});}
function currentRoute(){const hash=location.hash.replace(/^#/,"");return hash&&(["home","sales",...Object.keys(PAGES)].includes(hash))?hash:"home";}
function pageDirection(next){const order=["home","sales","workshop","outsource","expense","preorder","report","product","stock","settings"];return order.indexOf(next)<order.indexOf(activeRoute)?"back":"forward";}
function animatePage(direction){
  const animationClass=direction==="back"?"page-enter-back":"page-enter-forward";
  main.classList.remove("page-enter-forward","page-enter-back");
  void main.offsetWidth;
  main.classList.add(animationClass);
  // A persisted transform turns `position: sticky/fixed` children into a
  // different containing block.  Remove the entrance class once it has played.
  main.addEventListener("animationend",event=>{
    if(event.target===main&&event.animationName.startsWith("page-enter"))main.classList.remove(animationClass);
  },{once:true});
}
function setShell(visible){appHeader.hidden=!visible;appHeader.style.display=visible?"":"none";}
function showToast(message){toast.textContent=message;toast.classList.add("show");try{sound.notify();}catch(error){}clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2800);}
function setLogo(url){const src=url||LOGO_FALLBACK;topbarLogo.src=src;topbarLogo.onerror=()=>{topbarLogo.src=LOGO_FALLBACK;};}

function openSidebar(){sidebar.classList.add("open");sidebarOverlay.classList.add("show");}
function closeSidebar(){sidebar.classList.remove("open");sidebarOverlay.classList.remove("show");}
document.querySelector("#menuToggle").addEventListener("click",openSidebar);
sidebarOverlay.addEventListener("click",closeSidebar);
sidebar.addEventListener("click",event=>{
  const item=event.target.closest("[data-sidebar-route]");
  if(!item)return;
  closeSidebar();
  if(item.dataset.sidebarRoute==="refresh"){homeData=null;render("home",{animate:true});return;}
  showToast("เมนูนี้กำลังย้ายจาก Web App เดิม");
});

function showLogin(message=""){
  closeSidebar();
  setShell(false);
  pinInput="";
  main.innerHTML=`<section class="login-screen" aria-label="เข้าสู่ระบบ"><img class="login-logo" src="${LOGO_FALLBACK}" alt="โลโก้สุพรรณบุรีเบญจรงค์"><h1 class="login-title">สุพรรณบุรีเบญจรงค์</h1><p class="login-sub">ใส่รหัส 6 หลัก</p><div id="pinDots" class="pin-dots" aria-label="รหัส PIN"></div><div id="pinPad" class="pin-pad"></div><p id="pinError" class="pin-error" aria-live="polite">${escapeHtml(message)}</p></section>`;
  renderPin();
  // Start the lightweight health request while the user is entering six
  // digits.  The GAS endpoint warms its user-list cache in the background.
  api.health().catch(()=>{});
}

function renderPin(){
  const dots=document.querySelector("#pinDots");
  const pad=document.querySelector("#pinPad");
  if(!dots||!pad)return;
  dots.innerHTML=Array.from({length:6},(_,i)=>`<span class="pin-dot ${i<pinInput.length?"filled":""}"></span>`).join("");
  const keys=[1,2,3,4,5,6,7,8,9,"del",0,""];
  pad.innerHTML=keys.map(key=>key===""?'<span class="pin-key" aria-hidden="true" style="visibility:hidden"></span>':`<button class="pin-key ${key==="del"?"del":""}" type="button" data-pin="${key}">${key==="del"?"⌫":key}</button>`).join("");
  pad.querySelectorAll("[data-pin]").forEach(button=>button.addEventListener("click",()=>enterPin(button.dataset.pin)));
}

function enterPin(key){
  const error=document.querySelector("#pinError");
  if(key==="del")pinInput=pinInput.slice(0,-1);
  else if(pinInput.length<6)pinInput+=key;
  if(error)error.textContent="";
  renderPin();
  if(pinInput.length===6)setTimeout(submitPin,180);
}

async function submitPin(){
  const error=document.querySelector("#pinError");
  if(error)error.textContent="กำลังตรวจสอบ...";
  try{
    const result=await api.login(pinInput);
    if(!result.ok)throw new Error("INVALID_PIN");
    sessionToken=result.session;
    sessionStorage.setItem(SESSION_KEY,sessionToken);
    currentSession={level:result.level,user:null};
    showUserPicker(result.users||[]);
  }catch(error){sound.error();pinInput="";renderPin();const el=document.querySelector("#pinError");if(el)el.textContent="รหัสไม่ถูกต้อง";}
}

function showUserPicker(users){
  const colors=["#e91e63","#9c27b0","#2196f3","#ff9800","#4caf50","#00bcd4","#f44336","#3f51b5"];
  main.innerHTML=`<section class="login-screen" aria-label="เลือกชื่อผู้ใช้งาน"><div class="picker-icon" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><circle cx="32" cy="17" r="10"/><path d="M19 34c4-6 8-9 13-9s9 3 13 9l7 21H12l7-21Z"/><path d="m26 29 6 8 6-8 4 26H22l4-26Z" fill="currentColor" opacity=".82"/><path d="m32 34 4 7-4 5-4-5 4-7Z" fill="#fff8f0"/></svg></div><h1 class="picker-title">คุณคือใคร?</h1><div class="picker-grid">${users.map((user,index)=>`<button class="picker-btn" type="button" data-user-index="${index}"><span class="picker-initial" style="background:${colors[index%colors.length]}">${escapeHtml((user.name||"?").charAt(0))}</span><span class="picker-name">${escapeHtml(user.name)}</span><span class="picker-role">${escapeHtml(user.role||"")}</span></button>`).join("")||'<p class="hint">ไม่พบผู้ใช้งานที่เปิดใช้งาน</p>'}</div></section>`;
  main.querySelectorAll("[data-user-index]").forEach(button=>button.addEventListener("click",()=>selectUser(users[Number(button.dataset.userIndex)])));
}

async function selectUser(user){
  try{
    // Login API now supplies an already signed, short-lived session for each
    // permitted user.  Choosing a name therefore stays local and immediate;
    // retain the API call only for compatibility with an older deployment.
    if(user&&user.token){
      sessionToken=user.token;
      sessionStorage.setItem(SESSION_KEY,sessionToken);
      currentSession={level:currentSession?.level||"",user:{name:user.name,role:user.role||""}};
      displayUser={name:user.name,role:user.role||""};
      sessionStorage.setItem(DISPLAY_USER_KEY,JSON.stringify(displayUser));
      setAuthenticatedHeader();
      sound.success();
      navigate(currentRoute(),{replace:true,animate:true});
      return;
    }
    const result=await api.selectUser(sessionToken,user.name);
    if(!result.ok)throw new Error(result.error);
    sessionToken=result.token;
    sessionStorage.setItem(SESSION_KEY,sessionToken);
    currentSession=result.session;
    // เก็บชื่อสำหรับแสดงผลจากรายการที่ผู้ใช้เลือกโดยตรง เพื่อไม่ให้ Unicode
    // เพี้ยนระหว่าง response chain ของ gateway แม้สิทธิ์จริงยังยืนยันจาก token เดิม
    displayUser={name:user.name,role:user.role||""};
    sessionStorage.setItem(DISPLAY_USER_KEY,JSON.stringify(displayUser));
    setAuthenticatedHeader();
    sound.success();
    navigate(currentRoute(),{replace:true,animate:true});
  }catch(error){sound.error();showLogin("เลือกชื่อไม่สำเร็จ โปรดลองเข้าสู่ระบบใหม่");}
}

function setAuthenticatedHeader(){
  setShell(true);
  const serverUser=currentSession.user||{};
  const user=displayUser&&displayUser.name?displayUser:serverUser;
  connection.textContent=`👤 ${user.name||""}`;
  sidebarUser.textContent=`👤 ${user.name||""}${user.role?` (${user.role})`:""}`;
  document.querySelector("#currentDate").textContent=thaiDate();
}

// สิทธิ์ระดับ staff ในระบบเดิมมีไว้ใช้ขายสินค้าเท่านั้น (ดู verifyPin ใน
// 04_WebApp.gs) จึงต้องบังคับทั้งตอนแสดงเมนูและตอนพิมพ์ hash เข้ามาเอง
// ไม่ใช่ซ่อนปุ่มเพียงอย่างเดียว.
function hasFamilyAccess(){return String(currentSession?.level||"").trim()==="family";}
function isAllowedRoute(route){return hasFamilyAccess()||route==="sales";}
function allowedStartRoute(route){return isAllowedRoute(route)?route:"sales";}
function menuMarkup(){
  const visible=hasFamilyAccess()?MENU:MENU.filter(([route])=>route==="sales");
  return visible.map(([route,icon,label,sub])=>`<button type="button" class="home-menu-btn" data-route="${route}"><span class="home-menu-icon">${icon}</span><span class="home-menu-label">${label}</span><span class="home-menu-sub">${sub}</span></button>`).join("");
}
function featuredMarkup(items){
  if(!items||!items.length)return '<div class="empty-featured">⭐ ยังไม่มีสินค้าแนะนำ<br>ไปกดดาว ⭐ ในหน้าจัดการสินค้า</div>';
  return items.map(item=>`<article class="featured-card">${item.img?`<img class="featured-image" loading="lazy" src="${escapeHtml(item.img)}" alt="" onerror="this.outerHTML='<div class=&quot;featured-fallback&quot;>🏺</div>'">`:'<div class="featured-fallback">🏺</div>'}<div class="featured-info"><div class="featured-name">${escapeHtml(item.name)}${item.size?` ${escapeHtml(item.size)}`:""}</div><div class="featured-pattern">${escapeHtml(item.pattern||"")}</div><div class="featured-price">฿${money(item.priceRetail)}</div></div></article>`).join("");
}
function renderHome(){
  const data=homeData||{};
  const shop=data.shop||{};
  const name=shop.name||"สุพรรณบุรีเบญจรงค์";
  const daily=data.daily||{};
  main.innerHTML=`<section class="home-hero"><img id="homeLogo" class="home-logo" src="${escapeHtml(shop.logo||LOGO_FALLBACK)}" alt="โลโก้"><h1 class="home-name">${escapeHtml(name)}</h1><p class="home-tagline">งานฝีมือไทยแท้ ✨</p></section><section class="home-summary"><div><div class="welcome-title">สวัสดีครับ 🙏</div><div class="welcome-date">${thaiDate()}</div></div><div class="summary-values"><div class="card-stat"><div class="stat-value">฿${money(daily.totalSales)}</div><div class="stat-label">ยอดขายวันนี้</div></div><div class="card-stat"><div class="stat-value">${money(daily.billCount)} บิล</div><div class="stat-label">จำนวนบิล</div></div></div></section><h2 class="section-title">📋 เมนูหลัก</h2><section class="home-menu-grid">${menuMarkup()}</section><h2 class="section-title">⭐ สินค้าขายดี</h2><section class="featured-grid">${featuredMarkup(data.starred)}</section><footer class="home-footer"><div>🏺 ${escapeHtml(name)} — งานฝีมือไทยแท้</div><div>${escapeHtml([shop.address,shop.phone?`โทร ${shop.phone}`:""].filter(Boolean).join(" | "))}</div><div>Version 2.0</div></footer>`;
  const homeLogo=main.querySelector("#homeLogo");if(homeLogo)homeLogo.onerror=()=>{homeLogo.src=LOGO_FALLBACK;};
  main.querySelectorAll("[data-route]").forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.route)));
  if(!homeData)loadHomeData();
}

async function loadHomeData(){
  try{
    const data=await api.homeBootstrap(sessionToken);
    if(!data.ok)throw new Error(data.error);
    homeData=data;
    const name=data.shop&&data.shop.name;
    if(name)topbarTitle.textContent=name;
    setLogo(data.shop&&data.shop.logo);
    if(activeRoute==="home")renderHome();
  }catch(error){if(activeRoute==="home")showToast("แสดงโครงหน้าแรกแล้ว กำลังเชื่อมข้อมูลล่าสุด");}
}

function renderPlaceholder(route){const [title,body]=PAGES[route]||["กำลังพัฒนา",""];main.innerHTML=`<section class="card"><h1>${title}</h1><p>${body}</p><p class="hint">ระบบเดิมบน GAS ยังใช้งานได้ตามปกติระหว่างย้ายโมดูล</p></section>`;}
function render(route,{animate=true,direction}={}){
  if(!currentSession||!currentSession.user){showLogin("กรุณาเข้าสู่ระบบก่อนใช้งาน");return;}
  route=["home","sales",...Object.keys(PAGES)].includes(route)?route:"home";
  route=allowedStartRoute(route);
  const travel=direction||pageDirection(route);activeRoute=route;if(animate)animatePage(travel);
  main.dataset.route=route;
  // A module may add viewport-pinned actions. Never let those controls leak
  // into another route (especially the POS command bar).
  if(floatingLayer)floatingLayer.replaceChildren();
  // POS มีแถบคำสั่งเฉพาะของตนเอง จึงไม่ซ้อนกับ header หลักของ App Shell.
  // POS and Product Management each own a dedicated, pinned command bar.
  // Keeping the Home App Shell off these screens prevents stacked headers.
  setShell(route!=="sales"&&route!=="product"&&route!=="expense"&&route!=="preorder"&&route!=="outsource"&&route!=="report");
  main.classList.toggle("pos-main",route==="sales");
  main.classList.toggle("product-main",route==="product");
  main.classList.toggle("expense-main",route==="expense");
  main.classList.toggle("preorder-main",route==="preorder");
  main.classList.toggle("outsource-main",route==="outsource");
  main.classList.toggle("report-main",route==="report");
  if(route==="sales"){renderPos(main,api,sessionToken,()=>hasFamilyAccess()?navigate("home"):void returnLimitedPosToLogin(),{...(currentSession||{}),displayUser});return;}
  if(route==="product"){renderProduct(main,api,sessionToken,()=>navigate("home"),{toast:showToast});return;}
  if(route==="expense"){renderExpense(main,api,sessionToken,()=>navigate("home"),{toast:showToast,displayUser});return;}
  if(route==="preorder"){renderPreorder(main,api,sessionToken,()=>navigate("home"),{toast:showToast});return;}
  if(route==="outsource"){renderOutsource(main,api,sessionToken,()=>navigate("home"),{toast:showToast,displayUser});return;}
  if(route==="report"){renderReport(main,api,sessionToken,()=>navigate("home"),{toast:showToast,displayUser});return;}
  if(route==="home"){renderHome();return;}
  renderPlaceholder(route);
}
function navigate(route,{replace=false,animate=true}={}){
  const requested=["home","sales",...Object.keys(PAGES)].includes(route)?route:"home";
  const clean=allowedStartRoute(requested);
  const url=`#${clean}`;
  if(replace)history.replaceState({route:clean},"",url);else history.pushState({route:clean},"",url);
  render(clean,{animate});
}
async function returnLimitedPosToLogin(){
  // A sales-only account has no permitted Home route. Its POS back button
  // ends the session instead of silently navigating back to #sales.
  const token=sessionToken;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(DISPLAY_USER_KEY);
  sessionToken="";
  currentSession=null;
  displayUser=null;
  homeData=null;
  history.replaceState({route:"home"},"","#home");
  showLogin("");
  try{if(token)await api.logout(token);}catch(error){}
}
window.addEventListener("popstate",()=>render(currentRoute(),{animate:true}));
// Product mutations must never leave dashboard/POS master data looking current.
window.addEventListener("suphan-data-mutated",()=>{homeData=null;});
function barcodeChar(event){
  if(event.key&&event.key.length===1&&/[A-Za-z0-9\-_]/.test(event.key))return event.key;
  const code=event.code||"";
  if(code.startsWith("Key"))return code.slice(3);
  if(code.startsWith("Digit"))return code.slice(5);
  if(code.startsWith("Numpad")&&/^[0-9]$/.test(code.slice(6)))return code.slice(6);
  if(code==="Minus")return "-";
  return "";
}
function receiveBarcode(code){
  const value=String(code||"").trim().toUpperCase();
  if(value.length<4)return;
  if(activeRoute==="sales"){
    window.dispatchEvent(new CustomEvent("suphan-barcode",{detail:value}));
    return;
  }
  sessionStorage.setItem(PENDING_BARCODE_KEY,value);
  navigate("sales",{animate:true});
}
document.addEventListener("keydown",event=>{
  // POS also hides the App Shell header.  Only the visible PIN keypad may
  // claim number keys; otherwise number inputs in POS must receive them.
  if(document.querySelector("#pinPad")){
    if(event.key>="0"&&event.key<="9"){enterPin(event.key);event.preventDefault();}
    else if(event.key==="Backspace"||event.key==="Delete"){enterPin("del");event.preventDefault();}
    return;
  }
  if(!currentSession||!currentSession.user)return;
  const target=event.target;
  if(target&&/^(input|textarea|select)$/i.test(target.tagName||""))return;
  if(event.key==="Enter"||event.code==="Enter"||event.code==="NumpadEnter"){
    if(barcodeBuffer.length>=4){event.preventDefault();receiveBarcode(barcodeBuffer);}
    barcodeBuffer="";
    return;
  }
  const char=barcodeChar(event);
  if(!char)return;
  barcodeBuffer+=char;
  clearTimeout(barcodeTimer);
  barcodeTimer=setTimeout(()=>{barcodeBuffer="";},1000);
});

document.querySelector("#logout").addEventListener("click",async()=>{
  try{if(sessionToken)await api.logout(sessionToken);}catch(error){}
  sessionStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(DISPLAY_USER_KEY);sessionToken="";currentSession=null;displayUser=null;homeData=null;showLogin("ออกจากระบบแล้ว");
});

async function initialize(){
  // Never leave a blank canvas while the gateway is slow or unavailable.
  // A first-time user can always start at the PIN screen without waiting for health.
  if(!sessionToken){showLogin();return;}
  main.innerHTML='<section class="card app-loading"><div class="spinner" aria-hidden="true"></div><p>กำลังเปิดข้อมูลร้าน…</p></section>';
  try{
    const result=await api.bootstrap(sessionToken);
    if(!result.ok||!result.session||!result.session.user)throw new Error("SESSION_EXPIRED");
    currentSession=result.session;
    try{displayUser=JSON.parse(sessionStorage.getItem(DISPLAY_USER_KEY)||"null");}catch(error){displayUser=null;}
    setAuthenticatedHeader();navigate(currentRoute(),{replace:true,animate:false});
  }catch(error){sessionStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(DISPLAY_USER_KEY);sessionToken="";currentSession=null;displayUser=null;showLogin("ไม่พบ session เดิมหรือการเชื่อมต่อหมดอายุ");}
}

if("serviceWorker" in navigator)navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
initialize();
