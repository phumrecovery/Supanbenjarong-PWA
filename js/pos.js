// POS PWA uses the same visual hierarchy as 07_Sales.html.  It is deliberately
// read-only for checkout until saveSale's LockService path is migrated safely.
let posState={data:null,category:"",query:"",cart:[]};
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
    <header class="legacy-pos-topbar">
      <div class="legacy-pos-heading"><button class="legacy-back-btn" type="button" data-pos-action="back">← กลับ</button><h1>🧾 ขายของ</h1></div>
      <div class="legacy-pos-actions"><select aria-label="ช่องทางการขาย"><option>หน้าร้าน</option></select><button class="legacy-lock-btn" type="button" disabled>🔒 ปลดล็อกสต๊อก</button><button class="legacy-history-btn" type="button" disabled>🕘 ย้อนหลัง</button></div>
    </header>
    <div class="legacy-pos-content"><div class="legacy-pos-layout">
      <section class="legacy-pos-products">
        <div class="category-tools"><button type="button" disabled>⚙️ จัดเรียงหมวด</button></div>
        <div class="category-bar" role="tablist">${categoryButtons(data.categories||[])}</div>
        <label class="legacy-search"><span>🔍</span><input data-pos-search type="search" placeholder="ค้นหาสินค้า..." value="${escapeAttribute(posState.query)}"></label>
        <div class="legacy-results"><span>${products.length.toLocaleString("th-TH")} รายการ</span><span>ข้อมูลล่าสุดจาก GAS</span></div>
        <div class="legacy-product-grid">${products.map(productCard).join("")||'<div class="legacy-empty">🔎<br>ไม่พบสินค้า</div>'}</div>
      </section>
      <aside class="legacy-pos-cart" aria-label="ตะกร้าสินค้า">${cartMarkup()}</aside>
    </div></div>
  </section>`;
  bind(root);
}

function categoryButtons(categories){return ["",...categories].map(category=>`<button class="legacy-category-btn ${posState.category===category?"active":""}" type="button" data-pos-category="${escapeAttribute(category)}" role="tab">${category?escapeHtml(category):"ทั้งหมด"}</button>`).join("");}
function filteredProducts(products){const term=posState.query.trim().toLocaleLowerCase("th");return products.filter(product=>{if(posState.category&&product.category!==posState.category)return false;return !term||[product.code,product.name,product.pattern,product.size,product.category].join(" ").toLocaleLowerCase("th").includes(term);}).slice(0,120);}
function patternCode(pattern){const value=String(pattern||"");if(value.includes("ครึ่ง"))return "HF";if(value.includes("เต็ม"))return "FU";if(value.includes("มุก")&&value.includes("ดอก"))return "MP-FLOWER";if(value.includes("มุก"))return "MP-GOLD";if(value.includes("คราม"))return "KR";return "OT";}
function patternLabel(pattern){const value=String(pattern||"");if(value.includes("ครึ่ง"))return "เบญจรงค์ครึ่งใบ";if(value.includes("เต็ม"))return "เบญจรงค์เต็มใบ";return value||"อื่น ๆ";}
function productCard(product){const stock=Number(product.stock)||0;const image=product.img?`<img loading="lazy" src="${escapeAttribute(product.img)}" alt="" onerror="this.parentElement.classList.add('no-image')">`:'<span class="legacy-product-fallback">🏺</span>';return `<button type="button" class="legacy-product-card" data-pos-add="${escapeAttribute(product.code)}" ${stock<=0?"disabled":""}><span class="legacy-product-image">${image}</span><span class="legacy-product-info"><span class="legacy-product-name">${escapeHtml(product.name)}${product.size&&product.size!=="-"?` ${escapeHtml(product.size)}`:""}</span><span class="legacy-pattern-badge pat-${patternCode(product.pattern)}">${escapeHtml(patternLabel(product.pattern))}</span><strong class="legacy-product-price">฿${money(product.priceRetail)}</strong></span><span class="legacy-stock-chip ${stock>0?"":"zero"}">${stock>0?`คงเหลือ ${stock}`:"หมด"}</span></button>`;}
function cartMarkup(){const count=posState.cart.reduce((sum,item)=>sum+item.qty,0);const total=posState.cart.reduce((sum,item)=>sum+(item.qty*item.priceRetail),0);if(!count)return '<div class="legacy-cart-empty"><div class="legacy-cart-icon">🛒</div><div class="legacy-cart-message">ยังไม่มีสินค้าในตะกร้า</div><div>กดที่สินค้าเพื่อเพิ่มลงตะกร้า</div></div>';const rows=posState.cart.map(item=>`<div class="legacy-cart-item"><div class="legacy-cart-item-info"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.pattern||"")} · ฿${money(item.priceRetail)}</span></div><div class="legacy-qty"><button data-pos-qty="${escapeAttribute(item.code)}" data-step="-1">−</button><b>${item.qty}</b><button data-pos-qty="${escapeAttribute(item.code)}" data-step="1">+</button></div><strong>฿${money(item.qty*item.priceRetail)}</strong></div>`).join("");return `<div class="legacy-cart-title">🛒 ตะกร้า (${count} รายการ)</div>${rows}<div class="legacy-cart-summary"><span>ยอดรวม</span><strong>฿${money(total)}</strong></div><button class="legacy-checkout" type="button" disabled>คิดเงิน ฿${money(total)} ➡️</button><p class="legacy-cart-note">การออกบิลจะเปิดหลังเชื่อมเส้นทางตรวจสต๊อกและ LockService เดิมครบแล้ว</p>`;}
function bind(root){const search=root.querySelector("[data-pos-search]");search.addEventListener("input",()=>{posState.query=search.value;refreshProducts(root);});if(root.dataset.posEventsBound)return;root.dataset.posEventsBound="1";root.addEventListener("click",async event=>{const button=event.target.closest("button");if(!button)return;if(button.dataset.posAction==="back"){posRuntime.onBack&&posRuntime.onBack();return;}if(button.dataset.posCategory!==undefined){posState.category=button.dataset.posCategory;draw(root);return;}if(button.dataset.posAdd){add(button.dataset.posAdd,root);return;}if(button.dataset.posQty){changeQty(button.dataset.posQty,Number(button.dataset.step),root);return;}});}
function refreshProducts(root){const products=filteredProducts(posState.data.products||[]);root.querySelector(".legacy-product-grid").innerHTML=products.map(productCard).join("")||'<div class="legacy-empty">🔎<br>ไม่พบสินค้า</div>';root.querySelector(".legacy-results span").textContent=`${products.length.toLocaleString("th-TH")} รายการ`;}
function add(code,root){const product=posState.data.products.find(item=>item.code===code);const line=posState.cart.find(item=>item.code===code);if(!product)return;if(line){if(line.qty<Number(product.stock))line.qty++;}else posState.cart.push({...product,qty:1});draw(root);}
function changeQty(code,step,root){const line=posState.cart.find(item=>item.code===code);const product=posState.data.products.find(item=>item.code===code);if(!line||!product)return;line.qty=Math.max(0,Math.min(Number(product.stock)||0,line.qty+step));posState.cart=posState.cart.filter(item=>item.qty>0);draw(root);}
function money(value){return (Number(value)||0).toLocaleString("th-TH");}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function escapeAttribute(value){return escapeHtml(value);}
