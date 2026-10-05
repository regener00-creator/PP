import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { database, dbError } from "@/lib/db";
import { BUCKET, verifyFileLink, publicFileAllowed } from "@/lib/library";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!z.uuid().safeParse(id).success)return new Response("Not found",{status:404});
  const key=new URL(request.url).searchParams.get("key");
  if(key){
    const scope=verifyFileLink(key);
    if(!scope || scope.file!==id || !await publicFileAllowed(scope)) return new Response("ลิงก์หมดอายุหรือไม่มีสิทธิ์เปิดไฟล์ กรุณาถาม PP ใหม่",{status:403,headers:{"Cache-Control":"private, no-store"}});
  }else await requireAdmin(`/api/files/${id}`);
  const db=database(); const file=await db.from("files").select("object_path,name,mime").eq("id",id).maybeSingle();dbError(file.error);
  if(!file.data)return new Response("Not found",{status:404});
  const result=await db.storage.from(BUCKET).download(file.data.object_path);
  if(result.error || !result.data)return new Response("File unavailable",{status:404});
  return new Response(result.data,{headers:{"Content-Type":file.data.mime,"Content-Disposition":`${file.data.mime==="image/jpeg"?"inline":"attachment"}; filename*=UTF-8''${encodeURIComponent(file.data.name)}`,"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
}
