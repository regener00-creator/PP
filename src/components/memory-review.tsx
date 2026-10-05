"use client";
import { useState, useTransition } from "react";
import { auditMemories, dismissMemoryIssue } from "@/app/admin/memory-assistant-actions";
import type { MemoryIssue, AssistedMemory } from "@/lib/memory-assistant-types";
import { Dialog } from "./workspace-ui";
import { MemoryForm } from "./memory-form";
import type { LibraryFile, LibraryFolder } from "./attachment-picker";

export function MemoryReview({ issues, files, folders }: { issues: MemoryIssue[]; files: LibraryFile[]; folders: LibraryFolder[] }) {
  const [pending, start] = useTransition(); const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<{ memory: AssistedMemory; merge?: AssistedMemory } | null>(null);
  return <section className="memory-review-panel" id="memory-review">
    <div className="row between"><h3>ความจำที่ต้องตรวจ {issues.length ? `(${issues.length})` : ""}</h3><button type="button" className="secondary" disabled={pending} onClick={() => start(async () => { try { const result = await auditMemories(); setMessage(result.message); } catch { setMessage("ตรวจไม่สำเร็จ ลองอีกครั้ง"); } })}>{pending ? "กำลังตรวจ…" : "ตรวจความจำทั้งหมด"}</button></div>
    <small>ตรวจเรื่องซ้ำและข้อมูลขัดกันด้วย AI ใช้โควตา 1 ครั้งต่อการตรวจ</small><p role="status">{message}</p>
    {!issues.length && <p className="muted">ไม่มีรายการที่ต้องตรวจ</p>}
    {issues.map(issue => <article className="memory-issue" key={issue.id}>
      <strong>{issue.kind === "conflict" ? "ข้อมูลขัดกัน" : "ความจำซ้ำ"}</strong><p>{issue.reason}</p>
      <div className="memory-issue-pair">{[issue.left, issue.right].map(memory => <div key={memory.id}><h4>{memory.title}</h4><p className="memory-review-content">{memory.content}</p>{memory.answer_variants?.map((text,index)=><p className="memory-review-content" key={index}>{text}</p>)}<button type="button" className="secondary" onClick={() => setSelected({ memory })}>แก้ไขก้อนนี้</button></div>)}</div>
      <div className="row"><button type="button" onClick={() => setSelected({ memory: issue.left, merge: issue.right })}>รวมเป็นก้อนเดียว</button><button type="button" className="secondary" disabled={pending} onClick={() => {
        if (confirm("ยืนยันว่าตรวจแล้วว่าเป็นคนละเรื่องและเก็บแยกได้? ถ้าข้อมูลยังขัดกัน บอทจะยังขอให้ตรวจเมื่อถูกถาม")) start(async () => { try { await dismissMemoryIssue(issue.id); } catch { setMessage("บันทึกไม่สำเร็จ ลองอีกครั้ง"); } });
      }}>ตรวจแล้ว เก็บแยก</button></div>
    </article>)}
    {selected && <Dialog title={selected.merge ? "รวมความจำ" : "แก้ไขความจำ"} wide onClose={() => setSelected(null)}><MemoryForm key={selected.memory.id + (selected.merge?.id || "")} memory={{ ...selected.memory, visibility: "shareable" }} mergeWith={selected.merge} files={files} folders={folders}/></Dialog>}
  </section>;
}
