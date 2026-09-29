export type MemoryMatch = { decision: "answer" | "refuse" | "unknown"; answer?: string | null };
export type Decision = { kind: "answer" | "refuse" | "handoff" | "unknown"; text: string };
export const REFUSAL = "เรื่องนี้ขอไม่ตอบในกลุ่มนะ คุยกับเจ้าตัวเป็นการส่วนตัวดีกว่า 🙂";
export const UNKNOWN = "อันนี้ PP ยังไม่มีคำตอบที่เจ้าตัวยืนยันไว้เลย 😅";
export function normalizeQuestion(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\s?!？！，,。.]+/gu, "").trim();
}
// Conservative veto only. Privacy does not depend on this list: only exact approved
// question aliases can retrieve a shareable answer, and private content never leaves SQL.
export function isSensitive(text: string) {
  const q = normalizeQuestion(text);
  return /รหัส|พาสเวิร์ด|ความลับ|ส่วนตัว|เงินเดือน|รายได้|หนี้|บัญชีธนาคาร|เลขบัตร|บัตรประชาชน|สุขภาพ|โรค|ป่วย|เซ็ก|เพศ|แฟน|เลิกกัน|ที่อยู่บ้าน|พิกัด|อยู่ไหน|password|secret|private|token|salary|bank|medical|health|diagnos|sex|address|location|ignore.*instruction|systemprompt|แสดง.*ความจำ|ข้อมูลทั้งหมด|ลืม.*คำสั่ง/i.test(q);
}
export function ownerShouldAnswer(text: string, ownerName: string) {
  const q = normalizeQuestion(text);
  const aboutOwner = q.includes(normalizeQuestion(ownerName)) || /เจ้าตัว|owner|ปีโป้/.test(q);
  const invitation = /ว่าง|ไปด้วย|ไปไหม|ไปมั้ย|ไปมั๊ย|สะดวก|นัด|ตกลง|ยืนยัน|ชวน|available|join|confirm/.test(q);
  return aboutOwner && invitation;
}
export function decide(question: string, match: MemoryMatch, ownerName: string): Decision {
  if (isSensitive(question) || match.decision === "refuse") return { kind: "refuse", text: REFUSAL };
  if (match.decision === "answer" && match.answer && !isSensitive(match.answer)) {
    return { kind: "answer", text: match.answer };
  }
  if (match.decision === "answer") return { kind: "refuse", text: REFUSAL };
  if (ownerShouldAnswer(question, ownerName)) return { kind: "handoff", text: "อันนี้ให้เจ้าตัวตอบดีกว่า 😄" };
  return { kind: "unknown", text: UNKNOWN };
}
