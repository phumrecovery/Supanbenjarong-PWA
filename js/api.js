// API boundary for PART 3. Credentials, PINs, and tokens never belong here.
// The Worker accepts requests only from this GitHub Pages origin and signs the
// server-to-server request before forwarding it to GAS.
const GATEWAY_API_URL="https://suphanbenjarong-api.phum-recovery.workers.dev/api";

export class ApiClient {
  async request(payload){
    const response=await fetch(GATEWAY_API_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload),
      cache:"no-store"
    });
    if(!response.ok) throw new Error(`Gateway ตอบกลับ ${response.status}`);
    return response.json();
  }
  async health(){
    const payload=await this.request({action:"health"});
    if(!payload.ok) throw new Error("GAS API ไม่พร้อมใช้งาน");
    return payload;
  }
  login(pin){
    return this.request({action:"login",pin});
  }
  bootstrap(session){
    return this.request({action:"bootstrap",session});
  }
  selectUser(session,name){
    return this.request({action:"selectUser",session,name});
  }
  logout(session){
    return this.request({action:"logout",session});
  }
  async transaction(){
    throw new Error("ธุรกรรมถูกปิดไว้จนกว่า API authentication จะพร้อม");
  }
}
