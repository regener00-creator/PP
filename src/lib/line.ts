import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export const userId = z.string().regex(/^U[0-9a-f]{32}$/i);
export const groupId = z.string().regex(/^C[0-9a-f]{32}$/i);
// Typed aliases are separate from LINE's display name; real mentions use account identity.
const typedBotCall = /^@(?:น้องโจอา|pp)(?=\s|$)/iu;
const mention = z.object({ type: z.string(), index: z.number().int().nonnegative(), length: z.number().int().positive(), userId: z.string().optional(), isSelf: z.boolean().optional() });
export const textEvent = z.object({
  type: z.literal("message"), mode: z.enum(["active", "standby"]).optional(),
  webhookEventId: z.string().min(1).max(100), timestamp: z.number(), replyToken: z.string().min(1).max(200),
  source: z.object({ type: z.literal("group"), groupId, userId: userId.optional() }),
  message: z.object({ type: z.literal("text"), id: z.string().max(100), text: z.string().max(10000), mention: z.object({ mentionees: z.array(mention).max(20) }).optional() })
});
export type TextEvent = z.infer<typeof textEvent>;
export const ownerTextEvent = textEvent.extend({
  source: z.object({ type: z.literal("user"), userId }).strict()
});
export type OwnerTextEvent = z.infer<typeof ownerTextEvent>;
type UriAction = { type: "uri"; label: string; uri: string };
export type FileBubble = {
  type: "bubble";
  hero?: { type: "image"; url: string; size: "full"; aspectRatio: "1:1"; aspectMode: "fit"; action: UriAction };
  body: { type: "box"; layout: "vertical"; spacing: "sm"; contents: { type: "text"; text: string; wrap: true; size: "sm" | "md"; weight?: "bold" }[] };
  footer: { type: "box"; layout: "vertical"; contents: { type: "button"; action: UriAction }[] };
};
export type LineMessage = { type: "text"; text: string } | { type: "textV2"; text: string; substitution: Record<string, { type: "mention"; mentionee: { type: "user"; userId: string } }> } | {type:"image";originalContentUrl:string;previewImageUrl:string} | {type:"template";altText:string;template:{type:"buttons";text:string;actions:UriAction[]}}
  | { type: "flex"; altText: string; contents: { type: "carousel"; contents: FileBubble[] } };
export function verifySignature(raw: Uint8Array, signature: string | null, secret: string): boolean {
  if (!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const actual = Buffer.from(signature, "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function extractQuestion(event: Pick<TextEvent, "message">, destination: string, allowText = false): string | null {
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
  // Never confuse a real mention to a different account with a typed bot alias.
  if (allowText && !event.message.mention?.mentionees.length && typedBotCall.test(text)) return text.replace(typedBotCall, "").trim();
  return null;
}
export function mentionOwner(id: string, answer?: string): LineMessage {
  userId.parse(id);
  // TextV2 uses braces for substitutions; keep user-authored braces literal.
  const text = answer === undefined ? "อันนี้ให้เจ้าตัวตอบดีกว่า 😄\n{owner} มาช่วยตอบเพื่อนหน่อย"
    : `${answer.replace(/\{/g, "{{").replace(/\}/g, "}}")}\n{owner}`;
  return { type: "textV2", text, substitution: { owner: { type: "mention", mentionee: { type: "user", userId: id } } } };
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
export async function getGroupMemberName(group: string, user: string, token: string): Promise<string> {
  groupId.parse(group); userId.parse(user);
  const response = await fetch(`https://api.line.me/v2/bot/group/${group}/member/${user}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(3000)
  });
  if (!response.ok) throw new LineError(response.status);
  const profile = z.object({ userId, displayName: z.string().trim().min(1) }).parse(await response.json());
  if (profile.userId !== user) throw new Error("LINE profile mismatch");
  return profile.displayName.slice(0, 80);
}
export async function getGroupMemberIds(group: string, token: string): Promise<{ ids: string[]; complete: boolean }> {
  groupId.parse(group);
  const ids = new Set<string>(), cursors = new Set<string>();
  let cursor: string | undefined;
  // Bound the request even for unexpectedly large or malformed group responses.
  for (let page = 0; page < 10; page++) {
    const query = cursor ? `?start=${encodeURIComponent(cursor)}` : "";
    const response = await fetch(`https://api.line.me/v2/bot/group/${group}/members/ids${query}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) throw new LineError(response.status);
    const data = z.object({ memberIds: z.array(userId).max(100), next: z.string().min(1).max(2048).optional() }).parse(await response.json());
    data.memberIds.forEach(id => ids.add(id));
    if (!data.next) return { ids: [...ids], complete: true };
    if (cursors.has(data.next)) throw new Error("LINE repeated a member cursor");
    cursors.add(data.next); cursor = data.next;
  }
  return { ids: [...ids], complete: false };
}
