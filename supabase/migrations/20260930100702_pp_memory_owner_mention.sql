-- Explicit admin opt-in; plain @display names never become mentions automatically.
alter table pp.memories add column mention_owner boolean not null default false;

create or replace function pp.pp_answer(p_question text, p_group text, p_sender text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare answers integer; answer_text text; should_mention boolean;
begin
  if not exists(select 1 from pp.permissions where group_id = p_group and enabled)
    or not exists(select 1 from pp.friends where group_id = p_group and line_user_id = p_sender and not blocked)
  then return jsonb_build_object('decision', 'refuse'); end if;
  if exists(select 1 from pp.memories where aliases @> array[p_question] and visibility = 'private')
  then return jsonb_build_object('decision', 'refuse'); end if;
  select count(*), min(content), bool_or(mention_owner) into answers, answer_text, should_mention
    from pp.memories where aliases @> array[p_question] and visibility = 'shareable'
    and (expires_at is null or expires_at > now());
  if answers = 1 then
    return jsonb_build_object('decision', 'answer', 'answer', answer_text)
      || case when should_mention then jsonb_build_object('mention_owner', true) else '{}'::jsonb end;
  end if;
  if answers > 1 then return jsonb_build_object('decision', 'refuse'); end if;
  return jsonb_build_object('decision', 'unknown');
end;
$$;

create or replace function pp.pp_ai_answer(p_id uuid, p_revision text, p_question text, p_group text, p_sender text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare m pp.memories;
begin
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
  return jsonb_build_object('decision','answer','answer',m.content)
    || case when m.mention_owner then jsonb_build_object('mention_owner', true) else '{}'::jsonb end;
end;
$$;

-- Replacements retain grants; assert server-only access explicitly.
revoke all on function pp.pp_answer(text,text,text), pp.pp_ai_answer(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function pp.pp_answer(text,text,text), pp.pp_ai_answer(uuid,text,text,text,text) to service_role;
