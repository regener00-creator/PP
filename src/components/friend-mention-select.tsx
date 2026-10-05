"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { loadFriendNames } from "@/app/admin/friend-actions";
import { friendName, type MentionFriend, type MentionOwner } from "@/lib/friends";

export function FriendMentionSelect({ group, friends, owner, selected }: {
  group: string; friends: MentionFriend[]; owner: MentionOwner; selected: string;
}) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const hintId = useId();
  const members = friends.filter(friend => friend.group_id === group && !friend.blocked);
  const missingKey = members.filter(friend => !friend.display_name.trim()).map(friend => friend.id).sort().join(",");
  useEffect(() => {
    if (!group || !missingKey) return;
    let active = true;
    setBusy(true);
    loadFriendNames(group).then(result => {
      if (!active) return;
      setNames(Object.fromEntries(result.names.map(item => [item.id, item.name])));
      setMessage(result.message);
    }).catch(() => { if (active) setMessage("โหลดชื่อจาก LINE ไม่ได้ ลองอีกครั้งหรือตั้งชื่อเอง"); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [group, missingKey, retry]);
  const namedMembers = members.map(friend => ({ ...friend, display_name: friend.display_name.trim() || names[friend.id] || "" }));
  return <div className="friend-mention-field">
    <label>แท็กเพื่อนในกลุ่ม<select name="mention_user_id" defaultValue={selected} disabled={!group} aria-describedby={hintId}>
      <option value="">ไม่แท็ก</option>
      {namedMembers.map(friend => {
        const label = friendName(friend, owner);
        const duplicate = namedMembers.filter(other => friendName(other, owner) === label).length > 1;
        return <option key={friend.id} value={friend.line_user_id}
          disabled={!friend.display_name && friend.line_user_id !== owner.line_user_id && friend.line_user_id !== selected}>
          {label}{duplicate ? ` · ลงท้าย ${friend.line_user_id.slice(-4)}` : ""}
        </option>;
      })}
    </select></label>
    <small id={hintId}>{!group ? "เลือกกลุ่มก่อน" : !members.length ? "ให้เพื่อนส่งข้อความในกลุ่ม แล้วอัปเดตรายชื่อที่หน้า สิทธิ์/เพื่อน/ประวัติ" : "แท็กคนที่เลือกพร้อมข้อความแจ้งเตือนในกลุ่ม"}</small>
    {busy && <small role="status">กำลังโหลดชื่อจาก LINE…</small>}
    {!busy && message && <small role="status">{message} <button type="button" className="secondary text-button" onClick={() => setRetry(value => value + 1)}>โหลดชื่ออีกครั้ง</button></small>}
    {group && <Link className="friend-names-link" href="/admin/settings#friends" target="_blank">แก้ชื่อเพื่อน</Link>}
  </div>;
}
