// ═══════════════════════════════════════════════════════════════
// 39_WageCore.gs — pure wage-summary calculation shared by GAS and the PWA
//
// This file is copied byte-for-byte to pwa-publish/js/wage-core.js
// (tools/sync-wage-core, checked by tests/wage-core-sync.test.mjs). It must
// never touch SpreadsheetApp, Utilities or the DOM: callers pass raw sheet
// rows (Date cells as Date objects in Asia/Bangkok local time) and receive
// the same structure getWageSummary() has always returned. Keeping one copy
// of the formula is what allows the PWA to calculate wages on the device.
// ═══════════════════════════════════════════════════════════════
var WageCore=(function(){
  var TZ_OFFSET_MINUTES=-420; // Asia/Bangkok, no DST

  function pad_(n){return (n<10?"0":"")+n;}
  // Equivalent of Utilities.formatDate(date,"Asia/Bangkok",pattern) for the
  // patterns used here, relying on the runtime's local zone being Bangkok
  // (GAS: script time zone; PWA: checked by isSupportedRuntime()).
  function formatDate(date,pattern){
    var y=date.getFullYear(),m=pad_(date.getMonth()+1),d=pad_(date.getDate());
    if(pattern==="yyyy-MM-dd")return y+"-"+m+"-"+d;
    if(pattern==="dd/MM/yyyy")return d+"/"+m+"/"+y;
    if(pattern==="dd/MM/yyyy HH:mm")return d+"/"+m+"/"+y+" "+pad_(date.getHours())+":"+pad_(date.getMinutes());
    throw new Error("WageCore.formatDate: unsupported pattern "+pattern);
  }
  function isSupportedRuntime(){
    return new Date(2026,0,1).getTimezoneOffset()===TZ_OFFSET_MINUTES&&
      new Date(2026,6,1).getTimezoneOffset()===TZ_OFFSET_MINUTES;
  }
  // Same rules as parseWorkshopDate_.
  function parseDate(value){
    if(value instanceof Date){
      return new Date(value.getFullYear(),value.getMonth(),value.getDate());
    }
    var text=String(value||"").trim();
    var match=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!match)return null;
    var date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));
    if(date.getFullYear()!==Number(match[1])||date.getMonth()!==Number(match[2])-1||date.getDate()!==Number(match[3]))return null;
    return date;
  }
  function periodKey(start,end){return formatDate(start,"yyyy-MM-dd")+"|"+formatDate(end,"yyyy-MM-dd");}
  function parsePeriodKey(value){
    var parts=String(value||"").split("|");
    if(parts.length!==2)return null;
    var start=parseDate(parts[0]),end=parseDate(parts[1]);
    if(!start||!end)return null;
    return {start:start,end:end};
  }
  function hasOverride(value){return value!==""&&value!==null&&value!==undefined;}

  // Same as getWorkshopWageValues_.
  function wageValues(job){
    var productionQty=Number(job[6])||0;
    var originalRate=Number(job[7])||0;
    var originalStickerQty=Number(job[18])||0;
    var originalStickerRate=Number(job[19])||0;
    var wageQty=hasOverride(job[25])?Number(job[25]):productionQty;
    var wageRate=hasOverride(job[26])?Number(job[26]):originalRate;
    var stickerQty=hasOverride(job[27])?Number(job[27]):originalStickerQty;
    var stickerRate=hasOverride(job[28])?Number(job[28]):originalStickerRate;
    wageQty=isFinite(wageQty)&&wageQty>=0?wageQty:productionQty;
    wageRate=isFinite(wageRate)&&wageRate>=0?wageRate:originalRate;
    stickerQty=isFinite(stickerQty)&&stickerQty>=0?stickerQty:originalStickerQty;
    stickerRate=isFinite(stickerRate)&&stickerRate>=0?stickerRate:originalStickerRate;
    var writingTotal=wageQty*wageRate;
    var stickerTotal=stickerQty*stickerRate;
    return {
      productionQty:productionQty,originalRate:originalRate,originalStickerQty:originalStickerQty,
      originalStickerRate:originalStickerRate,wageQty:wageQty,wageRate:wageRate,stickerQty:stickerQty,
      stickerRate:stickerRate,writingTotal:writingTotal,stickerTotal:stickerTotal,total:writingTotal+stickerTotal,
      hasOverride:hasOverride(job[25])||hasOverride(job[26])||hasOverride(job[27])||hasOverride(job[28]),
      reason:String(job[29]||""),editor:String(job[30]||""),
      editedAt:job[31] instanceof Date?formatDate(job[31],"dd/MM/yyyy HH:mm"):String(job[31]||"")
    };
  }

  // Same as readWorkshopEmployeeSocialSecurityMap_ (rows from row 2, 15 cols).
  function socialMap(employeeRows){
    var map={};
    for(var i=0;i<(employeeRows||[]).length;i++){
      var row=employeeRows[i];
      var name=String(row[1]||"").trim();
      if(!name)continue;
      var rate=Number(row[13]);
      if(!isFinite(rate)||rate<=0)rate=5;
      var startDate=row[14] instanceof Date
        ?new Date(row[14].getFullYear(),row[14].getMonth(),row[14].getDate())
        :parseDate(row[14]);
      map[name]={enabled:String(row[12]||"").trim()==="ใช่",rate:rate,startDate:startDate};
    }
    return map;
  }
  function socialEligible(info,date){
    if(!info||!info.enabled||!(date instanceof Date))return false;
    if(!info.startDate)return true;
    var target=new Date(date.getFullYear(),date.getMonth(),date.getDate());
    return target.getTime()>=info.startDate.getTime();
  }

  // Piece-work and daily-work part of getWageSummary. start/end are Dates
  // already normalised to 00:00:00.000 and 23:59:59.999.
  function buildSummary(input,periodStartDate,periodEndDate,employeeSocialMap){
    var result={pieceWork:[],dailyWork:[],monthly:[],advanceWageByWorker:{},
      wagePeriodStatus:{status:"not_saved",hasSaved:false,isChanged:false,savedNetPaid:0,latestNetPaid:0,difference:0,changedWorkerCount:0,changedWorkers:[]}};
    var whitewareMap=input.whitewareMap||{},patternMap=input.patternMap||{};
    var jobData=input.jobs||[];
    if(jobData.length){
      var pieceMap={};
      for(var i=0;i<jobData.length;i++){
        var job=jobData[i];
        var worker=String(job[1]||"").trim();
        var status=String(job[13]||"").trim();
        if(!worker)continue;
        if(!pieceMap[worker]){
          pieceMap[worker]={name:worker,jobs:0,pieces:0,goodPieces:0,damagedPieces:0,completedTotal:0,pendingJobs:0,
            pendingPieces:0,pendingTotal:0,expectedTotal:0,socialSecurityBase:0,completedItems:[]};
        }
        var summary=pieceMap[worker];
        var values=wageValues(job);
        var receiveQty=Number(job[11])||0;
        var damagedQty=Number(job[16])||0;
        var receiveDate=job[10];
        var whitewareSku=String(job[17]||"").trim();
        var whitewareInfo=whitewareMap[whitewareSku]||null;
        var whitewareName=whitewareInfo?String(whitewareInfo.name||"").trim():"";
        var isCompleted=status.indexOf("เสร็จ")>=0||status.indexOf("ส่งลงสีต่อ")>=0||status.indexOf("ส่งงาน Preorder")>=0||status.indexOf("ชำรุด")>=0;
        var isPending=status.indexOf("รอรับ")>=0||status.indexOf("ส่งกลับ")>=0;
        if(isCompleted&&receiveDate instanceof Date&&receiveDate.getTime()>=periodStartDate.getTime()&&receiveDate.getTime()<=periodEndDate.getTime()){
          summary.jobs++;
          summary.pieces+=values.wageQty;
          summary.goodPieces+=receiveQty;
          summary.damagedPieces+=damagedQty;
          summary.completedTotal+=values.total;
          if(socialEligible(employeeSocialMap[worker],receiveDate))summary.socialSecurityBase+=values.total;
          summary.completedItems.push({
            rowIdx:i+2,receiveDate:formatDate(receiveDate,"dd/MM/yyyy"),step:String(job[2]||""),product:String(job[3]||""),
            whitewareSku:whitewareSku,whitewareName:whitewareName,size:String(job[4]||""),
            // Worker-app jobs keep the worker-entered pattern (see getWageSummary history).
            pattern:String(patternMap[String(job[32]||"").trim()]||job[5]||""),
            jobQty:values.wageQty,productionQty:values.productionQty,goodQty:receiveQty,damagedQty:damagedQty,
            priceEach:values.wageRate,writingTotal:values.writingTotal,stickerQty:values.stickerQty,stickerRate:values.stickerRate,
            stickerTotal:values.stickerTotal,total:values.total,destination:String(job[21]||"เข้าร้าน"),preorderNo:String(job[22]||""),
            wageOverride:values.hasOverride,wageEditReason:values.reason,wageEditor:values.editor,wageEditedAt:values.editedAt
          });
        }
        if(isPending){
          summary.pendingJobs++;
          summary.pendingPieces+=Number(job[6])||0;
          summary.pendingTotal+=Number(job[8])||0;
        }
      }
      var workerNames=Object.keys(pieceMap).sort(function(a,b){return a.localeCompare(b,"th");});
      for(var p=0;p<workerNames.length;p++){
        var piece=pieceMap[workerNames[p]];
        piece.completedItems.sort(function(a,b){
          var dateCompare=String(a.receiveDate).localeCompare(String(b.receiveDate));
          if(dateCompare!==0)return dateCompare;
          return String(a.whitewareName||a.product).localeCompare(String(b.whitewareName||b.product),"th");
        });
        piece.expectedTotal=piece.completedTotal+piece.pendingTotal;
        piece.total=piece.completedTotal;
        if(piece.jobs>0||piece.pendingJobs>0)result.pieceWork.push(piece);
      }
    }
    var attendanceData=input.attendance||[];
    if(attendanceData.length){
      var dailyMap={};
      for(var a=0;a<attendanceData.length;a++){
        var row=attendanceData[a];
        var attendanceDate=row[0];
        if(!(attendanceDate instanceof Date))continue;
        if(attendanceDate.getTime()<periodStartDate.getTime()||attendanceDate.getTime()>periodEndDate.getTime())continue;
        if(String(row[3]||"").trim()!=="มา")continue;
        var name=String(row[1]||"").trim();
        var rate=Number(row[4])||0;
        var overtimePay=Number(row[11])||0;
        var dayFactor=Number(row[12])===0.5?0.5:1;
        if(!name)continue;
        if(!dailyMap[name])dailyMap[name]={name:name,days:0,total:0,normalTotal:0,socialSecurityBase:0,rate:rate,ot:0};
        dailyMap[name].days+=dayFactor;
        dailyMap[name].normalTotal+=rate*dayFactor;
        dailyMap[name].total+=rate*dayFactor+overtimePay;
        dailyMap[name].ot+=overtimePay;
        if(socialEligible(employeeSocialMap[name],attendanceDate))dailyMap[name].socialSecurityBase+=rate*dayFactor;
      }
      var dailyNames=Object.keys(dailyMap).sort(function(a,b){return a.localeCompare(b,"th");});
      for(var d=0;d<dailyNames.length;d++)result.dailyWork.push(dailyMap[dailyNames[d]]);
    }
    return result;
  }

  // Same as buildWorkshopWageMap_.
  function wageMap(summary){
    var map={};
    var pieceWork=summary&&Array.isArray(summary.pieceWork)?summary.pieceWork:[];
    var dailyWork=summary&&Array.isArray(summary.dailyWork)?summary.dailyWork:[];
    function ensure(worker){
      if(!map[worker])map[worker]={worker:worker,pieceTotal:0,dailyTotal:0,dailyNormalTotal:0,overtimeTotal:0,socialSecurityBase:0,wageTotal:0};
      return map[worker];
    }
    for(var i=0;i<pieceWork.length;i++){
      var piece=pieceWork[i]||{},worker=String(piece.name||"").trim();
      if(!worker)continue;
      var item=ensure(worker);
      item.pieceTotal+=Number(piece.completedTotal)||0;
      item.socialSecurityBase+=Number(piece.socialSecurityBase)||0;
    }
    for(var j=0;j<dailyWork.length;j++){
      var daily=dailyWork[j]||{},dailyWorker=String(daily.name||"").trim();
      if(!dailyWorker)continue;
      var dailyItem=ensure(dailyWorker);
      dailyItem.dailyTotal+=Number(daily.total)||0;
      dailyItem.dailyNormalTotal+=Number(daily.normalTotal)||0;
      dailyItem.overtimeTotal+=Number(daily.ot)||0;
      dailyItem.socialSecurityBase+=Number(daily.socialSecurityBase)||0;
    }
    var workers=Object.keys(map);
    for(var k=0;k<workers.length;k++){var wage=map[workers[k]];wage.wageTotal=wage.pieceTotal+wage.dailyTotal;}
    return map;
  }

  // Same as getExistingAutoWageWorkers_ (payment rows, 14 cols).
  function existingAutoWageWorkers(paymentRows,key){
    var workers={};
    for(var i=0;i<(paymentRows||[]).length;i++){
      var row=paymentRows[i];
      if(String(row[2]||"").trim()==="AUTO-WAGE"&&String(row[3]||"").trim()===key&&String(row[1]||"").trim())workers[String(row[1]||"").trim()]=true;
    }
    return workers;
  }

  // Same as getAdvanceWageMapForPeriod_ (expense rows 12 cols, payment rows).
  function advanceMap(expenseRows,paymentRows,periodStart,periodEnd,currentPeriodKey,config){
    var map={};
    for(var e=0;e<(expenseRows||[]).length;e++){
      var expense=expenseRows[e];
      var expenseDate=expense[0];
      if(!(expenseDate instanceof Date))continue;
      if(expenseDate.getTime()>periodEnd.getTime())continue;
      var category=String(expense[2]||"").trim();
      var reference=String(expense[11]||"").trim();
      if(category!==config.advanceCategory||reference.indexOf(config.advancePrefix)!==0)continue;
      var worker=reference.substring(config.advancePrefix.length).trim();
      var amount=Number(expense[4])||0;
      if(!worker||amount<=0)continue;
      if(!map[worker])map[worker]={worker:worker,totalAdvance:0,deductedBefore:0,balanceBefore:0};
      map[worker].totalAdvance+=amount;
    }
    for(var p=0;p<(paymentRows||[]).length;p++){
      var payment=paymentRows[p];
      var paymentWorker=String(payment[1]||"").trim();
      var paymentPeriod=String(payment[3]||"").trim();
      var paymentType=String(payment[2]||"").trim();
      var deducted=Number(payment[9])||0;
      if(!paymentWorker||(paymentType!=="AUTO-WAGE"&&paymentType!==config.settlementType)||paymentPeriod===currentPeriodKey||deducted<=0)continue;
      var parsed=parsePeriodKey(paymentPeriod);
      if(!parsed||parsed.end.getTime()>=periodStart.getTime())continue;
      if(!map[paymentWorker])map[paymentWorker]={worker:paymentWorker,totalAdvance:0,deductedBefore:0,balanceBefore:0};
      map[paymentWorker].deductedBefore+=deducted;
    }
    var workers=Object.keys(map);
    for(var w=0;w<workers.length;w++){var item=map[workers[w]];item.balanceBefore=Math.max(0,item.totalAdvance-item.deductedBefore);}
    return map;
  }

  // Same as calculateAutomaticWageData_ once its sheets have been read.
  function calculateAutomatic(summary,periodStart,periodEnd,input,employeeSocialMap){
    var key=periodKey(periodStart,periodEnd);
    var wages=wageMap(summary);
    var oldWorkers=existingAutoWageWorkers(input.payments,key);
    var advances=advanceMap(input.expenses,input.payments,periodStart,periodEnd,key,input.config);
    var names={};
    Object.keys(wages).forEach(function(name){names[name]=true;});
    Object.keys(oldWorkers).forEach(function(name){names[name]=true;});
    var finalMap={};
    var workers=Object.keys(names).sort(function(a,b){return a.localeCompare(b,"th");});
    for(var i=0;i<workers.length;i++){
      var worker=workers[i];
      var wageInfo=wages[worker]||{pieceTotal:0,dailyTotal:0,dailyNormalTotal:0,overtimeTotal:0,socialSecurityBase:0,wageTotal:0};
      var wageTotal=Math.max(0,Number(wageInfo.wageTotal)||0);
      var socialInfo=employeeSocialMap[worker]||{enabled:false,rate:0,startDate:null};
      var socialBase=socialInfo.enabled?Math.max(0,Number(wageInfo.socialSecurityBase)||0):0;
      var socialRate=socialInfo.enabled?Number(socialInfo.rate)||5:0;
      var socialDeducted=socialInfo.enabled?Math.round(socialBase*socialRate/100):0;
      socialDeducted=Math.min(wageTotal,Math.max(0,socialDeducted));
      var advanceInfo=advances[worker]||{totalAdvance:0,deductedBefore:0,balanceBefore:0};
      var advanceBefore=Math.max(0,Number(advanceInfo.balanceBefore)||0);
      var wageAfterSocial=Math.max(0,wageTotal-socialDeducted);
      var advanceDeducted=Math.min(wageAfterSocial,advanceBefore);
      var advanceAfter=Math.max(0,advanceBefore-advanceDeducted);
      var netPaid=Math.max(0,wageAfterSocial-advanceDeducted);
      finalMap[worker]={worker:worker,periodKey:key,periodStart:periodStart,periodEnd:periodEnd,
        pieceTotal:Number(wageInfo.pieceTotal)||0,dailyTotal:Number(wageInfo.dailyTotal)||0,
        dailyNormalTotal:Number(wageInfo.dailyNormalTotal)||0,overtimeTotal:Number(wageInfo.overtimeTotal)||0,
        wageTotal:wageTotal,totalAdvance:Number(advanceInfo.totalAdvance)||0,deductedBefore:Number(advanceInfo.deductedBefore)||0,
        balanceBefore:advanceBefore,deductedThisPeriod:advanceDeducted,balance:advanceAfter,
        socialSecurityEnabled:Boolean(socialInfo.enabled),socialSecurityRate:socialRate,socialSecurityBase:socialBase,
        socialSecurityDeducted:socialDeducted,netPaid:netPaid};
    }
    return {periodKey:key,workers:finalMap};
  }

  // Same as prepareWageWorkersForClient_.
  function prepareWorkers(workers){
    var source=workers||{},result={},names=Object.keys(source);
    for(var i=0;i<names.length;i++){
      var name=names[i],item=source[name]||{};
      result[name]={worker:String(item.worker||name),periodKey:String(item.periodKey||""),
        periodStart:item.periodStart instanceof Date?formatDate(item.periodStart,"yyyy-MM-dd"):String(item.periodStart||""),
        periodEnd:item.periodEnd instanceof Date?formatDate(item.periodEnd,"yyyy-MM-dd"):String(item.periodEnd||""),
        pieceTotal:Number(item.pieceTotal)||0,dailyTotal:Number(item.dailyTotal)||0,dailyNormalTotal:Number(item.dailyNormalTotal)||0,
        overtimeTotal:Number(item.overtimeTotal)||0,wageTotal:Number(item.wageTotal)||0,totalAdvance:Number(item.totalAdvance)||0,
        deductedBefore:Number(item.deductedBefore)||0,balanceBefore:Number(item.balanceBefore)||0,
        deductedThisPeriod:Number(item.deductedThisPeriod)||0,balance:Number(item.balance)||0,
        socialSecurityEnabled:Boolean(item.socialSecurityEnabled),socialSecurityRate:Number(item.socialSecurityRate)||0,
        socialSecurityBase:Number(item.socialSecurityBase)||0,socialSecurityDeducted:Number(item.socialSecurityDeducted)||0,
        netPaid:Number(item.netPaid)||0};
    }
    return result;
  }

  // Same as getWorkshopWagePeriodStatus_ once its payment rows are read.
  function periodStatus(paymentRows,calculated){
    var key=String(calculated&&calculated.periodKey||"");
    var workers=calculated&&calculated.workers?calculated.workers:{};
    var expectedNames=Object.keys(workers),savedByWorker={},duplicateWorkers={},savedTotal=0;
    for(var i=0;i<(paymentRows||[]).length;i++){
      var row=paymentRows[i];
      var type=String(row[2]||"").trim(),rowPeriod=String(row[3]||"").trim(),worker=String(row[1]||"").trim();
      if(type!=="AUTO-WAGE"||rowPeriod!==key||!worker)continue;
      if(savedByWorker[worker])duplicateWorkers[worker]=true;
      savedByWorker[worker]={worker:worker,wageTotal:Number(row[4])||0,netPaid:Number(row[5])||0,advanceDeducted:Number(row[9])||0,
        advanceBalance:Number(row[10])||0,socialSecurityBase:Number(row[11])||0,socialSecurityRate:Number(row[12])||0,
        socialSecurityDeducted:Number(row[13])||0};
    }
    var savedNames=Object.keys(savedByWorker),hasSaved=savedNames.length>0,changedWorkers=[],latestTotal=0;
    for(var e=0;e<expectedNames.length;e++){
      var name=expectedNames[e],latest=workers[name]||{},saved=savedByWorker[name];
      latestTotal+=Number(latest.netPaid)||0;
      if(!saved){changedWorkers.push(name);continue;}
      savedTotal+=Number(saved.netPaid)||0;
      var changed=Math.abs((Number(saved.wageTotal)||0)-(Number(latest.wageTotal)||0))>0.001||
        Math.abs((Number(saved.netPaid)||0)-(Number(latest.netPaid)||0))>0.001||
        Math.abs((Number(saved.advanceDeducted)||0)-(Number(latest.deductedThisPeriod)||0))>0.001||
        Math.abs((Number(saved.advanceBalance)||0)-(Number(latest.balance)||0))>0.001||
        Math.abs((Number(saved.socialSecurityBase)||0)-(Number(latest.socialSecurityBase)||0))>0.001||
        Math.abs((Number(saved.socialSecurityRate)||0)-(Number(latest.socialSecurityRate)||0))>0.001||
        Math.abs((Number(saved.socialSecurityDeducted)||0)-(Number(latest.socialSecurityDeducted)||0))>0.001;
      if(changed||duplicateWorkers[name])changedWorkers.push(name);
    }
    for(var s=0;s<savedNames.length;s++){
      var savedName=savedNames[s];
      if(!workers.hasOwnProperty(savedName)){savedTotal+=Number(savedByWorker[savedName].netPaid)||0;changedWorkers.push(savedName);}
    }
    if(!hasSaved)savedTotal=0;
    var isChanged=hasSaved&&changedWorkers.length>0;
    return {status:!hasSaved?"not_saved":isChanged?"changed":"saved",hasSaved:hasSaved,isChanged:isChanged,periodKey:key,
      savedWorkerCount:savedNames.length,latestWorkerCount:expectedNames.length,changedWorkerCount:changedWorkers.length,
      changedWorkers:changedWorkers,savedNetPaid:savedTotal,latestNetPaid:latestTotal,difference:latestTotal-savedTotal};
  }

  // View-only getWageSummary(start,end,false) from raw rows.
  function summarize(input,periodStart,periodEnd){
    var start=parseDate(periodStart),end=parseDate(periodEnd);
    var empty={pieceWork:[],dailyWork:[],monthly:[],advanceWageByWorker:{},
      wagePeriodStatus:{status:"not_saved",hasSaved:false,isChanged:false,savedNetPaid:0,latestNetPaid:0,difference:0,changedWorkerCount:0,changedWorkers:[]}};
    if(!start||!end)return empty;
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
    var social=socialMap(input.employees);
    var result=buildSummary(input,start,end,social);
    var key=periodKey(start,end);
    try{
      var preview=calculateAutomatic(result,start,end,input,social);
      result.advanceWageByWorker=prepareWorkers(preview.workers);
      result.wagePeriodStatus=periodStatus(input.payments,preview);
      result.wageExpenseSync={success:true,synced:false,viewOnly:true,periodKey:preview.periodKey||key};
    }catch(previewError){
      result.advanceWageByWorker={};
      result.wageExpenseSync={success:false,synced:false,viewOnly:true,periodKey:key,
        message:String(previewError&&previewError.message?previewError.message:previewError)};
    }
    return result;
  }

  return {version:1,isSupportedRuntime:isSupportedRuntime,formatDate:formatDate,parseDate:parseDate,periodKey:periodKey,
    parsePeriodKey:parsePeriodKey,wageValues:wageValues,socialMap:socialMap,socialEligible:socialEligible,
    buildSummary:buildSummary,wageMap:wageMap,existingAutoWageWorkers:existingAutoWageWorkers,advanceMap:advanceMap,
    calculateAutomatic:calculateAutomatic,prepareWorkers:prepareWorkers,periodStatus:periodStatus,summarize:summarize};
})();
if(typeof globalThis!=="undefined")globalThis.WageCore=WageCore;
