import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  db: vi.fn(),
  push: vi.fn(),
  quota: vi.fn(),
  line: vi.fn(),
  files: vi.fn(),
  validate: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({
  database: m.db,
  dbError: (e: unknown) => {
    if (e) throw Error("db");
  },
}));
vi.mock("../src/lib/reminders", () => ({
  pushOnce: m.push,
  quotaStatus: m.quota,
  lineJson: m.line,
}));
vi.mock("../src/lib/library", () => ({
  fileMessages: m.files,
  validateAttachments: m.validate,
  APP_URL: "https://pp.example",
}));
import { sendContentReminders } from "../src/lib/planner-reminders";
import { GET } from "../src/app/api/content-reminders/route";
import { emptyItem } from "../src/lib/planner-types";
const owner = "U" + "a".repeat(32),
  group = "C" + "b".repeat(32),
  id = "0c00c4ea-aee5-41b5-aacb-cfddc431e458";
let item: Record<string, unknown>,
  enabled: boolean,
  claim: Record<string, unknown> | null,
  updates: Record<string, unknown>[],
  itemReads: number;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret-".repeat(4);
  enabled = true;
  itemReads = 0;
  updates = [];
  item = {
    ...emptyItem(),
    id,
    title: "ทดสอบงาน",
    status: "ready",
    archived: false,
    scheduled_at: "2026-10-02T06:00:00.000Z",
    notify_owner: false,
    group_id: group,
    updated_at: "2026-10-01T00:00:00Z",
  };
  claim = {
    id: "delivery",
    retry_key: "stable-key",
    attempts: 1,
    payload: null,
    item_revision: null,
  };
  m.rpc.mockImplementation(async () => ({ data: claim, error: null }));
  m.quota.mockResolvedValue({ used: 0, limit: 300 });
  m.line.mockResolvedValue({ count: 3 });
  m.validate.mockResolvedValue(true);
  m.files.mockResolvedValue([]);
  m.push.mockResolvedValue("sent");
  m.db.mockReturnValue({
    rpc: m.rpc,
    from: (table: string) => {
      let single = false,
        update: Record<string, unknown> | undefined;
      const q = {
        select: () => q,
        eq: () => q,
        neq: () => q,
        gte: () => q,
        lt: () => q,
        order: () => q,
        limit: () => q,
        is: () => q,
        update: (u: Record<string, unknown>) => {
          update = u;
          updates.push(u);
          return q;
        },
        single: () => {
          single = true;
          return q;
        },
        maybeSingle: () => {
          single = true;
          return q;
        },
        then: (resolve: (v: unknown) => void) => {
          let data: unknown = null;
          if (table === "owner") data = { line_user_id: owner };
          if (table === "permissions") data = { enabled };
          if (table === "content_items") {
            itemReads++;
            data = single ? item : [item];
          }
          if (table === "content_deliveries")
            data = update?.payload ? { payload: update.payload } : null;
          resolve({ data, error: null });
        },
      };
      return q;
    },
  });
});
describe("planner automatic reminders", () => {
  it("does nothing outside the Thai morning window", async () => {
    expect(
      await sendContentReminders(new Date("2026-10-02T03:00:00Z")),
    ).toMatchObject({ sent: 0, outsideWindow: true });
    expect(m.db).not.toHaveBeenCalled();
  });
  it("persists exact payload before sending and uses the stable LINE retry key", async () => {
    expect(
      await sendContentReminders(new Date("2026-10-02T01:10:00Z")),
    ).toMatchObject({ sent: 1 });
    expect(updates[0]).toHaveProperty("payload");
    expect(m.push).toHaveBeenCalledWith(
      group,
      updates[0].payload,
      "stable-key",
    );
    expect(updates.at(-1)).toMatchObject({ status: "sent", payload: null });
  });
  it("does not resend a claimed item", async () => {
    claim = null;
    expect(
      await sendContentReminders(new Date("2026-10-02T01:10:00Z")),
    ).toMatchObject({ sent: 0 });
    expect(m.push).not.toHaveBeenCalled();
  });
  it("rechecks group authorization before sending", async () => {
    enabled = false;
    await sendContentReminders(new Date("2026-10-02T01:10:00Z"));
    expect(m.push).not.toHaveBeenCalled();
    expect(updates.at(-1)).toMatchObject({
      status: "skipped",
      reason: "group_disabled",
    });
  });
  it("counts group members against quota and skips when it cannot fit", async () => {
    m.quota.mockResolvedValue({ used: 298, limit: 300 });
    await sendContentReminders(new Date("2026-10-02T01:10:00Z"));
    expect(m.push).not.toHaveBeenCalled();
    expect(updates.at(-1)).toMatchObject({ reason: "quota_exhausted" });
  });
  it("does not retry stale payloads after content changed", async () => {
    claim = {
      ...claim,
      payload: [{ type: "text", text: "old" }],
      item_revision: "old",
    };
    await sendContentReminders(new Date("2026-10-02T01:10:00Z"));
    expect(m.push).not.toHaveBeenCalled();
    expect(updates.at(-1)).toMatchObject({ reason: "changed" });
  });
  it("requires the cron secret before touching data", async () => {
    expect(
      (await GET(new Request("https://pp.example/api/content-reminders")))
        .status,
    ).toBe(401);
    expect(m.db).not.toHaveBeenCalled();
  });
});
