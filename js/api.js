// API boundary for PART 3. Credentials, PINs, and tokens never belong here.
// This public, read-only health probe is used only to prove browser ↔ GAS transport.
const GAS_API_URL="https://script.google.com/macros/s/AKfycbx_kKQiTjU_HTx2rPIPOXQVhaqBnXtvvodsnM0Bmhbh-D2T81-1GYuIAIwQTjWnIhORzg/exec";

export class ApiClient {
  async bootstrap(){
    const response=await fetch(`${GAS_API_URL}?api=health`,{cache:"no-store"});
    if(!response.ok) throw new Error(`GAS API ตอบกลับ ${response.status}`);
    const payload=await response.json();
    if(!payload.ok) throw new Error("GAS API ไม่พร้อมใช้งาน");
    return payload;
  }
  async transaction(){
    throw new Error("ธุรกรรมถูกปิดไว้จนกว่า API authentication จะพร้อม");
  }
}
