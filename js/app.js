import {ApiClient} from "./api.js";
import {renderPos} from "./pos.js";

const api=new ApiClient();
const main=document.querySelector("#main");
const connection=document.querySelector("#connection");
const logoutButton=document.querySelector("#logout");
const SESSION_KEY="suphanbenjarong.pwa.session";
let sessionToken=sessionStorage.getItem(SESSION_KEY)||"";
let currentSession=null;
const routes={
  home:{title:"ยินดีต้อนรับ",body:"PWA shell พร้อมใช้งานแล้ว ระบบเดิมบน GAS ยังทำงานคู่กันระหว่าง migration"},
  sales:{title:"ขายของ",body:"จะใช้ bootstrap สินค้าและตะกร้าจาก GAS API เมื่อย้ายโมดูลนี้พร้อม"},
  stock:{title:"สต๊อก",body:"ข้อมูลสต๊อกจะอ่านแบบ fresh จาก GAS และไม่เก็บ transaction ใน service worker"},
  workshop:{title:"งานช่าง",body:"งานช่างและค่าจ้างจะ reuse validation/LockService จาก GAS เดิม"},
  expense:{title:"ค่าใช้จ่าย",body:"รายการรับ-จ่ายจะแสดงสำเร็จหลัง GAS ยืนยันเท่านั้น"}
};

function render(route){
  if(!currentSession||!currentSession.user){
    showLogin("กรุณาเข้าสู่ระบบก่อนใช้งาน");
    return;
  }
  if(route==="sales"){
    history.replaceState({route},"",`#${route}`);
    document.querySelectorAll("[data-route]").forEach(button=>button.classList.toggle("active",button.dataset.route===route));
    renderPos(main,api,sessionToken);
    return;
  }
  const page=routes[route]||routes.home;
  history.replaceState({route},"",`#${route}`);
  main.innerHTML=`<section class="card"><h1>${page.title}</h1><p>${page.body}</p><p class="hint">โครงหน้า PWA พร้อมแล้ว ส่วนข้อมูลและธุรกรรมจะเปิดใช้ทีละโมดูลหลังตรวจสอบครบถ้วน</p></section>`;
  document.querySelectorAll("[data-route]").forEach(button=>button.classList.toggle("active",button.dataset.route===route));
}

function setAuthenticatedHeader(){
  connection.textContent=`เข้าสู่ระบบ: ${currentSession.user.name}`;
  logoutButton.hidden=false;
}

function showLogin(message=""){
  main.innerHTML=`<section class="card login-card"><h1>เข้าสู่ระบบร้าน</h1><p>ใช้รหัส PIN เดิมของร้าน ไม่ต้องใช้บัญชีอีเมล</p><form id="pin-form"><label for="pin">รหัส PIN</label><input id="pin" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" minlength="4" maxlength="12" required><button type="submit">เข้าสู่ระบบ</button></form><p class="hint" id="login-message">${message}</p></section>`;
  document.querySelector("#pin-form").addEventListener("submit",submitPin);
}

async function submitPin(event){
  event.preventDefault();
  const pin=document.querySelector("#pin").value.trim();
  const message=document.querySelector("#login-message");
  message.textContent="กำลังตรวจสอบ PIN…";
  try{
    const result=await api.login(pin);
    if(!result.ok){message.textContent="รหัส PIN ไม่ถูกต้อง";return;}
    sessionToken=result.session;
    sessionStorage.setItem(SESSION_KEY,sessionToken);
    currentSession={level:result.level,user:null};
    showUserPicker(result.users||[]);
  }catch(error){message.textContent="เชื่อมต่อระบบไม่สำเร็จ ลองอีกครั้ง";}
}

function showUserPicker(users){
  main.innerHTML="";
  const section=document.createElement("section");
  section.className="card login-card";
  const heading=document.createElement("h1");
  heading.textContent="เลือกชื่อผู้ใช้งาน";
  section.append(heading);
  const description=document.createElement("p");
  description.textContent="เลือกชื่อของคุณเพื่อบันทึกผู้ทำรายการ";
  section.append(description);
  const list=document.createElement("div");
  list.className="user-list";
  users.forEach(user=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="user-button";
    const icon=document.createElement("span");
    icon.className="user-avatar";
    icon.setAttribute("aria-hidden","true");
    icon.innerHTML='<svg viewBox="0 0 24 24" focusable="false"><path d="M12 11.3a4.15 4.15 0 1 0 0-8.3 4.15 4.15 0 0 0 0 8.3Zm-7 9.7a7 7 0 0 1 14 0H5Zm8.4-8.1 2.1 1.4-1 1.1 1.2 1.1-2.1 2.5-2.1-2.5 1.2-1.1-1-1.1 2.1-1.4Z"/></svg>';
    const text=document.createElement("span");
    text.textContent=user.role?`${user.name} — ${user.role}`:user.name;
    button.append(icon,text);
    button.addEventListener("click",()=>selectUser(user.name));
    list.append(button);
  });
  if(!users.length){
    const empty=document.createElement("p");
    empty.className="hint";
    empty.textContent="ไม่พบผู้ใช้งานที่เปิดใช้งาน โปรดตรวจสอบข้อมูลในระบบเดิม";
    list.append(empty);
  }
  section.append(list);
  main.append(section);
}

async function selectUser(name){
  try{
    const result=await api.selectUser(sessionToken,name);
    if(!result.ok) throw new Error(result.error);
    sessionToken=result.token;
    sessionStorage.setItem(SESSION_KEY,sessionToken);
    currentSession=result.session;
    setAuthenticatedHeader();
    render(location.hash.slice(1)||"home");
  }catch(error){showLogin("เลือกชื่อไม่สำเร็จ โปรดลองเข้าสู่ระบบใหม่");}
}

document.querySelector(".bottom-nav").addEventListener("click",event=>{
  const button=event.target.closest("[data-route]");
  if(button) render(button.dataset.route);
});
window.addEventListener("hashchange",()=>render(location.hash.slice(1)||"home"));

async function initialize(){
  try{
    await api.health();
    if(!sessionToken){connection.textContent="กรุณาเข้าสู่ระบบ";showLogin();return;}
    const result=await api.bootstrap(sessionToken);
    if(!result.ok) throw new Error(result.error);
    currentSession=result.session;
    if(!currentSession.user){connection.textContent="เลือกชื่อผู้ใช้งาน";showLogin("กรุณาเข้าสู่ระบบใหม่เพื่อเลือกชื่อผู้ใช้งาน");return;}
    setAuthenticatedHeader();
    render(location.hash.slice(1)||"home");
  }catch(error){
    sessionStorage.removeItem(SESSION_KEY);
    sessionToken="";
    connection.textContent="กรุณาเข้าสู่ระบบ";
    showLogin("ไม่พบ session เดิมหรือการเชื่อมต่อหมดอายุ");
  }
}

logoutButton.addEventListener("click",async()=>{
  logoutButton.disabled=true;
  try{if(sessionToken) await api.logout(sessionToken);}catch(error){}
  sessionStorage.removeItem(SESSION_KEY);
  sessionToken="";
  currentSession=null;
  logoutButton.hidden=true;
  logoutButton.disabled=false;
  connection.textContent="กรุณาเข้าสู่ระบบ";
  showLogin("ออกจากระบบแล้ว");
});

if("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
initialize();
