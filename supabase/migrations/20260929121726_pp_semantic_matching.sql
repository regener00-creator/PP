-- Server-only semantic retrieval. No private row or answer is sent to a model.
create table pp.ai_usage (
  month date primary key,
  calls integer not null check (calls between 0 and 1000)
);
alter table pp.ai_usage enable row level security;
revoke all on pp.ai_usage from public, anon, authenticated;
grant select, insert, update on pp.ai_usage to service_role;

create function pp.pp_ai_candidates(p_group text, p_sender text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'revision', md5(row_to_json(m)::text), 'questions', m.question_examples
  )), '[]'::jsonb)
  from (
    select m.* from pp.memories m
    where m.visibility = 'shareable' and (m.expires_at is null or m.expires_at > now())
      and cardinality(m.question_examples) > 0
      and exists(select 1 from pp.permissions where group_id = p_group and enabled)
      and exists(select 1 from pp.friends where group_id = p_group and line_user_id = p_sender and not blocked)
      and not exists(select 1 from pp.memories p where p.visibility = 'private' and p.aliases && m.aliases)
    order by m.id limit 41 -- application refuses >40, never silently truncates
  ) m;
$$;

create function pp.pp_ai_answer(p_id uuid, p_revision text, p_question text, p_group text, p_sender text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare m pp.memories;
begin
  -- Repeat the privacy and permission checks after the remote model call.
  if not exists(select 1 from pp.permissions where group_id = p_group and enabled)
    or not exists(select 1 from pp.friends where group_id = p_group and line_user_id = p_sender and not blocked)
    or exists(select 1 from pp.memories where visibility = 'private' and aliases @> array[p_question])
  then return jsonb_build_object('decision','refuse'); end if;
  select * into m from pp.memories where id = p_id and visibility = 'shareable'
    and (expires_at is null or expires_at > now());
  if not found or md5(row_to_json(m)::text) <> p_revision
  then return jsonb_build_object('decision','unknown'); end if;
  if exists(select 1 from pp.memories p where p.id <> m.id and p.aliases && m.aliases
    and (p.visibility = 'private' or p.expires_at is null or p.expires_at > now()))
  then return jsonb_build_object('decision','refuse'); end if;
  return jsonb_build_object('decision','answer','answer',m.content);
end;
$$;

-- Atomic shared cap across instances/groups. Failed/timed-out calls still consume a slot.
-- Bangkok calendar months, no accumulation. Hard maximum 1000; env may lower it.
create function pp.pp_reserve_ai(p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare reserved integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then return false; end if;
  insert into pp.ai_usage(month,calls)
    values (date_trunc('month', now() at time zone 'Asia/Bangkok')::date,1)
  on conflict(month) do update set calls = pp.ai_usage.calls + 1
    where pp.ai_usage.calls < p_limit
  returning calls into reserved;
  return reserved is not null;
end;
$$;
revoke all on function pp.pp_ai_candidates(text,text), pp.pp_ai_answer(uuid,text,text,text,text), pp.pp_reserve_ai(integer) from public, anon, authenticated;
grant execute on function pp.pp_ai_candidates(text,text), pp.pp_ai_answer(uuid,text,text,text,text), pp.pp_reserve_ai(integer) to service_role;
