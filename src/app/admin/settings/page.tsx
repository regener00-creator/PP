import { OwnerForm, PermissionForm, UnknownReplyForm, type Permission } from "@/components/admin-forms";
import { requireAdmin } from "@/lib/auth";
import { database, dbError } from "@/lib/db";
import { saveFriend } from "../actions";
import { friendName } from "@/lib/friends";
import { FriendSync } from "@/components/friend-sync";
import { unknownReplies } from "@/lib/policy";

export const dynamic = "force-dynamic";
const labels: Record<string,string> = { answer: "ตอบจากความจำ", owner_answer: "ตอบเจ้าของในแชตส่วนตัว", direct_answer: "ตอบในแชตส่วนตัว", direct_denied: "พักการตอบในแชตส่วนตัว", owner_denied: "ไม่ผ่านสิทธิ์เจ้าของ", ambiguous: "คำถามตรงหลายความจำ", conflict: "ข้อมูลขัดกัน รอเจ้าของตรวจ", refuse: "ขอไม่ตอบ", unknown: "ยังไม่รู้", handoff: "ให้เจ้าตัวตอบ", rate_limit: "พักการตอบ", delivery_error: "ส่งไม่สำเร็จ" };

export default async function Settings() {
  await requireAdmin();
  const db = database();
  const [owner, permissions, friends, conversations] = await Promise.all([
    db.from("owner").select("display_name,line_user_id,unknown_replies").eq("id", 1).single(),
    db.from("permissions").select("group_id,label,enabled,allow_owner_mention").order("created_at", { ascending: false }).limit(100),
    db.from("friends").select("id,group_id,line_user_id,display_name,blocked").order("created_at", { ascending: false }).limit(100),
    db.from("conversations").select("event_id,group_id,source_type,status,decision,created_at").order("created_at", { ascending: false }).limit(30)
  ]);
  for (const result of [owner, permissions, friends, conversations]) dbError(result.error);
  const groups = (permissions.data || []) as Permission[];
  return <>
    <header className="dashboard-heading"><h1>สิทธิ์/เพื่อน/ประวัติ</h1></header>
    <section id="unknown-reply" className="panel"><h2>ข้อความเมื่อไม่รู้คำตอบ</h2><UnknownReplyForm values={unknownReplies(owner.data?.unknown_replies)}/></section>
    <div className="settings-grid"><section id="owner" className="panel"><div className="eyebrow">THE HUMAN BEHIND PP</div><h2>เจ้าของ PP</h2><OwnerForm owner={owner.data || { display_name: "ปีโป้", line_user_id: null }}/></section><section id="groups" className="panel"><div className="eyebrow">CLOSE FRIENDS ONLY</div><h2>กลุ่มและสิทธิ์</h2><p>แท็ก PP จริงในกลุ่มหนึ่งครั้ง กลุ่มจะปรากฏที่นี่และรอคุณอนุมัติ</p>{groups.map(group => <details key={group.group_id}><summary>{group.enabled ? "เปิดใช้งาน ·" : "ปิดใช้งาน ·"} {group.label || group.group_id}</summary><PermissionForm permission={group}/></details>)}<details><summary>เพิ่มกลุ่มด้วย ID</summary><PermissionForm/></details></section></div>
    <section id="friends" className="panel"><h2>เพื่อนในกลุ่ม</h2><p>เพื่อนจะปรากฏหลังส่งข้อความหรือสติกเกอร์ในกลุ่มที่เปิดใช้งานแล้ว ไม่ต้องเรียกบอท · แสดงล่าสุดสูงสุด 100 คน</p><FriendSync groups={groups}/>{friends.data?.length ? friends.data.map(friend => <form action={saveFriend} className="friend-row" key={friend.id}><input type="hidden" name="id" value={friend.id}/><div><strong>{friendName(friend, owner.data || { display_name: "เจ้าของ", line_user_id: null })}</strong><small>{groups.find(g => g.group_id === friend.group_id)?.label || friend.group_id}</small></div><label>ชื่อเพื่อน<input name="display_name" defaultValue={friend.display_name} maxLength={80}/></label><label className="check"><input name="blocked" type="checkbox" defaultChecked={friend.blocked}/>พักการตอบคนนี้</label><button className="secondary">บันทึก</button></form>) : <p className="muted">ยังไม่มีรายชื่อ ให้เพื่อนส่งข้อความในกลุ่มแล้วกดอัปเดตรายชื่อ</p>}</section>
    <section id="activity" className="panel"><h2>การตอบล่าสุด</h2><p>เก็บประวัติการตอบ 30 วัน โดยไม่เก็บข้อความสนทนาดิบ</p><div className="table-wrap"><table><thead><tr><th>เวลา</th><th>แชต</th><th>การตัดสินใจ</th><th>การส่ง</th></tr></thead><tbody>{conversations.data?.map(item => <tr key={item.event_id}><td>{new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</td><td>{item.source_type === "user" ? "แชตส่วนตัว" : groups.find(g => g.group_id === item.group_id)?.label || item.group_id}</td><td>{labels[item.decision || ""] || "กำลังประมวลผล"}</td><td>{item.status}</td></tr>)}</tbody></table></div>{!conversations.data?.length && <p className="muted">พร้อมเมื่อเพื่อนเรียก @pp</p>}</section></>;
}
