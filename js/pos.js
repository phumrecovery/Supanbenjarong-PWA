let posState={data:null,category:"",query:"",cart:[]};

export async function renderPos(root,api,session){
  if(!posState.data){
    root.innerHTML='<section class="pos-loading"><span class="spinner"></span><p>กำลังโหลดสินค้าหน้าร้าน…</p></section>';
    try{posState.data=await api.posBootstrap(session);}catch(error){
      root.innerHTML='<section class="card"><h1>เปิด POS ไม่สำเร็จ</h1><p class="hint">ไม่สามารถโหลดสินค้าหน้าร้านได้ โปรดลองใหม่อีกครั้ง</p></section>';
      return;
    }
  }
  draw(root,api,session);
}

function draw(root,api,session){
  const data=posState.data;
  if(!data||!data.ok){root.innerHTML='<section class="card"><h1>เปิด POS ไม่สำเร็จ</h1><p class="hint">ไม่พบข้อมูลสินค้าสำหรับผู้ใช้นี้</p></section>';return;}
  const products=filteredProducts(data.products||[]);
  root.innerHTML=`<section class="pos-shell">
    <header class="pos-title"><div><span class="eyebrow">หน้าร้าน</span><h1>ขายสินค้า</h1></div><button class="icon-action" data-pos-action="refresh" aria-label="โหลดข้อมูลล่าสุด">↻</button></header>
    <div class="pos-layout">
      <section class="pos-catalog">
        <div class="category-scroller" role="tablist">${categoryButtons(data.categories||[])}</div>
        <label class="pos-search"><span aria-hidden="true">⌕</span><input data-pos-search type="search" placeholder="ค้นหาชื่อ / รหัส / ลายสินค้า" value="${escapeAttribute(posState.query)}"></label>
        <div class="pos-results"><span>${products.length.toLocaleString("th-TH")} รายการ</span><span>อัปเดตข้อมูลสดจาก GAS</span></div>
        <div class="product-grid">${products.map(productCard).join("")||'<p class="empty-state">ไม่พบสินค้าที่ค้นหา</p>'}</div>
      </section>
      <aside class="pos-cart" aria-label="ตะกร้าสินค้า">${cartMarkup()}</aside>
    </div>
  </section>`;
  bind(root,api,session);
}

function categoryButtons(categories){
  const all=['',...categories];
  return all.map(category=>`<button class="category-chip ${posState.category===category?'active':''}" data-pos-category="${escapeAttribute(category)}" role="tab">${category?escapeHtml(category):'ทั้งหมด'}</button>`).join('');
}

function filteredProducts(products){
  const term=posState.query.trim().toLocaleLowerCase('th');
  return products.filter(product=>{
    if(posState.category&&product.category!==posState.category)return false;
    if(!term)return true;
    return [product.code,product.name,product.pattern,product.size,product.category].join(' ').toLocaleLowerCase('th').includes(term);
  }).slice(0,120);
}

function productCard(product){
  const stock=Number(product.stock)||0;
  const image=product.img?`<img loading="lazy" src="${escapeAttribute(product.img)}" alt="" onerror="this.closest('.product-image').classList.add('no-image')">`:'<span class="product-fallback" aria-hidden="true">☕</span>';
  return `<article class="product-card"><div class="product-image">${image}<span class="stock-badge ${stock>0?'':'out'}">${stock>0?'เหลือ '+stock:'หมด'}</span></div><div class="product-body"><span class="product-code">${escapeHtml(product.code)}</span><h2>${escapeHtml(product.name)}</h2>${product.pattern?`<p class="product-pattern">${escapeHtml(product.pattern)}</p>`:''}<div class="product-foot"><strong>฿${money(product.priceRetail)}</strong><button data-pos-add="${escapeAttribute(product.code)}" ${stock<=0?'disabled':''}>เพิ่ม</button></div></div></article>`;
}

