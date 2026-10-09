-- Additive secretary notebook. Manual memories, personal calendar, and retired
-- planner records are untouched. All APIs are server-only SECURITY INVOKER.
create table pp.assistant_turns (
 id uuid primary key, scope_key text not null, sender_id text not null,
 request text not null check(length(request) between 1 and 2000),
 confirmation_id uuid unique,
 reply text not null check(length(reply) between 1 and 4000), proposal jsonb,
 status text not null check(status in ('complete','proposed','saved','cancelled')),
 expires_at timestamptz not null, created_at timestamptz not null default now(),
 check(scope_key ~ '^[UC][0-9a-fA-F]{32}$' or scope_key ~ '^admin:[0-9a-f-]{36}$'),
 check(sender_id ~ '^U[0-9a-fA-F]{32}$' or sender_id ~ '^admin:[0-9a-f-]{36}$')
);
create index assistant_turns_thread on pp.assistant_turns(scope_key,sender_id,created_at desc);
create table pp.assistant_notes (
 id uuid primary key, scope_key text not null, sender_id text not null,
 title text not null check(length(title) between 1 and 120),
 content text not null check(length(content) between 1 and 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index assistant_notes_scope on pp.assistant_notes(scope_key);
create table pp.assistant_events (
 id uuid primary key, scope_key text not null, sender_id text not null,
 title text not null check(length(title) between 1 and 120),
 content text not null check(length(content) between 1 and 1500),
 event_date date not null, annual boolean not null default false,
 remind_before boolean not null default false, enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(scope_key ~ '^[UC][0-9a-fA-F]{32}$')
);
create index assistant_events_scope on pp.assistant_events(scope_key,event_date);
create table pp.assistant_deliveries (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references pp.assistant_events(id) on delete cascade,
 occurs_on date not null, lead_days integer not null check(lead_days in (0,1)),
 status text not null default 'processing' check(status in ('processing','sent','failed','skipped')),
 retry_key uuid not null default gen_random_uuid(), attempts integer not null default 1,
 lease_until timestamptz not null, payload jsonb not null, reason text,
 created_at timestamptz not null default now(), unique(event_id,occurs_on,lead_days)
);
alter table pp.assistant_turns enable row level security;
alter table pp.assistant_notes enable row level security;
alter table pp.assistant_events enable row level security;
alter table pp.assistant_deliveries enable row level security;
revoke all on pp.assistant_turns,pp.assistant_notes,pp.assistant_events,pp.assistant_deliveries from public,anon,authenticated;
grant select,insert,update,delete on pp.assistant_turns,pp.assistant_notes,pp.assistant_events,pp.assistant_deliveries to service_role;

create function pp.pp_assistant_allowed(p_scope text,p_sender text) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce(
 case when p_scope like 'C%' then
  exists(select 1 from pp.permissions where group_id=p_scope and enabled)
  and (exists(select 1 from pp.friends where group_id=p_scope and line_user_id=p_sender and not blocked)
    or exists(select 1 from pp.owner where id=1 and line_user_id=p_sender))
 else p_scope=p_sender and (p_sender ~ '^admin:[0-9a-f-]{36}$' or
   (p_sender ~ '^U[0-9a-fA-F]{32}$' and (exists(select 1 from pp.owner where id=1 and line_user_id=p_sender)
     or not exists(select 1 from pp.friends where line_user_id=p_sender and blocked)))) end,false);
$$;
create function pp.pp_confirm_assistant(p_id uuid,p_scope text,p_sender text,p_confirmation uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t pp.assistant_turns; p jsonb; k text;
begin
 if not pp.pp_assistant_allowed(p_scope,p_sender) then return jsonb_build_object('decision','denied'); end if;
 perform pg_advisory_xact_lock(hashtextextended('assistant:'||p_scope,0));
 if p_confirmation is not null then
  select * into t from pp.assistant_turns where confirmation_id=p_confirmation and scope_key=p_scope and sender_id=p_sender and status='saved';
  if found then return jsonb_build_object('decision','saved','kind',t.proposal->>'kind'); end if;
 end if;
 select * into t from pp.assistant_turns where id=p_id and scope_key=p_scope and sender_id=p_sender for update;
 if not found then return jsonb_build_object('decision','denied'); end if;
 if t.status='saved' then return jsonb_build_object('decision','saved','kind',t.proposal->>'kind'); end if;
 if t.status<>'proposed' or t.expires_at<=now() then return jsonb_build_object('decision','expired'); end if;
 p:=t.proposal; k:=p->>'kind';
 if k='remember' then
  if (select count(*) from pp.assistant_notes where scope_key=p_scope)>=200 then return jsonb_build_object('decision','limit'); end if;
  insert into pp.assistant_notes(id,scope_key,sender_id,title,content) values(t.id,p_scope,p_sender,p->>'title',p->>'content');
 elsif k='event' then
  if p_scope !~ '^[UC][0-9a-fA-F]{32}$' or (not (p->>'annual')::boolean and (p->>'date')::date < (now() at time zone 'Asia/Bangkok')::date) then return jsonb_build_object('decision','expired'); end if;
  if (select count(*) from pp.assistant_events where scope_key=p_scope)>=100 then return jsonb_build_object('decision','limit'); end if;
  insert into pp.assistant_events(id,scope_key,sender_id,title,content,event_date,annual,remind_before)
   values(t.id,p_scope,p_sender,p->>'title',p->>'content',(p->>'date')::date,(p->>'annual')::boolean,(p->>'before')::boolean);
 else return jsonb_build_object('decision','denied'); end if;
 update pp.assistant_turns set status='saved',confirmation_id=p_confirmation where id=t.id;
 -- Supersede older drafts in the same caller's thread.
 update pp.assistant_turns set status='cancelled' where scope_key=p_scope and sender_id=p_sender and status='proposed' and id<>t.id;
 return jsonb_build_object('decision','saved','kind',k);
end;
$$;
create function pp.pp_claim_assistant_reminder(p_event uuid,p_occurs date,p_lead integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e pp.assistant_events; d pp.assistant_deliveries; today date := (now() at time zone 'Asia/Bangkok')::date;
begin
 select * into e from pp.assistant_events where id=p_event and enabled;
 if not found or not pp.pp_assistant_allowed(e.scope_key,e.sender_id) or p_lead not in (0,1)
  or (p_lead=1 and not e.remind_before) or p_occurs<>today+p_lead or p_occurs<e.event_date
  or (case when e.annual then to_char(e.event_date,'MM-DD')<>to_char(p_occurs,'MM-DD') else e.event_date<>p_occurs end)
 then return null; end if;
 insert into pp.assistant_deliveries(event_id,occurs_on,lead_days,lease_until,payload)
 values(e.id,p_occurs,p_lead,now()+interval '90 seconds',jsonb_build_array(jsonb_build_object('type','text','text',
  (case when p_lead=1 then 'เตือนล่วงหน้า 1 วัน · ' else '' end)||e.title||E'\n'||e.content)))
 on conflict(event_id,occurs_on,lead_days) do update set status='processing',attempts=pp.assistant_deliveries.attempts+1,lease_until=now()+interval '90 seconds'
  where pp.assistant_deliveries.status in ('processing','failed') and pp.assistant_deliveries.lease_until<now() and pp.assistant_deliveries.attempts<3
 returning * into d;
 if not found then return null; end if;
 return to_jsonb(d);
end;
$$;
create function pp.pp_cleanup_assistant() returns void language sql security invoker set search_path='' as $$
 delete from pp.assistant_turns where created_at<now()-interval '30 days';
 delete from pp.assistant_deliveries where created_at<now()-interval '90 days';
$$;
revoke all on function pp.pp_assistant_allowed(text,text),pp.pp_confirm_assistant(uuid,text,text,uuid),pp.pp_claim_assistant_reminder(uuid,date,integer),pp.pp_cleanup_assistant() from public,anon,authenticated;
grant execute on function pp.pp_assistant_allowed(text,text),pp.pp_confirm_assistant(uuid,text,text,uuid),pp.pp_claim_assistant_reminder(uuid,date,integer),pp.pp_cleanup_assistant() to service_role;
notify pgrst,'reload schema';
