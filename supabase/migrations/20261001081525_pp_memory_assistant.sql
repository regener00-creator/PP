-- All helpers remain server-only, as does the existing PP schema.
alter table pp.memories drop constraint memories_aliases_check;
alter table pp.memories add constraint memories_aliases_check check(cardinality(aliases) between 0 and 30);

create table pp.memory_issues (
 id uuid primary key default gen_random_uuid(),
 left_id uuid not null references pp.memories(id) on delete cascade,
 right_id uuid not null references pp.memories(id) on delete cascade,
 left_revision text not null, right_revision text not null,
 kind text not null check(kind in ('duplicate','conflict')),
 reason text not null check(length(reason) between 1 and 400),
 status text not null default 'open' check(status in ('open','dismissed')),
 created_at timestamptz not null default now(),
 check(left_id<right_id), unique(left_id,right_id)
);
create index memory_issues_right on pp.memory_issues(right_id);
alter table pp.memory_issues enable row level security;
revoke all on pp.memory_issues from public,anon,authenticated;
grant all on pp.memory_issues to service_role;

create function pp.pp_memory_catalog() returns jsonb language sql stable security invoker set search_path='' as $$
 with rows as (select m.*,md5(row_to_json(m)::text) as revision from pp.memories m where visibility='shareable'),
 data as (select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'content',content,
 'question_examples',question_examples,'revision',revision,'attachment_ids',attachment_ids,
 'mention_owner',mention_owner,'expires_at',expires_at) order by id),'[]'::jsonb) as items from rows)
 select jsonb_build_object('revision',md5(items::text),'memories',items) from data;
$$;

create function pp.pp_record_memory_issue(p_left uuid,p_right uuid,p_left_revision text,p_right_revision text,p_kind text,p_reason text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare a pp.memories; b pp.memories;
begin
 if p_left=p_right or p_kind not in ('duplicate','conflict') then return false; end if;
 select * into a from pp.memories where id=p_left and visibility='shareable';
 if not found or md5(row_to_json(a)::text) is distinct from p_left_revision then return false; end if;
 select * into b from pp.memories where id=p_right and visibility='shareable';
 if not found or md5(row_to_json(b)::text) is distinct from p_right_revision then return false; end if;
 insert into pp.memory_issues(left_id,right_id,left_revision,right_revision,kind,reason)
 values(least(p_left,p_right),greatest(p_left,p_right),case when p_left<p_right then p_left_revision else p_right_revision end,
 case when p_left<p_right then p_right_revision else p_left_revision end,p_kind,left(p_reason,400))
 on conflict(left_id,right_id) do update set left_revision=excluded.left_revision,right_revision=excluded.right_revision,
 kind=excluded.kind,reason=excluded.reason,status='open',created_at=now()
 where pp.memory_issues.left_revision<>excluded.left_revision or pp.memory_issues.right_revision<>excluded.right_revision
 or (pp.memory_issues.status='open' and pp.memory_issues.kind<>excluded.kind);
 return true;
end;
$$;

create function pp.pp_memory_has_conflict(p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from pp.memory_issues i join pp.memories a on a.id=i.left_id join pp.memories b on b.id=i.right_id
 where (i.left_id=p_id or i.right_id=p_id) and i.status='open' and i.kind='conflict'
 and a.visibility='shareable' and b.visibility='shareable'
 and (a.expires_at is null or a.expires_at>now()) and (b.expires_at is null or b.expires_at>now())
 and md5(row_to_json(a)::text)=i.left_revision and md5(row_to_json(b)::text)=i.right_revision);
$$;

create function pp.pp_save_assisted_memory(p_value jsonb,p_catalog text,p_remove uuid default null,p_concerns jsonb default '[]')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare target uuid:=nullif(p_value->>'id','')::uuid; m pp.memories; c jsonb; other pp.memories;
begin
 lock table pp.memories in share row exclusive mode;
 if p_catalog is distinct from (pp.pp_memory_catalog()->>'revision') then return jsonb_build_object('decision','changed'); end if;
 if target is not null and not exists(select 1 from pp.memories where id=target and visibility='shareable')
 then return jsonb_build_object('decision','changed'); end if;
 if p_remove is not null and (target is null or p_remove=target or not exists(select 1 from pp.memories where id=p_remove and visibility='shareable'))
 then return jsonb_build_object('decision','changed'); end if;
 if target is null then
  insert into pp.memories(title,content,aliases,question_examples,visibility,mention_owner,expires_at,attachment_ids)
  values(p_value->>'title',p_value->>'content',array(select jsonb_array_elements_text(p_value->'aliases')),
   array(select jsonb_array_elements_text(p_value->'question_examples')),'shareable',(p_value->>'mention_owner')::boolean,
   (p_value->>'expires_at')::timestamptz,array(select jsonb_array_elements_text(p_value->'attachment_ids'))::uuid[]) returning * into m;
 else
  update pp.memories set title=p_value->>'title',content=p_value->>'content',aliases=array(select jsonb_array_elements_text(p_value->'aliases')),
   question_examples=array(select jsonb_array_elements_text(p_value->'question_examples')),mention_owner=(p_value->>'mention_owner')::boolean,
   expires_at=(p_value->>'expires_at')::timestamptz,attachment_ids=array(select jsonb_array_elements_text(p_value->'attachment_ids'))::uuid[],updated_at=now()
   where id=target returning * into m;
 end if;
 if p_remove is not null then delete from pp.memories where id=p_remove; end if;
 for c in select * from jsonb_array_elements(p_concerns) loop
  select * into other from pp.memories where id=(c->>'id')::uuid and visibility='shareable';
  if found and other.id<>m.id and c->>'kind' in ('duplicate','conflict') then
   perform pp.pp_record_memory_issue(m.id,other.id,md5(row_to_json(m)::text),md5(row_to_json(other)::text),c->>'kind',c->>'reason');
  end if;
 end loop;
 return jsonb_build_object('decision','saved','id',m.id);
end;
$$;

create or replace function pp.pp_ai_candidates(p_group text,p_sender text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'revision',m.revision,'questions',m.question_examples,
 'title',coalesce(a.title,s.title,''),'content',m.content) order by m.id),'[]'::jsonb)
 from pp.pp_group_answer_rows(p_group) m left join pp.memories a on a.id=m.id left join pp.learning_suggestions s on s.id=m.id
 where exists(select 1 from pp.permissions where group_id=p_group and enabled)
 and exists(select 1 from pp.friends where group_id=p_group and line_user_id=p_sender and not blocked)
 and not exists(select 1 from pp.memories p where p.visibility='private' and p.aliases && m.aliases);
