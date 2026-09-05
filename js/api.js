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
  posCategoryOrder(session,categories){
    return this.request({action:"posCategoryOrder",session,categories},30000);
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
  stockBootstrap(session){
    return this.request({action:"stockBootstrap",session},30000,{retries:1,retryLogical:true});
  }
  stockSaveMovement(session,data){
    return this.request({action:"stockSaveMovement",session,data},30000);
  }
  stockConfirmFiring(session,rowIdx,passed,damaged){
    return this.request({action:"stockConfirmFiring",session,rowIdx,passed,damaged},30000);
  }
  workshopBootstrap(session){return this.request({action:"workshopBootstrap",session},45000,{retries:1,retryLogical:true});}
  workshopSaveJob(session,data){return this.request({action:"workshopSaveJob",session,data},45000);}
  workshopAttendance(session,date){return this.request({action:"workshopAttendance",session,date},30000,{retries:1,retryLogical:true});}
  workshopMonthlyAttendance(session,year,month){return this.request({action:"workshopMonthlyAttendance",session,year,month},45000,{retries:1,retryLogical:true});}
  workshopSaveAttendance(session,data){return this.request({action:"workshopSaveAttendance",session,data},45000);}
  workshopWageSummary(session,start,end){return this.request({action:"workshopWageSummary",session,start,end},60000,{retries:1,retryLogical:true});}
  workshopConfirmFiring(session,rowIdx,passed,damaged){return this.request({action:"workshopConfirmFiring",session,rowIdx,passed,damaged},45000);}
  reportBootstrap(session){return this.request({action:"reportBootstrap",session},20000,{retries:1,retryLogical:true});}
  reportDaily(session,date){return this.request({action:"reportDaily",session,date},60000,{retries:0,retryLogical:false});}
  reportMonthly(session,year,month){return this.request({action:"reportMonthly",session,year,month},60000,{retries:0,retryLogical:false});}
  reportYearly(session,year){return this.request({action:"reportYearly",session,year},60000,{retries:0,retryLogical:false});}
  reportCost(session,year,month0){return this.request({action:"reportCost",session,year,month:month0},60000,{retries:0,retryLogical:false});}
  reportCashflow(session,year){return this.request({action:"reportCashflow",session,year},60000,{retries:0,retryLogical:false});}
  reportPrint(session,year,month0){return this.request({action:"reportPrint",session,year,month:month0},30000,{retries:1,retryLogical:true});}
  reportCashflowStartSave(session,amount,year,month){return this.request({action:"reportCashflowStartSave",session,amount,year,month},30000);}
  // Master data can briefly fail while the Sheet execution is cold. This call
  // is read-only, so one bounded retry is safe.
  expenseBootstrap(session){return this.request({action:"expenseBootstrap",session},30000,{retries:1,retryLogical:true});}
  // Transaction aggregation may trigger the fixed-expense sync before reading
  // recent records.  It is read-only and can exceed the generic 15s timeout
  // when Apps Script is cold, so allow one safe retry instead of leaving the
  // Receive/Pay list in its perpetual loading state.
  expenseTransactions(session){return this.request({action:"expenseTransactions",session},45000,{retries:1,retryLogical:true});}
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
  settingsBootstrap(session){return this.request({action:"settingsBootstrap",session},30000,{retries:1,retryLogical:true});}
  settingsSaveConfig(session,data){return this.request({action:"settingsSaveConfig",session,data},30000);}
  settingsSaveUser(session,data){return this.request({action:"settingsSaveUser",session,data},30000);}
  settingsSaveEmployee(session,data){return this.request({action:"settingsSaveEmployee",session,data},30000);}
  settingsSavePackaging(session,data){return this.request({action:"settingsSavePackaging",session,data},30000);}
  settingsSaveWage(session,data){return this.request({action:"settingsSaveWage",session,data},30000);}
  settingsAddOption(session,data){return this.request({action:"settingsAddOption",session,data},30000);}
  settingsEditOption(session,data){return this.request({action:"settingsEditOption",session,data},30000);}
  settingsDeleteOption(session,row){return this.request({action:"settingsDeleteOption",session,row},30000);}
  settingsToggleMaterial(session,row){return this.request({action:"settingsToggleMaterial",session,row},30000);}
  settingsStoreLayout(session){return this.request({action:"settingsStoreLayout",session},30000);}
  settingsSaveStoreLayout(session,data){return this.request({action:"settingsSaveStoreLayout",session,data},30000);}
  settingsSaveLocation(session,data){return this.request({action:"settingsSaveLocation",session,data},30000);}
  settingsResetDevice(session,workerName){return this.request({action:"settingsResetDevice",session,workerName},30000);}
  settingsClearCache(session){return this.request({action:"settingsClearCache",session},30000);}
  settingsUploadLogo(session,data,fileName){return this.request({action:"settingsUploadLogo",session,data,fileName},60000);}
  settingsUploadEmployee(session,data,fileName){return this.request({action:"settingsUploadEmployee",session,data,fileName},60000);}
  settingsUploadPackaging(session,data,fileName){return this.request({action:"settingsUploadPackaging",session,data,fileName},60000);}
  settingsWebAppUrl(session){return this.request({action:"settingsWebAppUrl",session},30000);}
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
