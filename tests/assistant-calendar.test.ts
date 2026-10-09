import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), allowed: vi.fn(), from: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ requireAdmin: mock.auth }));
vi.mock("../src/lib/assistant", () => ({ assistantAllowed: mock.allowed }));
vi.mock("../src/lib/db", () => ({ database: () => ({ from: mock.from }), dbError: (e: unknown) => { if(e) throw Error("db"); } }));
import { assistantCalendar, calendarAppointment } from "../src/lib/assistant-calendar";
import { occursOn } from "../src/lib/calendar";
import type { AssistantEvent } from "../src/lib/assistant-types";
const owner = `U${"a".repeat(32)}`, friend = `U${"b".repeat(32)}`;
const group = `C${"a".repeat(32)}`, denied = `C${"b".repeat(32)}`, disabled = `C${"c".repeat(32)}`;
function appointment(scope: string): AssistantEvent {
  return { id: crypto.randomUUID(), title: "ตัดขนโจอา", content: "เวลา 13:00 น.", event_date: "2026-10-10", annual: false, remind_before: true, scope_key: scope, sender_id: scope.startsWith("C") ? friend : scope, enabled: true };
}
// A filter-aware store makes accidental unscoped reads fail the privacy assertions.
let tables: Record<string, Record<string, unknown>[]>;
const reads: [string, string, unknown][] = [];
beforeEach(() => {
  vi.clearAllMocks(); reads.length = 0;
  mock.auth.mockResolvedValue({ id: "admin" });
  mock.allowed.mockImplementation(async s => s.group !== denied);
  tables = {
    owner: [{ id: 1, line_user_id: owner }],
    permissions: [{ group_id: group, enabled: true }, { group_id: denied, enabled: true }, { group_id: disabled, enabled: false }],
    assistant_events: [owner, friend, group, denied, disabled].map(scope => ({ ...appointment(scope) })),
    assistant_deliveries: [],
  };
  tables.assistant_deliveries = tables.assistant_events.map(e => ({ id: crypto.randomUUID(), event_id: e.id, occurs_on: "2026-10-10", lead_days: 0, status: "sent", reason: "sent", created_at: "2026-10-10T01:05:00Z" }));
  mock.from.mockImplementation((table: string) => {
    let rows = tables[table] || [];
    let single = false;
    const q = {
      select: () => q, order: () => q,
      eq: (key: string, value: unknown) => { reads.push([table, key, value]); rows = rows.filter(r => r[key] === value); return q; },
      in: (key: string, values: unknown[]) => { rows = rows.filter(r => values.includes(r[key])); return q; },
      limit: (n: number) => { rows = rows.slice(0, n); return q; },
      single: () => { single = true; return q; },
      then: (resolve: (r: unknown) => void) => resolve({ data: single ? rows[0] : rows, error: null }),
    };
    return q;
  });
});
it("requires admin before any database access", async () => {
  mock.auth.mockRejectedValue(Error("denied"));
  await expect(assistantCalendar()).rejects.toThrow("denied");
  expect(mock.from).not.toHaveBeenCalled();
});
it("shows owner and authorized group appointments, never other DMs or disabled/denied groups", async () => {
  const result = await assistantCalendar();
  expect(result.events).toHaveLength(2);
  expect(result.events.map(e => e.assistant?.group)).toEqual([null, group]);
  expect(reads.filter(r => r[0] === "assistant_events")).toEqual([
    ["assistant_events", "scope_key", owner], ["assistant_events", "scope_key", group],
  ]);
  expect(result.deliveries).toHaveLength(2);
  expect(result.deliveries.map(d => d.target)).toEqual([owner, group]);
  for (const d of result.deliveries) expect(result.events.some(e => e.id === d.event_id)).toBe(true);
  expect(mock.from).not.toHaveBeenCalledWith("assistant_turns");
  expect(mock.from).not.toHaveBeenCalledWith("calendar_events");
});
it("does not read arbitrary notebooks when the owner LINE identity is absent", async () => {
  tables.owner[0].line_user_id = null;
  expect(await assistantCalendar()).toEqual({ events: [], deliveries: [] });
  expect(mock.from).not.toHaveBeenCalledWith("assistant_events");
});
it("maps dates, repeat rules and recipient faithfully with a collision-safe display id", () => {
  const record = appointment(group);
  const event = calendarAppointment(record);
  expect(event).toMatchObject({ id: `assistant:${record.id}`, message: "เวลา 13:00 น.", group_id: group, send_owner: false, remind_day: true, remind_before: true, assistant: { id: record.id, group } });
  expect(occursOn(event, "2026-10-10")).toBe(true);
  expect(occursOn(event, "2027-10-10")).toBe(false);
  expect(occursOn({ ...event, annual: true }, "2027-10-10")).toBe(true);
  expect(occursOn({ ...event, annual: true, event_date: "2028-02-29" }, "2029-02-28")).toBe(false);
});
it("reads updated values and stops displaying deleted appointments without copying records", async () => {
  const original = tables.assistant_events[0];
  original.title = "เลื่อนนัดตัดขน"; original.event_date = "2026-10-12";
  expect((await assistantCalendar()).events[0]).toMatchObject({ title: "เลื่อนนัดตัดขน", event_date: "2026-10-12" });
  tables.assistant_events = tables.assistant_events.filter(e => e !== original);
  expect((await assistantCalendar()).events).toHaveLength(1);
});
