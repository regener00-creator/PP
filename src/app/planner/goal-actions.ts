"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/db";
import { goalsSchema, type GoalSettings } from "@/lib/planner-goals";
export async function savePlannerGoals(
  input: unknown,
  revision: string,
): Promise<{ ok: boolean; message: string; settings?: GoalSettings }> {
  await requireAdmin();
  const parsed = goalsSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message:
        "ใส่ชื่อหัวข้อไม่ซ้ำกัน 1–30 หัวข้อ ชื่อไม่เกิน 300 ตัวอักษร และข้อความชวนตอบไม่เกิน 500 ตัวอักษร",
    };
  if (!z.iso.datetime({ offset: true }).safeParse(revision).success)
    return { ok: false, message: "กรุณาเปิดหน้าจัดการหัวข้อใหม่" };
  const result = await database()
    .from("content_goal_settings")
    .update({ goals: parsed.data })
    .eq("id", true)
    .eq("updated_at", revision)
    .select("goals,updated_at")
    .maybeSingle();
  if (result.error)
    return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  if (!result.data)
    return {
      ok: false,
      message: "มีการแก้ไขจากอีกหน้าต่างแล้ว กรุณารีเฟรชก่อนแก้ไขอีกครั้ง",
    };
  revalidatePath("/planner");
  return {
    ok: true,
    message: "บันทึกหัวข้อแล้ว",
    settings: result.data as GoalSettings,
  };
}
