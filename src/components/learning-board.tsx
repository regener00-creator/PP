"use client";
import { useActionState, useState } from "react";
import { setLearningGroup,setLearningFriend,approveLearning,removeLearning,summarizeLearning } from "@/app/admin/learning/actions";
import type { LearningSuggestion } from "@/lib/learning-policy";
const initial={ok:false,message:""};
const date=(value:string)=>new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"short",timeStyle:"short"}).format(new Date(value));
export function LearningGroupControl({group,enabled,available}:{group:string;enabled:boolean;available:boolean}){
  const [state,action,pending]=useActionState(setLearningGroup,initial);
  return <form action={action} className="learning-controls"><input type="hidden" name="group_id" value={group}/>
    <label className="check"><input name="enabled" type="checkbox" defaultChecked={enabled} disabled={!available||pending}/>เรียนรู้ข้อความใหม่ในกลุ่มนี้</label>
    <button disabled={pending}>{pending?"กำลังบันทึก…":"บันทึก"}</button><p role="status">{state.message}</p>
  </form>;
}
export function LearningRunControl(){
  const [state,action,pending]=useActionState(summarizeLearning,initial);
  return <form action={action} className="learning-controls"><button className="secondary" disabled={pending}>{pending?"กำลังสรุป…":"สรุปข้อความที่รออยู่"}</button><p role="status">{state.message}</p></form>;
}
export function LearningFriendControl({group,sender,name,excluded}:{group:string;sender:string;name:string;excluded:boolean}){
  const [state,action,pending]=useActionState(setLearningFriend,initial);
  return <form action={action} className="learning-friend"><input type="hidden" name="group_id" value={group}/><input type="hidden" name="sender_id" value={sender}/><strong>{name}</strong>
    <label className="check"><input name="excluded" type="checkbox" defaultChecked={excluded} disabled={pending}/>หยุดจำและลบข้อมูลที่เรียนรู้ของคนนี้</label><button className="secondary" disabled={pending}>บันทึก</button><p role="status">{state.message}</p></form>;
}
function SuggestionCard({item,name}:{item:LearningSuggestion;name:string}){
  const [state,approve,pending]=useActionState(approveLearning,initial);
  const [removed,remove,removing]=useActionState(removeLearning,initial);
  return <article className="panel learning-card"><div className="learning-card-heading"><div><small>{name}</small><h3>{item.title}</h3></div><span className="badge">{item.status==="approved"?"อนุมัติแล้ว":"รอตรวจ"}</span></div>
    <p className="learning-answer">{item.content}</p>
    <details><summary>ข้อความต้นทาง {item.evidence.length} ข้อความ</summary>{item.evidence.map(e=><blockquote key={e.message_id}><p>{e.text}</p><small>{date(e.sent_at)}</small></blockquote>)}</details>
    <details open={item.status==="pending"}><summary>{item.status==="pending"?"ตรวจและอนุมัติ":"แก้ไขความจำ"}</summary>
      <form action={approve} className="stack"><input name="id" type="hidden" value={item.id}/>
        <label>ชื่อความจำ<input name="title" required maxLength={120} defaultValue={item.title}/></label>
        <label>คำถามที่ให้บอทตอบ (ใส่ชื่อเพื่อนด้วย)<textarea name="questions" required rows={3} defaultValue={item.question_examples.join("\n")}/></label>
        <label>คำตอบ<textarea name="content" required maxLength={1000} rows={3} defaultValue={item.content}/></label>
        <button disabled={pending||removing}>{pending?"กำลังบันทึก…":item.status==="approved"?"บันทึกการแก้ไข":"อนุมัติให้ตอบในกลุ่มนี้"}</button><p role="status">{state.message}</p>
      </form>
    </details>
    <div className="learning-card-footer"><small>ใช้ได้ถึง {date(item.expires_at)}</small><form action={remove}><input type="hidden" name="id" value={item.id}/><button className="danger secondary" disabled={pending||removing}>{item.status==="pending"?"ไม่จำรายการนี้":"ลบความจำ"}</button><p role="status">{removed.message}</p></form></div>
  </article>;
}
export function LearningBoard({items,names}:{items:LearningSuggestion[];names:Record<string,string>}){
  const [status,setStatus]=useState("pending"),[query,setQuery]=useState("");
  const filtered=items.filter(item=>item.status===status && `${item.title} ${item.content} ${names[item.sender_id]||""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section><div className="learning-toolbar"><div className="learning-tabs" role="group" aria-label="สถานะความจำ">{(["pending","approved"] as const).map(s=><button key={s} className={status===s?"":"secondary"} aria-pressed={status===s} onClick={()=>setStatus(s)}>{s==="pending"?"รอตรวจ":"อนุมัติแล้ว"} ({items.filter(i=>i.status===s).length})</button>)}</div><input aria-label="ค้นหาความจำที่เรียนรู้" placeholder="ค้นหาชื่อเพื่อนหรือความจำ" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    {filtered.length?<div className="learning-grid">{filtered.map(item=><SuggestionCard key={`${item.id}:${item.status}:${item.content}`} item={item} name={names[item.sender_id]||"สมาชิกในกลุ่ม"}/>)}</div>:<div className="panel learning-empty"><h2>{query?"ไม่พบรายการที่ค้นหา":status==="pending"?"ยังไม่มีความจำรอตรวจ":"ยังไม่มีความจำที่อนุมัติ"}</h2><p>{status==="pending"?"เมื่อมีข้อความใหม่ที่เหมาะจะจำ น้องโจอาจะสรุปมาให้ตรวจที่นี่":"ความจำที่คุณอนุมัติจะใช้ตอบเฉพาะในกลุ่มต้นทาง"}</p></div>}
  </section>;
}
