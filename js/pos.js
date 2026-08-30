// Visual and calculation flow mirrors 07_Sales.html. Writing a sale remains
// intentionally unavailable until the original saveSale/LockService flow is
// exposed through the authenticated API.
let posState={data:null,category:"",query:"",cart:[],step:"items",discountType:"perItem",discountAll:0,lumpDiscount:0,payment:"เงินสด",cashReceived:0,shipping:0};
let posRuntime={api:null,session:"",onBack:null};

export async function renderPos(root,api,session,onBack){
  posRuntime={api,session,onBack};
  if(!posState.data){
    root.innerHTML='<section class="pos-loading"><span class="spinner"></span><p>กำลังโหลดข้อมูล...</p></section>';
    try{posState.data=await api.posBootstrap(session);}catch(error){root.innerHTML='<section class="card"><h1>เปิดหน้าขายของไม่สำเร็จ</h1><p class="hint">ไม่สามารถโหลดสินค้าหน้าร้านได้ โปรดลองใหม่อีกครั้ง</p></section>';return;}
  }
  draw(root);
}

function draw(root){
  const data=posState.data;
  if(!data||!data.ok){root.innerHTML='<section class="card"><h1>เปิด POS ไม่สำเร็จ</h1><p class="hint">ไม่พบข้อมูลสินค้าสำหรับผู้ใช้นี้</p></section>';return;}
  const products=filteredProducts(data.products||[]);
  root.innerHTML=`<section class="legacy-pos-page">
    <header class="legacy-pos-topbar"><div class="legacy-pos-heading"><button class="legacy-back-btn" type="button" data-pos-action="back">← กลับ</button><h1>🧾 ขายของ</h1></div><div class="legacy-pos-actions"><select aria-label="ช่องทางการขาย"><option>หน้าร้าน</option></select><button class="legacy-lock-btn" type="button" disabled>🔒 ปลดล็อกสต๊อก</button><button class="legacy-history-btn" type="button" disabled>🕘 ย้อนหลัง</button></div></header>
    <div class="legacy-pos-content"><div class="legacy-pos-layout"><section class="legacy-pos-products"><div class="category-tools"><button type="button" disabled>⚙️ จัดเรียงหมวด</button></div><div class="category-bar" role="tablist">${categoryButtons(data.categories||[])}</div><label class="legacy-search"><span>🔍</span><input data-pos-search type="search" placeholder="ค้นหาสินค้า..." value="${escapeAttribute(posState.query)}"></label><div class="legacy-results"><span>${products.length.toLocaleString("th-TH")} รายการ</span><span>ข้อมูลล่าสุดจาก GAS</span></div><div class="legacy-product-grid">${products.map(productCard).join("")||'<div class="legacy-empty">🔎<br>ไม่พบสินค้า</div>'}</div></section><aside class="legacy-pos-cart" aria-label="ตะกร้าสินค้า">${cartMarkup()}</aside></div></div>
  </section>`;
  bind(root);
}

function categoryButtons(categories){return ["",...categories].map(category=>`<button class="legacy-category-btn ${posState.category===category?"active":""}" type="button" data-pos-category="${escapeAttribute(category)}" role="tab">${category?escapeHtml(category):"ทั้งหมด"}</button>`).join("");}
function filteredProducts(products){const term=posState.query.trim().toLocaleLowerCase("th");return products.filter(product=>{if(posState.category&&product.category!==posState.category)return false;return !term||[product.code,product.name,product.pattern,product.size,product.category].join(" ").toLocaleLowerCase("th").includes(term);}).slice(0,120);}
function patternCode(pattern){const value=String(pattern||"");if(value.includes("ครึ่ง"))return "HF";if(value.includes("เต็ม"))return "FU";if(value.includes("มุก")&&value.includes("ดอก"))return "MP-FLOWER";if(value.includes("มุก"))return "MP-GOLD";if(value.includes("คราม"))return "KR";return "OT";}
function patternLabel(pattern){const value=String(pattern||"");if(value.includes("ครึ่ง"))return "เบญจรงค์ครึ่งใบ";if(value.includes("เต็ม"))return "เบญจรงค์เต็มใบ";return value||"อื่น ๆ";}
function productCard(product){const stock=Number(product.stock)||0;const image=product.img?`<img loading="lazy" src="${escapeAttribute(product.img)}" alt="" onerror="this.parentElement.classList.add('no-image')">`:'<span class="legacy-product-fallback">🏺</span>';return `<button type="button" class="legacy-product-card" data-pos-add="${escapeAttribute(product.code)}" ${stock<=0?"disabled":""}><span class="legacy-product-image">${image}</span><span class="legacy-product-info"><span class="legacy-product-name">${escapeHtml(product.name)}${product.size&&product.size!=="-"?` ${escapeHtml(product.size)}`:""}</span><span class="legacy-pattern-badge pat-${patternCode(product.pattern)}">${escapeHtml(patternLabel(product.pattern))}</span><strong class="legacy-product-price">฿${money(product.priceRetail)}</strong></span><span class="legacy-stock-chip ${stock>0?"":"zero"}">${stock>0?`คงเหลือ ${stock}`:"หมด"}</span></button>`;}

