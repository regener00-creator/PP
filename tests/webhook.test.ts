import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/bot", () => ({ processEvent: vi.fn() }));
import { processEvent } from "../src/lib/bot";
import { POST } from "../src/app/api/line/webhook/route";
const destination = `U${"a".repeat(32)}`;
function request(body: string, signed = true) {
  return new Request("http://localhost/api/line/webhook", { method: "POST", body, headers: signed ? { "x-line-signature": createHmac("sha256", "test-secret").update(body).digest("base64") } : {} });
}
describe("webhook HTTP contract", () => {
  beforeEach(() => { process.env.LINE_CHANNEL_SECRET = "test-secret"; vi.mocked(processEvent).mockReset(); });
  it("supports LINE verification with empty events", async () => expect((await POST(request(JSON.stringify({ destination, events: [] })))).status).toBe(200));
  it("rejects unsigned requests before processing", async () => { expect((await POST(request("{}", false))).status).toBe(401); expect(processEvent).not.toHaveBeenCalled(); });
  it("rejects malformed signed JSON", async () => expect((await POST(request("{"))).status).toBe(400));
  it("asks LINE to redeliver failures while processing other events", async () => {
    vi.mocked(processEvent).mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce();
    expect((await POST(request(JSON.stringify({ destination, events: [{}, {}] })))).status).toBe(503);
    expect(processEvent).toHaveBeenCalledTimes(2);
  });
  it("bounds request body even without content-length", async () => expect((await POST(request("x".repeat(1024 * 1024 + 1)))).status).toBe(413));
});
