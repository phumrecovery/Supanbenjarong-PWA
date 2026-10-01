// ═══════════════════════════════════════════════════════════════
// 41_ReportCore.gs — pure Dashboard calculation shared by GAS and the PWA
//
// This file is copied byte-for-byte to pwa-publish/js/report-core.js
// (tools/sync-wage-core, checked by tests/wage-core-sync.test.mjs). It must
// never touch SpreadsheetApp, Utilities or the DOM: callers pass raw sheet
// rows (Date cells as Date objects in Asia/Bangkok local time, see
// readReportCoreInput_ in 42_ReportSnapshot.gs) and receive the structures
// 14_Report.gs has always returned. Labour cost uses WageCore.wageValues.
// ═══════════════════════════════════════════════════════════════
var ReportCore=(function(){
  var VERSION=1;
  var DAYS_TH=["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  var MONTHS_TH=["","มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  var MONTHS_SHORT_TH=["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

  function pad_(n){return (n<10?"0":"")+n;}
  // Utilities.formatDate(date,"Asia/Bangkok",pattern) for the patterns used
  // here; the runtime's local zone is Bangkok (GAS script zone; the PWA
  // checks WageCore.isSupportedRuntime()).
  function fmt(date,pattern){
    if(pattern==="yyyy-MM-dd")return date.getFullYear()+"-"+pad_(date.getMonth()+1)+"-"+pad_(date.getDate());
    if(pattern==="HH:mm")return pad_(date.getHours())+":"+pad_(date.getMinutes());
    if(pattern==="dd/MM")return pad_(date.getDate())+"/"+pad_(date.getMonth()+1);
    throw new Error("ReportCore.fmt: unsupported pattern "+pattern);
  }
  function dayStart(value){var d=new Date(value);d.setHours(0,0,0,0);return d;}
  function formatDateTH(d){
    return "วัน"+DAYS_TH[d.getDay()]+"ที่ "+d.getDate()+" "+MONTHS_TH[d.getMonth()+1]+" "+(d.getFullYear()+543);
  }
  function monthNameTH(m){return MONTHS_SHORT_TH[m]||"";}
  function isDelivered(status){
    return status==="ส่งแล้ว"||status==="ส่งมอบแล้ว"||status==="เสร็จ"||status==="เสร็จแล้ว";
  }

  // ── parsed once per input object, each part on first use (GAS reads a
  // sheet only when a report touches it) ──
  var prepared=typeof WeakMap!=="undefined"?new WeakMap():null;
  function prep(input){
    var hit=prepared&&prepared.get(input);
    if(hit)return hit;
    var p={costs:null,cache:{}};
    p.get=function(name){
      if(!(name in p.cache)){
        p.cache[name]=name==="materialSet"?materialSet(input):
          name==="sales"?parseSales(input):
          name==="expenses"?parseExpenses(input,p.get("materialSet")):
          name==="preorder"?parsePreorderIncome(input):parsePreorderCash(input);
      }
      return p.cache[name];
    };
    if(prepared)prepared.set(input,p);
    return p;
  }
  function materialSet(input){
    var set={},mats=input.materialCategories||[];
    for(var i=0;i<mats.length;i++)set[String(mats[i])]=true;
    return set;
  }

  // Same rules as readSales_.
  function parseSales(input){
    var data=input.sales||[],out=[];
    for(var i=0;i<data.length;i++){
      var row=data[i];
      if(!(row[0] instanceof Date))continue;
      var billStatus=String(row[16]||"").trim();
      var channel=String(row[3]||"").trim();
      if(billStatus==="ยกเลิก"||channel==="ยกเลิกบิล")continue;
      out.push({day:dayStart(row[0]).getTime(),rec:{
        date:new Date(row[0]),time:row[1],billNo:String(row[2]||""),channel:channel,
        customer:String(row[4]||""),itemsJSON:String(row[5]||"[]"),pcs:Number(row[6])||0,
        gross:Number(row[7])||0,itemDiscount:Number(row[8])||0,totalDiscount:Number(row[9])||0,
        packageTotal:Number(row[10])||0,net:Number(row[11])||0,payment:String(row[12]||""),
        seller:String(row[13]||""),note:String(row[14]||""),shipping:Number(row[15])||0,status:billStatus
      }});
    }
    return out;
  }
  // Same rules as readExpenses_.
  function parseExpenses(input,matSet){
    var data=input.expenses||[],out=[];
    matSet=matSet||{};
    for(var i=0;i<data.length;i++){
      var dateValue=data[i][0];
      if(!(dateValue instanceof Date))continue;
      var direction=String(data[i][1]||"").trim();
      var category=String(data[i][2]||"");
      out.push({day:dayStart(dateValue).getTime(),rec:{
        date:new Date(dateValue),direction:direction,category:category,desc:String(data[i][3]||""),
        amount:Number(data[i][4])||0,isIncome:direction==="รายรับ",isExpense:direction==="รายจ่าย",
        isMaterial:direction==="รายจ่าย"&&matSet[category]===true
      }});
    }
    return out;
  }
  // Same rules as readPreorderIncome_ (reads min(21,lastColumn) columns).
  function parsePreorderIncome(input){
    var data=input.preorder||[],width=Math.min(21,Number(input.preorderColumns)||0),out=[];
    for(var i=0;i<data.length;i++){
      var row=data[i];
      var status=String(cell(row,12,width)||"").trim();
      if(!isDelivered(status))continue;
      var dateValue=cell(row,11,width);
      if(!(dateValue instanceof Date))continue;
      var amount=Number(cell(row,5,width))||0;
      if(amount<=0)continue;
      var items=String(cell(row,3,width)||"[]");
      out.push({day:dayStart(dateValue).getTime(),rec:{
        date:new Date(dateValue),time:fmt(dateValue,"HH:mm"),poNo:String(cell(row,0,width)||""),
        customer:String(cell(row,2,width)||""),items:items,pcs:Number(cell(row,4,width))||sumItemQty(items),
        net:amount,receiptNo:String(cell(row,20,width)||"").trim(),status:status
      }});
    }
    return out;
  }
  function cell(row,index,width){return index<width?row[index]:undefined;}
  // Same rules as readPreorderCashFlow_ (needs all 26 columns).
  function parsePreorderCash(input){
    var data=input.preorder||[],out=[];
    if(!(Number(input.preorderColumns)>=26))return out;
    for(var i=0;i<data.length;i++){
      var row=data[i];
      var poNo=String(row[0]||""),customer=String(row[2]||""),totalPrice=Number(row[5])||0;
      var agreedDeposit=Number(row[6])||0,sentDate=row[11],status=String(row[12]||"").trim();
      var receiptNo=String(row[20]||"").trim(),depositNo=String(row[24]||"").trim(),depositDate=row[25];
      var depositConfirmed=agreedDeposit>0&&depositNo!==""&&depositDate instanceof Date;
      if(depositConfirmed){
        out.push({day:dayStart(depositDate).getTime(),rec:{date:new Date(depositDate),poNo:poNo,customer:customer,
          amount:agreedDeposit,type:"deposit",documentNo:depositNo}});
      }
      if(isDelivered(status)&&sentDate instanceof Date){
        var amountAtDelivery=Math.max(0,totalPrice-(depositConfirmed?agreedDeposit:0));
        if(amountAtDelivery>0){
          out.push({day:dayStart(sentDate).getTime(),rec:{date:new Date(sentDate),poNo:poNo,customer:customer,
            amount:amountAtDelivery,type:"remaining",documentNo:receiptNo}});
        }
      }
    }
    return out;
  }
  function inRange(list,from,to){
    var a=from.getTime(),b=to.getTime(),out=[];
    for(var i=0;i<list.length;i++)if(list[i].day>=a&&list[i].day<=b)out.push(list[i].rec);
    return out;
  }
  function readSales(input,from,to){return inRange(prep(input).get("sales"),from,to);}
  function readExpenses(input,from,to){return inRange(prep(input).get("expenses"),from,to);}
  function readPreorderIncome(input,from,to){return inRange(prep(input).get("preorder"),from,to);}
  // readPreorderCashFlow_ keeps the PO's row order (deposit, then remaining).
  function readPreorderCashFlow(input,from,to){return inRange(prep(input).get("preorderCash"),from,to);}

  // ── item helpers (same as 14_Report.gs) ──
  function parseJSONList(value){
    if(Array.isArray(value))return value;
    try{var parsed=JSON.parse(String(value||"[]"));return Array.isArray(parsed)?parsed:[];}catch(e){return [];}
  }
  function getItemKey(item,prefix){
    var code=String(item.code||item.sku||"").trim();
    if(code)return (prefix||"")+code;
    return (prefix||"NAME:")+String(item.name||"-").trim();
  }
  function addProductToMap(map,item,prefix){
    var qty=Number(item.qty)||0;
    if(qty<=0)return;
    var price=Number(item.price)||0,discount=Number(item.disc)||0,unitNet=Math.max(0,price-discount);
    var key=getItemKey(item,prefix);
    if(!map[key])map[key]={code:String(item.code||item.sku||"").trim(),name:String(item.name||item.code||item.sku||"-"),qty:0,total:0};
    map[key].qty+=qty;
    map[key].total+=qty*unitNet;
  }
  function addPackageToMap(map,item){
    var packageCode=String(item.pkgCode||"").trim(),packageName=String(item.pkgName||"").trim();
    var packageQty=Number(item.pkgQty)||0;
    if(packageQty<=0||packageName===""||packageName==="ไม่ใส่แพ็คเกจ")return;
    var packageTotal=Number(item.pkgPrice)||0,packageUnitPrice=Number(item.pkgUnitPrice)||0;
    if(packageUnitPrice<=0&&packageTotal>0)packageUnitPrice=packageTotal/packageQty;
    addProductToMap(map,{code:packageCode,name:packageName,qty:packageQty,price:packageUnitPrice,disc:0},"PKG:");
  }
  function addItemsToMap(map,items,includePackages){
    var list=parseJSONList(items);
    for(var i=0;i<list.length;i++){
      var item=list[i]||{};
      addProductToMap(map,item,"");
      if(includePackages)addPackageToMap(map,item);
    }
  }
  function buildSaleItemList(items){
    var source=parseJSONList(items),result=[];
    for(var i=0;i<source.length;i++){
      var item=source[i]||{};
      var qty=Number(item.qty)||0,price=Number(item.price)||0,discount=Number(item.disc)||0;
      var unitNet=Math.max(0,price-discount);
      if(qty>0){
        result.push({code:String(item.code||item.sku||""),name:String(item.name||item.code||item.sku||"-"),
          qty:qty,price:price,discount:discount,unitNet:unitNet,total:qty*unitNet,type:"product"});
      }
      var packageName=String(item.pkgName||"").trim(),packageQty=Number(item.pkgQty)||0;
      if(packageQty>0&&packageName!==""&&packageName!=="ไม่ใส่แพ็คเกจ"){
        var packageTotal=Number(item.pkgPrice)||0,packageUnitPrice=Number(item.pkgUnitPrice)||0;
        if(packageUnitPrice<=0&&packageTotal>0)packageUnitPrice=packageTotal/packageQty;
        result.push({code:String(item.pkgCode||""),name:packageName,qty:packageQty,price:packageUnitPrice,discount:0,
          unitNet:packageUnitPrice,total:packageTotal>0?packageTotal:packageQty*packageUnitPrice,type:"package"});
      }
    }
    return result;
  }
  function sumItemQty(items){
    var list=parseJSONList(items),total=0;
    for(var i=0;i<list.length;i++)total+=Number(list[i].qty)||0;
    return total;
  }
  function formatSaleTime(value){
    if(value instanceof Date)return fmt(value,"HH:mm");
    var text=String(value||"").trim();
    if(!text)return "";
    var match=text.match(/^(\d{1,2}):(\d{2})/);
    if(!match)return "";
    return String(Number(match[1])).padStart(2,"0")+":"+match[2];
  }
  function mapToArr(map){
    var arr=[];
    for(var k in map)arr.push({name:k,value:map[k]});
    arr.sort(function(a,b){return b.value-a.value;});
    return arr;
  }
  function topN(map,n){
    var arr=[];
    for(var key in map)if(map.hasOwnProperty(key))arr.push(map[key]);
    arr.sort(function(a,b){
      var qtyDiff=(Number(b.qty)||0)-(Number(a.qty)||0);
      if(qtyDiff!==0)return qtyDiff;
      return (Number(b.total)||0)-(Number(a.total)||0);
    });
    return arr.slice(0,n);
  }

  // ── costs (same rules as getAllCosts_ and its readers) ──
  function getAllCosts(input){
    var p=prep(input);
    if(p.costs)return p.costs;
    var outsource=[],purchase=[],laborPiece=[],laborDaily=[],material=[],i,d,dateVal,amount;
    d=input.outsource||[];
    for(i=0;i<d.length;i++){
      var status=String(d[i][14]||"");
      dateVal=d[i][11];
      if(!(dateVal instanceof Date))continue;
      if(status.indexOf("รอรับ")>=0)continue;
      amount=Number(d[i][9])||0;
      if(amount<=0)continue;
      outsource.push({date:dateVal,dateStr:fmt(dateVal,"yyyy-MM-dd"),month:dateVal.getMonth(),year:dateVal.getFullYear(),
        amount:amount,desc:String(d[i][3]||""),vendor:String(d[i][1]||""),type:"outsource"});
    }
    d=input.purchase||[];
    for(i=0;i<d.length;i++){
      dateVal=d[i][0];
      if(!(dateVal instanceof Date))continue;
      amount=Number(d[i][7])||0;
      if(amount<=0)continue;
      purchase.push({date:dateVal,dateStr:fmt(dateVal,"yyyy-MM-dd"),month:dateVal.getMonth(),year:dateVal.getFullYear(),
        amount:amount,desc:String(d[i][3]||""),vendor:String(d[i][2]||""),type:"purchase"});
    }
    d=input.jobs||[];
    for(i=0;i<d.length;i++){
      var row=d[i]||{};
      var jobStatus=String(row[13]||"").trim();
      var completed=jobStatus.indexOf("เสร็จ")>=0||jobStatus.indexOf("ส่งลงสีต่อ")>=0||
        jobStatus.indexOf("ส่งงาน Preorder")>=0||jobStatus.indexOf("ชำรุด")>=0;
      if(!completed)continue;
      dateVal=row[10];
      if(!(dateVal instanceof Date))continue;
      var wageValues=WageCore.wageValues(row);
      amount=Number(wageValues.total)||0;
      if(amount<=0)continue;
      laborPiece.push({date:new Date(dateVal),dateStr:fmt(dateVal,"yyyy-MM-dd"),month:dateVal.getMonth(),year:dateVal.getFullYear(),
        amount:amount,desc:String(row[3]||""),worker:String(row[1]||""),step:String(row[2]||""),
        productionQty:Number(row[6])||0,wageQty:Number(wageValues.wageQty)||0,wageRate:Number(wageValues.wageRate)||0,
        wageOverride:Boolean(wageValues.hasOverride),type:"labor_piece"});
    }
    d=input.attendance||[];
    for(i=0;i<d.length;i++){
      if(String(d[i][3]||"").trim()!=="มา")continue;
      dateVal=d[i][0];
      if(!(dateVal instanceof Date))continue;
      var normalWage=Number(d[i][4])||0,overtimePay=Number(d[i][11])||0;
      var dayFactor=Number(d[i][12])===0.5?0.5:1;
      amount=normalWage*dayFactor+overtimePay;
      if(amount<=0)continue;
      laborDaily.push({date:new Date(dateVal),dateStr:fmt(dateVal,"yyyy-MM-dd"),month:dateVal.getMonth(),year:dateVal.getFullYear(),
        amount:amount,normalWage:normalWage*dayFactor,overtimePay:overtimePay,worker:String(d[i][1]||""),
        workerType:String(d[i][2]||""),type:"labor_daily"});
    }
    d=input.expenses||[];
    for(i=0;i<d.length;i++){
      dateVal=d[i][0];
      if(!(dateVal instanceof Date))continue;
      if(String(d[i][1]||"").trim()!=="รายจ่าย")continue;
      var cat=String(d[i][2]||"");
      if(p.get("materialSet")[cat]!==true)continue;
      amount=Number(d[i][4])||0;
      if(amount<=0)continue;
      material.push({date:dateVal,month:dateVal.getMonth(),year:dateVal.getFullYear(),amount:amount,
        desc:String(d[i][3]||""),vendor:cat,unit:String(d[i][8]||""),pricePerUnit:Number(d[i][9])||0,
        qty:Number(d[i][10])||0,type:"material"});
    }
    p.costs={outsource:outsource,purchase:purchase,laborPiece:laborPiece,laborDaily:laborDaily,material:material,
      all:outsource.concat(purchase).concat(laborPiece).concat(laborDaily).concat(material)};
    return p.costs;
  }
  function emptyCostSummary(){
    return {material:0,outsource:0,purchase:0,laborPiece:0,laborDaily:0,laborTotal:0,nonLaborTotal:0,total:0};
  }
  function addCost(result,cost){
    var amount=Number(cost.amount)||0;
    if(cost.type==="material")result.material+=amount;
    else if(cost.type==="outsource")result.outsource+=amount;
    else if(cost.type==="purchase")result.purchase+=amount;
    else if(cost.type==="labor_piece")result.laborPiece+=amount;
    else if(cost.type==="labor_daily")result.laborDaily+=amount;
  }
  function finishCost(result){
    result.laborTotal=result.laborPiece+result.laborDaily;
    result.nonLaborTotal=result.material+result.outsource+result.purchase;
    result.total=result.nonLaborTotal+result.laborTotal;
    return result;
  }
  function summarizeCosts(costs,startDate,endDate){
    var result=emptyCostSummary(),all=costs&&Array.isArray(costs.all)?costs.all:[];
    for(var i=0;i<all.length;i++){
      var cost=all[i]||{};
      if(!(cost.date instanceof Date)||cost.date<startDate||cost.date>endDate)continue;
      addCost(result,cost);
    }
    return finishCost(result);
  }
  function summarizeCostsMonthly(costs,year){
    var months=[],m,all=costs&&Array.isArray(costs.all)?costs.all:[];
    for(m=0;m<12;m++)months.push(emptyCostSummary());
    for(var i=0;i<all.length;i++){
      var cost=all[i]||{};
      if(cost.year!==year||cost.month<0||cost.month>11)continue;
      addCost(months[cost.month],cost);
    }
    for(m=0;m<12;m++)finishCost(months[m]);
    return months;
  }
  // Same as readRecurringExpense_: only generated FIXED: transactions count.
  function readRecurringExpense(input,year,month){
    var rows=input.expenses||[],prefix=String(input.fixedPrefix||"FIXED:"),total=0,items=[];
    for(var i=0;i<rows.length;i++){
      var row=rows[i],date=new Date(row[0]);
      if(date.getFullYear()!==Number(year)||date.getMonth()!==Number(month))continue;
      if(String(row[12]||"").indexOf(prefix)!==0)continue;
      var amount=Number(row[4])||0;
      total+=amount;
      items.push({name:String(row[3]||""),amount:amount,payTo:String(row[5]||"").replace(/^สร้างอัตโนมัติจากค่าใช้จ่ายประจำ\s*·?\s*จ่ายให้:\s*/,"")});
    }
    return {total:total,items:items};
  }
  function readInvestmentCost(input,startDate,endDate){
    var d=input.investment||[],total=0,items=[];
    for(var i=0;i<d.length;i++){
      if(!(d[i][0] instanceof Date))continue;
      var dateVal=dayStart(d[i][0]);
      if(dateVal<startDate||dateVal>endDate)continue;
      var amount=Number(d[i][3])||0;
      if(amount<=0)continue;
      total+=amount;
      items.push({date:fmt(dateVal,"dd/MM"),category:String(d[i][1]||""),desc:String(d[i][2]||""),amount:amount});
    }
    return {total:total,items:items};
  }
  function summarizeRecurringMonthly(input,year){
    var months=[];
    for(var m=0;m<12;m++)months.push(readRecurringExpense(input,year,m).total);
    return months;
  }
  function summarizeInvestmentMonthly(input,year){
    var months=[];
    for(var m=0;m<12;m++)months.push(readInvestmentCost(input,new Date(year,m,1),new Date(year,m+1,0,23,59,59)).total);
    return months;
  }

  // ═══════════ DAILY (getDailyReport) ═══════════
  function daily(input,dateStr){
    var target=dateStr?new Date(dateStr):new Date();
    target.setHours(0,0,0,0);
    var sales=readSales(input,target,target);
    var totalSales=0,billCount=0,channelMap={},payMap={},itemMap={},saleList=[],i;
    for(i=0;i<sales.length;i++){
      var r=sales[i];
      totalSales+=r.net;billCount++;
      channelMap[r.channel]=(channelMap[r.channel]||0)+r.net;
      payMap[r.payment]=(payMap[r.payment]||0)+r.net;
      saleList.push({time:formatSaleTime(r.time),billNo:r.billNo,items:r.itemsJSON,itemList:buildSaleItemList(r.itemsJSON),
        pcs:r.pcs,gross:r.gross,discount:r.totalDiscount,packageTotal:r.packageTotal,shipping:r.shipping,net:r.net,
        payment:r.payment,channel:r.channel});
      addItemsToMap(itemMap,r.itemsJSON,true);
    }
    var poList=readPreorderIncome(input,target,target);
    for(i=0;i<poList.length;i++){
      var po=poList[i];
      totalSales+=po.net;billCount++;
      saleList.push({time:po.time,billNo:po.poNo,items:po.items,itemList:buildSaleItemList(po.items),pcs:po.pcs,
        gross:po.net,discount:0,packageTotal:0,shipping:0,net:po.net,payment:"Preorder",channel:"Preorder"});
      channelMap["Preorder"]=(channelMap["Preorder"]||0)+po.net;
      payMap["Preorder"]=(payMap["Preorder"]||0)+po.net;
      addItemsToMap(itemMap,po.items,false);
    }
    var moneyEntries=readExpenses(input,target,target);
    var totalExpense=0,otherIncome=0,expList=[],incomeList=[],expCatMap={},incomeCatMap={};
    for(i=0;i<moneyEntries.length;i++){
      var entry=moneyEntries[i];
      if(entry.isIncome){
        otherIncome+=entry.amount;
        incomeList.push({cat:entry.category,desc:entry.desc,amount:entry.amount});
        incomeCatMap[entry.category]=(incomeCatMap[entry.category]||0)+entry.amount;
        continue;
      }
      if(!entry.isExpense||entry.isMaterial)continue;
      totalExpense+=entry.amount;
      expList.push({cat:entry.category,desc:entry.desc,amount:entry.amount});
      expCatMap[entry.category]=(expCatMap[entry.category]||0)+entry.amount;
    }
    var totalIncome=totalSales+otherIncome;
    return {
      date:fmt(target,"yyyy-MM-dd"),dateTH:formatDateTH(target),
      sales:{total:totalSales,bills:billCount,avg:billCount>0?Math.round(totalSales/billCount):0,
        channels:mapToArr(channelMap),payments:mapToArr(payMap),list:saleList},
      otherIncome:{total:otherIncome,categories:mapToArr(incomeCatMap),list:incomeList},
      totalIncome:totalIncome,
      expenses:{total:totalExpense,categories:mapToArr(expCatMap),list:expList},
      profit:totalIncome-totalExpense,
      topProducts:topN(itemMap,10)
    };
  }

  // ═══════════ MONTHLY (getMonthlyReport) ═══════════
  function monthly(input,year,month,now){
    now=now||new Date();
    var yr=Number(year)||now.getFullYear(),mn=Number(month)||(now.getMonth()+1);
    var from=new Date(yr,mn-1,1),to=new Date(yr,mn,0);
    from.setHours(0,0,0,0);to.setHours(23,59,59,999);
    var sales=readSales(input,from,to);
    var totalSales=0,billCount=0,channelMap={},payMap={},itemMap={},dailyMap={},i;
    function dayRow(day){if(!dailyMap[day])dailyMap[day]={sales:0,otherIncome:0,expense:0};return dailyMap[day];}
    for(i=0;i<sales.length;i++){
      var r=sales[i];
      totalSales+=r.net;billCount++;
      channelMap[r.channel]=(channelMap[r.channel]||0)+r.net;
      payMap[r.payment]=(payMap[r.payment]||0)+r.net;
      dayRow(r.date.getDate()).sales+=r.net;
      addItemsToMap(itemMap,r.itemsJSON,true);
    }
    var poList=readPreorderIncome(input,from,to);
    for(i=0;i<poList.length;i++){
      var po=poList[i];
      totalSales+=po.net;billCount++;
      channelMap["Preorder"]=(channelMap["Preorder"]||0)+po.net;
      payMap["Preorder"]=(payMap["Preorder"]||0)+po.net;
      addItemsToMap(itemMap,po.items,false);
      dayRow(po.date.getDate()).sales+=po.net;
    }
    var moneyEntries=readExpenses(input,from,to);
    var totalExpense=0,otherIncome=0,expCatMap={},incomeCatMap={};
    for(i=0;i<moneyEntries.length;i++){
      var entry=moneyEntries[i],day=dayRow(entry.date.getDate());
      if(entry.isIncome){
        otherIncome+=entry.amount;
        incomeCatMap[entry.category]=(incomeCatMap[entry.category]||0)+entry.amount;
        day.otherIncome+=entry.amount;
        continue;
      }
      if(!entry.isExpense||entry.isMaterial)continue;
      totalExpense+=entry.amount;
      expCatMap[entry.category]=(expCatMap[entry.category]||0)+entry.amount;
      day.expense+=entry.amount;
    }
    var totalIncome=totalSales+otherIncome;
    var daysInMonth=to.getDate(),dailyChart=[];
    for(var d=1;d<=daysInMonth;d++){
      var dd=dailyMap[d]||{sales:0,otherIncome:0,expense:0};
      dailyChart.push({day:d,sales:dd.sales,otherIncome:dd.otherIncome||0,income:dd.sales+(dd.otherIncome||0),expense:dd.expense});
    }
    var costs=getAllCosts(input);
    var costSummary=summarizeCosts(costs,from,to);
    var recurring=readRecurringExpense(input,yr,mn-1);
    var investment=readInvestmentCost(input,from,to);
    var totalCost=costSummary.total+recurring.total+investment.total;
    var cashCostTotal=costSummary.nonLaborTotal+investment.total;
    return {
      year:yr,month:mn,yearBE:yr+543,monthName:monthNameTH(mn),
      sales:{total:totalSales,bills:billCount,avg:billCount>0?Math.round(totalSales/billCount):0,
        channels:mapToArr(channelMap),payments:mapToArr(payMap)},
      otherIncome:{total:otherIncome,categories:mapToArr(incomeCatMap)},
      totalIncome:totalIncome,
      expenses:{total:totalExpense,categories:mapToArr(expCatMap)},
      cost:{material:costSummary.material,outsource:costSummary.outsource,purchase:costSummary.purchase,
        laborPiece:costSummary.laborPiece,laborDaily:costSummary.laborDaily,subtotal:costSummary.total,
        recurring:recurring,investment:investment,laborTotal:costSummary.laborTotal,
        nonLaborTotal:costSummary.nonLaborTotal,cashTotal:cashCostTotal,total:totalCost},
      profit:totalIncome-totalExpense,
      netProfit:totalIncome-totalExpense-cashCostTotal,
      topProducts:topN(itemMap,10),
      dailyChart:dailyChart
    };
  }

  // ═══════════ YEARLY (getYearlyReport) ═══════════
  function yearly(input,year,now){
    now=now||new Date();
    var yr=Number(year)||now.getFullYear();
    var from=new Date(yr,0,1),to=new Date(yr,11,31);
    from.setHours(0,0,0,0);to.setHours(23,59,59,999);
    var sales=readSales(input,from,to),expenses=readExpenses(input,from,to),monthlyData=[],m,i;
    for(m=1;m<=12;m++)monthlyData.push({month:m,name:monthNameTH(m),sales:0,otherIncome:0,income:0,expense:0,profit:0,bills:0});
    var yItemMap={},yChannelMap={},yPayMap={};
    for(i=0;i<sales.length;i++){
      var mn=sales[i].date.getMonth();
      monthlyData[mn].sales+=sales[i].net;monthlyData[mn].bills++;
      yChannelMap[sales[i].channel]=(yChannelMap[sales[i].channel]||0)+sales[i].net;
      yPayMap[sales[i].payment]=(yPayMap[sales[i].payment]||0)+sales[i].net;
      addItemsToMap(yItemMap,sales[i].itemsJSON,true);
    }
    var poList=readPreorderIncome(input,from,to);
    for(i=0;i<poList.length;i++){
      var po=poList[i],mn3=po.date.getMonth();
      monthlyData[mn3].sales+=po.net;monthlyData[mn3].bills++;
      yChannelMap["Preorder"]=(yChannelMap["Preorder"]||0)+po.net;
      yPayMap["Preorder"]=(yPayMap["Preorder"]||0)+po.net;
      addItemsToMap(yItemMap,po.items,false);
    }
    for(i=0;i<expenses.length;i++){
      var entry=expenses[i],entryMonth=entry.date.getMonth();
      if(entry.isIncome){monthlyData[entryMonth].otherIncome+=entry.amount;continue;}
      if(!entry.isExpense||entry.isMaterial)continue;
      monthlyData[entryMonth].expense+=entry.amount;
    }
    var totalSales=0,totalOtherIncome=0,totalIncome=0,totalExpense=0,totalBills=0;
    for(m=0;m<12;m++){
      monthlyData[m].income=monthlyData[m].sales+monthlyData[m].otherIncome;
      monthlyData[m].profit=monthlyData[m].income-monthlyData[m].expense;
      totalSales+=monthlyData[m].sales;totalOtherIncome+=monthlyData[m].otherIncome;
      totalIncome+=monthlyData[m].income;totalExpense+=monthlyData[m].expense;totalBills+=monthlyData[m].bills;
    }
    var costs=getAllCosts(input);
    var costMonthly=summarizeCostsMonthly(costs,yr);
    var recurringMonthly=summarizeRecurringMonthly(input,yr);
    var investmentMonthly=summarizeInvestmentMonthly(input,yr);
    var yearCostSummary=summarizeCosts(costs,from,to);
    var yearRecurring=0,yearInvestment=0;
    for(m=0;m<12;m++){
      monthlyData[m].cost=costMonthly[m].total+recurringMonthly[m]+investmentMonthly[m];
      monthlyData[m].cashCost=costMonthly[m].nonLaborTotal+investmentMonthly[m];
      monthlyData[m].costDetail={material:costMonthly[m].material,outsource:costMonthly[m].outsource,
        purchase:costMonthly[m].purchase,laborPiece:costMonthly[m].laborPiece,laborDaily:costMonthly[m].laborDaily,
        laborTotal:costMonthly[m].laborTotal,nonLaborTotal:costMonthly[m].nonLaborTotal,
        recurring:recurringMonthly[m],investment:investmentMonthly[m]};
      monthlyData[m].netProfit=monthlyData[m].income-monthlyData[m].expense-monthlyData[m].cashCost;
      yearRecurring+=recurringMonthly[m];yearInvestment+=investmentMonthly[m];
    }
    var totalCost=yearCostSummary.total+yearRecurring+yearInvestment;
    var totalCashCost=yearCostSummary.nonLaborTotal+yearInvestment;
    return {
      topProducts:topN(yItemMap,10),channels:mapToArr(yChannelMap),payments:mapToArr(yPayMap),
      year:yr,yearBE:yr+543,months:monthlyData,
      total:{sales:totalSales,otherIncome:totalOtherIncome,income:totalIncome,expense:totalExpense,cost:totalCost,
        costDetail:{material:yearCostSummary.material,outsource:yearCostSummary.outsource,purchase:yearCostSummary.purchase,
          laborPiece:yearCostSummary.laborPiece,laborDaily:yearCostSummary.laborDaily,laborTotal:yearCostSummary.laborTotal,
          nonLaborTotal:yearCostSummary.nonLaborTotal,recurring:yearRecurring,investment:yearInvestment},
        cashCost:totalCashCost,profit:totalIncome-totalExpense,netProfit:totalIncome-totalExpense-totalCashCost,bills:totalBills}
    };
  }

  // ═══════════ AVAILABLE YEARS (getAvailableYears) ═══════════
  function availableYears(input,now){
    now=now||new Date();
    var rows=input.sales||[],years={};
    for(var i=0;i<rows.length;i++)if(rows[i][0] instanceof Date)years[rows[i][0].getFullYear()]=1;
    var result=Object.keys(years).map(Number).sort();
    if(result.length===0)result.push(now.getFullYear());
    return result;
  }

  // ═══════════ PRINT (getPrintReport, month 0-based) ═══════════
  function print(input,year,month){
    var yr=Number(year),mn=Number(month);
    var from=new Date(yr,mn,1),to=new Date(yr,mn+1,0);
    from.setHours(0,0,0,0);to.setHours(23,59,59,999);
    var sales=readSales(input,from,to),expenses=readExpenses(input,from,to);
    var days={},totalIncome=0,totalExpense=0,i;
    function dayRow(day){if(!days[day])days[day]={income:[],expense:[]};return days[day];}
    for(i=0;i<sales.length;i++){
      var s=sales[i],row=dayRow(s.date.getDate());
      if(s.net<0){row.expense.push({detail:"คืนเงินเคลม "+s.billNo,amount:-s.net});totalExpense+=-s.net;}
      else{row.income.push({detail:"ขายสินค้า "+s.billNo,amount:s.net});totalIncome+=s.net;}
    }
    var poCashList=readPreorderCashFlow(input,from,to);
    for(i=0;i<poCashList.length;i++){
      var poCash=poCashList[i];
      var detail=poCash.type==="deposit"?"รับมัดจำ "+poCash.poNo:"รับยอดคงเหลือ "+poCash.poNo;
      if(poCash.customer)detail+=" ("+poCash.customer+")";
      if(poCash.documentNo)detail+=" "+poCash.documentNo;
      dayRow(poCash.date.getDate()).income.push({detail:detail,amount:poCash.amount});
      totalIncome+=poCash.amount;
    }
    for(i=0;i<expenses.length;i++){
      var entry=expenses[i],entryRow=dayRow(entry.date.getDate());
      if(entry.isIncome){entryRow.income.push({detail:entry.category+" "+entry.desc,amount:entry.amount});totalIncome+=entry.amount;continue;}
      if(!entry.isExpense||entry.isMaterial)continue;
      entryRow.expense.push({detail:entry.category+" "+entry.desc,amount:entry.amount});
      totalExpense+=entry.amount;
    }
    var costs=getAllCosts(input);
    var costSummary=summarizeCosts(costs,from,to);
    var recurring=readRecurringExpense(input,yr,mn);
    var investment=readInvestmentCost(input,from,to);
    return {
      year:yr,yearBE:yr+543,month:mn,monthName:MONTHS_TH[mn+1],days:days,
      totalIncome:totalIncome,totalExpense:totalExpense,profit:totalIncome-totalExpense,
      cost:{material:costSummary.material,outsource:costSummary.outsource,purchase:costSummary.purchase,
        laborPiece:costSummary.laborPiece,laborDaily:costSummary.laborDaily,recurring:recurring.total,
        recurringItems:recurring.items,investment:investment.total,investmentItems:investment.items,
        laborTotal:costSummary.laborTotal,nonLaborTotal:costSummary.nonLaborTotal,
        cashTotal:costSummary.nonLaborTotal+investment.total,total:costSummary.total+recurring.total+investment.total}
    };
  }

  // ═══════════ COST DASHBOARD (getCostDashboardData, month 0-based) ═══════════
  function cost(input,year,month,now){
    now=now||new Date();
    var costs=getAllCosts(input);
    var yr=Number(year)||now.getFullYear();
    var mo=(month!==undefined&&month!==null&&month!=="")?Number(month):now.getMonth();
    var startOfMonth=new Date(yr,mo,1),endOfMonth=new Date(yr,mo+1,0,23,59,59);
    var monthSummary=summarizeCosts(costs,startOfMonth,endOfMonth);
    var startOfYear=new Date(yr,0,1),endOfYear=new Date(yr,11,31,23,59,59);
    var yearSummary=summarizeCosts(costs,startOfYear,endOfYear);
    var monthlyCosts=summarizeCostsMonthly(costs,yr);
    var recurring=readRecurringExpense(input,yr,mo);
    var recurringMonthly=summarizeRecurringMonthly(input,yr),recurringYear=0;
    for(var rm=0;rm<12;rm++)recurringYear+=recurringMonthly[rm];
    var investment=readInvestmentCost(input,startOfMonth,endOfMonth);
    var investmentYear=readInvestmentCost(input,startOfYear,endOfYear);
    var investmentMonthly=summarizeInvestmentMonthly(input,yr);
    var details={material:[],outsource:[],purchase:[],laborPiece:[],laborDaily:[]};
    var all=costs.all||[];
    for(var i=0;i<all.length;i++){
      var c=all[i];
      if(c.date<startOfMonth||c.date>endOfMonth)continue;
      var item={date:fmt(c.date,"dd/MM"),amount:c.amount,desc:c.desc||c.worker||"",sub:c.vendor||c.step||c.workerType||"",
        unit:c.unit||"",pricePerUnit:c.pricePerUnit||0,qty:c.qty||0};
      if(c.type==="material")details.material.push(item);
      else if(c.type==="outsource")details.outsource.push(item);
      else if(c.type==="purchase")details.purchase.push(item);
      else if(c.type==="labor_piece")details.laborPiece.push(item);
      else if(c.type==="labor_daily")details.laborDaily.push(item);
    }
    return {
      costNote:"รวมค่าแรงต้นทางเพื่อวิเคราะห์ ไม่ใช่เงินสดจ่ายเพิ่ม",
      monthSummary:monthSummary,yearSummary:yearSummary,monthly:monthlyCosts,details:details,
      recurring:{month:recurring,yearTotal:recurringYear,monthly:recurringMonthly},
      investment:{month:investment,yearTotal:investmentYear.total,monthly:investmentMonthly,
        monthItems:investment.items,yearItems:investmentYear.items}
    };
  }

  // ═══════════ CASH FLOW (getCashFlowData) ═══════════
  function monthCashFlow(input,yr,mo,costs){
    var from=new Date(yr,mo,1);from.setHours(0,0,0,0);
    var to=new Date(yr,mo+1,0,23,59,59);
    var totalIn=0,i,sales=readSales(input,from,to);
    for(i=0;i<sales.length;i++)totalIn+=sales[i].net;
    var poCashList=readPreorderCashFlow(input,from,to);
    for(i=0;i<poCashList.length;i++)totalIn+=poCashList[i].amount;
    var cs=summarizeCosts(costs,from,to);
    var recurring=readRecurringExpense(input,yr,mo);
    var investment=readInvestmentCost(input,from,to);
    var moneyEntries=readExpenses(input,from,to),otherIncome=0,opEx=0;
    for(i=0;i<moneyEntries.length;i++){
      var entry=moneyEntries[i];
      if(entry.isIncome){otherIncome+=entry.amount;continue;}
      if(entry.isExpense&&!entry.isMaterial)opEx+=entry.amount;
    }
    totalIn+=otherIncome;
    var totalOut=cs.nonLaborTotal+investment.total+opEx;
    return {inflow:totalIn,outflow:totalOut,net:totalIn-totalOut,
      detail:{otherIncome:otherIncome,material:cs.material,laborAnalysis:cs.laborTotal,purchase:cs.purchase,
        outsource:cs.outsource,opEx:opEx,recurringPlan:recurring.total,recurringItems:recurring.items,investment:investment.total}};
  }
  function cashflow(input,year,now){
    now=now||new Date();
    var yr=Number(year)||now.getFullYear();
    var start=input.cashflowStart||{amount:300000,year:2026,month:9};
    var startIdx=start.year*12+(start.month-1);
    var costs=getAllCosts(input);
    var brought=start.amount,prevEndIdx=yr*12-1;
    for(var idx=startIdx;idx<=prevEndIdx;idx++)brought+=monthCashFlow(input,Math.floor(idx/12),idx%12,costs).net;
    var months=[],running=brought;
    for(var mo=0;mo<12;mo++){
      var active=yr*12+mo>=startIdx;
      var cf=active?monthCashFlow(input,yr,mo,costs):{inflow:0,outflow:0,net:0,detail:{recurringItems:[]}};
      if(active)running+=cf.net;
      months.push({month:mo+1,inflow:cf.inflow,outflow:cf.outflow,net:cf.net,cumulative:active?running:null,active:active,detail:cf.detail});
    }
    return {year:yr,yearBE:yr+543,startAmount:start.amount,startYear:start.year,startMonth:start.month,
      brought:(yr>=start.year)?brought:null,months:months,stock:input.stockValue||null};
  }

  return {
    version:VERSION,fmt:fmt,daily:daily,monthly:monthly,yearly:yearly,availableYears:availableYears,
    print:print,cost:cost,cashflow:cashflow,
    // exposed for 14_Report.gs callers that still need the row readers
    readSales:readSales,readExpenses:readExpenses,getAllCosts:getAllCosts,summarizeCosts:summarizeCosts
  };
})();
if(typeof globalThis!=="undefined")globalThis.ReportCore=ReportCore;
