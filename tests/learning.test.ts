import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), generate: vi.fn() }));
vi.mock("../src/lib/db", () => ({ database: mocks.db }));
vi.mock("ai", () => ({ generateText: mocks.generate }));
import { captureLearningEvent, runLearning } from "../src/lib/learning";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("retired group learning", () => {
  it("does not store group text or call AI even when the shared AI feature is enabled", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    expect(
      await captureLearningEvent(
        {
          type: "message",
          webhookEventId: "evt",
          timestamp: Date.now(),
          source: {
            type: "group",
            groupId: "C" + "c".repeat(32),
            userId: "U" + "a".repeat(32),
          },
          message: { type: "text", id: "msg", text: "เราชอบกาแฟ" },
        },
        "U" + "b".repeat(32),
      ),
    ).toBe(false);
    expect((await runLearning()).ok).toBe(false);
    expect(mocks.db).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
