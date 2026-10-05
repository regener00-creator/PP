export type CalendarEvent={id:string;title:string;event_date:string;annual:boolean;message:string;enabled:boolean;remind_day:boolean;remind_before:boolean;send_owner:boolean;group_id:string|null;mention_user_id:string|null;attachment_ids:string[];updated_at?:string};
export function thaiDate(now=new Date()) { return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(now); }
export function addDays(date:string,days:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function occursOn(event:Pick<CalendarEvent,"event_date"|"annual">,date:string){return date>=event.event_date && (event.annual?event.event_date.slice(5)===date.slice(5):event.event_date===date);}
export function dueDates(event:CalendarEvent,today:string){
  if(!event.enabled)return [];
  return ([0,1] as const).filter(lead=>lead===0?event.remind_day:event.remind_before).map(lead=>({lead,occurs:addDays(today,lead)})).filter(d=>occursOn(event,d.occurs));
}
