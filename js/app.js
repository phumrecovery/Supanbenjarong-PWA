import {ApiClient} from "./api.js";
import {renderPos} from "./pos.js";

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
const SESSION_KEY="suphanbenjarong.pwa.session";
const LOGO_FALLBACK="./assets/icon.svg";
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
let activeRoute="";
let pinInput="";
let homeData=null;
let toastTimer=0;

function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function money(value){return (Number(value)||0).toLocaleString("th-TH");}
function thaiDate(){return new Date().toLocaleDateString("th-TH",{weekday:"long",year:"numeric",month:"long",day:"numeric"});}
function currentRoute(){const hash=location.hash.replace(/^#/,"");return hash&&(["home","sales",...Object.keys(PAGES)].includes(hash))?hash:"home";}
function pageDirection(next){const order=["home","sales","workshop","outsource","expense","preorder","report","product","stock","settings"];return order.indexOf(next)<order.indexOf(activeRoute)?"back":"forward";}
function animatePage(direction){main.classList.remove("page-enter-forward","page-enter-back");void main.offsetWidth;main.classList.add(direction==="back"?"page-enter-back":"page-enter-forward");}
function setShell(visible){appHeader.hidden=!visible;}
function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2800);}
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
  }catch(error){pinInput="";renderPin();const el=document.querySelector("#pinError");if(el)el.textContent="รหัสไม่ถูกต้อง";}
}

function showUserPicker(users){
  const colors=["#e91e63","#9c27b0","#2196f3","#ff9800","#4caf50","#00bcd4","#f44336","#3f51b5"];
  main.innerHTML=`<section class="login-screen" aria-label="เลือกชื่อผู้ใช้งาน"><div class="picker-icon">👤</div><h1 class="picker-title">คุณคือใคร?</h1><div class="picker-grid">${users.map((user,index)=>`<button class="picker-btn" type="button" data-user-index="${index}"><span class="picker-initial" style="background:${colors[index%colors.length]}">${escapeHtml((user.name||"?").charAt(0))}</span><span class="picker-name">${escapeHtml(user.name)}</span><span class="picker-role">${escapeHtml(user.role||"")}</span></button>`).join("")||'<p class="hint">ไม่พบผู้ใช้งานที่เปิดใช้งาน</p>'}</div></section>`;
  main.querySelectorAll("[data-user-index]").forEach(button=>button.addEventListener("click",()=>selectUser(users[Number(button.dataset.userIndex)].name)));
}

async function selectUser(name){
  try{
    const result=await api.selectUser(sessionToken,name);
    if(!result.ok)throw new Error(result.error);
    sessionToken=result.token;
    sessionStorage.setItem(SESSION_KEY,sessionToken);
    currentSession=result.session;
    setAuthenticatedHeader();
    navigate(currentRoute(),{replace:true,animate:true});
  }catch(error){showLogin("เลือกชื่อไม่สำเร็จ โปรดลองเข้าสู่ระบบใหม่");}
}

function setAuthenticatedHeader(){
  setShell(true);
  const user=currentSession.user||{};
  connection.textContent=`👤 ${user.name||""}`;
  sidebarUser.textContent=`👤 ${user.name||""}${user.role?` (${user.role})`:""}`;
  document.querySelector("#currentDate").textContent=thaiDate();
}

function menuMarkup(){return MENU.map(([route,icon,label,sub])=>`<button type="button" class="home-menu-btn" data-route="${route}"><span class="home-menu-icon">${icon}</span><span class="home-menu-label">${label}</span><span class="home-menu-sub">${sub}</span></button>`).join("");}
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
  const travel=direction||pageDirection(route);activeRoute=route;if(animate)animatePage(travel);
  if(route==="sales"){renderPos(main,api,sessionToken);return;}
  if(route==="home"){renderHome();return;}
  renderPlaceholder(route);
}
function navigate(route,{replace=false,animate=true}={}){const clean=["home","sales",...Object.keys(PAGES)].includes(route)?route:"home";const url=`#${clean}`;if(replace)history.replaceState({route:clean},"",url);else history.pushState({route:clean},"",url);render(clean,{animate});}
window.addEventListener("popstate",()=>render(currentRoute(),{animate:true}));
document.addEventListener("keydown",event=>{if(!appHeader.hidden)return;if(event.key>="0"&&event.key<="9"){enterPin(event.key);event.preventDefault();}else if(event.key==="Backspace"||event.key==="Delete"){enterPin("del");event.preventDefault();}});

document.querySelector("#logout").addEventListener("click",async()=>{
  try{if(sessionToken)await api.logout(sessionToken);}catch(error){}
  sessionStorage.removeItem(SESSION_KEY);sessionToken="";currentSession=null;homeData=null;showLogin("ออกจากระบบแล้ว");
});

async function initialize(){
  try{
    await api.health();
    if(!sessionToken){showLogin();return;}
    const result=await api.bootstrap(sessionToken);
    if(!result.ok||!result.session||!result.session.user)throw new Error("SESSION_EXPIRED");
    currentSession=result.session;setAuthenticatedHeader();navigate(currentRoute(),{replace:true,animate:false});
  }catch(error){sessionStorage.removeItem(SESSION_KEY);sessionToken="";currentSession=null;showLogin("ไม่พบ session เดิมหรือการเชื่อมต่อหมดอายุ");}
}

if("serviceWorker" in navigator)navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
initialize();
