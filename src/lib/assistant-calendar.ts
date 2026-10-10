import "server-only";
import { adminNotebooks } from "./admin-notebooks";
import type { AssistantEvent } from "./assistant-types";
import type { CalendarEntry, CalendarDelivery } from "./calendar";

export function calendarAppointment(event: AssistantEvent): CalendarEntry {
  const group = event.scope_key.startsWith("C") ? event.scope_key : null;
  return {
    id: `assistant:${event.id}`,
    assistant: { id: event.id, group },
    title: event.title,
    event_date: event.event_date,
    reminder_time: event.reminder_time || "08:00",
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
  const snapshot = await adminNotebooks();
  return {
    events: snapshot.events.map(calendarAppointment),
    deliveries: snapshot.deliveries.map(d => ({ ...d, id: `assistant:${d.id}`, event_id: `assistant:${d.event_id}` })),
  };
}
