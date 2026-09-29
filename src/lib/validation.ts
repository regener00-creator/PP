import { z } from "zod";
import { normalizeQuestion, isSensitive } from "./policy";
export const memoryInput = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(2000),
  visibility: z.enum(["private", "shareable"]),
  aliases: z.array(z.string().trim().min(2).max(250)).min(1).max(30),
  expires_at: z.iso.datetime({ offset: true }).nullable()
}).superRefine((value, ctx) => {
  if (value.aliases.some(alias => normalizeQuestion(alias).length < 2)) ctx.addIssue({ code: "custom", message: "คำถามสั้นเกินไป" });
  if (value.visibility === "shareable" && [value.content, ...value.aliases].some(isSensitive)) ctx.addIssue({ code: "custom", message: "เนื้อหานี้อาจอ่อนไหว กรุณาเก็บเป็น private" });
});
