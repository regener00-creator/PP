import { z } from "zod";
export const statuses = [
  "idea",
  "making",
  "review",
  "ready",
  "posted",
] as const;
export const statusLabels: Record<Status, string> = {
  idea: "ไอเดีย",
  making: "กำลังทำ",
  review: "รอตรวจ",
  ready: "พร้อมลง",
  posted: "ลงแล้ว",
};
export type Status = (typeof statuses)[number];
export const channels = [
  "TikTok",
  "Facebook",
  "Instagram",
  "YouTube",
  "LINE",
  "อื่น ๆ",
];
export const formats = [
  "ตอบคำถาม",
  "วิธีใช้",
  "เปรียบเทียบ",
  "เล่าเคส",
  "เบื้องหลัง",
  "แนะนำสินค้า",
];
const short = z.string().trim().max(160);
const text = z.string().trim().max(6000);
export const brandSchema = z.object({
  name: short.min(1),
  description: text,
  audience: text,
  tone: text,
  pillars: text,
  avoid: text,
});
export type Brand = z.infer<typeof brandSchema> & {
  id: string;
  updated_at: string;
};
export const sourceKinds = {
  product: "สินค้า / SKU",
  question: "คำถามลูกค้า",
  case: "เคสจริง",
  campaign: "แคมเปญ / เทศกาล",
};
export const sourceSchema = z
  .object({
    brand_id: z.uuid(),
    kind: z.enum(["product", "question", "case", "campaign"]),
    title: short.min(1),
    content: text.min(1),
    start_date: z.iso.date().nullable(),
    end_date: z.iso.date().nullable(),
  })
  .refine(
    (v) => !v.start_date || !v.end_date || v.start_date <= v.end_date,
    "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
  );
export type Source = z.infer<typeof sourceSchema> & {
  id: string;
  updated_at: string;
};
export const ideaSchema = z.object({
  title: short.min(1),
  hook: z.string().max(800),
  angle: z.string().max(1500),
  cta: z.string().max(500),
  pillar: short,
  format: short,
  origin: z.string().max(100).optional(),
  pattern_id: z.string().max(100).optional(),
});
export type Idea = z.infer<typeof ideaSchema>;
export const draftSchema = z.object({
  caption: text,
  script: text,
  shots: text,
  hashtags: z.string().max(1000),
  visual: text,
});
export const briefSchema = z.object({
  topic: z.string().trim().min(2).max(1200),
  brand_id: z.uuid().nullable(),
  source_ids: z.array(z.uuid()).max(20),
  audience: z.string().max(1000),
  goal: z.string().max(300),
  goal_id: z.string().max(64).nullable().optional(),
  channel: z.enum([
    "TikTok",
    "Facebook",
    "Instagram",
    "YouTube",
    "LINE",
    "อื่น ๆ",
  ]),
  pillar: short,
  format: short,
  variation: z.number().int().min(0).max(10000),
});
export type Brief = z.infer<typeof briefSchema>;
export const itemSchema = ideaSchema
  .omit({ origin: true, pattern_id: true })
  .extend({
    brand_id: z.uuid().nullable(),
    channel: short.min(1),
    status: z.enum(statuses),
    scheduled_at: z.iso.datetime({ offset: true }).nullable(),
    assignee: short,
    caption: text,
    script: text,
    shots: text,
    hashtags: z.string().max(1000),
    visual: text,
    notes: text,
    attachment_ids: z.array(z.uuid()).max(10),
    notify_owner: z.boolean(),
    group_id: z
      .string()
      .regex(/^C[0-9a-f]{32}$/i)
      .nullable(),
    remind_before: z.boolean(),
    remind_day: z.boolean(),
    views: z.number().int().min(0).max(1e12).nullable(),
    saves: z.number().int().min(0).max(1e12).nullable(),
    sales: z.number().min(0).max(1e12).nullable(),
    post_url: z
      .string()
      .max(2000)
      .refine(
        (v) => !v || /^https?:\/\//i.test(v),
        "ลิงก์ต้องขึ้นต้นด้วย https:// หรือ http://",
      ),
  })
  .superRefine((v, c) => {
    if (new Set(v.attachment_ids).size !== v.attachment_ids.length)
      c.addIssue({ code: "custom", message: "ไฟล์แนบซ้ำ" });
    if (
      (v.notify_owner || v.group_id) &&
      (!v.scheduled_at || (!v.remind_day && !v.remind_before))
    )
      c.addIssue({
        code: "custom",
        message: "เลือกวันโพสต์และวันแจ้งเตือนก่อนเลือกผู้รับ LINE",
      });
  });
export type ItemData = z.infer<typeof itemSchema>;
export type ContentItem = ItemData & {
  id: string;
  updated_at: string;
  created_at: string;
  generation_id: string | null;
  idea_index: number | null;
  archived: boolean;
};
export type ContentSummary = Pick<
  ContentItem,
  | "id"
  | "title"
  | "brand_id"
  | "channel"
  | "pillar"
  | "format"
  | "status"
  | "scheduled_at"
  | "assignee"
  | "views"
  | "saves"
  | "sales"
  | "post_url"
  | "updated_at"
  | "created_at"
  | "archived"
