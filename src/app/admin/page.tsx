import { Suspense } from "react";
import { CalendarBoard, MemoryBoard, type Friend, type LibraryFile } from "@/components/workspace-ui";
import { type Memory, type Permission } from "@/components/admin-forms";
import { LineQuota, QuotaLoading } from "@/components/line-quota";
import { SemanticStatus } from "@/components/semantic-status";
import { requireAdmin } from "@/lib/auth";
import { database, dbError } from "@/lib/db";
import { thaiDate, type CalendarEntry, type CalendarDelivery } from "@/lib/calendar";
import { assistantCalendar } from "@/lib/assistant-calendar";
import { adminAssistantNotes } from "@/lib/assistant-notes";
import { AssistantNotesBoard } from "@/components/assistant-notes-board";
import { MemoryReview } from "@/components/memory-review";
import { memoryCatalog } from "@/lib/memory-assistant";
import type { LibraryFolder } from "@/components/attachment-picker";
import type { MemoryIssue } from "@/lib/memory-assistant-types";

export const dynamic = "force-dynamic";

const reasons: Record<string, string> = {
  sent: "LINE รับคำขอแล้ว", delivery_error: "ส่งไม่สำเร็จ", quota_exhausted: "โควตาไม่พอ",
  quota_or_rate_limit: "โควตาหรืออัตราการส่งเต็ม", quota_unavailable: "ตรวจโควตาไม่ได้",
  group_disabled: "กลุ่มปิดใช้งาน", changed: "รายการเปลี่ยนแล้ว", line_rejected: "LINE ปฏิเสธคำขอ",
};

export default async function Admin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  await requireAdmin();
  const db = database();
  const [memories, permissions, files, events, friends, deliveries, folders, owner, appointments, notes] = await Promise.all([
    db.rpc("pp_search_memories", { p_query: query }),
    db.from("permissions").select("group_id,label,enabled,allow_owner_mention").order("created_at", { ascending: false }),
    db.from("files").select("id,name,folder_id,mime,bytes,visibility").order("created_at", { ascending: false }).limit(500),
    db.from("calendar_events").select("*").order("event_date").limit(100),
    db.from("friends").select("id,line_user_id,display_name,group_id,blocked"),
    db.from("reminder_deliveries").select("id,event_id,occurs_on,lead_days,target,status,reason,created_at").order("created_at", { ascending: false }).limit(30),
    db.from("folders").select("id,name").order("name"),
    db.from("owner").select("display_name,line_user_id").eq("id", 1).single(),
    assistantCalendar(),
    adminAssistantNotes(),
  ]);
  for (const [name, result] of Object.entries({ memories, permissions, files, events, friends, deliveries, folders, owner })) dbError(result.error, `admin:${name}`);
  const items = (memories.data || []) as Memory[];
  const groups = (permissions.data || []) as Permission[];
  const calendarEvents: CalendarEntry[] = [...(events.data || []), ...appointments.events]
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.id.localeCompare(b.id));
  const recentDeliveries = [...((deliveries.data || []) as CalendarDelivery[]), ...appointments.deliveries]
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30);
  const libraryFiles = (files.data || []) as LibraryFile[];

  return <>
    <header className="dashboard-heading"><h1>ความทรงจำ</h1></header>
    <div className="stats memory-stats">
      <article><span>ความจำทั้งหมดที่แสดง</span><strong>{items.length + notes.length}</strong></article>
      <article><span>กลุ่มที่เปิดใช้งาน</span><strong>{groups.filter(g => g.enabled).length}</strong></article>
    </div>
    <CalendarBoard events={calendarEvents} today={thaiDate()} groups={groups} friends={(friends.data || []) as Friend[]} files={libraryFiles} folders={folders.data || []} owner={owner.data || { display_name: "เจ้าของ", line_user_id: null }}>
      <MemoryBoard key={query} items={items} files={libraryFiles} folders={folders.data || []} query={query}/>
      <Suspense fallback={<p role="status">กำลังอ่านรายการที่ต้องตรวจ…</p>}><MemoryReviewLoader files={libraryFiles} folders={folders.data || []}/></Suspense>
      <AssistantNotesBoard notes={notes}/>
    </CalendarBoard>
    <section className="panel delivery-panel">
      <h2>การแจ้งเตือนล่าสุด</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>รายการ</th><th>วันที่</th><th>ผู้รับ</th><th>สถานะ</th></tr></thead>
        <tbody>{recentDeliveries.map(d => <tr key={d.id}>
          <td>{calendarEvents.find(e => e.id === d.event_id)?.title || "รายการที่ลบแล้ว"}</td>
          <td>{d.occurs_on}{d.lead_days ? " (ก่อน 1 วัน)" : ""}</td>
          <td>{d.target.startsWith("U") ? "แชตส่วนตัวเจ้าของ" : groups.find(g => g.group_id === d.target)?.label || "กลุ่ม"}</td>
          <td>{reasons[d.reason || ""] || d.status}</td>
        </tr>)}</tbody>
      </table></div>
      {!recentDeliveries.length && <p>ยังไม่มีการส่งแจ้งเตือน</p>}
    </section>
    <details className="panel semantic-details">
      <summary>การจับความหมายด้วย Gemini และโควตา AI</summary>
      <Suspense fallback={<p role="status">กำลังอ่านข้อมูล AI…</p>}><SemanticStatus/></Suspense>
    </details>
    <Suspense fallback={<QuotaLoading/>}><LineQuota/></Suspense>
  </>;
}

async function MemoryReviewLoader({ files, folders }: { files: LibraryFile[]; folders: LibraryFolder[] }) {
  await requireAdmin();
  const [catalog, result] = await Promise.all([memoryCatalog(), database().from("memory_issues").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(100)]);
  dbError(result.error);
  const issues: MemoryIssue[] = (result.data || []).flatMap(issue => {
    const left = catalog.memories.find(m => m.id === issue.left_id && m.revision === issue.left_revision);
    const right = catalog.memories.find(m => m.id === issue.right_id && m.revision === issue.right_revision);
    return left && right ? [{ id: issue.id, kind: issue.kind, reason: issue.reason, left, right }] : [];
  });
  return <MemoryReview issues={issues} files={files} folders={folders}/>;
}
