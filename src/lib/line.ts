import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export const userId = z.string().regex(/^U[0-9a-f]{32}$/i);
export const groupId = z.string().regex(/^C[0-9a-f]{32}$/i);
const mention = z.object({ type: z.string(), index: z.number().int().nonnegative(), length: z.number().int().positive(), userId: z.string().optional(), isSelf: z.boolean().optional() });
export const textEvent = z.object({
  type: z.literal("message"), mode: z.enum(["active", "standby"]).optional(),
  webhookEventId: z.string().min(1).max(100), timestamp: z.number(), replyToken: z.string().min(1).max(200),
  source: z.object({ type: z.literal("group"), groupId, userId: userId.optional() }),
  message: z.object({ type: z.literal("text"), id: z.string().max(100), text: z.string().max(10000), mention: z.object({ mentionees: z.array(mention).max(20) }).optional() })
});
export type TextEvent = z.infer<typeof textEvent>;
export type LineMessage = { type: "text"; text: string } | { type: "textV2"; text: string; substitution: Record<string, { type: "mention"; mentionee: { type: "user"; userId: string } }> };
export function verifySignature(raw: Uint8Array, signature: string | null, secret: string): boolean {
  if (!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const actual = Buffer.from(signature, "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function extractQuestion(event: TextEvent, destination: string, allowText = false): string | null {
  const text = event.message.text;
  const self = event.message.mention?.mentionees.filter(m => m.type === "user" && (m.isSelf === true || m.userId === destination)) ?? [];
  if (self.length) {
    let question = text;
    for (const m of [...self].sort((a, b) => b.index - a.index)) {
      if (m.index + m.length > text.length) return null;
      question = question.slice(0, m.index) + question.slice(m.index + m.length);
    }
    return question.trim();
  }
  // Never confuse a real mention to a different account named PP with this bot.
  if (allowText && !event.message.mention?.mentionees.length && /^@pp(?=\s|$)/i.test(text)) return text.replace(/^@pp\s*/i, "").trim();
  return null;
}
export function mentionOwner(id: string): LineMessage {
  userId.parse(id);
  return { type: "textV2", text: "อันนี้ให้เจ้าตัวตอบดีกว่า 😄\n{owner} มาช่วยตอบเพื่อนหน่อย", substitution: { owner: { type: "mention", mentionee: { type: "user", userId: id } } } };
}
export class LineError extends Error {
  constructor(public status: number) { super("LINE request failed"); }
}
export async function lineRequest(path: string, token: string, body?: unknown) {
  const response = await fetch(`https://api.line.me/v2/bot/${path}`, {
    method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000), cache: "no-store"
  });
  if (!response.ok) throw new LineError(response.status);
}
export async function ownerInGroup(group: string, owner: string, token: string) {
  try { await lineRequest(`group/${group}/member/${owner}`, token); return true; }
  catch (error) { if (error instanceof LineError && error.status === 404) return false; throw error; }
}
