import { z } from "zod";
export const proposalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("remember"),
    title: z.string().trim().min(1).max(120),
    content: z.string().trim().min(1).max(2000),
  }),
  z.object({
    kind: z.literal("event"),
    title: z.string().trim().min(1).max(120),
    content: z.string().trim().min(1).max(1500),
    date: z.iso.date(),
    annual: z.boolean(),
    before: z.boolean(),
  }),
]);
export type Proposal = z.infer<typeof proposalSchema>;
export type AssistantScope = {
  sender: string;
  group: string | null;
  web?: boolean;
};
export type AssistantReply = {
  text: string;
  pending?: { id: string; proposal: Proposal };
  saved?: boolean;
};
export type AssistantNote = {
  id: string;
  title: string;
  content: string;
  scope_key: string;
  updated_at: string;
};
export type AssistantEvent = {
  id: string;
  title: string;
  content: string;
  event_date: string;
  reminder_time?: string;
  updated_at?: string;
  annual: boolean;
  remind_before: boolean;
  scope_key: string;
  sender_id: string;
  enabled: boolean;
  source?: "legacy";
};
export function scopeKey(scope: AssistantScope) {
  return scope.group || scope.sender;
}
export function writeIntent(text: string): "remember" | "event" | null {
  if (
    /(?:ไม่(?:ต้อง|อยาก|ให้)|อย่า|ห้าม)\s*(?:ช่วย\s*)?(?:จำ|จด|บันทึก|เก็บ|เตือน|ตั้ง)/.test(
      text,
    )
  )
    return null;
  if (
    /(?:ช่วยจำ|ฝากจำ|จำไว้|จำให้หน่อย)/.test(text) ||
    /^(?:ช่วย\s*)?(?:จำ(?:ไว้|ว่า|ให้)|จด(?:จำ|ไว้)|บันทึก(?:ว่า|ความจำ)|เก็บ(?:ความจำ|ไว้))/.test(
      text.trim(),
    )
  )
    return "remember";
  if (
    /(?:เตือน(?:ฉัน|ผม|เรา|ให้|ว่า|พรุ่งนี้|วันนี้|วันที่|วัน|ตอน|เวลา)|ตั้ง(?:เตือน|นัด)|เพิ่มนัด|นัดหมาย|ช่วยนัด|บันทึกนัด)/.test(
      text,
    )
  )
    return "event";
  return null;
}
export function proposalText(p: Proposal, group: boolean) {
  const audience = group ? "ใช้ร่วมกันในกลุ่มนี้" : "แชตส่วนตัวของคุณ";
  return p.kind === "remember"
    ? `จะจำไว้ใน${audience}\n${p.title}\n${p.content}\n\nพิมพ์ ยืนยัน เพื่อบันทึก หรือ ยกเลิก`
    : `จะบันทึกนัดหมายใน${audience}\n${p.title}\nวันที่ ${p.date}${p.annual ? " · ทำซ้ำทุกปี" : ""}\n${p.content}\nเตือนวันนัด${p.before ? "และก่อน 1 วัน" : ""} เวลา 08:00 น. (เวลาไทย) · เปลี่ยนเวลาได้ในปฏิทิน\n\nพิมพ์ ยืนยัน เพื่อบันทึก หรือ ยกเลิก`;
}
