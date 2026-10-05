"use server";
import { plannerGoals } from "@/lib/planner-goal-data";
import { resolveGoal } from "@/lib/planner-goals";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { database, dbError } from "@/lib/db";
import { validateAttachments } from "@/lib/library";
import { plannerCatalog } from "@/lib/planner-data";
import { generatePlanner } from "@/lib/planner-ai";
import {
  brandSchema,
  sourceSchema,
  itemSchema,
  briefSchema,
  emptyItem,
  performanceSummary,
  thaiDay,
  type PlannerState,
  type ContentItem,
  type Generation,
} from "@/lib/planner-types";
import { freeCandidates, reusablePatternSchema } from "@/lib/planner-templates";
import { reusablePatterns } from "@/lib/planner-pattern-data";
const fail = (message: string): PlannerState => ({ ok: false, message });
export async function loadContentItem(
  id: string,
): Promise<{ item: ContentItem; drafts: Generation[] } | null> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return null;
  const db = database();
  const [item, drafts] = await Promise.all([
    db.from("content_items").select("*").eq("id", id).maybeSingle(),
    db
      .from("content_generations")
      .select("*")
      .eq("kind", "draft")
      .eq("status", "complete")
      .eq("request->>item_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  dbError(item.error);
  dbError(drafts.error);
  return item.data
    ? {
        item: item.data as ContentItem,
        drafts: (drafts.data || []) as Generation[],
      }
    : null;
}
const value = (f: FormData, k: string) => String(f.get(k) || "");
function done(id: string, revision?: string): PlannerState {
  revalidatePath("/planner", "layout");
  return { ok: true, message: "บันทึกแล้ว", id, revision };
}
function safeError(error: unknown) {
  console.error(
    JSON.stringify({
      code: "PP_PLANNER_ACTION_FAILED",
      kind: error instanceof Error ? error.name : "Unknown",
    }),
  );
  const message = error instanceof Error ? error.message : "";
  return fail(
    /^(ข้อมูลมาก|Gemini|AI มี|โควตา AI)/.test(message)
      ? message
      : "ทำรายการไม่สำเร็จ ข้อมูลเดิมยังอยู่ กรุณาลองอีกครั้ง",
  );
}
export async function savePlannerBrand(
  _: PlannerState,
  form: FormData,
): Promise<PlannerState> {
  await requireAdmin();
  const parsed = brandSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return fail("กรอกชื่อแบรนด์ และใช้ข้อความไม่เกิน 6,000 ตัวอักษรต่อช่อง");
  const id = value(form, "id"),
    revision = value(form, "revision");
  if (!z.uuid().safeParse(id).success) return fail("รหัสไม่ถูกต้อง");
  const db = database();
  const r = revision
    ? await db
        .from("content_brands")
        .update(parsed.data)
        .eq("id", id)
        .eq("updated_at", revision)
        .select("id,updated_at")
        .maybeSingle()
    : await db
        .from("content_brands")
        .insert({ ...parsed.data, id })
        .select("id,updated_at")
        .single();
  if (r.error)
    return fail(
      r.error.message.includes("PP_CONTENT_LIMIT")
        ? "เก็บได้สูงสุด 20 แบรนด์"
        : "บันทึกไม่ได้ กรุณาลองใหม่",
    );
  return r.data
    ? done(id, r.data.updated_at)
    : fail("ข้อมูลถูกแก้ไขจากอีกหน้าแล้ว ปิดแล้วเปิดใหม่ก่อนแก้ต่อ");
}
export async function savePlannerSource(
  _: PlannerState,
  form: FormData,
): Promise<PlannerState> {
  await requireAdmin();
  const parsed = sourceSchema.safeParse({
    ...Object.fromEntries(form),
    start_date: value(form, "start_date") || null,
    end_date: value(form, "end_date") || null,
  });
  if (!parsed.success)
    return fail("ตรวจชื่อ รายละเอียด แบรนด์ และช่วงวันที่อีกครั้ง");
  const id = value(form, "id"),
    revision = value(form, "revision");
  if (!z.uuid().safeParse(id).success) return fail("รหัสไม่ถูกต้อง");
  const db = database();
  const r = revision
    ? await db
        .from("content_sources")
        .update(parsed.data)
        .eq("id", id)
        .eq("updated_at", revision)
        .select("id,updated_at")
        .maybeSingle()
    : await db
        .from("content_sources")
        .insert({ ...parsed.data, id })
        .select("id,updated_at")
        .single();
  return r.error
    ? fail("บันทึกไม่ได้ (วัตถุดิบเก็บได้สูงสุด 500 รายการ)")
    : r.data
      ? done(id, r.data.updated_at)
      : fail("ข้อมูลถูกแก้ไขจากอีกหน้าแล้ว ปิดแล้วเปิดใหม่ก่อนแก้ต่อ");
}
export async function deletePlannerSource(
  id: string,
  revision: string,
): Promise<PlannerState> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return fail("รหัสไม่ถูกต้อง");
  const r = await database()
    .from("content_sources")
    .delete()
    .eq("id", id)
    .eq("updated_at", revision)
    .select("id")
    .maybeSingle();
  return r.error || !r.data
    ? fail("ลบไม่ได้ ข้อมูลอาจเปลี่ยนไปแล้ว")
    : done(id);
}
export async function deleteUnusedBrand(
  id: string,
  revision: string,
): Promise<PlannerState> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return fail("รหัสไม่ถูกต้อง");
  const r = await database()
    .from("content_brands")
    .delete()
    .eq("id", id)
    .eq("updated_at", revision)
    .select("id")
    .maybeSingle();
  return r.error || !r.data
    ? fail(
        "ลบไม่ได้ แบรนด์อาจมีวัตถุดิบหรือชิ้นงานผูกอยู่ หรือข้อมูลถูกแก้ไขจากหน้าอื่น",
      )
    : done(id);
}
export async function saveContentItem(
  input: unknown,
  id: string,
  revision: string | null,
): Promise<PlannerState> {
  await requireAdmin();
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message || "ตรวจข้อมูลอีกครั้ง");
  if (!z.uuid().safeParse(id).success) return fail("รหัสไม่ถูกต้อง");
  try {
    const db = database(),
      data = parsed.data;
    if (
      !(await validateAttachments(
        data.attachment_ids,
        data.group_id ? "shareable" : "private",
      ))
    )
      return fail("ไฟล์ถูกลบ หรือใช้ส่งเข้ากลุ่มไม่ได้ กรุณาเลือกใหม่");
    if (data.group_id) {
      const r = await db
        .from("permissions")
        .select("enabled")
        .eq("group_id", data.group_id)
        .maybeSingle();
      dbError(r.error);
      if (!r.data?.enabled) return fail("กลุ่มนี้ยังไม่เปิดใช้งาน");
    }
    if (data.notify_owner) {
      const r = await db
        .from("owner")
        .select("line_user_id")
        .eq("id", 1)
        .single();
      dbError(r.error);
      if (!r.data?.line_user_id)
        return fail("ตั้งค่า LINE ของเจ้าของในหน้า MEMORY ก่อน");
    }
    const r = revision
      ? await db
          .from("content_items")
          .update(data)
          .eq("id", id)
          .eq("updated_at", revision)
          .select("id,updated_at")
          .maybeSingle()
      : await db
          .from("content_items")
          .insert({ ...data, id })
          .select("id,updated_at")
          .single();
    if (r.error)
      return fail(
        r.error.message.includes("PP_CONTENT_LIMIT")
          ? "คลังเต็ม 1,000 ชิ้น กรุณาจัดการงานเก่าก่อน"
          : "บันทึกไม่ได้ กรุณาลองใหม่",
      );
    return r.data
      ? done(id, r.data.updated_at)
      : fail("มีการแก้ไขงานนี้จากอีกหน้าแล้ว กรุณาปิดและเปิดใหม่ก่อนบันทึก");
  } catch (e) {
    return safeError(e);
  }
}
export async function moveContentItem(
  id: string,
  revision: string,
  patch: unknown,
): Promise<PlannerState> {
  await requireAdmin();
  const p = z
    .object({
      status: z
        .enum(["idea", "making", "review", "ready", "posted"])
        .optional(),
      scheduled_at: z.iso.datetime({ offset: true }).nullable().optional(),
      archived: z.boolean().optional(),
    })
    .strict()
    .safeParse(patch);
  if (!p.success || !z.uuid().safeParse(id).success)
    return fail("ข้อมูลไม่ถูกต้อง");
  const r = await database()
    .from("content_items")
    .update(p.data)
    .eq("id", id)
    .eq("updated_at", revision)
    .select("id,updated_at")
    .maybeSingle();
  return r.error || !r.data
    ? fail("ข้อมูลเปลี่ยนไปแล้ว กรุณาโหลดใหม่")
    : done(id, r.data.updated_at);
}
export async function deleteArchivedContent(
  id: string,
  revision: string,
): Promise<PlannerState> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return fail("รหัสไม่ถูกต้อง");
  const r = await database()
    .from("content_items")
    .delete()
    .eq("id", id)
    .eq("updated_at", revision)
    .eq("archived", true)
    .select("id")
    .maybeSingle();
  return r.error || !r.data
    ? fail(
        "ลบไม่ได้ ต้องเก็บงานเข้าคลังก่อน และข้อมูลต้องไม่ถูกแก้ไขจากหน้าอื่น",
      )
    : done(id);
}
export async function createPlannerGeneration(
  input: unknown,
  id: string,
  engine: "ai" | "template",
  itemId?: string,
): Promise<PlannerState> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success || !["ai", "template"].includes(engine))
    return fail("ข้อมูลไม่ถูกต้อง");
  const brief = briefSchema.safeParse(input);
  if (!brief.success) return fail("กรอกหัวข้อและตรวจข้อมูลที่เลือกอีกครั้ง");
  const db = database();
  try {
    const prior = await db
      .from("content_generations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    dbError(prior.error);
    if (prior.data)
      return prior.data.status === "complete"
        ? {
            ok: true,
            message: "เปิดผลเดิมแล้ว",
            generation: prior.data as Generation,
          }
        : fail("คำขอนี้กำลังทำงานหรือทำไม่สำเร็จ กรุณาสร้างรอบใหม่");
    const [{ brands, sources }, goalSettings] = await Promise.all([
      plannerCatalog(),
      plannerGoals(),
    ]);
    const selectedGoal = resolveGoal(brief.data, goalSettings.goals);
    if (brief.data.goal_id && !selectedGoal)
      return fail("หัวข้อนี้ถูกลบแล้ว กรุณาเลือกเป้าหมายใหม่");
    if (selectedGoal) brief.data.goal = selectedGoal.label;
    const brand = brands.find((b) => b.id === brief.data.brand_id) || null;
    if (brief.data.brand_id && !brand) return fail("ไม่พบแบรนด์ที่เลือก");
    const selected = sources.filter(
      (s) =>
        s.brand_id === brand?.id &&
        (!brief.data.source_ids.length || brief.data.source_ids.includes(s.id)),
    );
    if (brief.data.source_ids.some((s) => !selected.some((v) => v.id === s)))
      return fail("วัตถุดิบต้องอยู่ในแบรนด์ที่เลือก");
    let item: ContentItem | null = null;
    if (itemId) {
      if (!z.uuid().safeParse(itemId).success) return fail("ไม่พบงาน");
      const r = await db
        .from("content_items")
        .select("*")
        .eq("id", itemId)
        .single();
      dbError(r.error);
      item = r.data as ContentItem;
      if (item.brand_id !== brief.data.brand_id)
        return fail("แบรนด์ของงานเปลี่ยนแล้ว กรุณาเปิดใหม่");
    }
    const measured = await db
      .from("content_items")
      .select("brand_id,channel,status,archived,format,views,saves,sales")
      .eq("status", "posted")
      .eq("archived", false)
      .limit(1000);
    dbError(measured.error);
    const feedback = performanceSummary(
      (measured.data || []).filter(
        (i) =>
          i.brand_id === brief.data.brand_id &&
          i.channel === brief.data.channel,
      ) as ContentItem[],
    );
    const priorTitles =
      !item && engine === "ai"
        ? await db
            .from("content_idea_seen")
            .select("title")
            .eq("scope", brief.data.brand_id || "unbranded")
            .order("created_at", { ascending: false })
            .limit(80)
        : { data: [], error: null };
    dbError(priorTitles.error);
    const context = {
      previously_proposed_titles: (priorTitles.data || []).map((i) => i.title),
      today: thaiDay(),
      brief: brief.data,
      content_goal: selectedGoal || null,
      brand,
      sources: selected,
      item,
      feedback,
    };
    if (Buffer.byteLength(JSON.stringify(context)) > 64000)
      return fail("ข้อมูลมากเกินไป เลือกวัตถุดิบให้น้อยลงก่อน");
    const kind = item ? "draft" : "ideas";
    const created = await db
      .from("content_generations")
      .insert({ id, kind, engine, request: { ...context, item_id: item?.id } });
    if (created.error) return fail("คำขอซ้ำหรือบันทึกไม่ได้ กรุณารอสักครู่");
    try {
      const generated =
        engine === "ai"
          ? await generatePlanner(kind, context)
          : {
              result: item
                ? {
                    draft: {
                      caption: `${item.hook}\n\n${item.angle}\n\n${item.cta}`,
                      script: `เปิด: ${item.hook}\nเนื้อหา: ${item.angle}\nปิด: ${item.cta}`,
                      shots:
                        "1. ภาพเปิดที่ตรงกับ Hook\n2. สินค้าหรือขั้นตอนจริง\n3. ภาพสรุปและข้อความชวนทำต่อ",
                      hashtags: "",
                      visual:
                        "ใช้ภาพจริงของแบรนด์ ตรวจข้อความและรายละเอียดก่อนเผยแพร่",
                    },
                  }
                : { ideas: [] },
              model: null,
              input_tokens: null,
              output_tokens: null,
            };
      if (kind === "ideas") {
        const patterns = (
          (generated.result as NonNullable<Generation["result"]>).patterns || []
        ).flatMap((p) => {
          const v = reusablePatternSchema.safeParse(p);
          return v.success ? [v.data] : [];
        });
        const candidates =
          engine === "ai"
            ? (generated.result.ideas || []).map((idea) => ({
                key: "ai:" + idea.title,
                idea: { ...idea, origin: "Gemini" },
              }))
            : freeCandidates(
                brief.data,
                selected,
                await reusablePatterns(brief.data.brand_id),
                thaiDay(),
                selectedGoal,
              );
        const completed = await db.rpc("pp_finish_ideas", {
          p_id: id,
          p_candidates: candidates.slice(0, 6000),
          p_patterns: patterns,
          p_raw: generated.result,
          p_model: generated.model,
          p_input: generated.input_tokens,
          p_output: generated.output_tokens,
        });
        if (completed.error)
          console.error(
            JSON.stringify({
              code: "PP_PLANNER_FINISH_FAILED",
              databaseCode: completed.error.code,
            }),
          );
        dbError(completed.error);
        revalidatePath("/planner");
        const generation = completed.data as Generation;
        return {
          ok: true,
          message: generation.result?.notice || "พร้อมแล้ว",
          generation,
        };
      }
      const saved = await db
        .from("content_generations")
        .update({
          ...generated,
          status: "complete",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      dbError(saved.error);
      revalidatePath("/planner");
      return {
        ok: true,
        message: "พร้อมแล้ว",
        generation: saved.data as Generation,
      };
    } catch (e) {
      await db
        .from("content_generations")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "pending");
      return safeError(e);
    }
  } catch (e) {
    return safeError(e);
  }
}
export async function keepPlannerIdea(
  generationId: string,
  index: number,
): Promise<PlannerState> {
  await requireAdmin();
  if (
    !z.uuid().safeParse(generationId).success ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 4
  )
    return fail("ไอเดียไม่ถูกต้อง");
  const db = database();
  const r = await db
    .from("content_generations")
    .select("*")
    .eq("id", generationId)
    .eq("status", "complete")
    .single();
  if (r.error) return fail("ไม่พบไอเดีย");
  const gen = r.data as Generation;
  const idea = gen.result?.ideas?.[index];
  if (!idea) return fail("ไม่พบไอเดีย");
  const prior = await db
    .from("content_items")
    .select("id")
    .eq("generation_id", generationId)
    .eq("idea_index", index)
    .maybeSingle();
  if (prior.data)
    return { ok: true, message: "เก็บไว้แล้ว", id: prior.data.id };
  const data = {
    ...itemSchema.parse({
      ...emptyItem(),
      ...idea,
      channel: gen.request.brief.channel,
      brand_id: gen.request.brief.brand_id,
    }),
    generation_id: generationId,
    idea_index: index,
  };
  const saved = await db
    .from("content_items")
    .insert(data)
    .select("id")
    .single();
  if (saved.error) {
    const retry = await db
      .from("content_items")
      .select("id")
      .eq("generation_id", generationId)
      .eq("idea_index", index)
      .maybeSingle();
    return retry.data
      ? done(retry.data.id)
      : fail("เก็บไม่ได้ คลังอาจเต็ม กรุณาลองใหม่");
  }
  return done(saved.data.id);
}

export async function loadPlannerPatterns(brandId: string | null) {
  await requireAdmin();
  if (brandId !== null && !z.uuid().safeParse(brandId).success)
    throw Error("แบรนด์ไม่ถูกต้อง");
  return reusablePatterns(brandId);
}
export async function setPlannerPatternEnabled(
  id: string,
  enabled: boolean,
): Promise<PlannerState> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success || typeof enabled !== "boolean")
    return fail("ข้อมูลไม่ถูกต้อง");
  const r = await database()
    .from("content_patterns")
    .update({ enabled })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (r.error || !r.data) return fail("บันทึกโครงไม่สำเร็จ");
  revalidatePath("/planner");
  return { ok: true, message: enabled ? "เปิดใช้โครงแล้ว" : "พักโครงแล้ว" };
}
