import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { database, dbError } from "./db";
import { required } from "./env";
import type { FileBubble, LineMessage } from "./line";
import { MAX_ATTACHMENTS } from "./attachment-limits";
export const BUCKET = "pp-files";
export const APP_URL = "https://pp-theta-beryl.vercel.app";
export const attachmentIds = z.array(z.uuid()).max(MAX_ATTACHMENTS);
const linkScope = z.object({ file: z.uuid(), parent: z.uuid(), kind: z.enum(["memory","calendar","content"]), group: z.string().nullable(), expires: z.number().int() });
type LinkScope = z.infer<typeof linkScope>;
export function signFileLink(scope: Omit<LinkScope,"expires">, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ ...scope, expires: now + 86400000 })).toString("base64url");
  return `${body}.${createHmac("sha256", required("CRON_SECRET")).update(body).digest("base64url")}`;
}
export function verifyFileLink(value: string, now = Date.now()): LinkScope | null {
  if (value.length > 1500) return null;
  const [body, signature, extra] = value.split(".");
  if (!body || !signature || extra) return null;
  const expected = createHmac("sha256", required("CRON_SECRET")).update(body).digest();
  const supplied = Buffer.from(signature,"base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected,supplied)) return null;
  try { const parsed=linkScope.safeParse(JSON.parse(Buffer.from(body,"base64url").toString()));
    return parsed.success && parsed.data.expires>now && parsed.data.expires<=now+86400000 ? parsed.data : null;
  } catch { return null; }
}
export async function publicFileAllowed(scope: LinkScope) {
  const db=database();
  const parent=await db.from(scope.kind==="memory"?"memories":scope.kind==="content"?"content_items":"calendar_events")
    .select(scope.kind==="memory"?"attachment_ids,visibility,expires_at":scope.kind==="content"?"attachment_ids,archived,group_id":"attachment_ids,enabled,group_id").eq("id",scope.parent).maybeSingle();
  dbError(parent.error);
  const p=parent.data as unknown as {attachment_ids:string[];visibility?:string;expires_at?:string|null;enabled?:boolean;archived?:boolean;group_id?:string|null}|null;
  if (!p?.attachment_ids.includes(scope.file)) return false;
  if (scope.kind==="memory" && (p.visibility!=="shareable" || (p.expires_at && Date.parse(p.expires_at)<=Date.now()))) return false;
  if (scope.kind==="content" && (p.archived || !scope.group || p.group_id!==scope.group)) return false;
  if (scope.kind==="calendar" && (!p.enabled || p.group_id!==scope.group)) return false;
  if (scope.group) { const g=await db.from("permissions").select("enabled").eq("group_id",scope.group).maybeSingle(); dbError(g.error); if(!g.data?.enabled) return false; }
  const file=await db.from("files").select("visibility").eq("id",scope.file).maybeSingle(); dbError(file.error);
  return file.data?.visibility==="shareable";
}
export async function validateAttachments(ids: string[], visibility: string) {
  if (!attachmentIds.safeParse(ids).success || new Set(ids).size!==ids.length) return false;
  if (!ids.length) return true;
  const result=await database().from("files").select("id,visibility").in("id",ids); dbError(result.error);
  return result.data?.length===ids.length && (visibility!=="shareable" || result.data.every(f=>f.visibility==="shareable"));
}
export async function fileMessages(ids: string[], scope: {parent:string;kind:"memory"|"calendar"|"content";group:string|null;private:boolean;shareableOnly?:boolean}): Promise<LineMessage[]> {
  attachmentIds.parse(ids);
  if(!ids.length || (scope.group && scope.private)) return [];
  const orderedIds=[...new Set(ids)];
  const result=await database().from("files").select("id,name,mime,visibility").in("id",orderedIds); dbError(result.error);
  const byId=new Map((result.data||[]).map(file=>[file.id,file]));
  // SQL IN does not preserve order. Omit files that were deleted or made private.
  const files=orderedIds.flatMap(id=>{
    const file=byId.get(id);
    if(!file || ((scope.group || scope.shareableOnly) && file.visibility!=="shareable")) return [];
    const isPrivate=scope.private || file.visibility==="private";
    const url=isPrivate ? `${APP_URL}/api/files/${file.id}` : `${APP_URL}/api/files/${file.id}?key=${signFileLink({file:file.id,parent:scope.parent,kind:scope.kind,group:scope.group})}`;
    return [{name:file.name,isImage:!isPrivate && file.mime==="image/jpeg",url,
      note:isPrivate?"เปิดด้วยบัญชีเจ้าของ PP":"ลิงก์เปิดได้ภายใน 24 ชั่วโมง",
      action:{type:"uri" as const,label:isPrivate?"เปิดไฟล์ส่วนตัว":"เปิดไฟล์",uri:url}}];
  });
  // LINE allows five messages per request. Reserve one for the answer/mention.
  // A single carousel holds all 5–10 attachments without another reply or push.
  if(files.length>4){
    const contents:FileBubble[]=files.map(file=>({
      type:"bubble",
      ...(file.isImage?{hero:{type:"image" as const,url:file.url,size:"full" as const,aspectRatio:"1:1" as const,aspectMode:"fit" as const,action:file.action}}:{}),
      body:{type:"box",layout:"vertical",spacing:"sm",contents:[
        {type:"text",text:file.name,wrap:true,size:"md",weight:"bold"},
        {type:"text",text:file.note,wrap:true,size:"sm"}
      ]},
      footer:{type:"box",layout:"vertical",contents:[{type:"button",action:file.action}]}
    }));
    return [{type:"flex",altText:`ไฟล์แนบ ${files.length} ไฟล์ · เลื่อนดูและกดเปิดแต่ละไฟล์`,contents:{type:"carousel",contents}}];
  }
  return files.map(file=>{
    if(file.isImage) return {type:"image",originalContentUrl:file.url,previewImageUrl:file.url};
    return {type:"template",altText:`ไฟล์: ${file.name}`,template:{type:"buttons",text:`${file.name.slice(0,100)}\n${file.note}`,actions:[file.action]}};
  });
}
export async function memoryFiles(memoryId:string|undefined, sender:string, group:string|null):Promise<LineMessage[]> {
  if(!memoryId) return [];
  const db=database();
  let isOwner=false;
  if(group){
    const g=await db.from("permissions").select("enabled").eq("group_id",group).maybeSingle(); dbError(g.error);
    const f=await db.from("friends").select("blocked").eq("group_id",group).eq("line_user_id",sender).maybeSingle(); dbError(f.error);
    if(!g.data?.enabled || !f.data || f.data.blocked) return [];
  }else{
    const owner=await db.from("owner").select("line_user_id").eq("id",1).single(); dbError(owner.error);
    isOwner=owner.data?.line_user_id===sender;
    if(!isOwner){
      const blocked=await db.from("friends").select("id").eq("line_user_id",sender).eq("blocked",true).limit(1); dbError(blocked.error);
      if(blocked.data?.length) return [];
    }
  }
  const result=await db.from("memories").select("attachment_ids,visibility,expires_at").eq("id",memoryId).maybeSingle(); dbError(result.error);
  const m=result.data;
  if(!m || (!isOwner && m.visibility!=="shareable") || (m.expires_at && Date.parse(m.expires_at)<=Date.now())) return [];
  return fileMessages(m.attachment_ids,{parent:memoryId,kind:"memory",group,private:m.visibility==="private",shareableOnly:!isOwner});
}
