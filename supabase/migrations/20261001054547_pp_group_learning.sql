-- Group learning is opt-in. Drafts never participate in bot answers.
alter table pp.permissions add column learning_enabled boolean not null default false;
alter table pp.permissions add column learning_started_at timestamptz;
alter table pp.friends add column learning_opt_out boolean not null default false;
alter table pp.friends add column learning_started_at timestamptz not null default 'epoch';

create table pp.learning_runs (
  id uuid primary key default gen_random_uuid(),
  window_start timestamptz not null unique,
  month date not null,
  group_id text not null,
  status text not null default 'processing' check(status in ('processing','done','failed','cancelled')),
  message_count integer not null default 0,
  suggestion_count integer not null default 0,
  input_tokens integer not null default 10000,
  output_tokens integer not null default 1000,
  estimated_usd numeric(12,6) not null default 0.0055,
  created_at timestamptz not null default now()
);
create index learning_runs_month on pp.learning_runs(month);
create table pp.learning_messages (
  event_id text primary key,
  message_id text not null,
  group_id text not null references pp.permissions(group_id) on delete cascade,
  sender_id text not null,
  body text not null check(length(body) between 2 and 500),
  sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  run_id uuid references pp.learning_runs(id) on delete set null,
  processed_at timestamptz,
  unique(group_id,message_id)
);
create index learning_messages_queue on pp.learning_messages(group_id,created_at) where processed_at is null;
create index learning_messages_retention on pp.learning_messages(created_at);
-- Tombstones prevent late LINE redelivery from restoring unsent messages.
create table pp.learning_unsent (
  group_id text not null references pp.permissions(group_id) on delete cascade,
  message_id text not null,
  created_at timestamptz not null default now(),
  primary key(group_id,message_id)
);
create table pp.learning_suggestions (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references pp.permissions(group_id) on delete cascade,
  sender_id text not null,
  title text not null check(length(title) between 1 and 120),
  content text not null check(length(content) between 1 and 1000),
  question_examples text[] not null check(cardinality(question_examples) between 1 and 5),
  aliases text[] not null check(cardinality(aliases) between 1 and 5),
  category text not null check(category in ('preference','nickname','communication_style')),
  evidence jsonb not null check(jsonb_typeof(evidence)='array' and jsonb_array_length(evidence) between 1 and 3),
  source_message_ids text[] not null,
  status text not null default 'pending' check(status in ('pending','approved')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '90 days'
);
create unique index learning_suggestions_dedup on pp.learning_suggestions(group_id,sender_id,md5(lower(content)));
create index learning_suggestions_review on pp.learning_suggestions(group_id,status,created_at desc);
create index learning_suggestions_sources on pp.learning_suggestions using gin(source_message_ids);
alter table pp.learning_runs enable row level security;
alter table pp.learning_messages enable row level security;
alter table pp.learning_suggestions enable row level security;
alter table pp.learning_unsent enable row level security;
revoke all on pp.learning_runs,pp.learning_messages,pp.learning_suggestions,pp.learning_unsent from public,anon,authenticated;
grant select,insert,update,delete on pp.learning_runs,pp.learning_messages,pp.learning_suggestions,pp.learning_unsent to service_role;

-- Call only for signed group text events, after the application sensitivity filter.
create function pp.pp_capture_learning(p_group text,p_sender text,p_event text,p_message text,p_text text,p_sent timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare g pp.permissions; captured text;
begin
  select * into g from pp.permissions where group_id=p_group for update;
  if not found or not g.enabled or not g.learning_enabled or g.learning_started_at is null
    or p_sent<g.learning_started_at or p_sent<now()-interval '7 days' or p_sent>now()+interval '5 minutes'
    or p_text is null or p_sent is null or length(p_text) not between 2 and 500
    or p_sender !~ '^U[0-9a-f]{32}$' or length(p_event) not between 1 and 200 or length(p_message) not between 1 and 100
  then return false; end if;
  insert into pp.friends(group_id,line_user_id) values(p_group,p_sender) on conflict(group_id,line_user_id) do nothing;
  if exists(select 1 from pp.learning_unsent where group_id=p_group and message_id=p_message)
    or not exists(select 1 from pp.friends where group_id=p_group and line_user_id=p_sender and not blocked and not learning_opt_out and p_sent>=learning_started_at)
    or (select count(*) from pp.learning_messages where group_id=p_group and created_at>=date_trunc('day',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok')>=100
    or (select count(*) from pp.learning_messages)>=5000
  then return false; end if;
  insert into pp.learning_messages(event_id,message_id,group_id,sender_id,body,sent_at)
    values(p_event,p_message,p_group,p_sender,p_text,p_sent) on conflict do nothing returning event_id into captured;
  return captured is not null;
end;
$$;

-- A single reservation per six-hour Bangkok window, across all instances/groups.
-- Failed calls consume the slot too; monthly cap is separate from question matching.
create function pp.pp_claim_learning() returns jsonb language plpgsql security invoker set search_path='' as $$
declare local_now timestamp := now() at time zone 'Asia/Bangkok'; slot timestamptz;
  month_start date; chosen text; run uuid; selected_ids text[]; messages jsonb;
begin
  if not pg_try_advisory_xact_lock(20261001,44) then return jsonb_build_object('reason','waiting'); end if;
  update pp.learning_runs set status='failed' where status='processing' and created_at<now()-interval '90 seconds';
  slot := (date_trunc('day',local_now)+floor(extract(hour from local_now)/6)*interval '6 hours') at time zone 'Asia/Bangkok';
  month_start:=date_trunc('month',local_now)::date;
  if exists(select 1 from pp.learning_runs where window_start=slot) then return jsonb_build_object('reason','waiting'); end if;
  if (select count(*) from pp.learning_runs where month=month_start)>=120 then return jsonb_build_object('reason','limit'); end if;
  select m.group_id into chosen from pp.learning_messages m
    join pp.permissions g on g.group_id=m.group_id and g.enabled and g.learning_enabled
    join pp.friends f on f.group_id=m.group_id and f.line_user_id=m.sender_id and not f.blocked and not f.learning_opt_out
    left join pp.learning_runs r on r.id=m.run_id
    where m.processed_at is null and m.created_at>now()-interval '7 days'
      and (m.run_id is null or r.status='failed' or (r.status='processing' and r.created_at<now()-interval '90 seconds'))
      and (select count(*) from pp.learning_suggestions where group_id=m.group_id)<200
    order by m.created_at,m.event_id limit 1;
  if chosen is null then return jsonb_build_object('reason','empty'); end if;
  -- Lock consent until claiming finishes. Finish/retrieval recheck it after AI.
  perform 1 from pp.permissions where group_id=chosen and enabled and learning_enabled for share;
  if not found then return jsonb_build_object('reason','empty'); end if;
  with eligible as (
    select m.*,sum(octet_length(m.body)+500) over(order by m.created_at,m.event_id) as bytes
      from pp.learning_messages m join pp.friends f on f.group_id=m.group_id and f.line_user_id=m.sender_id
      left join pp.learning_runs r on r.id=m.run_id
      where m.group_id=chosen and not f.blocked and not f.learning_opt_out and m.processed_at is null
        and m.created_at>now()-interval '7 days'
        and (m.run_id is null or r.status='failed' or (r.status='processing' and r.created_at<now()-interval '90 seconds'))
  ) select array_agg(event_id order by created_at,event_id) into selected_ids
      from (select * from eligible where bytes<=6000 order by created_at,event_id limit 20) batch;
  if selected_ids is null then return jsonb_build_object('reason','empty'); end if;
  insert into pp.learning_runs(window_start,month,group_id,message_count) values(slot,month_start,chosen,cardinality(selected_ids)) returning id into run;
  update pp.learning_messages set run_id=run where event_id=any(selected_ids);
  select jsonb_agg(jsonb_build_object('event_id',m.event_id,'message_id',m.message_id,'sender_id',m.sender_id,
    'text',m.body,'sent_at',m.sent_at,'name',f.display_name) order by m.created_at,m.event_id) into messages
    from pp.learning_messages m join pp.friends f on f.group_id=m.group_id and f.line_user_id=m.sender_id where m.run_id=run;
  return jsonb_build_object('reason','claimed','run_id',run,'group_id',chosen,'messages',messages);
end;
$$;

create function pp.pp_finish_learning(p_run uuid,p_items jsonb,p_input integer,p_output integer,p_failed boolean)
returns integer language plpgsql security invoker set search_path='' as $$
declare r pp.learning_runs; item jsonb; proof jsonb; source_ids text[]; sender text; added integer:=0; affected integer;
begin
  select * into r from pp.learning_runs where id=p_run for update;
  if not found or r.status<>'processing' or r.created_at<now()-interval '90 seconds' then return 0; end if;
  if p_input is null or p_output is null or p_input<0 or p_output<0 then raise exception 'PP_INVALID_USAGE'; end if;
  update pp.learning_runs set input_tokens=p_input,output_tokens=p_output,
    estimated_usd=(p_input*0.30+p_output*2.50)/1000000 where id=p_run;
  if p_failed then update pp.learning_runs set status='failed' where id=p_run; return 0; end if;
  perform 1 from pp.permissions where group_id=r.group_id and enabled and learning_enabled for share;
  if not found then update pp.learning_runs set status='cancelled' where id=p_run; return 0; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>5 then raise exception 'PP_INVALID_SUGGESTIONS'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    sender:=item->>'sender_id';
    perform 1 from pp.friends where group_id=r.group_id and line_user_id=sender and not blocked and not learning_opt_out for share;
    if not found then continue; end if;
    if jsonb_typeof(item->'source_message_ids')<>'array' or jsonb_array_length(item->'source_message_ids') not between 1 and 3
      or jsonb_typeof(item->'questions')<>'array' or jsonb_array_length(item->'questions') not between 1 and 5
      or jsonb_typeof(item->'aliases')<>'array' or jsonb_array_length(item->'aliases') not between 1 and 5
    then raise exception 'PP_INVALID_SUGGESTIONS'; end if;
    select array_agg(distinct value) into source_ids from jsonb_array_elements_text(item->'source_message_ids');
    select jsonb_agg(jsonb_build_object('message_id',message_id,'text',body,'sent_at',sent_at) order by sent_at) into proof
      from pp.learning_messages where run_id=p_run and group_id=r.group_id and sender_id=sender and message_id=any(source_ids);
    -- An unsent/deleted source or cross-person attribution invalidates this draft.
    if proof is null or jsonb_array_length(proof)<>cardinality(source_ids) then continue; end if;
    if (select count(*) from pp.learning_suggestions where group_id=r.group_id)>=200 then exit; end if;
    insert into pp.learning_suggestions(group_id,sender_id,title,content,question_examples,aliases,category,evidence,source_message_ids)
      values(r.group_id,sender,item->>'title',item->>'content',array(select jsonb_array_elements_text(item->'questions')),
        array(select jsonb_array_elements_text(item->'aliases')),item->>'category',proof,source_ids) on conflict do nothing;
    get diagnostics affected=row_count; added:=added+affected;
  end loop;
  update pp.learning_messages set processed_at=now() where run_id=p_run;
  update pp.learning_runs set status='done',suggestion_count=added where id=p_run;
  return added;
end;
$$;

create function pp.pp_set_learning_group(p_group text,p_enabled boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  update pp.permissions set learning_started_at=case when p_enabled and not learning_enabled then now() else learning_started_at end,
    learning_enabled=p_enabled where group_id=p_group and (not p_enabled or enabled);
  if not found then return false; end if;
  if not p_enabled then
    delete from pp.learning_messages where group_id=p_group;
    delete from pp.learning_suggestions where group_id=p_group and status='pending';
  end if;
  return true;
end;
$$;
create function pp.pp_set_learning_friend(p_group text,p_sender text,p_excluded boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from pp.permissions where group_id=p_group for share;
  if not found then return false; end if;
  update pp.friends set learning_started_at=case when not p_excluded and learning_opt_out then now() else learning_started_at end,
    learning_opt_out=p_excluded where group_id=p_group and line_user_id=p_sender;
  if not found then return false; end if;
  if p_excluded then
    delete from pp.learning_messages where group_id=p_group and sender_id=p_sender;
    delete from pp.learning_suggestions where group_id=p_group and sender_id=p_sender;
  end if;
  return true;
end;
$$;
create function pp.pp_unsend_learning(p_group text,p_message text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from pp.permissions where group_id=p_group for update;
  if not found then return; end if;
  insert into pp.learning_unsent(group_id,message_id) values(p_group,p_message) on conflict do nothing;
  delete from pp.learning_messages where group_id=p_group and message_id=p_message;
  delete from pp.learning_suggestions where group_id=p_group and source_message_ids @> array[p_message];
end;
$$;
create function pp.pp_review_learning(p_id uuid,p_title text,p_content text,p_questions text[],p_aliases text[])
returns boolean language plpgsql security invoker set search_path='' as $$
declare s pp.learning_suggestions;
begin
  select * into s from pp.learning_suggestions where id=p_id;
  if not found or s.expires_at<=now() then return false; end if;
  perform 1 from pp.permissions where group_id=s.group_id and enabled and learning_enabled for share;
  if not found then return false; end if;
  perform 1 from pp.friends where group_id=s.group_id and line_user_id=s.sender_id and not blocked and not learning_opt_out for share;
  if not found then return false; end if;
  perform 1 from pp.learning_suggestions where id=p_id and expires_at>now() for update;
  if not found then return false; end if;
  if exists(select 1 from pp.memories where visibility='private' and aliases && p_aliases) then return false; end if;
  update pp.learning_suggestions set title=p_title,content=p_content,question_examples=p_questions,aliases=p_aliases,
    status='approved',approved_at=coalesce(approved_at,now()),updated_at=now() where id=p_id;
  return true;
end;
$$;

-- Only approved, unexpired facts from this exact group can enter retrieval.
create function pp.pp_group_answer_rows(p_group text)
returns table(id uuid,content text,aliases text[],question_examples text[],mention_owner boolean,revision text)
language sql stable security invoker set search_path='' as $$
  select m.id,m.content,m.aliases,m.question_examples,m.mention_owner,md5(row_to_json(m)::text)
    from pp.memories m where m.visibility='shareable' and (m.expires_at is null or m.expires_at>now())
  union all
  select s.id,s.content,s.aliases,s.question_examples,false,md5(row_to_json(s)::text)
    from pp.learning_suggestions s join pp.permissions g on g.group_id=s.group_id and g.enabled and g.learning_enabled
    join pp.friends f on f.group_id=s.group_id and f.line_user_id=s.sender_id and not f.blocked and not f.learning_opt_out
    where s.group_id=p_group and s.status='approved' and s.expires_at>now();
$$;
create or replace function pp.pp_answer_text(p_question text,p_group text,p_sender text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare answers integer; answer_text text; should_mention boolean;
begin
  if not exists(select 1 from pp.permissions where group_id=p_group and enabled)
    or not exists(select 1 from pp.friends where group_id=p_group and line_user_id=p_sender and not blocked)
    or exists(select 1 from pp.memories where visibility='private' and aliases @> array[p_question])
  then return jsonb_build_object('decision','refuse'); end if;
  select count(*),min(content),bool_or(mention_owner) into answers,answer_text,should_mention
    from pp.pp_group_answer_rows(p_group) where aliases @> array[p_question];
  if answers=1 then return jsonb_build_object('decision','answer','answer',answer_text)
    || case when should_mention then jsonb_build_object('mention_owner',true) else '{}'::jsonb end; end if;
  return jsonb_build_object('decision',case when answers>1 then 'refuse' else 'unknown' end);
end;
$$;
create or replace function pp.pp_ai_candidates(p_group text,p_sender text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'revision',m.revision,'questions',m.question_examples)),'[]'::jsonb)
  from (select m.* from pp.pp_group_answer_rows(p_group) m where cardinality(m.question_examples)>0
    and exists(select 1 from pp.permissions where group_id=p_group and enabled)
    and exists(select 1 from pp.friends where group_id=p_group and line_user_id=p_sender and not blocked)
    and not exists(select 1 from pp.memories p where p.visibility='private' and p.aliases && m.aliases)
    order by m.id limit 41) m;
$$;
create or replace function pp.pp_ai_answer_text(p_id uuid,p_revision text,p_question text,p_group text,p_sender text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m record;
begin
  if not exists(select 1 from pp.permissions where group_id=p_group and enabled)
    or not exists(select 1 from pp.friends where group_id=p_group and line_user_id=p_sender and not blocked)
    or exists(select 1 from pp.memories where visibility='private' and aliases @> array[p_question])
  then return jsonb_build_object('decision','refuse'); end if;
  select * into m from pp.pp_group_answer_rows(p_group) where id=p_id;
  if not found or m.revision<>p_revision then return jsonb_build_object('decision','unknown'); end if;
  if exists(select 1 from pp.pp_group_answer_rows(p_group) p where p.id<>m.id and p.aliases && m.aliases)
    or exists(select 1 from pp.memories p where p.visibility='private' and p.aliases && m.aliases)
  then return jsonb_build_object('decision','refuse'); end if;
  return jsonb_build_object('decision','answer','answer',m.content)
    || case when m.mention_owner then jsonb_build_object('mention_owner',true) else '{}'::jsonb end;
end;
$$;

alter function pp.pp_cleanup() rename to pp_cleanup_before_learning;
create function pp.pp_cleanup() returns void language plpgsql security invoker set search_path='' as $$
begin
  perform pp.pp_cleanup_before_learning();
  delete from pp.learning_messages where created_at<now()-interval '7 days';
  delete from pp.learning_unsent where created_at<now()-interval '7 days';
  delete from pp.learning_suggestions where expires_at<=now() or (status='pending' and created_at<now()-interval '30 days');
  delete from pp.learning_runs where created_at<now()-interval '1 year';
end;
$$;
revoke all on function pp.pp_capture_learning(text,text,text,text,text,timestamptz),pp.pp_claim_learning(),
  pp.pp_finish_learning(uuid,jsonb,integer,integer,boolean),pp.pp_set_learning_group(text,boolean),
  pp.pp_set_learning_friend(text,text,boolean),pp.pp_unsend_learning(text,text),
  pp.pp_review_learning(uuid,text,text,text[],text[]),pp.pp_group_answer_rows(text),pp.pp_cleanup() from public,anon,authenticated;
grant execute on function pp.pp_capture_learning(text,text,text,text,text,timestamptz),pp.pp_claim_learning(),
  pp.pp_finish_learning(uuid,jsonb,integer,integer,boolean),pp.pp_set_learning_group(text,boolean),
  pp.pp_set_learning_friend(text,text,boolean),pp.pp_unsend_learning(text,text),
  pp.pp_review_learning(uuid,text,text,text[],text[]),pp.pp_group_answer_rows(text),pp.pp_cleanup() to service_role;
notify pgrst,'reload schema';
