"use client";
import { useEffect, useId, useRef, useState } from "react";
import { MAX_ATTACHMENTS } from "@/lib/attachment-limits";

export type LibraryFile={id:string;name:string;folder_id:string|null;mime:string;bytes:number;visibility:string};
export type LibraryFolder = { id: string; name: string };
const emptySelection: string[] = [];

function FilePreview({ file }: { file: LibraryFile }) {
  const [failed, setFailed] = useState(false);
  if (file.mime.startsWith("image/") && !failed) {
    return <img src={`/api/files/${file.id}`} alt="" loading="lazy" decoding="async"
      onError={() => setFailed(true)}/>;
  }
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toUpperCase().slice(0,8) : "ไฟล์";
  return <span className="attachment-file-type">{failed ? "โหลดรูปไม่ได้" : extension || "ไฟล์"}</span>;
}

export function AttachmentPicker({ files, folders, selected = emptySelection, resetOnSubmit = true, disabled = false }: { files: LibraryFile[]; folders: LibraryFolder[]; selected?: string[]; resetOnSubmit?: boolean; disabled?: boolean }) {
  const [picked, setPicked] = useState(() => [...selected]);
  const [folder, setFolder] = useState("");
  const fieldset = useRef<HTMLFieldSetElement>(null);
  const hintId = useId();
  const available = new Set(files.map(file => file.id));
  const checkedIds = new Set(picked.filter(id => available.has(id)));
  const shown = files.filter(file => folder === "unfiled" ? !file.folder_id : folder && file.folder_id === folder);
  const pickedFiles = [...checkedIds].map(id => files.find(file => file.id === id)!);

  useEffect(() => {
    if (!resetOnSubmit) return;
    const form = fieldset.current?.form;
    // React resets the form after a successful action; reset selection with it.
    const reset = () => { setPicked([...selected]); setFolder(""); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [selected, resetOnSubmit]);

  function toggle(id: string) {
    setPicked(current => {
      const visible = current.filter(value => available.has(value));
      if (visible.includes(id)) return visible.filter(value => value !== id);
      return visible.length < MAX_ATTACHMENTS ? [...visible, id] : visible;
    });
  }

  return <fieldset ref={fieldset} className="attachment-picker" aria-describedby={hintId} disabled={disabled}>
    <legend>รูปหรือไฟล์แนบ</legend>
    <label>โฟลเดอร์งาน<select value={folder} onChange={e => setFolder(e.target.value)}>
      <option value="">เลือกโฟลเดอร์</option>
      {folders.map(item => <option key={item.id} value={item.id}>{item.name} ({files.filter(file => file.folder_id === item.id).length})</option>)}
      <option value="unfiled">ไม่จัดโฟลเดอร์ ({files.filter(file => !file.folder_id).length})</option>
    </select></label>
    {/* Submit all selections, including files in folders that are not currently open. */}
    {pickedFiles.map(file => <input key={file.id} type="hidden" name="attachment_ids" value={file.id}/>)}
    {pickedFiles.length > 0 && <div className="attachment-picked" aria-label="ไฟล์ที่เลือกแล้ว">{pickedFiles.map(file =>
      <button type="button" className="secondary" key={file.id} onClick={() => toggle(file.id)} aria-label={`นำไฟล์ ${file.name} ออก`}>{file.name}<span>นำออก</span></button>
    )}</div>}
    <div className="attachment-heading">
      <small id={hintId}>คลิกการ์ดเพื่อเลือกหรือยกเลิก · สูงสุด {MAX_ATTACHMENTS} ไฟล์</small>
      <span className="attachment-count" role="status">เลือกแล้ว {checkedIds.size} / {MAX_ATTACHMENTS}</span>
    </div>
    {!folder ? <p className="attachment-empty">เลือกโฟลเดอร์เพื่อดูรูปและไฟล์ข้างใน</p> : shown.length ? <div className="attachment-grid">{shown.map(file => {
      const checked = checkedIds.has(file.id);
      const disabled = !checked && checkedIds.size >= MAX_ATTACHMENTS;
      return <label key={file.id} className="attachment-card" data-selected={checked || undefined}
        data-disabled={disabled || undefined}>
        <input type="checkbox" value={file.id}
          aria-label={`แนบไฟล์ ${file.name}`} checked={checked} disabled={disabled}
          onChange={() => toggle(file.id)}/>
        <span className="attachment-preview"><FilePreview file={file}/></span>
        <strong>{file.name}</strong>
        <small>{Math.ceil(file.bytes / 1024)} KB</small>
        <span className="attachment-selection">{checked ? "เลือกแล้ว" : disabled ? `เลือกครบ ${MAX_ATTACHMENTS} ไฟล์แล้ว` : "เลือกไฟล์"}</span>
      </label>;
    })}</div> : <p className="attachment-empty">ไม่มีไฟล์ที่เลือกได้ในโฟลเดอร์นี้</p>}
  </fieldset>;
}
