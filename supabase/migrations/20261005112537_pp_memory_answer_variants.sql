-- Owner-written reply variations. Existing content remains reply 1.
-- Preserve open review issues across the row-shape change.
create temporary table pp_reply_revision_before on commit drop as
 select id,md5(row_to_json(m)::text) as revision from pp.memories m;
alter table pp.memories add column answer_variants text[] not null default '{}';
create function pp.pp_valid_answer_variants(p_items text[]) returns boolean
language sql immutable security invoker set search_path='' as $$
 select coalesce(cardinality(p_items) between 0 and 19
 and (cardinality(p_items)=0 or (array_ndims(p_items)=1 and array_lower(p_items,1)=1))
 and not exists(select 1 from unnest(p_items) v where v is null or length(v) not between 1 and 2000 or v !~ '[^[:space:]]'),false);
$$;
alter table pp.memories add constraint memories_answer_variants_check check(pp.pp_valid_answer_variants(answer_variants));
update pp.memory_issues i set left_revision=md5(row_to_json(m)::text)
 from pp.memories m,pp_reply_revision_before b where i.left_id=m.id and b.id=m.id and i.left_revision=b.revision;
update pp.memory_issues i set right_revision=md5(row_to_json(m)::text)
 from pp.memories m,pp_reply_revision_before b where i.right_id=m.id and b.id=m.id and i.right_revision=b.revision;

create function pp.pp_pick_memory_reply(p_content text,p_variants text[]) returns text
language sql volatile security invoker set search_path='' as $$
 select (array[p_content] || p_variants)[1 + floor(random()*(1+cardinality(p_variants)))::integer];
$$;
revoke all on function pp.pp_valid_answer_variants(text[]),pp.pp_pick_memory_reply(text,text[]) from public,anon,authenticated;
grant execute on function pp.pp_valid_answer_variants(text[]),pp.pp_pick_memory_reply(text,text[]) to service_role;

create or replace function pp.pp_memory_catalog() returns jsonb language sql stable security invoker set search_path='' as $$
 with rows as (select m.*,md5(row_to_json(m)::text) as revision from pp.memories m where visibility='shareable'),
 data as (select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'content',content,'answer_variants',answer_variants,
 'question_examples',question_examples,'revision',revision,'attachment_ids',attachment_ids,
 'mention_owner',mention_owner,'expires_at',expires_at) order by id),'[]'::jsonb) as items from rows)
 select jsonb_build_object('revision',md5(items::text),'memories',items) from data;
$$;

create or replace function pp.pp_save_assisted_memory(p_value jsonb,p_catalog text,p_remove uuid default null,p_concerns jsonb default '[]')
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
  insert into pp.memories(title,content,answer_variants,aliases,question_examples,visibility,mention_owner,expires_at,attachment_ids)
  values(p_value->>'title',p_value->>'content',array(select jsonb_array_elements_text(p_value->'answer_variants')),array(select jsonb_array_elements_text(p_value->'aliases')),
   array(select jsonb_array_elements_text(p_value->'question_examples')),'shareable',(p_value->>'mention_owner')::boolean,
   (p_value->>'expires_at')::timestamptz,array(select jsonb_array_elements_text(p_value->'attachment_ids'))::uuid[]) returning * into m;
 else
  update pp.memories set title=p_value->>'title',content=p_value->>'content',answer_variants=case when p_value ? 'answer_variants' then array(select jsonb_array_elements_text(p_value->'answer_variants')) else answer_variants end,aliases=array(select jsonb_array_elements_text(p_value->'aliases')),
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
 'title',coalesce(a.title,s.title,''),'content',m.content,'answer_variants',coalesce(a.answer_variants,'{}'::text[])) order by m.id),'[]'::jsonb)
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
 'title',m.title,'content',m.content,'answer_variants',m.answer_variants) order by m.id),'[]'::jsonb) from pp.memories m where m.visibility='shareable'
 and (m.expires_at is null or m.expires_at>now())
 and not exists(select 1 from pp.memories p where p.visibility='private' and p.aliases && m.aliases));
end;
$$;

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
 for n in select * from pp.pp_group_answer_rows(p_group) g where id<>m.id and aliases && m.aliases and (content<>m.content or mention_owner<>m.mention_owner or coalesce((select answer_variants from pp.memories where id=g.id),'{}'::text[])<>coalesce((select answer_variants from pp.memories where id=m.id),'{}'::text[])
 or coalesce((select attachment_ids from pp.memories where id=g.id),'{}'::uuid[])<>coalesce((select attachment_ids from pp.memories where id=m.id),'{}'::uuid[])) loop
  perform pp.pp_record_memory_issue(m.id,n.id,m.revision,n.revision,'conflict','คำถามซ้ำกัน แต่คำตอบต่างกัน');
  return jsonb_build_object('decision','conflict');
 end loop;
 if pp.pp_memory_has_conflict(p_id) then return jsonb_build_object('decision','conflict'); end if;
 return jsonb_build_object('decision','answer','answer',pp.pp_pick_memory_reply(m.content,coalesce((select answer_variants from pp.memories where id=m.id),'{}'::text[]))) || case when m.mention_owner then jsonb_build_object('mention_owner',true) else '{}'::jsonb end;
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
 and (expires_at is null or expires_at>now()) and (content<>m.content or answer_variants<>m.answer_variants or mention_owner<>m.mention_owner or attachment_ids<>m.attachment_ids) loop
  perform pp.pp_record_memory_issue(m.id,n.id,md5(row_to_json(m)::text),md5(row_to_json(n)::text),'conflict','คำถามซ้ำกัน แต่คำตอบต่างกัน');
  return jsonb_build_object('decision','conflict');
 end loop;
 if pp.pp_memory_has_conflict(p_id) then return jsonb_build_object('decision','conflict'); end if;
 return jsonb_build_object('decision','answer','answer',pp.pp_pick_memory_reply(m.content,m.answer_variants)) || pp.pp_media_payload(m.id);
end;
$$;

create or replace function pp.pp_search_memories(p_query text) returns setof pp.memories
language sql stable security invoker set search_path='' as $$
 select * from pp.memories where length(p_query)<=120 and
 (p_query='' or strpos(lower(title || ' ' || content || ' ' || array_to_string(answer_variants,' ') || ' ' || array_to_string(question_examples,' ')),lower(p_query))>0)
 order by sort_order,created_at desc,id limit 200;
$$;
notify pgrst,'reload schema';
