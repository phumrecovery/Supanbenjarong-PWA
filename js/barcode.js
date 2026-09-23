const LAST_BATCH_KEY="suphanbenjarong.pwa.barcode-last";
const STICKERS_PER_PAGE=90;
const esc=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[char]));
const money=value=>(Number(value)||0).toLocaleString("th-TH");
function lastBatch(){try{const saved=JSON.parse(localStorage.getItem(LAST_BATCH_KEY)||"[]");return Array.isArray(saved)?saved.filter(item=>item?.code&&Number(item.qty)>0):[];}catch(error){return [];}}
function saveBatch(queue){try{localStorage.setItem(LAST_BATCH_KEY,JSON.stringify(queue));}catch(error){}}
function stickers(queue){return queue.flatMap(item=>Array.from({length:Number(item.qty)||0},()=>item));}

export function renderBarcode(root,api,session,goBack,{toast=()=>{}}={}){
  const viewId=root._barcodeViewId=(root._barcodeViewId||0)+1;
  const state={products:[],queue:[],query:"",loading:true,error:"",preview:false,loadId:0};
  const current=()=>root.isConnected&&root.dataset.route==="barcode"&&root._barcodeViewId===viewId;
  const total=()=>state.queue.reduce((sum,item)=>sum+(Number(item.qty)||0),0);
  const queueHtml=()=>!state.queue.length?'<div class="barcode-empty">🏷️ เลือกสินค้าเพื่อเพิ่มลงรายการพิมพ์</div>':state.queue.map((item,index)=>`<article class="barcode-queue-item"><div><div class="barcode-queue-name">${esc(item.name)}${item.size&&item.size!=="-"?` ${esc(item.size)}`:""}</div><div class="barcode-queue-meta">${esc(item.code)} · ฿${money(item.priceRetail)}</div></div><div class="barcode-quantity"><button type="button" class="barcode-qty-btn" data-action="qty" data-index="${index}" data-delta="-1" aria-label="ลดจำนวน">−</button><span class="barcode-qty-value">${item.qty}</span><button type="button" class="barcode-qty-btn" data-action="qty" data-index="${index}" data-delta="1" aria-label="เพิ่มจำนวน">+</button></div><button type="button" class="barcode-delete" data-action="remove" data-index="${index}" aria-label="ลบรายการ">✕</button></article>`).join("");
  const resultHtml=()=>{
    const q=state.query.trim().toLocaleLowerCase("th-TH");if(!q||state.loading||state.error)return "";
    const all=state.products.filter(product=>[product.name,product.code,product.pattern,product.category,product.size].join(" ").toLocaleLowerCase("th-TH").includes(q));
    if(!all.length)return '<div class="barcode-empty">ไม่พบสินค้า</div>';
    return `<div class="barcode-results" role="listbox">${all.slice(0,50).map(product=>`<button type="button" class="barcode-product" data-action="add" data-code="${esc(product.code)}"><span><span class="barcode-product-name">${esc(product.name)}${product.size&&product.size!=="-"?` ${esc(product.size)}`:""}</span><span class="barcode-product-info">${esc(product.code)} | ${esc(product.pattern||"-")}</span></span><span class="barcode-product-price">฿${money(product.priceRetail)}</span></button>`).join("")}${all.length>50?'<div class="barcode-note">แสดง 50 รายการแรก</div>':""}</div>`;
  };
  const previewHtml=()=>{
    if(!state.preview)return "";const items=stickers(state.queue);const pages=[];
    for(let start=0;start<items.length;start+=STICKERS_PER_PAGE){const page=items.slice(start,start+STICKERS_PER_PAGE);const cells=page.map((item,index)=>`<div class="barcode-sticker"><svg id="pwa-barcode-${start+index}"></svg><div class="barcode-sticker-name">${esc([item.name,item.pattern,item.size].filter(value=>value&&value!=="-").join(" "))}</div><div class="barcode-sticker-row"><span class="barcode-sticker-sku">${esc(item.code)}</span><span class="barcode-sticker-price">฿${money(item.priceRetail)}</span></div></div>`);while(cells.length<STICKERS_PER_PAGE)cells.push('<div class="barcode-sticker"></div>');pages.push(`<section class="barcode-sheet">${cells.join("")}</section>`);}
    return `<div class="barcode-preview-modal" role="dialog" aria-modal="true" aria-label="ตัวอย่างสติกเกอร์ A4"><div class="barcode-preview-toolbar"><button type="button" class="barcode-preview-close" data-action="close-preview" data-popup-close>✕ ปิดตัวอย่าง</button></div>${pages.join("")}</div>`;
  };
  const makeCodes=()=>{
    if(typeof window.JsBarcode!=="function"){toast("โหลดเครื่องมือสร้าง Barcode ไม่สำเร็จ");return;}
    stickers(state.queue).forEach((item,index)=>{const svg=root.querySelector(`#pwa-barcode-${index}`);if(!svg)return;try{window.JsBarcode(svg,item.code,{format:"CODE128",width:2,height:40,displayValue:false,margin:0});const box=svg.getBBox(),pad=box.width*.06;svg.setAttribute("viewBox",`${box.x-pad} ${box.y} ${box.width+pad*2} ${box.height}`);svg.setAttribute("preserveAspectRatio","none");svg.removeAttribute("width");svg.removeAttribute("height");}catch(error){}});
  };
  const draw=()=>{
    if(!current())return;
    const status=state.loading?'<div class="barcode-loading" role="status">⏳ กำลังโหลดสินค้า ค้นหาได้เมื่อข้อมูลพร้อม…</div>':state.error?`<div class="barcode-error" role="alert">❌ ${esc(state.error)}<br><button type="button" class="barcode-retry" data-action="retry">ลองโหลดใหม่</button></div>`:"";
    const body=`<div class="barcode-search"><span class="barcode-search-icon">🔍</span><input id="barcode-search" type="search" autocomplete="off" placeholder="ค้นหาชื่อ / รหัส / ลาย..." value="${esc(state.query)}" aria-label="ค้นหาสินค้า Barcode" ${state.loading||state.error?"disabled":""}></div>${status}${resultHtml()}<section><h2 class="barcode-queue-title">📋 รายการพิมพ์ (${state.queue.length} สินค้า / ${total()} ดวง)</h2>${queueHtml()}</section><button type="button" class="barcode-last" data-action="load-last">🔁 โหลดรายการพิมพ์ครั้งล่าสุด</button><div class="barcode-actions"><button type="button" class="barcode-action barcode-clear" data-action="clear">🗑 ล้าง</button><button type="button" class="barcode-action barcode-preview" data-action="preview">📄 ดูตัวอย่าง</button><button type="button" class="barcode-action barcode-print" data-action="print">🖨 พิมพ์</button></div><p class="barcode-note">💡 ใช้กระดาษ A4 สติกเกอร์ 90 ดวง (6 คอลัมน์ × 15 แถว) พิมพ์ด้วย Epson L3250</p>`;
    root.innerHTML=`<section class="barcode-page"><header class="barcode-top"><button type="button" class="barcode-back" data-action="back">← กลับ</button><h1>🏷️ พิมพ์ Barcode</h1></header><div class="barcode-wrap">${body}</div>${previewHtml()}</section>`;
    if(state.preview)requestAnimationFrame(makeCodes);
  };
  const add=code=>{const product=state.products.find(item=>item.code===code);if(!product)return;const item=state.queue.find(row=>row.code===code);if(item)item.qty++;else state.queue.push({code:product.code,name:product.name,size:product.size||"",pattern:product.pattern||"",priceRetail:Number(product.priceRetail)||0,qty:1});state.query="";toast(`เพิ่ม ${product.name}`);draw();};
  const preview=()=>{if(!state.queue.length){toast("กรุณาเพิ่มสินค้าก่อน");return;}state.preview=true;draw();};
  const load=async()=>{const id=++state.loadId;state.loading=true;state.error="";draw();try{const result=await api.barcodeBootstrap(session);if(!current()||id!==state.loadId)return;if(!result?.ok)throw new Error(result?.message||"โหลดสินค้าไม่สำเร็จ");state.products=(result.products||[]).filter(item=>item?.code&&String(item.status||"").indexOf("เลิก")<0);state.loading=false;draw();toast(`โหลดสินค้า ${state.products.length} รายการ`);}catch(error){if(!current()||id!==state.loadId)return;state.loading=false;state.error=String(error?.message||error||"โหลดสินค้าไม่สำเร็จ");draw();}};
  const printBarcodeSheets=()=>{
    const sheets=[...root.querySelectorAll(".barcode-sheet")];
    if(!sheets.length){toast("ยังสร้างสติกเกอร์ไม่สำเร็จ");return;}
    const frame=document.createElement("iframe");
    frame.setAttribute("aria-hidden","true");
    frame.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    const doc=frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Barcode A4</title><style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}.barcode-sheet{width:210mm;min-height:297mm;margin:0;padding:10mm;box-sizing:border-box;display:flex;flex-wrap:wrap;align-content:flex-start;page-break-after:always}.barcode-sheet:last-child{page-break-after:avoid}.barcode-sticker{width:31.6mm;height:18.4mm;box-sizing:border-box;padding:.6mm 1mm;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;border:.2mm solid #999;text-align:center}.barcode-sticker svg{display:block;width:28mm;height:7mm;margin:0 auto}.barcode-sticker-name{max-width:30mm;margin-top:.2mm;overflow:hidden;color:#333;font:600 4.5pt sans-serif;text-overflow:ellipsis;white-space:nowrap}.barcode-sticker-row{display:flex;justify-content:space-between;width:100%;padding:0 .3mm;color:#444;font:4.5pt sans-serif}.barcode-sticker-sku{font:4pt monospace}.barcode-sticker-price{color:#000;font-size:5pt;font-weight:700}</style></head><body>${sheets.map(sheet=>sheet.outerHTML).join("")}</body></html>`);
    doc.close();
    const print=()=>{try{frame.contentWindow.focus();frame.contentWindow.print();}finally{setTimeout(()=>frame.remove(),1000);}};
    if(frame.contentWindow.document.readyState==="complete")setTimeout(print,0);else frame.addEventListener("load",print,{once:true});
  };
  const beginPrint=()=>{
    if(!state.queue.length){toast("กรุณาเพิ่มสินค้าก่อน");return;}
    saveBatch(state.queue);
    if(!state.preview)preview();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(current()&&state.preview)printBarcodeSheets();}));
  };  root.onclick=event=>{const button=event.target.closest("[data-action]");if(!button)return;const action=button.dataset.action;if(action==="back")return goBack();if(action==="retry")return load();if(action==="add")return add(button.dataset.code);if(action==="qty"){const item=state.queue[Number(button.dataset.index)];if(item){item.qty=Math.max(1,item.qty+Number(button.dataset.delta));draw();}return;}if(action==="remove"){state.queue.splice(Number(button.dataset.index),1);return draw();}if(action==="clear"){if(state.queue.length&&window.confirm("ล้างรายการพิมพ์ทั้งหมด?")){state.queue=[];draw();}return;}if(action==="load-last"){const saved=lastBatch();if(!saved.length){toast("ยังไม่มีรายการพิมพ์ครั้งล่าสุด");return;}state.queue=saved;draw();toast(`โหลดรายการล่าสุด ${saved.length} ชนิด`);return;}if(action==="preview")return preview();if(action==="close-preview"){state.preview=false;return draw();}if(action==="print")return beginPrint();};
  root.oninput=event=>{if(event.target.id!=="barcode-search")return;state.query=event.target.value;draw();const input=root.querySelector("#barcode-search");if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}};
  draw();load();
}
