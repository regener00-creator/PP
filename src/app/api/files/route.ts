import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { database, dbError } from "@/lib/db";
import { BUCKET } from "@/lib/library";
import { prepareUpload, MAX_FILE_BYTES } from "@/lib/uploads";
export const runtime="nodejs";
export async function POST(request:Request){
  if(request.headers.get("origin")!==new URL(request.url).origin) return new Response("Forbidden",{status:403});
  await requireAdmin();
  if(Number(request.headers.get("content-length"))>MAX_FILE_BYTES+65536) return Response.json({error:"ไฟล์ต้องมีขนาดไม่เกิน 3 MB"},{status:413});
  const form=await request.formData();
  const file=form.get("file");
  const folder=String(form.get("folder_id")||"");
  if(form.has("visibility") && form.get("visibility")!=="shareable") return Response.json({error:"หน้าตั้งค่ามีการเปลี่ยนแปลง กรุณารีเฟรชหน้าแล้วลองอีกครั้ง"},{status:400});
  const visibility="shareable";
  if(!(file instanceof File) || (folder && !z.uuid().safeParse(folder).success)) return Response.json({error:"ข้อมูลไฟล์ไม่ถูกต้อง"},{status:400});
  let prepared:Awaited<ReturnType<typeof prepareUpload>>;
  try{prepared=await prepareUpload(file);}catch{return Response.json({error:"อัปโหลดไม่ได้: ตรวจชนิดไฟล์และขนาดไม่เกิน 3 MB (รูปไม่เกิน 40 ล้านพิกเซล)"},{status:400});}
  const db=database(); const id=randomUUID(); const path=`${id}/original`;
  if(folder){const found=await db.from("folders").select("id").eq("id",folder).maybeSingle();dbError(found.error);if(!found.data)return Response.json({error:"ไม่พบโฟลเดอร์"},{status:400});}
  const uploaded=await db.storage.from(BUCKET).upload(path,prepared.data,{contentType:prepared.mime,upsert:false,cacheControl:"0"});
  if(uploaded.error) return Response.json({error:"เก็บไฟล์ไม่สำเร็จ ลองอีกครั้ง"},{status:503});
  const saved=await db.from("files").insert({id,folder_id:folder||null,name:prepared.name,object_path:path,mime:prepared.mime,bytes:prepared.data.length,visibility});
  if(saved.error){await db.storage.from(BUCKET).remove([path]);return Response.json({error:"บันทึกไฟล์ไม่สำเร็จ"},{status:503});}
  return Response.json({ok:true,id});
}
