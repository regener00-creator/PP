-- Owner DM semantic matching has its own authorization; never simulate a group.
-- The model receives only shareable question examples, never answers or legacy private rows.
create function pp.pp_owner_ai_candidates(p_sender text,p_event text,p_lease uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if not exists(select 1 from pp.owner where id=1 and line_user_id=p_sender)
    or not exists(select 1 from pp.conversations where event_id=p_event and sender_id=p_sender
      and source_type='user' and group_id is null and lease_id=p_lease
      and status='processing' and lease_until>now())
  then return jsonb_build_object('decision','denied'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'revision',md5(row_to_json(m)::text),'questions',m.question_examples
  )),'[]'::jsonb) from (
    select m.* from pp.memories m where m.visibility='shareable'
      and (m.expires_at is null or m.expires_at>now()) and cardinality(m.question_examples)>0
      and not exists(select 1 from pp.memories p where p.visibility='private' and p.aliases && m.aliases)
    order by m.id limit 41
  ) m);
end;
$$;

create function pp.pp_owner_ai_answer(p_id uuid,p_revision text,p_question text,p_sender text,p_event text,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m pp.memories;
begin
  -- Repeat identity, lease and memory checks after the external model call.
  if not exists(select 1 from pp.owner where id=1 and line_user_id=p_sender)
    or not exists(select 1 from pp.conversations where event_id=p_event and sender_id=p_sender
      and source_type='user' and group_id is null and lease_id=p_lease
      and status='processing' and lease_until>now())
  then return jsonb_build_object('decision','denied'); end if;
  if exists(select 1 from pp.memories where visibility='private' and aliases @> array[p_question])
  then return jsonb_build_object('decision','refuse'); end if;
  select * into m from pp.memories where id=p_id and visibility='shareable'
    and (expires_at is null or expires_at>now()) and cardinality(question_examples)>0;
  if not found or p_revision is distinct from md5(row_to_json(m)::text)
  then return jsonb_build_object('decision','unknown'); end if;
  if exists(select 1 from pp.memories p where p.id<>m.id and p.aliases && m.aliases
    and (p.visibility='private' or p.expires_at is null or p.expires_at>now()))
  then return jsonb_build_object('decision','refuse'); end if;
  return jsonb_build_object('decision','answer','answer',m.content) || pp.pp_media_payload(m.id);
end;
$$;

revoke all on function pp.pp_owner_ai_candidates(text,text,uuid),pp.pp_owner_ai_answer(uuid,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function pp.pp_owner_ai_candidates(text,text,uuid),pp.pp_owner_ai_answer(uuid,text,text,text,text,uuid) to service_role;
notify pgrst,'reload schema';
