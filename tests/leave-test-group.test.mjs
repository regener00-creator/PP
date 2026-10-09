import { expect, it, vi } from "vitest";
import { leaveTestGroup } from "../scripts/leave-test-group.mjs";
const url = "https://api.line.me/v2/bot/group/C1f3fc9a298ed97a230bbb1b4145bbb15";

it("leaves only the selected test group and verifies absence", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ status: 200 }).mockResolvedValueOnce({ status: 404 });
  expect(await leaveTestGroup({ token: "test-token", fetcher })).toEqual({ leftStatus: 200, summaryStatus: 404 });
  expect(fetcher.mock.calls.map(([path, options]) => [path, options.method])).toEqual([
    [`${url}/leave`, "POST"], [`${url}/summary`, "GET"],
  ]);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error", headers: { Authorization: "Bearer test-token" } });
});
it("accepts an already absent group only with the verification check", async () => {
  const fetcher = vi.fn().mockResolvedValue({ status: 404 });
  expect(await leaveTestGroup({ token: "test-token", fetcher })).toEqual({ leftStatus: 404, summaryStatus: 404 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([401, 403, 429, 500])("does not continue after LINE rejects leave (%s)", async (status) => {
  const fetcher = vi.fn().mockResolvedValue({ status });
  await expect(leaveTestGroup({ token: "test-token", fetcher })).rejects.toThrow("LINE group operation failed");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("does not report success if membership remains", async () => {
  const fetcher = vi.fn().mockResolvedValue({ status: 200 });
  await expect(leaveTestGroup({ token: "test-token", fetcher })).rejects.toThrow("absence not verified");
});
it("never calls LINE without a token", async () => {
  const fetcher = vi.fn();
  await expect(leaveTestGroup({ token: "", fetcher })).rejects.toThrow("token unavailable");
  expect(fetcher).not.toHaveBeenCalled();
});
it("does not propagate a network error containing credentials", async () => {
  const fetcher = vi.fn().mockRejectedValue(Error("PRIVATE_TEST_CANARY"));
  await expect(leaveTestGroup({ token: "test-token", fetcher })).rejects.toThrow(/^LINE group operation failed$/);
});
