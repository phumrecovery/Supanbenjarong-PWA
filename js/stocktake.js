// Ported from 34_StockTake.html. GAS remains the source for labels, layout and count flow.
export function renderStocktake(root,api,session,onBack,context={}){
  const viewId=root._stocktakeViewId=(root._stocktakeViewId||0)+1;
  const current=()=>root.isConnected&&root.dataset.route==='stocktake'&&root._stocktakeViewId===viewId;
  const bjSound=window.SuphanSound||{};
  function runner(success,failure){return new Proxy({}, {get(_target,key){if(key==='withSuccessHandler')return fn=>runner(fn,failure);if(key==='withFailureHandler')return fn=>runner(success,fn);return (...args)=>{const data=key==='getStockTakeReviewData'?{roundId:args[0]}:(args[0]||{});api.stockTake(session,key,data).then(response=>{if(!current())return;if(response?.result)success?.(response.result);else if(response?.ok)success?.(response);else failure?.(new Error(response?.message||'เชื่อมต่อระบบไม่สำเร็จ'));}).catch(error=>{if(current())failure?.(error);});};}});}
  const google={script:{run:runner()}};
  root.innerHTML=`<section class="pwa-stocktake"><header class="st-pwa-topbar"><button type="button" onclick="goHome()">← กลับ</button><h1>📋 ตรวจนับสต๊อก</h1></header><div class="st-page">
<div class="st-card">
<div class="st-head">
<div>
<div class="st-title">ตรวจนับสินค้าหน้าร้าน</div>
<div class="st-sub" id="roundText">กำลังโหลดข้อมูล...</div>
</div>
<button class="st-btn" id="startBtn" onclick="startRound()" style="display:none">▶️ เริ่มตรวจนับ</button>
</div>
</div>

<div class="st-card" id="progressCard" style="display:none">
<div class="st-head">
<div class="st-progress" id="progressText">ตรวจแล้ว 0 จาก 0 จุด</div>
<div style="display:flex;gap:8px;flex-wrap:wrap">
<button class="st-btn secondary" onclick="reloadPageData()">🔄 อัปเดต</button>
<button class="st-btn" onclick="openReviewModal()">📊 ดูสรุป</button>
</div>

</div>
</div>

<div class="st-card">
<div class="st-title" style="margin-bottom:12px">🗺️ กดตู้หรือจุดที่ต้องการนับ</div>
<div class="st-canvas-wrap">
<div class="st-canvas" id="stockTakeCanvas">
<div class="st-empty">กำลังโหลดผังร้าน...</div>
</div>
</div>
</div>
</div>

<div class="st-modal" id="countModal">
<div class="st-modal-card">
<div class="st-modal-head">
<div>
<div class="st-title" id="locationTitle">ตรวจนับสินค้า</div>
<div class="st-sub" id="locationStatus"></div>
</div>
<button type="button" class="st-modal-close" onclick="closeCountModal()" aria-label="ปิด" data-popup-close>×</button>
</div>

<div class="st-modal-body">
<input type="text" class="st-search" id="productSearch" oninput="renderCountProducts()" placeholder="ค้นหาชื่อสินค้า รหัส ขนาด หรือลาย">
<div id="countProductList"></div>
</div>

<div class="st-footer">
<button class="st-btn secondary" onclick="closeCountModal()">พักก่อน</button>
<button class="st-btn success" id="completeLocationBtn" onclick="completeCurrentLocation()">✅ นับจุดนี้เสร็จแล้ว</button>
</div>
</div>
</div>

<div class="st-modal" id="reviewModal">
<div class="st-modal-card">
<div class="st-modal-head">
<div>
<div class="st-title">📊 สรุปการตรวจนับ</div>
<div class="st-sub" id="reviewRoundText"></div>
</div>
<button type="button" class="st-modal-close" onclick="closeReviewModal()" aria-label="ปิด" data-popup-close>×</button>
</div>

<div class="st-modal-body">
<div id="reviewLoading" class="st-empty">กำลังโหลดข้อมูล...</div>

<div id="reviewContent" style="display:none">
<div class="st-review-grid">
<div class="st-review-stat">
<div class="value" id="reviewMatched">0</div>
<div class="label">ตรงกับระบบ</div>
</div>
<div class="st-review-stat" style="border-color:#43a047">
<div class="value" id="reviewIncrease">0</div>
<div class="label">พบมากกว่า</div>
</div>
<div class="st-review-stat" style="border-color:#e53935">
<div class="value" id="reviewDecrease">0</div>
<div class="label">พบน้อยกว่า</div>
</div>
<div class="st-review-stat" style="border-color:#ffb74d">
<div class="value" id="reviewPendingSales">0</div>
<div class="label">ขายระหว่างนับ</div>
</div>
</div>

<div class="st-section-title">🛒 รายการขายระหว่างตรวจนับ</div>
<div id="reviewSales"></div>

<div class="st-section-title">📦 ผลรวมจากทุกตู้</div>
<input type="text" class="st-search" id="reviewSearch" oninput="renderReviewItems()" placeholder="ค้นหาชื่อหรือรหัสสินค้า">
<div id="reviewItems"></div>
</div>
</div>

<div class="st-footer">
<button class="st-btn secondary" onclick="closeReviewModal()">ปิด</button>
</div>
</div>
</div>

<div class="st-toast" id="stockTakeToast"></div>

</section>`;
  root._stocktakeHandlerNames=["startRound","reloadPageData","openReviewModal","closeCountModal","completeCurrentLocation","closeReviewModal","renderCountProducts","renderReviewItems","goHome","changeCountByIndex","previewCountByIndex","setCountByIndex","applySaleFromPosition"];

var PAGE_DATA={layout:{items:[]},round:null,locations:[],items:[],products:[]};
var USER_NAME="";
var CURRENT_LOCATION_ID="";
var SAVE_TIMERS={};
var PENDING_COUNTS={};
var ACTIVE_SAVES=0;
var REVIEW_DATA=null;
var APPLYING_SALE={};

USER_NAME=String(context.displayUser?.name||"");

function reloadPageData(){
  google.script.run.withSuccessHandler(function(data){
    PAGE_DATA=data||PAGE_DATA;
    renderPage();
  }).withFailureHandler(function(error){
    byId("roundText").textContent=error&&error.message?error.message:"โหลดข้อมูลไม่สำเร็จ";
    byId("stockTakeCanvas").innerHTML='<div class="st-empty">โหลดผังร้านไม่สำเร็จ <button class="st-btn secondary" onclick="reloadPageData()">ลองอีกครั้ง</button></div>';
  }).getStockTakePageData();
}

function renderPage(){
  var round=PAGE_DATA.round;
  var startBtn=byId("startBtn");
  var progressCard=byId("progressCard");

  if(round){
    byId("roundText").textContent=round.id+" · "+round.status+" · เริ่มโดย "+(round.startedBy||"-");
    startBtn.style.display="none";
    progressCard.style.display="block";
  }else{
    byId("roundText").textContent="ยังไม่มีรอบตรวจนับที่กำลังดำเนินการ";
    startBtn.style.display="block";
    progressCard.style.display="none";
  }

  renderProgress();
  renderLayout();
}

function startRound(){
  var btn=byId("startBtn");
  btn.disabled=true;
  btn.textContent="⏳ กำลังเริ่ม...";

  google.script.run.withSuccessHandler(function(result){
    btn.disabled=false;
    btn.textContent="▶️ เริ่มตรวจนับ";

    if(!result||!result.success){
      toastStockTake(result&&result.message?result.message:"เริ่มรอบไม่สำเร็จ");
      return;
    }

    toastStockTake(result.message);
    reloadPageData();
  }).withFailureHandler(function(error){
    btn.disabled=false;
    btn.textContent="▶️ เริ่มตรวจนับ";
    toastStockTake(error&&error.message?error.message:"เริ่มรอบไม่สำเร็จ");
  }).startStockTakeRound({user:USER_NAME});
}

function renderProgress(){
  var locations=PAGE_DATA.locations||[];
  var done=0;

  for(var i=0;i<locations.length;i++){
    if(locations[i].status==="เสร็จแล้ว")done++;
  }

  byId("progressText").textContent="ตรวจแล้ว "+done+" จาก "+locations.length+" จุด";
}

function renderLayout(){
  var canvas=byId("stockTakeCanvas");
  var layoutItems=PAGE_DATA.layout&&PAGE_DATA.layout.items
    ?PAGE_DATA.layout.items
    :[];

  canvas.innerHTML="";

  if(!layoutItems.length){
    canvas.innerHTML='<div class="st-empty">ยังไม่มีผังร้าน กรุณาตั้งค่าผังร้านก่อน</div>';
    return;
  }

  for(var i=0;i<layoutItems.length;i++){
    var item=layoutItems[i];
    var state=getLocationState_(item.id);
    var box=document.createElement("div");

    box.className="st-location "+state.className;
    box.style.left=item.x+"%";
    box.style.top=item.y+"%";
    box.style.width=item.width+"%";
    box.style.height=item.height+"%";
    box.style.zIndex=String(item.z||i+1);
    box.style.background=item.color||"#eeeeee";
    box.dataset.id=item.id;
    box.setAttribute("role","button");
    box.tabIndex=0;
    box.setAttribute("aria-label",item.name+" "+state.text);
    box.onkeydown=function(event){if(event.key==="Enter"||event.key===" "){event.preventDefault();openLocation(this.dataset.id);}};
    box.onclick=function(){
      openLocation(this.dataset.id);
    };

    var name=document.createElement("div");
    name.textContent=item.name;
    box.appendChild(name);

    var status=document.createElement("div");
    status.className="status";
    status.textContent=state.text;
    box.appendChild(status);

    canvas.appendChild(box);
  }
}

function getLocationState_(locationId){
  if(!PAGE_DATA.round){
    return {className:"pending",text:"ยังไม่เริ่มรอบ"};
  }

  var location=findLocation_(locationId);

  if(!location){
    return {className:"pending",text:"ยังไม่เริ่ม"};
  }

  if(location.status==="เสร็จแล้ว"){
    return {className:"done",text:"✓ เสร็จแล้ว"};
  }

  if(location.status==="กำลังนับ"){
    return {className:"counting",text:"กำลังนับ"};
  }

  return {className:"pending",text:"ยังไม่เริ่ม"};
}

function openLocation(locationId){
  if(!PAGE_DATA.round){
    toastStockTake("กรุณากดเริ่มตรวจนับก่อน");
    return;
  }

  CURRENT_LOCATION_ID=locationId;

  var layoutItem=findLayoutItem_(locationId);
  var location=findLocation_(locationId);

  byId("locationTitle").textContent=layoutItem
    ?layoutItem.name
    :"ตรวจนับสินค้า";

  byId("locationStatus").textContent=
    location&&location.status==="เสร็จแล้ว"
      ?"จุดนี้ยืนยันแล้ว สามารถเปิดแก้ไขได้"
      :"ระบบบันทึกจำนวนอัตโนมัติ";

  if(location&&location.status==="ยังไม่เริ่ม"){
    location.status="กำลังนับ";
  }

  byId("productSearch").value="";
  byId("countModal").classList.add("show");

  renderCountProducts();
  renderLayout();

  google.script.run.withFailureHandler(function(error){
    toastStockTake(
      error&&error.message
        ?error.message
        :"บันทึกสถานะจุดไม่สำเร็จ"
    );
  }).openStockTakeLocation({
    roundId:PAGE_DATA.round.id,
    locationId:locationId,
    user:USER_NAME
  });
}

function closeCountModal(){
  var locationId=CURRENT_LOCATION_ID;

  byId("countModal").classList.remove("show");
  CURRENT_LOCATION_ID="";

  if(!locationId){
    return;
  }

  flushLocationCounts_(locationId,function(saved){
    if(!saved){
      toastStockTake(
        "มีรายการบันทึกไม่สำเร็จ กรุณาเปิดตู้นี้ตรวจอีกครั้ง"
      );
    }
  });
}

function renderCountProducts(){
  var query=String(byId("productSearch").value||"").toLowerCase();
  var products=PAGE_DATA.products||[];
  var html="";
  var shown=0;

  for(var i=0;i<products.length;i++){
    var product=products[i];
    var searchable=[
      product.code,
      product.name,
      product.category,
      product.size,
      product.pattern
    ].join(" ").toLowerCase();

    if(query&&searchable.indexOf(query)<0)continue;

    var qty=getCurrentQty_(product.code);

    if(!query&&qty<=0)continue;

    html+='<div class="st-product">';
    html+='<div class="st-product-info">';
    html+='<div class="st-product-name">'+escapeHtml_(product.name)+'</div>';
    html+='<div class="st-product-sub">'+escapeHtml_([
      product.code,
      product.size,
      product.pattern
    ].filter(Boolean).join(" · "))+'</div>';
    html+='</div>';
    html+='<div class="st-stepper">';
    html+='<button type="button" onclick="changeCountByIndex('+i+',-1)">−</button>';
    html+='<input class="qty st-qty-input" id="countQty_'+i+'" type="number" min="0" step="1" inputmode="numeric" value="'+qty+'" onchange="setCountByIndex('+i+',this.value)" oninput="previewCountByIndex('+i+',this.value)">';
    html+='<button type="button" onclick="changeCountByIndex('+i+',1)">+</button>';
    html+='</div>';
    html+='</div>';

    shown++;

    if(shown>=80)break;
  }

  if(!html){
    html=query
      ?'<div class="st-empty">ไม่พบสินค้าที่ค้นหา</div>'
      :'<div class="st-empty">พิมพ์ชื่อหรือรหัสสินค้าเพื่อเริ่มนับ</div>';
  }

  byId("countProductList").innerHTML=html;
}

function changeCountByIndex(index,change){
  var product=PAGE_DATA.products[index];
  if(!product)return;

  var current=getCurrentQty_(product.code);
  var next=Math.max(0,current+change);

  setLocalCount_(product.code,next);

  var input=byId("countQty_"+index);
  if(input)input.value=next;

  scheduleCountSave_(
    CURRENT_LOCATION_ID,
    product.code,
    next
  );
}

function previewCountByIndex(index,value){
  var product=PAGE_DATA.products[index];
  if(!product)return;

  var qty=normalizeCountQty_(value);
  setLocalCount_(product.code,qty);

  scheduleCountSave_(
    CURRENT_LOCATION_ID,
    product.code,
    qty
  );
}

function setCountByIndex(index,value){
  var product=PAGE_DATA.products[index];
  if(!product)return;

  var qty=normalizeCountQty_(value);
  var input=byId("countQty_"+index);

  if(input)input.value=qty;

  setLocalCount_(product.code,qty);

  scheduleCountSave_(
    CURRENT_LOCATION_ID,
    product.code,
    qty
  );
}

function normalizeCountQty_(value){
  var qty=Number(value);

  if(!isFinite(qty)||qty<0){
    return 0;
  }

  return Math.floor(qty);
}

function scheduleCountSave_(locationId,sku,qty){
  if(!PAGE_DATA.round||!locationId||!sku)return;

  var key=locationId+"|"+sku;

  PENDING_COUNTS[key]={
    locationId:locationId,
    sku:sku,
    qty:qty
  };

  if(SAVE_TIMERS[key]){
    clearTimeout(SAVE_TIMERS[key]);
  }

  SAVE_TIMERS[key]=setTimeout(function(){
    savePendingCount_(key);
  },600);
}

function savePendingCount_(key,done){
  var pending=PENDING_COUNTS[key];

  if(!pending){
    if(done)done(true);
    return;
  }

  if(SAVE_TIMERS[key]){
    clearTimeout(SAVE_TIMERS[key]);
    delete SAVE_TIMERS[key];
  }

  delete PENDING_COUNTS[key];
  ACTIVE_SAVES++;

  google.script.run.withSuccessHandler(function(result){
    ACTIVE_SAVES--;

    if(!result||!result.success){
      toastStockTake(result&&result.message?result.message:"บันทึกไม่สำเร็จ");
      if(done)done(false);
      return;
    }

    if(done)done(true);
  }).withFailureHandler(function(error){
    ACTIVE_SAVES--;
    toastStockTake(error&&error.message?error.message:"บันทึกไม่สำเร็จ");
    if(done)done(false);
  }).saveStockTakeItem({
    roundId:PAGE_DATA.round.id,
    locationId:pending.locationId,
    sku:pending.sku,
    qty:pending.qty,
    user:USER_NAME
  });
}

function flushLocationCounts_(locationId,done){
  var keys=[];

  for(var key in PENDING_COUNTS){
    if(PENDING_COUNTS[key].locationId===locationId){
      keys.push(key);
    }
  }

  if(!keys.length){
    done(true);
    return;
  }

  var pending=keys.length;
  var success=true;

  for(var i=0;i<keys.length;i++){
    savePendingCount_(keys[i],function(saved){
      if(!saved)success=false;
      pending--;

      if(pending===0){
        done(success);
      }
    });
  }
}

function completeCurrentLocation(){
  if(!CURRENT_LOCATION_ID||!PAGE_DATA.round)return;

  try{bjSound.tap();}catch(e){}

  var locationId=CURRENT_LOCATION_ID;
  var btn=byId("completeLocationBtn");

  btn.disabled=true;
  btn.textContent="⏳ กำลังบันทึก...";

  flushLocationCounts_(locationId,function(saved){
    if(!saved){
      btn.disabled=false;
      btn.textContent="✅ นับจุดนี้เสร็จแล้ว";
      toastStockTake("มีรายการบันทึกไม่สำเร็จ กรุณาลองใหม่");
      return;
    }

    btn.textContent="⏳ กำลังยืนยัน...";

    google.script.run.withSuccessHandler(function(result){
      btn.disabled=false;
      btn.textContent="✅ นับจุดนี้เสร็จแล้ว";

      if(!result||!result.success){
        toastStockTake(result&&result.message?result.message:"ยืนยันไม่สำเร็จ");
        return;
      }

      try{bjSound.success();}catch(e){}
      toastStockTake(result.message);
      byId("countModal").classList.remove("show");
      CURRENT_LOCATION_ID="";
      reloadPageData();
    }).withFailureHandler(function(error){
      btn.disabled=false;
      btn.textContent="✅ นับจุดนี้เสร็จแล้ว";
      try{bjSound.error();}catch(e){}
      toastStockTake(error&&error.message?error.message:"ยืนยันไม่สำเร็จ");
    }).completeStockTakeLocation({
      roundId:PAGE_DATA.round.id,
      locationId:locationId,
      user:USER_NAME
    });
  });
}

function getCurrentQty_(sku){
  var items=PAGE_DATA.items||[];

  for(var i=0;i<items.length;i++){
    if(
      items[i].locationId===CURRENT_LOCATION_ID&&
      items[i].sku===sku
    ){
      return Number(items[i].qty)||0;
    }
  }

  return 0;
}

function setLocalCount_(sku,qty){
  var items=PAGE_DATA.items||[];

  for(var i=0;i<items.length;i++){
    if(
      items[i].locationId===CURRENT_LOCATION_ID&&
      items[i].sku===sku
    ){
      items[i].qty=qty;
      return;
    }
  }

  items.push({
    roundId:PAGE_DATA.round.id,
    locationId:CURRENT_LOCATION_ID,
    sku:sku,
    qty:qty,
    status:"Draft"
  });

  PAGE_DATA.items=items;
}

function findLocation_(locationId){
  var locations=PAGE_DATA.locations||[];

  for(var i=0;i<locations.length;i++){
    if(locations[i].locationId===locationId){
      return locations[i];
    }
  }

  return null;
}

function findLayoutItem_(locationId){
  var items=PAGE_DATA.layout&&PAGE_DATA.layout.items
    ?PAGE_DATA.layout.items
    :[];

  for(var i=0;i<items.length;i++){
    if(items[i].id===locationId){
      return items[i];
    }
  }

  return null;
}

function openReviewModal(){
  if(!PAGE_DATA.round){
    toastStockTake("ยังไม่มีรอบตรวจนับ");
    return;
  }

  byId("reviewModal").classList.add("show");
  byId("reviewLoading").style.display="none";
  byId("reviewContent").style.display="block";

  REVIEW_DATA=buildLocalReviewData_();
  renderReviewSummary_();

  byId("reviewRoundText").textContent+=
    " · กำลังตรวจรายการขายล่าสุด...";

  google.script.run.withSuccessHandler(function(result){
    if(!result||!result.success){
      toastStockTake(
        result&&result.message
          ?result.message
          :"ตรวจรายการขายล่าสุดไม่สำเร็จ"
      );
      return;
    }

    REVIEW_DATA=result;
    renderReviewSummary_();
  }).withFailureHandler(function(error){
    toastStockTake(
      error&&error.message
        ?error.message
        :"ตรวจรายการขายล่าสุดไม่สำเร็จ"
    );
  }).getStockTakeReviewData(
    PAGE_DATA.round.id
  );
}

function buildLocalReviewData_(){
  var products=PAGE_DATA.products||[];
  var locations=PAGE_DATA.locations||[];
  var items=PAGE_DATA.items||[];
  var productMap={};
  var locationMap={};
  var countedMap={};
  var positionMap={};

  for(var p=0;p<products.length;p++){
    productMap[products[p].code]=products[p];
  }

  for(var l=0;l<locations.length;l++){
    locationMap[locations[l].locationId]=locations[l];
  }

  for(var i=0;i<items.length;i++){
    var item=items[i]||{};
    var sku=String(item.sku||"");
    var locationId=String(item.locationId||"");
    var qty=Number(item.qty)||0;

    if(!sku)continue;

    countedMap[sku]=(countedMap[sku]||0)+qty;

    if(!positionMap[sku]){
      positionMap[sku]=[];
    }

    if(qty>0){
      positionMap[sku].push({
        locationId:locationId,
        locationName:locationMap[locationId]
          ?locationMap[locationId].locationName
          :locationId,
        qty:qty,
        status:locationMap[locationId]
          ?locationMap[locationId].status
          :""
      });
    }
  }

  var review=[];
  var matchedCount=0;
  var increasedCount=0;
  var decreasedCount=0;
  var increasedQty=0;
  var decreasedQty=0;

  for(var sku in countedMap){
    var product=productMap[sku];

    if(!product)continue;

    var countedQty=Number(countedMap[sku])||0;
    var systemQty=Number(product.systemBalance)||0;
    var difference=countedQty-systemQty;
    var resultType="ตรง";

    if(difference>0){
      resultType="เพิ่ม";
      increasedCount++;
      increasedQty+=difference;
    }else if(difference<0){
      resultType="ขาด";
      decreasedCount++;
      decreasedQty+=Math.abs(difference);
    }else{
      matchedCount++;
    }

    review.push({
      sku:sku,
      name:product.name,
      category:product.category,
      size:product.size,
      pattern:product.pattern,
      image:product.image,
      systemQty:systemQty,
      countedQty:countedQty,
      difference:difference,
      resultType:resultType,
      positions:positionMap[sku]||[]
    });
  }

  review.sort(function(a,b){
    var rank={"ขาด":1,"เพิ่ม":2,"ตรง":3};
    var rankA=rank[a.resultType]||9;
    var rankB=rank[b.resultType]||9;

    if(rankA!==rankB){
      return rankA-rankB;
    }

    return a.name.localeCompare(b.name,"th");
  });

  var completed=0;

  for(var x=0;x<locations.length;x++){
    if(locations[x].status==="เสร็จแล้ว"){
      completed++;
    }
  }

  return {
    success:true,
    round:PAGE_DATA.round,
    locations:{
      total:locations.length,
      completed:completed,
      allCompleted:
        locations.length>0&&
        completed===locations.length
    },
    summary:{
      matchedCount:matchedCount,
      increasedCount:increasedCount,
      decreasedCount:decreasedCount,
      increasedQty:increasedQty,
      decreasedQty:decreasedQty
    },
    review:review,
    sales:[],
    pendingSales:0
  };
}

function closeReviewModal(){
  byId("reviewModal").classList.remove("show");
  REVIEW_DATA=null;
  reloadPageData();
}

function renderReviewSummary_(){
  if(!REVIEW_DATA)return;

  var summary=REVIEW_DATA.summary||{};

  byId("reviewRoundText").textContent=
    REVIEW_DATA.round.id+
    " · ตรวจแล้ว "+
    REVIEW_DATA.locations.completed+
    " จาก "+
    REVIEW_DATA.locations.total+
    " จุด";

  byId("reviewMatched").textContent=
    Number(summary.matchedCount)||0;

  byId("reviewIncrease").textContent=
    (Number(summary.increasedCount)||0)+
    " / +"+
    (Number(summary.increasedQty)||0);

  byId("reviewDecrease").textContent=
    (Number(summary.decreasedCount)||0)+
    " / -"+
    (Number(summary.decreasedQty)||0);

  byId("reviewPendingSales").textContent=
    Number(REVIEW_DATA.pendingSales)||0;

  renderReviewSales_();
  renderReviewItems();
}

function renderReviewSales_(){
  var element=byId("reviewSales");
  var sales=REVIEW_DATA&&REVIEW_DATA.sales
    ?REVIEW_DATA.sales
    :[];

  if(!sales.length){
    element.innerHTML=
      '<div class="st-empty">ไม่มีรายการขายระหว่างตรวจนับ</div>';
    return;
  }

  var html="";

  for(var i=0;i<sales.length;i++){
    var sale=sales[i];
    var done=sale.status==="จัดการแล้ว";

    html+='<div class="st-sale-card'+
      (done?" done":"")+
      '">';

    html+='<div class="st-review-line">';
    html+='<div>';
    html+='<div class="st-product-name">'+
      escapeHtml_(sale.name)+
      '</div>';

    html+='<div class="st-product-sub">'+
      escapeHtml_(
        sale.sku+
        " · "+
        (sale.billNo||sale.movementId)+
        " · "+
        sale.date
      )+
      '</div>';
    html+='</div>';

    html+='<div class="st-review-qty">ขาย '+
      sale.qty+
      '</div>';
    html+='</div>';

    if(done){
      html+='<div class="st-sub" style="margin-top:8px;color:#2e7d32">✅ ปรับยอดจากจุดที่เลือกแล้ว จาก '+
        sale.beforeQty+
        " เหลือ "+
        sale.afterQty+
        " ชิ้น</div>";
    }else if(!sale.positions.length){
      html+='<div class="st-sub" style="margin-top:8px;color:#c62828">ไม่พบสินค้านี้ในจุดที่นับไว้ กรุณากลับไปตรวจจุดที่วางสินค้า</div>';
    }else{
      html+='<div class="st-sub" style="margin-top:8px">หยิบขายจากจุดไหน?</div>';
      html+='<div class="st-position-buttons">';

      for(var p=0;p<sale.positions.length;p++){
        var position=sale.positions[p];

        html+='<button type="button" class="st-position-btn" onclick="applySaleFromPosition('+
          i+
          ","+
          p+
          ')">'+
          escapeHtml_(position.locationName)+
          " ("+
          position.qty+
          ")</button>";
      }

      html+='</div>';
    }

    html+='</div>';
  }

  element.innerHTML=html;
}

function applySaleFromPosition(saleIndex,positionIndex){
  if(!REVIEW_DATA)return;

  var sale=REVIEW_DATA.sales[saleIndex];
  var position=sale&&sale.positions
    ?sale.positions[positionIndex]
    :null;

  if(
    !sale||
    !position||
    APPLYING_SALE[sale.movementId]
  ){
    return;
  }

  if(Number(sale.qty)>Number(position.qty)){
    toastStockTake(
      "จุดนี้มีเพียง "+
      position.qty+
      " ชิ้น ลด "+
      sale.qty+
      " ชิ้นไม่ได้"
    );
    return;
  }

  APPLYING_SALE[sale.movementId]=true;
  toastStockTake("กำลังปรับยอดหลังขาย...");

  google.script.run.withSuccessHandler(function(result){
    delete APPLYING_SALE[sale.movementId];

    if(!result||!result.success){
      toastStockTake(
        result&&result.message
          ?result.message
          :"ปรับยอดไม่สำเร็จ"
      );
      return;
    }

    toastStockTake(result.message);
    refreshReview_();
  }).withFailureHandler(function(error){
    delete APPLYING_SALE[sale.movementId];

    toastStockTake(
      error&&error.message
        ?error.message
        :"ปรับยอดไม่สำเร็จ"
    );
  }).applyStockTakeSaleAdjustment({
    roundId:PAGE_DATA.round.id,
    movementId:sale.movementId,
    billNo:sale.billNo,
    sku:sale.sku,
    qty:sale.qty,
    locationId:position.locationId,
    user:USER_NAME
  });
}

function refreshReview_(){
  google.script.run.withSuccessHandler(function(result){
    if(!result||!result.success){
      toastStockTake(
        result&&result.message
          ?result.message
          :"โหลดสรุปไม่สำเร็จ"
      );
      return;
    }

    REVIEW_DATA=result;
    renderReviewSummary_();
  }).withFailureHandler(function(error){
    toastStockTake(
      error&&error.message
        ?error.message
        :"โหลดสรุปไม่สำเร็จ"
    );
  }).getStockTakeReviewData(
    PAGE_DATA.round.id
  );
}

function renderReviewItems(){
  var element=byId("reviewItems");

  if(!REVIEW_DATA){
    element.innerHTML="";
    return;
  }

  var query=String(
    byId("reviewSearch").value||""
  ).toLowerCase();

  var items=REVIEW_DATA.review||[];
  var html="";

  for(var i=0;i<items.length;i++){
    var item=items[i];
    var searchable=[
      item.sku,
      item.name,
      item.category,
      item.size,
      item.pattern
    ].join(" ").toLowerCase();

    if(
      query&&
      searchable.indexOf(query)<0
    ){
      continue;
    }

    var className="match";
    var differenceText="ตรง";

    if(item.difference>0){
      className="increase";
      differenceText="+"+item.difference;
    }else if(item.difference<0){
      className="decrease";
      differenceText=String(item.difference);
    }

    html+='<div class="st-review-item '+
      className+
      '">';

    html+='<div class="st-review-line">';
    html+='<div>';
    html+='<div class="st-product-name">'+
      escapeHtml_(item.name)+
      '</div>';

    html+='<div class="st-product-sub">'+
      escapeHtml_([
        item.sku,
        item.size,
        item.pattern
      ].filter(Boolean).join(" · "))+
      '</div>';
    html+='</div>';

    html+='<div class="st-review-qty">'+
      differenceText+
      '</div>';
    html+='</div>';

    html+='<div class="st-product-sub" style="margin-top:8px">ระบบ '+
      item.systemQty+
      " · นับได้ "+
      item.countedQty+
      '</div>';

    if(item.positions.length){
      html+='<div class="st-position-list">';
      html+='<div class="st-product-sub" style="font-weight:700;margin-bottom:3px">ตำแหน่งที่พบ</div>';

      for(var positionIndex=0;positionIndex<item.positions.length;positionIndex++){
        var position=item.positions[positionIndex];

        html+='<div class="st-position-row">';
        html+='<span class="st-position-name">'+
          escapeHtml_(position.locationName)+
          '</span>';

        html+='<span class="st-position-qty">'+
          Number(position.qty)+
          ' ชิ้น</span>';

        html+='</div>';
      }

      html+='</div>';
    }

    html+='</div>';
  }

  if(!html){
    html='<div class="st-empty">ไม่พบรายการ</div>';
  }

  element.innerHTML=html;
}

function goHome(){if(CURRENT_LOCATION_ID)closeCountModal();onBack();}

function byId(id){
  return document.getElementById(id);
}

function escapeHtml_(value){
  return String(value||"").replace(/[&<>"']/g,function(character){
    return {
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[character];
  });
}

function toastStockTake(message){
  var element=byId("stockTakeToast");
  element.textContent=message;
  element.classList.add("show");

  setTimeout(function(){
    element.classList.remove("show");
  },1800);
}

  reloadPageData();
  const handlers={goHome,startRound,reloadPageData,openReviewModal,closeCountModal,completeCurrentLocation,closeReviewModal,renderCountProducts,renderReviewItems,changeCountByIndex,previewCountByIndex,setCountByIndex,applySaleFromPosition};
  for(const name of root._stocktakeHandlerNames){window[name]=(...args)=>{if(current())return handlers[name](...args);};}
}
