import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../src/lib/admin-notebooks", () => ({ adminNotebooks: mock.read }));
import { assistantCalendar, calendarAppointment } from "../src/lib/assistant-calendar";
import { occursOn } from "../src/lib/calendar";
import type { AssistantEvent } from "../src/lib/assistant-types";
const owner = `U${"a".repeat(32)}`, group = `C${"c".repeat(32)}`;
const record: AssistantEvent = { id: "event", scope_key: group, sender_id: owner, title: "ตัดขนโจอา", content: "13:00", event_date: "2026-10-10", annual: false, enabled: true, remind_before: true, reminder_time: "13:00" };
beforeEach(() => { vi.clearAllMocks(); mock.read.mockResolvedValue({ events: [record], notes: [], deliveries: [{ id: "delivery", event_id: record.id, target: group }] }); });
it("maps the authorized snapshot without another database round trip", async () => {
 const data = await assistantCalendar();
 expect(mock.read).toHaveBeenCalledOnce();
 expect(data.events[0]).toMatchObject({ id: "assistant:event", message: "13:00", reminder_time: "13:00", group_id: group, send_owner: false });
 expect(data.deliveries[0]).toMatchObject({ id: "assistant:delivery", event_id: "assistant:event", target: group });
});
it("maps owner DM and annual rules faithfully", () => {
 const event = calendarAppointment({ ...record, scope_key: owner });
 expect(event).toMatchObject({ send_owner: true, group_id: null, assistant: { id: "event", group: null } });
 expect(occursOn(event,"2026-10-10")).toBe(true);
 expect(occursOn(event,"2027-10-10")).toBe(false);
 expect(occursOn({...event,annual:true},"2027-10-10")).toBe(true);
});
it("propagates permission and database failures instead of showing a stale snapshot",async()=>{ mock.read.mockRejectedValue(Error("denied")); await expect(assistantCalendar()).rejects.toThrow("denied"); });
