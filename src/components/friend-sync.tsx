"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncGroupFriends } from "@/app/admin/friend-actions";

export function FriendSync({ groups }: { groups: { group_id: string; label: string; enabled: boolean }[] }) {
  const enabled = groups.filter(group => group.enabled);
  const [group, setGroup] = useState(enabled[0]?.group_id || "");
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  return <div className="friend-sync">
    <div className="friend-sync-controls"><label>กลุ่มที่จะอัปเดต<select value={group} disabled={busy || !enabled.length} onChange={event => { setGroup(event.target.value); setMessage(""); }}>
      {!enabled.length && <option value="">ยังไม่มีกลุ่มที่เปิดใช้งาน</option>}
      {enabled.map(item => <option key={item.group_id} value={item.group_id}>{item.label || "กลุ่มที่ยังไม่ตั้งชื่อ"}</option>)}
    </select></label>
    <button type="button" className="secondary" disabled={busy || !group} onClick={() => start(async () => {
      setMessage("");
      try { const result = await syncGroupFriends(group); setMessage(result.message); if (result.ok) router.refresh(); }
      catch { setMessage("อัปเดตรายชื่อไม่ได้ ลองใหม่อีกครั้ง"); }
    })}>{busy ? "กำลังอัปเดต…" : "อัปเดตรายชื่อ"}</button></div>
    <p role="status" className="form-status">{message}</p>
  </div>;
}
