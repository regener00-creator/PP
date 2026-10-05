-- All LINE direct chats may ask about shareable memories. Legacy private data
-- remains available only through the current owner's exact-match RPC.
create function pp.pp_direct_allowed(p_sender text,p_event text,p_lease uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce(p_sender ~ '^U[0-9a-fA-F]{32}$',false)
    and (exists(select 1 from pp.owner where id=1 and line_user_id=p_sender)
      or not exists(select 1 from pp.friends where line_user_id=p_sender and blocked))
    and exists(select 1 from pp.conversations where event_id=p_event and sender_id=p_sender
      and source_type='user' and group_id is null and lease_id=p_lease
      and status='processing' and lease_until>now());
$$;

create function pp.pp_claim_direct_event(p_event text,p_sender text,p_message text,p_lease uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare claimed text; existing pp.conversations;
begin
  if p_sender is null or p_sender !~ '^U[0-9a-fA-F]{32}$'
    or (not exists(select 1 from pp.owner where id=1 and line_user_id=p_sender)
      and exists(select 1 from pp.friends where line_user_id=p_sender and blocked))
  then return 'denied'; end if;
  insert into pp.conversations(event_id,group_id,source_type,sender_id,message_id,lease_id,lease_until)
    values(p_event,null,'user',p_sender,p_message,p_lease,now()+interval '90 seconds')
  on conflict(event_id) do update set lease_id=excluded.lease_id,lease_until=excluded.lease_until,
    status='processing',attempts=pp.conversations.attempts+1
    where pp.conversations.source_type='user' and pp.conversations.sender_id=excluded.sender_id
      and pp.conversations.status in ('failed','processing')
      and (pp.conversations.lease_until is null or pp.conversations.lease_until<now())
      and pp.conversations.attempts<3
  returning event_id into claimed;
  if claimed is not null then return 'claimed'; end if;
  select * into existing from pp.conversations where event_id=p_event;
  if existing.source_type<>'user' or existing.sender_id<>p_sender then return 'denied'; end if;
  if existing.status in ('replied','ignored','expired') or existing.attempts>=3 then return 'done'; end if;
  return 'busy';
end;
$$;

create function pp.pp_direct_answer(p_question text,p_sender text,p_event text,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare answers integer; m pp.memories;
begin
  if not pp.pp_direct_allowed(p_sender,p_event,p_lease) then return jsonb_build_object('decision','denied'); end if;
  if exists(select 1 from pp.owner where id=1 and line_user_id=p_sender)
  then return pp.pp_owner_answer(p_question,p_sender,p_event,p_lease); end if;
  if exists(select 1 from pp.memories where visibility='private' and aliases @> array[p_question])
  then return jsonb_build_object('decision','refuse'); end if;
  select count(*) into answers from pp.memories where visibility='shareable' and aliases @> array[p_question]
    and (expires_at is null or expires_at>now());
  if answers>1 then return jsonb_build_object('decision','ambiguous'); end if;
  if answers=0 then return jsonb_build_object('decision','unknown'); end if;
  select * into m from pp.memories where visibility='shareable' and aliases @> array[p_question]
    and (expires_at is null or expires_at>now());
  return jsonb_build_object('decision','answer','answer',m.content) || pp.pp_media_payload(m.id);
end;
$$;

create function pp.pp_direct_ai_candidates(p_sender text,p_event text,p_lease uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if not pp.pp_direct_allowed(p_sender,p_event,p_lease) then return jsonb_build_object('decision','denied'); end if;
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

create function pp.pp_direct_ai_answer(p_id uuid,p_revision text,p_question text,p_sender text,p_event text,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m pp.memories;
begin
  if not pp.pp_direct_allowed(p_sender,p_event,p_lease) then return jsonb_build_object('decision','denied'); end if;
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

revoke all on function pp.pp_direct_allowed(text,text,uuid),pp.pp_claim_direct_event(text,text,text,uuid),
  pp.pp_direct_answer(text,text,text,uuid),pp.pp_direct_ai_candidates(text,text,uuid),
  pp.pp_direct_ai_answer(uuid,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function pp.pp_direct_allowed(text,text,uuid),pp.pp_claim_direct_event(text,text,text,uuid),
  pp.pp_direct_answer(text,text,text,uuid),pp.pp_direct_ai_candidates(text,text,uuid),
  pp.pp_direct_ai_answer(uuid,text,text,text,text,uuid) to service_role;
notify pgrst,'reload schema';
