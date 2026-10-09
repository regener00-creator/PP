"use client";
import { useActionState, useState } from "react";
import { saveAssistantNote, deleteAssistantNote } from "@/app/admin/assistant-note-actions";
import type { ManagedAssistantNote } from "@/lib/assistant-notes-types";
const initial = { ok: false, message: "" };
export function AssistantNoteEditor({ note, onComplete }: { note: ManagedAssistantNote; onComplete: (message: string) => void }) {
  const [state, save, saving] = useActionState(async (previous: typeof initial, form: FormData) => {
    try {
      const result = await saveAssistantNote(previous, form);
      if (result.ok) onComplete(result.message);
      return result;
    } catch { return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลในฟอร์มยังอยู่" }; }
  }, initial);
  const [deleted, remove, deleting] = useActionState(async (previous: typeof initial, form: FormData) => {
    try {
      const result = await deleteAssistantNote(previous, form);
      if (result.ok) onComplete(result.message);
      return result;
    } catch { return { ok: false, message: "ลบไม่สำเร็จ กรุณาลองอีกครั้ง" }; }
  }, initial);
  // Keep the version that was opened, even if a background refresh brings a newer record.
  const [original] = useState(note);
  const target = <><input type="hidden" name="id" value={original.id}/><input type="hidden" name="group" value={original.group || ""}/><input type="hidden" name="updated_at" value={original.updated_at}/></>;
  return <div className="stack">
    <p className="assistant-note-origin">{note.sourceLabel}</p>
    <form action={save} className="stack">
      {target}
      <label>ชื่อความจำ<input name="title" required maxLength={120} defaultValue={original.title} disabled={saving || deleting}/></label>
      <label>ข้อมูลที่อยากให้จำ<textarea name="content" required maxLength={2000} rows={7} defaultValue={original.content} disabled={saving || deleting}/></label>
      <button disabled={saving || deleting}>{saving ? "กำลังบันทึก…" : "บันทึกความจำ"}</button>
      <p role="status">{state.message}</p>
    </form>
    <form action={remove} onSubmit={e => { if (!confirm(`ลบความจำ “${original.title}” จาก${original.sourceLabel}?`)) e.preventDefault(); }}>
      {target}<button className="danger secondary" disabled={saving || deleting}>{deleting ? "กำลังลบ…" : "ลบความจำ"}</button>
      <p role="status">{deleted.message}</p>
    </form>
  </div>;
}

