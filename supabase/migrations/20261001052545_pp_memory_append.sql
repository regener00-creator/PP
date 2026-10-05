-- Keep saved positions intact and allocate a new tail position for each insert.
-- Layout saves compact ranks to 1..count(*), so this counter stays ahead even
-- after dragging or deleting cards. CACHE 1 preserves allocation order across sessions.
set local lock_timeout = '2s';
lock table pp.memories in share row exclusive mode;
create sequence pp.memory_sort_order_seq as bigint cache 1
  owned by pp.memories.sort_order;
select pg_catalog.setval('pp.memory_sort_order_seq'::regclass,
  (select greatest(coalesce(max(sort_order),0),count(*))+1 from pp.memories),false);
alter table pp.memories alter column sort_order
  set default nextval('pp.memory_sort_order_seq'::regclass);
revoke all on sequence pp.memory_sort_order_seq from public,anon,authenticated;
grant usage on sequence pp.memory_sort_order_seq to service_role;
notify pgrst,'reload schema';
