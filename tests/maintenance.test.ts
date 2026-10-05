import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), run: vi.fn() }));
vi.mock("../src/lib/db", () => ({ database: () => ({ rpc: mocks.rpc }) }));
vi.mock("../src/lib/learning", () => ({ runLearning: mocks.run }));
import { GET } from "../src/app/api/maintenance/route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "a".repeat(32));
  mocks.rpc.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
it("only runs retention cleanup, never group learning", async () => {
  const result = await GET(
    new Request("http://localhost/api/maintenance", {
      headers: { authorization: "Bearer " + "a".repeat(32) },
    }),
  );
  expect(result.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("pp_cleanup");
  expect(mocks.run).not.toHaveBeenCalled();
});
it("rejects unauthorized scheduled requests before touching data", async () => {
  expect(
    (await GET(new Request("http://localhost/api/maintenance"))).status,
  ).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
