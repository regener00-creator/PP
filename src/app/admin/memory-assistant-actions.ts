"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { database, dbError } from "@/lib/db";
import { memoryInput } from "@/lib/validation";
import { normalizeQuestion } from "@/lib/policy";
import { attachmentIds, validateAttachments } from "@/lib/library";
import { memoryCatalog, payloadDigest, readReview, reviewMemoryCollection, signReview, type ReviewPair } from "@/lib/memory-assistant";
import type { MemoryReviewState } from "@/lib/memory-assistant-types";

export async function saveAssistedMemory(_: MemoryReviewState, form: FormData): Promise<MemoryReviewState> {
  await requireAdmin();
  const str = (key: string) => String(form.get(key) || "");
  if (form.has("visibility") && str("visibility") !== "shareable") return { ok: false, message: "กรุณารีเฟรชหน้าก่อนบันทึก" };
  const parsed = memoryInput.safeParse({ title: str("title"), content: str("content"), aliases: str("aliases").split(/\r?\n/).map(s => s.trim()).filter(Boolean), mention_owner: form.get("mention_owner") === "on", expires_at: str("expires_at") ? `${str("expires_at")}T23:59:59+07:00` : null });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const id = str("id"), remove = str("remove_id");
  if ((id && !z.uuid().safeParse(id).success) || (remove && (!z.uuid().safeParse(remove).success || remove === id))) return { ok: false, message: "รหัสความจำไม่ถูกต้อง" };
  const files = attachmentIds.safeParse(form.getAll("attachment_ids").map(String));
  if (!files.success || !await validateAttachments(files.data, "shareable")) return { ok: false, message: "เลือกไฟล์ที่ใช้ได้สูงสุด 10 ไฟล์" };
  const value = { ...parsed.data, id, aliases: [...new Set(parsed.data.aliases.map(normalizeQuestion))], question_examples: parsed.data.aliases, attachment_ids: files.data };
  const digest = payloadDigest({ value, remove });
  try {
    const catalog = await memoryCatalog();
    if ((id && !catalog.memories.some(m => m.id === id)) || (remove && !catalog.memories.some(m => m.id === remove))) return { ok: false, message: "ความจำเปลี่ยนแล้ว กรุณาเปิดรายการใหม่" };
    let review = readReview(str("receipt"), digest);
    if (review?.catalog !== catalog.revision) review = null;
    if (!review || form.get("decision") !== "confirm") {
      const others = catalog.memories.filter(m => m.id !== id && m.id !== remove);
      let pairs: ReviewPair[] = [];
      let unchecked = false, warning = "";
      // Equal literal content is a useful offline check; semantic comparisons need AI.
      if (others.length) {
        try { pairs = await reviewMemoryCollection(others, value); }
        catch (error) {
          unchecked = true; warning = error instanceof Error ? error.message : "ตรวจไม่สำเร็จ";
          pairs = others.filter(m => m.content.trim() === value.content.trim()).map(m => ({ left: "draft", right: m.id, kind: "duplicate" as const, reason: "เนื้อหาเหมือนกัน" })).slice(0, 40);
        }
      }
      const receipt = signReview({ digest, catalog: catalog.revision, pairs });
      if (pairs.length || unchecked) return { ok: false, message: unchecked ? `${warning} ข้อมูลยังไม่ถูกบันทึก` : "พบความจำที่เกี่ยวข้อง เลือกวิธีบันทึกด้านล่าง", receipt, unchecked,
        concerns: pairs.map(pair => ({ memory: others.find(m => m.id === (pair.left === "draft" ? pair.right : pair.left))!, kind: pair.kind, reason: pair.reason })) };
      review = readReview(receipt, digest)!;
    }
    const concerns = review.pairs.map(pair => ({ id: pair.left === "draft" ? pair.right : pair.left, kind: pair.kind, reason: pair.reason }));
    const saved = await database().rpc("pp_save_assisted_memory", { p_value: value, p_catalog: review.catalog, p_remove: remove || null, p_concerns: concerns }); dbError(saved.error);
    if (saved.data?.decision !== "saved") return { ok: false, message: "มีความจำเปลี่ยนระหว่างตรวจ กดบันทึกเพื่อตรวจใหม่อีกครั้ง" };
    revalidatePath("/admin"); return { ok: true, savedId: saved.data.id, message: remove ? "รวมและบันทึกความจำแล้ว" : "บันทึกความจำแล้ว" };
  } catch { return { ok: false, message: "บันทึกไม่สำเร็จ ลองอีกครั้ง ข้อมูลในฟอร์มยังอยู่" }; }
}

export async function auditMemories(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  try {
    const catalog = await memoryCatalog();
    if (catalog.memories.length < 2) return { ok: true, message: "ยังไม่มีหลายก้อนให้เปรียบเทียบ" };
    const pairs = (await reviewMemoryCollection(catalog.memories)).filter(p => p.kind !== "related");
    let recorded = 0;
    for (const pair of pairs) {
      const a = catalog.memories.find(m => m.id === pair.left)!, b = catalog.memories.find(m => m.id === pair.right)!;
      const result = await database().rpc("pp_record_memory_issue", { p_left: a.id, p_right: b.id, p_left_revision: a.revision, p_right_revision: b.revision, p_kind: pair.kind, p_reason: pair.reason }); dbError(result.error);
      if (result.data) recorded++;
    }
    revalidatePath("/admin"); return { ok: true, message: recorded ? `พบ ${recorded} คู่ที่ควรตรวจ ดูรายการด้านล่าง` : "ตรวจแล้ว ไม่พบความจำซ้ำหรือข้อมูลขัดกันในรอบนี้" };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "ตรวจไม่สำเร็จ" }; }
}
export async function dismissMemoryIssue(id: string): Promise<void> {
  await requireAdmin(); const parsed = z.uuid().parse(id);
  const result = await database().from("memory_issues").update({ status: "dismissed" }).eq("id", parsed); dbError(result.error);
  revalidatePath("/admin");
}
