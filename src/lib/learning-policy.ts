import { z } from "zod";
import { isSensitive, normalizeQuestion } from "./policy";

export const LEARNING_INPUT_BYTES = 10000;
export const LEARNING_OUTPUT_TOKENS = 1000;
export function learningSensitive(text: string) {
  return isSensitive(text) || /https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\d[ -]?){9,}|การเมือง|ศาสนา|เชื้อชาติ|สุขภาพจิต|ซึมเศร้า|ตั้งครรภ์|แพ้|politic|religio|ethnic|mental|pregnan|allerg/i.test(text);
}
export const learningReview = z.object({
  id: z.uuid(), title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(1000),
  questions: z.array(z.string().trim().min(2).max(250)).min(1).max(5),
}).superRefine((value, ctx) => {
  if ([value.title,value.content,...value.questions].some(learningSensitive)) ctx.addIssue({code:"custom",message:"ไม่ใช้ข้อมูลส่วนตัวหรืออ่อนไหวเป็นความจำจากกลุ่ม"});
  if (value.questions.some(q=>normalizeQuestion(q).length<2)) ctx.addIssue({code:"custom",message:"คำถามสั้นเกินไป"});
});
export const learningOutput = z.object({ suggestions: z.array(z.object({
  speaker: z.string().max(8), category:z.enum(["preference","nickname","communication_style"]),
  title:z.string().min(1).max(120),content:z.string().min(1).max(1000),
  questions:z.array(z.string().min(2).max(250)).min(1).max(5),
  evidence:z.array(z.number().int().nonnegative()).min(1).max(3),
})).max(5) });
export type LearningSuggestion = {
  id:string;group_id:string;sender_id:string;title:string;content:string;question_examples:string[];
  category:string;status:"pending"|"approved";created_at:string;expires_at:string;
  evidence:{message_id:string;text:string;sent_at:string}[];
};
