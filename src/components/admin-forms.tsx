"use client";
import { useActionState, useRef, useState } from "react";
import { saveMemory, deleteMemory, saveOwner, saveUnknownReply, savePermission, type ActionState } from "@/app/admin/actions";
import { AttachmentPicker, type LibraryFile, type LibraryFolder } from "./attachment-picker";
import type { MemoryColor } from "@/lib/memory-layout";
import { MAX_UNKNOWN_REPLIES } from "@/lib/policy";
const initial: ActionState = { ok: false, message: "" };
export type Memory = { id: string; title: string; content: string; answer_variants?: string[]; visibility: string; question_examples: string[]; expires_at: string | null; mention_owner: boolean; attachment_ids?: string[]; card_color?: MemoryColor | null };
export { MemoryForm } from "./memory-form";
export function DeleteMemory({ id }: { id: string }) {
  return <form action={deleteMemory} onSubmit={event => { if (!confirm("ลบความจำนี้ออกจาก PP?")) event.preventDefault(); }}><input name="id" value={id} type="hidden"/><button className="danger secondary">ลบความจำ</button></form>;
}
export function OwnerForm({ owner }: { owner: { display_name: string; line_user_id: string | null } }) {
  const [state, action, pending] = useActionState(saveOwner, initial);
  return <form action={action} className="stack"><label>ชื่อที่เพื่อนเรียก<input name="display_name" defaultValue={owner.display_name} required maxLength={60}/></label><label>LINE user ID ของคุณ<input name="line_user_id" defaultValue={owner.line_user_id || ""} placeholder="U + 32 ตัวอักษร" maxLength={33}/></label><small>ใช้ ID จาก Messaging API channel เดียวกับ PP และต้องอยู่ในกลุ่มที่จะให้แท็ก</small><button disabled={pending}>บันทึกเจ้าของ</button><p role="status" className="form-status">{state.message}</p></form>;
}
export type Permission = { group_id: string; label: string; enabled: boolean; allow_owner_mention: boolean };
export function UnknownReplyForm({ values }: { values: string[] }) {
  const [state, action, pending] = useActionState(saveUnknownReply, initial);
  const [items, setItems] = useState(() => values.map((text, id) => ({ id, text })));
  const nextId = useRef(values.length);
  return <form action={action} className="stack reply-settings">
    <div className="reply-options">{items.map((item, index) => <div className="reply-option" key={item.id}>
      <label>ข้อความที่ {index + 1}<textarea name="unknown_replies" value={item.text} onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, text: event.target.value } : row))} required maxLength={2000} rows={3} disabled={pending} placeholder="พิมพ์ข้อความที่อยากให้น้องโจอาตอบ"/></label>
      <button type="button" className="secondary danger" aria-label={`ลบข้อความที่ ${index + 1}`} disabled={pending || items.length === 1} onClick={() => setItems(current => current.filter(row => row.id !== item.id))}>ลบ</button>
    </div>)}</div>
    <div className="reply-actions"><button type="button" className="secondary" disabled={pending || items.length >= MAX_UNKNOWN_REPLIES} onClick={() => { const id = nextId.current++; setItems(current => [...current, { id, text: "" }]); }}>เพิ่มข้อความ</button>
      <small>{items.length} / {MAX_UNKNOWN_REPLIES} ข้อความ</small><button disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกข้อความ"}</button></div>
    <p role="status" className={state.ok ? "form-status success" : "form-status"}>{state.message}</p>
  </form>;
}
export function PermissionForm({ permission }: { permission?: Permission }) {
  const [state, action, pending] = useActionState(savePermission, initial);
  return <form action={action} className="stack"><label>ชื่อกลุ่ม<input name="label" maxLength={80} defaultValue={permission?.label} placeholder="กลุ่มเพื่อนสนิท"/></label><label>LINE group ID<input name="group_id" required readOnly={!!permission} defaultValue={permission?.group_id} placeholder="C + 32 ตัวอักษร" maxLength={33}/></label><label className="check"><input type="checkbox" name="enabled" defaultChecked={permission?.enabled}/>อนุญาตให้ PP ตอบในกลุ่มนี้</label><label className="check"><input type="checkbox" name="allow_owner_mention" defaultChecked={permission?.allow_owner_mention ?? true}/>อนุญาตให้เรียกเจ้าของมาตอบ</label><button disabled={pending}>บันทึกสิทธิ์กลุ่ม</button><p role="status" className="form-status">{state.message}</p></form>;
}
