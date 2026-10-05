-- Presentation metadata only. Private content and bot matching stay unchanged.
alter table pp.memories add column card_color text
  check (card_color in ('green','yellow','red','blue'));
alter table pp.memories add column sort_order bigint not null default 0;
with ordered as (
  select id,row_number() over (order by updated_at desc,created_at desc,id) as position from pp.memories
) update pp.memories m set sort_order=o.position from ordered o where m.id=o.id;
create index memories_display_order on pp.memories(sort_order,created_at desc,id);

create or replace function pp.pp_search_memories(p_query text) returns setof pp.memories
language sql stable security invoker set search_path='' as $$
  select * from pp.memories where length(p_query)<=120 and
    (p_query='' or strpos(lower(title || ' ' || content || ' ' || array_to_string(question_examples,' ')),lower(p_query))>0)
  order by sort_order,created_at desc,id limit 200;
$$;

create function pp.pp_save_memory_layout(p_items jsonb) returns void
language plpgsql security invoker set search_path='' set lock_timeout='2s' as $$
declare
  requested uuid[];
  previous uuid[];
  arranged uuid[];
  next_item integer := 1;
  i integer;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'PP_INVALID_LAYOUT'; end if;
  if jsonb_array_length(p_items) not between 1 and 200 then raise exception 'PP_INVALID_LAYOUT'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) item where
    jsonb_typeof(item)<>'object' or not (item ? 'id') or not (item ? 'card_color') or
    (item->>'id') is null or (item->>'card_color' is not null and item->>'card_color' not in ('green','yellow','red','blue'))
  ) then raise exception 'PP_INVALID_LAYOUT'; end if;
  select array_agg((item->>'id')::uuid order by position) into requested
    from jsonb_array_elements(p_items) with ordinality as x(item,position);
  if cardinality(requested)<>(select count(distinct id) from unnest(requested) id) then raise exception 'PP_INVALID_LAYOUT'; end if;

  -- Small, owner-managed list. Serialize layout saves and concurrent edits/deletes.
  -- Shared reads remain available. No partially saved colours/order on failure.
  lock table pp.memories in share row exclusive mode;
  if cardinality(requested)<>(select count(*) from pp.memories where id=any(requested)) then raise exception 'PP_STALE_LAYOUT'; end if;
  select array_agg(id order by sort_order,created_at desc,id) into previous from pp.memories;
  arranged := previous;
  -- Search results can be rearranged without moving any hidden items out of their slots.
  for i in 1..cardinality(previous) loop
    if previous[i]=any(requested) then
      arranged[i] := requested[next_item];
      next_item := next_item+1;
    end if;
  end loop;
  update pp.memories m set sort_order=a.position,
    card_color=case when c.id is not null then c.card_color else m.card_color end
    from unnest(arranged) with ordinality a(id,position)
    left join jsonb_to_recordset(p_items) as c(id uuid,card_color text) on c.id=a.id
    where m.id=a.id;
end;
$$;
revoke all on function pp.pp_save_memory_layout(jsonb) from public,anon,authenticated;
grant execute on function pp.pp_save_memory_layout(jsonb) to service_role;
notify pgrst,'reload schema';
