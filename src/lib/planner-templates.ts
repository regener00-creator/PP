import { goalDirections, resolveGoal, type ContentGoal } from "./planner-goals";
import { z } from "zod";
import {
  ideaSchema,
  type Idea,
  type Brief,
  type Source,
} from "./planner-types";

// Reusable language only. Facts always come from the current brand's sources.
export const reusablePatternSchema = ideaSchema
  .omit({ pillar: true, origin: true, pattern_id: true })
  .extend({
    title: z
      .string()
      .min(2)
      .max(160)
      .refine((v) => v.includes("{subject}")),
    format: z.enum([
      "ตอบคำถาม",
      "วิธีใช้",
      "เปรียบเทียบ",
      "เล่าเคส",
      "เบื้องหลัง",
      "แนะนำสินค้า",
    ]),
  })
  .refine(
    (p) =>
      [p.title, p.hook, p.angle, p.cta].every(
        (v) =>
          !v
            .replaceAll("{subject}", "")
            .replaceAll("{audience}", "")
            .match(/[{}]/),
      ),
    "ใช้ได้เฉพาะ {subject} และ {audience}",
  );
export type ReusablePattern = z.infer<typeof reusablePatternSchema>;
export type LearnedPattern = ReusablePattern & {
  id: string;
  enabled: boolean;
  generation_id: string;
  source_ids: string[];
};
export type IdeaCandidate = {
  key: string;
  idea: Idea & { origin?: string; pattern_id?: string };
};
export const normalizedIdea = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");

const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });
// Respect schema limits in UTF-16 units without splitting an emoji or Thai marks.
export function truncateIdeaText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  let end = 0;
  for (const part of graphemes.segment(value)) {
    const next = part.index + part.segment.length;
    if (next > limit) break;
    end = next;
  }
  return value.slice(0, end);
}

