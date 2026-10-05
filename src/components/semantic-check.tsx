"use client";
import { useActionState } from "react";
import { checkGemini } from "@/app/admin/ai-actions";
export function SemanticCheck() {
  const [state, action, pending] = useActionState(checkGemini, { ok: false, message: "" });
  return <form action={action}><button className="secondary" disabled={pending}>{pending ? "กำลังทดสอบ…" : "ทดสอบ Gemini ด้วยคำถามสมมติ"}</button><small>ใช้โควตาสูงสุด 8 ครั้ง ไม่มีการส่งข้อความเข้า LINE หรือเพิ่มความจำ</small><p role="status" className={state.ok ? "form-status success" : "form-status"}>{state.message}</p></form>;
}
