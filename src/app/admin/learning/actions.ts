"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/db";
import { groupId, userId } from "@/lib/line";
import { learningReview } from "@/lib/learning-policy";
import { normalizeQuestion } from "@/lib/policy";
import { runLearning } from "@/lib/learning";
import type { ActionState } from "../actions";
const text=(form:FormData,key:string)=>String(form.get(key)??"");
function refresh(){revalidatePath("/admin/learning");}
export async function setLearningGroup(_:ActionState,form:FormData):Promise<ActionState>{
  await requireAdmin();const group=groupId.safeParse(text(form,"group_id"));
  if(!group.success)return {ok:false,message:"กลุ่มไม่ถูกต้อง"};
  const enabled=form.get("enabled")==="on";
  const result=await database().rpc("pp_set_learning_group",{p_group:group.data,p_enabled:enabled});
  refresh();return result.error||!result.data?{ok:false,message:"บันทึกไม่สำเร็จ ตรวจว่ากลุ่มเปิดใช้งานแล้ว"}:{ok:true,message:enabled?"เปิดเรียนรู้ข้อความใหม่แล้ว":"หยุดเรียนรู้และล้างข้อความรอสรุปกับความจำรอตรวจแล้ว"};
}
export async function setLearningFriend(_:ActionState,form:FormData):Promise<ActionState>{
  await requireAdmin();const parsed=z.object({group:groupId,sender:userId}).safeParse({group:text(form,"group_id"),sender:text(form,"sender_id")});
  if(!parsed.success)return {ok:false,message:"สมาชิกไม่ถูกต้อง"};
  const excluded=form.get("excluded")==="on";
  const result=await database().rpc("pp_set_learning_friend",{p_group:parsed.data.group,p_sender:parsed.data.sender,p_excluded:excluded});
  refresh();return result.error||!result.data?{ok:false,message:"บันทึกไม่สำเร็จ"}:{ok:true,message:excluded?"หยุดจำและลบข้อมูลที่เรียนรู้ของคนนี้แล้ว":"รับข้อความใหม่ของคนนี้ได้แล้ว"};
}
export async function approveLearning(_:ActionState,form:FormData):Promise<ActionState>{
  await requireAdmin();const parsed=learningReview.safeParse({id:text(form,"id"),title:text(form,"title"),content:text(form,"content"),questions:text(form,"questions").split(/\r?\n/).filter(q=>q.trim())});
  if(!parsed.success)return {ok:false,message:parsed.error.issues[0]?.message||"ข้อมูลไม่ถูกต้อง"};
  const v=parsed.data;
  const result=await database().rpc("pp_review_learning",{p_id:v.id,p_title:v.title,p_content:v.content,p_questions:v.questions,p_aliases:[...new Set(v.questions.map(normalizeQuestion))]});
  refresh();return result.error||!result.data?{ok:false,message:"บันทึกไม่ได้ ข้อมูลอาจเปลี่ยน หมดอายุ หรือกลุ่ม/สมาชิกหยุดเรียนรู้แล้ว"}:{ok:true,message:"อนุมัติแล้ว ใช้ตอบได้เฉพาะกลุ่มต้นทาง"};
}
export async function removeLearning(_:ActionState,form:FormData):Promise<ActionState>{
  await requireAdmin();const id=z.uuid().safeParse(text(form,"id"));
  if(!id.success)return {ok:false,message:"รายการไม่ถูกต้อง"};
  const result=await database().from("learning_suggestions").delete().eq("id",id.data);
  refresh();return result.error?{ok:false,message:"ลบไม่สำเร็จ"}:{ok:true,message:"ลบความจำแล้ว"};
}
export async function summarizeLearning():Promise<ActionState>{
  await requireAdmin();const result=await runLearning();refresh();return result;
}
