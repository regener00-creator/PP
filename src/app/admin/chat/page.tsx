import Link from "next/link";
import { AssistantChat } from "@/components/assistant-chat";
import { database, dbError } from "@/lib/db";
import { assistantRecords, upcoming } from "@/lib/assistant";
import { proposalSchema, scopeKey } from "@/lib/assistant-types";
import { thaiDate } from "@/lib/calendar";
import { groupId } from "@/lib/line";
import { webScope, deleteAssistantRecord } from "./actions";
export const dynamic = "force-dynamic";
export default async function Chat({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const params = await searchParams;
  const group = groupId.safeParse(params.group).success ? params.group! : null;
  const scope = await webScope(group),
    key = scopeKey(scope),
    db = database();
  const [records, history, groups] = await Promise.all([
    assistantRecords(scope),
    db
      .from("assistant_turns")
      .select("id,request,reply,proposal,status,expires_at")
      .eq("scope_key", key)
      .eq("sender_id", scope.sender)
      .order("created_at", { ascending: false })
      .limit(12),
    db
      .from("permissions")
      .select("group_id,label")
      .eq("enabled", true)
      .order("created_at"),
  ]);
  dbError(history.error);
  dbError(groups.error);
  const initial = (history.data || []).toReversed().flatMap((t) => [
    { id: `${t.id}:user`, role: "user" as const, text: t.request },
    {
      id: t.id,
      role: "assistant" as const,
      text: t.reply,
      ...(t.status === "proposed" &&
      Date.parse(t.expires_at) > Date.now() &&
      proposalSchema.safeParse(t.proposal).success
        ? { pending: { id: t.id, proposal: proposalSchema.parse(t.proposal) } }
        : {}),
    },
  ]);
  const next = upcoming(records.events, thaiDate());
  return (
    <>
      <header className="dashboard-heading">
        <div>
          <span className="eyebrow">YOUR PERSONAL SECRETARY</span>
          <h1>คุยกับน้องโจอา</h1>
          <p className="muted">จำ · ถาม · เตือน · นัดหมาย · คุยทั่วไป</p>
        </div>
        <Link className="button secondary" href="/admin">
          เปิดความทรงจำเดิม
        </Link>
      </header>
      <nav className="chat-scopes" aria-label="เลือกแชต">
        <Link href="/admin/chat" aria-current={!group ? "page" : undefined}>
          ของฉัน
        </Link>
        {groups.data?.map((g) => (
          <Link
            key={g.group_id}
            href={`/admin/chat?group=${g.group_id}`}
            aria-current={group === g.group_id ? "page" : undefined}
          >
            {g.label || "กลุ่ม LINE"}
          </Link>
        ))}
      </nav>
      <p className="scope-description">
        {group
          ? "เรื่องที่ฝากจำและนัดหมายใช้ร่วมกันในกลุ่มนี้ แจ้งเตือนเข้ากลุ่มนี้"
          : "สมุดจำของคุณ ใช้ต่อกับแชตส่วนตัวใน LINE ได้ แจ้งเตือนส่งหา LINE ของคุณ"}
      </p>
      <div className="assistant-layout">
        <AssistantChat key={key} group={group} initial={initial} />
        <aside className="assistant-records">
          <section className="panel">
            <h2>นัดหมายถัดไป</h2>
            <p className="muted">แจ้งเตือนช่วง 08:00–09:00 น. เวลาไทย</p>
            {!next.length && <p>ยังไม่มีนัดหมาย</p>}
            {next.map((e) => (
              <article className="assistant-record" key={e.id}>
                <time>{e.next}</time>
                <strong>{e.title}</strong>
                <p>{e.content}</p>
                {e.source !== "legacy" && (
                  <DeleteButton id={e.id} kind="event" group={group} />
                )}
              </article>
            ))}
          </section>
          <section className="panel">
            <h2>
              สมุดจำของเลขา <small>({records.notes.length})</small>
            </h2>
            {!records.notes.length && (
              <p>เริ่มด้วย “จำว่า…” แล้วตรวจสรุปก่อนยืนยัน</p>
            )}
            {records.notes.map((n) => (
              <article className="assistant-record" key={n.id}>
                <strong>{n.title}</strong>
                <p>{n.content}</p>
                <DeleteButton id={n.id} kind="note" group={group} />
              </article>
            ))}
          </section>
          <Link className="button secondary" href="/admin#calendar">
            เปิดปฏิทินในความทรงจำ
          </Link>
        </aside>
      </div>
    </>
  );
}
function DeleteButton({
  id,
  kind,
  group,
}: {
  id: string;
  kind: "note" | "event";
  group: string | null;
}) {
  return (
    <details>
      <summary>จัดการรายการ</summary>
      <form action={deleteAssistantRecord}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="group" value={group || ""} />
        <button className="secondary">
          {kind === "event" ? "ลบนัดหมายนี้" : "ลบความจำนี้"}
        </button>
      </form>
    </details>
  );
}
