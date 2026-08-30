// API boundary for PART 3. Credentials, PINs, and tokens never belong here.
// The Worker accepts requests only from this GitHub Pages origin and signs the
// server-to-server request before forwarding it to GAS.
const GATEWAY_API_URL="https://suphanbenjarong-api.phum-recovery.workers.dev/api";

export class ApiClient {
  async bootstrap(){
    const response=await fetch(GATEWAY_API_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"health"}),
      cache:"no-store"
    });
    if(!response.ok) throw new Error(`Gateway ตอบกลับ ${response.status}`);
    const payload=await response.json();
    if(!payload.ok) throw new Error("GAS API ไม่พร้อมใช้งาน");
    return payload;
  }
  async transaction(){
    throw new Error("ธุรกรรมถูกปิดไว้จนกว่า API authentication จะพร้อม");
  }
}
