"use client";
import { useActionState, useRef, useState } from "react";
import { saveAssistedMemory } from "@/app/admin/memory-assistant-actions";
import type { AssistedMemory, MemoryReviewState } from "@/lib/memory-assistant-types";
import { AttachmentPicker, type LibraryFile, type LibraryFolder } from "./attachment-picker";
import type { Memory } from "./admin-forms";

export function MemoryForm({ memory, mergeWith, files = [], folders = [] }: { memory?: Memory; mergeWith?: AssistedMemory; files?: LibraryFile[]; folders?: LibraryFolder[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [target, setTarget] = useState(memory?.id || "");
  const [remove, setRemove] = useState(mergeWith?.id || "");
  const [title, setTitle] = useState(memory?.title || "");
  const [content, setContent] = useState([memory?.content, mergeWith?.content].filter(Boolean).join("\n\n"));
  const [aliases, setAliases] = useState([...new Set([...(memory?.question_examples || []), ...(mergeWith?.question_examples || [])])].join("\n"));
  const [attachments, setAttachments] = useState([...new Set([...(memory?.attachment_ids || []), ...(mergeWith?.attachment_ids || [])])]);
  const [fileVersion, setFileVersion] = useState(0);
  const [mention, setMention] = useState(memory?.mention_owner || mergeWith?.mention_owner || false);
  const [expires, setExpires] = useState(memory?.expires_at ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(memory.expires_at)) : "");
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState(mergeWith ? "ตรวจข้อความที่รวมแล้วก่อนบันทึก เมื่อบันทึกจะเหลือก้อนเดียว" : "");
  const [state, action, pending] = useActionState(async (previous: MemoryReviewState, form: FormData) => {
    const result = await saveAssistedMemory(previous, form); setDirty(false);
    if (result.ok && result.savedId) { setTarget(result.savedId); setRemove(""); setNotice(""); }
    return result;
  }, { ok: false, message: "" } as MemoryReviewState);
  const choose = (other: AssistedMemory, merge: boolean) => {
    setRemove(merge && target && target !== other.id ? target : "");
    setTarget(other.id);
    if (merge) {
      setContent(current => [other.content, current].filter((v, i, all) => v && all.indexOf(v) === i).join("\n\n"));
      setAliases(current => [...new Set([...other.question_examples, ...current.split(/\r?\n/).filter(Boolean)])].join("\n"));
      const currentFiles = formRef.current ? new FormData(formRef.current).getAll("attachment_ids").map(String) : attachments;
      setAttachments([...new Set([...other.attachment_ids, ...currentFiles])]); setFileVersion(v => v + 1);
      setMention(current => current || other.mention_owner);
    }
    setTitle(other.title); setDirty(true);
    setNotice(merge ? "รวมข้อความไว้ในช่องข้อมูลแล้ว แก้ให้ถูกต้องแล้วกดบันทึก จะเหลือก้อนเดียว" : "กำลังใช้ข้อมูลที่กรอกแก้ก้อนเดิม ตรวจข้อความก่อนบันทึก");
  };
  return <form ref={formRef} action={action} className="stack memory-assistant-form" onChange={() => setDirty(true)}>
    <input type="hidden" name="id" value={target}/><input type="hidden" name="remove_id" value={remove}/><input type="hidden" name="receipt" value={state.receipt || ""}/>
    {notice && <p className="notice" role="status">{notice}</p>}
    <label>ชื่อความจำ<input name="title" value={title} onChange={e => setTitle(e.target.value)} required maxLength={120} placeholder="เช่น น้ำท่วม" disabled={pending}/></label>
    <label>ข้อมูลที่อยากให้จำ<textarea name="content" value={content} onChange={e => setContent(e.target.value)} required rows={5} maxLength={2000} placeholder="เช่น น้ำลดแล้ว รถเข้าได้ตามปกติ" disabled={pending}/></label>
    <details open={aliases ? true : undefined}><summary>คำถามตัวอย่าง (ไม่จำเป็นต้องกรอก)</summary><label className="sr-only" htmlFor={`aliases-${target || "new"}`}>คำถามตัวอย่าง</label><textarea id={`aliases-${target || "new"}`} name="aliases" rows={3} value={aliases} onChange={e => setAliases(e.target.value)} placeholder="กรอกเพิ่มได้ ถ้ามีคำถามที่อยากให้ตอบตรงเป็นพิเศษ" disabled={pending}/></details>
    <label className="check"><input type="checkbox" name="mention_owner" checked={mention} onChange={e => setMention(e.target.checked)} disabled={pending}/>แท็กเจ้าของพร้อมคำตอบ</label>
    <label>ใช้ได้ถึงวันที่<input name="expires_at" type="date" value={expires} onChange={e => setExpires(e.target.value)} disabled={pending}/></label>
    <AttachmentPicker key={fileVersion} files={files.filter(file => file.visibility === "shareable")} folders={folders} selected={attachments} resetOnSubmit={false} disabled={pending}/>
    <button disabled={pending} name="decision" value="review">{pending ? "กำลังตรวจและบันทึก…" : target ? "ตรวจและบันทึกการแก้ไข" : "ตรวจและเพิ่มความจำ"}</button>
    <p role="status" className={state.ok ? "form-status success" : "form-status"}>{dirty && state.receipt ? "ข้อมูลเปลี่ยนแล้ว กดบันทึกเพื่อตรวจใหม่" : state.message}</p>
    {!dirty && state.receipt && <section className="memory-review" aria-label="ผลตรวจความจำก่อนบันทึก">
      {state.concerns?.map((concern, index) => <article key={`${concern.memory.id}-${index}`}>
        <div className="row between"><strong>{concern.memory.title}</strong><span className={`review-kind ${concern.kind}`}>{concern.kind === "conflict" ? "ข้อมูลขัดกัน" : concern.kind === "duplicate" ? "ความจำซ้ำ" : "เรื่องที่เกี่ยวข้อง"}</span></div>
        <p>{concern.reason}</p><p className="memory-review-content">{concern.memory.content}</p>
        <div className="row"><button type="button" className="secondary" disabled={pending} onClick={() => choose(concern.memory, false)}>แก้ก้อนเดิม</button><button type="button" className="secondary" disabled={pending} onClick={() => choose(concern.memory, true)}>รวมข้อมูล</button></div>
      </article>)}
      <button className="secondary" name="decision" value="confirm" disabled={pending}>{state.unchecked ? "บันทึกโดยยังไม่ได้ตรวจด้วย AI" : target ? "ยืนยันบันทึกและเก็บก้อนอื่นแยกไว้" : "เก็บแยกเป็นก้อนใหม่"}</button>
      {state.concerns?.some(c => c.kind === "conflict") && <small>คู่ที่ขัดกันจะอยู่ในความจำที่ต้องตรวจ และยังไม่ใช้ตอบจนกว่าจะจัดการ</small>}
    </section>}
  </form>;
}
