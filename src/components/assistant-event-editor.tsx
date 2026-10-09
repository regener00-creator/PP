"use client";
import { useActionState } from "react";
import { saveCalendarAppointment, deleteCalendarAppointment } from "@/app/admin/assistant-calendar-actions";
import type { CalendarEntry } from "@/lib/calendar";

const initial = { ok: false, message: "" };
export function AssistantEventEditor({ event, recipient }: { event: CalendarEntry; recipient: string }) {
  const [state, save, saving] = useActionState(saveCalendarAppointment, initial);
  const [deleted, remove, deleting] = useActionState(deleteCalendarAppointment, initial);
  const record = event.assistant!;
  return <div className="stack">
    <p className="muted">นัดหมายจากเลขา · แจ้งเตือนที่ {recipient}</p>
    <form action={save} className="stack calendar-editor">
      <input type="hidden" name="id" value={record.id}/>
      <input type="hidden" name="group" value={record.group || ""}/>
      <div className="calendar-editor-heading">
        <label className="calendar-title-field">เรื่อง<input name="title" required maxLength={120} defaultValue={event.title}/></label>
        <label>วันที่<input name="event_date" type="date" required defaultValue={event.event_date}/></label>
        <label>เวลาแจ้งเตือน<input name="reminder_time" type="time" step="60" required defaultValue={(event?.reminder_time || "08:00").slice(0,5)}/></label>
        <label className="calendar-toggle"><input name="annual" type="checkbox" defaultChecked={event.annual}/>ทำซ้ำทุกปี</label>
      </div>
      <small>เวลาไทย · เตือนล่วงหน้า 1 วันจะใช้เวลาเดียวกัน</small>
      <label>ข้อความที่จะส่ง<textarea name="content" required maxLength={1500} rows={3} defaultValue={event.message}/></label>
      <div className="calendar-reminder-options">
        <span>เตือนในวันนัด</span>
        <label className="calendar-toggle"><input name="remind_before" type="checkbox" defaultChecked={event.remind_before}/>เตือนล่วงหน้า 1 วัน</label>
      </div>
      <button disabled={saving || deleting}>{saving ? "กำลังบันทึก…" : "บันทึกรายการ"}</button>
      <p role="status">{state.message}</p>
    </form>
    <div className="row between">
      <form action={remove} onSubmit={e => { if (!confirm("ลบนัดหมายนี้และหยุดแจ้งเตือนครั้งถัดไป?")) e.preventDefault(); }}>
        <input type="hidden" name="id" value={record.id}/>
        <input type="hidden" name="group" value={record.group || ""}/>
        <button className="danger secondary" disabled={saving || deleting}>ลบนัดหมาย</button>
        <p role="status">{deleted.message}</p>
      </form>
    </div>
  </div>;
}