$$;
create or replace function pp.pp_direct_ai_candidates(p_sender text,p_event text,p_lease uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not pp.pp_direct_allowed(p_sender,p_event,p_lease) then return jsonb_build_object('decision','denied'); end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'revision',md5(row_to_json(m)::text),'questions',m.question_examples,
 'title',m.title,'content',m.content) order by m.id),'[]'::jsonb) from pp.memories m where m.visibility='shareable'
 and (m.expires_at is null or m.expires_at>now())
 and not exists(select 1 from pp.memories p where p.visibility='private' and p.aliases && m.aliases));
end;
$$;

-- Preserve existing vetoes; identical copies may answer, differing copies go to review.
create or replace function pp.pp_ai_answer_text(p_id uuid,p_revision text,p_question text,p_group text,p_sender text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m record; n record;
begin
 if not exists(select 1 from pp.permissions where group_id=p_group and enabled)
 or not exists(select 1 from pp.friends where group_id=p_group and line_user_id=p_sender and not blocked)
 or exists(select 1 from pp.memories where visibility='private' and aliases @> array[p_question]) then return jsonb_build_object('decision','refuse'); end if;
 select * into m from pp.pp_group_answer_rows(p_group) where id=p_id;
 if not found or m.revision is distinct from p_revision then return jsonb_build_object('decision','unknown'); end if;
 if exists(select 1 from pp.memories p where p.visibility='private' and p.aliases && m.aliases) then return jsonb_build_object('decision','refuse'); end if;
 for n in select * from pp.pp_group_answer_rows(p_group) g where id<>m.id and aliases && m.aliases and (content<>m.content or mention_owner<>m.mention_owner
 or coalesce((select attachment_ids from pp.memories where id=g.id),'{}'::uuid[])<>coalesce((select attachment_ids from pp.memories where id=m.id),'{}'::uuid[])) loop
  perform pp.pp_record_memory_issue(m.id,n.id,m.revision,n.revision,'conflict','คำถามซ้ำกัน แต่คำตอบต่างกัน');
  return jsonb_build_object('decision','conflict');
 end loop;
 if pp.pp_memory_has_conflict(p_id) then return jsonb_build_object('decision','conflict'); end if;
 return jsonb_build_object('decision','answer','answer',m.content) || case when m.mention_owner then jsonb_build_object('mention_owner',true) else '{}'::jsonb end;
end;
$$;
create or replace function pp.pp_direct_ai_answer(p_id uuid,p_revision text,p_question text,p_sender text,p_event text,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m pp.memories; n pp.memories;
begin
 if not pp.pp_direct_allowed(p_sender,p_event,p_lease) then return jsonb_build_object('decision','denied'); end if;
 if exists(select 1 from pp.memories where visibility='private' and aliases @> array[p_question]) then return jsonb_build_object('decision','refuse'); end if;
 select * into m from pp.memories where id=p_id and visibility='shareable' and (expires_at is null or expires_at>now());
 if not found or md5(row_to_json(m)::text) is distinct from p_revision then return jsonb_build_object('decision','unknown'); end if;
 if exists(select 1 from pp.memories where visibility='private' and aliases && m.aliases) then return jsonb_build_object('decision','refuse'); end if;
 for n in select * from pp.memories where id<>m.id and visibility='shareable' and aliases && m.aliases
 and (expires_at is null or expires_at>now()) and (content<>m.content or mention_owner<>m.mention_owner or attachment_ids<>m.attachment_ids) loop
  perform pp.pp_record_memory_issue(m.id,n.id,md5(row_to_json(m)::text),md5(row_to_json(n)::text),'conflict','คำถามซ้ำกัน แต่คำตอบต่างกัน');
  return jsonb_build_object('decision','conflict');
 end loop;
 if pp.pp_memory_has_conflict(p_id) then return jsonb_build_object('decision','conflict'); end if;
 return jsonb_build_object('decision','answer','answer',m.content) || pp.pp_media_payload(m.id);
end;
$$;

create or replace function pp.pp_answer_text(p_question text,p_group text,p_sender text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m record;
begin
 if not exists(select 1 from pp.permissions where group_id=p_group and enabled)
 or not exists(select 1 from pp.friends where group_id=p_group and line_user_id=p_sender and not blocked)
 or exists(select 1 from pp.memories where visibility='private' and aliases @> array[p_question]) then return jsonb_build_object('decision','refuse'); end if;
 select * into m from pp.pp_group_answer_rows(p_group) where aliases @> array[p_question] order by id limit 1;
 if not found then return jsonb_build_object('decision','unknown'); end if;
 return pp.pp_ai_answer_text(m.id,m.revision,p_question,p_group,p_sender);
end;
$$;
create or replace function pp.pp_direct_answer(p_question text,p_sender text,p_event text,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m pp.memories;
begin
 if not pp.pp_direct_allowed(p_sender,p_event,p_lease) then return jsonb_build_object('decision','denied'); end if;
 if exists(select 1 from pp.memories where visibility='private' and aliases @> array[p_question]) then
  if exists(select 1 from pp.owner where id=1 and line_user_id=p_sender) then return pp.pp_owner_answer(p_question,p_sender,p_event,p_lease); end if;
  return jsonb_build_object('decision','refuse');
 end if;
 select * into m from pp.memories where visibility='shareable' and aliases @> array[p_question]
 and (expires_at is null or expires_at>now()) order by id limit 1;
 if not found then return jsonb_build_object('decision','unknown'); end if;
 return pp.pp_direct_ai_answer(m.id,md5(row_to_json(m)::text),p_question,p_sender,p_event,p_lease);
end;
$$;

revoke all on function pp.pp_memory_catalog(),pp.pp_record_memory_issue(uuid,uuid,text,text,text,text),pp.pp_memory_has_conflict(uuid),
 pp.pp_save_assisted_memory(jsonb,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function pp.pp_memory_catalog(),pp.pp_record_memory_issue(uuid,uuid,text,text,text,text),pp.pp_memory_has_conflict(uuid),
 pp.pp_save_assisted_memory(jsonb,text,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
