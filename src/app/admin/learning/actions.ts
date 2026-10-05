"use server";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "../actions";
// Keep stale action requests inert instead of allowing an old page to enable capture.
async function retired(): Promise<ActionState> {
  await requireAdmin();
  return { ok: false, message: "นำระบบเรียนรู้จากกลุ่มออกแล้ว" };
}
export async function setLearningGroup(
  _: ActionState,
  _form: FormData,
): Promise<ActionState> {
  return retired();
}
export async function setLearningFriend(
  _: ActionState,
  _form: FormData,
): Promise<ActionState> {
  return retired();
}
export async function approveLearning(
  _: ActionState,
  _form: FormData,
): Promise<ActionState> {
  return retired();
}
export async function removeLearning(
  _: ActionState,
  _form: FormData,
): Promise<ActionState> {
  return retired();
}
export async function summarizeLearning(): Promise<ActionState> {
  return retired();
}
