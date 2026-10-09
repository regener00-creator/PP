-- Dedicated PP job only. Shared website tables and existing jobs are untouched.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table pp.reminder_scheduler (
 id integer primary key check(id=1), enabled boolean not null default false,
 token_hash bytea not null, last_request_id bigint, last_dispatched_at timestamptz
);
alter table pp.reminder_scheduler enable row level security;
revoke all on pp.reminder_scheduler from public,anon,authenticated;
grant select on pp.reminder_scheduler to service_role;
-- Generate inside Postgres: no plaintext key is returned, logged, or put in Git.
do $$
declare token text := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
begin
 perform vault.create_secret(token,'pp_minute_reminder_token','PP reminder dispatcher only');
 insert into pp.reminder_scheduler(id,token_hash) values(1,sha256(convert_to(token,'UTF8')));
end;
$$;
create function pp.pp_authorize_reminder_tick(p_token text) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce((select token_hash=sha256(convert_to(p_token,'UTF8')) from pp.reminder_scheduler where id=1),false);
$$;
revoke all on function pp.pp_authorize_reminder_tick(text) from public,anon,authenticated;
grant execute on function pp.pp_authorize_reminder_tick(text) to service_role;

create function pp.pp_dispatch_reminder_tick(p_probe boolean default false) returns bigint
language plpgsql security invoker set search_path='' as $$
declare token text; request_id bigint;
begin
 if not p_probe and (not coalesce((select enabled from pp.reminder_scheduler where id=1),false) or not pp.pp_has_due_reminders()) then return null; end if;
 if not pg_try_advisory_xact_lock(hashtextextended('pp:minute-dispatch',0)) then return null; end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='pp_minute_reminder_token';
 if token is null then raise exception 'PP reminder token unavailable'; end if;
 select net.http_post(
  url := 'https://pp-theta-beryl.vercel.app/api/reminders/tick'||case when p_probe then '?probe=1' else '' end,
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),
  body := '{}'::jsonb, timeout_milliseconds := 240000
 ) into request_id;
 update pp.reminder_scheduler set last_request_id=request_id,last_dispatched_at=now() where id=1;
 return request_id;
end;
$$;
revoke all on function pp.pp_dispatch_reminder_tick(boolean) from public,anon,authenticated,service_role;
-- Create disabled until the new production worker has been verified with a no-send probe.
do $$
declare job bigint;
begin
 job:=cron.schedule('pp-reminders-minute','* * * * *','select pp.pp_dispatch_reminder_tick();');
 perform cron.alter_job(job,active:=false);
end;
$$;
-- Bound only PP job history. Do not delete another project's cron logs.
select cron.schedule('pp-reminder-log-cleanup','15 19 * * *',
 $job$delete from cron.job_run_details where jobid in (select jobid from cron.job where jobname in ('pp-reminders-minute','pp-reminder-log-cleanup')) and end_time<now()-interval '7 days';$job$);
notify pgrst,'reload schema';
