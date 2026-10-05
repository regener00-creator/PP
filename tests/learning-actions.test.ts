import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("../src/lib/db", () => ({ database: vi.fn() }));
vi.mock("../src/lib/learning", () => ({ runLearning: vi.fn() }));
import { requireAdmin } from "../src/lib/auth";
import { database } from "../src/lib/db";
import { runLearning } from "../src/lib/learning";
import {
  setLearningGroup,
  setLearningFriend,
  approveLearning,
  removeLearning,
  summarizeLearning,
} from "../src/app/admin/learning/actions";
const initial = { ok: false, message: "" };
const actions = [
  () => setLearningGroup(initial, new FormData()),
  () => setLearningFriend(initial, new FormData()),
  () => approveLearning(initial, new FormData()),
  () => removeLearning(initial, new FormData()),
  () => summarizeLearning(),
];
beforeEach(() => vi.clearAllMocks());
describe("retired learning actions", () => {
  it.each(actions)("still requires owner authorization", async (action) => {
    vi.mocked(requireAdmin).mockRejectedValue(Error("unauthorized"));
    await expect(action()).rejects.toThrow("unauthorized");
    expect(database).not.toHaveBeenCalled();
  });
  it.each(actions)(
    "rejects stale admin requests without changing data or using AI",
    async (action) => {
      vi.mocked(requireAdmin).mockResolvedValue(undefined as never);
      expect((await action()).ok).toBe(false);
      expect(database).not.toHaveBeenCalled();
      expect(runLearning).not.toHaveBeenCalled();
    },
  );
});