const groups: [string, string[], string][] = [
  [
    "แนะนำสินค้า",
    [
      "{subject} เหมาะกับโจทย์แบบไหน",
      "เช็กลิสต์ก่อนเลือก{subject}",
      "เริ่มเลือก{subject}จากอะไรดี",
      "รู้จัก{subject}ผ่านรายละเอียดจริง",
      "คำที่ควรรู้ก่อนสั่ง{subject}",
      "เตรียมข้อมูลอะไรให้ร้านก่อนเลือก{subject}",
      "วางแผนซื้อ{subject}ครั้งแรก",
      "ชวนดู{subject}จากมุมของผู้ใช้",
      "ตรวจตัวอย่าง{subject}อย่างไร",
      "สรุปข้อมูล{subject}ในหนึ่งหน้า",
    ],
    "ใช้ข้อมูลสินค้าปัจจุบันอธิบายทีละประเด็น ถ้ารายละเอียดไม่ครบให้เติมก่อนเผยแพร่",
  ],
  [
    "ตอบคำถาม",
    [
      "คำถามที่ควรถามก่อนเลือก{subject}",
      "อยากเริ่มใช้{subject} ต้องรู้อะไร",
      "ข้อมูลอะไรของ{subject}ที่ยังต้องถามเพิ่ม",
      "จะรู้ได้อย่างไรว่า{subject}เหมาะกับงาน",
      "รวมข้อสงสัยเกี่ยวกับ{subject}",
      "เข้าใจคำอธิบาย{subject}ตรงกันหรือยัง",
      "ซื้อ{subject}ให้คนอื่น ต้องถามอะไร",
      "เตรียมบรีฟเรื่อง{subject}ให้ครบ",
      "ถามผู้ใช้ว่าอยากรู้อะไรเรื่อง{subject}",
      "ตอบหนึ่งคำถามเรื่อง{subject}แบบเห็นภาพ",
    ],
    "หยิบคำถามจริงมาอธิบายด้วยข้อเท็จจริงที่บันทึกไว้ เว้นคำตอบที่ยังไม่มีข้อมูล",
  ],
  [
    "วิธีใช้",
    [
      "เริ่มต้นใช้{subject}ทีละขั้น",
      "เตรียมตัวก่อนใช้{subject}",
      "เช็กความพร้อมของ{subject}ก่อนเริ่มงาน",
      "สาธิต{subject}ด้วยงานหนึ่งชิ้น",
      "ทำคู่มือ{subject}ฉบับย่อ",
      "ตรวจงานหลังใช้{subject}",
      "บันทึกขั้นตอนใช้{subject}ที่ควรจำ",
      "ทดลอง{subject}แล้วสังเกตอะไร",
      "จัดพื้นที่สำหรับใช้งาน{subject}",
      "ส่งต่อวิธีใช้{subject}ให้เพื่อนร่วมงาน",
    ],
    "ถ่ายขั้นตอนจริงและเติมคำแนะนำที่ตรวจสอบแล้ว หลีกเลี่ยงการเดาวิธีดูแลหรือข้อกำหนดของสินค้า",
  ],
  [
    "เปรียบเทียบ",
    [
      "เทียบ{subject}จากการใช้งานจริง",
      "ตั้งเกณฑ์เลือก{subject}ก่อนดูราคา",
      "เปรียบเทียบตัวเลือกของ{subject}ในตารางเดียว",
      "เลือก{subject}สำหรับงานเล็กกับงานใหญ่",
      "เปรียบเทียบ{subject}ด้วยตัวอย่างเดียวกัน",
      "ดูรายละเอียด{subject}ที่ภาพรวมอาจมองข้าม",
      "แยกสิ่งจำเป็นกับสิ่งเสริมของ{subject}",
      "เทียบข้อมูล{subject}ที่มีหลักฐานกับเรื่องที่ต้องถามเพิ่ม",
      "ชวนเลือก{subject}ตามลำดับความสำคัญ",
      "ทำแบบฟอร์มช่วยตัดสินใจเรื่อง{subject}",
    ],
    "กำหนดเกณฑ์เปรียบเทียบแล้วเติมข้อมูลจริงของแต่ละตัวเลือก ไม่สรุปว่าตัวใดดีกว่าโดยไม่มีหลักฐาน",
  ],
  [
    "เบื้องหลัง",
    [
      "เบื้องหลังการเตรียม{subject}",
      "หนึ่งวันกับงานที่เกี่ยวกับ{subject}",
      "พาดูรายละเอียด{subject}แบบใกล้ ๆ",
      "ใครทำหน้าที่อะไรในงาน{subject}",
      "บันทึกการตรวจงาน{subject}",
      "อุปกรณ์ที่ใช้ทำงานกับ{subject}",
      "เล่าที่มาของงาน{subject}",
      "จากบรีฟสู่ตัวอย่าง{subject}",
    ],
    "เล่าขั้นตอนที่เกิดขึ้นจริงในแบรนด์ ถ้ายังไม่มีภาพหรือข้อมูลให้วางรายการสิ่งที่ต้องเก็บก่อนถ่าย",
  ],
  [
    "เล่าเคส",
    [
      "โจทย์ตั้งต้นของเคส{subject}",
      "วิธีวางแผนงานในเคส{subject}",
      "ข้อจำกัดที่พบในเคส{subject}",
      "ลำดับการทำงานของเคส{subject}",
      "รายละเอียดที่ควรดูในเคส{subject}",
      "บทเรียนจากเคส{subject}",
      "คำถามที่ได้จากเคส{subject}",
      "สรุปเคส{subject}ให้เข้าใจในหนึ่งนาที",
    ],
    "เล่าจากเคสที่บันทึกไว้เท่านั้น ไม่เติมคำชม ผลลัพธ์ ตัวเลข หรือชื่อผู้เกี่ยวข้องที่ไม่มีในข้อมูล",
  ],
];
export const builtinPatterns: (ReusablePattern & { id: string })[] =
  groups.flatMap(([format, titles, angle], group) =>
    titles.map((title, n) => ({
      id: "base-" + group + "-" + n,
      title,
      format: format as ReusablePattern["format"],
      angle,
      hook: title.replace("{subject}", "{subject}สำหรับ{audience}"),
      cta: [
        "บันทึกไว้ใช้เตรียมงานครั้งหน้า",
        "มีโจทย์แบบไหน ฝากคำถามไว้ได้",
        "ส่งรายละเอียดมาให้ช่วยตรวจเพิ่มเติม",
        "อยากเห็นส่วนไหนต่อ บอกได้เลย",
      ][n % 4],
    })),
  );
