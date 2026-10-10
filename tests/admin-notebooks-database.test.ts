import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
const db = new PGlite();
const owner = `U${"a".repeat(32)}`, friend = `U${"b".repeat(32)}`, group = `C${"a".repeat(32)}`, disabled = `C${"b".repeat(32)}`;
type Snapshot = { notes: { id: string; content: string; group: string | null; sourceLabel: string }[]; events: { id: string; scope_key: string; reminder_time: string }[]; deliveries: { event_id: string; target: string }[] };
const read = async () => (await db.query<{r:Snapshot}>("select pp.pp_admin_notebooks() r")).rows[0].r;
beforeAll(async()=>{
 await db.exec("create role authenticator;create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);");
 const dir=new URL("../supabase/migrations/",import.meta.url);
 for(const f of readdirSync(dir).filter(f=>f.endsWith('.sql')&&!f.endsWith('_pp_minute_reminder_scheduler.sql')).sort()) await db.exec(readFileSync(new URL(f,dir),'utf8'));
},30000);
afterAll(()=>db.close());
beforeEach(async()=>{
 await db.exec("reset role;truncate pp.assistant_notes,pp.assistant_events,pp.permissions cascade;");
 await db.query("update pp.owner set line_user_id=$1 where id=1",[owner]);
 await db.query("insert into pp.permissions(group_id,label,enabled) values($1,'โจอา',true),($2,'ปิด',false)",[group,disabled]);
 for(const scope of [owner,friend,group,disabled]){
   await db.query("insert into pp.assistant_notes(id,scope_key,sender_id,title,content) values($1,$2,$3,'กาแฟ',$2)",[randomUUID(),scope,owner]);
   const id=randomUUID();
   await db.query("insert into pp.assistant_events(id,scope_key,sender_id,title,content,event_date,reminder_time) values($1,$2,$3,'นัด','13:00','2026-10-10','13:00')",[id,scope,owner]);
   await db.query("insert into pp.assistant_deliveries(event_id,occurs_on,lead_days,lease_until,payload) values($1,'2026-10-10',0,now(),'[]')",[id]);
 }
 await db.exec("set role service_role");
});
it("returns only owner DM and currently allowed groups, including matching delivery recipients",async()=>{
 const data=await read();
 expect(data.notes.map(n=>[n.group,n.sourceLabel])).toEqual([[null,'แชตส่วนตัวของฉัน'],[group,'กลุ่ม โจอา']]);
 expect(data.events.map(e=>e.scope_key).sort()).toEqual([owner,group].sort());
 expect(data.events.every(e=>e.reminder_time==='13:00')).toBe(true);
 expect(data.deliveries.map(d=>d.target).sort()).toEqual([owner,group].sort());
 expect(JSON.stringify(data)).not.toContain(friend);expect(JSON.stringify(data)).not.toContain(disabled);
 expect(data.deliveries.every(d=>data.events.some(e=>e.id===d.event_id))).toBe(true);
});
it("returns no notebooks when owner identity is unset",async()=>{await db.query("update pp.owner set line_user_id=null where id=1");expect(await read()).toEqual({notes:[],events:[],deliveries:[]});});
it("honors permission changes and edits on the very next read",async()=>{
 await read();await db.query("update pp.permissions set enabled=false where group_id=$1",[group]);
 await db.query("update pp.assistant_notes set content='หวานน้อย' where scope_key=$1",[owner]);
 const data=await read();expect(data.notes).toHaveLength(1);expect(data.notes[0].content).toBe('หวานน้อย');expect(data.events).toHaveLength(1);expect(data.deliveries).toHaveLength(1);
});
it("denies both anonymous and ordinary authenticated clients",async()=>{
 for(const role of ['anon','authenticated']) {await db.exec(`set role ${role}`);await expect(read()).rejects.toThrow();await db.exec('reset role');}
});
it("retains the 200-note and 100-appointment bounds per notebook",async()=>{
 await db.query("insert into pp.assistant_notes(id,scope_key,sender_id,title,content) select gen_random_uuid(),$1,$1,'test','test' from generate_series(1,220)",[owner]);
 await db.query("insert into pp.assistant_events(id,scope_key,sender_id,title,content,event_date) select gen_random_uuid(),$1,$1,'test','test','2026-10-11' from generate_series(1,120)",[owner]);
 const data=await read();expect(data.notes.filter(n=>n.group===null)).toHaveLength(200);expect(data.events.filter(e=>e.scope_key===owner)).toHaveLength(100);
});
