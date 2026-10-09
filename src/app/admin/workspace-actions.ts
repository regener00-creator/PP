"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { database,dbError } from "@/lib/db";
import { attachmentIds,BUCKET,validateAttachments } from "@/lib/library";
import { MAX_ATTACHMENTS } from "@/lib/attachment-limits";
import { groupId,userId } from "@/lib/line";
import type { ActionState } from "./actions";
function value(f:FormData,k:string){return String(f.get(k)||"");}
function success(message:string){revalidatePath("/admin","layout");return {ok:true,message};}
export async function saveFolder(_:ActionState,form:FormData):Promise<ActionState>{
  await requireAdmin();const name=z.string().trim().min(1).max(80).safeParse(value(form,"name"));
  if(!name.success)return {ok:false,message:"กรุณาใส่ชื่อโฟลเดอร์ไม่เกิน 80 ตัวอักษร"};
  const id=value(form,"id");if(id && !z.uuid().safeParse(id).success)return {ok:false,message:"โฟลเดอร์ไม่ถูกต้อง"};
  const db=database();const r=id?await db.from("folders").update({name:name.data}).eq("id",id):await db.from("folders").insert({name:name.data});
  return r.error?{ok:false,message:"บันทึกไม่ได้ ชื่อโฟลเดอร์อาจซ้ำ"}:success("บันทึกโฟลเดอร์แล้ว");
}
export async function deleteFolder(_:ActionState,form:FormData):Promise<ActionState>{
  await requireAdmin();const id=z.uuid().parse(value(form,"id"));const r=await database().from("folders").delete().eq("id",id);
  return r.error?{ok:false,message:"ย้ายหรือลบไฟล์ในโฟลเดอร์ก่อน"}:success("ลบโฟลเดอร์แล้ว");
}
export async function saveFile(_:ActionState,form:FormData):Promise<ActionState>{
  await requireAdmin();const parsed=z.object({id:z.uuid(),name:z.string().trim().min(1).max(180),folder_id:z.uuid().nullable()}).safeParse({id:value(form,"id"),name:value(form,"name"),folder_id:value(form,"folder_id")||null});
  if(!parsed.success)return {ok:false,message:"ตรวจชื่อไฟล์และโฟลเดอร์อีกครั้ง"};
  const {id,...data}=parsed.data;const r=await database().from("files").update(data).eq("id",id);
  return r.error?{ok:false,message:"บันทึกไม่ได้"}:success("บันทึกไฟล์แล้ว");
}
export async function deleteFile(_:ActionState,form:FormData):Promise<ActionState>{
  await requireAdmin();const id=z.uuid().parse(value(form,"id"));const db=database();
  const file=await db.from("files").select("object_path").eq("id",id).maybeSingle();dbError(file.error);
  if(!file.data)return {ok:false,message:"ไม่พบไฟล์"};
  // Removing the metadata first revokes all app download links immediately.
  const r=await db.from("files").delete().eq("id",id);dbError(r.error);
  const removed=await db.storage.from(BUCKET).remove([file.data.object_path]);
  return success(removed.error?"ลบออกจากคลังแล้ว แต่การล้างไฟล์บนพื้นที่เก็บยังไม่สำเร็จ":"ลบไฟล์แล้ว");
}
export async function saveCalendarEvent(_:ActionState,form:FormData):Promise<ActionState>{
  await requireAdmin();
  const parsed=z.object({title:z.string().trim().min(1).max(120),event_date:z.iso.date(),message:z.string().trim().min(1).max(1500),group_id:groupId.nullable(),mention_user_id:userId.nullable(),attachment_ids:attachmentIds}).safeParse({title:value(form,"title"),event_date:value(form,"event_date"),message:value(form,"message"),group_id:value(form,"group_id")||null,mention_user_id:value(form,"mention_user_id")||null,attachment_ids:form.getAll("attachment_ids").map(String)});
  if(!parsed.success)return {ok:false,message:"ตรวจชื่อ วันที่ ข้อความ และไฟล์แนบอีกครั้ง"};
  const flags={annual:form.has("annual"),enabled:true,remind_day:form.has("remind_day"),remind_before:form.has("remind_before"),send_owner:form.has("send_owner")};
  if((!flags.send_owner && !parsed.data.group_id)||(!flags.remind_day && !flags.remind_before))return {ok:false,message:"เลือกผู้รับและวันที่แจ้งเตือนอย่างน้อยหนึ่งรายการ"};
  const db=database();
  if(parsed.data.group_id){const g=await db.from("permissions").select("enabled").eq("group_id",parsed.data.group_id).maybeSingle();dbError(g.error);if(!g.data?.enabled)return {ok:false,message:"กรุณาเปิดใช้งานกลุ่มก่อน"};}
  if(parsed.data.mention_user_id){
    const f=await db.from("friends").select("blocked").eq("group_id",parsed.data.group_id||"").eq("line_user_id",parsed.data.mention_user_id).maybeSingle();dbError(f.error);
    if(!f.data || f.data.blocked)return {ok:false,message:"เลือกเพื่อนที่อยู่ในกลุ่มผู้รับและไม่ได้พักการตอบ"};
  }
  if(flags.send_owner){const o=await db.from("owner").select("line_user_id").eq("id",1).single();dbError(o.error);if(!o.data?.line_user_id)return {ok:false,message:"ตั้ง LINE user ID ของเจ้าของก่อนเปิดแจ้งเตือน"};}
  if(!await validateAttachments(parsed.data.attachment_ids,parsed.data.group_id?"shareable":"private"))return {ok:false,message:`เลือกไฟล์ที่ใช้ส่งเข้ากลุ่มได้ไม่เกิน ${MAX_ATTACHMENTS} ไฟล์`};
  const id=value(form,"id");if(id && !z.uuid().safeParse(id).success)return {ok:false,message:"รหัสรายการไม่ถูกต้อง"};
  const data={...parsed.data,...flags,updated_at:new Date().toISOString()};
  const r=id?await db.from("calendar_events").update(data).eq("id",id):await db.from("calendar_events").insert(data);
  return r.error?{ok:false,message:r.error.message.includes("PP_CALENDAR_LIMIT")?"ปฏิทินเต็ม 100 รายการ ลบรายการเก่าก่อนเพิ่มใหม่":"บันทึกไม่ได้ ลองอีกครั้ง"}:success("บันทึกและเปิดแจ้งเตือนช่วง 08:00–09:00 น. แล้ว");
}
export async function deleteCalendarEvent(_:ActionState,form:FormData):Promise<ActionState>{
  await requireAdmin();const id=z.uuid().parse(value(form,"id"));const r=await database().from("calendar_events").delete().eq("id",id);dbError(r.error);return success("ลบรายการแล้ว");
}
