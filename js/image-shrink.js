/* Photos are made smaller on the device before they are uploaded. Camera photos are 3-5 MB and
   the upload of one product photo took 13 s (17 Oct, ~4 s of it moving the file); a 1600 px JPEG
   is a few hundred KB and still sharp for the zoom view. Receipts and bills keep 2000 px so the
   text stays readable. A photo that is already small is sent unchanged; a format the browser
   cannot draw (e.g. HEIC on some phones) is sent as it was, exactly like before. */
export const PHOTO_PRODUCT={maxSide:1600,quality:.82};
export const PHOTO_DOCUMENT={maxSide:2000,quality:.85};
export const PHOTO_PERSON={maxSide:1200,quality:.85};
const KEEP_BELOW=450*1024;

function readDataUrl(blob){return new Promise((ok,no)=>{const reader=new FileReader();reader.onload=()=>ok(String(reader.result||""));reader.onerror=()=>no(reader.error||new Error("อ่านไฟล์รูปไม่สำเร็จ"));reader.readAsDataURL(blob);});}
function loadImage(file){return new Promise((ok,no)=>{const url=URL.createObjectURL(file),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);ok(image);};image.onerror=()=>{URL.revokeObjectURL(url);no(new Error("decode"));};image.src=url;});}
const jpegName=name=>String(name||"photo").replace(/\.[A-Za-z0-9]{2,5}$/,"")+".jpg";

// Returns {dataUrl,fileName,bytes,shrunk}. Never throws for a picture the browser cannot decode.
export async function shrinkPhoto(file,{maxSide=1600,quality=.82}={}){
  const original=async()=>({dataUrl:await readDataUrl(file),fileName:file.name||"photo.jpg",bytes:file.size,shrunk:false});
  if(!file||!String(file.type||"").startsWith("image/")||/svg|gif/i.test(file.type))return original();
  let image;
  try{image=await loadImage(file);}catch(error){return original();}
  const width=image.naturalWidth||0,height=image.naturalHeight||0;if(!width||!height)return original();
  const scale=Math.min(1,maxSide/Math.max(width,height));
  if(scale===1&&file.size<=KEEP_BELOW&&/jpe?g/i.test(file.type))return original();
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext("2d");
  // White behind transparent PNG areas, otherwise JPEG turns them black.
  context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
  if(!blob||(scale===1&&blob.size>=file.size))return original();
  return {dataUrl:await readDataUrl(blob),fileName:jpegName(file.name),bytes:blob.size,shrunk:true};
}