function totals(){
  let gross=0,itemDiscount=0,packaging=0,pcs=0;
  posState.cart.forEach(item=>{const qty=Number(item.qty)||0;pcs+=qty;gross+=qty*(Number(item.priceRetail)||0);itemDiscount+=qty*(Number(item.discount)||0);packaging+=packageCost(item);});
  const lump=posState.discountType==="lump"?Number(posState.lumpDiscount)||0:0;
  const shipping=Number(posState.shipping)||0;
  return {pcs,gross,itemDiscount,lump,packaging,shipping,net:Math.max(0,gross-itemDiscount-lump+packaging+shipping)};
}
function packageOptions(item){const options=(posState.data.packaging||[]);return `<option value="">+ เพิ่มแพ็กเกจ</option>${options.map(pack=>`<option value="${escapeAttribute(pack.code)}" ${item.packageCode===pack.code?"selected":""}>${escapeHtml(pack.name)}${pack.size?` ${escapeHtml(pack.size)}`:""} · ฿${money(pack.price)}</option>`).join("")}`;}
function packageCost(item){const pack=(posState.data.packaging||[]).find(value=>value.code===item.packageCode);return pack?(Number(pack.price)||0)*(Number(item.packageQty)||0):0;}
function cartMarkup(){return posState.step==="checkout"?checkoutMarkup():itemsMarkup();}
function emptyCart(){return '<div class="legacy-cart-empty"><div class="legacy-cart-icon">🛒</div><div class="legacy-cart-message">ยังไม่มีสินค้าในตะกร้า</div><div>กดที่สินค้าเพื่อเพิ่มลงตะกร้า</div></div>';}
function itemsMarkup(){
  if(!posState.cart.length)return emptyCart();
  const total=totals();
  const rows=posState.cart.map(item=>`<div class="legacy-cart-item rich"><div class="legacy-cart-item-info"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.pattern||"")} · ฿${money(item.priceRetail)}</span><div class="legacy-package-row"><select data-pos-package="${escapeAttribute(item.code)}">${packageOptions(item)}</select>${item.packageCode?`<span class="legacy-package-qty"><button data-pos-package-qty="${escapeAttribute(item.code)}" data-step="-1">−</button><b>${item.packageQty||0}</b><button data-pos-package-qty="${escapeAttribute(item.code)}" data-step="1">+</button></span>`:""}</div></div><div class="legacy-qty"><button data-pos-qty="${escapeAttribute(item.code)}" data-step="-1">−</button><b>${item.qty}</b><button data-pos-qty="${escapeAttribute(item.code)}" data-step="1">+</button></div><strong>฿${money(item.qty*item.priceRetail-item.qty*(item.discount||0)+packageCost(item))}</strong><button class="legacy-remove" data-pos-remove="${escapeAttribute(item.code)}" aria-label="ลบสินค้า">×</button></div>`).join("");
  return `<div class="legacy-cart-title">🛒 ตะกร้า (${posState.cart.length} รายการ)</div>${rows}<div class="legacy-cart-summary"><span>ยอดรวม</span><strong>฿${money(total.net)}</strong></div><button class="legacy-checkout success" type="button" data-pos-action="checkout">คิดเงิน ฿${money(total.net)} ➡️</button>`;
}
function safeCheckoutMarkup(){
  const total=totals();
  const paymentNames=["เงินสด","โอนเงิน","บัตรเครดิต"];
  const discounts=[0,10,20,30,50].map(value=>`<button type="button" data-pos-discount="${value}" class="${posState.discountType==="perItem"&&Number(posState.discountAll)===value?"active":""}">${value===0?"ไม่ลด":"฿"+value}</button>`).join("");
  const payments=paymentNames.map(name=>`<button type="button" data-pos-payment="${name}" class="${posState.payment===name?"active":""}>${name}</button>`).join("");
  const lump=posState.discountType==="lump"?`<label class="checkout-input-label">ลดเหมายอดสุดท้าย<input type="number" min="0" data-pos-lump value="${Number(posState.lumpDiscount)||""}" placeholder="0"></label>`:"";
  const cash=posState.payment==="เงินสด"?`<label class="checkout-input-label cash">💵 ลูกค้าจ่าย<input type="number" min="0" data-pos-cash value="${Number(posState.cashReceived)||""}" placeholder="0"></label>`:"";
  const summary=[`<div><span>รวม ${total.pcs} ชิ้น</span><b>฿${money(total.gross)}</b></div>`,total.itemDiscount?`<div class="danger"><span>ส่วนลดต่อชิ้น</span><b>-฿${money(total.itemDiscount)}</b></div>`:"",total.lump?`<div class="danger"><span>ลดเหมา</span><b>-฿${money(total.lump)}</b></div>`:"",total.packaging?`<div><span>ค่าแพ็กเกจ</span><b>+฿${money(total.packaging)}</b></div>`:"",total.shipping?`<div><span>🚚 ค่าขนส่ง</span><b>+฿${money(total.shipping)}</b></div>`:"",`<div class="grand"><span>ยอดสุทธิ</span><b>฿${money(total.net)}</b></div>`].join("");
  return `<button class="legacy-edit-cart" type="button" data-pos-action="items">⬅️ กลับไปแก้รายการ</button><section class="checkout-section"><h3>💰 ส่วนลดรวม</h3><div class="legacy-pills">${discounts}<button type="button" data-pos-action="custom-discount" class="${posState.discountType==="lump"?"active":""}>✏️ กำหนดเอง</button></div>${lump}</section><section class="checkout-section"><h3>💳 วิธีชำระ</h3><div class="legacy-pills payments">${payments}</div>${cash}</section><section class="checkout-section"><h3>🚚 ค่าขนส่ง (เหมาต่อบิล)</h3><label class="checkout-input-label"><input type="number" min="0" data-pos-shipping value="${Number(posState.shipping)||""}" placeholder="0"></label></section><section class="checkout-summary">${summary}</section><button class="legacy-checkout disabled" type="button" disabled>✅ ออกบิล ฿${money(total.net)}</button><p class="legacy-cart-note">ยังไม่เปิดออกบิลใน PWA จนกว่าจะเชื่อม saveSale และ LockService เดิมครบ</p>`;
}
function checkoutMarkup(){
  return safeCheckoutMarkup();
  /*
  const total=totals();
  const paymentNames=["เงินสด","โอนเงิน","บัตรเครดิต"];
  return `<button class="legacy-edit-cart" type="button" data-pos-action="items">⬅️ กลับไปแก้รายการ</button><section class="checkout-section"><h3>💰 ส่วนลดรวม</h3><div class="legacy-pills">${[0,10,20,30,50].map(value=>`<button type="button" data-pos-discount="${value}" class="${posState.discountType==="perItem"&&Number(posState.discountAll)===value?"active":""}">${value===0?"ไม่ลด":`฿${value}`}</button>`).join("")}<button type="button" data-pos-action="custom-discount" class="${posState.discountType==="lump"?"active":""}>✏️ กำหนดเอง</button></div>${posState.discountType==="lump"?`<label class="checkout-input-label">ลดเหมายอดสุดท้าย<input type="number" min="0" data-pos-lump value="${Number(posState.lumpDiscount)||""}" placeholder="0"></label>`:""}</section><section class="checkout-section"><h3>💳 วิธีชำระ</h3><div class="legacy-pills payments">${paymentNames.map(name=>`<button type="button" data-pos-payment="${name}" class="${posState.payment===name?"active":""}">${name}</button>`).join("")}</div>${posState.payment==="เงินสด"?`<label class="checkout-input-label cash">💵 ลูกค้าจ่าย<input type="number" min="0" data-pos-cash value="${Number(posState.cashReceived)||""}" placeholder="0"><span class="legacy-pills cash-pills">${[500,1000,1500,2000].filter(value=>value>=total.net).map(value=>`<button type="button" data-pos-cash-quick="${value}">฿${money(value)}</button>`).join("")}<button type="button" data-pos-cash-quick="exact">พอดี</button></span>${Number(posState.cashReceived)>0?`<b class="change-display">เงินทอน ฿${money(Math.max(0,Number(posState.cashReceived)-total.net))}</b>`:""}</label>`:""}</section><section class="checkout-section"><h3>🚚 ค่าขนส่ง (เหมาต่อบิล)</h3><label class="checkout-input-label"><input type="number" min="0" data-pos-shipping value="${Number(posState.shipping)||""}" placeholder="0"></label></section><section class="checkout-summary"><div><span>รวม ${total.pcs} ชิ้น</span><b>฿${money(total.gross)}</b></div>${total.itemDiscount?`<div class="danger"><span>ส่วนลดต่อชิ้น</span><b>-฿${money(total.itemDiscount)}</b></div>`:""}${total.lump?`<div class="danger"><span>ลดเหมา</span><b>-฿${money(total.lump)}</b></div>`:""}${total.packaging?`<div><span>ค่าแพ็กเกจ</span><b>+฿${money(total.packaging)}</b></div>`:""}${total.shipping?`<div><span>🚚 ค่าขนส่ง</span><b>+฿${money(total.shipping)}</b></div>`:""}<div class="grand"><span>ยอดสุทธิ</span><b>฿${money(total.net)}</b></div></section><button class="legacy-checkout disabled" type="button" disabled>✅ ออกบิล ฿${money(total.net)}</button><p class="legacy-cart-note">ยังไม่เปิดออกบิลใน PWA จนกว่าจะเชื่อม `saveSale` และ LockService เดิมครบ</p>`;
}

  */
}

