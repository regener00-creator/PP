"use server";
import { requireAdmin } from "@/lib/auth";
import type { AssistantReply } from "@/lib/assistant-types";

// Old browser tabs must not consume AI quota, confirm drafts or mutate data.
async function retired(): Promise<AssistantReply> {
  await requireAdmin();
  return { text: "ปิดหน้าแชตในโปรแกรมแล้ว คุยกับน้องโจอาผ่าน LINE ได้เลยครับ" };
}
export async function chatWithAssistant(..._args: unknown[]) { return retired(); }
export async function confirmChat(..._args: unknown[]) { return retired(); }
export async function cancelChat(..._args: unknown[]) { return retired(); }
export async function deleteAssistantRecord(..._args: unknown[]) { return retired(); }
