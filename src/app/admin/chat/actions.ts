"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { database, dbError } from "@/lib/db";
import {
  assistantAllowed,
  assistantReply,
  confirmAssistant,
  cancelAssistant,
} from "@/lib/assistant";
import { groupId } from "@/lib/line";
import type { AssistantReply, AssistantScope } from "@/lib/assistant-types";
export async function webScope(
  group: string | null = null,
): Promise<AssistantScope> {
  const user = await requireAdmin();
  if (group) groupId.parse(group);
  const owner = await database()
    .from("owner")
    .select("line_user_id")
    .eq("id", 1)
    .single();
  dbError(owner.error);
  const scope = {
    sender: owner.data?.line_user_id || `admin:${user.id}`,
    group,
    web: true,
  };
  if (!(await assistantAllowed(scope))) throw Error("Assistant access denied");
  return scope;
}
export async function chatWithAssistant(
  input: unknown,
): Promise<AssistantReply> {
  const user = await requireAdmin();
  const parsed = z
    .object({
      question: z.string().trim().min(1).max(2000),
      requestId: z.uuid(),
      group: groupId.nullable(),
    })
    .safeParse(input);
  if (!parsed.success)
    return { text: "ตรวจข้อความอีกครั้งครับ (ไม่เกิน 2,000 ตัวอักษร)" };
  const scope = await webScope(parsed.data.group);
  const rate = await database().rpc("pp_take_rate", {
    p_key: `web-chat:${user.id}`,
    p_limit: 8,
    p_seconds: 60,
  });
  dbError(rate.error);
  if (!rate.data)
    return { text: "ส่งข้อความเร็วไปนิดครับ รอสักครู่แล้วลองใหม่" };
  try {
    const reply = await assistantReply(
      parsed.data.question,
      scope,
      parsed.data.requestId,
    );
    revalidatePath("/admin/chat");
    return reply;
  } catch {
    return { text: "เลขายังตอบไม่ได้ชั่วคราวครับ กรุณาลองอีกครั้ง" };
  }
}
export async function confirmChat(
  id: string,
  group: string | null,
): Promise<AssistantReply> {
  await requireAdmin();
  z.uuid().parse(id);
  const reply = await confirmAssistant(await webScope(group), id);
  revalidatePath("/admin/chat");
  return reply;
}
export async function cancelChat(id: string, group: string | null) {
  await requireAdmin();
  z.uuid().parse(id);
  await cancelAssistant(await webScope(group), id);
  revalidatePath("/admin/chat");
}
export async function deleteAssistantRecord(form: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(form.get("id"));
  const kind = z.enum(["note", "event"]).parse(form.get("kind"));
  const group = String(form.get("group") || "") || null;
  const scope = await webScope(group);
  const r = await database()
    .from(kind === "note" ? "assistant_notes" : "assistant_events")
    .delete()
    .eq("id", id)
    .eq("scope_key", scope.group || scope.sender);
  dbError(r.error);
  revalidatePath("/admin/chat");
}
