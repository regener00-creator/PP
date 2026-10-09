import "server-only";
import { requireAdmin } from "./auth";
import { assistantAllowed } from "./assistant";
import type { AssistantEvent } from "./assistant-types";
import type { CalendarEntry, CalendarDelivery } from "./calendar";
import { database, dbError } from "./db";

export function calendarAppointment(event: AssistantEvent): CalendarEntry {
  const group = event.scope_key.startsWith("C") ? event.scope_key : null;
  return {
    id: `assistant:${event.id}`,
    assistant: { id: event.id, group },
    title: event.title,
    event_date: event.event_date,
    annual: event.annual,
    message: event.content,
    enabled: event.enabled,
    remind_day: true,
    remind_before: event.remind_before,
    send_owner: !group,
    group_id: group,
    mention_user_id: null,
    attachment_ids: [],
  };
}

export async function assistantCalendar(): Promise<{ events: CalendarEntry[]; deliveries: CalendarDelivery[] }> {
  await requireAdmin();
  const db = database();
  const [owner, groups] = await Promise.all([
    db.from("owner").select("line_user_id").eq("id", 1).single(),
    db.from("permissions").select("group_id").eq("enabled", true),
  ]);
  dbError(owner.error);
  dbError(groups.error);
  const sender = owner.data?.line_user_id;
  if (!sender) return { events: [], deliveries: [] };
  // Never read another user's DM notebook, even with the server database key.
  const scopes: (string | null)[] = [null, ...new Set<string>((groups.data || []).map(g => g.group_id))];
  const notebooks = await Promise.all(scopes.map(async group => {
    if (!await assistantAllowed({ sender, group, web: true })) return { events: [], deliveries: [] };
    const result = await db.from("assistant_events").select("*")
      .eq("scope_key", group || sender).order("event_date").limit(100);
    dbError(result.error);
    const records = (result.data || []) as AssistantEvent[];
    const events = records.map(calendarAppointment);
    if (!records.length) return { events, deliveries: [] };
    const deliveries = await db.from("assistant_deliveries")
      .select("id,event_id,occurs_on,lead_days,status,reason,created_at")
      .in("event_id", records.map(e => e.id)).order("created_at", { ascending: false }).limit(30);
    dbError(deliveries.error);
    return { events, deliveries: (deliveries.data || []).map(d => ({
      ...d, id: `assistant:${d.id}`, event_id: `assistant:${d.event_id}`, target: group || sender,
    })) as CalendarDelivery[] };
  }));
  return { events: notebooks.flatMap(n => n.events), deliveries: notebooks.flatMap(n => n.deliveries) };
}
