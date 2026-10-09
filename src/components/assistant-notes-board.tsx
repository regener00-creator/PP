"use client";
import { useActionState, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAssistantNote, deleteAssistantNote } from "@/app/admin/assistant-note-actions";
import type { ManagedAssistantNote } from "@/lib/assistant-notes-types";
import { Dialog } from "./workspace-ui";
import { TilePages } from "./tile-pages";

const initial = { ok: false, message: "" };

export function AssistantNotesBoard({ notes }: { notes: ManagedAssistantNote[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [notice, setNotice] = useState("");
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();
  const id = useId();
  const term = search.trim().normalize("NFC").toLocaleLowerCase("th");
  const sources = new Map(notes.map(n => [n.group || "owner", n.sourceLabel]));
  const activeSource = sources.has(source) ? source : "all";
  const shown = notes.filter(n => (activeSource === "all" || (n.group || "owner") === activeSource)
    && `${n.title}\n${n.content}\n${n.sourceLabel}`.normalize("NFC").toLocaleLowerCase("th").includes(term));
  const note = notes.find(n => n.id === selected);
  function completed(message: string) { setSelected(null); setNotice(message); }

  return <section className="assistant-notes-section" id="line-memories" aria-labelledby={`${id}-heading`}>
    <div className="section-heading memory-heading">
      <h2 id={`${id}-heading`}>ความจำจาก LINE</h2>
      <div className="search-bar memory-search">
        <label className="sr-only" htmlFor={`${id}-search`}>ค้นหาความจำจาก LINE</label>
        <input id={`${id}-search`} type="search" placeholder="ค้นหาชื่อหรือข้อมูลที่ให้เลขาจำ…" value={search} onChange={e => setSearch(e.target.value)}/>
      </div>
      <label className="sr-only" htmlFor={`${id}-source`}>แชตที่บันทึกความจำ</label>
      <select className="assistant-notes-source" id={`${id}-source`} value={activeSource} onChange={e => setSource(e.target.value)}>
        <option value="all">ทุกแชต</option>
        {Array.from(sources, ([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button type="button" className="secondary" disabled={refreshing} onClick={() => {
        setNotice(""); startRefresh(() => router.refresh());
      }}>{refreshing ? "กำลังอัปเดต…" : "อัปเดตจาก LINE"}</button>
    </div>
    <p className="muted">{shown.length} รายการ · หน้าละ 20 รายการ · คลิกก้อนเพื่อแก้ไข</p>
    {notice && <p role="status">{notice}</p>}
    <TilePages key={`${activeSource}:${term}`} items={shown} label="ความจำจาก LINE" renderItem={n =>
      <button type="button" key={n.id} className="memory-tile memory-card assistant-note-card" onClick={() => setSelected(n.id)} title={`${n.title} · ${n.sourceLabel}`}>
        <strong>{n.title}</strong><span className="memory-caption">{n.sourceLabel}</span>
      </button>
    }/>
    {!shown.length && <div className="empty"><h3>{notes.length ? "ไม่พบความจำที่ค้นหา" : "ยังไม่มีความจำจาก LINE"}</h3>
      <p>{notes.length ? "ลองเปลี่ยนคำค้นหรือเลือกทุกแชต" : "บอกเลขาใน LINE ว่า “จำว่า…” แล้วพิมพ์ยืนยัน จากนั้นกดอัปเดตจาก LINE"}</p></div>}
    {note && <Dialog wide title="แก้ไขความจำจาก LINE" onClose={() => setSelected(null)}>
      <AssistantNoteEditor key={note.id} note={note} onComplete={completed}/>
    </Dialog>}
  </section>;
}

function AssistantNoteEditor({ note, onComplete }: { note: ManagedAssistantNote; onComplete: (message: string) => void }) {
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
