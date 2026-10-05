create table pp.folders (
  id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 80),
  created_at timestamptz not null default now(), unique(name)
);
create table pp.files (
  id uuid primary key default gen_random_uuid(), folder_id uuid references pp.folders(id) on delete restrict,
  name text not null check(length(name) between 1 and 180), object_path text not null unique,
  mime text not null, bytes integer not null check(bytes between 1 and 3145728),
  visibility text not null default 'private' check(visibility in ('private','shareable')),
  created_at timestamptz not null default now()
);
create index files_folder_idx on pp.files(folder_id);
alter table pp.memories add column attachment_ids uuid[] not null default '{}' check(cardinality(attachment_ids)<=3);
create table pp.calendar_events (
  id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 120),
  event_date date not null, annual boolean not null default false,
  message text not null check(length(message) between 1 and 1500),
  enabled boolean not null default false, remind_day boolean not null default true, remind_before boolean not null default false,
  send_owner boolean not null default true, group_id text references pp.permissions(group_id) on delete restrict,
  mention_user_id text check(mention_user_id ~ '^U[0-9a-fA-F]{32}$'),
  attachment_ids uuid[] not null default '{}' check(cardinality(attachment_ids)<=3),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (send_owner or group_id is not null), check(remind_day or remind_before)
);
create index events_group_idx on pp.calendar_events(group_id);
create table pp.reminder_deliveries (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references pp.calendar_events(id) on delete cascade,
  occurs_on date not null, lead_days integer not null check(lead_days in (0,1)), target text not null,
  status text not null default 'processing' check(status in ('processing','sent','failed','skipped')),
  retry_key uuid not null default gen_random_uuid(), lease_until timestamptz, attempts integer not null default 1,
  reason text, payload jsonb, event_revision timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(event_id,occurs_on,lead_days,target)
);
create index deliveries_created_idx on pp.reminder_deliveries(created_at);
alter table pp.folders enable row level security;
alter table pp.files enable row level security;
alter table pp.calendar_events enable row level security;
alter table pp.reminder_deliveries enable row level security;
revoke all on pp.folders,pp.files,pp.calendar_events,pp.reminder_deliveries from public,anon,authenticated;
grant all on pp.folders,pp.files,pp.calendar_events,pp.reminder_deliveries to service_role;

-- Storage is server-only; use Storage API for object mutations, never SQL.
insert into storage.buckets(id,name,public,file_size_limit) values('pp-files','pp-files',false,3145728);

create function pp.pp_media_payload(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce((select jsonb_build_object('memory_id',id) from pp.memories where id=p_id and cardinality(attachment_ids)>0),'{}'::jsonb);
$$;
alter function pp.pp_answer(text,text,text) rename to pp_answer_text;
create function pp.pp_answer(p_question text,p_group text,p_sender text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb; m uuid;
begin
  r:=pp.pp_answer_text(p_question,p_group,p_sender);
  if r->>'decision'='answer' then
    select id into m from pp.memories where aliases @> array[p_question] and visibility='shareable' and (expires_at is null or expires_at>now());
    r:=r || pp.pp_media_payload(m);
  end if;
  return r;
end;
$$;
alter function pp.pp_ai_answer(uuid,text,text,text,text) rename to pp_ai_answer_text;
create function pp.pp_ai_answer(p_id uuid,p_revision text,p_question text,p_group text,p_sender text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
  r:=pp.pp_ai_answer_text(p_id,p_revision,p_question,p_group,p_sender);
  if r->>'decision'='answer' then r:=r || pp.pp_media_payload(p_id); end if;
  return r;
end;
$$;
alter function pp.pp_owner_answer(text,text,text,uuid) rename to pp_owner_answer_text;
create function pp.pp_owner_answer(p_question text,p_sender text,p_event text,p_lease uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb; m uuid;
begin
  r:=pp.pp_owner_answer_text(p_question,p_sender,p_event,p_lease);
  if r->>'decision'='answer' then
    select id into m from pp.memories where aliases @> array[p_question] and (expires_at is null or expires_at>now());
    r:=r || pp.pp_media_payload(m);
  end if;
  return r;
end;
$$;

create function pp.pp_claim_reminder(p_event uuid,p_occurs date,p_lead integer,p_target text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e pp.calendar_events; d pp.reminder_deliveries; today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  select * into e from pp.calendar_events where id=p_event and enabled;
  if not found or p_lead not in(0,1) or p_occurs-p_lead<>today
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
    values(p_event,p_occurs,p_lead,p_target,now()+interval '120 seconds')
    on conflict(event_id,occurs_on,lead_days,target) do update set lease_until=excluded.lease_until,
      attempts=pp.reminder_deliveries.attempts+1,status='processing',updated_at=now()
      where pp.reminder_deliveries.status in('failed','processing') and pp.reminder_deliveries.lease_until<now()
        and pp.reminder_deliveries.attempts<3 and pp.reminder_deliveries.created_at>now()-interval '23 hours'
    returning * into d;
  if d.id is null then return null; end if;
  return to_jsonb(d);
end;
$$;
revoke all on function pp.pp_media_payload(uuid),pp.pp_answer(text,text,text),pp.pp_ai_answer(uuid,text,text,text,text),pp.pp_owner_answer(text,text,text,uuid),pp.pp_claim_reminder(uuid,date,integer,text) from public,anon,authenticated;
grant execute on function pp.pp_media_payload(uuid),pp.pp_answer(text,text,text),pp.pp_ai_answer(uuid,text,text,text,text),pp.pp_owner_answer(text,text,text,uuid),pp.pp_claim_reminder(uuid,date,integer,text) to service_role;
notify pgrst,'reload schema';

create function pp.pp_search_memories(p_query text) returns setof pp.memories language sql stable security invoker set search_path='' as $$
  select * from pp.memories where length(p_query)<=120 and
    (p_query='' or strpos(lower(title || ' ' || content || ' ' || array_to_string(question_examples,' ')),lower(p_query))>0)
  order by updated_at desc limit 200;
$$;
revoke all on function pp.pp_search_memories(text) from public,anon,authenticated;
grant execute on function pp.pp_search_memories(text) to service_role;

-- Bound each daily run; the admin reports this limit instead of silently omitting events.
create function pp.pp_limit_calendar() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(20260930,100);
  if (select count(*) from pp.calendar_events)>=100 then raise exception 'PP_CALENDAR_LIMIT'; end if;
  return new;
end;
$$;
create trigger calendar_limit before insert on pp.calendar_events for each row execute function pp.pp_limit_calendar();
revoke all on function pp.pp_limit_calendar() from public,anon,authenticated;
grant execute on function pp.pp_limit_calendar() to service_role;

-- Retry bodies may include a private owner's message. Keep them server-only and short-lived.
alter function pp.pp_cleanup() rename to pp_cleanup_core;
create function pp.pp_cleanup() returns void language plpgsql security invoker set search_path='' as $$
begin
  perform pp.pp_cleanup_core();
  update pp.reminder_deliveries set payload=null where payload is not null and created_at<now()-interval '1 day';
  delete from pp.reminder_deliveries where created_at<now()-interval '90 days';
end;
$$;
revoke all on function pp.pp_cleanup() from public,anon,authenticated;
grant execute on function pp.pp_cleanup() to service_role;
notify pgrst,'reload schema';
