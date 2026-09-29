create schema pp;
revoke all on schema pp from public, anon, authenticated;
grant usage on schema pp to service_role;

-- PP V0.1. All Data API access is server-only; authenticated users have no table grants.
create table pp.owner (
  id smallint primary key default 1 check (id = 1),
  display_name text not null default 'ปีโป้' check (length(display_name) between 1 and 60),
  line_user_id text check (line_user_id ~ '^U[0-9a-fA-F]{32}$')
);
insert into pp.owner(id) values (1);

create table pp.permissions (
  group_id text primary key check (group_id ~ '^C[0-9a-fA-F]{32}$'),
  label text not null default '' check (length(label) <= 80),
  enabled boolean not null default false,
  allow_owner_mention boolean not null default true,
  created_at timestamptz not null default now()
);
create table pp.friends (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references pp.permissions(group_id) on delete cascade,
  line_user_id text not null check (line_user_id ~ '^U[0-9a-fA-F]{32}$'),
  display_name text not null default '' check (length(display_name) <= 80),
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  unique(group_id, line_user_id)
);
create table pp.memories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  content text not null check (length(content) between 1 and 2000),
  visibility text not null default 'private' check (visibility in ('private', 'shareable')),
  aliases text[] not null check (cardinality(aliases) between 1 and 30),
  question_examples text[] not null default '{}',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memories_aliases_gin on pp.memories using gin(aliases);
create table pp.conversations (
  event_id text primary key,
  group_id text not null references pp.permissions(group_id) on delete cascade,
  sender_id text not null,
  message_id text not null,
  status text not null default 'processing' check (status in ('processing', 'replied', 'ignored', 'failed', 'expired')),
  decision text,
  attempts integer not null default 1,
  lease_id uuid not null,
  lease_until timestamptz,
  created_at timestamptz not null default now()
);
create index conversations_created_at on pp.conversations(created_at);
create index conversations_group_id on pp.conversations(group_id);
create table pp.rate_limits (
  key text primary key,
  count integer not null,
  expires_at timestamptz not null
);
create index rate_limits_expiry on pp.rate_limits(expires_at);

alter table pp.owner enable row level security;
alter table pp.permissions enable row level security;
alter table pp.friends enable row level security;
alter table pp.memories enable row level security;
alter table pp.conversations enable row level security;
alter table pp.rate_limits enable row level security;
revoke all on pp.owner, pp.permissions, pp.friends, pp.memories, pp.conversations, pp.rate_limits from public, anon, authenticated;
grant select, insert, update, delete on pp.owner, pp.permissions, pp.friends, pp.memories, pp.conversations, pp.rate_limits to service_role;

-- SECURITY INVOKER: only the server service role can execute. Never returns a
-- private title, content, alias, identifier, count, or an indication it exists.
create function pp.pp_answer(p_question text, p_group text, p_sender text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare answers integer; answer_text text;
begin
  if not exists(select 1 from pp.permissions where group_id = p_group and enabled)
    or not exists(select 1 from pp.friends where group_id = p_group and line_user_id = p_sender and not blocked)
  then return jsonb_build_object('decision', 'refuse'); end if;
  if exists(select 1 from pp.memories where aliases @> array[p_question] and visibility = 'private')
  then return jsonb_build_object('decision', 'refuse'); end if;
  select count(*), min(content) into answers, answer_text
    from pp.memories where aliases @> array[p_question] and visibility = 'shareable'
    and (expires_at is null or expires_at > now());
  if answers = 1 then return jsonb_build_object('decision', 'answer', 'answer', answer_text); end if;
  if answers > 1 then return jsonb_build_object('decision', 'refuse'); end if;
  return jsonb_build_object('decision', 'unknown');
end;
$$;

-- Atomic lease prevents concurrent redeliveries from sending a second reply.
create function pp.pp_claim_event(p_event text, p_group text, p_sender text, p_message text, p_lease uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare claimed text; existing pp.conversations;
begin
  insert into pp.conversations(event_id, group_id, sender_id, message_id, lease_id, lease_until)
    values (p_event, p_group, p_sender, p_message, p_lease, now() + interval '90 seconds')
  on conflict (event_id) do update set lease_id = excluded.lease_id,
    lease_until = excluded.lease_until, status = 'processing', attempts = pp.conversations.attempts + 1
    where pp.conversations.status in ('failed', 'processing')
      and (pp.conversations.lease_until is null or pp.conversations.lease_until < now())
      and pp.conversations.attempts < 3
  returning event_id into claimed;
  if claimed is not null then return 'claimed'; end if;
  select * into existing from pp.conversations where event_id = p_event;
  if existing.status in ('replied', 'ignored', 'expired') or existing.attempts >= 3 then return 'done'; end if;
  return 'busy';
end;
$$;

create function pp.pp_take_rate(p_key text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare current_count integer;
begin
  if p_limit < 1 or p_seconds < 1 or p_seconds > 3600 then return false; end if;
  insert into pp.rate_limits(key, count, expires_at)
    values (p_key, 1, now() + make_interval(secs => p_seconds))
  on conflict (key) do update set
    count = case when pp.rate_limits.expires_at <= now() then 1 else pp.rate_limits.count + 1 end,
    expires_at = case when pp.rate_limits.expires_at <= now() then excluded.expires_at else pp.rate_limits.expires_at end
  returning count into current_count;
  return current_count <= p_limit;
end;
$$;

create function pp.pp_cleanup() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from pp.conversations where created_at < now() - interval '30 days';
  delete from pp.rate_limits where expires_at < now() - interval '1 day';
end;
$$;
revoke all on function pp.pp_answer(text,text,text), pp.pp_claim_event(text,text,text,text,uuid), pp.pp_take_rate(text,integer,integer), pp.pp_cleanup() from public, anon, authenticated;
grant execute on function pp.pp_answer(text,text,text), pp.pp_claim_event(text,text,text,text,uuid), pp.pp_take_rate(text,integer,integer), pp.pp_cleanup() to service_role;
