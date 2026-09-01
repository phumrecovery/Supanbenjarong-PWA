// API boundary for PART 3. Credentials, PINs, and tokens never belong here.
// The Worker accepts requests only from this GitHub Pages origin and signs the
// server-to-server request before forwarding it to GAS.
const GATEWAY_API_URL="https://suphanbenjarong-api.phum-recovery.workers.dev/api";

export class ApiClient {
  async request(payload,timeoutMs=15000){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),timeoutMs);
    let response;
    try{
      response=await fetch(GATEWAY_API_URL,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),
        cache:"no-store",
        signal:controller.signal
      });
    }finally{clearTimeout(timeout);}
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
  posBootstrap(session){
    return this.request({action:"posBootstrap",session});
  }
  homeBootstrap(session){
    return this.request({action:"homeBootstrap",session});
  }
  productBootstrap(session,layer="store"){
    return this.request({action:"productBootstrap",session,layer});
  }
  productAdd(session,product){
    return this.request({action:"productAdd",session,product});
  }
  productUpdate(session,row,product){
    return this.request({action:"productUpdate",session,row,product});
  }
  productStatus(session,row,status,layer){
    return this.request({action:"productStatus",session,row,status,layer});
  }
  productDuplicate(session,row,layer){
    return this.request({action:"productDuplicate",session,row,layer});
  }
  productStar(session,code){
    return this.request({action:"productStar",session,code});
  }
  productUploadImage(session,row,layer,data,fileName){
    return this.request({action:"productUploadImage",session,row,layer,data,fileName},60000);
  }
  expenseBootstrap(session){return this.request({action:"expenseBootstrap",session});}
  expenseTransactions(session){return this.request({action:"expenseTransactions",session});}
  expenseSupport(session){return this.request({action:"expenseSupport",session});}
  expenseAdd(session,expense){return this.request({action:"expenseAdd",session,expense});}
  expenseUpdate(session,row,expense){return this.request({action:"expenseUpdate",session,row,expense});}
  expenseDelete(session,row){return this.request({action:"expenseDelete",session,row});}
  expensePurchase(session,purchase){return this.request({action:"expensePurchase",session,purchase});}
  fixedAdd(session,fixed){return this.request({action:"fixedAdd",session,fixed});}
  fixedUpdate(session,row,fixed){return this.request({action:"fixedUpdate",session,row,fixed});}
  fixedStatus(session,row,status){return this.request({action:"fixedStatus",session,row,status});}
  investmentAdd(session,investment){return this.request({action:"investmentAdd",session,investment});}
  investmentUpdate(session,row,investment){return this.request({action:"investmentUpdate",session,row,investment});}
  investmentDelete(session,row){return this.request({action:"investmentDelete",session,row});}
  expenseMonthSummary(session,month,year){return this.request({action:"expenseMonthSummary",session,month,year});}
  expenseUploadImage(session,data,fileName){return this.request({action:"expenseUploadImage",session,data,fileName},60000);}
  preorderBootstrap(session){return this.request({action:"preorderBootstrap",session},30000);}
  preorderQuotationSave(session,data,row){return this.request({action:"preorderQuotationSave",session,data,row},30000);}
  preorderQuotationStatus(session,row,status){return this.request({action:"preorderQuotationStatus",session,row,status},30000);}
  preorderCreatePoFromQt(session,row){return this.request({action:"preorderCreatePoFromQt",session,row},30000);}
  preorderPoSave(session,data,row){return this.request({action:"preorderPoSave",session,data,row},30000);}
  preorderPoStatus(session,row,status){return this.request({action:"preorderPoStatus",session,row,status},30000);}
  preorderDepositConfirm(session,row,date){return this.request({action:"preorderDepositConfirm",session,row,date},30000);}
  preorderCustomerSave(session,data,row){return this.request({action:"preorderCustomerSave",session,data,row},30000);}
  preorderUploadImage(session,dataUrl,fileName){return this.request({action:"preorderUploadImage",session,dataUrl,fileName},60000);}
  selectUser(session,name){
    return this.request({action:"selectUser",session,name});
  }
  logout(session){
    return this.request({action:"logout",session});
  }
  async saveSale(session,sale,requestId){
    const payload=await this.request({action:"saveSale",session,sale,requestId});
    if(!payload.ok) throw new Error(payload.message||"บันทึกบิลไม่สำเร็จ");
    return payload.result;
  }
}
