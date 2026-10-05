import { z } from "zod";
import { normalizeQuestion } from "./policy";
export const memoryInput = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(2000),
  answer_variants: z.array(z.string().trim().min(1, "กรอกคำตอบให้ครบ หรือลบช่องที่ไม่ใช้").max(2000, "แต่ละคำตอบยาวได้ไม่เกิน 2,000 ตัวอักษร")).max(19, "เพิ่มคำตอบได้สูงสุด 20 ชุด").optional(),
  mention_owner: z.boolean().default(false),
  aliases: z.array(z.string().trim().min(2).max(250)).max(30),
  expires_at: z.iso.datetime({ offset: true }).nullable()
}).superRefine((value, ctx) => {
  if (value.aliases.some(alias => normalizeQuestion(alias).length < 2)) ctx.addIssue({ code: "custom", message: "คำถามสั้นเกินไป" });
});
