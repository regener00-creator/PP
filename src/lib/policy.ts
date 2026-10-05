export type MemoryMatch = { decision: "answer" | "refuse" | "unknown" | "conflict"; answer?: string | null; memory_id?: string; mention_owner?: boolean };
export type Decision = { kind: "answer" | "refuse" | "handoff" | "unknown" | "conflict"; text: string; mention_owner?: boolean };
export const CONFLICT = "เรื่องนี้มีข้อมูลไม่ตรงกัน ขอให้เจ้าของตรวจให้ชัดก่อนนะครับ";
export const REFUSAL = "เรื่องนี้ขอไม่ตอบในกลุ่มนะ คุยกับเจ้าตัวเป็นการส่วนตัวดีกว่า 🙂";
export const UNKNOWN = "ยังไม่มีข้อมูลเรื่องนี้";
export const MAX_UNKNOWN_REPLIES = 20;
export function unknownReplies(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const texts = values.filter((text): text is string => typeof text === "string")
    .map(text => text.trim()).filter(text => text.length > 0 && text.length <= 2000).slice(0, MAX_UNKNOWN_REPLIES);
  return texts.length ? texts : [UNKNOWN];
}
export function unknownReply(value: unknown): string {
  const texts = unknownReplies(value);
  return texts[Math.floor(Math.random() * texts.length)];
}
export function normalizeQuestion(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\s?!？！，,。.]+/gu, "").trim();
}
// Filter passive learning and avoid sensitive owner pings, not approved memory answers.
export function isSensitive(text: string) {
  const q = normalizeQuestion(text);
  return /รหัส|พาสเวิร์ด|ความลับ|ส่วนตัว|เงินเดือน|รายได้|หนี้|บัญชีธนาคาร|เลขบัตร|บัตรประชาชน|สุขภาพ|โรค|ป่วย|เซ็ก|เพศ|แฟน|เลิกกัน|ที่อยู่บ้าน|พิกัด|อยู่ไหน|password|secret|private|token|salary|bank|medical|health|diagnos|sex|address|location|ignore.*instruction|systemprompt|แสดง.*ความจำ|ข้อมูลทั้งหมด|ลืม.*คำสั่ง/i.test(q);
}
export function ownerShouldAnswer(text: string, ownerName: string) {
  if (ownerPresenceQuestion(text, ownerName)) return true;
  const q = normalizeQuestion(text);
  const aboutOwner = q.includes(normalizeQuestion(ownerName)) || /เจ้าตัว|owner|ปีโป้|ปป/.test(q);
  const invitation = /ว่าง|ไปด้วย|ไปไหม|ไปมั้ย|ไปมั๊ย|สะดวก|นัด|ตกลง|ยืนยัน|ชวน|available|join|confirm/.test(q);
  return aboutOwner && invitation;
}
// A direct question to PP about being home is handed to its owner for a live answer.
// Match the entire request so a named third party or sensitive extra clause is not inferred.
export function ownerPresenceQuestion(text: string, ownerName: string): boolean {
  const names = [...new Set([ownerName, "ปีโป้", "ปป", "เจ้าตัว"])].map(normalizeQuestion)
    .filter(Boolean).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const time = "(?:วันนี้|ตอนนี้|คืนนี้|พรุ่งนี้)";
  return new RegExp(`^${time}?(?:${names})?${time}?(?:อยู่บ้าน|อยู่ที่บ้าน)(?:ไหม|มั้ย|มั๊ย|หรือเปล่า|รึเปล่า|ปะ|ป่ะ)${time}?(?:ครับ|คะ|ค่ะ|นะ|อะ|อ่ะ)?$`).test(normalizeQuestion(text));
}
export function decide(question: string, match: MemoryMatch, ownerName: string, fallback?: unknown): Decision {
  if (match.decision === "conflict") return { kind: "conflict", text: CONFLICT };
  if (match.decision === "refuse") return { kind: "refuse", text: REFUSAL };
  if (ownerPresenceQuestion(question, ownerName)) return { kind: "handoff", text: "อันนี้ให้เจ้าตัวตอบดีกว่า 😄" };
  if (match.decision === "answer" && match.answer) {
    return { kind: "answer", text: match.answer, ...(match.mention_owner === true ? { mention_owner: true } : {}) };
  }
  if (match.decision === "answer") return { kind: "refuse", text: REFUSAL };
  if (!isSensitive(question) && ownerShouldAnswer(question, ownerName)) return { kind: "handoff", text: "อันนี้ให้เจ้าตัวตอบดีกว่า 😄" };
  return { kind: "unknown", text: unknownReply(fallback) };
}
