import { database } from "@/lib/db";
import { AI_MODEL, semanticConfig } from "@/lib/semantic-config";
import { SemanticCheck } from "./semantic-check";

// Render only inside the authenticated admin page.
export async function SemanticStatus() {
  const config = semanticConfig();
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).format(new Date()) + "-01";
  const usage = await database().from("ai_usage").select("calls").eq("month", month).maybeSingle();
  return <section className="panel" id="ai"><div className="eyebrow">UNDERSTAND THE QUESTION</div><h2>จับความหมายด้วย Gemini</h2>
    <p><strong>{config.enabled ? "เปิดใช้งานแล้ว" : "ยังไม่เปิดใช้งาน · รอเชื่อมบัญชี Google"}</strong></p>
    <p>เดือนนี้ใช้ {usage.error ? "ตรวจยอดไม่ได้" : `${usage.data?.calls || 0} / ${config.limit}`} ครั้ง · เริ่มนับใหม่วันที่ 1 เวลาไทย</p>
    <p>AI อ่านชื่อ ข้อมูล และคำถามตัวอย่างจากความจำที่อนุมัติแล้ว เพื่อหาเรื่องที่ตอบคำถามได้ ใช้ได้ทั้งในกลุ่มและแชตส่วนตัว ไม่จำเป็นต้องกรอกคำถามทุกสำนวน ข้อมูลที่แก้ไขจะใช้ในการถามครั้งถัดไป</p>
    <small>ส่งคำถามและเนื้อหาความจำที่ใช้ตอบได้ให้ Google เพื่อค้นและตรวจข้อมูล ไม่ส่งความจำ Private เก่า รูปหรือเนื้อหาไฟล์แนบ</small>
    <p>ชื่อที่หมายถึงเจ้าของคนเดียวกัน: {config.aliases.join(" / ")} · {AI_MODEL}</p>
    <small>ใช้ AI เฉพาะเมื่อคำถามไม่ตรงกับตัวอย่างเดิม สูงสุด 6 ครั้งต่อนาทีรวมทุกแชต เมื่อครบโควตาหรือ AI ใช้ไม่ได้ PP ยังตอบคำถามที่ตรงกับตัวอย่างได้ ตัวนับนี้ควบคุมเฉพาะ PP ไม่ใช่วงเงินทั้งบัญชี Google</small>
    <SemanticCheck/>
  </section>;
}
