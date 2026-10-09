"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { adminAssistantScope } from "@/lib/assistant-admin";
import { database, dbError } from "@/lib/db";
import { groupId } from "@/lib/line";

type State = { ok: boolean; message: string };
const target = z.object({ id: z.uuid(), group: groupId.nullable(), updated_at: z.iso.datetime({ offset: true }) });
const fields = target.extend({ title: z.string().trim().min(1).max(120), content: z.string().trim().min(1).max(2000) });
const changed = { ok: false, message: "ความจำนี้เปลี่ยนไปหรือถูกลบแล้ว กรุณาปิดหน้าต่างแล้วกดอัปเดตจาก LINE ก่อนแก้ไขอีกครั้ง" };
function values(form: FormData) {
  return { id: form.get("id"), group: form.get("group") || null, updated_at: form.get("updated_at"), title: form.get("title"), content: form.get("content") };
}

export async function saveAssistantNote(_: State, form: FormData): Promise<State> {
  await requireAdmin();
  const parsed = fields.safeParse(values(form));
  if (!parsed.success) return { ok: false, message: "ตรวจชื่อความจำและข้อมูลอีกครั้ง (ชื่อไม่เกิน 120 และข้อมูลไม่เกิน 2,000 ตัวอักษร)" };
  try {
    const { id, group, updated_at, title, content } = parsed.data;
    const scope = await adminAssistantScope(group);
    const result = await database().from("assistant_notes").update({ title, content, updated_at: new Date().toISOString() })
      .eq("id", id).eq("scope_key", scope.group || scope.sender).eq("updated_at", updated_at).select("id").maybeSingle();
    dbError(result.error);
    if (!result.data) return changed;
    revalidatePath("/admin");
    return { ok: true, message: "บันทึกความจำแล้ว เลขาใน LINE ใช้ข้อมูลที่แก้ไขนี้" };
  } catch {
    return { ok: false, message: "บันทึกไม่ได้ กรุณาลองใหม่หรือตรวจสิทธิ์กลุ่ม" };
  }
}

export async function deleteAssistantNote(_: State, form: FormData): Promise<State> {
  await requireAdmin();
  const parsed = target.safeParse(values(form));
  if (!parsed.success) return { ok: false, message: "ไม่พบความจำนี้ กรุณาเปิดรายการใหม่" };
  try {
    const scope = await adminAssistantScope(parsed.data.group);
    const result = await database().from("assistant_notes").delete()
      .eq("id", parsed.data.id).eq("scope_key", scope.group || scope.sender)
      .eq("updated_at", parsed.data.updated_at).select("id").maybeSingle();
    dbError(result.error);
    if (!result.data) return changed;
    revalidatePath("/admin");
    return { ok: true, message: "ลบความจำจากสมุดจำของเลขาแล้ว" };
  } catch {
    return { ok: false, message: "ลบไม่ได้ กรุณาลองใหม่หรือตรวจสิทธิ์กลุ่ม" };
  }
}
