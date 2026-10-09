import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
const db = new PGlite(),
  owner = `U${"a".repeat(32)}`,
  friend = `U${"b".repeat(32)}`,
  other = `U${"d".repeat(32)}`,
  group = `C${"c".repeat(32)}`,
  group2 = `C${"d".repeat(32)}`;
async function allowed(scope = friend, sender = friend) {
  return (
    await db.query<{ r: boolean }>("select pp.pp_assistant_allowed($1,$2) r", [
      scope,
      sender,
    ])
  ).rows[0].r;
}
async function proposal(scope = friend, sender = friend, kind = "remember") {
  const id = randomUUID(),
    today = (
      await db.query<{ d: string }>(
        "select to_char(now() at time zone 'Asia/Bangkok','YYYY-MM-DD') d",
      )
    ).rows[0].d;
  await db.query(
    "insert into pp.assistant_turns(id,scope_key,sender_id,request,reply,proposal,status,expires_at) values($1,$2,$3,'remember','draft',$4,'proposed',now()+interval '15 minutes')",
    [
      id,
      scope,
      sender,
      JSON.stringify(
        kind === "remember"
          ? { kind, title: "กาแฟ", content: "ฉันชอบกาแฟไม่หวาน" }
          : {
              kind,
              title: "พบเพื่อน",
              content: "เวลา 14:00",
              date: today,
              annual: false,
              before: true,
            },
      ),
    ],
  );
  return id;
}
async function confirm(
  id: string | null,
  scope = friend,
  sender = friend,
  key = randomUUID(),
) {
  return (
    await db.query<{ r: { decision: string; kind?: string } }>(
      "select pp.pp_confirm_assistant($1,$2,$3,$4) r",
      [id, scope, sender, key],
    )
  ).rows[0].r;
}
describe("additive secretary migration and real PostgreSQL boundaries", () => {
  beforeAll(async () => {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;",
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20260929034158_pp_initial.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      "create table public.original_site(id integer);insert into public.original_site values(1);insert into pp.memories(title,content,visibility,aliases) values('old','OLD_MEMORY','private',array['old']);",
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261009065258_personal_secretary.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }, 30000);
  beforeEach(async () => {
    await db.exec(
      "reset role;truncate pp.assistant_turns,pp.assistant_notes,pp.assistant_events,pp.permissions cascade;",
    );
    await db.query("update pp.owner set line_user_id=$1", [owner]);
    await db.query(
      "insert into pp.permissions(group_id,enabled) values($1,true),($2,true)",
      [group, group2],
    );
    await db.query(
      "insert into pp.friends(group_id,line_user_id) values($1,$2),($1,$3),($4,$3)",
      [group, friend, other, group2],
    );
    await db.exec("set role service_role");
  });
  afterAll(() => db.close());
  it("does not change original memories or the shared website", async () => {
    expect(
      (await db.query<{ content: string }>("select content from pp.memories"))
        .rows[0].content,
    ).toBe("OLD_MEMORY");
    await db.exec("reset role");
    expect(
      (await db.query("select * from public.original_site")).rows,
    ).toHaveLength(1);
  });
  it("isolates private scopes and requires enabled group membership", async () => {
    expect(await allowed()).toBe(true);
    expect(await allowed(other, friend)).toBe(false);
    expect(await allowed(group, friend)).toBe(true);
    expect(await allowed(group2, friend)).toBe(false);
    await db.query(
      "update pp.permissions set enabled=false where group_id=$1",
      [group],
    );
    expect(await allowed(group, friend)).toBe(false);
  });
  it("blocked DM and group members cannot confirm drafts; owner keeps their own access", async () => {
    const id = await proposal();
    await db.query("update pp.friends set blocked=true where line_user_id=$1", [
      friend,
    ]);
    expect(await allowed()).toBe(false);
    expect((await confirm(id)).decision).toBe("denied");
    expect(await allowed(owner, owner)).toBe(true);
  });
  it("stores nothing before confirmation and rejects another sender's draft", async () => {
    const id = await proposal();
    expect(
      (await db.query("select * from pp.assistant_notes")).rows,
    ).toHaveLength(0);
    expect((await confirm(id, other, other)).decision).toBe("denied");
    expect((await confirm(id)).decision).toBe("saved");
    expect(
      (
        await db.query<{ scope_key: string }>(
          "select scope_key from pp.assistant_notes",
        )
      ).rows[0].scope_key,
    ).toBe(friend);
  });
  it("same group cannot confirm another member's request", async () => {
    const id = await proposal(group, friend);
    expect((await confirm(id, group, other)).decision).toBe("denied");
    expect((await confirm(id, group, friend)).decision).toBe("saved");
  });
  it("confirmation is atomic and idempotent including a retried LINE event", async () => {
    const id = await proposal(),
      key = randomUUID();
    expect((await confirm(id, friend, friend, key)).decision).toBe("saved");
    const second = await proposal();
    expect((await confirm(null, friend, friend, key)).decision).toBe("saved");
    expect(
      (await db.query("select * from pp.assistant_notes")).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from pp.assistant_turns where id=$1",
          [second],
        )
      ).rows[0].status,
    ).toBe("proposed");
    expect((await confirm(id)).decision).toBe("saved");
    expect(
      (await db.query("select * from pp.assistant_notes")).rows,
    ).toHaveLength(1);
  });
  it("rejects expired/cancelled and stale drafts without modifying old notes", async () => {
    const id = await proposal();
    await db.query(
      "update pp.assistant_turns set expires_at=now()-interval '1 second' where id=$1",
      [id],
    );
    expect((await confirm(id)).decision).toBe("expired");
    await db.query(
      "update pp.assistant_turns set status='cancelled',expires_at=now()+interval '1 hour' where id=$1",
      [id],
    );
    expect((await confirm(id)).decision).toBe("expired");
    expect(
      (await db.query("select * from pp.assistant_notes")).rows,
    ).toHaveLength(0);
  });
  it("rolls back malformed content rather than partially marking it saved", async () => {
    const id = await proposal();
    await db.query(
      "update pp.assistant_turns set proposal=jsonb_set(proposal,'{content}','\"\"') where id=$1",
      [id],
    );
    await expect(confirm(id)).rejects.toThrow();
    expect(
      (
        await db.query<{ status: string }>(
          "select status from pp.assistant_turns where id=$1",
          [id],
        )
      ).rows[0].status,
    ).toBe("proposed");
  });
  it("caps each notebook without touching another family's scope", async () => {
    await db.query(
      "insert into pp.assistant_notes(id,scope_key,sender_id,title,content) select gen_random_uuid(),$1,$1,'test','test' from generate_series(1,200)",
      [friend],
    );
    expect((await confirm(await proposal())).decision).toBe("limit");
    expect(
      (await confirm(await proposal(other, other), other, other)).decision,
    ).toBe("saved");
  });
  it("confirmed appointments are available to the owner calendar once, with scope-bound edits and deletion", async () => {
    const id = await proposal(owner, owner, "event");
    expect((await db.query("select id from pp.assistant_events where scope_key=$1", [owner])).rows).toHaveLength(0);
    expect((await confirm(id, owner, owner)).decision).toBe("saved");
    expect((await confirm(id, owner, owner)).decision).toBe("saved");
    const records = await db.query<{id:string;title:string;content:string}>("select id,title,content from pp.assistant_events where scope_key=$1", [owner]);
    expect(records.rows).toHaveLength(1);
    expect(records.rows[0]).toMatchObject({title:"พบเพื่อน",content:"เวลา 14:00"});
    const recordId = records.rows[0].id;
    expect((await db.query("update pp.assistant_events set title='changed' where id=$1 and scope_key=$2 returning id", [recordId,friend])).rows).toHaveLength(0);
    await db.query("update pp.assistant_events set title='เลื่อนนัด',event_date='2026-10-15' where id=$1 and scope_key=$2", [recordId,owner]);
    expect((await db.query<{title:string}>("select title from pp.assistant_events where scope_key=$1", [owner])).rows[0].title).toBe("เลื่อนนัด");
    await db.query("delete from pp.assistant_events where id=$1 and scope_key=$2", [recordId,owner]);
    expect((await db.query("select id from pp.assistant_events where scope_key=$1", [owner])).rows).toHaveLength(0);
  });
  it("persists reminder payload/retry key and never reclaims sent deliveries", async () => {
    const id = await proposal(friend, friend, "event");
    expect((await confirm(id)).decision).toBe("saved");
    const day = (
      await db.query<{ d: string }>(
        "select to_char(now() at time zone 'Asia/Bangkok','YYYY-MM-DD') d",
      )
    ).rows[0].d;
    const claim = async () =>
      (
        await db.query<{
          r: {
            id: string;
            retry_key: string;
            payload: unknown;
            attempts: number;
          } | null;
        }>("select pp.pp_claim_assistant_reminder($1,$2,0) r", [id, day])
      ).rows[0].r;
    const first = await claim();
    expect(first).not.toBeNull();
    expect(await claim()).toBeNull();
    await db.query(
      "update pp.assistant_deliveries set lease_until=now()-interval '1 second',status='failed' where id=$1",
      [first!.id],
    );
    const retry = await claim();
    expect(retry?.retry_key).toBe(first!.retry_key);
    expect(retry?.payload).toEqual(first!.payload);
    expect(retry?.attempts).toBe(2);
    await db.query(
      "update pp.assistant_deliveries set status='sent',lease_until=now()-interval '1 second' where id=$1",
      [first!.id],
    );
    expect(await claim()).toBeNull();
  });
  it("revoked group permission suppresses a pending reminder", async () => {
    const id = await proposal(group, friend, "event");
    await confirm(id, group, friend);
    await db.query(
      "update pp.permissions set enabled=false where group_id=$1",
      [group],
    );
    expect(
      (
        await db.query<{ r: unknown }>(
          "select pp.pp_claim_assistant_reminder($1,(now() at time zone 'Asia/Bangkok')::date,0) r",
          [id],
        )
      ).rows[0].r,
    ).toBeNull();
  });
  it.each(["anon", "authenticated"])(
    "%s cannot read tables or execute privileged helpers",
    async (role) => {
      await db.exec(`set role ${role}`);
      await expect(
        db.query("select * from pp.assistant_notes"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select pp.pp_assistant_allowed($1,$1)", [friend]),
      ).rejects.toThrow(/permission denied/);
    },
  );
  it("owner management updates and deletes confirmed LINE notes in place with stale-version protection", async () => {
    const id = await proposal(owner, owner);
    await confirm(id, owner, owner);
    const otherId = await proposal(friend, friend);
    await confirm(otherId, friend, friend);
    const version = (await db.query<{ version: string }>("select updated_at::text as version from pp.assistant_notes where id=$1", [id])).rows[0].version;
    const edited = await db.query("update pp.assistant_notes set content='หวานน้อย',updated_at=now() where id=$1 and scope_key=$2 and updated_at=$3::timestamptz returning id", [id,owner,version]);
    expect(edited.rows).toHaveLength(1);
    expect((await db.query("select content from pp.assistant_notes where id=$1 and scope_key=$2", [id,owner])).rows).toEqual([{content:"หวานน้อย"}]);
    expect((await db.query("update pp.assistant_notes set content='stale' where id=$1 and scope_key=$2 and updated_at=$3::timestamptz returning id", [id,owner,version])).rows).toHaveLength(0);
    expect((await db.query("delete from pp.assistant_notes where id=$1 and scope_key=$2 returning id", [otherId,owner])).rows).toHaveLength(0);
    const latest = (await db.query<{ version: string }>("select updated_at::text as version from pp.assistant_notes where id=$1", [id])).rows[0].version;
    expect((await db.query("delete from pp.assistant_notes where id=$1 and scope_key=$2 and updated_at=$3::timestamptz returning id", [id,owner,latest])).rows).toHaveLength(1);
    expect((await db.query("select id from pp.assistant_notes where scope_key=$1", [owner])).rows).toHaveLength(0);
    expect((await db.query("select id from pp.assistant_notes where scope_key=$1", [friend])).rows).toHaveLength(1);
    expect((await db.query("select content from pp.memories where title='old'")).rows).toEqual([{content:"OLD_MEMORY"}]);
  });
  it("retains notes after chat-history retention cleanup", async () => {
    const id = await proposal();
    await confirm(id);
    await db.query(
      "update pp.assistant_turns set created_at=now()-interval '31 days'",
    );
    await db.query("select pp.pp_cleanup_assistant()");
    expect(
      (await db.query("select * from pp.assistant_turns")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from pp.assistant_notes")).rows,
    ).toHaveLength(1);
  });
});
