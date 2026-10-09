"use client";
import { useLayoutEffect,useRef,useState,useActionState,useId,useTransition,useOptimistic,type ReactNode,type DragEvent } from "react";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MemoryForm,DeleteMemory,type Memory,type Permission } from "./admin-forms";
import { saveFolder,deleteFolder,saveFile,deleteFile,saveCalendarEvent,deleteCalendarEvent } from "@/app/admin/workspace-actions";
import { occursOn,type CalendarEvent,type CalendarEntry } from "@/lib/calendar";
import { AssistantEventEditor } from "./assistant-event-editor";
import { AttachmentPicker, type LibraryFile } from "./attachment-picker";
import { FriendMentionSelect } from "./friend-mention-select";
import type { MentionOwner } from "@/lib/friends";
import { TilePages } from "./tile-pages";
import { memoryColors,moveMemory,type MemoryColor } from "@/lib/memory-layout";
import { saveMemoryLayout } from "@/app/admin/memory-layout-actions";
import { AssistantNoteEditor } from "./assistant-note-editor";
import type { ManagedAssistantNote } from "@/lib/assistant-notes-types";
export type { LibraryFile } from "./attachment-picker";
export type Folder={id:string;name:string};
export type Friend={id:string;line_user_id:string;display_name:string;group_id:string;blocked:boolean};
const initial={ok:false,message:""};
export function Dialog({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);const titleId=useId();
  useLayoutEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close();},[]);
  return <dialog ref={ref} aria-labelledby={titleId} className={`pp-dialog${wide?" pp-dialog-wide":""}`} onCancel={onClose}><header className="row between"><h2 id={titleId}>{title}</h2><button type="button" className="secondary text-button" aria-label="ปิดหน้าต่าง" onClick={onClose}>ปิด</button></header>{children}</dialog>;
}
export function MemoryBoard({items,notes=[],files,folders,query}:{items:Memory[];notes?:ManagedAssistantNote[];files:LibraryFile[];folders:Folder[];query:string}){
  const [selected,setSelected]=useState<string|null>(null);
  const [draft,setDraft]=useState<Memory[]|null>(null);
  const [notice,setNotice]=useState("");
  const [busy,startSaving]=useTransition();
  const [refreshing,startRefresh]=useTransition();
  const router=useRouter();
  const [dragged,setDragged]=useState<string|null>(null);
  const [dropTarget,setDropTarget]=useState<string|null>(null);
  const suppressDragClick=useRef(false);
  const dragHelpId=useId();
  const [ordered,setOrdered]=useOptimistic(items,(_current,next:Memory[])=>next);
  const shown=draft??ordered;
  const editing=draft!==null;
  const memory=items.find(m=>m.id===selected);
  const note=notes.find(n=>`line:${n.id}`===selected);
  const searchTerm=query.trim().normalize("NFC").toLocaleLowerCase("th");
  const matchingNotes=notes.filter(n=>`${n.title}\n${n.content}\n${n.sourceLabel}`.normalize("NFC").toLocaleLowerCase("th").includes(searchTerm));
  const cards: ({kind:"manual";memory:Memory}|{kind:"line";note:ManagedAssistantNote})[]=[
    ...shown.map(memory=>({kind:"manual" as const,memory})),
    ...matchingNotes.map(note=>({kind:"line" as const,note})),
  ];
  function saveDirectMove(id:string,target:number){
    if(busy)return;
    const next=moveMemory(shown,id,target);
    if(next===shown)return;
    startSaving(async()=>{
      setOrdered(next);
      setNotice("กำลังบันทึกลำดับ…");
      try{
        const result=await saveMemoryLayout(next.map(item=>({id:item.id,card_color:item.card_color??null})));
        setNotice(result.ok?"บันทึกลำดับแล้ว":result.message);
      }catch{setNotice("บันทึกลำดับไม่ได้ ลองโหลดหน้าใหม่แล้วลากอีกครั้ง");}
    });
  }
  function startDrag(event:DragEvent<HTMLElement>,id:string){
    if(busy){event.preventDefault();return;}
    suppressDragClick.current=true;
    setDragged(id);
    event.dataTransfer.effectAllowed="move";
    event.dataTransfer.setData("text/plain",id);
  }
  function endDrag(){setDragged(null);setDropTarget(null);}
  function dropAt(event:DragEvent<HTMLElement>,index:number){
    event.preventDefault();
    if(dragged && !busy){if(editing)move(dragged,index);else saveDirectMove(dragged,index);}
    endDrag();
  }
  function move(id:string,target:number){
    if(busy)return;
    setDraft(current=>current?moveMemory(current,id,target):current);
    setNotice("ยังไม่ได้บันทึกการเปลี่ยนแปลง");
  }
  function color(id:string,value:MemoryColor){
    setDraft(current=>current?.map(item=>item.id===id?{...item,card_color:item.card_color===value?null:value}:item)??null);
    setNotice("ยังไม่ได้บันทึกการเปลี่ยนแปลง");
  }
  function save(){
    if(!draft)return;
    startSaving(async()=>{
      try{
        const result=await saveMemoryLayout(draft.map(item=>({id:item.id,card_color:item.card_color??null})));
        setNotice(result.message);
        if(result.ok)setDraft(null);
      }catch{setNotice("บันทึกไม่ได้ ลองอีกครั้ง");}
    });
  }
  return <section id="memories">
    <div className="section-heading memory-heading">
      <h2>รายการความจำ</h2>
      <Form className="search-bar memory-search" action="/admin" scroll={false}><label className="sr-only" htmlFor="memory-search">ค้นหาความจำ</label><input id="memory-search" key={query} name="q" type="search" disabled={editing||busy} defaultValue={query} placeholder="ค้นหาชื่อ คำถาม หรือคำตอบ…"/><button disabled={editing||busy} className="secondary">ค้นหา</button>{query && !editing && !busy && <Link href="/admin#memories">ล้าง</Link>}</Form>
      <div className="memory-heading-actions">
        {!editing && <button type="button" className="secondary" disabled={busy||refreshing} onClick={()=>{setNotice("");startRefresh(()=>router.refresh());}}>{refreshing?"กำลังอัปเดต…":"อัปเดตความจำ"}</button>}
        {editing?<><button type="button" className="secondary" disabled={busy} onClick={()=>{setDraft(null);setNotice("");}}>ยกเลิก</button><button type="button" disabled={busy} onClick={save}>{busy?"กำลังบันทึก…":"บันทึกสีและลำดับ"}</button></>:<><button type="button" className="secondary" disabled={busy||!items.length} onClick={()=>{setDraft([...items]);setNotice("");}}>จัดเรียง/สี</button><button type="button" disabled={busy} onClick={()=>setSelected("new")}>เพิ่มความจำ</button></>}
      </div>
    </div>
    {editing && <p className="memory-arrange-hint">ลากก้อนหรือกดปุ่มเลื่อนเพื่อจัดเรียง · เลือกสีด้านล่าง กดสีเดิมอีกครั้งเพื่อล้างสี</p>}
    {notice && <p role="status" className="memory-layout-status">{notice}</p>}
    <span className="sr-only" id={dragHelpId}>คลิกเพื่อแก้ไข หรือกดค้างแล้วลากเพื่อจัดเรียงและบันทึกอัตโนมัติ ใช้แป้น Alt พร้อมลูกศรซ้ายหรือขวาเพื่อเลื่อนตำแหน่งได้เช่นกัน</span>
    <TilePages key={query} items={cards} pageSize={30} label="รายการความจำ" renderItem={card=>{
      if(card.kind==="line"){
        const n=card.note;
        return <button type="button" key={`line:${n.id}`} className="memory-tile memory-card assistant-note-card" disabled={editing||busy}
          onClick={()=>setSelected(`line:${n.id}`)} title={`${n.title} · LINE · ${n.sourceLabel}`}>
          <strong>{n.title}</strong><span className="memory-caption">LINE · {n.sourceLabel}</span>
        </button>;
      }
      const m=card.memory;
      const index=shown.findIndex(item=>item.id===m.id);
      const tileClass=`memory-tile memory-card${editing?" arranging":""}`;
      const caption=<span className="memory-caption">{[m.answer_variants?.length ? `${m.answer_variants.length + 1} คำตอบ` : "", m.attachment_ids?.length ? "มีไฟล์แนบ" : ""].filter(Boolean).join(" · ")}</span>;
      if(!editing)return <button type="button" className={tileClass} data-color={m.card_color??undefined} key={m.id}
        disabled={busy} draggable={!busy} aria-describedby={dragHelpId}
        data-dragging={dragged===m.id||undefined} data-drop-target={dropTarget===m.id||undefined}
        onPointerDown={()=>{suppressDragClick.current=false;}}
        onClick={event=>{if(event.detail===0||!suppressDragClick.current)setSelected(m.id);}}
        onKeyDown={event=>{if(event.altKey&&(event.key==="ArrowLeft"||event.key==="ArrowRight")){event.preventDefault();saveDirectMove(m.id,index+(event.key==="ArrowLeft"?-1:1));}}}
        onDragStart={event=>startDrag(event,m.id)} onDragEnd={endDrag}
        onDragOver={event=>{if(dragged&&!busy){event.preventDefault();event.dataTransfer.dropEffect="move";setDropTarget(m.id);}}}
        onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDropTarget(null);}}
        onDrop={event=>dropAt(event,index)} title={`${m.title} · คลิกเพื่อแก้ไข หรือกดค้างแล้วลาก`}><strong>{m.title}</strong>{caption}</button>;
      return <article className={tileClass} data-color={m.card_color??undefined} data-dragging={dragged===m.id||undefined} data-drop-target={dropTarget===m.id||undefined} key={m.id} aria-label={`จัดความจำ ${m.title}`}
        onDragOver={event=>{if(dragged && !busy){event.preventDefault();event.dataTransfer.dropEffect="move";setDropTarget(m.id);}}}
        onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDropTarget(null);}}
        onDrop={event=>dropAt(event,index)}>
        <div className="memory-move-controls">
          <button type="button" className="memory-drag-handle" disabled={busy} draggable={!busy} aria-label={`ลากจัดเรียง ${m.title}`} title="ลากเพื่อจัดเรียง"
            onDragStart={event=>startDrag(event,m.id)}
            onDragEnd={endDrag}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4h8M4 8h8M4 12h8" stroke="currentColor" strokeWidth="1.5"/></svg></button>
          <button type="button" disabled={busy||index===0} aria-label={`เลื่อน ${m.title} ก่อนหน้า`} onClick={()=>move(m.id,index-1)}>‹</button>
          <button type="button" disabled={busy||index===shown.length-1} aria-label={`เลื่อน ${m.title} ถัดไป`} onClick={()=>move(m.id,index+1)}>›</button>
        </div>
        <strong title={m.title}>{m.title}</strong>{caption}
        <div className="memory-colors" role="group" aria-label={`สีก้อน ${m.title}`}>{memoryColors.map(c=><button type="button" key={c.value} data-color={c.value} title={c.label} aria-label={c.label} aria-pressed={m.card_color===c.value} disabled={busy} onClick={()=>color(m.id,c.value)}/>)}</div>
      </article>;
    }}/>
    {!cards.length && <div className="empty"><h3>{query?"ไม่พบความจำที่ค้นหา":"เริ่มเก็บเรื่องที่อยากให้ PP จำ"}</h3><p>{query?"ลองใช้คำสั้นลง หรือค้นด้วยคำถามที่บันทึกไว้":"เพิ่มความจำจากปุ่มด้านบน หรือสั่งจำใน LINE แล้วยืนยัน จากนั้นกดอัปเดตความจำ"}</p></div>}
    {selected && (selected==="new" || memory) && <Dialog wide title={memory?"แก้ไขความจำ":"เพิ่มความจำ"} onClose={()=>setSelected(null)}><MemoryForm key={memory?.id||"new"} memory={memory} files={files} folders={folders}/>{memory && <DeleteMemory id={memory.id}/>}</Dialog>}
    {note && <Dialog wide title="แก้ไขความจำ" onClose={()=>setSelected(null)}><AssistantNoteEditor key={note.id} note={note} onComplete={message=>{setSelected(null);setNotice(message);}}/></Dialog>}
  </section>;
}
function FolderEditor({folder}:{folder?:Folder}){
  const [state,action,pending]=useActionState(saveFolder,initial);
  const [deleted,remove,deleting]=useActionState(deleteFolder,initial);
  return <div className="stack"><form action={action} className="stack"><input name="id" type="hidden" value={folder?.id||""}/><label>ชื่อโฟลเดอร์<input name="name" required maxLength={80} defaultValue={folder?.name}/></label><button disabled={pending}>บันทึกโฟลเดอร์</button><p role="status">{state.message}</p></form>{folder && <form action={remove} onSubmit={e=>{if(!confirm("ลบโฟลเดอร์ว่างนี้?"))e.preventDefault();}}><input name="id" type="hidden" value={folder.id}/><button className="secondary danger" disabled={deleting}>ลบโฟลเดอร์ว่าง</button><p role="status">{deleted.message}</p></form>}</div>;
}
function FileEditor({file,folders}:{file:LibraryFile;folders:Folder[]}){
  const [state,action,pending]=useActionState(saveFile,initial);const [deleted,remove,deleting]=useActionState(deleteFile,initial);
  return <div className="stack"><a className="button secondary" href={`/api/files/${file.id}`} target="_blank" rel="noreferrer">เปิดไฟล์</a><form action={action} className="stack"><input name="id" type="hidden" value={file.id}/><label>ชื่อไฟล์<input name="name" defaultValue={file.name} maxLength={180} required/></label><label>โฟลเดอร์<select name="folder_id" defaultValue={file.folder_id||""}><option value="">ไม่จัดโฟลเดอร์</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><button disabled={pending}>บันทึกการแก้ไข</button><p role="status">{state.message}</p></form><form action={remove} onSubmit={e=>{if(!confirm("ลบไฟล์นี้? ความจำและปฏิทินที่แนบไฟล์นี้จะไม่ส่งไฟล์อีก"))e.preventDefault();}}><input name="id" type="hidden" value={file.id}/><button className="danger secondary" disabled={deleting}>ลบไฟล์</button><p role="status">{deleted.message}</p></form></div>;
}
export function FileLibrary({files,folders}:{files:LibraryFile[];folders:Folder[]}){
  const router=useRouter();const [folder,setFolder]=useState("all");const [q,setQ]=useState("");const [edit,setEdit]=useState<{kind:"folder"|"file";id:string}|null>(null);const [status,setStatus]=useState("");const [busy,setBusy]=useState(false);
  const shown=files.filter(f=>(folder==="all" || (f.folder_id||"")===folder)&&f.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()));
  async function upload(form:FormData){setBusy(true);setStatus("กำลังอัปโหลด…");try{const r=await fetch("/api/files",{method:"POST",body:form});const data=await r.json();setStatus(r.ok?"อัปโหลดแล้ว":data.error||"อัปโหลดไม่ได้");if(r.ok)router.refresh();}catch{setStatus("อัปโหลดไม่ได้ ลองอีกครั้ง");}finally{setBusy(false);}}
  const editedFile=files.find(f=>f.id===edit?.id);const editedFolder=folders.find(f=>f.id===edit?.id);
  return <div className="stack"><div className="section-heading"><div><div className="eyebrow">A PLACE FOR EVERYTHING</div><h1>รูปและไฟล์</h1></div><button onClick={()=>setEdit({kind:"folder",id:"new"})}>สร้างโฟลเดอร์</button></div><div className="library-layout"><aside className="folder-list"><button className={folder==="all"?"selected":"secondary"} onClick={()=>setFolder("all")}>ไฟล์ทั้งหมด</button><button className={folder===""?"selected":"secondary"} onClick={()=>setFolder("")}>ไม่จัดโฟลเดอร์</button>{folders.map(f=><div className="folder-row" key={f.id}><button className={folder===f.id?"selected":"secondary"} onClick={()=>setFolder(f.id)}>{f.name}</button><button className="secondary text-button" aria-label={`แก้ไขโฟลเดอร์ ${f.name}`} onClick={()=>setEdit({kind:"folder",id:f.id})}>แก้ไข</button></div>)}</aside><div className="stack"><form action={upload} className="panel upload-form"><h3>เพิ่มไฟล์เข้า PP</h3><div className="form-columns"><label>ไฟล์<input name="file" type="file" required accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.pptx,.zip,.txt,.csv"/></label><label>เก็บใน<select name="folder_id" key={folder} defaultValue={folder==="all"?"":folder}><option value="">ไม่จัดโฟลเดอร์</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label></div><small>สูงสุด 3 MB ต่อไฟล์ · รูปจะย่อและแปลงเป็น JPG สำหรับ LINE · PDF, DOCX, XLSX, PPTX, ZIP, TXT, CSV เก็บไฟล์เดิม</small><button disabled={busy}>{busy?"กำลังอัปโหลด…":"อัปโหลดไฟล์"}</button><p role="status">{status}</p></form><label>ค้นหาไฟล์<input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหาด้วยชื่อไฟล์…"/></label><p className="muted">{shown.length} ไฟล์ · แสดงล่าสุดสูงสุด 500 ไฟล์</p><div className="file-grid">{shown.map(f=><button key={f.id} className="file-tile" onClick={()=>setEdit({kind:"file",id:f.id})}>{f.mime==="image/jpeg"?<img loading="lazy" src={`/api/files/${f.id}`} alt=""/>:<span className="file-type">ไฟล์</span>}<strong>{f.name}</strong><small>{Math.ceil(f.bytes/1024)} KB</small></button>)}</div>{!shown.length && <div className="empty">ยังไม่มีไฟล์ในรายการนี้</div>}</div></div>{edit && ((edit.kind==="folder" && (edit.id==="new" || editedFolder)) || editedFile) && <Dialog title={edit.kind==="folder"?"จัดการโฟลเดอร์":"จัดการไฟล์"} onClose={()=>setEdit(null)}>{edit.kind==="folder"?<FolderEditor key={edit.id} folder={editedFolder}/>:<FileEditor key={edit.id} file={editedFile!} folders={folders}/>}</Dialog>}</div>;
}
function EventEditor({event,date,groups,friends,files,folders,owner}:{event?:CalendarEvent;date:string;groups:Permission[];friends:Friend[];files:LibraryFile[];folders:Folder[];owner:MentionOwner}){
  const [state,action,pending]=useActionState(saveCalendarEvent,initial);const [deleted,remove,deleting]=useActionState(deleteCalendarEvent,initial);const [group,setGroup]=useState(event?.group_id||"");
  return <div className="stack">
    <form action={action} className="stack calendar-editor">
      <input name="id" type="hidden" value={event?.id||""}/>
      <div className="calendar-editor-heading">
        <label className="calendar-title-field">เรื่อง<input name="title" required maxLength={120} defaultValue={event?.title} placeholder="เช่น วันเกิดพี่ฟิ้ง"/></label>
        <label>วันที่<input name="event_date" type="date" required defaultValue={event?.event_date||date}/></label>
        <label className="calendar-toggle"><input name="annual" type="checkbox" defaultChecked={event?.annual}/>ทำซ้ำทุกปี</label>
      </div>
      <label>ข้อความที่จะส่ง<textarea name="message" required maxLength={1500} rows={3} defaultValue={event?.message} placeholder="เช่น HBD พี่ฟิ้ง"/></label>
      <div className="calendar-reminder-options">
        <label className="calendar-toggle"><input type="checkbox" name="remind_day" defaultChecked={event?.remind_day??true}/>เตือนในวันนั้น</label>
        <label className="calendar-toggle"><input type="checkbox" name="remind_before" defaultChecked={event?.remind_before??false}/>เตือนล่วงหน้า 1 วัน</label>
        <span className="calendar-options-divider" aria-hidden="true"/>
        <label className="calendar-toggle"><input type="checkbox" name="send_owner" defaultChecked={event?.send_owner??true}/>ส่งในแชตส่วนตัวของฉัน</label>
      </div>
      <div className="calendar-recipient-fields">
        <label>ส่งเข้ากลุ่มด้วย<select name="group_id" value={group} onChange={e=>setGroup(e.target.value)}><option value="">ไม่ส่งเข้ากลุ่ม</option>{groups.filter(g=>g.enabled).map(g=><option key={g.group_id} value={g.group_id}>{g.label||g.group_id}</option>)}</select></label>
        <FriendMentionSelect key={group} group={group} friends={friends} owner={owner} selected={event?.group_id===group?event.mention_user_id||"":""}/>
      </div>
      <AttachmentPicker files={files.filter(f=>!group||f.visibility==="shareable")} folders={folders} selected={event?.attachment_ids}/>
      <button disabled={pending}>บันทึกรายการ</button><p role="status">{state.message}</p>
    </form>
    {event && <form action={remove} onSubmit={e=>{if(!confirm("ลบรายการนี้และหยุดแจ้งเตือนครั้งถัดไป?"))e.preventDefault();}}><input name="id" type="hidden" value={event.id}/><button className="danger secondary" disabled={deleting}>ลบรายการ</button><p role="status">{deleted.message}</p></form>}
  </div>;
}
export function CalendarBoard({events,today,groups,friends,files,folders,owner,children}:{events:CalendarEntry[];today:string;groups:Permission[];friends:Friend[];files:LibraryFile[];folders:Folder[];owner:MentionOwner;children?:ReactNode}) {
  const router=useRouter();
  const [refreshing,refresh]=useTransition();
  const [month,setMonth]=useState(today.slice(0,7));
  const [selected,setSelected]=useState<{id:string;date:string}|null>(null);
  const [q,setQ]=useState("");
  const start=new Date(`${month}-01T12:00:00Z`);
  const leading=(start.getUTCDay()+6)%7;
  const days=new Date(start.getUTCFullYear(),start.getUTCMonth()+1,0).getDate();
  const trailing=(7-(leading+days)%7)%7;
  const matching=events.filter(e=>`${e.title} ${e.message}`.toLocaleLowerCase().includes(q.toLocaleLowerCase()));
  function move(amount:number) {
    const date=new Date(start);
    date.setUTCMonth(date.getUTCMonth()+amount);
    setMonth(date.toISOString().slice(0,7));
  }
  const event=events.find(e=>e.id===selected?.id);
  return <div className="stack calendar-workspace">
    <div className="calendar-toolbar">
      <div className="calendar-month-nav">
        <button className="secondary" aria-label="เดือนก่อนหน้า" onClick={()=>move(-1)}>ก่อนหน้า</button>
        <h2>{new Intl.DateTimeFormat("th-TH",{month:"long",year:"numeric",timeZone:"UTC"}).format(start)}</h2>
        <button className="secondary" aria-label="เดือนถัดไป" onClick={()=>move(1)}>ถัดไป</button>
      </div>
      <button className="secondary" onClick={()=>setMonth(today.slice(0,7))}>เดือนนี้</button>
      <button className="secondary" disabled={refreshing} onClick={()=>refresh(()=>router.refresh())}>{refreshing?"กำลังอัปเดต…":"อัปเดตปฏิทิน"}</button>
      <input className="calendar-search" type="search" aria-label="ค้นหารายการ" value={q} onChange={e=>setQ(e.target.value)} placeholder="ชื่อหรือข้อความ…"/>
    </div>
    <div className="calendar-grid" id="calendar" aria-label="ปฏิทิน">
      {["จ.","อ.","พ.","พฤ.","ศ.","ส.","อา."].map(day=><div className="day-heading" key={day}>{day}</div>)}
      {Array.from({length:leading},(_,i)=><div className="calendar-blank" key={`before${i}`}/>)}
      {Array.from({length:days},(_,i)=>{
        const date=`${month}-${String(i+1).padStart(2,"0")}`;
        return <div key={date} className={`calendar-day ${date===today?"today":""}`}>
          <button className="calendar-date" aria-label={`เพิ่มรายการวันที่ ${date}`} onClick={()=>setSelected({id:"new",date})}>{i+1}</button>
          <div className="calendar-day-events">
            {matching.filter(e=>occursOn(e,date)).map(e=><button className={`calendar-event ${e.enabled?"active":""}`} key={e.id} onClick={()=>setSelected({id:e.id,date})}>{e.title}</button>)}
          </div>
        </div>;
      })}
      {Array.from({length:trailing},(_,i)=><div className="calendar-blank" key={`after${i}`}/>)}
    </div>
    {children && <hr className="calendar-divider"/>}
    {children}
    <hr className="calendar-divider"/>
    <section id="calendar-events">
      <div className="section-heading"><h2>รายการทั้งหมด</h2></div>
      <TilePages key={q} items={matching} label="รายการทั้งหมด" renderItem={e=>
        <button type="button" key={e.id} className={`memory-tile calendar-item-tile ${e.enabled?"enabled":""}`} title={e.title} onClick={()=>setSelected({id:e.id,date:e.event_date})}>
          <strong>{e.title}</strong><span className="calendar-item-details"><time dateTime={e.event_date}>{e.event_date}</time>{e.assistant && <span>นัดหมายจากเลขา</span>}{e.annual && <span>ทำซ้ำทุกปี</span>}<span>{e.enabled?"เปิดแจ้งเตือน":"ยังไม่แจ้งเตือน"}</span></span>
        </button>
      }/>
      {!matching.length && <p>ยังไม่มีรายการ</p>}
    </section>
    {selected && (selected.id==="new" || event) && <Dialog wide title={event?"แก้ไขรายการ":"เพิ่มรายการในปฏิทิน"} onClose={()=>setSelected(null)}>{event?.assistant ? <AssistantEventEditor key={selected.id} event={event} recipient={event.group_id ? groups.find(g=>g.group_id===event.group_id)?.label || "กลุ่ม LINE" : "แชตส่วนตัวของฉัน"}/> : <EventEditor key={selected.id} event={event} date={selected.date} groups={groups} friends={friends} files={files} folders={folders} owner={owner}/>}</Dialog>}
  </div>;
}
