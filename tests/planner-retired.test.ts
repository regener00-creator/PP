import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: vi.fn(),
  ai: vi.fn(),
  line: vi.fn(),
}));
vi.mock("../src/lib/auth", () => ({ requireAdmin: mocks.auth }));
vi.mock("../src/lib/db", () => ({ database: mocks.db }));
vi.mock("../src/lib/planner-ai", () => ({ generatePlanner: mocks.ai }));
vi.mock("../src/lib/line", () => ({ lineRequest: mocks.line }));
import * as actions from "../src/app/planner/actions";
import { savePlannerGoals } from "../src/app/planner/goal-actions";
import { sendContentReminders } from "../src/lib/planner-reminders";
import { GET } from "../src/app/api/content-reminders/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "owner" });
});
it("all stale planner actions are authenticated and inert", async () => {
  for (const action of Object.values(actions)) await action();
  await savePlannerGoals();
  expect(mocks.auth).toHaveBeenCalledTimes(Object.keys(actions).length + 1);
  expect(mocks.db).not.toHaveBeenCalled();
  expect(mocks.ai).not.toHaveBeenCalled();
  expect(mocks.line).not.toHaveBeenCalled();
});
it("retired reminders cannot send even when invoked directly", async () => {
  expect(await sendContentReminders()).toMatchObject({
    retired: true,
    sent: 0,
  });
  expect((await GET()).status).toBe(410);
  expect(mocks.db).not.toHaveBeenCalled();
  expect(mocks.line).not.toHaveBeenCalled();
});
it("unauthenticated stale requests cannot proceed", async () => {
  mocks.auth.mockRejectedValue(Error("denied"));
  await expect(actions.saveContentItem()).rejects.toThrow("denied");
  expect(mocks.db).not.toHaveBeenCalled();
});
