import sharp from "sharp";
export const MAX_FILE_BYTES=3*1024*1024;
const TYPES:Record<string,string>={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",zip:"application/zip",txt:"text/plain",csv:"text/csv"};
export async function prepareUpload(file:File) {
  if(!file.size || file.size>MAX_FILE_BYTES) throw Error("ไฟล์ต้องมีขนาดไม่เกิน 3 MB");
  const name=file.name.normalize("NFKC").replace(/[\u0000-\u001f\u007f/\\]/g,"_").slice(0,180);
  const ext=name.split(".").pop()?.toLowerCase()||"";
  let data=Buffer.from(await file.arrayBuffer());
  if(["jpg","jpeg","png","webp"].includes(ext)) {
    data=await sharp(data,{limitInputPixels:40000000}).rotate().resize(1200,1200,{fit:"inside",withoutEnlargement:true}).jpeg({quality:80}).toBuffer();
    if(data.length>1000000) data=await sharp(data).resize(900,900,{fit:"inside"}).jpeg({quality:65}).toBuffer();
    if(data.length>1000000) throw Error("รูปนี้ใหญ่เกินไป กรุณาย่อรูปก่อน");
    return {data,name:name.replace(/\.[^.]+$/,".jpg"),mime:"image/jpeg"};
  }
  const mime=TYPES[ext];
  if(!mime) throw Error("รองรับรูปภาพ PDF, DOCX, XLSX, PPTX, ZIP, TXT และ CSV");
  if(ext==="pdf" && data.subarray(0,5).toString()!=="%PDF-") throw Error("ไฟล์ PDF ไม่ถูกต้อง");
  if(["docx","xlsx","pptx","zip"].includes(ext) && !data.subarray(0,2).equals(Buffer.from("PK"))) throw Error("รูปแบบไฟล์ไม่ถูกต้อง");
  return {data,name,mime};
}
