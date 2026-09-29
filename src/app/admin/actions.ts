"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { database, dbError } from "@/lib/db";
import { groupId, userId } from "@/lib/line";
import { memoryInput } from "@/lib/validation";
import { normalizeQuestion } from "@/lib/policy";
export type ActionState = { ok: boolean; message: string };
function input(form: FormData, name: string) { return String(form.get(name) ?? ""); }
export async function saveMemory(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = memoryInput.safeParse({ title: input(form, "title"), content: input(form, "content"), visibility: input(form, "visibility"), aliases: input(form, "aliases").split(/\r?\n/).filter(Boolean), expires_at: input(form, "expires_at") ? `${input(form, "expires_at")}T23:59:59+07:00` : null });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "ข้อมูลไม่ถูกต้อง" };
  const id = input(form, "id");
  if (id && !z.uuid().safeParse(id).success) return { ok: false, message: "รหัส memory ไม่ถูกต้อง" };
  const value = { ...parsed.data, aliases: [...new Set(parsed.data.aliases.map(normalizeQuestion))], question_examples: parsed.data.aliases, updated_at: new Date().toISOString() };
  const db = database();
  const result = id ? await db.from("memories").update(value).eq("id", id) : await db.from("memories").insert(value);
  if (result.error) return { ok: false, message: "บันทึกไม่สำเร็จ ลองอีกครั้ง" };
  revalidatePath("/admin");
  return { ok: true, message: "บันทึกความจำแล้ว" };
}
export async function deleteMemory(form: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(input(form, "id"));
  const { error } = await database().from("memories").delete().eq("id", id);
  dbError(error); revalidatePath("/admin");
}
export async function saveOwner(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.object({ display_name: z.string().trim().min(1).max(60), line_user_id: userId.nullable() }).safeParse({ display_name: input(form, "display_name"), line_user_id: input(form, "line_user_id").trim() || null });
  if (!parsed.success) return { ok: false, message: "ชื่อหรือ LINE user ID ไม่ถูกต้อง (U ตามด้วยเลขฐานสิบหก 32 ตัว)" };
  const { error } = await database().from("owner").upsert({ id: 1, ...parsed.data });
  if (error) return { ok: false, message: "บันทึกไม่สำเร็จ" };
  revalidatePath("/admin"); return { ok: true, message: "บันทึกเจ้าของแล้ว" };
}
export async function savePermission(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.object({ group_id: groupId, label: z.string().trim().max(80) }).safeParse({ group_id: input(form, "group_id"), label: input(form, "label") });
  if (!parsed.success) return { ok: false, message: "Group ID ต้องขึ้นต้น C และตามด้วยเลขฐานสิบหก 32 ตัว" };
  const { error } = await database().from("permissions").upsert({ ...parsed.data, enabled: form.get("enabled") === "on", allow_owner_mention: form.get("allow_owner_mention") === "on" });
  if (error) return { ok: false, message: "บันทึกไม่สำเร็จ" };
  revalidatePath("/admin"); return { ok: true, message: "บันทึกสิทธิ์กลุ่มแล้ว" };
}
export async function saveFriend(form: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(input(form, "id"));
  const display_name = z.string().trim().max(80).parse(input(form, "display_name"));
  const { error } = await database().from("friends").update({ display_name, blocked: form.get("blocked") === "on" }).eq("id", id);
  dbError(error); revalidatePath("/admin");
}
