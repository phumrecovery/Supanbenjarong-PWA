// API boundary for PART 3. Credentials, PINs, and tokens never belong here.
// The Worker accepts requests only from this GitHub Pages origin and signs the
// server-to-server request before forwarding it to GAS.
const GATEWAY_API_URL="https://suphanbenjarong-api.phum-recovery.workers.dev/api";

export class ApiClient {
  async request(payload,timeoutMs=15000,{retries=0,retryLogical=false}={}){
    let result;
    for(let attempt=0;attempt<=retries;attempt++){
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),timeoutMs);
      try{
        const response=await fetch(GATEWAY_API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store",signal:controller.signal});
        if(!response.ok)throw new Error(`Gateway ตอบกลับ ${response.status}`);
        result=await response.json();
        if(!result?.ok&&retryLogical&&attempt<retries){await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));continue;}
        return result;
      }catch(error){
        if(attempt>=retries)throw error;
        await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
      }finally{clearTimeout(timeout);}
    }
    return result;
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
    // This is a read-only request: GAS/Sheets can briefly be cold or busy,
    // therefore it is safe to retry rather than replacing the page with empty data.
    return this.request({action:"productBootstrap",session,layer},30000,{retries:2,retryLogical:true});
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
  reportBootstrap(session){return this.request({action:"reportBootstrap",session},30000,{retries:1,retryLogical:true});}
  reportDaily(session,date){return this.request({action:"reportDaily",session,date},30000,{retries:1,retryLogical:true});}
  reportMonthly(session,year,month){return this.request({action:"reportMonthly",session,year,month},30000,{retries:1,retryLogical:true});}
  reportYearly(session,year){return this.request({action:"reportYearly",session,year},30000,{retries:1,retryLogical:true});}
  reportCost(session,year,month0){return this.request({action:"reportCost",session,year,month:month0},30000,{retries:1,retryLogical:true});}
  reportCashflow(session,year){return this.request({action:"reportCashflow",session,year},30000,{retries:1,retryLogical:true});}
  reportPrint(session,year,month0){return this.request({action:"reportPrint",session,year,month:month0},30000,{retries:1,retryLogical:true});}
  reportCashflowStartSave(session,amount,year,month){return this.request({action:"reportCashflowStartSave",session,amount,year,month},30000);}
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
  outsourceBootstrap(session){return this.request({action:"outsourceBootstrap",session},30000);}
  outsourceOrderSave(session,data){return this.request({action:"outsourceOrderSave",session,data},30000);}
  outsourcePurchaseSave(session,data){return this.request({action:"outsourcePurchaseSave",session,data},30000);}
  outsourceReceiveSave(session,data){return this.request({action:"outsourceReceiveSave",session,data},30000);}
  outsourceUploadImage(session,data,fileName){return this.request({action:"outsourceUploadImage",session,data,fileName},60000);}
  preorderBootstrap(session){return this.request({action:"preorderBootstrap",session},30000);}
  preorderQuotationSave(session,data,row){return this.request({action:"preorderQuotationSave",session,data,row},30000);}
  preorderQuotationStatus(session,row,status){return this.request({action:"preorderQuotationStatus",session,row,status},30000);}
  preorderCreatePoFromQt(session,row){return this.request({action:"preorderCreatePoFromQt",session,row},30000);}
  preorderPoSave(session,data,row){return this.request({action:"preorderPoSave",session,data,row},30000);}
  preorderPoStatus(session,row,status){return this.request({action:"preorderPoStatus",session,row,status},30000);}
  preorderDepositConfirm(session,row,date){return this.request({action:"preorderDepositConfirm",session,row,date},30000);}
  preorderPrintDocument(session,row,type){return this.request({action:"preorderPrintDocument",session,row,type},30000);}
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
