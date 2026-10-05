"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { database } from "@/lib/db";
import { memoryLayoutInput } from "@/lib/memory-layout";
import type { ActionState } from "./actions";

export async function saveMemoryLayout(input: unknown): Promise<ActionState> {
  await requireAdmin();
  const parsed = memoryLayoutInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "สีหรือลำดับไม่ถูกต้อง ลองเปิดหน้าใหม่" };
  const { error } = await database().rpc("pp_save_memory_layout", { p_items: parsed.data });
  if (error) return { ok: false, message: "บันทึกไม่ได้ รายการอาจเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่" };
  revalidatePath("/admin");
  return { ok: true, message: "บันทึกสีและลำดับแล้ว" };
}