function words(value: string) {
  return [...new Intl.Segmenter("th", { granularity: "word" }).segment(value)]
    .filter((v) => v.isWordLike)
    .map((v) => v.segment.toLowerCase());
}
export function relatedTopic(a: string, b: string) {
  const x = normalizedIdea(a),
    y = normalizedIdea(b);
  if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x)))
    return true;
  const stop = new Set([
    "อยาก",
    "ช่วย",
    "เรื่อง",
    "สำหรับ",
    "และ",
    "การ",
    "ของ",
    "ให้",
    "กับ",
    "ที่",
    "ทำ",
    "มี",
    "สินค้า",
  ]);
  const wa = words(a).filter((w) => w.length >= 2 && !stop.has(w));
  const wb = new Set(words(b));
  return wa.some((w) => wb.has(w));
}
export function freeCandidates(
  brief: Brief,
  sources: Source[],
  learned: LearnedPattern[],
  today: string,
  goal: ContentGoal | undefined = resolveGoal(brief),
): IdeaCandidate[] {
  const usable = sources.filter(
    (s) => s.kind !== "campaign" || !s.end_date || s.end_date >= today,
  );
  const requested = usable.filter((s) => brief.source_ids.includes(s.id));
  const relevant = usable.filter((s) => relatedTopic(brief.topic, s.title));
  const subjects = (
    requested.length ? requested : relevant.length ? relevant : []
  ).filter((s) => s.kind === "product" || s.kind === "case");
  const targets = subjects.length
    ? subjects.slice(0, 20)
    : [
        {
          id: "topic",
          title: truncateIdeaText(brief.topic, 75),
          kind: "topic",
          content: "",
        },
      ];
  const currentIds = new Set(usable.map((s) => s.id));
  const patterns = [
    ...learned.filter(
      (p) => p.enabled && p.source_ids.every((id) => currentIds.has(id)),
    ),
    ...builtinPatterns,
  ].filter((p) => !brief.format || p.format === brief.format);
  const candidates: IdeaCandidate[] = [];
  // Round-robin formats prevents all five results having the same structure.
  const ordered: typeof patterns = [];
  const byFormat = new Map<string, typeof patterns>();
  const direction = goal ? goalDirections[goal.direction] : undefined;
  const preferred = direction?.formats as readonly string[] | undefined;
  patterns.sort(
    (a, b) =>
      Number(preferred?.includes(b.format) || false) -
      Number(preferred?.includes(a.format) || false),
  );
  for (const p of patterns) {
    const group = byFormat.get(p.format) || [];
    group.push(p);
    byFormat.set(p.format, group);
  }
  while ([...byFormat.values()].some((v) => v.length))
    for (const v of byFormat.values()) {
      const p = v.shift();
      if (p) ordered.push(p);
    }
  const fill = (v: string, subject: string) =>
    v
      .replaceAll("{subject}", subject)
      .replaceAll(
        "{audience}",
        truncateIdeaText(brief.audience, 80) || "คนที่สนใจ",
      );
  for (let offset = 0; offset < targets.length; offset++)
    for (const [index, p] of ordered.entries()) {
      const target = targets[(index + offset) % targets.length];
      if (p.format === "เล่าเคส" && target.kind !== "case") continue;
      const idea = {
        title: truncateIdeaText(fill(p.title, target.title), 160),
        hook: truncateIdeaText(fill(p.hook, target.title), 800),
        angle: truncateIdeaText(fill(p.angle, target.title), 1500),
        cta: truncateIdeaText(fill(p.cta, target.title), 500),
        format: p.format,
        pillar: brief.pillar || "ให้ความรู้",
        origin: p.id.startsWith("base-") ? "โครงพื้นฐาน" : "ต่อยอดจาก Gemini",
        pattern_id: p.id,
      };
      candidates.push({ key: p.id + ":" + normalizedIdea(target.title), idea });
    }
  for (const s of usable.filter(
    (s) =>
      s.kind === "question" &&
      (!brief.format || brief.format === "ตอบคำถาม") &&
      (requested.includes(s) || relevant.includes(s)),
  ))
    candidates.unshift({
      key: "faq:" + s.id,
      idea: {
        title: s.title,
        hook: s.title,
        angle: truncateIdeaText(s.content, 1500),
        cta: "มีคำถามเพิ่มเติม ฝากไว้ได้เลย",
        format: "ตอบคำถาม",
        pillar: brief.pillar || "ให้ความรู้",
        origin: "คำถามลูกค้าจริง",
      },
    });
  return candidates.map((candidate) =>
    direction && goal
      ? {
          ...candidate,
          idea: {
            ...candidate.idea,
            angle:
              truncateIdeaText(candidate.idea.angle, 1200) +
              "\n" +
              direction.angle,
            cta: goal.cta || direction.cta,
          },
        }
      : candidate,
  );
}
