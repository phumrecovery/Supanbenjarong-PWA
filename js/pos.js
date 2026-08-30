// POS view follows the structural flow of the original 07_Sales.html.
// The PWA calls the original GAS saveSale path through the authenticated API.
const DEFAULT_CHANNELS=["หน้าร้าน","โทรสั่ง","Line","Facebook","Lot/ส่ง","อื่นๆ"];
const PAYMENTS=["💵 เงินสด","🏦 โอนธนาคาร"];
let state={data:null,category:"",query:"",cart:[],step:0,animation:"",channel:"หน้าร้าน",payIndex:0,cash:0,shipping:0,shippingOpen:false,discountType:0,discountAll:0,lumpDiscount:0,editingDiscount:null,backdate:false,backdateValue:"",unlockStock:false,showBackdatePicker:false,mobileCartOpen:false,submitting:false,submitError:"",lastBill:null,successOpen:false,printOpen:false,printSize:"size-a4",buyerEnabled:false,receiptHtml:"",requestId:""};
let runtime={api:null,session:"",onBack:null,level:"",userName:""};

export async function renderPos(root,api,session,onBack,context={}){
  runtime={api,session,onBack,level:context.level||"",userName:(context.displayUser&&context.displayUser.name)||(context.user&&context.user.name)||""};
  const header=document.querySelector("#appHeader");
  if(header){header.hidden=true;header.style.display="none";}
  if(!state.data){
    root.innerHTML='<section class="pos-loading"><span class="spinner"></span><p>กำลังโหลดข้อมูล...</p></section>';
    try{state.data=await api.posBootstrap(session);}catch(error){root.innerHTML='<section class="card"><h1>เปิดหน้าขายของไม่สำเร็จ</h1><p class="hint">ไม่สามารถโหลดสินค้าหน้าร้านได้ โปรดลองใหม่อีกครั้ง</p></section>';return;}
  }
  draw(root);
}

function draw(root){
  const data=state.data;
  if(!data||!data.ok){root.innerHTML='<section class="card"><h1>เปิด POS ไม่สำเร็จ</h1><p class="hint">ไม่พบข้อมูลสินค้าสำหรับผู้ใช้นี้</p></section>';return;}
  const family=runtime.level==="family";
  const channels=(data.channels&&data.channels.length?data.channels:DEFAULT_CHANNELS);
  if(!channels.includes(state.channel))state.channel=channels[0]||"หน้าร้าน";
  const products=filteredProducts(data.products||[]);
  root.innerHTML=`<section class="legacy-pos-page">
    <header class="legacy-pos-topbar"><div class="legacy-pos-heading"><button class="legacy-back-btn" type="button" data-action="back">← กลับ</button><h1>🧾 ขายของ</h1></div><div class="legacy-pos-actions"><select data-channel aria-label="ช่องทางการขาย">${channels.map(value=>`<option value="${escAttr(value)}" ${state.channel===value?"selected":""}>${esc(value)}</option>`).join("")}</select>${family?`<button class="legacy-lock-btn ${state.unlockStock?"active":""}" type="button" data-action="unlock">🔓 ${state.unlockStock?"ปิดปลดล็อก":"ปลดล็อกสต๊อก"}</button><button class="legacy-history-btn ${state.backdate?"active":""}" type="button" data-action="backdate">🕘 ย้อนหลัง</button>`:""}</div></header>
    ${state.unlockStock?'<div class="stock-unlock-banner show">🔓 เปิดขายสินค้าที่สต๊อกไม่พอ ระบบจะปรับเฉพาะจำนวนที่ขาดให้อัตโนมัติก่อนออกบิล</div>':""}
    ${state.backdate?`<div class="back-sale-banner show">🕘 บันทึกยอดขายย้อนหลัง: ${state.backdateValue||"กรุณาเลือกวันที่ขายจริง"}<button type="button" data-action="choose-backdate">เลือกวันที่</button><button type="button" data-action="backdate">ปิด</button></div>`:""}
    ${state.showBackdatePicker?backdatePicker() : ""}
    <div class="legacy-pos-content"><div class="legacy-pos-layout"><section class="legacy-pos-products"><div class="category-tools">${family?'<button type="button" data-action="category-order">⚙️ จัดเรียงหมวด</button>':""}</div><div class="category-bar" role="tablist">${categoryButtons(data.categories||[])}</div><label class="legacy-search"><span>🔍</span><input data-search type="search" placeholder="ค้นหาสินค้า..." value="${escAttr(state.query)}"></label><div class="legacy-results"><span>${products.length.toLocaleString("th-TH")} รายการ</span><span>ข้อมูลล่าสุดจาก GAS</span></div><div class="legacy-product-grid">${products.map(productCard).join("")||'<div class="legacy-empty">🔎<br>ไม่พบสินค้า</div>'}</div></section><aside class="legacy-pos-cart pos-cart-desktop" aria-label="ตะกร้าสินค้า"><div class="cart-step ${state.animation}">${cartMarkup()}</div></aside></div></div>
  </section>`;
  const cartPieces=state.cart.reduce((sum,item)=>sum+(Number(item.qty)||0),0);
  if(cartPieces){
    root.querySelector(".legacy-pos-page")?.insertAdjacentHTML("beforeend",`<button class="cart-floating" type="button" data-action="mobile-cart">🛒 ฿${money(totals().net)} <span class="cart-count">${cartPieces} ชิ้น</span></button>`);
  }
  if(state.mobileCartOpen)root.querySelector(".legacy-pos-page")?.insertAdjacentHTML("beforeend",mobileCartMarkup());
  if(state.submitError)root.querySelector(".legacy-pos-page")?.insertAdjacentHTML("beforeend",errorMarkup(state.submitError));
  if(state.successOpen)root.querySelector(".legacy-pos-page")?.insertAdjacentHTML("beforeend",successMarkup());
  if(state.printOpen)root.querySelector(".legacy-pos-page")?.insertAdjacentHTML("beforeend",printOptionsMarkup());
  if(state.receiptHtml)root.querySelector(".legacy-pos-page")?.insertAdjacentHTML("beforeend",`<div class="receipt-container pwa-receipt-container">${state.receiptHtml}</div>`);
  root.querySelector("[data-buyer-enabled]")?.addEventListener("change",event=>{state.buyerEnabled=event.target.checked;draw(root);});
  state.animation="";
  ensureClickHandler(root);
  bind(root);
}

