import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), from: vi.fn(), insert: vi.fn(), update: vi.fn(), eq: vi.fn(),
  attachments: vi.fn(), revalidate: vi.fn(), owner: { line_user_id: "U" + "1".repeat(32) } as { line_user_id: string | null },
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/db", () => ({ database: () => ({ from: mocks.from }), dbError: (error: unknown) => { if (error) throw error; } }));
vi.mock("@/lib/library", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/library")>(), validateAttachments: mocks.attachments,
}));

import { saveCalendarEvent } from "../src/app/admin/workspace-actions";
import { dueDates, type CalendarEvent } from "../src/lib/calendar";

function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ title: "นัดหมาย", event_date: "2026-10-10", message: "เตือนนัดหมาย", remind_day: "on", send_owner: "on" })) data.set(key, value);
  return data;
}
const initial = { ok: false, message: "" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.owner.line_user_id = "U" + "1".repeat(32);
  mocks.auth.mockResolvedValue({ id: "owner" });
  mocks.attachments.mockResolvedValue(true);
  mocks.insert.mockResolvedValue({ error: null });
  mocks.eq.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockImplementation((table: string) => {
    if (table === "owner") return { select: () => ({ eq: () => ({ single: async () => ({ data: mocks.owner, error: null }) }) }) };
    if (table === "calendar_events") return { insert: mocks.insert, update: mocks.update };
    throw new Error(`Unexpected table: ${table}`);
  });
});

describe("calendar saves enable reminders without a separate switch", () => {
  it("creates a reminder that is due on its selected day without an enabled form field", async () => {
    expect(await saveCalendarEvent(initial, form())).toMatchObject({ ok: true });
    const saved = mocks.insert.mock.calls[0][0] as CalendarEvent;
    expect(saved.enabled).toBe(true);
    expect(dueDates(saved, "2026-10-10")).toEqual([{ lead: 0, occurs: "2026-10-10" }]);
    expect(dueDates(saved, "2026-10-09")).toEqual([]);
  });
  it("also enables edited events while preserving the chosen reminder day", async () => {
    const data = form(); data.set("id", "12345678-1234-4234-9234-123456789abc");
    data.delete("remind_day"); data.set("remind_before", "on");
    expect(await saveCalendarEvent(initial, data)).toMatchObject({ ok: true });
    const saved = mocks.update.mock.calls[0][0] as CalendarEvent;
    expect(saved.enabled).toBe(true);
    expect(dueDates(saved, "2026-10-09")).toEqual([{ lead: 1, occurs: "2026-10-10" }]);
    expect(dueDates(saved, "2026-10-10")).toEqual([]);
    expect(mocks.eq).toHaveBeenCalledWith("id", data.get("id"));
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(["remind_day", "send_owner"])("still rejects a missing day or recipient: %s", async field => {
    const data = form(); data.delete(field);
    expect(await saveCalendarEvent(initial, data)).toMatchObject({ ok: false });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("requires an owner LINE ID before saving a private reminder", async () => {
    mocks.owner.line_user_id = null;
    expect(await saveCalendarEvent(initial, form())).toMatchObject({ ok: false });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("does not write if owner authentication fails", async () => {
    mocks.auth.mockRejectedValue(new Error("unauthorized"));
    await expect(saveCalendarEvent(initial, form())).rejects.toThrow("unauthorized");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
