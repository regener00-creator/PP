"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { database, dbError } from "@/lib/db";
import { groupId } from "@/lib/line";
import { adminAssistantScope } from "@/lib/assistant-admin";

type State = { ok: boolean; message: string };
const target = z.object({ id: z.uuid(), group: groupId.nullable() });
const fields = z.object({
  title: z.string().trim().min(1).max(120),
  event_date: z.iso.date(),
  content: z.string().trim().min(1).max(1500),
});
function refresh() {
  revalidatePath("/admin");
}
export async function saveCalendarAppointment(_: State, form: FormData): Promise<State> {
  await requireAdmin();
  const parsed = target.extend(fields.shape).safeParse({
    id: form.get("id"), group: form.get("group") || null,
    title: form.get("title"), event_date: form.get("event_date"), content: form.get("content"),
  });
  if (!parsed.success) return { ok: false, message: "ตรวจชื่อ วันที่ และข้อความอีกครั้งครับ" };
  try {
    const { id, group, ...values } = parsed.data;
    const scope = await adminAssistantScope(group);
    const result = await database().from("assistant_events").update({
      ...values, annual: form.get("annual") === "on", remind_before: form.get("remind_before") === "on",
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("scope_key", scope.group || scope.sender).select("id").maybeSingle();
    dbError(result.error);
    if (!result.data) return { ok: false, message: "ไม่พบนัดหมายนี้ กรุณาเปิดปฏิทินใหม่" };
    refresh();
    return { ok: true, message: "บันทึกนัดหมายแล้ว เลขาใน LINE และปฏิทินใช้ข้อมูลเดียวกัน" };
  } catch {
    return { ok: false, message: "ยังบันทึกไม่ได้ กรุณาลองใหม่หรือตรวจสิทธิ์กลุ่ม" };
  }
}
export async function deleteCalendarAppointment(_: State, form: FormData): Promise<State> {
  await requireAdmin();
  const parsed = target.safeParse({ id: form.get("id"), group: form.get("group") || null });
  if (!parsed.success) return { ok: false, message: "ไม่พบนัดหมายนี้" };
  try {
    const scope = await adminAssistantScope(parsed.data.group);
    const result = await database().from("assistant_events").delete()
      .eq("id", parsed.data.id).eq("scope_key", scope.group || scope.sender).select("id").maybeSingle();
    dbError(result.error);
    if (!result.data) return { ok: false, message: "ไม่พบนัดหมายนี้ กรุณาเปิดปฏิทินใหม่" };
    refresh();
    return { ok: true, message: "ลบนัดหมายแล้ว" };
  } catch {
    return { ok: false, message: "ยังลบไม่ได้ กรุณาลองใหม่หรือตรวจสิทธิ์กลุ่ม" };
  }
}