function cartMarkup(){
  const count=posState.cart.reduce((sum,item)=>sum+item.qty,0);
  const total=posState.cart.reduce((sum,item)=>sum+(item.qty*item.priceRetail),0);
  const rows=posState.cart.map(item=>`<li><div><strong>${escapeHtml(item.name)}</strong><small>฿${money(item.priceRetail)} / ชิ้น</small></div><div class="qty-control"><button data-pos-qty="${escapeAttribute(item.code)}" data-step="-1" aria-label="ลดจำนวน">−</button><span>${item.qty}</span><button data-pos-qty="${escapeAttribute(item.code)}" data-step="1" aria-label="เพิ่มจำนวน">+</button></div></li>`).join('');
  return `<div class="cart-head"><div><span class="eyebrow">ตะกร้าสินค้า</span><h2>${count?count+' ชิ้น':'ยังไม่มีสินค้า'}</h2></div>${count?'<button class="text-action" data-pos-action="clear">ล้าง</button>':''}</div>${rows?`<ul class="cart-lines">${rows}</ul>`:'<div class="cart-empty"><span>🛒</span><p>กด “เพิ่ม” เพื่อใส่สินค้าในตะกร้า</p></div>'}<div class="cart-total"><span>ยอดรวม</span><strong>฿${money(total)}</strong></div><button class="checkout-button" disabled>ออกบิลเร็ว ๆ นี้</button><p class="cart-note">รอบนี้เปิดเฉพาะเลือกสินค้าและตะกร้า การบันทึกบิลยังใช้ POS เดิมเพื่อคงการตรวจสต๊อกและ LockService</p>`;
}

function bind(root,api,session){
  root.querySelectorAll('[data-pos-category]').forEach(button=>button.addEventListener('click',()=>{posState.category=button.dataset.posCategory;draw(root,api,session);}));
  const search=root.querySelector('[data-pos-search]');
  search.addEventListener('input',()=>{posState.query=search.value;refreshProducts(root,api,session);});
  root.querySelectorAll('[data-pos-add]').forEach(button=>button.addEventListener('click',()=>add(button.dataset.posAdd,root,api,session)));
  root.querySelectorAll('[data-pos-qty]').forEach(button=>button.addEventListener('click',()=>changeQty(button.dataset.posQty,Number(button.dataset.step),root,api,session)));
  root.querySelectorAll('[data-pos-action]').forEach(button=>button.addEventListener('click',async()=>{
    if(button.dataset.posAction==='clear'){posState.cart=[];draw(root,api,session);}
    if(button.dataset.posAction==='refresh'){posState.data=null;await renderPos(root,api,session);}
  }));
}

function refreshProducts(root,api,session){
  const products=filteredProducts(posState.data.products||[]);
  root.querySelector('.product-grid').innerHTML=products.map(productCard).join('')||'<p class="empty-state">ไม่พบสินค้าที่ค้นหา</p>';
  root.querySelector('.pos-results span').textContent=`${products.length.toLocaleString("th-TH")} รายการ`;
  root.querySelectorAll('[data-pos-add]').forEach(button=>button.addEventListener('click',()=>add(button.dataset.posAdd,root,api,session)));
}

function add(code,root,api,session){
  const product=posState.data.products.find(item=>item.code===code);
  const line=posState.cart.find(item=>item.code===code);
  if(!product)return;
  if(line){if(line.qty<Number(product.stock))line.qty++;}else{posState.cart.push({...product,qty:1});}
  draw(root,api,session);
}

function changeQty(code,step,root,api,session){
  const line=posState.cart.find(item=>item.code===code);
  const product=posState.data.products.find(item=>item.code===code);
  if(!line||!product)return;
  line.qty=Math.max(0,Math.min(Number(product.stock)||0,line.qty+step));
  posState.cart=posState.cart.filter(item=>item.qty>0);
  draw(root,api,session);
}

function money(value){return (Number(value)||0).toLocaleString('th-TH');}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function escapeAttribute(value){return escapeHtml(value);}
