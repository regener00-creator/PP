import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
const db = new PGlite();
const group = `C${"c".repeat(32)}`, sender = `U${"b".repeat(32)}`;
async function answer(question: string, g = group, s = sender) {
  const result = await db.query<{ result: { decision: string; answer?: string } }>("select pp.pp_answer($1,$2,$3) as result", [question, g, s]);
  return result.rows[0].result;
}
async function memory(visibility: string, content: string, aliases = ["อาหาร"], expires: string | null = null) {
  await db.query("insert into pp.memories(title,content,visibility,aliases,expires_at) values ('title',$1,$2,$3,$4)", [content, visibility, aliases, expires]);
}
async function claim(event = "evt", lease = randomUUID()) {
  const result = await db.query<{ result: string }>("select pp.pp_claim_event($1,$2,$3,'message',$4) as result", [event, group, sender, lease]);
  return result.rows[0].result;
}
async function enableLearning(){await db.query("select pp.pp_set_learning_group($1,true)",[group]);}
async function captureLearning(message:string=randomUUID(),who=sender){
  return (await db.query<{ok:boolean}>("select pp.pp_capture_learning($1,$2,$3,$3,'เราชอบกาแฟ',now()) as ok",[group,who,message])).rows[0].ok;
}
async function learningClaim(){return (await db.query<{r:{reason:string;run_id:string}}>("select pp.pp_claim_learning() as r")).rows[0].r;}
async function learningDraft(){
  await enableLearning();await captureLearning("coffee-source");const run=await learningClaim();
  const items=[{sender_id:sender,title:"กาแฟที่ชอบ",content:"ฟิ้งชอบกาแฟ",questions:["ฟิ้งชอบอะไร"],aliases:["ฟิ้งชอบอะไร"],category:"preference",source_message_ids:["coffee-source"]}];
  await db.query("select pp.pp_finish_learning($1,$2::jsonb,100,100,false)",[run.run_id,JSON.stringify(items)]);
  return (await db.query<{id:string}>("select id from pp.learning_suggestions")).rows[0].id;
}
async function approveDraft(id:string){return (await db.query<{ok:boolean}>("select pp.pp_review_learning($1,'กาแฟที่ชอบ','ฟิ้งชอบกาแฟ',array['ฟิ้งชอบอะไร'],array['ฟิ้งชอบอะไร']) as ok",[id])).rows[0].ok;}
describe("real PostgreSQL migration and privacy boundary", () => {
  beforeAll(async () => {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;");
    await db.exec("create table public.existing_app(id integer primary key, value text); insert into public.existing_app values (1,'UNCHANGED');");
    await db.exec(readFileSync(new URL("../supabase/migrations/20260929034158_pp_initial.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20260929121726_pp_semantic_matching.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20260930100702_pp_memory_owner_mention.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20260930104029_pp_owner_private_chat.sql", import.meta.url), "utf8"));
    await db.exec("create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint)");
    await db.exec(readFileSync(new URL("../supabase/migrations/20260930112803_pp_library_calendar.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20260930120150_pp_detach_deleted_files.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261001014521_pp_ten_attachments.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261001043509_pp_memory_layout.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261001052545_pp_memory_append.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261001054547_pp_group_learning.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261001063310_pp_unknown_reply.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261001063825_pp_unknown_reply_variants.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261001070842_pp_shareable_defaults.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261001072625_pp_owner_semantic_matching.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261001073157_pp_direct_semantic_chat.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261001081525_pp_memory_assistant.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261001084039_pp_memory_issue_layout.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261005112537_pp_memory_answer_variants.sql", import.meta.url), "utf8"));
  }, 30000);
  beforeEach(async () => {
    await db.exec("reset role; truncate pp.memories, pp.conversations, pp.rate_limits, pp.friends, pp.permissions, pp.ai_usage, pp.files, pp.folders, pp.learning_runs cascade");
    await db.query("insert into pp.permissions(group_id,enabled) values ($1,true)", [group]);
    await db.query("insert into pp.friends(group_id,line_user_id) values ($1,$2)", [group, sender]);
    await db.query("update pp.owner set line_user_id=$1 where id=1", [sender]);
    await db.exec("set role service_role");
  });
  afterAll(async () => { await db.close(); });
  it("randomizes complete saved replies for exact and semantic matches in groups and DMs", async () => {
    await memory("shareable", "คำตอบหนึ่ง", ["อาหารโปรด"]);
    await db.exec("update pp.memories set answer_variants=array['คำตอบสอง','คำตอบสาม'],mention_owner=true; select setseed(0.42)");
    const c=(await candidates())[0], lease=randomUUID(); await directClaim(lease);
    const dc=(await directCandidates(lease) as OwnerCandidate[])[0];
    const seen=[new Set<string>(),new Set<string>(),new Set<string>(),new Set<string>()];
    for(let i=0;i<30;i++) {
      const outputs=[await answer("อาหารโปรด"),await semanticAnswer(c),await directRead(lease),await directAnswer(dc,lease)];
      outputs.forEach((r,j)=>{ expect(r.decision).toBe("answer"); expect(["คำตอบหนึ่ง","คำตอบสอง","คำตอบสาม"]).toContain(r.answer); seen[j].add(r.answer!); });
      expect(outputs[0]).toMatchObject({mention_owner:true}); expect(outputs[1]).toMatchObject({mention_owner:true});
    }
    seen.forEach(values=>expect(values.size).toBe(3));
    expect((await db.query("select * from pp.ai_usage")).rows).toHaveLength(0);
  });
  it("saves, searches, reloads and explicitly removes variants, preserving them for old clients", async () => {
    const value={title:"ทดสอบหลายคำตอบ",content:"หลัก",answer_variants:["คำตอบค้นเจอ","อีกแบบ\nหลายบรรทัด"],aliases:["ถาม"],question_examples:["ถาม"],mention_owner:false,attachment_ids:[],expires_at:null};
    const save=async(v:unknown)=> (await db.query<{r:{decision:string;id:string}}>("select pp.pp_save_assisted_memory($1,pp.pp_memory_catalog()->>'revision') r",[JSON.stringify(v)])).rows[0].r;
    const first=await save(value); expect(first.decision).toBe("saved");
    expect((await db.query<{answer_variants:string[]}>("select * from pp.pp_search_memories('ค้นเจอ')")).rows[0].answer_variants).toEqual(value.answer_variants);
    const catalog=(await db.query<{r:{memories:{answer_variants:string[]}[]}}>("select pp.pp_memory_catalog() r")).rows[0].r;
    expect(catalog.memories[0].answer_variants).toEqual(value.answer_variants);
    const {answer_variants,...legacy}=value; await save({...legacy,id:first.id});
    expect((await db.query<{answer_variants:string[]}>("select answer_variants from pp.memories")).rows[0].answer_variants).toEqual(answer_variants);
    await save({...value,id:first.id,answer_variants:[]}); expect(await answer("ถาม")).toMatchObject({answer:"หลัก"});
  });
  it("rejects malformed, empty, oversized and excessive reply variants", async () => {
    await memory("shareable","หลัก");
    for(const variants of [[""],["   "],[null],["x".repeat(2001)],Array(20).fill("x")]) {
      await expect(db.query("update pp.memories set answer_variants=$1::text[]",[variants])).rejects.toThrow(/check constraint/);
    }
    await db.query("update pp.memories set answer_variants=$1::text[]",[Array(19).fill("x".repeat(2000))]);
  });
  it("rechecks access, expiry and revisions before randomly selecting any answer", async () => {
    await seedSemantic(); await db.exec("update pp.memories set answer_variants=array['ALT_CANARY']");
    const old=(await candidates())[0];const lease=randomUUID(); await directClaim(lease);const dc=(await directCandidates(lease) as OwnerCandidate[])[0];
    await db.exec("update pp.memories set answer_variants=array['CHANGED_CANARY']");
    expect((await semanticAnswer(old)).decision).toBe("unknown");expect((await directAnswer(dc,lease)).decision).toBe("unknown");
    await db.exec("update pp.memories set expires_at=now()-interval '1 second'");
    expect((await answer("อาหารโปรด")).decision).toBe("unknown");expect((await directRead(lease)).decision).toBe("unknown");
    await db.exec("update pp.memories set expires_at=null,visibility='private'");
    expect((await answer("อาหารโปรด")).decision).toBe("refuse");expect((await directRead(lease)).decision).toBe("refuse");
    expect(JSON.stringify(await candidates())).not.toContain("CANARY");expect(JSON.stringify(await directCandidates(lease))).not.toContain("CANARY");
  });
  it("treats identical first replies with different alternate replies as conflicting", async () => {
    await memory("shareable","เหมือนกัน");await memory("shareable","เหมือนกัน");
    await db.exec("update pp.memories set answer_variants=array['ต่างกัน'] where id=(select id from pp.memories order by id limit 1)");
    expect((await answer("อาหาร")).decision).toBe("conflict");
    const lease=randomUUID();await directClaim(lease);expect((await directRead(lease,"อาหาร")).decision).toBe("conflict");
  });

  it("defaults new records to shareable without republishing legacy private rows or opening storage", async () => {
    await memory("private", "LEGACY_PRIVATE");
    await db.exec("insert into pp.files(name,object_path,mime,bytes,visibility) values ('old.txt','legacy/file','text/plain',1,'private')");
    await db.exec("reset role");
    await db.exec(readFileSync(new URL("../supabase/migrations/20261001070842_pp_shareable_defaults.sql", import.meta.url), "utf8"));
    expect((await db.query<{public:boolean}>("select public from storage.buckets where id='pp-files'")).rows[0].public).toBe(false);
    await db.exec("set role service_role");
    expect((await db.query<{visibility:string}>("select visibility from pp.memories")).rows[0].visibility).toBe("private");
    expect((await db.query<{visibility:string}>("select visibility from pp.files")).rows[0].visibility).toBe("private");
    const created = await db.query<{visibility:string}>("insert into pp.memories(title,content,aliases) values ('new','รหัสสินค้า JOAH-01',array['ขอรหัสสินค้า']) returning visibility");
    expect(created.rows[0].visibility).toBe("shareable");
    const file = await db.query<{visibility:string}>("insert into pp.files(name,object_path,mime,bytes) values ('new.txt','new/file','text/plain',1) returning visibility");
    expect(file.rows[0].visibility).toBe("shareable");
    expect(await answer("ขอรหัสสินค้า")).toEqual({ decision: "answer", answer: "รหัสสินค้า JOAH-01" });
    expect(await answer("อาหาร")).toEqual({ decision: "refuse" });
  });
  it("validates stored fallback text and preserves the owner's identity", async () => {
    expect((await db.query<{unknown_reply:string}>("select unknown_reply from pp.owner where id=1")).rows[0].unknown_reply).toBe("ยังไม่มีข้อมูลเรื่องนี้");
    await db.query("update pp.owner set unknown_reply=$1 where id=1", ["ยังไม่ทราบครับ\nถามเรื่องอื่นได้เลย"]);
    expect((await db.query<{line_user_id:string}>("select line_user_id from pp.owner where id=1")).rows[0].line_user_id).toBe(sender);
    for (const value of ["", " \n ", "ก".repeat(2001)]) await expect(db.query("update pp.owner set unknown_reply=$1 where id=1", [value])).rejects.toThrow(/check constraint/);
    await db.exec("update pp.owner set unknown_reply=default where id=1");
  });
  it("stores fallback variants and rejects empty, oversized and null alternatives", async () => {
    expect((await db.query<{unknown_replies:string[]}>("select unknown_replies from pp.owner where id=1")).rows[0].unknown_replies).toEqual(["ยังไม่มีข้อมูลเรื่องนี้"]);
    const replies = ["ยังไม่ทราบครับ\nลองถามเรื่องอื่น", "ยังไม่มีข้อมูลนี้"];
    await db.query("update pp.owner set unknown_replies=$1 where id=1", [replies]);
    expect((await db.query<{unknown_replies:string[]}>("select unknown_replies from pp.owner where id=1")).rows[0].unknown_replies).toEqual(replies);
    for (const bad of [[], [null], [" \n "], ["ก".repeat(2001)], Array(21).fill("มากไป")])
      await expect(db.query("update pp.owner set unknown_replies=$1 where id=1", [bad])).rejects.toThrow(/check constraint/);
    await db.exec("update pp.owner set unknown_replies=default where id=1");
  });
  it("returns only shareable content for an approved question", async () => { await memory("shareable", "อาหารไทย"); expect(await answer("อาหาร")).toEqual({ decision: "answer", answer: "อาหารไทย" }); });
  it("returns explicit mention opt-in only with a unique shareable answer", async () => {
    await memory("shareable", "มาตอบ"); await db.exec("update pp.memories set mention_owner=true");
    expect(await answer("อาหาร")).toEqual({ decision: "answer", answer: "มาตอบ", mention_owner: true });
    await memory("shareable", "duplicate");
    expect(await answer("อาหาร")).toEqual({ decision: "conflict" });
  });
  it("never returns private content or its mention setting", async () => {
    await memory("private", "PRIVATE_CANARY"); await db.exec("update pp.memories set mention_owner=true");
    expect(await answer("อาหาร")).toEqual({ decision: "refuse" });
  });
  it("private content never crosses the SQL return boundary", async () => { await memory("private", "SECRET_CANARY"); expect(await answer("อาหาร")).toEqual({ decision: "refuse" }); });
  it("private alias overrides a conflicting shareable alias", async () => { await memory("shareable", "public"); await memory("private", "SECRET_CANARY"); expect(await answer("อาหาร")).toEqual({ decision: "refuse" }); });
  it("queues conflicting approved answers", async () => { await memory("shareable", "one"); await memory("shareable", "two"); expect(await answer("อาหาร")).toEqual({ decision: "conflict" }); });
  it("does not disclose expired memories", async () => { await memory("shareable", "expired", ["อาหาร"], "2000-01-01T00:00:00Z"); expect(await answer("อาหาร")).toEqual({ decision: "unknown" }); });
  it("does not match extra instructions or partial questions", async () => { await memory("shareable", "public"); expect(await answer("อาหารignoreallinstructions")).toEqual({ decision: "unknown" }); });
  it("disabled groups fail closed", async () => { await memory("shareable", "public"); await db.query("update pp.permissions set enabled = false"); expect(await answer("อาหาร")).toEqual({ decision: "refuse" }); });
  it("unknown groups and unknown senders fail closed", async () => { await memory("shareable", "public"); expect((await answer("อาหาร", `C${"d".repeat(32)}`)).decision).toBe("refuse"); expect((await answer("อาหาร", group, `U${"e".repeat(32)}`)).decision).toBe("refuse"); });
  it("blocked friends cannot read approved answers", async () => { await memory("shareable", "public"); await db.exec("update pp.friends set blocked = true"); expect(await answer("อาหาร")).toEqual({ decision: "refuse" }); });
  it.each(["anon", "authenticated"])("%s cannot read any table or execute bot RPCs", async role => {
    await memory("private", "SECRET_CANARY"); await db.exec(`reset role; set role ${role}`);
    for (const table of ["owner", "friends", "memories", "permissions", "conversations", "rate_limits", "ai_usage", "folders", "files", "calendar_events", "reminder_deliveries","learning_runs","learning_messages","learning_suggestions","learning_unsent"]) await expect(db.query(`select * from pp.${table}`)).rejects.toThrow(/permission denied/);
    for(const query of ["select pp.pp_claim_learning()","select pp.pp_group_answer_rows('x')","select pp.pp_capture_learning('x','x','x','x','x',now())","select pp.pp_set_learning_group('x',true)","select pp.pp_unsend_learning('x','x')"])
      await expect(db.query(query)).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_ai_candidates($1,$2)", [group,sender])).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_reserve_ai(1000)")).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_owner_answer('x',$1,'evt',$2)", [sender, randomUUID()])).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_claim_owner_event('evt',$1,'msg',$2)", [sender, randomUUID()])).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_owner_ai_candidates($1,'evt',$2)", [sender, randomUUID()])).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_owner_ai_answer($1,'rev','q',$2,'evt',$3)", [randomUUID(),sender,randomUUID()])).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_claim_direct_event('evt',$1,'msg',$2)",[sender,randomUUID()])).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_direct_answer('q',$1,'evt',$2)",[sender,randomUUID()])).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_direct_ai_candidates($1,'evt',$2)",[sender,randomUUID()])).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_direct_ai_answer($1,'rev','q',$2,'evt',$3)",[randomUUID(),sender,randomUUID()])).rejects.toThrow(/permission denied/);
    await expect(answer("อาหาร")).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_search_memories('')")).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_save_memory_layout('[]'::jsonb)")).rejects.toThrow(/permission denied/);
    await expect(db.query("select nextval('pp.memory_sort_order_seq')")).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_claim_reminder($1,current_date,0,$2)", [randomUUID(),sender])).rejects.toThrow(/permission denied/);
    await expect(claim()).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_cleanup()")).rejects.toThrow(/permission denied/);
  });
  it("all sixteen tables have RLS enabled", async () => {
    const result = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relnamespace = 'pp'::regnamespace and relkind = 'r'");
    expect(result.rows).toHaveLength(16); expect(result.rows.every(row => row.relrowsecurity)).toBe(true);
  });
  it("captures only after group opt-in, deduplicates delivery and excludes opted-out or blocked senders",async()=>{
    expect(await captureLearning()).toBe(false);await enableLearning();
    expect(await captureLearning("same")).toBe(true);expect(await captureLearning("same")).toBe(false);
    await db.query("select pp.pp_set_learning_friend($1,$2,true)",[group,sender]);expect(await captureLearning()).toBe(false);
    expect((await db.query("select * from pp.learning_messages")).rows).toHaveLength(0);
    await db.query("select pp.pp_set_learning_friend($1,$2,false)",[group,sender]);await db.exec("update pp.friends set blocked=true");
    expect(await captureLearning()).toBe(false);
    expect((await db.query<{ok:boolean}>("select pp.pp_capture_learning($1,$2,'old','old','ข้อความเก่า',now()-interval '1 day') as ok",[group,sender])).rows[0].ok).toBe(false);
  });
  it("keeps pending drafts out of exact and AI replies; approval is scoped to the original group",async()=>{
    const id=await learningDraft();expect(await answer("ฟิ้งชอบอะไร")).toEqual({decision:"unknown"});
    expect((await db.query<{r:unknown[]}>("select pp.pp_ai_candidates($1,$2) as r",[group,sender])).rows[0].r).toEqual([]);
    expect(await approveDraft(id)).toBe(true);expect(await answer("ฟิ้งชอบอะไร")).toEqual({decision:"answer",answer:"ฟิ้งชอบกาแฟ"});
    const other=`C${"d".repeat(32)}`;await db.query("insert into pp.permissions(group_id,enabled) values($1,true)",[other]);await db.query("insert into pp.friends(group_id,line_user_id) values($1,$2)",[other,sender]);
    expect(await answer("ฟิ้งชอบอะไร",other)).toEqual({decision:"unknown"});
    const c=(await db.query<{r:{id:string;revision:string;questions:string[]}[]}>("select pp.pp_ai_candidates($1,$2) as r",[group,sender])).rows[0].r[0];
    expect(c.questions).toEqual(["ฟิ้งชอบอะไร"]);
    expect((await db.query<{r:unknown}>("select pp.pp_ai_answer($1,$2,'ฟิ้งชอบอะไร',$3,$4) as r",[id,c.revision,group,sender])).rows[0].r).toEqual({decision:"answer",answer:"ฟิ้งชอบกาแฟ"});
    await db.query("select pp.pp_set_learning_group($1,false)",[group]);
    expect(await answer("ฟิ้งชอบอะไร")).toEqual({decision:"unknown"});
    expect((await db.query<{r:{decision:string}}>("select pp.pp_ai_answer($1,$2,'ฟิ้งชอบอะไร',$3,$4) as r",[id,c.revision,group,sender])).rows[0].r.decision).toBe("unknown");
  });
  it("private aliases and conflicting approved memories still veto learned answers",async()=>{
    const id=await learningDraft();await memory("private","PRIVATE_CANARY",["ฟิ้งชอบอะไร"]);expect(await approveDraft(id)).toBe(false);
    expect(await answer("ฟิ้งชอบอะไร")).toEqual({decision:"refuse"});
    await db.exec("delete from pp.memories");expect(await approveDraft(id)).toBe(true);
    await memory("shareable","another answer",["ฟิ้งชอบอะไร"]);expect(await answer("ฟิ้งชอบอะไร")).toEqual({decision:"conflict"});
  });
  it("drops unsent evidence, approved facts and late redeliveries",async()=>{
    const id=await learningDraft();await approveDraft(id);
    await db.query("select pp.pp_unsend_learning($1,'coffee-source')",[group]);
    expect((await db.query("select * from pp.learning_suggestions")).rows).toHaveLength(0);
    expect(await captureLearning("coffee-source")).toBe(false);
    expect(await answer("ฟิ้งชอบอะไร")).toEqual({decision:"unknown"});
  });
  it("reserves only one call per window and retains failed-call reservations",async()=>{
    await enableLearning();await captureLearning();
    const runs=await Promise.all([learningClaim(),learningClaim(),learningClaim()]);
    expect(runs.filter(r=>r.reason==="claimed")).toHaveLength(1);
    const id=runs.find(r=>r.reason==="claimed")!.run_id;
    await db.query("select pp.pp_finish_learning($1,'[]'::jsonb,10000,1000,true)",[id]);
    expect((await learningClaim()).reason).toBe("waiting");
  });
  it("enforces the monthly learning budget before claiming any messages",async()=>{
    await enableLearning();await captureLearning();
    await db.exec("insert into pp.learning_runs(window_start,month,group_id,status) select now()-n*interval '6 hours',date_trunc('month',now() at time zone 'Asia/Bangkok')::date,'quota-test','done' from generate_series(1,120) n");
    expect((await learningClaim()).reason).toBe("limit");
    expect((await db.query("select * from pp.learning_messages where run_id is null")).rows).toHaveLength(1);
  });
  it("rejects cross-person evidence and discards results when consent changes during generation",async()=>{
    await enableLearning();await captureLearning("source");const run=await learningClaim();
    const other=`U${"d".repeat(32)}`;await db.query("insert into pp.friends(group_id,line_user_id) values($1,$2)",[group,other]);
    const item={sender_id:other,title:"wrong person",content:"wrong",questions:["wrong"],aliases:["wrong"],category:"preference",source_message_ids:["source"]};
    await db.query("select pp.pp_finish_learning($1,$2::jsonb,1,1,false)",[run.run_id,JSON.stringify([item])]);
    expect((await db.query("select * from pp.learning_suggestions")).rows).toHaveLength(0);
    await db.exec("delete from pp.learning_runs");await captureLearning("new");const next=await learningClaim();
    await db.query("select pp.pp_set_learning_group($1,false)",[group]);
    expect((await db.query<{n:number}>("select pp.pp_finish_learning($1,'[]'::jsonb,1,1,false) as n",[next.run_id])).rows[0].n).toBe(0);
    expect((await db.query("select * from pp.learning_messages")).rows).toHaveLength(0);
  });
  it("expires learned facts and deletes learning data on retention cleanup",async()=>{
    const id=await learningDraft();await approveDraft(id);
    await db.exec("update pp.learning_suggestions set expires_at=now()-interval '1 second'; update pp.learning_messages set created_at=now()-interval '8 days'");
    expect(await answer("ฟิ้งชอบอะไร")).toEqual({decision:"unknown"});
    await db.exec("select pp.pp_cleanup()");
    expect((await db.query("select * from pp.learning_suggestions")).rows).toHaveLength(0);expect((await db.query("select * from pp.learning_messages")).rows).toHaveLength(0);
  });
  it("saves colours and reorders a filtered subset atomically without changing hidden slots or content", async () => {
    const ids=[randomUUID(),randomUUID(),randomUUID(),randomUUID()];
    for(let i=0;i<ids.length;i++)await db.query("insert into pp.memories(id,title,content,visibility,aliases,sort_order) values ($1,$2,'PRIVATE_CANARY','private',array['layout'],$3)",[ids[i],`item ${i}`,i+1]);
    const before=(await db.query("select id,content,visibility,updated_at from pp.memories order by id")).rows;
    await db.query("select pp.pp_save_memory_layout($1::jsonb)",[JSON.stringify([{id:ids[3],card_color:"blue"},{id:ids[1],card_color:"green"}])]);
    const rows=(await db.query<{id:string;card_color:string|null}>("select id,card_color from pp.pp_search_memories('')")).rows;
    expect(rows.map(row=>row.id)).toEqual([ids[0],ids[3],ids[2],ids[1]]);
    expect(rows.map(row=>row.card_color)).toEqual([null,"blue",null,"green"]);
    expect((await db.query("select id,content,visibility,updated_at from pp.memories order by id")).rows).toEqual(before);
    expect(await answer("layout")).toEqual({decision:"refuse"});
    await db.query("select pp.pp_save_memory_layout($1::jsonb)",[JSON.stringify([{id:ids[3],card_color:null}])]);
    expect((await db.query<{card_color:null}>("select card_color from pp.memories where id=$1",[ids[3]])).rows[0].card_color).toBeNull();
  });
  it("appends new memories after saved order, including after edits, deletion and another rearrangement", async () => {
    for (const content of ["first", "second", "third"]) await memory("shareable", content);
    const saved=(await db.query<{id:string;content:string}>("select id,content from pp.pp_search_memories('')")).rows;
    expect(saved.map(row=>row.content)).toEqual(["first","second","third"]);
    await db.query("select pp.pp_save_memory_layout($1::jsonb)",[JSON.stringify([
      {id:saved[2].id,card_color:"yellow"},{id:saved[0].id,card_color:null},{id:saved[1].id,card_color:null}
    ])]);
    await db.query("update pp.memories set content='edited',updated_at=now() where id=$1",[saved[0].id]);
    await db.query("delete from pp.memories where id=$1",[saved[1].id]);
    const before=(await db.query("select * from pp.pp_search_memories('')")).rows;
    await memory("private","fourth");
    const after=(await db.query<{id:string;content:string;card_color:string|null}>("select * from pp.pp_search_memories('')")).rows;
    expect(after.slice(0,2)).toEqual(before);
    expect(after.map(row=>row.content)).toEqual(["third","edited","fourth"]);
    await db.query("select pp.pp_save_memory_layout($1::jsonb)",[JSON.stringify(after.toReversed().map(({id,card_color})=>({id,card_color})))]);
    await memory("shareable","fifth");
    expect((await db.query<{content:string}>("select content from pp.pp_search_memories('')")).rows.map(row=>row.content)).toEqual(["fourth","edited","third","fifth"]);
  });
  it.each([[],[0,0,0],[20,3,8]].map(ranks=>({ranks})))("initializes append order without moving existing ranks $ranks", async ({ranks}) => {
    const legacy = new PGlite();
    try {
      await legacy.exec("create role anon; create role authenticated; create role service_role; create schema pp; create table pp.memories(id integer primary key,sort_order bigint not null default 0)");
      for (const [id,rank] of ranks.entries()) await legacy.query("insert into pp.memories values ($1,$2)",[id,rank]);
      const before=(await legacy.query("select * from pp.memories order by id")).rows;
      await legacy.exec(readFileSync(new URL("../supabase/migrations/20261001052545_pp_memory_append.sql", import.meta.url), "utf8"));
      expect((await legacy.query("select * from pp.memories order by id")).rows).toEqual(before);
      const result=await legacy.query<{sort_order:number}>("insert into pp.memories(id) values (100) returning sort_order");
      expect(Number(result.rows[0].sort_order)).toBeGreaterThan(Math.max(ranks.length,...ranks));
    } finally { await legacy.close(); }
  });
  it("rejects deleted IDs, duplicate IDs, unsupported colours and empty layouts without partial writes", async () => {
    await memory("shareable","ORIGINAL");
    const original=(await db.query<{id:string}>("select * from pp.memories")).rows;
    const id=original[0].id;
    for(const input of [[],[{id,card_color:"purple"}],[{id,card_color:"green"},{id,card_color:"red"}],[{id,card_color:"yellow"},{id:randomUUID(),card_color:"blue"}]]){
      await expect(db.query("select pp.pp_save_memory_layout($1::jsonb)",[JSON.stringify(input)])).rejects.toThrow(/PP_(INVALID|STALE)_LAYOUT/);
      expect((await db.query("select * from pp.memories")).rows).toEqual(original);
    }
    await expect(db.query("update pp.memories set card_color='purple'")).rejects.toThrow(/check constraint/);
  });
  it("migration leaves the other project's tables intact", async () => {
    await db.exec("reset role");
    expect((await db.query("select * from public.existing_app")).rows).toEqual([{ id: 1, value: "UNCHANGED" }]);
  });
  it("concurrent duplicate deliveries have one claimant", async () => expect((await Promise.all([claim(), claim(), claim()])).sort()).toEqual(["busy", "busy", "claimed"]));
  it("finished replies stay deduplicated", async () => { await claim(); await db.exec("update pp.conversations set status='replied'"); expect(await claim()).toBe("done"); });
  it("failed delivery is retried and abandoned work can be reclaimed", async () => { await claim(); await db.exec("update pp.conversations set status='failed',lease_until=null"); expect(await claim()).toBe("claimed"); await db.exec("update pp.conversations set lease_until=now()-interval '1 second'"); expect(await claim()).toBe("claimed"); await db.exec("update pp.conversations set status='failed',lease_until=null"); expect(await claim()).toBe("done"); });
  it("rate limits are atomic and reset after expiry", async () => {
    const rate = async () => (await db.query<{ allowed: boolean }>("select pp.pp_take_rate('test',2,60) as allowed")).rows[0].allowed;
    expect(await Promise.all([rate(), rate(), rate()])).toEqual([true, true, false]);
    await db.exec("update pp.rate_limits set expires_at=now()-interval '1 second'"); expect(await rate()).toBe(true);
  });
  it("cleanup keeps recent events and removes old metadata", async () => {
    await claim("old"); await claim("new"); await db.exec("update pp.conversations set created_at=now()-interval '31 days' where event_id='old'; select pp.pp_cleanup()");
    expect((await db.query<{ event_id: string }>("select event_id from pp.conversations")).rows).toEqual([{ event_id: "new" }]);
  });

  it("keeps the Storage bucket private", async () => {
    await db.exec("reset role");
    expect((await db.query("select public,file_size_limit from storage.buckets where id='pp-files'")).rows).toEqual([{public:false,file_size_limit:3145728}]);
  });
  it("returns attachment identity only after the correct privacy boundary passes", async () => {
    await memory("private", "PRIVATE_MEDIA_CANARY"); const file=randomUUID();
    const updated=await db.query<{id:string}>("update pp.memories set attachment_ids=array[$1::uuid] returning id",[file]);
    expect(await answer("อาหาร")).toEqual({decision:"refuse"});
    const lease=randomUUID();await ownerClaim("dm",lease);
    expect(await ownerRead(lease)).toEqual({decision:"answer",answer:"PRIVATE_MEDIA_CANARY",memory_id:updated.rows[0].id});
    await db.exec("update pp.memories set visibility='shareable'");
    expect(await answer("อาหาร")).toEqual({decision:"answer",answer:"PRIVATE_MEDIA_CANARY",memory_id:updated.rows[0].id});
  });
  it("searches private and shareable content only through the server role", async () => {
    await memory("private", "unique_private_keyword");await memory("shareable", "other");
    expect((await db.query("select content from pp.pp_search_memories('PRIVATE_KEYWORD')")).rows).toEqual([{content:"unique_private_keyword"}]);
    expect((await db.query("select * from pp.pp_search_memories('%')")).rows).toHaveLength(0);
  });
  it("detaches deleted files from memories and future reminders", async () => {
    const file=randomUUID();await db.query("insert into pp.files(id,name,object_path,mime,bytes) values ($1,'file','test/path','text/plain',1)",[file]);
    await memory("private","private");await calendar(false);
    await db.query("update pp.memories set attachment_ids=array[$1::uuid]",[file]);await db.query("update pp.calendar_events set attachment_ids=array[$1::uuid]",[file]);
    await db.query("delete from pp.files where id=$1",[file]);
    expect((await db.query("select attachment_ids from pp.memories union all select attachment_ids from pp.calendar_events")).rows).toEqual([{attachment_ids:[]},{attachment_ids:[]}]);
  });
  async function calendar(enabled=true) {
    return (await db.query<{id:string}>("insert into pp.calendar_events(title,event_date,message,enabled) values ('test',(now() at time zone 'Asia/Bangkok')::date,'calendar canary',$1) returning id",[enabled])).rows[0].id;
  }
  it("stores ten attachments and rejects eleven for both memories and calendar events", async () => {
    await memory("private", "attachment boundary"); await calendar(false);
    const ids=Array.from({length:10},()=>randomUUID());
    for(const table of ["memories","calendar_events"]){
      await db.query(`update pp.${table} set attachment_ids=$1::uuid[]`,[ids]);
      expect((await db.query(`select attachment_ids from pp.${table}`)).rows).toEqual([{attachment_ids:ids}]);
      await expect(db.query(`update pp.${table} set attachment_ids=$1::uuid[]`,[[...ids,randomUUID()]])).rejects.toThrow(/attachment_ids_check/);
      expect((await db.query(`select attachment_ids from pp.${table}`)).rows).toEqual([{attachment_ids:ids}]);
    }
  });
  async function reminder(id:string,target=sender){return (await db.query<{r:{id:string;retry_key:string;attempts:number;payload:unknown}|null}>("select pp.pp_claim_reminder($1,(now() at time zone 'Asia/Bangkok')::date,0,$2) r",[id,target])).rows[0].r;}
  it("claims a scheduled delivery once and preserves its retry key and exact payload", async () => {
    const id=await calendar();const claims=await Promise.all([reminder(id),reminder(id),reminder(id)]);expect(claims.filter(Boolean)).toHaveLength(1);
    const first=claims.find(Boolean)!;
    await db.query("update pp.reminder_deliveries set payload='[{\"type\":\"text\",\"text\":\"same request\"}]',lease_until=now()-interval '1 second',status='failed' where id=$1",[first.id]);
    const second=await reminder(id);expect(second?.retry_key).toBe(first.retry_key);expect(second?.attempts).toBe(2);expect(second?.payload).toEqual([{type:"text",text:"same request"}]);
    await db.exec("update pp.reminder_deliveries set status='sent',lease_until=now()-interval '1 second'");expect(await reminder(id)).toBeNull();
  });
  it("does not claim disabled, wrong-date, wrong-owner or unapproved-group deliveries", async () => {
    const id=await calendar(false);expect(await reminder(id)).toBeNull();
    await db.exec("update pp.calendar_events set enabled=true,event_date=event_date+1");expect(await reminder(id)).toBeNull();
    await db.exec("update pp.calendar_events set event_date=event_date-1");expect(await reminder(id,'U'+'e'.repeat(32))).toBeNull();expect(await reminder(id,group)).toBeNull();
    await db.query("update pp.calendar_events set group_id=$1,send_owner=false",[group]);expect(await reminder(id)).toBeNull();
    await db.exec("update pp.permissions set enabled=false");expect(await reminder(id,group)).toBeNull();
  });
  it("caps calendar storage without silently excluding records", async () => {
    await db.exec("insert into pp.calendar_events(title,event_date,message) select 'test',current_date,'test' from generate_series(1,100)");
    await expect(calendar()).rejects.toThrow(/PP_CALENDAR_LIMIT/);
    await db.exec("delete from pp.calendar_events where id=(select id from pp.calendar_events limit 1)");expect(await calendar()).toBeTruthy();
  });
  it("clears private retry bodies after a day but retains delivery deduplication", async () => {
    const id=await calendar();await reminder(id);
    await db.exec("update pp.reminder_deliveries set created_at=now()-interval '2 days',payload='[{}]'; select pp.pp_cleanup()");
    expect((await db.query("select payload from pp.reminder_deliveries")).rows).toEqual([{payload:null}]);
  });

  async function candidates() {
    return (await db.query<{ result: { id: string; revision: string; questions: string[] }[] }>("select pp.pp_ai_candidates($1,$2) result", [group,sender])).rows[0].result;
  }
  async function ownerClaim(event = "dm", lease = randomUUID(), user = sender) {
    return (await db.query<{ result: string }>("select pp.pp_claim_owner_event($1,$2,'msg',$3) result", [event, user, lease])).rows[0].result;
  }
  async function ownerRead(lease: string, question = "อาหาร", user = sender, event = "dm") {
    return (await db.query<{ result: { decision: string; answer?: string } }>("select pp.pp_owner_answer($1,$2,$3,$4) result", [question, user, event, lease])).rows[0].result;
  }
  type OwnerCandidate = { id: string; revision: string; questions: string[] };
  const directFriend=`U${"f".repeat(32)}`;
  async function directClaim(lease:string,user=directFriend,event="friend-dm"){
    return (await db.query<{r:string}>("select pp.pp_claim_direct_event($1,$2,'msg',$3) as r",[event,user,lease])).rows[0].r;
  }
  async function directRead(lease:string,question="อาหารโปรด",user=directFriend,event="friend-dm"){
    return (await db.query<{r:{decision:string;answer?:string}}>("select pp.pp_direct_answer($1,$2,$3,$4) as r",[question,user,event,lease])).rows[0].r;
  }
  async function directCandidates(lease:string,user=directFriend,event="friend-dm"){
    return (await db.query<{r:OwnerCandidate[]|{decision:string}}>("select pp.pp_direct_ai_candidates($1,$2,$3) as r",[user,event,lease])).rows[0].r;
  }
  async function directAnswer(c:OwnerCandidate,lease:string,user=directFriend,event="friend-dm"){
    return (await db.query<{r:{decision:string;answer?:string}}>("select pp.pp_direct_ai_answer($1,$2,'น้ำท่วมป่ะ',$3,$4,$5) as r",[c.id,c.revision,user,event,lease])).rows[0].r;
  }
  it("allows a nonowner DM to retrieve exact and semantic shareable answers, excluding legacy private data",async()=>{
    await seedSemantic();await memory("private","PRIVATE_CANARY",["privatealias"]);await db.exec("update pp.memories set question_examples=array['PRIVATE_EXAMPLE'] where visibility='private'");
    const lease=randomUUID();expect(await directClaim(lease)).toBe("claimed");
    expect(await directRead(lease)).toEqual({decision:"answer",answer:"APPROVED_ANSWER"});
    expect(await directRead(lease,"privatealias")).toEqual({decision:"refuse"});
    const candidates=await directCandidates(lease) as OwnerCandidate[];expect(candidates).toHaveLength(1);expect(JSON.stringify(candidates)).not.toMatch(/PRIVATE/);
    expect(await directAnswer(candidates[0],lease)).toEqual({decision:"answer",answer:"APPROVED_ANSWER"});
    const ownerLease=randomUUID();expect(await directClaim(ownerLease,sender,"owner-dm")).toBe("claimed");
    expect(await directRead(ownerLease,"privatealias",sender,"owner-dm")).toEqual({decision:"answer",answer:"PRIVATE_CANARY"});
  });
  it("requires each direct sender's own live lease and deduplicates replies",async()=>{
    await seedSemantic();const lease=randomUUID();await directClaim(lease);const c=(await directCandidates(lease) as OwnerCandidate[])[0];
    expect(await directCandidates(lease,sender)).toEqual({decision:"denied"});
    expect(await directAnswer(c,randomUUID())).toEqual({decision:"denied"});
    expect(await directClaim(randomUUID())).toBe("busy");
    expect(await directClaim(randomUUID(),sender)).toBe("denied");
    const groupLease=randomUUID();await claim("group-event",groupLease);
    expect(await directCandidates(groupLease,sender,"group-event")).toEqual({decision:"denied"});
    await db.exec("update pp.conversations set status='replied',lease_until=null where event_id='friend-dm'");
    expect(await directClaim(randomUUID())).toBe("done");expect(await directAnswer(c,lease)).toEqual({decision:"denied"});
  });
  it("does not answer blocked friends and rechecks blocking after model selection",async()=>{
    await seedSemantic();const lease=randomUUID();await directClaim(lease);const c=(await directCandidates(lease) as OwnerCandidate[])[0];
    await db.query("insert into pp.friends(group_id,line_user_id,blocked) values($1,$2,true)",[group,directFriend]);
    expect(await directClaim(randomUUID(),directFriend,"blocked-dm")).toBe("denied");
    expect(await directRead(lease)).toEqual({decision:"denied"});expect(await directCandidates(lease)).toEqual({decision:"denied"});expect(await directAnswer(c,lease)).toEqual({decision:"denied"});
  });
  it.each(["visibility='private'","content='CHANGED'","expires_at=now()-interval '1 second'"])("rechecks direct-chat memory changes after AI: %s",async change=>{
    await seedSemantic();const lease=randomUUID();await directClaim(lease);const c=(await directCandidates(lease) as OwnerCandidate[])[0];
    await db.exec(`update pp.memories set ${change}`);expect((await directAnswer(c,lease)).decision).not.toBe("answer");
  });
  async function ownerCandidates(lease: string, user = sender, event = "dm") {
    return (await db.query<{r:OwnerCandidate[]|{decision:string}}>("select pp.pp_owner_ai_candidates($1,$2,$3) as r",[user,event,lease])).rows[0].r;
  }
  async function ownerSemanticAnswer(c: OwnerCandidate, lease: string, user = sender, event = "dm") {
    return (await db.query<{r:{decision:string;answer?:string;memory_id?:string}}>("select pp.pp_owner_ai_answer($1,$2,'น้ำท่วมป่ะ',$3,$4,$5) as r",[c.id,c.revision,user,event,lease])).rows[0].r;
  }
  it("owner AI sees only approved question examples and retrieves an answer without group membership", async () => {
    await seedSemantic(); await memory("private","PRIVATE_CANARY",["privatealias"]);
    await db.exec("update pp.memories set title='PRIVATE_TITLE',question_examples=array['PRIVATE_EXAMPLE'] where visibility='private'");
    const lease=randomUUID(); await ownerClaim("dm",lease);
    const candidates=await ownerCandidates(lease) as OwnerCandidate[];
    expect(candidates).toHaveLength(1); expect(Object.keys(candidates[0]).sort()).toEqual(["id","questions","revision"]);
    expect(JSON.stringify(candidates)).not.toMatch(/PRIVATE/);
    await db.exec("update pp.permissions set enabled=false; update pp.friends set blocked=true");
    expect(await ownerRead(lease,"น้ำท่วมป่ะ")).toEqual({decision:"unknown"});
    expect(await ownerSemanticAnswer(candidates[0],lease)).toEqual({decision:"answer",answer:"APPROVED_ANSWER"});
    expect(await ownerCandidates(randomUUID())).toEqual({decision:"denied"});
    expect(await ownerCandidates(lease,`U${"f".repeat(32)}`)).toEqual({decision:"denied"});
    const groupLease=randomUUID(); await claim("group-event",groupLease);
    expect(await ownerCandidates(groupLease,sender,"group-event")).toEqual({decision:"denied"});
    expect(await ownerSemanticAnswer(candidates[0],groupLease,sender,"group-event")).toEqual({decision:"denied"});
  });
  it.each(["update pp.owner set line_user_id=null","update pp.conversations set lease_until=now()-interval '1 second'","update pp.conversations set status='replied'"])("owner AI rechecks authorization after classification: %s",async change=>{
    await seedSemantic();const lease=randomUUID();await ownerClaim("dm",lease);const c=(await ownerCandidates(lease) as OwnerCandidate[])[0];
    await db.exec(change);expect(await ownerCandidates(lease)).toEqual({decision:"denied"});expect(await ownerSemanticAnswer(c,lease)).toEqual({decision:"denied"});
  });
  it.each(["visibility='private'","content='EDITED'","expires_at=now()-interval '1 second'","question_examples=array['changed']"])("owner AI refuses stale or revoked memory: %s",async change=>{
    await seedSemantic();const lease=randomUUID();await ownerClaim("dm",lease);const c=(await ownerCandidates(lease) as OwnerCandidate[])[0];
    await db.exec(`update pp.memories set ${change}`);expect((await ownerSemanticAnswer(c,lease)).decision).not.toBe("answer");
  });
  it("owner AI cannot choose between conflicting aliases or expose a private overlap",async()=>{
    await seedSemantic();const lease=randomUUID();await ownerClaim("dm",lease);const c=(await ownerCandidates(lease) as OwnerCandidate[])[0];
    await memory("shareable","OTHER",["อาหารโปรด"]);expect((await ownerSemanticAnswer(c,lease)).decision).toBe("refuse");
    await memory("private","PRIVATE_CANARY",["อาหารโปรด"]);expect(await ownerCandidates(lease)).toEqual([]);
    expect((await ownerSemanticAnswer(c,lease)).decision).toBe("refuse");
  });
  it("only the current owner with an active direct-chat lease can retrieve private content", async () => {
    await memory("private", "PRIVATE_CANARY"); const lease = randomUUID();
    expect(await ownerClaim("dm", lease)).toBe("claimed");
    expect(await ownerRead(lease)).toEqual({ decision: "answer", answer: "PRIVATE_CANARY" });
    expect(await answer("อาหาร")).toEqual({ decision: "refuse" });
    expect(await ownerRead(randomUUID())).toEqual({ decision: "denied" });
    expect(await ownerRead(lease, "อาหาร", `U${"f".repeat(32)}`)).toEqual({ decision: "denied" });
    expect((await db.query("select source_type,group_id from pp.conversations where event_id='dm'")).rows).toEqual([{ source_type: "user", group_id: null }]);
  });
  it("group events cannot be used to unlock an owner private answer", async () => {
    await memory("private", "PRIVATE_CANARY"); const lease = randomUUID(); await claim("group-evt", lease);
    expect(await ownerRead(lease, "อาหาร", sender, "group-evt")).toEqual({ decision: "denied" });
    expect(await ownerClaim("group-evt", lease)).toBe("denied");
  });
  it("cannot claim direct-chat work for nonowners or an unconfigured owner", async () => {
    expect(await ownerClaim("dm", randomUUID(), `U${"f".repeat(32)}`)).toBe("denied");
    await db.exec("update pp.owner set line_user_id=null");
    expect(await ownerClaim()).toBe("denied");
    expect((await db.query("select * from pp.conversations")).rows).toEqual([]);
  });
  it.each(["update pp.owner set line_user_id=null", "update pp.conversations set lease_until=now()-interval '1 second'", "update pp.conversations set status='replied'"])("rechecks owner and active lease before private retrieval: %s", async change => {
    await memory("private", "PRIVATE_CANARY"); const lease = randomUUID(); await ownerClaim("dm", lease); await db.exec(change);
    expect(await ownerRead(lease)).toEqual({ decision: "denied" });
  });
  it("owner direct retrieval excludes expired memories and rejects ambiguity", async () => {
    const lease = randomUUID(); await ownerClaim("dm", lease);
    await memory("private", "EXPIRED", ["อาหาร"], "2000-01-01T00:00:00Z");
    expect(await ownerRead(lease)).toEqual({ decision: "unknown" });
    await memory("shareable", "public");
    expect(await ownerRead(lease)).toEqual({ decision: "answer", answer: "public" });
    await memory("private", "PRIVATE_CANARY");
    expect(await ownerRead(lease)).toEqual({ decision: "ambiguous" });
  });
  it("deduplicates owner messages and reclaims failed direct delivery", async () => {
    expect((await Promise.all([ownerClaim(), ownerClaim(), ownerClaim()])).sort()).toEqual(["busy", "busy", "claimed"]);
    await db.exec("update pp.conversations set status='failed',lease_until=null");
    expect(await ownerClaim()).toBe("claimed");
    await db.exec("update pp.conversations set status='replied',lease_until=null");
    expect(await ownerClaim()).toBe("done");
  });
  async function semanticAnswer(c: {id: string; revision: string}) {
    return (await db.query<{ result: { decision: string; answer?: string } }>("select pp.pp_ai_answer($1,$2,'paraphrase',$3,$4) result", [c.id,c.revision,group,sender])).rows[0].result;
  }
  async function seedSemantic() {
    await memory("shareable", "APPROVED_ANSWER", ["อาหารโปรด"]);
    await db.exec("update pp.memories set question_examples = array['ปีโป้ชอบรับประทานอะไร']");
    return (await candidates())[0];
  }
  it("returns a semantic mention opt-in only after rechecking the memory revision", async () => {
    const previous = await seedSemantic(); await db.exec("update pp.memories set mention_owner=true");
    expect((await semanticAnswer(previous)).decision).toBe("unknown");
    const selected = (await candidates())[0];
    expect(await semanticAnswer(selected)).toEqual({ decision: "answer", answer: "APPROVED_ANSWER", mention_owner: true });
    expect(Object.keys(selected).sort()).toEqual(["answer_variants", "content", "id", "questions", "revision", "title"]);
    await db.exec("update pp.memories set visibility='private'");
    expect((await semanticAnswer(selected)).decision).not.toBe("answer");
  });
  it("semantic candidates include approved content while excluding all private data", async () => {
    await seedSemantic(); await memory("private", "PRIVATE_CANARY", ["privatealias"]);
    await db.exec("update pp.memories set title='PRIVATE_TITLE', question_examples=array['PRIVATE_EXAMPLE'] where visibility='private'");
    const result = await candidates(); expect(result).toHaveLength(1);
    expect(Object.keys(result[0]).sort()).toEqual(["answer_variants","content","id","questions","revision","title"]);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE/);
    expect(await semanticAnswer(result[0])).toEqual({ decision: "answer", answer: "APPROVED_ANSWER" });
  });
  it.each(["visibility='private'", "content='EDITED'", "question_examples=array['changed']", "expires_at=now()-interval '1 second'"])("rechecks a changed memory after AI: %s", async change => {
    const selected = await seedSemantic(); await db.exec(`update pp.memories set ${change}`);
    expect((await semanticAnswer(selected)).decision).not.toBe("answer");
  });
  it.each(["update pp.permissions set enabled=false", "update pp.friends set blocked=true"])("rechecks access after AI", async change => {
    const selected = await seedSemantic(); await db.exec(change);
    expect(await candidates()).toEqual([]); expect((await semanticAnswer(selected)).decision).toBe("refuse");
  });
  it("private overlap vetoes semantic candidates and a previous selection", async () => {
    const selected = await seedSemantic(); await memory("private", "PRIVATE_CANARY", ["อาหารโปรด"]);
    expect(await candidates()).toEqual([]); expect((await semanticAnswer(selected)).decision).toBe("refuse");
  });
  it("ambiguous shareable aliases cannot be picked by AI", async () => {
    const selected = await seedSemantic(); await memory("shareable", "conflicting", ["อาหารโปรด"]);
    expect((await semanticAnswer(selected)).decision).toBe("conflict");
  });
  it("reserves a monthly cap atomically and does not count denied requests", async () => {
    const reserve = async (limit = 2) => (await db.query<{ ok: boolean }>("select pp.pp_reserve_ai($1) ok", [limit])).rows[0].ok;
    expect(await Promise.all([reserve(),reserve(),reserve(),reserve()])).toEqual([true,true,false,false]);
    expect((await db.query<{ calls: number }>("select calls from pp.ai_usage")).rows[0].calls).toBe(2);
    expect(await reserve(1001)).toBe(false); expect(await reserve(0)).toBe(false);
    await db.exec("update pp.ai_usage set month=month-interval '1 month'"); expect(await reserve()).toBe(true);
  });
  it("retrieves 45 approved full memories even with no example questions", async () => {
    await db.exec("insert into pp.memories(title,content,aliases) select 'เรื่อง '||i,'ข้อมูล '||i,'{}'::text[] from generate_series(1,45) i");
    const result = await candidates(); expect(result).toHaveLength(45);
    expect((await semanticAnswer(result[44])).decision).toBe("answer");
    expect(JSON.stringify(result)).toContain("ข้อมูล");
  });
  it("answers identical duplicates but queues differing answers", async () => {
    await memory("shareable", "เหมือนกัน"); await memory("shareable", "เหมือนกัน");
    expect(await answer("อาหาร")).toEqual({ decision: "answer", answer: "เหมือนกัน" });
    await db.exec("update pp.memories set content='ต่างกัน' where id=(select id from pp.memories limit 1)");
    expect(await answer("อาหาร")).toEqual({ decision: "conflict" });
    expect((await db.query("select * from pp.memory_issues where status='open'")).rows).toHaveLength(1);
  });
  it("atomically merges, preserves layout, rejects stale review, and invalidates old issues", async () => {
    await memory("shareable", "one"); await memory("shareable", "two");
    expect((await answer("อาหาร")).decision).toBe("conflict");
    const snapshot = (await db.query<{c:{revision:string;memories:{id:string}[]}}>("select pp.pp_memory_catalog() as c")).rows[0].c;
    const [a,b] = snapshot.memories;
    const value = {id:a.id,title:"รวมแล้ว",content:"ถูกต้อง",aliases:["อาหาร"],question_examples:[],mention_owner:false,expires_at:null,attachment_ids:[]};
    const save = async (revision:string) => (await db.query<{r:{decision:string}}>("select pp.pp_save_assisted_memory($1,$2,$3) as r",[JSON.stringify(value),revision,b.id])).rows[0].r;
    expect((await save("stale")).decision).toBe("changed");
    expect((await db.query("select id from pp.memories")).rows).toHaveLength(2);
    expect((await save(snapshot.revision)).decision).toBe("saved");
    expect((await db.query("select id from pp.memories")).rows).toHaveLength(1);
    expect((await db.query("select id from pp.memory_issues")).rows).toHaveLength(0);
    expect(await answer("อาหาร")).toEqual({decision:"answer",answer:"ถูกต้อง"});
  });
  it("records revision-bound semantic conflicts and clears the block when a memory is edited", async () => {
    await memory("shareable", "one", ["one"]); await memory("shareable", "two", ["two"]);
    const c = (await db.query<{c:{memories:{id:string;revision:string}[]}}>("select pp.pp_memory_catalog() as c")).rows[0].c.memories;
    const record = async (revision:string) => (await db.query<{r:boolean}>("select pp.pp_record_memory_issue($1,$2,$3,$4,'conflict','ทดสอบ') as r",[c[0].id,c[1].id,revision,c[1].revision])).rows[0].r;
    expect(await record("stale")).toBe(false); expect(await record(c[0].revision)).toBe(true);
    expect((await answer("one")).decision).toBe("conflict");
    await db.query("update pp.memories set card_color='green',sort_order=99,updated_at=now() where id=$1",[c[0].id]);
    expect((await answer("one")).decision).toBe("conflict");
    await db.query("update pp.memories set content='แก้แล้ว' where id=$1",[c[0].id]);
    expect((await answer("one")).decision).toBe("answer");
  });
  it("keeps private data out of the admin AI catalog and denies public assistant access", async () => {
    await memory("private", "PRIVATE_CANARY",["private"]); await memory("shareable", "PUBLIC");
    expect(JSON.stringify((await db.query("select pp.pp_memory_catalog() as c")).rows)).not.toContain("PRIVATE");
    await db.exec("reset role; set role anon");
    await expect(db.query("select pp.pp_memory_catalog()")).rejects.toThrow();
    await expect(db.query("select * from pp.memory_issues")).rejects.toThrow();
  });
});
