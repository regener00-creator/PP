-- Server-only reusable structures and a durable, brand-scoped deduplication ledger.
create table pp.content_patterns (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid references pp.content_brands(id) on delete cascade,
 scope text not null, fingerprint text not null, blueprint jsonb not null,
 source_ids uuid[] not null default '{}',
 generation_id uuid not null references pp.content_generations(id) on delete cascade,
 enabled boolean not null default true, created_at timestamptz not null default now(),
 unique(scope,fingerprint)
);
create index content_patterns_brand on pp.content_patterns(brand_id);
create index content_patterns_generation on pp.content_patterns(generation_id);
create table pp.content_idea_seen (
 scope text not null, concept_key text not null, title_key text not null, title text not null,
 generation_id uuid references pp.content_generations(id) on delete set null,
 created_at timestamptz not null default now(), primary key(scope,concept_key), unique(scope,title_key)
);
create index content_idea_seen_generation on pp.content_idea_seen(generation_id);
create index content_idea_seen_recent on pp.content_idea_seen(scope,created_at desc);
create function pp.pp_idea_title_key(p_title text) returns text language sql immutable security invoker set search_path='' as $$
 select md5(regexp_replace(lower(p_title),'[^a-z0-9ก-๙]','','g'));
$$;
-- Include older saved generations and manually entered work in exact-title protection.
insert into pp.content_idea_seen(scope,concept_key,title_key,title,generation_id)
select coalesce(g.request->'brief'->>'brand_id','unbranded'), 'legacy:'||pp.pp_idea_title_key(i->>'title'),pp.pp_idea_title_key(i->>'title'),i->>'title',g.id
from pp.content_generations g cross join lateral jsonb_array_elements(coalesce(g.result->'ideas','[]'::jsonb)) i
where g.status='complete' and g.kind='ideas' and length(i->>'title')>0 on conflict do nothing;
insert into pp.content_idea_seen(scope,concept_key,title_key,title)
select coalesce(brand_id::text,'unbranded'),'work:'||pp.pp_idea_title_key(title),pp.pp_idea_title_key(title),title from pp.content_items on conflict do nothing;

create function pp.pp_finish_ideas(p_id uuid,p_candidates jsonb,p_patterns jsonb default '[]',p_raw jsonb default '{}',p_model text default null,p_input integer default null,p_output integer default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g pp.content_generations; s text; b uuid; c jsonb; p jsonb; accepted jsonb:='[]'; n integer; learned integer:=0; pattern_count integer; keys uuid[]; titlekey text; inserted integer;
begin
 select * into g from pp.content_generations where id=p_id for update;
 if not found or g.kind<>'ideas' then raise exception 'PP_INVALID_GENERATION'; end if;
 if g.status='complete' then return to_jsonb(g); end if;
 if g.status<>'pending' then raise exception 'PP_INVALID_GENERATION'; end if;
 if jsonb_typeof(p_candidates)<>'array' or jsonb_array_length(p_candidates)>6000 or jsonb_typeof(p_patterns)<>'array' or jsonb_array_length(p_patterns)>5 then raise exception 'PP_INVALID_BATCH'; end if;
 s:=coalesce(g.request->'brief'->>'brand_id','unbranded'); b:=nullif(g.request->'brief'->>'brand_id','')::uuid;
 perform pg_advisory_xact_lock(hashtext('pp.ideas.'||s));
 for c in select value from jsonb_array_elements(p_candidates) loop
   exit when jsonb_array_length(accepted)>=5;
   if length(c->'idea'->>'title') not between 1 and 160 or coalesce(c->>'key','')='' then raise exception 'PP_INVALID_IDEA'; end if;
   titlekey:=pp.pp_idea_title_key(c->'idea'->>'title');
   -- Protect against work created after the initial ledger migration, too.
   if exists(select 1 from pp.content_items where brand_id is not distinct from b and pp.pp_idea_title_key(title)=titlekey) then continue; end if;
   insert into pp.content_idea_seen(scope,concept_key,title_key,title,generation_id) values(s,md5(c->>'key'),titlekey,c->'idea'->>'title',p_id) on conflict do nothing;
   get diagnostics inserted=row_count;
   if inserted=1 then accepted:=accepted||jsonb_build_array(c->'idea'); end if;
 end loop;
 if g.engine='ai' then
   select coalesce(array_agg((v->>'id')::uuid),'{}'::uuid[]) into keys from jsonb_array_elements(coalesce(g.request->'sources','[]')) v;
   select count(*) into pattern_count from pp.content_patterns where scope=s;
   for p in select value from jsonb_array_elements(p_patterns) loop
     exit when pattern_count>=200;
     if position('{subject}' in coalesce(p->>'title',''))=0 then continue; end if;
     insert into pp.content_patterns(brand_id,scope,fingerprint,blueprint,source_ids,generation_id)
     values(b,s,pp.pp_idea_title_key(p->>'title'),p,keys,p_id) on conflict do nothing;
     get diagnostics inserted=row_count; learned:=learned+inserted; pattern_count:=pattern_count+inserted;
   end loop;
 end if;
 n:=jsonb_array_length(accepted);
 update pp.content_generations set status='complete',result=jsonb_build_object('ideas',accepted,'raw_ideas',coalesce(p_raw->'ideas','[]'),'patterns',p_patterns,'learned_count',learned,'notice',case when n=0 then 'ยังไม่มีไอเดียใหม่ที่ไม่ซ้ำ ลองเพิ่มสินค้า วัตถุดิบ หรือเปลี่ยนหัวข้อ' when n<5 then 'พบไอเดียใหม่ '||n||' แบบ ส่วนที่ซ้ำถูกข้ามแล้ว' else 'คัดไอเดียใหม่ให้แล้ว' end),model=p_model,input_tokens=p_input,output_tokens=p_output,updated_at=clock_timestamp() where id=p_id returning * into g;
 return to_jsonb(g);
end $$;
alter table pp.content_patterns enable row level security;
alter table pp.content_idea_seen enable row level security;
revoke all on pp.content_patterns,pp.content_idea_seen from public,anon,authenticated;
grant all on pp.content_patterns,pp.content_idea_seen to service_role;
revoke all on function pp.pp_idea_title_key(text),pp.pp_finish_ideas(uuid,jsonb,jsonb,jsonb,text,integer,integer) from public,anon,authenticated;
grant execute on function pp.pp_idea_title_key(text),pp.pp_finish_ideas(uuid,jsonb,jsonb,jsonb,text,integer,integer) to service_role;
notify pgrst,'reload schema';
