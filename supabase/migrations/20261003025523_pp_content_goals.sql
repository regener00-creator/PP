create table pp.content_goal_settings (
 id boolean primary key default true check (id),
 goals jsonb not null check (jsonb_typeof(goals) = 'array' and jsonb_array_length(goals) between 1 and 30),
 updated_at timestamptz not null default now()
);
alter table pp.content_goal_settings enable row level security;
revoke all on pp.content_goal_settings from public, anon, authenticated;
grant select, update on pp.content_goal_settings to service_role;
insert into pp.content_goal_settings (goals) values ('[{"id":"awareness","label":"สร้างการรับรู้","direction":"awareness","cta":""},{"id":"education","label":"ให้ความรู้","direction":"education","cta":""},{"id":"engagement","label":"ชวนพูดคุย","direction":"engagement","cta":""},{"id":"trust","label":"เพิ่มความเชื่อมั่น","direction":"trust","cta":""},{"id":"sales","label":"กระตุ้นยอดขาย","direction":"sales","cta":""}]');
create trigger content_goal_revision before update on pp.content_goal_settings for each row execute function pp.pp_content_revision();
