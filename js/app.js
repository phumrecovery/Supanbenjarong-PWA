import {ApiClient} from "./api.js";
const api=new ApiClient();
const main=document.querySelector("#main");
const connection=document.querySelector("#connection");
const routes={
  home:{title:"ยินดีต้อนรับ",body:"PWA shell พร้อมใช้งานแล้ว ระบบเดิมบน GAS ยังทำงานคู่กันระหว่าง migration"},
  sales:{title:"ขายของ",body:"จะใช้ bootstrap สินค้าและตะกร้าจาก GAS API เมื่อระบบยืนยันตัวตนพร้อม"},
  stock:{title:"สต๊อก",body:"ข้อมูลสต๊อกจะอ่านแบบ fresh จาก GAS และไม่เก็บ transaction ใน service worker"},
  workshop:{title:"งานช่าง",body:"งานช่างและค่าจ้างจะ reuse validation/LockService จาก GAS เดิม"},
  expense:{title:"ค่าใช้จ่าย",body:"รายการรับ-จ่ายจะแสดงสำเร็จหลัง GAS ยืนยันเท่านั้น"}
};
function render(route){
  const page=routes[route]||routes.home;
  history.replaceState({route},"",`#${route}`);
  main.innerHTML=`<section class="card"><h1>${page.title}</h1><p>${page.body}</p><p class="hint">กำลังอยู่ในโครง frontend แยก ยังไม่มีการเรียกหรือบันทึกข้อมูลจริง</p></section>`;
  document.querySelectorAll("[data-route]").forEach(button=>button.classList.toggle("active",button.dataset.route===route));
}
document.querySelector(".bottom-nav").addEventListener("click",event=>{const button=event.target.closest("[data-route]");if(button)render(button.dataset.route);});
window.addEventListener("hashchange",()=>render(location.hash.slice(1)||"home"));
render(location.hash.slice(1)||"home");
if("serviceWorker" in navigator){navigator.serviceWorker.register("./service-worker.js").then(()=>connection.textContent="กำลังตรวจสอบ GAS").catch(()=>connection.textContent="PWA shell ยังไม่พร้อม");}
else connection.textContent="กำลังตรวจสอบ GAS";
api.bootstrap()
  .then(()=>connection.textContent="เชื่อม GAS สำเร็จ")
  .catch(()=>connection.textContent="ยังเชื่อม GAS ไม่ได้");
