"use server";
import { requireAdmin } from "@/lib/auth";
import { database, dbError } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { buildSemanticPrompt, classifySemanticQuestion } from "@/lib/semantic";
import { semanticConfig } from "@/lib/semantic-config";
import type { ActionState } from "./actions";

export async function checkGemini(): Promise<ActionState> {
  await requireAdmin();
  const config = semanticConfig();
  if (!config.configured) return { ok: false, message: "ยังไม่ได้ตั้งค่าการเชื่อม Gemini" };
  const db = database();
  // Synthetic questions only: no real memory, LINE payload, or answer leaves the app.
  const candidate = { id: "550e8400-e29b-41d4-a716-446655440000", revision: "0".repeat(32), title: "อาหารที่ปีโป้ชอบ", content: "ปีโป้ชอบอาหารไทย โดยเฉพาะไก่ย่าง", questions: [] as string[] };
  const restaurant = { ...candidate, id: "550e8400-e29b-41d4-a716-446655440001", title: "ร้านอาหารแนะนำ", content: "ร้านอาหารที่แนะนำคือร้านไก่ย่างตัวอย่าง" };
  const flood = { ...candidate, id: "550e8400-e29b-41d4-a716-446655440002", title: "น้ำท่วม", content: "น้ำลดแล้ว รถเข้าได้ตามปกติ" };
  const opposite = { ...flood, id: "550e8400-e29b-41d4-a716-446655440003", content: "น้ำยังท่วม รถเข้าไม่ได้" };
  const cases = [
    { question: "ปปชอบกินอะไร", expected: "match", memories: [candidate] },
    { question: "ปปกินอะไรอยู่ตอนนี้", expected: "unknown", memories: [candidate] },
    { question: "กรชอบกินอะไร", expected: "unknown", memories: [candidate] },
    { question: "หิวข้าวมีร้านแนะนำไหม", expected: "match", memories: [restaurant] },
    { question: "น้ำท่วมป่ะ", expected: "match", memories: [flood] },
    { question: "ขับรถเข้าได้ไหม", expected: "match", memories: [flood] },
    { question: "พรุ่งนี้เชียงใหม่จะน้ำท่วมไหม", expected: "unknown", memories: [flood] },
    { question: "น้ำท่วมป่ะ", expected: "conflict", memories: [flood, opposite] },
  ];
  try {
    const rate = await db.rpc("pp_take_rate", { p_key: "ai:admin-check", p_limit: 1, p_seconds: 60 });
    dbError(rate.error); if (!rate.data) return { ok: false, message: "รอหนึ่งนาทีก่อนทดสอบใหม่" };
    for (const item of cases) {
      const slot = await db.rpc("pp_reserve_ai", { p_limit: config.limit });
      dbError(slot.error); if (!slot.data) return { ok: false, message: "โควตา AI เดือนนี้เต็มแล้ว" };
      const result = await classifySemanticQuestion(buildSemanticPrompt(item.question, "ปีโป้", item.memories));
      if (result.decision !== item.expected || (result.decision === "match" && result.id !== item.memories[0].id)
        || (result.decision === "conflict" && item.memories.some(m => !result.conflict_ids?.includes(m.id)))) {
        return { ok: false, message: `เชื่อม Google ได้ แต่ผลจับความหมายยังไม่ผ่าน: ${item.question}` };
      }
    }
    return { ok: true, message: "ผ่าน 8/8 ข้อ · อ่านชื่อและเนื้อหาโดยไม่มีคำถามตัวอย่าง ตอบเรื่องอาหาร น้ำท่วม รถเข้าได้ไหม และตรวจพบข้อมูลขัดกัน" };
  } catch (error) {
    // Never return raw provider errors: they may include tokens or request bodies.
    const safe = googleFailure(error);
    return { ok: false, message: `Google ยังไม่พร้อม · ${safe}` };
  } finally { revalidatePath("/admin"); }
}

function googleFailure(error: unknown): string {
  const e = error as { message?: string; name?: string; statusCode?: number; response?: { status?: number; data?: unknown } } | null;
  const status = e?.statusCode ?? e?.response?.status;
  const detail = `${e?.message || ""} ${JSON.stringify(e?.response?.data || {})}`;
  let reason = "ยังไม่ยืนยันการเชื่อมต่อ";
  if (/attribute condition|unauthorized_client/i.test(detail)) reason = "ตัวตนไม่ผ่านเงื่อนไข Google";
  else if (/invalid_target|audience|issuer/i.test(detail)) reason = "ตรวจผู้ออกและผู้รับตัวตน Google";
  else if (/SERVICE_DISABLED|has not been used|is disabled/i.test(detail)) reason = "บริการ Google ที่จำเป็นยังไม่เปิด";
  else if (/billing|paid account|free tier/i.test(detail)) reason = "บัญชี Google ยังไม่อนุญาตการเรียกแบบนี้";
  else if (/iam.serviceAccounts.getAccessToken|PERMISSION_DENIED|permission.*denied/i.test(detail)) reason = "สิทธิ์ Google ยังไม่พร้อม";
  else if (/oidc|identity token/i.test(detail)) reason = "รับตัวตน Vercel ไม่สำเร็จ";
  else if (/timed? ?out|abort/i.test(detail + e?.name)) reason = "หมดเวลารอ Google";
  else if (/not found|NOT_FOUND/i.test(detail)) reason = "ไม่พบโมเดลหรือทรัพยากร Google";
  return `${Number.isInteger(status) ? `HTTP ${status} · ` : ""}${reason}`;
}
