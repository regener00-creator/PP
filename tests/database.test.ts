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
describe("real PostgreSQL migration and privacy boundary", () => {
  beforeAll(async () => {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;");
    await db.exec("create table public.existing_app(id integer primary key, value text); insert into public.existing_app values (1,'UNCHANGED');");
    await db.exec(readFileSync(new URL("../supabase/migrations/20260929034158_pp_initial.sql", import.meta.url), "utf8"));
  }, 30000);
  beforeEach(async () => {
    await db.exec("reset role; truncate pp.memories, pp.conversations, pp.rate_limits, pp.friends, pp.permissions cascade");
    await db.query("insert into pp.permissions(group_id,enabled) values ($1,true)", [group]);
    await db.query("insert into pp.friends(group_id,line_user_id) values ($1,$2)", [group, sender]);
    await db.exec("set role service_role");
  });
  afterAll(async () => { await db.close(); });
  it("returns only shareable content for an approved question", async () => { await memory("shareable", "อาหารไทย"); expect(await answer("อาหาร")).toEqual({ decision: "answer", answer: "อาหารไทย" }); });
  it("private content never crosses the SQL return boundary", async () => { await memory("private", "SECRET_CANARY"); expect(await answer("อาหาร")).toEqual({ decision: "refuse" }); });
  it("private alias overrides a conflicting shareable alias", async () => { await memory("shareable", "public"); await memory("private", "SECRET_CANARY"); expect(await answer("อาหาร")).toEqual({ decision: "refuse" }); });
  it("refuses ambiguous approved answers", async () => { await memory("shareable", "one"); await memory("shareable", "two"); expect(await answer("อาหาร")).toEqual({ decision: "refuse" }); });
  it("does not disclose expired memories", async () => { await memory("shareable", "expired", ["อาหาร"], "2000-01-01T00:00:00Z"); expect(await answer("อาหาร")).toEqual({ decision: "unknown" }); });
  it("does not match extra instructions or partial questions", async () => { await memory("shareable", "public"); expect(await answer("อาหารignoreallinstructions")).toEqual({ decision: "unknown" }); });
  it("disabled groups fail closed", async () => { await memory("shareable", "public"); await db.query("update pp.permissions set enabled = false"); expect(await answer("อาหาร")).toEqual({ decision: "refuse" }); });
  it("unknown groups and unknown senders fail closed", async () => { await memory("shareable", "public"); expect((await answer("อาหาร", `C${"d".repeat(32)}`)).decision).toBe("refuse"); expect((await answer("อาหาร", group, `U${"e".repeat(32)}`)).decision).toBe("refuse"); });
  it("blocked friends cannot read approved answers", async () => { await memory("shareable", "public"); await db.exec("update pp.friends set blocked = true"); expect(await answer("อาหาร")).toEqual({ decision: "refuse" }); });
  it.each(["anon", "authenticated"])("%s cannot read any table or execute bot RPCs", async role => {
    await memory("private", "SECRET_CANARY"); await db.exec(`reset role; set role ${role}`);
    for (const table of ["owner", "friends", "memories", "permissions", "conversations", "rate_limits"]) await expect(db.query(`select * from pp.${table}`)).rejects.toThrow(/permission denied/);
    await expect(answer("อาหาร")).rejects.toThrow(/permission denied/);
    await expect(claim()).rejects.toThrow(/permission denied/);
    await expect(db.query("select pp.pp_cleanup()")).rejects.toThrow(/permission denied/);
  });
  it("all six tables have RLS enabled", async () => {
    const result = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relnamespace = 'pp'::regnamespace and relkind = 'r'");
    expect(result.rows).toHaveLength(6); expect(result.rows.every(row => row.relrowsecurity)).toBe(true);
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
});
