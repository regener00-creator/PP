-- Direct owner chats share the existing lease, deduplication and 30-day cleanup.
alter table pp.conversations alter column group_id drop not null;
alter table pp.conversations add column source_type text not null default 'group'
  check (source_type in ('group', 'user'));
alter table pp.conversations add constraint conversations_source_scope check (
  (source_type = 'group' and group_id is not null) or
  (source_type = 'user' and group_id is null)
);

create function pp.pp_claim_owner_event(p_event text, p_sender text, p_message text, p_lease uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare claimed text; existing pp.conversations;
begin
  if not exists(select 1 from pp.owner where id=1 and line_user_id=p_sender)
  then return 'denied'; end if;
  insert into pp.conversations(event_id, group_id, source_type, sender_id, message_id, lease_id, lease_until)
    values (p_event, null, 'user', p_sender, p_message, p_lease, now() + interval '90 seconds')
  on conflict (event_id) do update set lease_id=excluded.lease_id,
    lease_until=excluded.lease_until, status='processing', attempts=pp.conversations.attempts+1
    where pp.conversations.source_type='user' and pp.conversations.sender_id=excluded.sender_id
      and pp.conversations.status in ('failed','processing')
      and (pp.conversations.lease_until is null or pp.conversations.lease_until < now())
      and pp.conversations.attempts < 3
  returning event_id into claimed;
  if claimed is not null then return 'claimed'; end if;
  select * into existing from pp.conversations where event_id=p_event;
  if existing.source_type <> 'user' or existing.sender_id <> p_sender then return 'denied'; end if;
  if existing.status in ('replied','ignored','expired') or existing.attempts >= 3 then return 'done'; end if;
  return 'busy';
end;
$$;

-- The owner ID and an active direct-chat lease are both required. The group RPCs
-- retain their private veto, even when the sender happens to be the owner.
create function pp.pp_owner_answer(p_question text, p_sender text, p_event text, p_lease uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare answers integer; answer_text text;
begin
  if not exists(select 1 from pp.owner where id=1 and line_user_id=p_sender)
    or not exists(select 1 from pp.conversations where event_id=p_event and sender_id=p_sender
      and source_type='user' and group_id is null and lease_id=p_lease
      and status='processing' and lease_until>now())
  then return jsonb_build_object('decision','denied'); end if;
  select count(*), min(content) into answers, answer_text from pp.memories
    where aliases @> array[p_question] and (expires_at is null or expires_at>now());
  if answers=1 then return jsonb_build_object('decision','answer','answer',answer_text); end if;
  if answers>1 then return jsonb_build_object('decision','ambiguous'); end if;
  return jsonb_build_object('decision','unknown');
end;
$$;

revoke all on function pp.pp_claim_owner_event(text,text,text,uuid), pp.pp_owner_answer(text,text,text,uuid) from public, anon, authenticated;
grant execute on function pp.pp_claim_owner_event(text,text,text,uuid), pp.pp_owner_answer(text,text,text,uuid) to service_role;
