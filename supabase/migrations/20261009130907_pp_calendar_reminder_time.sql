-- Existing appointments retain their default morning time. No data is deleted.
alter table pp.calendar_events add column reminder_time text not null default '08:00'
 check(reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table pp.assistant_events add column reminder_time text not null default '08:00'
 check(reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table pp.assistant_deliveries add column event_revision timestamptz;

-- Shared clock rule, including a short retry window across Thai midnight.
create function pp.pp_reminder_due(p_date date,p_annual boolean,p_time text,p_occurs date,p_lead integer,p_now timestamptz)
returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(p_lead in (0,1) and p_occurs>=p_date
 and (case when p_annual then to_char(p_date,'MM-DD')=to_char(p_occurs,'MM-DD') else p_date=p_occurs end)
 and p_now >= ((p_occurs-p_lead)+p_time::time) at time zone 'Asia/Bangkok'
 and p_now < (((p_occurs-p_lead)+p_time::time) at time zone 'Asia/Bangkok')+interval '10 minutes',false);
$$;
create or replace function pp.pp_claim_reminder(p_event uuid,p_occurs date,p_lead integer,p_target text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e pp.calendar_events; d pp.reminder_deliveries; today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  select * into e from pp.calendar_events where id=p_event and enabled;
  if not found or not pp.pp_reminder_due(e.event_date,e.annual,e.reminder_time,p_occurs,p_lead,now()) or p_lead not in(0,1)
    or (p_lead=0 and not e.remind_day) or (p_lead=1 and not e.remind_before)
    or (not e.annual and e.event_date<>p_occurs)
    or (e.annual and (p_occurs<e.event_date or to_char(e.event_date,'MM-DD')<>to_char(p_occurs,'MM-DD')))
  then return null; end if;
  if p_target like 'U%' then
    if not e.send_owner or not exists(select 1 from pp.owner where id=1 and line_user_id=p_target) then return null; end if;
  elsif p_target like 'C%' then
    if e.group_id is distinct from p_target or not exists(select 1 from pp.permissions where group_id=p_target and enabled) then return null; end if;
  else return null; end if;
  insert into pp.reminder_deliveries(event_id,occurs_on,lead_days,target,lease_until)
    values(p_event,p_occurs,p_lead,p_target,now()+interval '5 minutes')
    on conflict(event_id,occurs_on,lead_days,target) do update set lease_until=excluded.lease_until,
      attempts=pp.reminder_deliveries.attempts+1,status='processing',updated_at=now()
      where pp.reminder_deliveries.status in('failed','processing') and pp.reminder_deliveries.lease_until<now()
        and pp.reminder_deliveries.attempts<3 and pp.reminder_deliveries.created_at>now()-interval '23 hours'
    returning * into d;
  if d.id is null then return null; end if;
  return to_jsonb(d);
end;
$$;
create or replace function pp.pp_claim_assistant_reminder(p_event uuid,p_occurs date,p_lead integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e pp.assistant_events; d pp.assistant_deliveries; today date := (now() at time zone 'Asia/Bangkok')::date;
begin
 select * into e from pp.assistant_events where id=p_event and enabled;
 if not found or not pp.pp_reminder_due(e.event_date,e.annual,e.reminder_time,p_occurs,p_lead,now()) or not pp.pp_assistant_allowed(e.scope_key,e.sender_id) or p_lead not in (0,1)
  or (p_lead=1 and not e.remind_before)  or p_occurs<e.event_date
  or (case when e.annual then to_char(e.event_date,'MM-DD')<>to_char(p_occurs,'MM-DD') else e.event_date<>p_occurs end)
 then return null; end if;
 insert into pp.assistant_deliveries(event_id,occurs_on,lead_days,lease_until,event_revision,payload)
 values(e.id,p_occurs,p_lead,now()+interval '5 minutes',e.updated_at,jsonb_build_array(jsonb_build_object('type','text','text',
  (case when p_lead=1 then 'เตือนล่วงหน้า 1 วัน · ' else '' end)||e.title||E'\n'||e.content)))
 on conflict(event_id,occurs_on,lead_days) do update set status='processing',attempts=pp.assistant_deliveries.attempts+1,lease_until=now()+interval '5 minutes'
  where pp.assistant_deliveries.status in ('processing','failed') and pp.assistant_deliveries.lease_until<now() and pp.assistant_deliveries.attempts<3
 returning * into d;
 if not found then return null; end if;
 return to_jsonb(d);
end;
$$;
-- Used by the minute scheduler to avoid HTTP calls when nothing can be claimed.
create function pp.pp_has_due_reminders(p_now timestamptz default now())
returns boolean language sql stable security invoker set search_path='' as $$
 with dates as (
 select distinct (stamp at time zone 'Asia/Bangkok')::date as day
 from (values(p_now),(p_now-interval '10 minutes')) v(stamp)
 ), leads as (select generate_series(0,1) as lead)
 select exists(
 select 1 from pp.calendar_events e cross join dates cross join leads
 cross join lateral (
   select line_user_id as target from pp.owner where id=1 and e.send_owner and line_user_id is not null
   union select e.group_id where e.group_id is not null and exists(select 1 from pp.permissions p where p.group_id=e.group_id and p.enabled)
 ) recipients
 left join pp.reminder_deliveries d on d.event_id=e.id and d.occurs_on=dates.day+leads.lead and d.lead_days=leads.lead and d.target=recipients.target
 where e.enabled and (case when leads.lead=0 then e.remind_day else e.remind_before end)
 and pp.pp_reminder_due(e.event_date,e.annual,e.reminder_time,dates.day+leads.lead,leads.lead,p_now)
 and (d.id is null or (d.status in ('processing','failed') and d.attempts<3 and d.lease_until<p_now))
 union all
 select 1 from pp.assistant_events e cross join dates cross join leads
 left join pp.assistant_deliveries d on d.event_id=e.id and d.occurs_on=dates.day+leads.lead and d.lead_days=leads.lead
 where e.enabled and (leads.lead=0 or e.remind_before) and pp.pp_assistant_allowed(e.scope_key,e.sender_id)
 and pp.pp_reminder_due(e.event_date,e.annual,e.reminder_time,dates.day+leads.lead,leads.lead,p_now)
 and (d.id is null or (d.status in ('processing','failed') and d.attempts<3 and d.lease_until<p_now))
 );
$$;
revoke all on function pp.pp_reminder_due(date,boolean,text,date,integer,timestamptz),pp.pp_has_due_reminders(timestamptz) from public,anon,authenticated;
grant execute on function pp.pp_reminder_due(date,boolean,text,date,integer,timestamptz),pp.pp_has_due_reminders(timestamptz) to service_role;
notify pgrst,'reload schema';
