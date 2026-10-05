import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { database,dbError } from "@/lib/db";
import { LearningBoard,LearningGroupControl,LearningFriendControl,LearningRunControl } from "@/components/learning-board";
import { semanticConfig } from "@/lib/semantic-config";
import type { LearningSuggestion } from "@/lib/learning-policy";
export const dynamic="force-dynamic";
export const maxDuration=60;
export default async function Learning({searchParams}:{searchParams:Promise<{group?:string}>}){
  await requireAdmin();const params=await searchParams;const db=database();
  const month=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit"}).format(new Date())+"-01";
  const [groups,usage]=await Promise.all([
    db.from("permissions").select("group_id,label,enabled,learning_enabled").order("created_at",{ascending:false}).limit(100),
    db.from("learning_runs").select("id,status,message_count,suggestion_count,estimated_usd,created_at,group_id").eq("month",month).order("created_at",{ascending:false}).limit(120)
  ]);dbError(groups.error);dbError(usage.error);
  const group=groups.data?.find(g=>g.group_id===params.group)||groups.data?.find(g=>g.learning_enabled)||groups.data?.[0];
  const groupId=group?.group_id??"";
  const [suggestions,friends,queued]=await Promise.all([
    db.from("learning_suggestions").select("id,group_id,sender_id,title,content,question_examples,category,status,created_at,expires_at,evidence").eq("group_id",groupId).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(200),
    db.from("friends").select("line_user_id,display_name,learning_opt_out,blocked").eq("group_id",groupId).order("created_at").limit(100),
    db.from("learning_messages").select("event_id",{count:"exact",head:true}).eq("group_id",groupId).is("processed_at",null).gt("created_at",new Date(Date.now()-7*86400000).toISOString())
  ]);for(const result of [suggestions,friends,queued])dbError(result.error);
  const names=Object.fromEntries((friends.data||[]).map(f=>[f.line_user_id,f.display_name||`สมาชิก …${f.line_user_id.slice(-4)}`]));
  const runs=usage.data||[];const cost=runs.reduce((sum,r)=>sum+Number(r.estimated_usd),0);
  const labels:Record<string,string>={processing:"กำลังสรุป",done:"สรุปแล้ว",failed:"ไม่สำเร็จ",cancelled:"ยกเลิก"};
  return <>
    <header className="dashboard-heading"><h1>เรียนรู้จากกลุ่ม</h1></header>
    <div className="stats"><article><span>รอบสรุปเดือนนี้ · รวมทุกกลุ่ม</span><strong>{runs.length} / 120</strong></article><article><span>ค่า AI โดยประมาณ · USD</span><strong>${cost.toFixed(4)}</strong></article><article><span>ข้อความรอสรุปในกลุ่มนี้</span><strong>{queued.count||0}</strong></article><article><span>กลุ่มที่เปิดเรียนรู้</span><strong>{groups.data?.filter(g=>g.enabled&&g.learning_enabled).length||0}</strong></article></div>
    <section className="panel"><div className="learning-group-links">{groups.data?.map(g=><Link key={g.group_id} href={`/admin/learning?group=${g.group_id}`} aria-current={g.group_id===groupId?"page":undefined}>{g.label||"กลุ่มยังไม่มีชื่อ"}</Link>)}</div>
      {group?<><h2>{group.label||"กลุ่มที่เลือก"}</h2><LearningGroupControl key={`${groupId}:${group.learning_enabled}`} group={groupId} enabled={group.learning_enabled} available={group.enabled}/>{!group.enabled&&<p>เปิดสิทธิ์กลุ่มในหน้า สิทธิ์/เพื่อน/ประวัติ ก่อน</p>}</>:<p>เชิญบอทเข้ากลุ่มและเรียกหนึ่งครั้งเพื่อเพิ่มกลุ่ม</p>}
      <p>AI สรุปความชอบ ชื่อเรียก และรูปแบบการคุยเป็นความจำรอตรวจ ใช้ตอบได้หลังคุณอนุมัติ และเฉพาะกลุ่มต้นทาง</p>
      <details><summary>การเก็บข้อความและค่าใช้จ่าย</summary><p>เมื่อเปิด ระบบจะส่งข้อความใหม่ที่ผ่านตัวกรองไปให้ Google เพื่อสรุป ควรแจ้งสมาชิกในกลุ่มก่อนใช้งาน รับเฉพาะข้อความตัวอักษรยาวไม่เกิน 500 ตัวอักษร สูงสุด 100 ข้อความต่อกลุ่มต่อวัน ไม่อ่านแชตส่วนตัวหรือรูปและไฟล์</p><p>สรุปได้หนึ่งครั้งต่อช่วง 00–06, 06–12, 12–18 และ 18–24 น. เวลาไทย สูงสุด 4 รอบต่อวันและ 120 รอบต่อเดือนรวมทุกกลุ่ม เริ่มเมื่อมีข้อความใหม่ หรือในการตรวจประจำวัน ถ้าไม่มีข้อความจะไม่เรียก AI ปุ่มสรุปใช้เพดานเดียวกัน</p><p>ข้อความดิบเก็บ 7 วัน ความจำรอตรวจ 30 วัน ความจำที่อนุมัติพร้อมข้อความอ้างอิงเก็บได้ถึง 90 วัน ลบเองได้ และลบความจำที่อ้างอิงเมื่อ LINE แจ้งยกเลิกส่งข้อความ</p><p>ค่าใช้จ่ายแสดงเฉพาะการสรุป ไม่รวมการจับคู่คำถาม ค่าฐานข้อมูล ภาษี หรือการหักเครดิต Google ถ้าระบบไม่ได้ยอดใช้งานจาก Google จะประเมินจากเพดานต่อรอบ เพดานนี้ควบคุมเฉพาะน้องโจอา</p></details>
      {semanticConfig().enabled?<LearningRunControl/>:<p>Gemini ยังไม่เปิดใช้งาน</p>}
    </section>
    <LearningBoard key={groupId} items={(suggestions.data||[]) as LearningSuggestion[]} names={names}/>
    <details className="panel"><summary>สมาชิกที่ให้เรียนรู้ในกลุ่มนี้</summary>{friends.data?.map(f=><LearningFriendControl key={`${f.line_user_id}:${f.learning_opt_out}`} group={groupId} sender={f.line_user_id} name={names[f.line_user_id]+(f.blocked?" · พักการตอบอยู่":"")} excluded={f.learning_opt_out}/>)}</details>
    <details className="panel"><summary>การสรุปล่าสุด</summary><div className="table-wrap"><table><thead><tr><th>เวลา</th><th>กลุ่ม</th><th>ข้อความ</th><th>ความจำใหม่</th><th>สถานะ</th></tr></thead><tbody>{runs.slice(0,10).map(r=><tr key={r.id}><td>{new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"short",timeStyle:"short"}).format(new Date(r.created_at))}</td><td>{groups.data?.find(g=>g.group_id===r.group_id)?.label||"กลุ่ม"}</td><td>{r.message_count}</td><td>{r.suggestion_count}</td><td>{labels[r.status]}</td></tr>)}</tbody></table></div>{!runs.length&&<p>ยังไม่มีการเรียก AI เพื่อสรุป</p>}</details>
  </>;
}