function backdatePicker(){return `<div class="legacy-pos-modal"><section><h2>🕘 บันทึกยอดขายย้อนหลัง</h2><label>วันที่ขายจริง<input type="date" data-backdate-input value="${escAttr(state.backdateValue)}"></label><p>ใช้สำหรับยอดขายย้อนหลังเท่านั้น</p><div><button type="button" data-action="cancel-backdate">ยกเลิก</button><button type="button" data-action="apply-backdate">ตกลง</button></div></section></div>`;}
function mobileCartMarkup(){return `<div class="mobile-cart-overlay"><section class="mobile-cart-sheet"><header><strong>🛒 ตะกร้าสินค้า</strong><button type="button" data-action="close-mobile-cart" aria-label="ปิดตะกร้า">×</button></header><div class="cart-step ${state.animation}">${cartMarkup()}</div></section></div>`;}
function errorMarkup(message){return `<div class="legacy-pos-modal pwa-result-modal"><section><h2>⚠️ บันทึกบิลไม่สำเร็จ</h2><p>${esc(message)}</p><div><button type="button" data-action="close-error">รับทราบ</button></div></section></div>`;}
function successMarkup(){const bill=state.lastBill||{},change=state.payIndex===0&&Number(state.cash)>0?Math.max(0,Number(state.cash)-Number(bill.netTotal||0)):null;return `<div class="legacy-pos-modal pwa-success-modal"><section><div class="success-icon">✅</div><h2>บันทึกสำเร็จ!</h2><div class="pwa-bill-info"><strong>เลขบิล: ${esc(bill.billNo||"-")}</strong><span>วันที่ขาย: ${esc(bill.date||"")}</span><b>฿${money(bill.netTotal)}</b><span>${Number(bill.pcs)||0} ชิ้น | ${esc(bill.payment||"")}</span>${change!==null?`<em>💰 เงินทอน ฿${money(change)}</em>`:""}</div><div><button type="button" data-action="open-print">🖨️ พิมพ์ใบเสร็จ</button><button type="button" data-action="new-sale">🧾 ขายต่อ</button></div></section></div>`;}
function printOptionsMarkup(){return `<div class="legacy-pos-modal pwa-print-modal"><section><h2>🖨️ พิมพ์ใบเสร็จ</h2><label class="pwa-buyer-toggle"><input type="checkbox" data-buyer-enabled ${state.buyerEnabled?"checked":""}> ใส่ข้อมูลผู้ซื้อ</label><div class="pwa-buyer-fields ${state.buyerEnabled?"":"hidden"}"><label>ชื่อผู้ซื้อ / บริษัท<input type="text" data-buyer-name placeholder="เช่น บริษัท ABC จำกัด"></label><label>ที่อยู่<input type="text" data-buyer-addr placeholder="ที่อยู่ออกใบเสร็จ"></label><label>เลขผู้เสียภาษี<input type="text" data-buyer-tax placeholder="(ถ้ามี)"></label><label>เบอร์โทร<input type="text" data-buyer-phone placeholder="(ถ้ามี)"></label></div><p class="pwa-print-label">📄 ขนาดกระดาษ</p><div class="pwa-print-sizes">${[["size-a4","A4"],["size-a5","A5"],["size-80mm","🧾 80mm"]].map(([value,label])=>`<button type="button" class="${state.printSize===value?"active":""}" data-print-size="${value}">${label}</button>`).join("")}</div><div><button type="button" data-action="close-print">ยกเลิก</button><button type="button" data-action="print-bill">🖨️ พิมพ์</button></div></section></div>`;}
function categoryButtons(categories){return ["",...categories].map(value=>`<button class="legacy-category-btn ${state.category===value?"active":""}" type="button" data-category="${escAttr(value)}" role="tab">${value?esc(value):"ทั้งหมด"}</button>`).join("");}
function filteredProducts(products){const term=state.query.trim().toLocaleLowerCase("th");return products.filter(product=>{if(state.category&&product.category!==state.category)return false;return !term||[product.code,product.name,product.pattern,product.size,product.category].join(" ").toLocaleLowerCase("th").includes(term);}).slice(0,120);}
function patternCode(pattern){const value=String(pattern||"");if(value.includes("ครึ่ง"))return "HF";if(value.includes("เต็ม"))return "FU";if(value.includes("มุก")&&value.includes("ดอก"))return "MP-FLOWER";if(value.includes("มุก"))return "MP-GOLD";if(value.includes("คราม"))return "KR";return "OT";}
function patternLabel(pattern){const value=String(pattern||"");if(value.includes("ครึ่ง"))return "เบญจรงค์ครึ่งใบ";if(value.includes("เต็ม"))return "เบญจรงค์เต็มใบ";return value||"อื่น ๆ";}
function productCard(product){const stock=Number(product.stock)||0;const image=product.img?`<img loading="lazy" src="${escAttr(product.img)}" alt="" onerror="this.parentElement.classList.add('no-image')">`:'<span class="legacy-product-fallback">🏺</span>';return `<button type="button" class="legacy-product-card" data-add="${escAttr(product.code)}" ${stock<=0&&!state.unlockStock?"disabled":""}><span class="legacy-product-image">${image}</span><span class="legacy-product-info"><span class="legacy-product-name">${esc(product.name)}${product.size&&product.size!=="-"?` ${esc(product.size)}`:""}</span><span class="legacy-pattern-badge pat-${patternCode(product.pattern)}">${esc(patternLabel(product.pattern))}</span><strong class="legacy-product-price">฿${money(product.priceRetail)}</strong></span><span class="legacy-stock-chip ${stock>0?"":"zero"}">${stock>0?`คงเหลือ ${stock}`:"หมด"}</span></button>`;}
function totals(){let pieces=0,gross=0,itemDiscount=0,packaging=0;state.cart.forEach(item=>{const qty=Number(item.qty)||0;pieces+=qty;gross+=qty*(Number(item.priceRetail)||0);itemDiscount+=qty*(Number(item.discount)||0);packaging+=packageCost(item);});const lump=state.discountType===1?Number(state.lumpDiscount)||0:0;const shipping=Number(state.shipping)||0;return {pieces,gross,itemDiscount,lump,packaging,shipping,net:Math.max(0,gross-itemDiscount-lump+packaging+shipping)};}
function packageCost(item){const pack=(state.data.packaging||[]).find(value=>value.code===item.packageCode);return pack?(Number(pack.price)||0)*(Number(item.packageQty)||0):0;}
function packageOptions(item){return `<option value="">ไม่ใส่แพ็คเกจ</option>${(state.data.packaging||[]).filter(pack=>Number(pack.stock)>0).map(pack=>`<option value="${escAttr(pack.code)}" ${item.packageCode===pack.code?"selected":""}>${esc(pack.name)}${pack.size?` ${esc(pack.size)}`:""} · ฿${money(pack.price)}</option>`).join("")}`;}
function cartMarkup(){return state.step===0?itemsMarkup():checkoutMarkup();}
function itemsMarkup(){if(!state.cart.length)return '<div class="legacy-cart-empty"><div class="legacy-cart-icon">🛒</div><div class="legacy-cart-message">ยังไม่มีสินค้าในตะกร้า</div><div>กดที่สินค้าเพื่อเพิ่มลงตะกร้า</div></div>';const total=totals();const rows=state.cart.map((item,index)=>{const discount=Number(item.discount)||0;const info=state.editingDiscount===item.code?`<div class="item-discount-inline">${[0,10,20,30,50].map(value=>`<button data-item-discount="${item.code}" data-value="${value}" class="${discount===value?"active":""}">${value===0?"ไม่ลด":"฿"+value}</button>`).join("")}</div>`:`<button class="item-disc-btn" data-action="edit-item-discount" data-code="${escAttr(item.code)}">💰 ${discount?"฿"+money(discount):"ลด"}</button>`;return `<div class="cart-item"><div class="ci-info"><div class="ci-name">${esc(item.name)}${item.size&&item.size!=="-"?` ${esc(item.size)}`:""}</div><div class="ci-sub">${esc(item.pattern||"")}${discount?` | ลด฿${money(discount)}/ชิ้น`:""} ${info}</div></div><div class="qty-ctrl"><button class="qty-btn" data-qty="${escAttr(item.code)}" data-step="-1">−</button><div class="qty-val">${item.qty}</div><button class="qty-btn" data-qty="${escAttr(item.code)}" data-step="1">+</button></div><div class="ci-price">฿${money(item.qty*(item.priceRetail-discount)+packageCost(item))}</div><button class="item-remove" data-remove="${escAttr(item.code)}">×</button><div class="pkg-row"><select data-package="${escAttr(item.code)}">${packageOptions(item)}</select>${item.packageCode?`<span class="pkg-qty"><button data-package-qty="${escAttr(item.code)}" data-step="-1">−</button><b>${item.packageQty||0}</b><button data-package-qty="${escAttr(item.code)}" data-step="1">+</button></span>`:""}</div></div>`;}).join("");return `<div class="cart-title">🛒 ตะกร้า (${state.cart.length} รายการ)</div>${rows}<div class="cart-checkout-sticky"><button class="legacy-checkout success" type="button" data-action="checkout">คิดเงิน ฿${money(total.net)} ➡️</button></div>`;}
function checkoutMarkup(){const total=totals();const discountPills=[0,10,20,30,50].map(value=>`<button class="discount-pill ${state.discountType===0&&state.discountAll===value?"active":""}" data-discount="${value}">${value===0?"ไม่ลด":"฿"+value}</button>`).join("");const payments=PAYMENTS.map((name,index)=>`<button class="pay-pill ${state.payIndex===index?"active":""}" data-payment="${index}">${name}</button>`).join("");const cash=state.payIndex===0?`<div class="cash-section"><div>💵 ลูกค้าจ่าย</div><input type="number" data-cash placeholder="0" value="${Number(state.cash)||""}"><div class="cash-pills">${[500,1000,1500,2000].filter(value=>value>=total.net).map(value=>`<button data-cash-quick="${value}">฿${money(value)}</button>`).join("")}<button data-cash-quick="exact">พอดี</button></div>${Number(state.cash)>0?`<div class="change-display">เงินทอน ฿${money(Math.max(0,Number(state.cash)-total.net))}</div>`:""}</div>`:"";const shipping=state.shippingOpen||state.shipping>0?`<div class="shipping-section"><div>🚚 ค่าขนส่ง (เหมาต่อบิล)</div><div><input type="number" data-shipping placeholder="0" value="${Number(state.shipping)||""}"><button class="qty-btn" data-action="shipping-close">×</button></div></div>`:'<button class="discount-pill shipping-add" data-action="shipping-open">🚚 + เพิ่มค่าขนส่ง</button>';return `<button class="legacy-edit-cart" type="button" data-action="items">⬅️ กลับไปแก้รายการ</button><section class="checkout-section"><h3>💰 ส่วนลดรวม</h3><div class="discount-pills">${discountPills}<button class="discount-pill ${state.discountType===1?"active":""}" data-action="custom-discount">✏️ กำหนดเอง</button></div>${state.discountType===1?`<label class="checkout-input-label">ลดเหมายอดสุดท้าย<input type="number" data-lump min="0" value="${Number(state.lumpDiscount)||""}" placeholder="0"></label>`:""}</section><section class="checkout-section"><h3>💳 วิธีชำระ</h3><div class="pay-pills">${payments}</div>${cash}</section><section class="checkout-section">${shipping}</section><section class="cart-checkout-sticky checkout-summary"><div><span>รวม ${total.pieces} ชิ้น</span><b>฿${money(total.gross)}</b></div>${total.itemDiscount?`<div class="danger"><span>ส่วนลดต่อชิ้น</span><b>-฿${money(total.itemDiscount)}</b></div>`:""}${total.lump?`<div class="danger"><span>ลดเหมา</span><b>-฿${money(total.lump)}</b></div>`:""}${total.packaging?`<div><span>ค่าแพ็คเกจ</span><b>+฿${money(total.packaging)}</b></div>`:""}${total.shipping?`<div><span>🚚 ค่าขนส่ง</span><b>+฿${money(total.shipping)}</b></div>`:""}<div class="grand"><span>ยอดสุทธิ</span><b>฿${money(total.net)}</b></div><button class="legacy-checkout ${state.submitting?"disabled":"success"}" type="button" data-action="submit-sale" ${state.submitting?"disabled":""}>${state.submitting?"⏳ กำลังบันทึก...":`✅ ออกบิล ฿${money(total.net)}`}</button></section>`;}
function bind(root){root.querySelector("[data-search]")?.addEventListener("input",event=>{state.query=event.target.value;draw(root);});root.querySelector("[data-channel]")?.addEventListener("change",event=>{state.channel=event.target.value;});root.querySelectorAll("[data-package]").forEach(select=>select.addEventListener("change",()=>{const item=find(select.dataset.package);if(item){item.packageCode=select.value;item.packageQty=select.value?1:0;draw(root);}}));root.querySelectorAll("[data-lump]").forEach(input=>input.addEventListener("input",()=>{state.lumpDiscount=Math.max(0,Number(input.value)||0);draw(root);}));root.querySelectorAll("[data-cash]").forEach(input=>input.addEventListener("input",()=>{state.cash=Math.max(0,Number(input.value)||0);draw(root);}));root.querySelectorAll("[data-shipping]").forEach(input=>input.addEventListener("input",()=>{state.shipping=Math.max(0,Number(input.value)||0);draw(root);}));root.addEventListener("click",event=>{const button=event.target.closest("button");if(!button)return;const action=button.dataset.action;if(action==="back"){runtime.onBack?.();return;}if(action==="unlock"){state.unlockStock=!state.unlockStock;draw(root);return;}if(action==="backdate"){state.backdate=!state.backdate;state.showBackdatePicker=state.backdate;draw(root);return;}if(action==="choose-backdate"){state.showBackdatePicker=true;draw(root);return;}if(action==="cancel-backdate"){state.showBackdatePicker=false;draw(root);return;}if(action==="apply-backdate"){const value=root.querySelector("[data-backdate-input]")?.value||"";state.backdateValue=value;state.showBackdatePicker=false;draw(root);return;}if(action==="category-order"){return;}if(action==="checkout"){state.animation="cart-slide-next";state.step=1;draw(root);return;}if(action==="items"){state.animation="cart-slide-prev";state.step=0;draw(root);return;}if(action==="custom-discount"){state.discountType=1;draw(root);return;}if(action==="shipping-open"){state.shippingOpen=true;draw(root);return;}if(action==="shipping-close"){state.shippingOpen=false;state.shipping=0;draw(root);return;}if(action==="edit-item-discount"){state.editingDiscount=button.dataset.code;draw(root);return;}if(button.dataset.category!==undefined){state.category=button.dataset.category;draw(root);return;}if(button.dataset.add){add(button.dataset.add,root);return;}if(button.dataset.qty){changeQty(button.dataset.qty,Number(button.dataset.step),root);return;}if(button.dataset.remove){state.cart=state.cart.filter(item=>item.code!==button.dataset.remove);draw(root);return;}if(button.dataset.packageQty){changePackageQty(button.dataset.packageQty,Number(button.dataset.step),root);return;}if(button.dataset.itemDiscount){const item=find(button.dataset.itemDiscount);if(item){item.discount=Number(button.dataset.value)||0;state.editingDiscount=null;draw(root);}return;}if(button.dataset.discount!==undefined){state.discountType=0;state.discountAll=Number(button.dataset.discount)||0;state.cart.forEach(item=>item.discount=state.discountAll);draw(root);return;}if(button.dataset.payment!==undefined){state.payIndex=Number(button.dataset.payment);draw(root);return;}if(button.dataset.cashQuick){state.cash=button.dataset.cashQuick==="exact"?totals().net:Number(button.dataset.cashQuick);draw(root);}});}
function ensureClickHandler(root){
  if(root.dataset.posCaptureBound)return;
  root.dataset.posCaptureBound="1";
  root.addEventListener("click",event=>{
    const button=event.target.closest("button");
    // The listener remains on the shared <main> after leaving POS.  It must
    // never intercept Home or another module's navigation controls.
    if(!button||!button.closest(".legacy-pos-page"))return;
    event.stopImmediatePropagation();
    handleClick(button,root);
  },true);
  // Inputs used to redraw the whole cart for every keystroke. That destroys
  // focus, so only keep state while typing and redraw when the value is done.
  root.addEventListener("input",event=>{
    const input=event.target.closest("input");
    if(!input||!input.closest(".legacy-pos-page"))return;
    if(input.matches("[data-search]")){
      state.query=input.value;
      refreshProductResults(root);
    }
    else if(input.matches("[data-lump]"))state.lumpDiscount=Math.max(0,Number(input.value)||0);
    else if(input.matches("[data-cash]"))state.cash=Math.max(0,Number(input.value)||0);
    else if(input.matches("[data-shipping]"))state.shipping=Math.max(0,Number(input.value)||0);
    else return;
    event.stopImmediatePropagation();
  },true);
  root.addEventListener("change",event=>{
    const input=event.target.closest("input");
    if(!input||!input.closest(".legacy-pos-page")||!input.matches("[data-lump],[data-cash],[data-shipping]"))return;
    event.stopImmediatePropagation();
    draw(root);
  },true);
}
function refreshProductResults(root){
  const products=filteredProducts(state.data.products||[]);
  const grid=root.querySelector(".legacy-product-grid");
  const count=root.querySelector(".legacy-results span");
  if(grid)grid.innerHTML=products.map(productCard).join("")||'<div class="legacy-empty">🔎<br>ไม่พบสินค้า</div>';
  if(count)count.textContent=`${products.length.toLocaleString("th-TH")} รายการ`;
}
function handleClick(button,root){
  const action=button.dataset.action;
  if(action==="submit-sale"){void submitSale(root);return;}
  if(action==="close-error"){state.submitError="";draw(root);return;}
  if(action==="open-print"){state.printOpen=true;draw(root);return;}
  if(action==="close-print"){state.printOpen=false;draw(root);return;}
  if(action==="print-bill"){printBill(root);return;}
  if(action==="new-sale"){void newSale(root);return;}
  if(action==="mobile-cart"){state.mobileCartOpen=true;draw(root);return;}
  if(action==="close-mobile-cart"){state.mobileCartOpen=false;draw(root);return;}
  if(action==="back"){runtime.onBack?.();return;}
  if(action==="unlock"){state.unlockStock=!state.unlockStock;draw(root);return;}
  if(action==="backdate"){state.backdate=!state.backdate;state.showBackdatePicker=state.backdate;draw(root);return;}
  if(action==="choose-backdate"){state.showBackdatePicker=true;draw(root);return;}
  if(action==="cancel-backdate"){state.showBackdatePicker=false;draw(root);return;}
  if(action==="apply-backdate"){state.backdateValue=root.querySelector("[data-backdate-input]")?.value||"";state.showBackdatePicker=false;draw(root);return;}
  if(action==="checkout"){state.animation="cart-slide-next";state.step=1;draw(root);return;}
  if(action==="items"){state.animation="cart-slide-prev";state.step=0;draw(root);return;}
  if(action==="custom-discount"){state.discountType=1;draw(root);return;}
  if(action==="shipping-open"){state.shippingOpen=true;draw(root);return;}
  if(action==="shipping-close"){state.shippingOpen=false;state.shipping=0;draw(root);return;}
  if(action==="edit-item-discount"){state.editingDiscount=button.dataset.code;draw(root);return;}
  if(button.dataset.category!==undefined){state.category=button.dataset.category;draw(root);return;}
  if(button.dataset.add){add(button.dataset.add,root);return;}
  if(button.dataset.qty){changeQty(button.dataset.qty,Number(button.dataset.step),root);return;}
  if(button.dataset.remove){state.cart=state.cart.filter(item=>item.code!==button.dataset.remove);draw(root);return;}
  if(button.dataset.packageQty){changePackageQty(button.dataset.packageQty,Number(button.dataset.step),root);return;}
  if(button.dataset.itemDiscount){const item=find(button.dataset.itemDiscount);if(item){item.discount=Number(button.dataset.value)||0;state.editingDiscount=null;draw(root);}return;}
  if(button.dataset.discount!==undefined){state.discountType=0;state.discountAll=Number(button.dataset.discount)||0;state.cart.forEach(item=>item.discount=state.discountAll);draw(root);return;}
  if(button.dataset.payment!==undefined){state.payIndex=Number(button.dataset.payment);draw(root);return;}
  if(button.dataset.printSize){state.printSize=button.dataset.printSize;draw(root);return;}
  if(button.dataset.cashQuick){state.cash=button.dataset.cashQuick==="exact"?totals().net:Number(button.dataset.cashQuick);draw(root);}
}
function buildSaleItems(){return state.cart.map(item=>{const pack=(state.data.packaging||[]).find(value=>value.code===item.packageCode)||{};const pkgQty=Number(item.packageQty)||0;return {code:item.code,name:item.name,size:item.size||"",pattern:item.pattern||"",price:Number(item.priceRetail)||0,qty:Number(item.qty)||0,disc:Number(item.discount)||0,pkgCode:pkgQty?String(pack.code||""):"",pkgName:pkgQty?String(pack.name||""):"",pkgUnitPrice:pkgQty?(Number(pack.price)||0):0,pkgQty:pkgQty,pkgPrice:pkgQty*(Number(pack.price)||0)};});}
function newRequestId(){return globalThis.crypto&&crypto.randomUUID?crypto.randomUUID():`pwa_${Date.now()}_${Math.random().toString(36).slice(2,12)}`;}
function buildSalePayload(){const total=totals(),items=buildSaleItems(),lump=state.discountType===1?Number(state.lumpDiscount)||0:0;return {channel:state.channel,customer:"ลูกค้าทั่วไป",itemsJSON:JSON.stringify(items),totalPcs:total.pieces,priceBeforeDiscount:total.gross,discountItem:total.itemDiscount,totalDiscount:total.itemDiscount+lump,packagingCost:total.packaging,shippingCost:total.shipping,netTotal:total.net,payment:state.payIndex===0?"เงินสด":"โอนธนาคาร",note:lump?`ลดเหมา ฿${lump}`:"",saleDate:state.backdate?state.backdateValue:"",unlockStock:state.unlockStock,clientRequestId:state.requestId};}
async function submitSale(root){
  if(state.submitting)return;
  if(!state.cart.length){state.submitError="ยังไม่มีสินค้าในตะกร้า";draw(root);return;}
  if(state.backdate&&!state.backdateValue){state.submitError="กรุณาเลือกวันที่ขายย้อนหลัง";draw(root);return;}
  state.submitting=true;state.submitError="";state.requestId=state.requestId||newRequestId();draw(root);
  const sale=buildSalePayload();
  try{
    const result=await runtime.api.saveSale(runtime.session,sale,state.requestId);
    state.submitting=false;state.requestId="";state.mobileCartOpen=false;
    state.lastBill={...result,seller:runtime.userName||result.seller||"ไม่ระบุ",items:buildSaleItems(),pcs:totals().pieces,payment:sale.payment,channel:sale.channel,shippingCost:totals().shipping,discountType:state.discountType,lumpSum:state.discountType===1?(Number(state.lumpDiscount)||0):0,cash:state.cash};
    state.successOpen=true;draw(root);
  }catch(error){state.submitting=false;state.submitError=String(error&&error.message?error.message:error);draw(root);}
}
async function newSale(root){
  state.cart=[];state.step=0;state.cash=0;state.shipping=0;state.shippingOpen=false;state.discountType=0;state.discountAll=0;state.lumpDiscount=0;state.editingDiscount=null;state.unlockStock=false;state.backdate=false;state.backdateValue="";state.successOpen=false;state.printOpen=false;state.receiptHtml="";state.lastBill=null;state.data=null;
  await renderPos(root,runtime.api,runtime.session,runtime.onBack,{level:runtime.level,displayUser:{name:runtime.userName}});
}
function receiptMarkup(buyer){
  const bill=state.lastBill||{},shop=state.data.shop||{},items=bill.items||[];let gross=0,itemDiscount=0,packaging=0;
  const rows=items.map(item=>{const qty=Number(item.qty)||0,price=Number(item.price)||0,disc=Number(item.disc)||0,pkgPrice=Number(item.pkgPrice)||0;gross+=qty*price;itemDiscount+=qty*disc;packaging+=pkgPrice;return `<tr><td><div class="r-item-name">${esc(item.name)}${item.size&&item.size!=="-"?` ${esc(item.size)}`:""}</div>${item.pattern?`<div class="r-item-sub">${esc(item.pattern)}</div>`:""}</td><td>${qty}</td><td>฿${money(price)}</td><td>฿${money(qty*price)}</td></tr>${pkgPrice?`<tr><td colspan="3" class="r-item-sub">📦 ${esc(item.pkgName||"")} x${Number(item.pkgQty)||0}</td><td class="r-right">+฿${money(pkgPrice)}</td></tr>`:""}`;}).join("");
  const lump=Number(bill.lumpSum)||0,totalDiscount=itemDiscount+lump,shopTitle=shop.name||"ร้านค้า",dateText=bill.date||"",logo=shop.logo?`<img src="${escAttr(shop.logo)}" alt="" onerror="this.remove()">`:"";
  return `<article class="receipt ${state.printSize}"><header class="r-header"><div class="r-brand">${logo}<div class="r-shop">${esc(shopTitle)}</div></div><div class="r-addr">${esc(shop.address||"")}</div>${shop.phone?`<div class="r-addr">โทร ${esc(shop.phone)}</div>`:""}${shop.tax_id?`<div class="r-tax">เลขประจำตัวผู้เสียภาษี ${esc(shop.tax_id)}</div>`:""}</header>${buyer&&buyer.name?`<div class="r-line"></div><div class="r-buyer"><b>ผู้ซื้อ:</b><div>${esc(buyer.name)}</div>${buyer.addr?`<div>${esc(buyer.addr)}</div>`:""}${buyer.tax?`<div>เลขผู้เสียภาษี: ${esc(buyer.tax)}</div>`:""}${buyer.phone?`<div>โทร: ${esc(buyer.phone)}</div>`:""}</div>`:""}<div class="r-line-bold"></div><div class="r-row"><span>เลขบิล: ${esc(bill.billNo||"")}</span><span>${esc(dateText)} ${esc(bill.time||"")}</span></div><div class="r-row"><span>ช่องทาง: ${esc(bill.channel||"หน้าร้าน")}</span><span>ผู้ขาย: ${esc(bill.seller||"")}</span></div><div class="r-line"></div><table><thead><tr><th>รายการ</th><th>จำนวน</th><th>ราคา</th><th>รวม</th></tr></thead><tbody>${rows}</tbody></table><div class="r-line"></div><div class="r-row"><span>รวม ${Number(bill.pcs)||0} ชิ้น</span><span>฿${money(gross)}</span></div>${totalDiscount?`<div class="r-row r-discount"><span>ส่วนลด</span><span>-฿${money(totalDiscount)}</span></div>`:""}${packaging?`<div class="r-row"><span>ค่าแพ็คเกจรวม</span><span>+฿${money(packaging)}</span></div>`:""}${Number(bill.shippingCost)?`<div class="r-row"><span>🚚 ค่าขนส่ง</span><span>+฿${money(bill.shippingCost)}</span></div>`:""}<div class="r-grand">ยอดสุทธิ ฿${money(bill.netTotal)}</div><div class="r-row"><span>ชำระ: ${esc(bill.payment||"")}</span><span></span></div>${state.payIndex===0&&Number(bill.cash)>0?`<div class="r-row"><span>รับเงิน</span><span>฿${money(bill.cash)}</span></div><div class="r-row"><b>เงินทอน</b><b>฿${money(Math.max(0,Number(bill.cash)-Number(bill.netTotal)))}</b></div>`:""}<div class="r-line"></div><footer class="r-footer">ขอบคุณที่อุดหนุนครับ 🙏<br>${esc(shopTitle)}</footer></article>`;
}
function printBill(root){const buyer=state.buyerEnabled?{name:root.querySelector("[data-buyer-name]")?.value||"",addr:root.querySelector("[data-buyer-addr]")?.value||"",tax:root.querySelector("[data-buyer-tax]")?.value||"",phone:root.querySelector("[data-buyer-phone]")?.value||""}:null;state.receiptHtml=receiptMarkup(buyer);state.printOpen=false;draw(root);setTimeout(()=>{const cleanup=()=>{state.receiptHtml="";draw(root);window.removeEventListener("afterprint",cleanup);};window.addEventListener("afterprint",cleanup);try{window.focus();window.print();}catch(error){cleanup();state.submitError="เปิดหน้าพิมพ์ไม่สำเร็จ";draw(root);}},200);}
function find(code){return state.cart.find(item=>item.code===code);}
function add(code,root){const product=state.data.products.find(item=>item.code===code);const item=find(code);if(!product)return;if(item){if(state.unlockStock||item.qty<Number(product.stock))item.qty++;}else state.cart.push({...product,qty:1,discount:state.discountAll,packageCode:"",packageQty:0});state.step=0;draw(root);}
function changeQty(code,step,root){const item=find(code),product=state.data.products.find(value=>value.code===code);if(!item||!product)return;const max=state.unlockStock?99999:Number(product.stock)||0;item.qty=Math.max(0,Math.min(max,item.qty+step));if(item.packageQty>item.qty)item.packageQty=item.qty;state.cart=state.cart.filter(value=>value.qty>0);draw(root);}
function changePackageQty(code,step,root){const item=find(code);if(!item)return;item.packageQty=Math.max(0,Math.min(item.qty,(Number(item.packageQty)||0)+step));if(!item.packageQty)item.packageCode="";draw(root);}
function money(value){return (Number(value)||0).toLocaleString("th-TH");}
function esc(value){return String(value??"").replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function escAttr(value){return esc(value);}
