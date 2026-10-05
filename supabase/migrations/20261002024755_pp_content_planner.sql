-- Content Planner is a separate workspace. No memory data is copied or republished.
create table pp.content_brands (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 160),
 description text not null default '', audience text not null default '', tone text not null default '', pillars text not null default '', avoid text not null default '',
 updated_at timestamptz not null default clock_timestamp(), created_at timestamptz not null default now()
);
create table pp.content_sources (
 id uuid primary key default gen_random_uuid(), brand_id uuid not null references pp.content_brands(id) on delete restrict,
 kind text not null check(kind in ('product','question','case','campaign')), title text not null check(length(title) between 1 and 160), content text not null,
 start_date date, end_date date, updated_at timestamptz not null default clock_timestamp(), created_at timestamptz not null default now(),
 check(end_date is null or start_date is null or end_date >= start_date)
);
create index content_sources_brand on pp.content_sources(brand_id);
create table pp.content_generations (
 id uuid primary key, kind text not null check(kind in ('ideas','draft')), engine text not null check(engine in ('template','ai')),
 status text not null default 'pending' check(status in ('pending','complete','failed')), request jsonb not null, result jsonb,
 model text, input_tokens integer, output_tokens integer, estimated_cost_usd numeric,
 created_at timestamptz not null default now(), updated_at timestamptz not null default clock_timestamp()
);
create index content_generations_item on pp.content_generations((request->>'item_id')) where kind='draft';
create index content_generations_created on pp.content_generations(created_at desc);
create table pp.content_items (
 id uuid primary key default gen_random_uuid(), brand_id uuid references pp.content_brands(id) on delete restrict,
 title text not null check(length(title) between 1 and 160), channel text not null default 'TikTok',
 hook text not null default '', angle text not null default '', cta text not null default '', pillar text not null default '', format text not null default '',
 caption text not null default '', script text not null default '', shots text not null default '', hashtags text not null default '', visual text not null default '', notes text not null default '',
 status text not null default 'idea' check(status in ('idea','making','review','ready','posted')), scheduled_at timestamptz, assignee text not null default '',
 attachment_ids uuid[] not null default '{}', notify_owner boolean not null default false, group_id text references pp.permissions(group_id) on delete restrict,
 remind_before boolean not null default false, remind_day boolean not null default true,
 views bigint check(views>=0), saves bigint check(saves>=0), sales numeric check(sales>=0), post_url text not null default '',
 generation_id uuid references pp.content_generations(id) on delete restrict, idea_index integer check(idea_index between 0 and 4), archived boolean not null default false,
 updated_at timestamptz not null default clock_timestamp(), created_at timestamptz not null default now(),
 unique(generation_id,idea_index), check(cardinality(attachment_ids)<=10),
 check((not notify_owner and group_id is null) or (scheduled_at is not null and (remind_day or remind_before)))
);
create index content_items_brand on pp.content_items(brand_id);
create index content_items_group on pp.content_items(group_id);
create index content_items_due on pp.content_items(scheduled_at) where not archived and status<>'posted';
create table pp.content_deliveries (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references pp.content_items(id) on delete cascade,
 occurs date not null, lead integer not null check(lead in (0,1)), target text not null,
 status text not null default 'processing' check(status in ('processing','sent','failed','skipped')), reason text,
 retry_key uuid not null default gen_random_uuid(), attempts integer not null default 1, payload jsonb, item_revision timestamptz,
 lease_until timestamptz not null default now()+interval '5 minutes', updated_at timestamptz not null default now(),
 unique(item_id,occurs,lead,target)
);
create index content_deliveries_recent on pp.content_deliveries(updated_at desc);
create function pp.pp_content_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at := clock_timestamp(); return new; end $$;
create trigger content_brand_revision before update on pp.content_brands for each row execute function pp.pp_content_revision();
create trigger content_source_revision before update on pp.content_sources for each row execute function pp.pp_content_revision();
create trigger content_item_revision before update on pp.content_items for each row execute function pp.pp_content_revision();
-- Bound the complete client workspaces; do not silently omit older content.
create function pp.pp_content_limit() returns trigger language plpgsql security invoker set search_path='' as $$
declare n integer; maximum integer;
begin
 perform pg_advisory_xact_lock(hashtext('pp.'||tg_table_name));
 maximum := case tg_table_name when 'content_brands' then 20 when 'content_sources' then 500 else 1000 end;
 execute format('select count(*) from pp.%I',tg_table_name) into n;
 if n>=maximum then raise exception 'PP_CONTENT_LIMIT'; end if;
 return new;
end $$;
create trigger content_brand_limit before insert on pp.content_brands for each row execute function pp.pp_content_limit();
create trigger content_source_limit before insert on pp.content_sources for each row execute function pp.pp_content_limit();
create trigger content_item_limit before insert on pp.content_items for each row execute function pp.pp_content_limit();
create function pp.pp_claim_content(p_item uuid,p_occurs date,p_lead integer,p_target text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d pp.content_deliveries; e pp.content_items; today date := (now() at time zone 'Asia/Bangkok')::date;
begin
 select * into e from pp.content_items where id=p_item;
 if not found or e.archived or e.status='posted' or p_lead not in (0,1) or
    (e.scheduled_at at time zone 'Asia/Bangkok')::date is distinct from p_occurs or p_occurs-p_lead <> today or
    (p_lead=0 and not e.remind_day) or (p_lead=1 and not e.remind_before) or
    not coalesce(((e.notify_owner and exists(select 1 from pp.owner where id=1 and line_user_id=p_target)) or
      (e.group_id=p_target and exists(select 1 from pp.permissions where group_id=p_target and enabled))),false) then return null; end if;
 insert into pp.content_deliveries(item_id,occurs,lead,target) values(p_item,p_occurs,p_lead,p_target)
 on conflict(item_id,occurs,lead,target) do update set attempts=pp.content_deliveries.attempts+1,status='processing',lease_until=now()+interval '5 minutes'
 where pp.content_deliveries.status in ('processing','failed') and pp.content_deliveries.lease_until<now() and pp.content_deliveries.attempts<3
 returning * into d;
 if d.id is null then return null; end if;
 return to_jsonb(d);
end $$;
create function pp.pp_detach_content_file() returns trigger language plpgsql security invoker set search_path='' as $$
begin update pp.content_items set attachment_ids=array_remove(attachment_ids,old.id) where old.id=any(attachment_ids); return old; end $$;
create trigger detach_content_file after delete on pp.files for each row execute function pp.pp_detach_content_file();
alter table pp.content_brands enable row level security;
alter table pp.content_sources enable row level security;
alter table pp.content_items enable row level security;
alter table pp.content_generations enable row level security;
alter table pp.content_deliveries enable row level security;
revoke all on pp.content_brands,pp.content_sources,pp.content_items,pp.content_generations,pp.content_deliveries from public,anon,authenticated;
grant all on pp.content_brands,pp.content_sources,pp.content_items,pp.content_generations,pp.content_deliveries to service_role;
revoke all on function pp.pp_content_revision(),pp.pp_content_limit(),pp.pp_claim_content(uuid,date,integer,text),pp.pp_detach_content_file() from public,anon,authenticated;
grant execute on function pp.pp_content_revision(),pp.pp_content_limit(),pp.pp_claim_content(uuid,date,integer,text),pp.pp_detach_content_file() to service_role;
