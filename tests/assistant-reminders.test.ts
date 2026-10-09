import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  allowed: vi.fn(),
  quota: vi.fn(),
  push: vi.fn(),
  line: vi.fn(),
  updates: [] as unknown[],
  changed: false,
}));
vi.mock("../src/lib/db", () => ({
  database: () => ({ from: state.from, rpc: state.rpc }),
  dbError: (e: unknown) => {
    if (e) throw Error("db");
  },
}));
vi.mock("../src/lib/assistant", () => ({ assistantAllowed: state.allowed }));
vi.mock("../src/lib/reminders", () => ({
  quotaStatus: state.quota,
  pushOnce: state.push,
  lineJson: state.line,
}));
import { sendAssistantReminders } from "../src/lib/assistant-reminders";
const event = {
  id: "event",
  scope_key: `U${"a".repeat(32)}`,
  sender_id: `U${"a".repeat(32)}`,
  title: "นัดหมาย",
  content: "14:00",
  event_date: "2026-10-09",
  annual: false,
  remind_before: false,
  enabled: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  state.updates = [];
  state.changed = false;
  state.allowed.mockResolvedValue(true);
  state.quota.mockResolvedValue({ limit: 100, used: 0 });
  state.push.mockResolvedValue("sent");
  state.rpc.mockResolvedValue({
    error: null,
    data: {
      id: "delivery",
      attempts: 1,
      retry_key: "stable-uuid",
      payload: [{ type: "text", text: "นัดหมาย\n14:00" }],
    },
  });
  state.from.mockImplementation((table: string) => {
    let one = false;
    const q = {
      select: () => q,
      eq: () => q,
      order: () => q,
      range: () => q,
      maybeSingle: () => {
        one = true;
        return q;
      },
      update: (v: unknown) => {
        state.updates.push(v);
        return q;
      },
      then: (resolve: (v: unknown) => void) =>
        resolve({
          error: null,
          data:
            table === "assistant_events"
              ? one
                ? {
                    ...event,
                    title: state.changed ? "เปลี่ยนแล้ว" : event.title,
                  }
                : [event]
              : null,
        }),
    };
    return q;
  });
});
it("does not claim or send after the scheduled retry window", async () => {
  expect(
    await sendAssistantReminders(new Date("2026-10-09T03:00:00Z")),
  ).toMatchObject({ sent: 0 });
  expect(state.rpc).not.toHaveBeenCalled();
  expect(state.push).not.toHaveBeenCalled();
});
it("pushes to the scoped recipient with the durable payload and retry key", async () => {
  expect(
    await sendAssistantReminders(new Date("2026-10-09T01:05:00Z")),
  ).toMatchObject({ sent: 1 });
  expect(state.push).toHaveBeenCalledWith(
    event.scope_key,
    [{ type: "text", text: "นัดหมาย\n14:00" }],
    "stable-uuid",
  );
});
it("revoked membership cannot receive a pending reminder", async () => {
  state.allowed.mockResolvedValue(false);
  expect(
    await sendAssistantReminders(new Date("2026-10-09T01:05:00Z")),
  ).toMatchObject({ skipped: 1 });
  expect(state.push).not.toHaveBeenCalled();
});
it("changed appointment or persisted payload cannot send stale content", async () => {
  state.changed = true;
  await sendAssistantReminders(new Date("2026-10-09T01:05:00Z"));
  expect(state.push).not.toHaveBeenCalled();
  state.changed = false;
  state.rpc.mockResolvedValue({
    error: null,
    data: {
      id: "d",
      attempts: 2,
      retry_key: "same",
      payload: [{ type: "text", text: "OLD_PAYLOAD_CANARY" }],
    },
  });
  await sendAssistantReminders(new Date("2026-10-09T01:05:00Z"));
  expect(state.push).not.toHaveBeenCalled();
});
it("quota exhaustion skips a send without pretending success", async () => {
  state.quota.mockResolvedValue({ limit: 100, used: 100 });
  expect(
    await sendAssistantReminders(new Date("2026-10-09T01:05:00Z")),
  ).toMatchObject({ skipped: 1, sent: 0 });
  expect(state.push).not.toHaveBeenCalled();
});
it("failed deliveries retain their same retry key on retry", async () => {
  state.push.mockResolvedValue("delivery_error");
  expect(
    await sendAssistantReminders(new Date("2026-10-09T01:05:00Z")),
  ).toMatchObject({ failed: 1 });
  expect(state.updates).toContainEqual(
    expect.objectContaining({ status: "failed" }),
  );
  expect(state.push.mock.calls[0][2]).toBe("stable-uuid");
});
