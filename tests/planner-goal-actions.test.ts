import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  db: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
}));
vi.mock("../src/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("../src/lib/db", () => ({ database: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { savePlannerGoals } from "../src/app/planner/goal-actions";
import { defaultGoals } from "../src/lib/planner-goals";
const revision = "2026-10-03T03:00:00+00:00";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue(undefined);
  const chain = { eq: mocks.eq, select: () => ({ maybeSingle: mocks.single }) };
  mocks.eq.mockReturnValue(chain);
  mocks.update.mockReturnValue(chain);
  mocks.db.mockReturnValue({ from: () => ({ update: mocks.update }) });
});
describe("goal settings mutation", () => {
  it("requires owner authorization before touching storage", async () => {
    mocks.admin.mockRejectedValue(Error("unauthorized"));
    await expect(savePlannerGoals(defaultGoals, revision)).rejects.toThrow(
      "unauthorized",
    );
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("validates custom input before writing", async () => {
    expect((await savePlannerGoals([], revision)).ok).toBe(false);
    expect((await savePlannerGoals(defaultGoals, "bad")).ok).toBe(false);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("uses optimistic concurrency and surfaces stale edits instead of overwriting", async () => {
    mocks.single.mockResolvedValue({ data: null, error: null });
    const result = await savePlannerGoals(defaultGoals, revision);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("อีกหน้าต่าง");
    expect(mocks.eq).toHaveBeenCalledWith("updated_at", revision);
  });
  it("returns the stored revision after a successful edit", async () => {
    const settings = {
      goals: defaultGoals,
      updated_at: "2026-10-03T03:01:00+00:00",
    };
    mocks.single.mockResolvedValue({ data: settings, error: null });
    expect((await savePlannerGoals(defaultGoals, revision)).settings).toEqual(
      settings,
    );
  });
});
