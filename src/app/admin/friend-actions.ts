"use server";
import { requireAdmin } from "@/lib/auth";
import { database, dbError } from "@/lib/db";
import { required } from "@/lib/env";
import { getGroupMemberName, getGroupMemberIds, groupId, LineError } from "@/lib/line";
import { revalidatePath } from "next/cache";

export async function syncGroupFriends(group: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  if (!groupId.safeParse(group).success) return { ok: false, message: "เลือกกลุ่มก่อน" };
  const db = database();
  const permission = await db.from("permissions").select("enabled").eq("group_id", group).maybeSingle();
  dbError(permission.error);
  if (!permission.data?.enabled) return { ok: false, message: "เปิดใช้งานกลุ่มก่อนอัปเดตรายชื่อ" };
  let message: string;
  try {
    const members = await getGroupMemberIds(group, required("LINE_CHANNEL_ACCESS_TOKEN"));
    if (members.ids.length) {
      const saved = await db.from("friends").upsert(members.ids.map(id => ({ group_id: group, line_user_id: id })),
        { onConflict: "group_id,line_user_id", ignoreDuplicates: true });
      dbError(saved.error);
    }
    message = members.complete ? `อัปเดตจาก LINE แล้ว ${members.ids.length} คน` : `อัปเดต ${members.ids.length} คนแรกแล้ว กลุ่มนี้มีสมาชิกจำนวนมาก`;
  } catch (error) {
    if (error instanceof LineError && error.status === 403) {
      message = "บัญชี LINE นี้ดึงสมาชิกทั้งหมดไม่ได้ ให้เพื่อนส่งข้อความหรือสติกเกอร์ในกลุ่มหนึ่งครั้ง แล้วกดอัปเดตรายชื่ออีกครั้ง";
    } else {
      return { ok: false, message: "ดึงรายชื่อจาก LINE ไม่สำเร็จ ลองอีกครั้ง และตรวจว่าบอทยังอยู่ในกลุ่ม" };
    }
  }
  const resolved = await loadFriendNames(group);
  revalidatePath("/admin", "layout");
  return { ok: true, message: [message, resolved.message].filter(Boolean).join(" · ") };
}

export async function loadFriendNames(group: string): Promise<{ names: { id: string; name: string }[]; message: string }> {
  await requireAdmin();
  if (!groupId.safeParse(group).success) return { names: [], message: "เลือกกลุ่มก่อน" };
  const db = database();
  const permission = await db.from("permissions").select("enabled").eq("group_id", group).maybeSingle();
  dbError(permission.error);
  if (!permission.data?.enabled) return { names: [], message: "กลุ่มนี้ยังไม่เปิดใช้งาน" };
  const result = await db.from("friends").select("id,line_user_id,display_name").eq("group_id", group).eq("blocked", false).order("created_at").limit(1000);
  dbError(result.error);
  const friends = result.data || [];
  const names = friends.filter(friend => friend.display_name.trim()).map(friend => ({ id: friend.id, name: friend.display_name }));
  // Only fill missing names; never overwrite names chosen by the owner.
  const missing = friends.filter(friend => !friend.display_name.trim()).slice(0, 20);
  const token = missing.length ? required("LINE_CHANNEL_ACCESS_TOKEN") : "";
  for (let i = 0; i < missing.length; i += 4) {
    await Promise.all(missing.slice(i, i + 4).map(async friend => {
      try {
        const name = await getGroupMemberName(group, friend.line_user_id, token);
        // Compare the old name too, so an edit made while LINE is loading wins.
        const saved = await db.from("friends").update({ display_name: name }).eq("id", friend.id)
          .eq("group_id", group).eq("blocked", false).eq("display_name", friend.display_name).select("id,display_name").maybeSingle();
        dbError(saved.error);
        if (saved.data) names.push({ id: saved.data.id, name: saved.data.display_name });
      } catch { /* An unavailable member must not prevent the rest of the form from working. */ }
    }));
  }
  return { names, message: names.length < friends.length ? "บางคนยังไม่มีชื่อ โหลดชื่ออีกครั้งหรือตั้งชื่อในหน้า สิทธิ์/เพื่อน/ประวัติ" : "" };
}
