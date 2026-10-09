export type CalendarEvent={id:string;title:string;event_date:string;reminder_time?:string;annual:boolean;message:string;enabled:boolean;remind_day:boolean;remind_before:boolean;send_owner:boolean;group_id:string|null;mention_user_id:string|null;attachment_ids:string[];updated_at?:string};
// Presentation only: secretary appointments keep their original record and reminder queue.
export type CalendarEntry = CalendarEvent & { assistant?: { id: string; group: string | null } };
export type CalendarDelivery = { id: string; event_id: string; occurs_on: string; lead_days: number; target: string; status: string; reason: string | null; created_at: string };
export function thaiDate(now=new Date()) { return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(now); }
export function addDays(date:string,days:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function occursOn(event:Pick<CalendarEvent,"event_date"|"annual">,date:string){return date>=event.event_date && (event.annual?event.event_date.slice(5)===date.slice(5):event.event_date===date);}
export type ReminderSchedule = Pick<CalendarEvent,"event_date"|"annual"|"enabled"|"remind_day"|"remind_before"|"reminder_time">;
export function dueDates(event:ReminderSchedule,today:string){
  if(!event.enabled)return [];
  return ([0,1] as const).filter(lead=>lead===0?event.remind_day:event.remind_before).map(lead=>({lead,occurs:addDays(today,lead)})).filter(d=>occursOn(event,d.occurs));
}

export const DEFAULT_REMINDER_TIME = "08:00";
export const REMINDER_GRACE_MS = 10 * 60 * 1000;
export function reminderTime(value?: string) { return (value || DEFAULT_REMINDER_TIME).slice(0,5); }
// Include the previous local date when a short retry window crosses midnight.
export function timedDueDates(event: ReminderSchedule, now = new Date()) {
  const dates = new Set([thaiDate(now), thaiDate(new Date(now.getTime() - REMINDER_GRACE_MS))]);
  return [...dates].flatMap(date => dueDates(event,date).filter(() => {
    const scheduled = Date.parse(date + "T" + reminderTime(event.reminder_time) + ":00+07:00");
    const elapsed = now.getTime() - scheduled;
    return elapsed >= 0 && elapsed < REMINDER_GRACE_MS;
  }));
}
