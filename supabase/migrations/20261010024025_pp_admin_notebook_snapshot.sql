-- One consistent, read-only snapshot instead of HTTP round trips per notebook.
-- Called only by the authenticated admin server; client roles cannot invoke it.
create function pp.pp_admin_notebooks() returns jsonb
language sql stable security invoker set search_path='' as $$
 with owner as materialized (
   select line_user_id as sender from pp.owner where id=1 and line_user_id is not null
 ), scopes as materialized (
   select sender as scope_key,null::text as group_id,'แชตส่วนตัวของฉัน'::text as label,
     null::timestamptz as created_at, sender from owner
   union all
   select p.group_id,p.group_id,'กลุ่ม '||coalesce(nullif(p.label,''),'กลุ่มที่ยังไม่ตั้งชื่อ'),p.created_at,o.sender
   from pp.permissions p cross join owner o where p.enabled
 ), allowed as materialized (
   select * from scopes where pp.pp_assistant_allowed(scope_key,sender)
 ), notes as (
   select n.id,n.title,n.content,n.updated_at,a.group_id,a.label,n.created_at,a.created_at as scope_created
   from allowed a cross join lateral (
     select id,title,content,updated_at,created_at from pp.assistant_notes
     where scope_key=a.scope_key order by created_at,id limit 200
   ) n
 ), events as materialized (
   select e.* from allowed a cross join lateral (
     select * from pp.assistant_events where scope_key=a.scope_key order by event_date,id limit 100
   ) e
 ), deliveries as (
   select d.id,d.event_id,d.occurs_on,d.lead_days,d.status,d.reason,d.created_at,e.scope_key as target
   from pp.assistant_deliveries d join events e on e.id=d.event_id
   order by d.created_at desc,d.id limit 30
 )
 select jsonb_build_object(
   'notes',coalesce((select jsonb_agg(jsonb_build_object(
     'id',id,'title',title,'content',content,'updated_at',updated_at,
     'group',group_id,'sourceLabel',label
   ) order by scope_created nulls first,group_id,created_at,id) from notes),'[]'::jsonb),
   'events',coalesce((select jsonb_agg(to_jsonb(e) order by event_date,id) from events e),'[]'::jsonb),
   'deliveries',coalesce((select jsonb_agg(to_jsonb(d) order by created_at desc,id) from deliveries d),'[]'::jsonb)
 );
$$;
revoke all on function pp.pp_admin_notebooks() from public,anon,authenticated;
grant execute on function pp.pp_admin_notebooks() to service_role;
notify pgrst,'reload schema';