>;
export type Generation = {
  id: string;
  kind: "ideas" | "draft";
  engine: "template" | "ai";
  status: "pending" | "complete" | "failed";
  request: { brief: Brief; item_id?: string };
  result: {
    ideas?: Idea[];
    draft?: z.infer<typeof draftSchema>;
    patterns?: unknown[];
    learned_count?: number;
    notice?: string;
    raw_ideas?: Idea[];
  } | null;
  created_at: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
};
export type PlannerState = {
  ok: boolean;
  message: string;
  id?: string;
  revision?: string;
  generation?: Generation;
};
export const initialPlannerState: PlannerState = { ok: false, message: "" };
export function emptyItem(): ItemData {
  return {
    title: "",
    hook: "",
    angle: "",
    cta: "",
    pillar: "",
    format: "",
    brand_id: null,
    channel: "TikTok",
    status: "idea",
    scheduled_at: null,
    assignee: "",
    caption: "",
    script: "",
    shots: "",
    hashtags: "",
    visual: "",
    notes: "",
    attachment_ids: [],
    notify_owner: false,
    group_id: null,
    remind_before: false,
    remind_day: true,
    views: null,
    saves: null,
    sales: null,
    post_url: "",
  };
}
export function thaiDay(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export function localPostingTime(iso: string | null) {
  return iso
    ? new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16)
    : "";
}
export function postingInstant(local: string) {
  return local ? new Date(`${local}:00+07:00`).toISOString() : null;
}
export function dueContent(
  item: Pick<
    ContentItem,
    "status" | "archived" | "scheduled_at" | "remind_day" | "remind_before"
  >,
  today: string,
): number[] {
  if (item.archived || item.status === "posted" || !item.scheduled_at)
    return [];
  const day = thaiDay(new Date(item.scheduled_at));
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);
  return [
    ...(item.remind_day && day === today ? [0] : []),
    ...(item.remind_before && day === tomorrow ? [1] : []),
  ];
}
export function templateIdeas(brief: Brief, selected: Source[]): Idea[] {
  const subject =
    selected.find((s) => s.kind === "product")?.title || brief.topic;
  const faq = selected.find((s) => s.kind === "question");
  const example = selected.find((s) => s.kind === "case");
  const variants = [
    {
      title: `${subject}: เริ่มเลือกจากอะไรดี`,
      hook: `กำลังมองหา${subject}อยู่หรือเปล่า`,
      angle:
        "เริ่มจากปัญหาของลูกค้า แล้วใช้ข้อมูลสินค้าที่บันทึกไว้ช่วยอธิบายวิธีเลือก",
      cta: "บอกโจทย์ของคุณไว้ เดี๋ยวช่วยดูให้",
      format: "แนะนำสินค้า",
    },
    {
      title: faq?.title || `คำถามก่อนเลือก${subject}`,
      hook: faq?.title || `ก่อนเลือก${subject} ลองเช็กเรื่องนี้`,
      angle:
        faq?.content ||
        "รวบรวมคำถามที่ลูกค้าสงสัย และตอบเฉพาะรายละเอียดที่ตรวจสอบแล้ว",
      cta: "มีคำถามไหนอีก ฝากไว้ได้เลย",
      format: "ตอบคำถาม",
    },
    {
      title: `เลือก${subject}ให้เหมาะกับงาน`,
      hook: "เหมือนกันตอนมอง แต่ตอนใช้ต่างกันอย่างไร",
      angle:
        "เทียบตามลักษณะการใช้งานจริง โดยเติมข้อแตกต่างที่มีหลักฐานก่อนเผยแพร่",
      cta: "เซฟไว้เช็กก่อนเลือกครั้งหน้า",
      format: "เปรียบเทียบ",
    },
    {
      title: example?.title || `เบื้องหลัง${subject}`,
      hook: "กว่าจะได้งานหนึ่งชิ้น ต้องผ่านอะไรบ้าง",
      angle:
        example?.content ||
        "ถ่ายขั้นตอนจริง เล่าเหตุผลของแต่ละขั้นตอน และสิ่งที่ทีมใส่ใจ",
      cta: "อยากเห็นขั้นตอนไหนเพิ่มเติม บอกได้เลย",
      format: example ? "เล่าเคส" : "เบื้องหลัง",
    },
    {
      title: `ลองใช้${subject}ไปด้วยกัน`,
      hook: "ถ้าเพิ่งเริ่ม ลองดูขั้นตอนนี้ก่อน",
      angle: "สาธิตทีละขั้นด้วยสินค้าจริง พร้อมข้อควรตรวจสอบก่อนใช้งาน",
      cta: "เก็บไว้ลองทำตามได้เลย",
      format: "วิธีใช้",
    },
    {
      title: `${subject} เหมาะกับใคร`,
      hook: "โจทย์ของคุณเป็นแบบไหน",
      angle: `ชวน${brief.audience || "ลูกค้า"}เล่าปัญหา แล้วเชื่อมกับข้อมูลที่แบรนด์ยืนยัน`,
      cta: "ส่งโจทย์มาให้ช่วยแนะนำได้",
      format: "ตอบคำถาม",
    },
  ];
  return Array.from({ length: 5 }, (_, i) => ({
    ...variants[(i + brief.variation) % variants.length],
    pillar: brief.pillar || "ให้ความรู้",
    ...(brief.format ? { format: brief.format } : {}),
  }));
}
export function performanceSummary(
  items: Pick<
    ContentSummary,
    "status" | "archived" | "format" | "views" | "saves" | "sales"
  >[],
) {
  const groups = new Map<
    string,
    {
      format: string;
      count: number;
      measured: number;
      views: number;
      saves: number;
      sales: number;
    }
  >();
  for (const item of items.filter(
    (i) => i.status === "posted" && !i.archived,
  )) {
    const format = item.format || "ยังไม่ระบุ";
    const g = groups.get(format) || {
      format,
      count: 0,
      measured: 0,
      views: 0,
      saves: 0,
      sales: 0,
    };
    g.count++;
    if (item.views !== null && item.saves !== null) {
      g.measured++;
      g.views += item.views;
      g.saves += item.saves;
    }
    g.sales += item.sales || 0;
    groups.set(format, g);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    saveRate: g.views ? (g.saves / g.views) * 100 : null,
  }));
}
