import { z } from "zod";
export const goalDirections = {
  awareness: {
    label: "สร้างการรับรู้",
    formats: ["แนะนำสินค้า", "เบื้องหลัง"],
    angle:
      "เปิดเรื่องให้คนที่ยังไม่รู้จักเข้าใจว่าสินค้านี้เกี่ยวข้องกับเขาอย่างไร",
    cta: "ติดตามไว้ดูเรื่องราวและสินค้าเพิ่มเติม",
  },
  education: {
    label: "ให้ความรู้",
    formats: ["วิธีใช้", "ตอบคำถาม", "เปรียบเทียบ"],
    angle: "อธิบายเป็นขั้นตอนที่นำไปใช้ได้ พร้อมข้อควรตรวจสอบจากข้อมูลจริง",
    cta: "บันทึกไว้ใช้เตรียมงานครั้งหน้า",
  },
  engagement: {
    label: "ชวนพูดคุย",
    formats: ["ตอบคำถาม", "เปรียบเทียบ"],
    angle: "ชวนคนดูเล่าประสบการณ์หรือเลือกคำตอบ พร้อมตั้งคำถามปลายเปิด",
    cta: "คุณเคยเจอโจทย์แบบไหน เล่าในความคิดเห็นได้เลย",
  },
  trust: {
    label: "เพิ่มความเชื่อมั่น",
    formats: ["เบื้องหลัง", "เล่าเคส"],
    angle:
      "เน้นขั้นตอนและหลักฐานที่ตรวจสอบได้จากข้อมูลจริง ไม่แต่งรีวิวหรือผลลัพธ์",
    cta: "สอบถามรายละเอียดและตัวอย่างงานเพิ่มเติมได้",
  },
  sales: {
    label: "กระตุ้นยอดขาย",
    formats: ["แนะนำสินค้า", "เปรียบเทียบ"],
    angle:
      "เชื่อมความต้องการของลูกค้ากับข้อมูลสินค้าที่มี และบอกขั้นตอนสอบถามหรือสั่งซื้อ โดยไม่แต่งราคาและโปรโมชัน",
    cta: "ส่งรายละเอียดงานมาเพื่อสอบถามราคาได้เลย",
  },
} as const;
export const goalSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  label: z.string().trim().min(1).max(300),
  direction: z.enum(["awareness", "education", "engagement", "trust", "sales"]),
  cta: z.string().trim().max(500),
});
export type ContentGoal = z.infer<typeof goalSchema>;
export const goalsSchema = z
  .array(goalSchema)
  .min(1)
  .max(30)
  .superRefine((goals, ctx) => {
    const ids = new Set<string>(),
      names = new Set<string>();
    for (const goal of goals) {
      const name = goal.label
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/\s+/g, " ");
      if (ids.has(goal.id) || names.has(name))
        ctx.addIssue({ code: "custom", message: "ชื่อหัวข้อซ้ำกัน" });
      ids.add(goal.id);
      names.add(name);
    }
  });
export const defaultGoals: ContentGoal[] = Object.entries(goalDirections).map(
  ([id, value]) => ({
    id,
    label: value.label,
    direction: id as ContentGoal["direction"],
    cta: "",
  }),
);
export type GoalSettings = { goals: ContentGoal[]; updated_at: string };
export function resolveGoal(
  brief: { goal: string; goal_id?: string | null },
  goals = defaultGoals,
): ContentGoal | undefined {
  return brief.goal_id
    ? goals.find((g) => g.id === brief.goal_id)
    : goals.find((g) => g.label === brief.goal);
}