function bind(root){
  const search=root.querySelector("[data-pos-search]");
  search.addEventListener("input",()=>{posState.query=search.value;refreshProducts(root);});
  root.querySelectorAll("[data-pos-package]").forEach(select=>select.addEventListener("change",()=>setPackage(select.dataset.posPackage,select.value,root)));
  root.querySelectorAll("[data-pos-lump]").forEach(input=>input.addEventListener("input",()=>{posState.lumpDiscount=Math.max(0,Number(input.value)||0);draw(root);}));
  root.querySelectorAll("[data-pos-cash]").forEach(input=>input.addEventListener("input",()=>{posState.cashReceived=Math.max(0,Number(input.value)||0);draw(root);}));
  root.querySelectorAll("[data-pos-shipping]").forEach(input=>input.addEventListener("input",()=>{posState.shipping=Math.max(0,Number(input.value)||0);draw(root);}));
  if(root.dataset.posEventsBound)return;
  root.dataset.posEventsBound="1";
  root.addEventListener("click",event=>{const button=event.target.closest("button");if(!button)return;if(button.dataset.posAction==="back"){posRuntime.onBack&&posRuntime.onBack();return;}if(button.dataset.posAction==="checkout"){posState.step="checkout";draw(root);return;}if(button.dataset.posAction==="items"){posState.step="items";draw(root);return;}if(button.dataset.posAction==="custom-discount"){posState.discountType="lump";draw(root);return;}if(button.dataset.posCategory!==undefined){posState.category=button.dataset.posCategory;draw(root);return;}if(button.dataset.posAdd){add(button.dataset.posAdd,root);return;}if(button.dataset.posQty){changeQty(button.dataset.posQty,Number(button.dataset.step),root);return;}if(button.dataset.posPackageQty){changePackageQty(button.dataset.posPackageQty,Number(button.dataset.step),root);return;}if(button.dataset.posRemove){posState.cart=posState.cart.filter(item=>item.code!==button.dataset.posRemove);draw(root);return;}if(button.dataset.posDiscount!==undefined){posState.discountType="perItem";posState.discountAll=Number(button.dataset.posDiscount)||0;posState.cart.forEach(item=>item.discount=posState.discountAll);draw(root);return;}if(button.dataset.posPayment){posState.payment=button.dataset.posPayment;draw(root);return;}if(button.dataset.posCashQuick){posState.cashReceived=button.dataset.posCashQuick==="exact"?totals().net:Number(button.dataset.posCashQuick);draw(root);}});
}
function refreshProducts(root){const products=filteredProducts(posState.data.products||[]);root.querySelector(".legacy-product-grid").innerHTML=products.map(productCard).join("")||'<div class="legacy-empty">🔎<br>ไม่พบสินค้า</div>';root.querySelector(".legacy-results span").textContent=`${products.length.toLocaleString("th-TH")} รายการ`;}
function add(code,root){const product=posState.data.products.find(item=>item.code===code);const line=posState.cart.find(item=>item.code===code);if(!product)return;if(line){if(line.qty<Number(product.stock))line.qty++;}else posState.cart.push({...product,qty:1,discount:posState.discountAll,packageCode:"",packageQty:0});posState.step="items";draw(root);}
function changeQty(code,step,root){const line=posState.cart.find(item=>item.code===code);const product=posState.data.products.find(item=>item.code===code);if(!line||!product)return;line.qty=Math.max(0,Math.min(Number(product.stock)||0,line.qty+step));if(line.packageQty>line.qty)line.packageQty=line.qty;posState.cart=posState.cart.filter(item=>item.qty>0);draw(root);}
function setPackage(code,packageCode,root){const line=posState.cart.find(item=>item.code===code);if(!line)return;line.packageCode=packageCode;line.packageQty=packageCode?Math.min(line.qty,1):0;draw(root);}
function changePackageQty(code,step,root){const line=posState.cart.find(item=>item.code===code);if(!line)return;line.packageQty=Math.max(0,Math.min(line.qty,(Number(line.packageQty)||0)+step));if(!line.packageQty)line.packageCode="";draw(root);}
function money(value){return (Number(value)||0).toLocaleString("th-TH");}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function escapeAttribute(value){return escapeHtml(value);}
