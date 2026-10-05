import { freeCandidates } from "../src/lib/planner-templates";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
const db = new PGlite();
const group = "C" + "c".repeat(32),
  owner = "U" + "a".repeat(32);
const query = async (sql: string, args: unknown[] = []) =>
  (await db.query<Record<string, unknown>>(sql, args)).rows;
describe("content database isolation and delivery idempotency", () => {
  beforeAll(async () => {
    await db.exec(
      "create role authenticator;create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);",
    );
    const dir = new URL("../supabase/migrations/", import.meta.url);
    for (const f of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(readFileSync(new URL(f, dir), "utf8"));
  }, 30000);
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.exec(
      "reset role;truncate pp.content_idea_seen,pp.content_brands,pp.content_generations,pp.permissions,pp.files cascade;",
    );
    await query(
      "insert into pp.permissions(group_id,enabled) values($1,true)",
      [group],
    );
    await query("update pp.owner set line_user_id=$1 where id=1", [owner]);
    await db.exec("set role service_role");
  });
  async function item() {
    return (
      await query(
        "insert into pp.content_items(title,scheduled_at,notify_owner,group_id) values('งาน',(now() at time zone 'Asia/Bangkok')::date::timestamp at time zone 'Asia/Bangkok',true,$1) returning id",
        [group],
      )
    )[0].id;
  }
  async function claim(id: unknown, target = owner) {
    return (
      await query(
        "select pp.pp_claim_content($1,(now() at time zone 'Asia/Bangkok')::date,0,$2) as d",
        [id, target],
      )
    )[0].d as { id: string; retry_key: string; attempts: number } | null;
  }
  it("goal settings revision prevents concurrent overwrites and cannot be deleted by the app", async () => {
    const before = (
      await query(
        "select updated_at::text as revision from pp.content_goal_settings where id=true",
      )
    )[0].revision;
    const updated = await query(
      "update pp.content_goal_settings set goals=goals where id=true and updated_at=$1 returning updated_at::text as revision",
      [before],
    );
    expect(updated).toHaveLength(1);
    expect(updated[0].revision).not.toBe(before);
    expect(
      await query(
        "update pp.content_goal_settings set goals=goals where id=true and updated_at=$1 returning id",
        [before],
      ),
    ).toHaveLength(0);
    await expect(
      query("delete from pp.content_goal_settings"),
    ).rejects.toThrow();
  });
  it.each(["anon", "authenticated"])(
    "denies %s all planner reads and privileged RPCs",
    async (role) => {
      await db.exec(`set role ${role}`);
      for (const table of [
        "content_items",
        "content_brands",
        "content_sources",
        "content_generations",
        "content_deliveries",
        "content_patterns",
        "content_idea_seen",
        "content_goal_settings",
      ])
        await expect(query(`select * from pp.${table}`)).rejects.toThrow();
      await expect(
        claim("00000000-0000-0000-0000-000000000001"),
      ).rejects.toThrow();
    },
  );
  it("claims once and reuses the same retry key after an expired failed lease", async () => {
    const id = await item();
    const first = await claim(id);
    expect(first).not.toBeNull();
    expect(await claim(id)).toBeNull();
    await query(
      "update pp.content_deliveries set status='failed',lease_until=now()-interval '1 minute' where id=$1",
      [first!.id],
    );
    const retry = await claim(id);
    expect(retry?.retry_key).toBe(first?.retry_key);
    expect(retry?.attempts).toBe(2);
    await query(
      "update pp.content_deliveries set status='sent',lease_until=now()-interval '1 minute' where id=$1",
      [first!.id],
    );
    expect(await claim(id)).toBeNull();
  });
  it("rejects arbitrary recipients, disabled groups and completed work", async () => {
    const id = await item();
    expect(await claim(id, "U" + "b".repeat(32))).toBeNull();
    await query("update pp.permissions set enabled=false where group_id=$1", [
      group,
    ]);
    expect(await claim(id, group)).toBeNull();
    await query("update pp.content_items set status='posted' where id=$1", [
      id,
    ]);
    expect(await claim(id)).toBeNull();
  });
  it("does not let null group fields authorize arbitrary recipients", async () => {
    const id = await item();
    await query(
      "update pp.content_items set notify_owner=false,group_id=null where id=$1",
      [id],
    );
    expect(await claim(id, owner)).toBeNull();
  });
  it("checks revision on updates and detaches deleted files", async () => {
    const id = await item();
    const before = (
      await query(
        "select updated_at::text as t from pp.content_items where id=$1",
        [id],
      )
    )[0].t;
    await query("update pp.content_items set title='แก้ไขแล้ว' where id=$1", [
      id,
    ]);
    const stale = await query(
      "update pp.content_items set title='เก่า' where id=$1 and updated_at=$2 returning id",
      [id, before],
    );
    expect(stale).toHaveLength(0);
    const file = (
      await query(
        "insert into pp.files(name,object_path,mime,bytes) values('test.jpg','planner-test','image/jpeg',1) returning id",
      )
    )[0].id;
    await query(
      "update pp.content_items set attachment_ids=array[$2::uuid] where id=$1",
      [id, file],
    );
    await query("delete from pp.files where id=$1", [file]);
    expect(
      (
        await query("select attachment_ids from pp.content_items where id=$1", [
          id,
        ])
      )[0].attachment_ids,
    ).toEqual([]);
  });
  it("requires valid notification schedule even through SQL", async () => {
    await expect(
      query(
        "insert into pp.content_items(title,notify_owner) values('invalid',true)",
      ),
    ).rejects.toThrow();
  });
  it("enforces one saved item per generated idea", async () => {
    const gen = (
      await query(
        "insert into pp.content_generations(id,kind,engine,request) values(gen_random_uuid(),'ideas','template','{}') returning id",
      )
    )[0].id;
    await query(
      "insert into pp.content_items(title,generation_id,idea_index) values('first',$1,0)",
      [gen],
    );
    await expect(
      query(
        "insert into pp.content_items(title,generation_id,idea_index) values('duplicate',$1,0)",
        [gen],
      ),
    ).rejects.toThrow();
  });

  async function ideaGeneration(
    engine = "template",
    brand: string | null = null,
  ) {
    const rows = await query(
      "insert into pp.content_generations(id,kind,engine,request) values(gen_random_uuid(),'ideas',$1,$2) returning id",
      [engine, JSON.stringify({ brief: { brand_id: brand }, sources: [] })],
    );
    return rows[0].id;
  }
  const candidate = (n: number) => ({
    key: "pattern:" + n,
    idea: {
      title: "หัวข้อ " + n,
      hook: "เปิด",
      angle: "มุม",
      cta: "ถาม",
      pillar: "ให้ความรู้",
      format: "วิธีใช้",
    },
  });
  async function finish(
    id: unknown,
    candidates: unknown[],
    patterns: unknown[] = [],
    raw: unknown = {},
  ) {
    return (
      await query("select pp.pp_finish_ideas($1,$2,$3,$4) g", [
        id,
        JSON.stringify(candidates),
        JSON.stringify(patterns),
        JSON.stringify(raw),
      ])
    )[0].g as {
      result: {
        ideas: unknown[];
        raw_ideas: unknown[];
        learned_count: number;
        notice: string;
      };
    };
  }
  it("claims new batches durably, skips duplicates and reports exhaustion without wrapping", async () => {
    const candidates = Array.from({ length: 12 }, (_, i) => candidate(i));
    const a = await ideaGeneration();
    expect((await finish(a, candidates)).result.ideas).toHaveLength(5);
    expect((await finish(a, candidates)).result.ideas).toHaveLength(5); // idempotent recovery
    expect(
      (await finish(await ideaGeneration(), candidates)).result.ideas,
    ).toHaveLength(5);
    expect(
      (await finish(await ideaGeneration(), candidates)).result.ideas,
    ).toHaveLength(2);
    expect(
      (await finish(await ideaGeneration(), candidates)).result.ideas,
    ).toHaveLength(0);
    expect(
      (await query("select count(*) n from pp.content_idea_seen"))[0].n,
    ).toBe(12);
  });
  it("persists template ideas when an emoji crosses the topic length boundary", async () => {
    const candidates = freeCandidates(
      {
        topic: "ก".repeat(74) + "🆓 รายละเอียดเพิ่มเติม",
        brand_id: null,
        source_ids: [],
        audience: "คนทั่วไป",
        goal: "ให้ความรู้",
        channel: "Facebook",
        pillar: "",
        format: "",
        variation: 0,
      },
      [],
      [],
      "2026-10-02",
    );
    const result = await finish(await ideaGeneration(), candidates);
    expect(result.result.ideas).toHaveLength(5);
  });
  it("protects normalized titles across different keys and keeps brands isolated", async () => {
    await finish(await ideaGeneration(), [candidate(1)]);
    const c = {
      ...candidate(1),
      key: "new-key",
      idea: { ...candidate(1).idea, title: "หัวข้อ  1!!!" },
    };
    expect(
      (await finish(await ideaGeneration(), [c])).result.ideas,
    ).toHaveLength(0);
    const b = (
      await query(
        "insert into pp.content_brands(name) values('Brand') returning id",
      )
    )[0].id as string;
    expect(
      (await finish(await ideaGeneration("template", b), [c])).result.ideas,
    ).toHaveLength(1);
  });
  it("does not resuggest manually saved work and stores raw Gemini output even if duplicate", async () => {
    await query("insert into pp.content_items(title) values('หัวข้อ 1')");
    const r = await finish(await ideaGeneration("ai"), [candidate(1)], [], {
      ideas: [candidate(1).idea],
    });
    expect(r.result.ideas).toHaveLength(0);
    expect(r.result.raw_ideas).toHaveLength(1);
  });
  it("atomically saves learned patterns, deduplicates their titles and prevents templates inventing learned entries", async () => {
    const p = {
      title: "เช็ก{subject}ก่อนเริ่ม",
      hook: "เปิด",
      angle: "ใช้ข้อมูลจริง",
      cta: "ถาม",
      format: "วิธีใช้",
    };
    const r = await finish(await ideaGeneration("ai"), [candidate(1)], [p, p]);
    expect(r.result.learned_count).toBe(1);
    expect(
      (await finish(await ideaGeneration("ai"), [candidate(2)], [p])).result
        .learned_count,
    ).toBe(0);
    expect(
      (
        await finish(
          await ideaGeneration(),
          [candidate(3)],
          [{ ...p, title: "ลอง{subject}" }],
        )
      ).result.learned_count,
    ).toBe(0);
    expect(
      (await query("select count(*) n from pp.content_patterns"))[0].n,
    ).toBe(1);
  });
  it.each(["anon", "authenticated"])(
    "denies %s completion RPC",
    async (role) => {
      const id = await ideaGeneration();
      await db.exec("set role " + role);
      await expect(finish(id, [candidate(1)])).rejects.toThrow();
    },
  );
});
