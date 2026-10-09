import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {beforeAll,afterAll,beforeEach,expect,it} from "vitest";
const db=new PGlite(), owner="U"+"a".repeat(32);
const migration=(name:string)=>readFileSync(new URL("../supabase/migrations/"+name,import.meta.url),"utf8");
beforeAll(async()=>{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);");
 for(const name of ["20260929034158_pp_initial.sql","20260929121726_pp_semantic_matching.sql","20260930100702_pp_memory_owner_mention.sql","20260930104029_pp_owner_private_chat.sql","20260930112803_pp_library_calendar.sql","20261009065258_personal_secretary.sql","20261009130907_pp_calendar_reminder_time.sql"])await db.exec(migration(name));
 await db.query("update pp.owner set line_user_id=$1",[owner]);
 // PostgreSQL stubs capture requests; no network or LINE service is used.
 await db.exec(`create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);create function vault.create_secret(secret text,new_name text,description text) returns uuid language plpgsql as $$begin insert into vault.decrypted_secrets values(new_name,secret);return gen_random_uuid();end;$$;
 create schema net;create table net.requests(id bigint generated always as identity,headers jsonb,url text);create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$insert into net.requests(headers,url) values(headers,url) returning id;$$;
 create schema cron;create table cron.job(jobid bigint generated always as identity,jobname text,active boolean,command text,schedule text);create table cron.job_run_details(jobid bigint,end_time timestamptz);create function cron.schedule(job_name text,schedule text,command text) returns bigint language sql as $$insert into cron.job(jobname,active,command,schedule) values(job_name,true,command,schedule) returning jobid;$$;create function cron.alter_job(job_id bigint,active boolean) returns void language sql as $$update cron.job set active=alter_job.active where jobid=job_id;$$;`);
 await db.exec(migration("20261009130918_pp_minute_reminder_scheduler.sql").replace(/^create extension[^;]+;/gm,""));
},30000);
afterAll(()=>db.close());
beforeEach(async()=>{await db.exec("reset role;truncate pp.calendar_events,pp.assistant_events,net.requests cascade;");});
const get=async<T>(sql:string,args:unknown[]=[]) => (await db.query<{r:T}>(sql,args)).rows[0].r;
async function event(assistant=false){const id=randomUUID();await db.query(assistant?"insert into pp.assistant_events(id,scope_key,sender_id,title,content,event_date,reminder_time) values($1,$2,$2,'test','text',(now() at time zone 'Asia/Bangkok')::date,to_char(now() at time zone 'Asia/Bangkok','HH24:MI'))":"insert into pp.calendar_events(id,title,message,event_date,reminder_time,enabled) values($1,'test','text',(now() at time zone 'Asia/Bangkok')::date,to_char(now() at time zone 'Asia/Bangkok','HH24:MI'),true)",assistant?[id,owner]:[id]);return id;}
async function claim(id:string,assistant=false){return get<{id:string;retry_key:string;attempts:number}|null>(assistant?"select pp.pp_claim_assistant_reminder($1,(now() at time zone 'Asia/Bangkok')::date,0) r":"select pp.pp_claim_reminder($1,(now() at time zone 'Asia/Bangkok')::date,0,$2) r",assistant?[id]:[id,owner]);}
it("enforces clock boundaries and local-midnight retry window in SQL",async()=>{
 const check=(when:string,date="2026-10-10",time="13:00",lead=0)=>get<boolean>("select pp.pp_reminder_due($1,false,$2,$1,$3,$4) r",[date,time,lead,when]);
 expect(await check("2026-10-10T05:59:59Z")).toBe(false);expect(await check("2026-10-10T06:00:00Z")).toBe(true);expect(await check("2026-10-10T06:10:00Z")).toBe(false);
 expect(await check("2026-10-10T17:01:00Z","2026-10-10","23:59")).toBe(true);expect(await check("2026-10-09T06:00:00Z","2026-10-10","13:00",1)).toBe(true);
});
it("leases each due manual delivery once, keeps retry key, excludes completed work",async()=>{
 const id=await event();expect(await get("select pp.pp_has_due_reminders() r")).toBe(true);const first=await claim(id);expect(first?.attempts).toBe(1);expect(await claim(id)).toBeNull();expect(await get("select pp.pp_has_due_reminders() r")).toBe(false);
 await db.query("update pp.reminder_deliveries set status='failed',lease_until=now()-interval '1 second' where event_id=$1",[id]);expect(await get("select pp.pp_has_due_reminders() r")).toBe(true);const retry=await claim(id);expect(retry?.retry_key).toBe(first?.retry_key);expect(retry?.attempts).toBe(2);
 await db.query("update pp.reminder_deliveries set status='sent' where event_id=$1",[id]);expect(await claim(id)).toBeNull();expect(await get("select pp.pp_has_due_reminders() r")).toBe(false);
});
it("assistant queue obeys the same clock and deduplication",async()=>{const id=await event(true);expect(await get("select pp.pp_has_due_reminders() r")).toBe(true);expect(await claim(id,true)).not.toBeNull();expect(await claim(id,true)).toBeNull();expect(await get("select pp.pp_has_due_reminders() r")).toBe(false);});
it("changed time cannot be claimed early and invalid time is rejected",async()=>{const id=await event();await db.query("update pp.calendar_events set reminder_time=to_char((now() at time zone 'Asia/Bangkok')+interval '1 hour','HH24:MI') where id=$1",[id]);expect(await claim(id)).toBeNull();for(const time of ['24:00','13:60','1:00'])await expect(db.query("update pp.calendar_events set reminder_time=$1 where id=$2",[time,id])).rejects.toThrow();});
it("starts disabled and authenticates probes without dispatching a reminder",async()=>{
 expect(await get("select enabled r from pp.reminder_scheduler")).toBe(false);expect(await get("select active r from cron.job where jobname='pp-reminders-minute'")).toBe(false);
 expect(await get("select pp.pp_dispatch_reminder_tick() r")).toBeNull();expect(await get("select pp.pp_dispatch_reminder_tick(true) r")).not.toBeNull();expect(await get<string>("select url r from net.requests limit 1")).toContain("?probe=1");
 expect(await get("select pp.pp_authorize_reminder_tick('invalid') r")).toBe(false);expect(await get("select pp.pp_authorize_reminder_tick((select decrypted_secret from vault.decrypted_secrets where name='pp_minute_reminder_token')) r")).toBe(true);
});
it("anonymous clients cannot read scheduler data or trigger dispatch",async()=>{await db.exec("set role anon");await expect(db.query("select * from pp.reminder_scheduler")).rejects.toThrow();await expect(db.query("select pp.pp_dispatch_reminder_tick(true)")).rejects.toThrow();await expect(db.query("select pp.pp_authorize_reminder_tick('x')")).rejects.toThrow();});
