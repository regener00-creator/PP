"use client";
import { useActionState } from "react";
import { saveMemory, deleteMemory, saveOwner, savePermission, type ActionState } from "@/app/admin/actions";
const initial: ActionState = { ok: false, message: "" };
export type Memory = { id: string; title: string; content: string; visibility: string; question_examples: string[]; expires_at: string | null };
export function MemoryForm({ memory }: { memory?: Memory }) {
  const [state, action, pending] = useActionState(saveMemory, initial);
  return <form action={action} className="stack"><input type="hidden" name="id" value={memory?.id || ""}/><label>ชื่อความจำ<input name="title" defaultValue={memory?.title} required maxLength={120} placeholder="เช่น อาหารที่ชอบ"/></label><label>คำถามที่ให้ PP ตอบ <small>หนึ่งคำถามต่อบรรทัด ไม่ต้องใส่ @pp</small><textarea name="aliases" required rows={3} defaultValue={memory?.question_examples.join("\n")} placeholder={"ปีโป้ชอบกินอะไร\nปีโป้ชอบอาหารอะไร"}/></label><label>คำตอบของ PP<textarea name="content" required rows={3} maxLength={2000} defaultValue={memory?.content} placeholder="เขียนคำตอบที่พร้อมให้ PP ส่งในกลุ่ม"/></label><div className="form-columns"><label>ใครรู้เรื่องนี้ได้<select name="visibility" defaultValue={memory?.visibility || "private"}><option value="private">Private · เก็บไว้ส่วนตัว</option><option value="shareable">Shareable · ให้ทุกคนในกลุ่มรู้</option></select></label><label>ใช้ได้ถึงวันที่ <small>เว้นว่างถ้าไม่หมดอายุ</small><input name="expires_at" type="date" defaultValue={memory?.expires_at ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(memory.expires_at)) : ""}/></label></div><button disabled={pending}>{pending ? "กำลังบันทึก…" : memory ? "บันทึกการแก้ไข" : "เพิ่มความจำ +"}</button><p role="status" className={state.ok ? "form-status success" : "form-status"}>{state.message}</p></form>;
}
export function DeleteMemory({ id }: { id: string }) {
  return <form action={deleteMemory} onSubmit={event => { if (!confirm("ลบความจำนี้ออกจาก PP?")) event.preventDefault(); }}><input name="id" value={id} type="hidden"/><button className="danger secondary">ลบความจำ</button></form>;
}
export function OwnerForm({ owner }: { owner: { display_name: string; line_user_id: string | null } }) {
  const [state, action, pending] = useActionState(saveOwner, initial);
  return <form action={action} className="stack"><label>ชื่อที่เพื่อนเรียก<input name="display_name" defaultValue={owner.display_name} required maxLength={60}/></label><label>LINE user ID ของคุณ<input name="line_user_id" defaultValue={owner.line_user_id || ""} placeholder="U + 32 ตัวอักษร" maxLength={33}/></label><small>ใช้ ID จาก Messaging API channel เดียวกับ PP และต้องอยู่ในกลุ่มที่จะให้แท็ก</small><button disabled={pending}>บันทึกเจ้าของ</button><p role="status" className="form-status">{state.message}</p></form>;
}
export type Permission = { group_id: string; label: string; enabled: boolean; allow_owner_mention: boolean };
export function PermissionForm({ permission }: { permission?: Permission }) {
  const [state, action, pending] = useActionState(savePermission, initial);
  return <form action={action} className="stack"><label>ชื่อกลุ่ม<input name="label" maxLength={80} defaultValue={permission?.label} placeholder="กลุ่มเพื่อนสนิท"/></label><label>LINE group ID<input name="group_id" required readOnly={!!permission} defaultValue={permission?.group_id} placeholder="C + 32 ตัวอักษร" maxLength={33}/></label><label className="check"><input type="checkbox" name="enabled" defaultChecked={permission?.enabled}/>อนุญาตให้ PP ตอบในกลุ่มนี้</label><label className="check"><input type="checkbox" name="allow_owner_mention" defaultChecked={permission?.allow_owner_mention ?? true}/>อนุญาตให้เรียกเจ้าของมาตอบ</label><button disabled={pending}>บันทึกสิทธิ์กลุ่ม</button><p role="status" className="form-status">{state.message}</p></form>;
}
