import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), scope: vi.fn(), from: vi.fn(), refresh: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ requireAdmin: mock.auth }));
vi.mock("../src/lib/assistant-admin", () => ({ adminAssistantScope: mock.scope }));
vi.mock("next/cache", () => ({ revalidatePath: mock.refresh }));
vi.mock("../src/lib/db", () => ({ database: () => ({ from: mock.from }), dbError: (e: unknown) => { if(e) throw Error("db"); } }));
import { saveCalendarAppointment, deleteCalendarAppointment } from "../src/app/admin/assistant-calendar-actions";
const owner = `U${"a".repeat(32)}`, friend = `U${"b".repeat(32)}`, group = `C${"c".repeat(32)}`;
let row: Record<string, unknown> | null;
const initial = { ok: false, message: "" };
function form() {
  const f = new FormData();
  for (const [k,v] of Object.entries({ id: String(row!.id), title: "ตัดขนโจอา", event_date: "2026-10-12", content: "เวลา 13:00 น.", annual: "on", remind_before: "on" })) f.set(k,v);
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  row = { id: crypto.randomUUID(), scope_key: owner, sender_id: owner, title: "เดิม", event_date: "2026-10-10", enabled: true };
  mock.auth.mockResolvedValue({ id: "admin" });
  mock.scope.mockImplementation(async g => ({ sender: owner, group: g }));
  mock.from.mockImplementation(() => {
    let changes: Record<string, unknown> | undefined, remove = false;
    const filters: [string, unknown][] = [];
    const q = {
      update: (v: Record<string, unknown>) => { changes = v; return q; },
      delete: () => { remove = true; return q; },
      eq: (k: string,v: unknown) => { filters.push([k,v]); return q; },
      select: () => q,
      maybeSingle: async () => {
        if (!row || !filters.every(([k,v]) => row![k] === v)) return { data: null, error: null };
        const id = row.id;
        if (remove) row = null;
        else Object.assign(row, changes);
        return { data: { id }, error: null };
      },
    };
    return q;
  });
});
it("authenticates both write actions before accessing records", async () => {
  mock.auth.mockRejectedValue(Error("denied"));
  await expect(saveCalendarAppointment(initial,form())).rejects.toThrow("denied");
  await expect(deleteCalendarAppointment(initial,form())).rejects.toThrow("denied");
  expect(mock.from).not.toHaveBeenCalled();
});
it("edits the same appointment and refreshes the calendar without changing recipients", async () => {
  const f = form(); f.set("scope_key",friend); f.set("sender_id",friend);
  expect((await saveCalendarAppointment(initial,f)).ok).toBe(true);
  expect(row).toMatchObject({ title: "ตัดขนโจอา", event_date: "2026-10-12", content: "เวลา 13:00 น.", annual: true, remind_before: true, scope_key: owner, sender_id: owner });
  expect(mock.from).toHaveBeenCalledWith("assistant_events");
  expect(mock.refresh.mock.calls).toEqual([["/admin"]]);
});
it("cannot edit or delete another person's DM by guessing its id", async () => {
  row!.scope_key = friend;
  expect((await saveCalendarAppointment(initial,form())).ok).toBe(false);
  expect((await deleteCalendarAppointment(initial,form())).ok).toBe(false);
  expect(row!.title).toBe("เดิม");
  expect(mock.refresh).not.toHaveBeenCalled();
});
it("checks group access again on submit and fails without mutation when revoked", async () => {
  row!.scope_key = group;
  const f = form(); f.set("group",group);
  mock.scope.mockRejectedValue(Error("denied"));
  expect((await saveCalendarAppointment(initial,f)).ok).toBe(false);
  expect((await deleteCalendarAppointment(initial,f)).ok).toBe(false);
  expect(mock.from).not.toHaveBeenCalled();
});
it("deletes only the selected group appointment", async () => {
  row!.scope_key = group;
  const f = form(); f.set("group",group);
  expect((await deleteCalendarAppointment(initial,f)).ok).toBe(true);
  expect(row).toBeNull();
  expect(mock.scope).toHaveBeenCalledWith(group);
});
it("rejects invalid dates and reports missing records instead of claiming success", async () => {
  const f = form(); f.set("event_date","2026-02-30");
  expect((await saveCalendarAppointment(initial,f)).ok).toBe(false);
  expect(mock.from).not.toHaveBeenCalled();
  f.set("event_date","2026-10-12"); f.set("id",crypto.randomUUID());
  expect((await saveCalendarAppointment(initial,f)).ok).toBe(false);
  expect(row!.title).toBe("เดิม");
});

it("saves a chosen reminder time and rejects invalid clock values",async()=>{const f=form();f.set("reminder_time","13:00");expect((await saveCalendarAppointment(initial,f)).ok).toBe(true);expect(row?.reminder_time).toBe("13:00");for(const time of ["24:00","12:60","1:00","13:00:01"]){f.set("reminder_time",time);expect((await saveCalendarAppointment(initial,f)).ok).toBe(false);}expect(row?.reminder_time).toBe("13:00");});
